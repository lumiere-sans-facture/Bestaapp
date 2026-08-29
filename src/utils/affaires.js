// Suivi commercial — logique métier pure.
// Le kanban suit les AFFAIRES : une carte par devis (un client avec deux devis
// a deux cartes, avancées séparément et rémunérées chacune), et une carte de
// prospection tant qu'un client n'a aucun devis. Les écrans qui raisonnent par
// client utilisent `etapeDuClient` pour la synthèse.
// La numérotation des documents est déduite de l'existant : un compteur local
// n'est pas répliqué et produirait des numéros en double entre appareils.
import { DAY_MS, ageInDays } from './date';
import { formatCFA } from './format';
import { COMPANY } from '../config/company';

/** Étape d'un devis : la sienne, sinon celle de son client (devis créés avant
 *  le suivi par devis), sinon « nouveau » — jamais « proposition » par défaut :
 *  émettre un devis ne fait sauter aucune étape du parcours commercial réel
 *  (qualification, visite…), il démarre où en est déjà le client. */
export const devisStage = (d, lead) => d.stage || lead?.stage || 'nouveau';

/**
 * Construit les cartes du pipeline : UNE CARTE PAR DEVIS.
 * Un client avec deux devis a donc DEUX cartes, avancées indépendamment
 * (chacune sa colonne, chacune son issue, chacune sa commission).
 * Un client sans aucun devis garde une carte « piste » (prospection).
 *
 * Chaque carte : { key, kind: 'devis'|'piste', lead, devis, stage, value }.
 *  - kind 'devis' : `devis` est LE devis suivi
 *  - kind 'piste' : `devis` vaut null
 */
export function buildAffaires(leads = [], devisList = []) {
  const parPiste = new Map();
  for (const d of devisList) {
    if (d.type === 'pro') continue;
    if (!parPiste.has(d.leadId)) parPiste.set(d.leadId, []);
    parPiste.get(d.leadId).push(d);
  }
  const cartes = [];
  for (const lead of leads) {
    const ds = parPiste.get(lead.id) || [];
    if (!ds.length) {
      cartes.push({
        key: `piste-${lead.id}`,
        kind: 'piste',
        lead,
        devis: null,
        stage: lead.stage,
        value: Number(lead.estimatedValue) || 0,
      });
      continue;
    }
    // Devis les plus récents en tête : le dernier créé se voit en premier.
    const tries = [...ds].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    for (const d of tries) {
      cartes.push({
        key: `devis-${d.id}`,
        kind: 'devis',
        lead,
        devis: d,
        stage: devisStage(d, lead),
        value: Number(d.total) || 0,
      });
    }
  }
  return cartes;
}

/**
 * Prochain numéro de devis du jour : `BS-AAAAMMJJ-NNNN`.
 *
 * Le rang est DÉDUIT des devis déjà enregistrés, jamais d'un compteur séparé :
 * un compteur vit dans l'état local, n'est pas répliqué, et diverge donc d'un
 * appareil à l'autre — deux devis finissaient par porter le même numéro.
 * @param {Array<{devisNumber?: string}>} devisList tous les devis connus
 * @param {Date} maintenant
 */
export function prochainNumeroDevis(devisList = [], maintenant = new Date()) {
  const j = `${maintenant.getFullYear()}${String(maintenant.getMonth() + 1).padStart(2, '0')}${String(maintenant.getDate()).padStart(2, '0')}`;
  const prefixe = `BS-${j}-`;
  const rangs = devisList
    .map((d) => d.devisNumber)
    .filter((n) => typeof n === 'string' && n.startsWith(prefixe))
    .map((n) => parseInt(n.slice(prefixe.length), 10))
    .filter((n) => Number.isFinite(n));
  const rang = (rangs.length ? Math.max(...rangs) : 0) + 1;
  return `${prefixe}${String(rang).padStart(4, '0')}`;
}

/**
 * Prochain numéro de commande du jour : `CMD-AAAAMMJJ-NNNN`.
 * Déduit des commandes enregistrées, pour la même raison que les devis :
 * un compteur local n'est pas répliqué et diverge entre appareils.
 */
export function prochainNumeroCommande(orders = [], maintenant = new Date()) {
  const j = `${maintenant.getFullYear()}${String(maintenant.getMonth() + 1).padStart(2, '0')}${String(maintenant.getDate()).padStart(2, '0')}`;
  const prefixe = `CMD-${j}-`;
  const rangs = orders
    .map((o) => o.orderNumber)
    .filter((n) => typeof n === 'string' && n.startsWith(prefixe))
    .map((n) => parseInt(n.slice(prefixe.length), 10))
    .filter((n) => Number.isFinite(n));
  return `${prefixe}${String((rangs.length ? Math.max(...rangs) : 0) + 1).padStart(4, '0')}`;
}

