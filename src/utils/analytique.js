// Analytique produit : QUELS événements existent, et ce qu'ils ont le droit
// de transporter. Logique pure, sans React ni réseau.
//
// DEUX RÈGLES, dictées par le contexte de l'app.
//
// 1. AUCUNE DONNÉE CLIENT. L'app contient les clients de chaque installateur.
//    Les propriétés d'un événement passent donc par le même nettoyage que les
//    rapports d'erreur, et les chemins d'URL sont normalisés : « /clients/c-4f2a »
//    devient « /clients/:id ». Sans cela, la simple liste des pages vues
//    livrerait les identifiants de tous les clients.
//
// 2. UNE LISTE BLANCHE D'ÉVÉNEMENTS. Un nom libre finit toujours par contenir
//    ce qu'il ne devrait pas (« devis_Kossi_Adjé »). Seuls les noms déclarés
//    ici partent ; les autres sont ignorés.
import { nettoyer } from './journalErreurs';

/** Les seuls événements que l'app émet. Un ajout se déclare ici, d'abord. */
export const EVENEMENTS = {
  PAGE_VUE: 'page_vue',
  DEVIS_CREE: 'devis_cree',
  COMMANDE_CREEE: 'commande_creee',
  ABONNEMENT_DEMANDE: 'abonnement_demande',
  PAIEMENT_VERIFIE: 'paiement_verifie',
  LECON_TERMINEE: 'lecon_terminee',
  ECRAN_PLANTE: 'ecran_plante',
};

const NOMS = new Set(Object.values(EVENEMENTS));
export const evenementValide = (nom) => NOMS.has(String(nom || ''));

/**
 * Chemin d'URL débarrassé de ses identifiants.
 * « /clients/c-4f2a-9b » → « /clients/:id », « /devis/12 » → « /devis/:id ».
 * Sans cette normalisation, la liste des pages vues serait un annuaire.
 */
export const cheminNormalise = (chemin) => {
  const c = String(chemin || '/').split('?')[0].split('#')[0];
  return c
    .split('/')
    .map((segment) => {
      if (!segment) return segment;
      // Identifiant s'il contient un chiffre ou dépasse la longueur d'un mot
      // de route : les segments de route sont courts et alphabétiques.
      if (/\d/.test(segment) || segment.length > 24) return ':id';
      return segment;
    })
    .join('/') || '/';
};

// Valeurs acceptées telles quelles : un nombre ou un booléen ne peut pas
// contenir de donnée personnelle. Les chaînes, si — elles sont nettoyées et
// tronquées.
const MAX_TEXTE = 80;
const MAX_PROPRIETES = 12;

/**
 * Propriétés sûres pour un événement : nettoyées, tronquées, plafonnées.
 * Les objets et tableaux sont écartés — ils transportent trop facilement une
 * fiche client entière.
 */
export const proprietesSures = (props = {}) => {
  const sortie = {};
  if (!props || typeof props !== 'object') return sortie;
  for (const [cle, valeur] of Object.entries(props).slice(0, MAX_PROPRIETES)) {
    if (valeur == null) continue;
    if (typeof valeur === 'number' || typeof valeur === 'boolean') {
      sortie[cle] = valeur;
    } else if (typeof valeur === 'string') {
      sortie[cle] = nettoyer(valeur).slice(0, MAX_TEXTE);
    }
    // objets, tableaux, fonctions : écartés volontairement
  }
  return sortie;
};

/**
 * Événement prêt pour l'envoi, ou null si le nom n'est pas déclaré.
 * @param {string} nom
 * @param {object} props
 * @param {{distinctId?: string, version?: string, date?: string}} contexte
 */
export const construireEvenement = (nom, props = {}, contexte = {}) => {
  if (!evenementValide(nom)) return null;
  return {
    event: nom,
    // Identifiant interne du compte, jamais un nom ni un e-mail. « anonyme »
    // avant connexion : un événement sans personne reste comptable.
    distinct_id: contexte.distinctId || 'anonyme',
    timestamp: contexte.date || new Date().toISOString(),
    properties: {
      ...proprietesSures(props),
      version: contexte.version || '',
      // Repère PostHog : distingue nos envois de ceux d'un SDK.
      $lib: 'bestasolar-pro',
    },
  };
};
