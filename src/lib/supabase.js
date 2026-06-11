import { createClient } from '@supabase/supabase-js';

// Configuration via variables d'environnement (Vercel / .env.local / secrets CI).
// Sans configuration, l'app fonctionne en mode local (stockage sur l'appareil).
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;
