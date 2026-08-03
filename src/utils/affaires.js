// Suivi commercial — logique métier pure.
// Le kanban suit le CLIENT (une carte, une étape, comme le pipeline
// historique). Chaque devis du client porte en plus sa propre issue
// (gagné / perdu), suivie dans la fiche : deux devis d'un même client se
// concluent séparément et donnent chacun leur commission.

/** Étape d'un devis : la sienne, sinon celle de son client (devis créés avant
 *  le suivi par devis), sinon « proposition » (un devis émis est, par nature,
 *  une proposition faite au client). */
export const devisStage = (d, lead) => d.stage || lead?.stage || 'proposition';

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

/** Tous les devis publics d'un client (pour la fiche : « ses autres affaires »). */
export const devisDuClient = (leadId, devisList = []) =>
  devisList.filter((d) => d.leadId === leadId && d.type !== 'pro');
