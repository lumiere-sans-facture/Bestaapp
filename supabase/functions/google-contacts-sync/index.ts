import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Une Edge Function est déployée de manière isolée : elle ne peut pas
// importer le module partagé de l'application. La normalisation est donc
// reproduite ici afin que la comparaison avec Google Contacts reste fiable.
const PAYS_PAR_DEFAUT = 'TG';
const INDICATIFS = { TG: '228', BJ: '229' };
const digitsOnly = (value: unknown) => String(value ?? '').replace(/[^0-9]/g, '');
const corrigePlanNational = (indicatif: string, national: string) =>
  indicatif === '229' && /^\d{8}$/.test(national) ? `01${national}` : national;
const normalizePhoneNumber = (phone: unknown, country = PAYS_PAR_DEFAUT) => {
  const brut = String(phone ?? '').trim();
  let digits = digitsOnly(brut);
  if (!digits) return null;

  const indicatif = INDICATIFS[country.toUpperCase() as keyof typeof INDICATIFS] || null;
  // Un indicatif déjà écrit par l'utilisateur est prioritaire sur le pays
  // par défaut : +228… ne peut donc jamais devenir +229228….
  let international = brut.startsWith('+');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
    international = true;
  }
  const indicatifPorte = Object.values(INDICATIFS)
    .find((code) => digits.startsWith(code) && digits.length > code.length + 6);
  if (indicatifPorte) international = true;

  if (international) {
    const code = Object.values(INDICATIFS).find((item) => digits.startsWith(item));
    if (code) digits = `${code}${corrigePlanNational(code, digits.slice(code.length))}`;
    return /^\d{7,15}$/.test(digits) ? `+${digits}` : null;
  }

  // Une saisie sans indicatif est locale. L'application travaille au Togo.
  if (!indicatif) return /^\d{7,15}$/.test(digits) ? `+${digits}` : null;
  const national = corrigePlanNational(indicatif, digits);
  return /^\d{7,12}$/.test(national) ? `+${indicatif}${national}` : null;
};
const findContactByNormalizedPhone = (contacts: any[], phone: string, country = PAYS_PAR_DEFAUT) => {
  const target = normalizePhoneNumber(phone, country);
  if (!target) return null;
  return (contacts || []).find((contact) =>
    (contact?.phoneNumbers || contact?.phones || []).some((item: any) =>
      normalizePhoneNumber(typeof item === 'string' ? item : item?.value, country) === target
    )
  ) || null;
};

type Contact = {
  id?: string; name?: string; phone?: string; email?: string; company?: string;
  registeredByName?: string; registeredByCode?: string; [key: string]: unknown;
};
type ContactType = 'partner' | 'lead';
type Job = { id: string; org_id: string; partner_id: string; contact_type?: ContactType; normalized_phone: string; contact_data: Contact; attempts: number; status: string };
const cors = { 'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') || '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const db = () => createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '', { auth: { persistSession: false, autoRefreshToken: false } });
const retryAt = (attempts: number) => new Date(Date.now() + Math.min(60 * 60 * 1000, 5 * 60 * 1000 * (2 ** Math.min(attempts, 4)))).toISOString();

async function currentOrg(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Authentification requise.');
  const client = db();
  const { data: auth } = await client.auth.getUser(token);
  if (!auth.user) throw new Error('Session invalide.');
  // profiles.id est une clé texte de l'application, indépendante de
  // auth.users.id : l'e-mail est le point de jonction fiable.
  const email = (auth.user.email || '').toLowerCase();
  if (!email) throw new Error('Compte sans adresse e-mail.');
  // Chaque membre de la même organisation doit synchroniser vers le compte
  // Google du gérant. La recherche insensible à la casse couvre les profils
  // dont l'adresse a été saisie avec des majuscules à l'inscription.
  const { data: profile, error } = await client.from('profiles').select('org_id').ilike('email', email).maybeSingle();
  if (error || !profile?.org_id) throw new Error('Organisation introuvable.');
  return { client, orgId: profile.org_id as string };
}