/** Tous les devis publics d'un client (pour la fiche : « ses autres affaires »). */
export const devisDuClient = (leadId, devisList = []) =>
  devisList.filter((d) => d.leadId === leadId && d.type !== 'pro');

const ORDRE_ETAPES = ['nouveau', 'qualifie', 'visite', 'proposition', 'negociation', 'gagne'];

/**
 * Étape d'un CLIENT déduite de ses affaires : la plus avancée de ses devis non
 * perdus ; « perdu » seulement si toutes le sont ; null s'il n'a aucun devis
 * (sa piste garde alors sa propre étape).
 * Le kanban suit les devis, mais les écrans qui raisonnent par client (fiche
 * client, tableau de bord, espace partenaire) ont besoin de cette synthèse —
 * sans elle, un client dont le devis est gagné resterait badgé « Nouveau ».
 */
export function etapeDuClient(stagesDevis = []) {
  if (!stagesDevis.length) return null;
  const ouvertes = stagesDevis.filter((st) => st !== 'perdu');
  if (!ouvertes.length) return 'perdu';
  return ouvertes.reduce((best, st) =>
    (ORDRE_ETAPES.indexOf(st) > ORDRE_ETAPES.indexOf(best) ? st : best));
}

// ---------------------------------------------------------------------------
// CYCLE DE VIE D'UN DEVIS — état dérivé, jamais stocké.
//
// Un devis finalisé restait une affaire ouverte indéfiniment : au bout de six
// mois, le kanban montrait encore comme « en négociation » des devis dont le
// prix n'était plus valable. La validité est une donnée du document (elle est
// imprimée dessus) ; l'état s'en déduit, exactement comme le statut d'un
// abonnement se déduit de sa date de fin (utils/subscription.js).
//
// Ne rien stocker évite la dérive classique : un champ « expiré » figé le jour
// où quelqu'un a ouvert l'app, faux dès le lendemain, et qui doit être
// recalculé par une tâche de fond — impossible dans une app locale d'abord.
// ---------------------------------------------------------------------------

/**
 * Validité par défaut d'un devis, en jours.
 * DÉCISION D3 EN ATTENTE (feuille de route) : le cahier des charges évoque
 * 60 jours, la pratique actuelle est de 30. On reste sur 30 — la valeur
 * imprimée sur les devis déjà émis — et chaque devis peut porter la sienne
 * dans `validiteJours`.
 */
export const VALIDITE_JOURS = 30;

const jourISO = (d) => new Date(d).toISOString().slice(0, 10);

/** Dernier jour de validité d'un devis (AAAA-MM-JJ), ou null si indatable. */
export function dateExpiration(devis) {
  const depart = devis?.date || devis?.createdAt;
  if (!depart) return null;
  const t = new Date(depart).getTime();
  if (!Number.isFinite(t)) return null;
  const jours = Number(devis.validiteJours) > 0 ? Number(devis.validiteJours) : VALIDITE_JOURS;
  return jourISO(t + jours * DAY_MS);
}

/**
 * Jours restants avant expiration : 0 le dernier jour, négatif au-delà.
 * null si le devis n'est pas datable.
 */
export function joursAvantExpiration(devis, maintenant = new Date()) {
  const fin = dateExpiration(devis);
  if (!fin) return null;
  return Math.round((new Date(`${fin}T00:00:00`) - new Date(`${jourISO(maintenant)}T00:00:00`)) / DAY_MS);
}

/**
 * État commercial d'un devis, dans l'ordre où il prime :
 *
 *  · `brouillon` — pas encore émis, donc rien à expirer ;
 *  · `converti`  — vendu. Une vente conclue ne s'annule pas au calendrier ;
 *  · `perdu`     — issue négative, l'expiration n'apporte rien ;
 *  · `expire`    — validité dépassée sans issue : le prix n'engage plus ;
 *  · `en-cours`  — affaire ouverte, dans les délais.
 *
 * @param {object} devis
 * @param {object} [lead]        client, pour l'étape héritée (devis anciens)
 * @param {Date}   [maintenant]
 */
export function etatDevis(devis, lead = null, maintenant = new Date()) {
  if (!devis) return null;
  if (devis.statut === 'brouillon') return 'brouillon';
  const stage = devisStage(devis, lead);
  if (stage === 'gagne') return 'converti';
  if (stage === 'perdu') return 'perdu';
  const restants = joursAvantExpiration(devis, maintenant);
  return restants != null && restants < 0 ? 'expire' : 'en-cours';
}

