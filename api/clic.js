// POST /api/clic   { code, visiteur? }
//
// Visite de la page d'installation /telecharger?ref=CODE : c'est une page
// statique, sans l'application ni ses clés — elle ne peut pas appeler la base
// elle-même. Cette route compte le clic à sa place, au nom du parrain.
//
// L'adresse et le navigateur sont lus dans la requête du VISITEUR (Vercel les
// transmet), puis passés à compter_clic_parrainage_serveur, réservée à la clé
// service_role : la base les hache avec un sel secret et ne compte qu'un clic
// par visiteur et par lien sur 24 h. Rien n'est cru sur parole : le code est
// retaillé, et l'empreinte calculée côté serveur, jamais fournie par l'appelant.
import { createClient } from '@supabase/supabase-js';
import { limiter, journaliser, PLAFONDS } from './_lib/garde.js';
import { adresseAppelant } from '../src/utils/limiteRequetes.js';

const url = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRole = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const CODE = /^[A-Za-z0-9][A-Za-z0-9-]{2,39}$/;
const VISITEUR = /^[A-Za-z0-9-]{8,64}$/;

export default async function handler(req, res) {
  if (limiter(req, res, PLAFONDS.clic, 'clic')) return;
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }
  const corps = typeof req.body === 'string' ? lireJson(req.body) : (req.body || {});
  const code = String(corps.code || '').trim();
  const visiteur = String(corps.visiteur || '').trim();
  if (!CODE.test(code)) {
    res.status(400).json({ error: 'Code de parrainage invalide' });
    return;
  }
  if (!url() || !serviceRole()) {
    // Comptage non configuré : rien à réessayer côté visiteur.
    res.status(200).json({ compte: false });
    return;
  }
  try {
    const base = createClient(url(), serviceRole(), { auth: { persistSession: false } });
    const { data, error } = await base.rpc('compter_clic_parrainage_serveur', {
      p_code: code,
      p_ip: adresseAppelant(req.headers || {}),
      p_ua: String(req.headers?.['user-agent'] || '').slice(0, 300),
      p_visiteur: VISITEUR.test(visiteur) ? visiteur : null,
    });
    if (error) throw new Error(error.message);
    res.status(200).json({ compte: data === true });
  } catch (e) {
    journaliser('clic-echec', req, { motif: String(e?.message || e).slice(0, 200) });
    // Un clic perdu ne doit jamais gêner le téléchargement.
    res.status(200).json({ compte: false });
  }
}

function lireJson(texte) {
  try { return JSON.parse(texte); } catch { return {}; }
}
