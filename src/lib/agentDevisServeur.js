// Agent devis (prototype) : appel de NOTRE serveur (api/agent-devis), qui
// relaie la conversation vers Claude avec la clé qu'il est seul à détenir.
// Le jeton de session Supabase prouve qu'un gérant connecté est à l'origine
// de l'appel.
import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Envoie la conversation et renvoie la réponse de l'agent.
 * @param {Array} messages  conversation complète, contenus renvoyés tels quels
 * @returns {Promise<{content?: Array, stop_reason?: string, usage?: object, erreur?: string}>}
 */
export async function interrogerAgentDevis(messages) {
  let token = '';
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.auth.getSession();
      token = data?.session?.access_token || '';
    } catch { /* session illisible : le serveur refusera */ }
  }
  try {
    const res = await fetch('/api/agent-devis', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ messages }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { erreur: data.error || `Agent indisponible (${res.status}).` };
    return data;
  } catch {
    return { erreur: 'Serveur injoignable — vérifiez la connexion.' };
  }
}