export const ETAT_DEVIS_LABEL = {
  brouillon: 'Brouillon',
  'en-cours': 'En cours',
  converti: 'Converti en vente',
  expire: 'Expiré',
  perdu: 'Perdu',
};

/**
 * Devis à relancer : émis, sans issue, et dont la validité tombe dans les
 * `seuil` jours. C'est la liste qui vaut de l'argent — un devis qu'on laisse
 * expirer est une vente perdue sans que personne l'ait décidé.
 */
export function devisAExpirer(devisList = [], leads = [], seuil = 7, maintenant = new Date()) {
  const clientDe = new Map(leads.map((l) => [l.id, l]));
  return devisList
    .filter((d) => d.type !== 'pro')
    .filter((d) => etatDevis(d, clientDe.get(d.leadId), maintenant) === 'en-cours')
    .map((d) => ({ devis: d, lead: clientDe.get(d.leadId) || null, jours: joursAvantExpiration(d, maintenant) }))
    .filter((x) => x.jours != null && x.jours <= seuil)
    .sort((a, b) => a.jours - b.jours);
}

/** Délai par défaut, en jours, avant qu'un devis sans issue soit dit « sans suite ». */
export const SEUIL_SANS_SUITE_JOURS = 7;

/**
 * Ce devis est-il « sans suite » : émis (pas un brouillon) depuis plus de
 * `seuil` jours, toujours en cours (ni vendu, ni perdu, ni expiré), et sans
 * relance enregistrée depuis l'envoi.
 *
 * Le suivi de relance n'existe aujourd'hui que sur les factures Pro
 * (`relances`/`derniereRelance`, voir context/actions/pro.js#addRelance) —
 * rien ne l'alimente encore côté devis. La fonction lit `derniereRelance`
 * si elle existe, mais reste correcte sans : un devis jamais relancé n'a
 * simplement jamais de relance postérieure à son envoi.
 */
export function estDevisSansSuite(devis, lead = null, seuil = SEUIL_SANS_SUITE_JOURS, maintenant = new Date()) {
  if (!devis || devis.type === 'pro') return false;
  if (etatDevis(devis, lead, maintenant) !== 'en-cours') return false;
  const envoye = devis.date || devis.createdAt;
  if (!envoye || ageInDays(envoye, maintenant) <= seuil) return false;
  const { derniereRelance } = devis;
  return !derniereRelance || new Date(derniereRelance) <= new Date(envoye);
}

/** Message de relance pré-rempli (WhatsApp/SMS), en français, pour un devis sans suite. */
export function devisRelanceMessage(devis, lead = null) {
  const nom = lead?.name || devis?.clientName || 'Cher client';
  const fin = dateExpiration(devis);
  const lines = [
    `Bonjour ${nom},`,
    `Votre devis ${devis?.devisNumber || ''} d'un montant de ${formatCFA(devis?.total)} est toujours disponible.`,
  ];
  if (fin) lines.push(`Il reste valable jusqu'au ${new Date(`${fin}T00:00:00`).toLocaleDateString('fr-FR')}.`);
  lines.push('N’hésitez pas à nous recontacter pour toute question.', 'Merci de votre confiance,', COMPANY.name);
  return lines.join('\n');
}

/**
 * Devis sans suite (voir `estDevisSansSuite`), du plus négligé au moins
 * négligé — c'est la liste qui vaut la peine d'être relancée en premier.
 */
export function devisSansSuite(devisList = [], leads = [], seuil = SEUIL_SANS_SUITE_JOURS, maintenant = new Date()) {
  const clientDe = new Map(leads.map((l) => [l.id, l]));
  return devisList
    .filter((d) => estDevisSansSuite(d, clientDe.get(d.leadId), seuil, maintenant))
    .map((d) => ({
      devis: d,
      lead: clientDe.get(d.leadId) || null,
      jours: Math.round(ageInDays(d.date || d.createdAt, maintenant)),
    }))
    .sort((a, b) => b.jours - a.jours);
}

/**
 * Montant retenu pour une vente : celui FIGÉ à la conversion.
 *
 * Sans ce gel, modifier un devis après la vente changerait rétroactivement le
 * chiffre d'affaires et la commission déjà calculée du partenaire.
 */
export const montantVente = (devis) =>
  (Number(devis?.montantVente) > 0 ? Number(devis.montantVente) : Number(devis?.total) || 0);
