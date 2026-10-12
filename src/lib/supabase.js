import { createClient, isAuthRetryableFetchError } from '@supabase/supabase-js';

// Récupère une valeur de configuration en tolérant plusieurs conventions de nommage :
// - nos variables VITE_SUPABASE_* (config manuelle)
// - les variables injectées par l'intégration Vercel ↔ Supabase, préfixées
//   NEXT_PUBLIC_<ref>_SUPABASE_* (exposées au client via envPrefix dans vite.config)
const pickEnv = (suffixes) => {
  for (const s of suffixes) {
    const direct = import.meta.env[`VITE_SUPABASE_${s}`];
    if (direct) return direct;
  }
  const keys = Object.keys(import.meta.env);
  for (const s of suffixes) {
    const key = keys.find((k) => k.startsWith('NEXT_PUBLIC_') && k.endsWith(`SUPABASE_${s}`));
    if (key) return import.meta.env[key];
  }
  return undefined;
};

const url = pickEnv(['URL']);
// Clé publique : ancienne (ANON_KEY, JWT) ou nouvelle (PUBLISHABLE_KEY)
const anonKey = pickEnv(['ANON_KEY', 'PUBLISHABLE_KEY']);

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      // Android échange désormais un ID token Google natif ; aucun code OAuth
      // n'est renvoyé par deep link. Le flux implicite reste celui du site.
      auth: { flowType: 'implicit' },
    })
  : null;

/**
 * E-mail de la session mémorisée sur l'appareil, lu SANS réseau.
 *
 * `getSession()` ne rend la main qu'après avoir renouvelé un jeton expiré
 * (au-delà d'une heure, donc à presque chaque réouverture de l'app) : un
 * aller-retour serveur, retenté jusqu'à 30 s quand le réseau hoquette. Pour
 * rouvrir l'app sur le profil mémorisé, l'adresse suffit ; la session est
 * vérifiée juste après, en arrière-plan (voir AuthContext).
 */
export const emailSessionMemorisee = () => {
  if (!supabase) return null;
  try {
    const session = JSON.parse(localStorage.getItem(supabase.auth.storageKey));
    return session?.user?.email || null;
  } catch {
    return null; // stockage indisponible ou format inattendu : chemin normal
  }
};

/**
 * Le jeton n'a pas pu être renouvelé faute de RÉSEAU. `getSession()` rend
 * alors « aucune session », mais la session reste sur l'appareil et la
 * librairie la renouvellera au retour du réseau : ce n'est pas une session
 * perdue, et l'app ne doit surtout pas se refermer sur le terrain.
 */
export const estCoupureReseauAuth = (erreur) => Boolean(erreur) && isAuthRetryableFetchError(erreur);
