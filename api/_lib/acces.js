// Accès réservé aux GÉRANTS — CÔTÉ SERVEUR EXCLUSIVEMENT.
// L'identité vient du jeton Supabase vérifié, jamais du corps de la requête ;
// le rôle est relu en base avec la clé service_role (qui ne quitte jamais
// les variables d'environnement Vercel).
import { createClient } from '@supabase/supabase-js';

const url = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRole = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anon = () => process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export const accesConfigure = () => !!(url() && serviceRole() && anon());

/**
 * Profil du GÉRANT (ou administrateur plateforme) porteur de ce jeton, sinon null.
 * @returns {Promise<{id: string, org_id: string, role: string}|null>}
 */
export async function gerantDuJeton(token) {
  if (!token || !accesConfigure()) return null;
  const client = createClient(url(), anon(), { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  const email = data?.user?.email;
  if (error || !email) return null;
  const admin = createClient(url(), serviceRole(), { auth: { persistSession: false } });
  const { data: profil } = await admin
    .from('profiles').select('id, org_id, role, is_platform_admin').eq('email', email.toLowerCase()).single();
  if (!profil) return null;
  return profil.role === 'gerant' || profil.is_platform_admin ? profil : null;
}
