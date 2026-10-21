// Échéancier de paiement d'une facture — logique pure, sans React.
//
// L'échéancier vit DANS la facture (`facture.echeancier`, ordre = ordre du
// tableau) : seul son émetteur le modifie. Les paiements, eux, sont des fiches
// à part ; ce module n'en reçoit que la SOMME, affectée aux échéances dans
// l'ordre (la plus ancienne d'abord). Rien de ce qui suit n'est stocké :
// couverture, statuts, reste et écart se recalculent à chaque lecture — le
// seul statut enregistré est celui qu'on FORCE à la main (`statutForce`).
//
// Une échéance : { id, libelle, type, date, dateFin, condition, montant, statutForce }
//   type 'date'      : à régler le jour `date` (« AAAA-MM-JJ ») ;
//   type 'periode'   : entre `date` et `dateFin` (« semaine du 12 au 16/10 ») ;
//   type 'condition' : sans date (« À la réception / mise en service »).
import { jourLocal, decalerJour, joursEntre, jourFr } from './date';

export const TYPES_ECHEANCE = [
  ['date', 'À une date'],
  ['periode', 'Sur une période'],
  ['condition', 'À une étape'],
];

export const STATUTS_ECHEANCE = {
  recu: 'Reçu', partiel: 'Partiel', en_retard: 'En retard', attendu: 'Attendu', a_venir: 'À venir',
};
// Suffixe de couleur partagé par .badge et .flat-badge (comme STATUT_EFFECTIF_BADGE).
export const STATUT_ECHEANCE_BADGE = {
  recu: 'success', partiel: 'info', en_retard: 'danger', attendu: 'warning', a_venir: 'muted',
};

/** Une échéance « attendue » tombe dans ce nombre de jours (ou sa période est en cours). */
export const JOURS_ATTENDU = 7;

/** Délai par défaut du complément d'acompte d'un projet en trois tranches. */
export const JOURS_COMPLEMENT = 21;

export const nouvelleEcheance = (champs = {}) => ({
  id: crypto.randomUUID(),
  libelle: '',
  type: 'condition',
  date: null,
  dateFin: null,
  condition: '',
  montant: 0,
  statutForce: null,
  ...champs,
});

const entier = (v) => Math.max(0, Math.round(Number(v) || 0));

/**
 * Découpe `total` selon des pourcentages. Chaque tranche est arrondie (au
 * millier au-delà de 100 000 F, sinon à la centaine) et la DERNIÈRE prend
 * l'appoint : la somme vaut toujours exactement le total.
 */
export function repartirEnTranches(total, pourcentages) {
  const t = entier(total);
  const pas = t >= 100000 ? 1000 : 100;
  const tranches = pourcentages.slice(0, -1).map((p) => Math.round((t * (Number(p) || 0)) / 100 / pas) * pas);
  const dejaReparti = tranches.reduce((s, v) => s + v, 0);
  return [...tranches, Math.max(0, t - dejaReparti)];
}

export const MODELES_ECHEANCIER = [
  { id: 'comptant', label: 'Comptant', description: 'Tout à la livraison.' },
  { id: 'acompte-solde', label: 'Acompte / Solde', description: 'Un acompte à la commande, le solde à la mise en service.' },
  { id: 'trois-tranches', label: '3 tranches (projet)', description: 'Acompte, complément d’acompte, puis solde à la réception.' },
  { id: 'personnalise', label: 'Personnalisé', description: 'Vos propres lignes, à compléter.' },
];

/**
 * Échéancier prêt à l'emploi pour un total donné.
 * @param {string} modeleId  identifiant de MODELES_ECHEANCIER
 * @param {number} total     total de la facture (TTC)
 * @param {object} [o]
 * @param {string} [o.emission]     jour d'émission « AAAA-MM-JJ » (défaut : aujourd'hui)
 * @param {number} [o.acomptePct]   acompte du modèle Acompte / Solde (défaut 50 %)
 * @param {number[]} [o.pourcentages] tranches du modèle 3 tranches (défaut 30/40/30)
 */
export function echeancierDepuisModele(modeleId, total, { emission = jourLocal(), acomptePct = 50, pourcentages = [30, 40, 30] } = {}) {
  const t = entier(total);
  if (modeleId === 'comptant') {
    return [nouvelleEcheance({ libelle: 'Paiement comptant', condition: 'À la livraison', montant: t })];
  }
  if (modeleId === 'acompte-solde') {
    const pct = Math.min(100, Math.max(0, Number(acomptePct) || 0));
    const [acompte, solde] = repartirEnTranches(t, [pct, 100 - pct]);
    return [
      nouvelleEcheance({ libelle: 'Acompte à la commande', type: 'date', date: emission, montant: acompte }),
      nouvelleEcheance({ libelle: 'Solde', condition: 'À la mise en service', montant: solde }),
    ];
  }
  if (modeleId === 'trois-tranches') {
    const [acompte, complement, solde] = repartirEnTranches(t, pourcentages);
    return [
      nouvelleEcheance({ libelle: 'Acompte', type: 'date', date: emission, montant: acompte }),
      nouvelleEcheance({ libelle: 'Complément d’acompte', type: 'date', date: decalerJour(emission, JOURS_COMPLEMENT), montant: complement }),
      nouvelleEcheance({ libelle: 'Solde', condition: 'À la réception / mise en service', montant: solde }),
    ];
  }
  return [nouvelleEcheance({ libelle: 'Échéance 1', type: 'date', date: emission, montant: t })];
}

