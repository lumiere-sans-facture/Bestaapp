import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});
const admin = () => createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function requireManager(req: Request) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Authentification requise.');
  const db = admin();
  const { data: auth, error: authError } = await db.auth.getUser(token);
  if (authError || !auth.user) throw new Error('Session invalide.');
  // `profiles.id` est une clé texte propre à l'app (voir supabase/schema.sql) : elle
  // n'a aucun rapport avec `auth.users.id`. L'e-mail est le point de jonction utilisé
  // partout ailleurs (AuthContext.fetchProfile) — on s'aligne dessus.
  const email = (auth.user.email || '').toLowerCase();
  if (!email) throw new Error('Compte sans adresse e-mail.');
  const { data: profile, error } = await db.from('profiles')
    .select('id, org_id, role').eq('email', email).single();
  if (error || !profile?.org_id) throw new Error('Organisation introuvable.');
  if (profile.role !== 'gerant') throw new Error('Réservé au gérant de l’organisation.');
  return { db, userId: auth.user.id, orgId: profile.org_id as string };
}

function callbackPage(siteUrl: string, ok: boolean, message: string) {
  const safe = message.replace(/[<>&]/g, '');
  const target = `${siteUrl.replace(/\/$/, '')}/plus/google-contacts?google_contacts=${ok ? 'connected' : 'error'}`;
  return new Response(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta http-equiv="refresh" content="2;url=${target}"><title>Google Contacts</title><body style="font-family:system-ui;padding:2rem"><h1>${ok ? 'Compte Google connecté' : 'Connexion impossible'}</h1><p>${safe}</p><p>Retour à BestaSolar…</p><script>window.opener?.postMessage({source:'bestasolar-google-contacts',ok:${ok}}, '${siteUrl}');</script></body></html>`, {
    status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  const siteUrl = Deno.env.get('SITE_URL') || url.origin;
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const redirectUri = Deno.env.get('GOOGLE_OAUTH_REDIRECT_URI') || `${url.origin}${url.pathname}?action=callback`;

  // Google revient directement ici : il n'y a donc pas de JWT. Le state court,
  // stocké en base et à usage unique, relie le retour à l'organisation sûre.
  if (action === 'callback') {
    try {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || !state || !clientId || !clientSecret) throw new Error('Réponse OAuth incomplète.');
      const db = admin();
      const { data: pending } = await db.from('google_contacts_oauth_states')
        .select('*').eq('id', state).is('used_at', null).gt('expires_at', new Date().toISOString()).single();
      if (!pending) throw new Error('Lien de connexion expiré ou déjà utilisé.');
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
      });
      const tokens = await tokenResponse.json();
      if (!tokenResponse.ok || !tokens.refresh_token) throw new Error(tokens.error_description || 'Google n’a pas fourni de jeton de renouvellement. Réessayez en autorisant l’accès.');
      const meResponse = await fetch('https://people.googleapis.com/v1/people/me?personFields=names,emailAddresses', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const me = meResponse.ok ? await meResponse.json() : {};
      const accountEmail = me.emailAddresses?.[0]?.value || null;
      const expiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString();
      const { error: saveError } = await db.from('google_contacts_configs').upsert({
        org_id: pending.org_id, google_account_email: accountEmail,
        refresh_token: tokens.refresh_token, access_token: tokens.access_token,
        access_token_expires_at: expiresAt, sync_enabled: true, connected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: 'org_id' });
      if (saveError) throw new Error('Enregistrement sécurisé du compte impossible.');
      await db.from('google_contacts_oauth_states').update({ used_at: new Date().toISOString() }).eq('id', pending.id);
      return callbackPage(siteUrl, true, accountEmail ? `Le compte ${accountEmail} est prêt.` : 'Le compte Google est prêt.');
    } catch (error) {
      console.error('google_contacts_oauth_callback_failed', error instanceof Error ? error.message : error);
      return callbackPage(siteUrl, false, error instanceof Error ? error.message : 'Connexion Google impossible.');
    }
  }

  try {
    const body = await req.json().catch(() => ({}));
    const requested = body.action || action;
    const { db, orgId, userId } = await requireManager(req);
    if (requested === 'get-config') {
      const { data } = await db.from('google_contacts_configs')
        .select('google_account_email, sync_enabled, connected_at, updated_at').eq('org_id', orgId).maybeSingle();
      return json({ configured: Boolean(data), config: data || null });
    }
    if (requested === 'disconnect') {
      await db.from('google_contacts_configs').delete().eq('org_id', orgId);
      return json({ disconnected: true });
    }
    if (requested !== 'start') return json({ error: 'Action inconnue.' }, 400);
    if (!clientId || !clientSecret) return json({ error: 'Google OAuth n’est pas configuré côté serveur.' }, 503);
    const state = crypto.randomUUID();
    const { error } = await db.from('google_contacts_oauth_states').insert({
      id: state, org_id: orgId, user_id: userId, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (error) throw new Error('Création de la session OAuth impossible.');
    const params = new URLSearchParams({
      client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
      scope: 'https://www.googleapis.com/auth/contacts https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline', prompt: 'consent', state,
    });
    return json({ authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  } catch (error) {
    console.error('google_contacts_oauth_failed', error instanceof Error ? error.message : error);
    return json({ error: error instanceof Error ? error.message : 'Action impossible.' }, 400);
  }
});
