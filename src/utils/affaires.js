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
 * Construit la liste des cartes du pipeline : UNE CARTE PAR CLIENT.
 * Le kanban suit le client (son étape, sa valeur cumulée) ; le suivi devis
 * par devis vit dans la fiche du client, où chaque devis porte sa propre
 * étape et déclenche sa propre commission.
 * Chaque carte : { key, lead, stage, value, pendingStage, devis: [...] }.
 */
export function buildAffaires(leads = [], devisList = []) {
  const parPiste = new Map();
  for (const d of devisList) {
    if (d.type === 'pro') continue;
    if (!parPiste.has(d.leadId)) parPiste.set(d.leadId, []);
    parPiste.get(d.leadId).push(d);
  }
  return leads.map((lead) => {
    const ds = parPiste.get(lead.id) || [];
    // Valeur du client : la somme de ses affaires non perdues (un client avec
    // deux devis en cours pèse le total des deux), sinon sa valeur estimée.
    const enCours = ds.filter((d) => devisStage(d, lead) !== 'perdu');
    const value = enCours.length
      ? enCours.reduce((sum, d) => sum + (Number(d.total) || 0), 0)
      : Number(lead.estimatedValue) || 0;
    return {
      key: `lead-${lead.id}`,
      lead,
      devis: ds,
      stage: lead.stage,
      value,
      pendingStage: lead.pendingStage || null,
    };
  });
}
