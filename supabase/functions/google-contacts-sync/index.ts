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

const normalizeEmail = (email: unknown) => {
  const value = String(email || '').trim().toLowerCase();
  return value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
};

type Contact = {
  id?: string; name?: string; phone?: string; email?: string; company?: string;
  registeredByUserId?: string | null; registeredByName?: string; registeredByCode?: string;
  createdAt?: string | null; registrationHistory?: RegistrationSource[]; [key: string]: unknown;
};
type RegistrationSource = {
  userId?: string | null; partnerId?: string | null; partnerName?: string | null; partnerCode?: string | null;
  referredByPartnerId?: string | null; referredByPartnerName?: string | null; referredByPartnerCode?: string | null;
  firstAddedAt?: string | null; lastAddedAt?: string | null;
};
type ContactType = 'partner' | 'lead' | 'pro_client';
type Job = {
  id: string; org_id: string; partner_id: string; contact_type?: ContactType;
  normalized_phone: string; normalized_email?: string | null; contact_data: Contact;
  attempts: number; status: string; google_contact_resource_name?: string | null;
};
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
  // Le profil est normalement lié à auth.users.id. Cette voie couvre aussi
  // un compte Supabase créé avec téléphone, même lorsqu'il n'a pas d'e-mail.
  let { data: profile, error } = await client.from('profiles')
    .select('org_id').eq('id', auth.user.id).maybeSingle();
  // Compatibilité avec les anciens profils, historiquement reliés par e-mail.
  if (!profile?.org_id && auth.user.email) {
    const fallback = await client.from('profiles').select('org_id')
      .ilike('email', auth.user.email.toLowerCase()).maybeSingle();
    profile = fallback.data;
    error = error || fallback.error;
  }
  if (error || !profile?.org_id) throw new Error('Organisation introuvable.');
  return { client, orgId: profile.org_id as string };
}

