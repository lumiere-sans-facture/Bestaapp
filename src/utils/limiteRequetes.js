// Limitation du débit des requêtes — logique pure, sans I/O.
//
// Les fonctions serverless de `api/` étaient ouvertes sans aucun plafond :
// /api/erreur écrit en base sans authentification, /api/paiement/verifier
// interroge un agrégateur payant, /api/solar et /api/youtube relaient des API
// tierces à quota. Une boucle depuis un seul poste pouvait donc gonfler la
// table des erreurs, épuiser un quota YouTube ou faire exploser la facture.
//
// ⚠️ PORTÉE RÉELLE : ce compteur vit dans la mémoire d'UNE instance
// serverless. Vercel en démarre plusieurs sous charge, et chacune repart à
// zéro — le plafond effectif est donc « N fois la limite ». C'est un
// garde-fou contre les boucles et les scripts naïfs, PAS une protection
// contre une attaque distribuée : celle-ci se traite au niveau du CDN/WAF
// (voir SECURITE.md). Mieux vaut le dire que le laisser croire.

/** Fenêtre glissante par défaut : une minute. */
export const FENETRE_MS = 60_000;

/**
 * Nombre maximal de clés (IP) suivies simultanément. Sans ce plafond, un
 * attaquant faisant tourner son adresse source ferait grossir la table
 * indéfiniment — le limiteur deviendrait lui-même le déni de service.
 */
export const CLES_MAX = 5000;

/**
 * Enregistre une requête et dit si elle est autorisée.
 *
 * @param {Map<string, number[]>} table  état partagé (horodatages par clé)
 * @param {string} cle                   identifiant de l'appelant (IP…)
 * @param {number} limite                requêtes autorisées par fenêtre
 * @param {object} options
 * @param {number} options.fenetre       durée de la fenêtre, en ms
 * @param {number} options.maintenant    horloge injectable (tests)
 * @returns {{autorise: boolean, restant: number, resetDans: number}}
 *          `resetDans` : secondes avant qu'une place ne se libère — c'est la
 *          valeur de l'en-tête `Retry-After`.
 */
export function consommer(table, cle, limite, { fenetre = FENETRE_MS, maintenant = Date.now() } = {}) {
  const plafond = Math.max(1, Math.floor(Number(limite) || 1));
  const depuis = maintenant - fenetre;

  // Les horodatages trop vieux sortent de la fenêtre : la liste reste bornée
  // par la limite elle-même, jamais par le nombre de tentatives.
  const passees = (table.get(cle) || []).filter((t) => t > depuis);

  if (passees.length >= plafond) {
    table.set(cle, passees);
    const plusAncienne = passees[0];
    return {
      autorise: false,
      restant: 0,
      resetDans: Math.max(1, Math.ceil((plusAncienne + fenetre - maintenant) / 1000)),
    };
  }

  passees.push(maintenant);
  table.set(cle, passees);
  return { autorise: true, restant: plafond - passees.length, resetDans: 0 };
}

/**
 * Purge les clés dont toutes les requêtes sont sorties de la fenêtre, puis
 * borne la taille de la table. À appeler périodiquement — sinon la mémoire de
 * l'instance ne redescend jamais.
 *
 * @returns {number} nombre de clés retirées
 */
export function purger(table, { fenetre = FENETRE_MS, maintenant = Date.now(), clesMax = CLES_MAX } = {}) {
  const depuis = maintenant - fenetre;
  let retirees = 0;
  for (const [cle, horodatages] of table) {
    const vivants = horodatages.filter((t) => t > depuis);
    if (!vivants.length) { table.delete(cle); retirees += 1; }
    else table.set(cle, vivants);
  }
  // Toujours pleine malgré la purge : on sacrifie les plus anciennes entrées.
  // Elles repartiront de zéro — préférable à une instance qui sature.
  if (table.size > clesMax) {
    const surplus = table.size - clesMax;
    for (const cle of [...table.keys()].slice(0, surplus)) { table.delete(cle); retirees += 1; }
  }
  return retirees;
}

/**
 * Adresse de l'appelant derrière le proxy Vercel.
 *
 * `x-forwarded-for` est une LISTE que le client peut préfixer à sa guise ; le
 * proxy ajoute la vraie adresse EN DERNIER. Prendre la première (le réflexe
 * courant) laisserait n'importe qui choisir son identité et contourner le
 * plafond en changeant d'en-tête à chaque appel.
 */
export function adresseAppelant(headers = {}) {
  const lire = (nom) => {
    const v = headers[nom] ?? headers[nom.toLowerCase()];
    return Array.isArray(v) ? v.join(',') : (v || '');
  };
  const chaine = String(lire('x-forwarded-for'));
  if (chaine.trim()) {
    const maillons = chaine.split(',').map((s) => s.trim()).filter(Boolean);
    if (maillons.length) return maillons[maillons.length - 1];
  }
  return String(lire('x-real-ip')).trim() || 'inconnue';
}