/** Somme des échéances. */
export const totalEcheancier = (echeancier = []) => echeancier.reduce((s, e) => s + entier(e.montant), 0);

/** Total de la facture moins l'échéancier : 0 quand il est cohérent, positif s'il manque de l'argent. */
export const ecartEcheancier = (echeancier = [], total = 0) => entier(total) - totalEcheancier(echeancier);

/**
 * Statut d'une échéance, couverte à hauteur de `couvert`. Un statut forcé à
 * la main l'emporte toujours.
 */
export function statutEcheance(e, couvert = 0, aujourdhui = jourLocal()) {
  if (e?.statutForce && STATUTS_ECHEANCE[e.statutForce]) return e.statutForce;
  const montant = entier(e?.montant);
  if (montant === 0 || couvert >= montant) return 'recu';
  if (couvert > 0) return 'partiel';
  const debut = e.type === 'date' || e.type === 'periode' ? e.date : null;
  const fin = e.type === 'periode' ? (e.dateFin || e.date) : debut;
  if (fin && fin < aujourdhui) return 'en_retard';
  if (debut && (debut <= aujourdhui || joursEntre(aujourdhui, debut) <= JOURS_ATTENDU)) return 'attendu';
  return 'a_venir';
}

/**
 * Couverture de chaque échéance par la somme payée, dans l'ordre de
 * l'échéancier. Chaque ligne reçoit `couvert`, `du` (ce qui reste dû) et
 * `statut`.
 */
export function repartirPaiements(echeancier = [], paye = 0, aujourdhui = jourLocal()) {
  let disponible = entier(paye);
  return echeancier.map((e) => {
    const montant = entier(e.montant);
    const couvert = Math.min(montant, disponible);
    disponible -= couvert;
    return { ...e, montant, couvert, du: montant - couvert, statut: statutEcheance(e, couvert, aujourdhui) };
  });
}

/** Vrai si au moins une échéance est dépassée sans être couverte. */
export const echeancierEnRetard = (echeancier = [], paye = 0, aujourdhui = jourLocal()) =>
  repartirPaiements(echeancier, paye, aujourdhui).some((l) => l.statut === 'en_retard');

/** Jours de retard de l'échéance dépassée la plus ancienne (0 si aucune). */
export function joursRetardEcheancier(echeancier = [], paye = 0, aujourdhui = jourLocal()) {
  const fins = repartirPaiements(echeancier, paye, aujourdhui)
    .filter((l) => l.statut === 'en_retard' && !l.statutForce)
    .map((l) => (l.type === 'periode' ? (l.dateFin || l.date) : l.date))
    .filter(Boolean);
  return fins.length ? Math.max(...fins.map((fin) => joursEntre(fin, aujourdhui))) : 0;
}

/**
 * État de paiement d'une facture au jour dit : total, payé, reste, trop-perçu,
 * échéances couvertes, écart de l'échéancier et prochaine échéance due.
 * @param {{totalTTC?: number, echeancier?: object[]}} facture
 * @param {number} paye  somme des paiements enregistrés
 */
export function etatEcheancier(facture, paye = 0, aujourdhui = jourLocal()) {
  const total = entier(facture?.totalTTC);
  const p = entier(paye);
  const lignes = repartirPaiements(facture?.echeancier || [], p, aujourdhui);
  return {
    total,
    paye: p,
    reste: Math.max(0, total - p),
    tropPercu: Math.max(0, p - total),
    lignes,
    ecart: ecartEcheancier(facture?.echeancier || [], total),
    // Prochaine échéance à encaisser : la première qui reste due — sauf celle
    // que l'émetteur a déclarée reçue à la main.
    prochaine: lignes.find((l) => l.du > 0 && l.statut !== 'recu') || null,
  };
}

/**
 * Contrôle d'un paiement à enregistrer. Refusé s'il est nul ; au-delà du
 * reste, il crée un trop-perçu, qu'il faut confirmer explicitement.
 * @returns {{ valide: boolean, tropPercu: number, motif?: string }}
 */
export function controlerPaiement(montant, reste) {
  const m = entier(montant);
  if (m <= 0) return { valide: false, tropPercu: 0, motif: 'Montant à saisir.' };
  const trop = Math.max(0, m - entier(reste));
  return { valide: true, tropPercu: trop };
}

/**
 * Quand payer une échéance, en clair : « 23/09/2026 », « Du 12 au 16/10/2026 »,
 * « À la réception / mise en service ».
 */
export function quandEcheance(e = {}) {
  if (e.type === 'date') return jourFr(e.date) || 'Date à fixer';
  if (e.type === 'periode') {
    if (!e.date) return 'Période à fixer';
    if (!e.dateFin || e.dateFin === e.date) return jourFr(e.date);
    const [a1, m1, j1] = e.date.split('-');
    const [a2] = e.dateFin.split('-');
    const debut = a1 !== a2 ? jourFr(e.date) : (m1 === e.dateFin.split('-')[1] ? j1 : `${j1}/${m1}`);
    return `Du ${debut} au ${jourFr(e.dateFin)}`;
  }
  return e.condition || 'À préciser';
}
