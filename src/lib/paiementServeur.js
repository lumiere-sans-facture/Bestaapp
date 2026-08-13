// Confirmation d'un paiement auprès de NOTRE serveur (api/paiement/verifier).
//
// Le navigateur ne décide plus si un abonnement s'active : il transmet la
// référence de transaction, le serveur interroge l'agrégateur avec des clés
// que le navigateur n'a pas, et répond. Un retour de widget forgé depuis la
// console ne vaut donc plus rien.
//
// LOCAL-FIRST : si le serveur est injoignable (hors-ligne, `npm run dev` sans
// les fonctions Vercel, vérification pas encore configurée), on ne bloque
// personne — l'appel retourne `indisponible`, et l'app retombe sur la
// validation manuelle par le gérant, comme avant.
import { supabase, isSupabaseConfigured } from './supabase';

/**
 * @param {string} transactionId  référence rendue par le widget
 * @returns {Promise<{active?: boolean, deja?: boolean, dateFin?: string,
 *                    refuse?: boolean, motif?: string, indisponible?: boolean}>}
 */
export async function confirmerPaiement(transactionId) {
  if (!transactionId) return { indisponible: true };
  // Sans backend, il n'y a ni session ni serveur à interroger.
  if (!isSupabaseConfigured) return { indisponible: true };

  let token = '';
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || '';
  } catch { /* session illisible : on retombera sur la validation manuelle */ }
  if (!token) return { indisponible: true };

  try {
    const res = await fetch('/api/paiement/verifier', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ transactionId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { active: true, deja: !!data.deja, dateFin: data.dateFin };
    // 402 : l'agrégateur dit que le paiement n'a pas abouti. C'est un vrai
    // refus, à distinguer d'une panne — il ne faut PAS enregistrer une
    // demande d'abonnement dans ce cas.
    if (res.status === 402) return { refuse: true, motif: data.error || 'Paiement non abouti.' };
    // 401 : session expirée — l'utilisateur a bien pu payer, on ne le
    // pénalise pas, la validation manuelle prend le relais.
    return { indisponible: true, motif: data.error || `Vérification indisponible (${res.status}).` };
  } catch {
    return { indisponible: true };
  }
}
