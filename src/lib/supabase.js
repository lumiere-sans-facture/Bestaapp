import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';

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
      // Le deep link Android est un client public : PKCE empêche une autre
      // application enregistrant le même scheme d'échanger le code OAuth.
      auth: { flowType: Capacitor.isNativePlatform() ? 'pkce' : 'implicit' },
    })
  : null;
