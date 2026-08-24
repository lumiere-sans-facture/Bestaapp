// Garde commune des fonctions serverless : plafond de requêtes, journal de
// sécurité, et réponses d'erreur qui ne racontent rien à l'attaquant.
//
// Trois besoins, un seul module, pour qu'aucun point d'entrée ne puisse
// « oublier » l'un des trois.
import { consommer, purger, adresseAppelant, FENETRE_MS } from '../../src/utils/limiteRequetes.js';

// Compteur en mémoire de l'instance. Voir l'avertissement de portée dans
// `src/utils/limiteRequetes.js` : c'est un garde-fou anti-boucle, pas une
// protection anti-DDoS — celle-ci se règle au niveau du CDN/WAF.
const compteurs = new Map();
let dernierePurge = 0;
const PURGE_TOUTES_LES = 60_000;

/**
 * Plafonds par point d'entrée, en requêtes par minute et par adresse.
 * Calibrés sur l'usage réel : une équipe de terrain, pas une place de marché.
 */
export const PLAFONDS = {
  // Écrit en base SANS authentification (un plantage survient souvent avant
  // que la session soit lue) : c'est le point d'entrée le plus exposé.
  erreur: 20,
  // Crée un abonnement et interroge un agrégateur payant. Un utilisateur
  // légitime confirme un paiement une fois, pas dix.
  paiementVerifier: 10,
  // Appelé par KkiaPay, qui réessaie : plus large, mais pas illimité.
  paiementWebhook: 60,
  // Relais d'API tierces à quota (PVGIS/NASA, YouTube), déjà mises en cache
  // par le CDN — seuls les nouveaux points de coordonnées arrivent jusqu'ici.
  solar: 30,
  youtube: 20,
};

/** Journal de sécurité : une ligne par événement, horodatée et attribuée. */
export function journaliser(evenement, req, extra = {}) {
  const ligne = {
    t: new Date().toISOString(),
    evenement,
    ip: adresseAppelant(req?.headers || {}),
    methode: req?.method || '?',
    chemin: (req?.url || '?').split('?')[0],
    ...extra,
  };
  // stdout : Vercel l'agrège dans les logs de la fonction, où il est
  // consultable et filtrable. Jamais renvoyé au client.
  console.log(`[securite] ${JSON.stringify(ligne)}`);
}

/**
 * Applique le plafond. Renvoie `true` si la requête a été REFUSÉE (l'appelant
 * doit alors rendre la main immédiatement).
 *
 *   if (limiter(req, res, PLAFONDS.solar, 'solar')) return;
 */
export function limiter(req, res, limite, nom) {
  const maintenant = Date.now();
  if (maintenant - dernierePurge > PURGE_TOUTES_LES) {
    dernierePurge = maintenant;
    purger(compteurs, { maintenant });
  }

  const ip = adresseAppelant(req?.headers || {});
  const verdict = consommer(compteurs, `${nom}:${ip}`, limite, { maintenant });

  res.setHeader('X-RateLimit-Limit', String(limite));
  res.setHeader('X-RateLimit-Remaining', String(verdict.restant));

  if (verdict.autorise) return false;

  res.setHeader('Retry-After', String(verdict.resetDans));
  journaliser('plafond-atteint', req, { point: nom, limite, fenetre_s: FENETRE_MS / 1000 });
  res.status(429).json({ error: 'Trop de requêtes. Réessayez dans un instant.' });
  return true;
}

/**
 * Répond une erreur SANS rien divulguer.
 *
 * Le client reçoit un message générique ; le détail (message d'exception,
 * requête SQL, nom de librairie, chemin serveur) ne part que dans le journal.
 * Un message d'erreur brut renseigne l'attaquant sur la pile technique et
 * peut recopier une requête ou un chemin — il n'a rien à faire dans une
 * réponse HTTP.
 */
export function erreurServeur(req, res, statut, messageClient, cause, extra = {}) {
  journaliser('erreur', req, {
    statut,
    ...extra,
    // `cause` peut être une Error, une chaîne, ou l'objet d'erreur Supabase.
    detail: String(cause?.message || cause || '').slice(0, 500),
  });
  res.status(statut).json({ error: messageClient });
}

/** Refus d'authentification : toujours journalisé, jamais détaillé au client. */
export function refusAuth(req, res, motif) {
  journaliser('auth-refusee', req, { motif });
  res.status(401).json({ error: 'Session non reconnue — reconnectez-vous.' });
}