async function setContactStatus(client: ReturnType<typeof db>, job: Job, status: string, error: string | null = null, resourceName: string | null = null, next: string | null = null) {
  const { error: rpcError } = await client.rpc('set_google_contact_sync_status_v3', {
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

const contactHasIdentity = (person: any, phone: string | null, email: string | null) => {
  const phoneMatch = phone && findContactByNormalizedPhone([person], phone, PAYS_PAR_DEFAUT);
  const emailMatch = email && (person?.emailAddresses || []).some((entry: any) => normalizeEmail(entry?.value) === email);
  return Boolean(phoneMatch || emailMatch);
};

async function findContact(token: string, phone: string | null, email: string | null) {
  let pageToken: string | undefined;
  do {
    const url = new URL('https://people.googleapis.com/v1/people/me/connections');
    // `metadata.sources` est indispensable à people.updateContact, et les
    // biographies / champs personnalisés permettent de conserver la note de
    // traçabilité au lieu d'écraser celle éventuellement présente dans Google.
    url.searchParams.set('personFields', 'names,phoneNumbers,emailAddresses,organizations,biographies,userDefined,metadata');
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message || 'Lecture des contacts Google impossible.');
    const match = (payload.connections || []).find((person: any) => contactHasIdentity(person, phone, email));
    if (match) return match;
    pageToken = payload.nextPageToken;
  } while (pageToken);
  return null;
}

const uniqueBy = <T>(items: T[], key: (item: T) => string | null) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const value = key(item);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

const traceNote = (contact: Contact) => {
  const history = Array.isArray(contact.registrationHistory) ? contact.registrationHistory : [];
  const primary: RegistrationSource = {
    userId: contact.registeredByUserId || null,
    partnerName: contact.registeredByName || null,
    partnerCode: contact.registeredByCode || null,
    firstAddedAt: contact.createdAt || null,
  };
  const sources = (history.length ? history : [primary]).map((source) =>
    source.userId && source.userId === primary.userId
      ? {
          ...primary,
          ...source,
          partnerName: source.partnerName || primary.partnerName,
          partnerCode: source.partnerCode || primary.partnerCode,
        }
      : source
  );
  const entries = sources.map((source) => {
    const person = [source.partnerName || '', source.partnerCode || ''].filter(Boolean).join(' — ') || 'Utilisateur Besta';
    const id = source.userId ? ` — ID : ${source.userId}` : '';
    const date = source.firstAddedAt || source.lastAddedAt || contact.createdAt || new Date().toISOString();
    const referrer = [source.referredByPartnerName || '', source.referredByPartnerCode || ''].filter(Boolean).join(' — ');
    return `- ${person}${id} — Date : ${date}${referrer ? ` — Référé par : ${referrer}` : ''}`;
  });
  return `Ajouté depuis l’application BestaSolar\n${entries.join('\n')}`;
};

const withoutBestaTrace = (biographies: any[]) => (biographies || [])
  .map((entry: any) => String(entry?.value || '').trim())
  .filter((value: string) => value && !value.includes('Ajouté depuis l’application BestaSolar'));

const personPayload = (contact: Contact, existing: any = null) => {
  const words = String(contact.name || 'Client BestaSolar').trim().split(/\s+/);
  const phone = String(contact.phone || '').trim();
  const email = normalizeEmail(contact.email);
  const existingPhones = existing?.phoneNumbers || [];
  const existingEmails = existing?.emailAddresses || [];
  const existingOrganizations = existing?.organizations || [];
  const existingDefined = existing?.userDefined || [];
  const payload: Record<string, any> = {
    names: [{ givenName: words[0] || 'Client', familyName: words.slice(1).join(' ') || undefined }],
    phoneNumbers: uniqueBy([...existingPhones, ...(phone ? [{ value: phone, type: 'mobile' }] : [])], (entry) => normalizePhoneNumber(entry?.value, PAYS_PAR_DEFAUT)),
    emailAddresses: uniqueBy([...existingEmails, ...(email ? [{ value: email, type: 'work' }] : [])], (entry) => normalizeEmail(entry?.value)),
    organizations: uniqueBy([...existingOrganizations, ...(contact.company ? [{ name: String(contact.company), type: 'work' }] : [])], (entry) => String(entry?.name || '').trim().toLowerCase()),
    biographies: [{ value: [...withoutBestaTrace(existing?.biographies), traceNote(contact)].join('\n\n'), contentType: 'TEXT_PLAIN' }],
    userDefined: [
      ...existingDefined.filter((entry: any) => !['Source', 'BestaSolar client', 'Dernière synchronisation'].includes(entry?.key)),
      { key: 'Source', value: 'BestaSolar' },
      { key: 'BestaSolar client', value: String(contact.id || '') },
      { key: 'Dernière synchronisation', value: new Date().toISOString() },
    ],
  };
  if (existing?.metadata?.sources) payload.metadata = { sources: existing.metadata.sources };
  return payload;
};

async function createContact(token: string, contact: Contact) {
  const payload = personPayload(contact);
  const response = await fetch('https://people.googleapis.com/v1/people:createContact', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const created = await response.json();
  if (!response.ok) throw new Error(created.error?.message || 'Création du contact Google impossible.');
  return created;
}

async function updateContact(token: string, existing: any, contact: Contact) {
  if (!existing?.resourceName || !existing?.metadata?.sources?.length) {
    throw new Error('Le contact Google existant ne peut pas être mis à jour.');
  }
  const url = new URL(`https://people.googleapis.com/v1/${existing.resourceName}:updateContact`);
  url.searchParams.set('updatePersonFields', 'names,phoneNumbers,emailAddresses,organizations,biographies,userDefined');
  url.searchParams.set('personFields', 'names,phoneNumbers,emailAddresses,organizations,biographies,userDefined,metadata');
  const response = await fetch(url, {
    method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(personPayload(contact, existing)),
  });
  const updated = await response.json();
  if (!response.ok) throw new Error(updated.error?.message || 'Mise à jour du contact Google impossible.');
  return updated;
}

async function processJob(client: ReturnType<typeof db>, job: Job) {
  const { data: config } = await client.from('google_contacts_configs').select('*').eq('org_id', job.org_id).eq('sync_enabled', true).maybeSingle();
  if (!config) {
    const next = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await updateJob(client, job, { status: 'failed', attempts: (job.attempts || 0) + 1, next_attempt_at: next, last_error: 'Compte Google Contacts non configuré.' });
    await setContactStatus(client, job, 'failed', 'Compte Google Contacts non configuré.', null, next);
    return { status: 'failed', error: 'Compte Google Contacts non configuré.', nextRetryAt: next };
  }
  const phone = normalizePhoneNumber(job.contact_data?.phone, PAYS_PAR_DEFAUT);
  const email = normalizeEmail(job.contact_data?.email);
  const identity = phone || (email ? `email:${email}` : null);
  if (!identity) {
    const message = 'Client sans numéro ni e-mail synchronisable.';
    await updateJob(client, job, { status: 'failed', attempts: (job.attempts || 0) + 1, last_error: message });
    await setContactStatus(client, job, 'failed', message, null, null);
    return { status: 'failed', error: message };
  }
  const { data: locked } = await client.rpc('acquire_google_contact_sync_lock', { p_org_id: job.org_id, p_normalized_phone: identity, p_seconds: 90 });
  if (!locked) return { status: 'pending', message: 'Une synchronisation de ce numéro est déjà en cours.' };
  try {
    const token = await accessToken(client, config);
    // Vérification juste avant toute création : téléphone OU e-mail. La liste
    // complète évite les faux négatifs des recherches préfixées de Google.
    const existing = await findContact(token, phone, email);
    if (existing) {
      const updated = await updateContact(token, existing, job.contact_data);
      await updateJob(client, job, { status: 'synced', synced_at: new Date().toISOString(), next_attempt_at: null, last_error: null, google_contact_resource_name: updated.resourceName || existing.resourceName || null, normalized_phone: identity, normalized_email: email });
      await setContactStatus(client, job, 'synced', null, updated.resourceName || existing.resourceName || null, null);
      return { status: 'synced', resourceName: updated.resourceName || existing.resourceName || null };
    }
    // Le verrou SQL couvre le petit intervalle recherche → création pour éviter
    // que deux appareils créent le même numéro ou e-mail simultanément.
    const created = await createContact(token, job.contact_data);
    await updateJob(client, job, { status: 'synced', synced_at: new Date().toISOString(), next_attempt_at: null, last_error: null, google_contact_resource_name: created.resourceName || null, normalized_phone: identity, normalized_email: email });
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
    await client.rpc('release_google_contact_sync_lock', { p_org_id: job.org_id, p_normalized_phone: identity });
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
    const contactType: ContactType = body.contactType === 'lead'
      ? 'lead'
      : body.contactType === 'pro_client'
        ? 'pro_client'
        : 'partner';
    const rawPhone = String(contact?.phone || '').trim();
    const normalizedPhone = normalizePhoneNumber(rawPhone, PAYS_PAR_DEFAUT);
    const normalizedEmail = normalizeEmail(contact?.email);
    const identity = normalizedPhone || (normalizedEmail ? `email:${normalizedEmail}` : null);
    if (!contactId || !identity) return json({ status: 'failed', error: 'Contact sans numéro ni e-mail synchronisable.' }, 400);
    const { data: existing } = await client.from('google_contact_sync_jobs').select('*')
      .eq('org_id', orgId).eq('contact_type', contactType).eq('partner_id', contactId).maybeSingle();
    if (existing && existing.normalized_phone === identity && ['synced', 'already_exists'].includes(existing.status)) return json({ status: 'synced', resourceName: existing.google_contact_resource_name || null });
    const jobInput = { org_id: orgId, partner_id: contactId, contact_type: contactType, normalized_phone: identity, normalized_email: normalizedEmail, contact_data: { ...contact, phone: rawPhone, email: normalizedEmail || '' }, status: 'pending', next_attempt_at: new Date().toISOString(), last_error: null };
    const { data: job, error } = await client.from('google_contact_sync_jobs')
      .upsert(jobInput, { onConflict: 'org_id,contact_type,partner_id' }).select().single();
    if (error || !job) throw new Error('File de synchronisation indisponible.');
    return json(await processJob(client, job as Job));
  } catch (error) {
    console.error('google_contact_sync_request_failed', error instanceof Error ? error.message : error);
    return json({ status: 'failed', error: error instanceof Error ? error.message : 'Synchronisation impossible.' }, 500);
  }
});
