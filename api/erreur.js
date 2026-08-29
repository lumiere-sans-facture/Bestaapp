// POST /api/erreur   { rapports: [...] }
//
// Journal des plantages. Volontairement SANS authentification : un plantage
// survient souvent avant que la session ne soit lue, ou justement parce
// qu'elle a échoué. Exiger un jeton ferait perdre les rapports les plus
// utiles.
//
// Ce que cette ouverture implique, et comment elle est tenue :
//   • le corps est plafonné (nombre de rapports, longueur des champs) ;
//   • rien n'est cru sur parole : les champs sont retaillés côté serveur, et
//     re-nettoyés de toute donnée personnelle même si le client l'a déjà
//     fait — un appel forgé ne peut donc pas glisser autre chose ;
//   • la table n'est lisible par personne depuis le navigateur (RLS sans
//     policy) : seul le service_role y accède.
import { createClient } from '@supabase/supabase-js';
import { nettoyer } from '../src/utils/journalErreurs.js';
import { limiter, erreurServeur, journaliser, PLAFONDS } from './_lib/garde.js';

const MAX_RAPPORTS = 30;
const url = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRole = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const texte = (v, max) => nettoyer(String(v ?? '')).slice(0, max);

/** Ligne prête pour la base, retaillée sans faire confiance à l'appelant. */
const ligne = (r) => ({
  code: texte(r?.code, 16) || 'ERR-0000',
  signature: texte(r?.signature, 200),
  message: texte(r?.message, 500),
  pile: texte(r?.pile, 2000),
  ecran: texte(r?.ecran, 120),
  origine: texte(r?.origine, 20),
  version: texte(r?.version, 40),
  appareil: texte(r?.appareil, 40),
  user_id: texte(r?.userId, 64) || null,
  org_id: texte(r?.orgId, 64) || null,
  role: texte(r?.role, 20) || null,
  en_ligne: r?.enLigne !== false,
  // La date vient de l'appareil, dont l'horloge peut être fausse : on garde
  // les deux, `recu_le` fait foi pour tout classement.
  survenu_le: Number.isNaN(Date.parse(r?.date)) ? null : new Date(r.date).toISOString(),
});

export default async function handler(req, res) {
  // Point d'entrée SANS authentification qui écrit en base : sans plafond,
  // une simple boucle gonflait la table des erreurs à volonté.
  if (limiter(req, res, PLAFONDS.erreur, 'erreur')) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }
  if (!url() || !serviceRole()) {
    // Journal non configuré : ce n'est pas la faute de l'utilisateur, et il
    // n'y a rien à réessayer. 200 pour que la file se vide au lieu de gonfler.
    res.status(200).json({ enregistres: 0, motif: 'Journal des erreurs non configuré' });
    return;
  }

  const corps = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  const rapports = Array.isArray(corps.rapports) ? corps.rapports.slice(0, MAX_RAPPORTS) : [];
  if (!rapports.length) {
    res.status(400).json({ error: 'Aucun rapport' });
    return;
  }

  try {
    const db = createClient(url(), serviceRole(), { auth: { persistSession: false } });
    const { error } = await db.from('erreurs').insert(rapports.map(ligne));
    if (error) throw new Error(error.message);
    res.status(200).json({ enregistres: rapports.length });
  } catch (e) {
    // Table absente (erreurs.sql pas encore exécuté) : inutile que l'appareil
    // rejoue indéfiniment un lot qui ne passera jamais.
    const absente = /does not exist|schema cache/i.test(e.message || '');
    if (absente) {
      journaliser('journal-erreurs-absent', req, { detail: String(e.message || '').slice(0, 200) });
      res.status(200).json({ error: 'Journal des erreurs indisponible', enregistres: 0 });
      return;
    }
    // Le message de Postgres cite la table, la colonne et parfois la requête :
    // il reste au journal serveur.
    erreurServeur(req, res, 500, 'Enregistrement impossible', e, { enregistres: 0 });
  }
}

function safeJson(txt) {
  try { return JSON.parse(txt); } catch { return {}; }
}