async function setContactStatus(client: ReturnType<typeof db>, job: Job, status: string, error: string | null = null, resourceName: string | null = null, next: string | null = null) {
  const { error: rpcError } = await client.rpc('set_google_contact_sync_status_v2', {
    p_org_id: job.org_id,
    p_contact_id: job.partner_id,
    p_contact_type: job.contact_type || 'partner',
    p_status: status,
    p_error: error, p_resource_name: resourceName, p_next_attempt_at: next,
  });
  // La réponse à l'application reste la source immédiate de l'état local :
  // une fiche tout juste créée peut ne pas avoir fini sa réplication dans
  // public.leads quand l'Edge Function termine. Ne jamais refaire créer un
  // contact Google uniquement parce que cette écriture de statut est en retard.
  if (rpcError) console.error('google_contact_sync_status_update_failed', {
    orgId: job.org_id, contactId: job.partner_id, contactType: job.contact_type || 'partner',
  });
}
async function updateJob(client: ReturnType<typeof db>, job: Job, patch: Record<string, unknown>) {
  await client.from('google_contact_sync_jobs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', job.id);
}

async function accessToken(client: ReturnType<typeof db>, config: any) {
  if (config.access_token && config.access_token_expires_at && new Date(config.access_token_expires_at).getTime() > Date.now() + 60_000) return config.access_token as string;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: Deno.env.get('GOOGLE_CLIENT_ID') || '', client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') || '', refresh_token: config.refresh_token, grant_type: 'refresh_token' }),
  });
  const refreshed = await response.json();
  if (!response.ok || !refreshed.access_token) throw new Error(refreshed.error_description || 'Renouvellement du jeton Google impossible.');
  await client.from('google_contacts_configs').update({ access_token: refreshed.access_token, access_token_expires_at: new Date(Date.now() + Number(refreshed.expires_in || 3600) * 1000).toISOString(), updated_at: new Date().toISOString() }).eq('org_id', config.org_id);
  return refreshed.access_token as string;
}

async function findContactByPhone(token: string, phone: string) {
  let pageToken: string | undefined;
  do {
    const url = new URL('https://people.googleapis.com/v1/people/me/connections');
    url.searchParams.set('personFields', 'names,phoneNumbers');
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || 'Lecture des contacts Google impossible.');
    const match = findContactByNormalizedPhone(payload.connections || [], phone, PAYS_PAR_DEFAUT);
    if (match) return match;
    pageToken = payload.nextPageToken;
  } while (pageToken);
  return null;
}

