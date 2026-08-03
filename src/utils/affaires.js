// Suivi commercial PAR AFFAIRE — logique métier pure.
// Une affaire = un devis : un client peut avoir plusieurs devis suivis
// indépendamment dans le pipeline. Tant qu'un client n'a aucun devis, sa
// piste reste elle-même une affaire (prospection : nouveau → qualifié → …).

export const STAGE_ORDER = ['nouveau', 'qualifie', 'visite', 'proposition', 'negociation', 'gagne'];

/** Étape d'un devis : la sienne, sinon celle de sa piste (migration des devis
 *  créés avant le suivi par affaire), sinon « proposition » (un devis émis
 *  est, par nature, une proposition faite au client). */
export const devisStage = (d, lead) => d.stage || lead?.stage || 'proposition';

/**
 * Construit la liste des affaires du pipeline :
 * - une carte par devis public (hors espace Pro) rattaché à une piste ;
 * - une carte « piste » pour chaque client SANS devis (prospection en cours).
 * Chaque affaire : { key, kind: 'piste'|'devis', lead, devis, stage, value, pendingStage }.
 */
export function buildAffaires(leads = [], devisList = []) {
  const parPiste = new Map();
  for (const d of devisList) {
    if (d.type === 'pro') continue;
    if (!parPiste.has(d.leadId)) parPiste.set(d.leadId, []);
    parPiste.get(d.leadId).push(d);
  }
  const affaires = [];
  for (const lead of leads) {
    const ds = parPiste.get(lead.id) || [];
    if (!ds.length) {
      affaires.push({
        key: `piste-${lead.id}`, kind: 'piste', lead, devis: null,
        stage: lead.stage, value: Number(lead.estimatedValue) || 0,
        pendingStage: lead.pendingStage || null,
      });
    } else {
      for (const d of ds) {
        affaires.push({
          key: `devis-${d.id}`, kind: 'devis', lead, devis: d,
          stage: devisStage(d, lead), value: Number(d.total) || 0,
          pendingStage: d.pendingStage || null,
        });
      }
    }
  }
  return affaires;
}

/**
 * Étape agrégée d'une piste à partir des étapes de ses devis : la plus
 * avancée des affaires non perdues ; « perdu » seulement si TOUTES le sont.
 * (Les tableaux de bord et l'espace partenaire raisonnent par client — cette
 * agrégation garde lead.stage cohérent avec le suivi par affaire.)
 */
export function aggregateLeadStage(stagesDevis = []) {
  if (!stagesDevis.length) return null;
  const ouvertes = stagesDevis.filter((st) => st !== 'perdu');
  if (!ouvertes.length) return 'perdu';
  return ouvertes.reduce((best, st) =>
    (STAGE_ORDER.indexOf(st) > STAGE_ORDER.indexOf(best) ? st : best));
}
