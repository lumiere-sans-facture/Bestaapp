// Suivi commercial — logique métier pure.
// Le kanban suit les AFFAIRES : une carte par devis (un client avec deux devis
// a deux cartes, avancées séparément et rémunérées chacune), et une carte de
// prospection tant qu'un client n'a aucun devis. Les écrans qui raisonnent par
// client utilisent `etapeDuClient` pour la synthèse.
// La numérotation des documents est déduite de l'existant : un compteur local
// n'est pas répliqué et produirait des numéros en double entre appareils.

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