async function createContact(token: string, contact: Contact, normalizedPhone: string) {
  const words = String(contact.name || 'Partenaire BestaSolar').trim().split(/\s+/);
  // Google Contacts doit recevoir le numéro exact qui a été renseigné. La
  // version normalisée sert seulement aux doublons et aux verrous internes.
  const phoneValue = String(contact.phone || '').trim() || normalizedPhone;
  const payload: Record<string, unknown> = {
    names: [{ givenName: words[0] || 'Partenaire', familyName: words.slice(1).join(' ') || undefined }],
    phoneNumbers: [{ value: phoneValue, type: 'mobile' }],
  };
  if (contact.email) payload.emailAddresses = [{ value: String(contact.email), type: 'work' }];
  if (contact.company) payload.organizations = [{ name: String(contact.company), type: 'work' }];
  const enregistrant = [String(contact.registeredByName || '').trim(), String(contact.registeredByCode || '').trim()]
    .filter(Boolean).join(' — ');
  if (enregistrant) {
    // Champ personnalisé visible dans Google Contacts : la source de la fiche
    // reste identifiable même après un export ou un changement d'appareil.
    payload.userDefined = [
      { key: 'Source', value: 'BestaSolar' },
      { key: 'Enregistré par', value: enregistrant },
    ];
  }
  const response = await fetch('https://people.googleapis.com/v1/people:createContact', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const created = await response.json();
  if (!response.ok) throw new Error(created.error?.message || 'Création du contact Google impossible.');
  return created;
}

async function processJob(client: ReturnType<typeof db>, job: Job) {
  const { data: config } = await client.from('google_contacts_configs').select('*').eq('org_id', job.org_id).eq('sync_enabled', true).maybeSingle();
  if (!config) {
    const next = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await updateJob(client, job, { status: 'pending', next_attempt_at: next, last_error: 'Compte Google Contacts non configuré.' });
    await setContactStatus(client, job, 'pending', 'Compte Google Contacts non configuré.', null, next);
    return { status: 'pending', nextRetryAt: next };
  }
  const { data: locked } = await client.rpc('acquire_google_contact_sync_lock', { p_org_id: job.org_id, p_normalized_phone: job.normalized_phone, p_seconds: 90 });
  if (!locked) return { status: 'pending', message: 'Une synchronisation de ce numéro est déjà en cours.' };
  try {
    const token = await accessToken(client, config);
    // Vérification juste avant toute création : les numéros Google sont normalisés
    // avec la même fonction partagée que la saisie BestaSolar.
    const existing = await findContactByPhone(token, job.normalized_phone);
    if (existing) {
      await updateJob(client, job, { status: 'already_exists', synced_at: new Date().toISOString(), next_attempt_at: null, last_error: null, google_contact_resource_name: existing.resourceName || null });
      await setContactStatus(client, job, 'already_exists', null, existing.resourceName || null, null);
      return { status: 'already_exists', resourceName: existing.resourceName || null };
    }
    // Le verrou SQL couvre le petit intervalle recherche → création pour éviter
    // que deux appareils créent le même numéro simultanément.
    const created = await createContact(token, job.contact_data, job.normalized_phone);
    await updateJob(client, job, { status: 'synced', synced_at: new Date().toISOString(), next_attempt_at: null, last_error: null, google_contact_resource_name: created.resourceName || null });
    await setContactStatus(client, job, 'synced', null, created.resourceName || null, null);
    return { status: 'synced', resourceName: created.resourceName || null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Synchronisation Google impossible.';
    const next = retryAt((job.attempts || 0) + 1);
    console.error('google_contact_sync_failed', { orgId: job.org_id, contactId: job.partner_id, contactType: job.contact_type || 'partner', message });
    await updateJob(client, job, { status: 'failed', attempts: (job.attempts || 0) + 1, last_error: message.slice(0, 1000), next_attempt_at: next });
    await setContactStatus(client, job, 'failed', message, null, next);
    return { status: 'failed', error: message, nextRetryAt: next };
  } finally {
    await client.rpc('release_google_contact_sync_lock', { p_org_id: job.org_id, p_normalized_phone: job.normalized_phone });
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const client = db();
    if (body.action === 'retry-pending') {
      if (!Deno.env.get('GOOGLE_CONTACTS_CRON_SECRET') || req.headers.get('x-google-contacts-cron-secret') !== Deno.env.get('GOOGLE_CONTACTS_CRON_SECRET')) return json({ error: 'Non autorisé.' }, 401);
      const { data: jobs } = await client.from('google_contact_sync_jobs').select('*').in('status', ['pending', 'failed']).lte('next_attempt_at', new Date().toISOString()).limit(50);
      const results = [];
      for (const job of (jobs || [])) results.push(await processJob(client, job as Job));
      return json({ processed: results.length, results });
    }
    const { orgId } = await currentOrg(req);
    const contact = body.contact as Contact;
    const contactId = String(body.contactId || body.partnerId || contact?.id || '');
    const contactType: ContactType = body.contactType === 'lead' ? 'lead' : 'partner';
    const rawPhone = String(contact?.phone || '').trim();
    const normalizedPhone = normalizePhoneNumber(rawPhone, PAYS_PAR_DEFAUT);
    if (!contactId || !normalizedPhone) return json({ status: 'failed', error: 'Contact ou numéro de téléphone invalide.' }, 400);
    const { data: existing } = await client.from('google_contact_sync_jobs').select('*').eq('org_id', orgId).eq('partner_id', contactId).maybeSingle();
    if (existing && existing.normalized_phone === normalizedPhone && ['synced', 'already_exists'].includes(existing.status)) return json({ status: existing.status, resourceName: existing.google_contact_resource_name || null });
    const jobInput = { org_id: orgId, partner_id: contactId, contact_type: contactType, normalized_phone: normalizedPhone, contact_data: { ...contact, phone: rawPhone }, status: 'pending', next_attempt_at: new Date().toISOString(), last_error: null };
    const { data: job, error } = await client.from('google_contact_sync_jobs').upsert(jobInput, { onConflict: 'org_id,partner_id' }).select().single();
    if (error || !job) throw new Error('File de synchronisation indisponible.');
    return json(await processJob(client, job as Job));
  } catch (error) {
    console.error('google_contact_sync_request_failed', error instanceof Error ? error.message : error);
    return json({ status: 'failed', error: error instanceof Error ? error.message : 'Synchronisation impossible.' }, 500);
  }
});

