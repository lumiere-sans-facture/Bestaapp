// Synchronisation des commissions de parrainage — logique métier pure.
// Une commission naît quand l'affaire d'un apporteur est validée par le
// gérant : piste passée à « gagné » OU conversion « devis » validée au
// registre d'affiliation. Ces helpers génèrent les commissions MANQUANTES
// de façon idempotente : jamais de doublon (clé piste + partenaire + niveau).

// Base de calcul : le total du dernier devis finalisé de la piste (montant
// réel validé), sinon la valeur estimée de la piste.
export function commissionBasis(lead, devisList = []) {
  if (!lead) return 0;
  const finalises = devisList
    .filter((d) => d.leadId === lead.id && d.statut !== 'brouillon' && Number(d.total) > 0)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (finalises.length) return Number(finalises[0].total);
  return Number(lead.estimatedValue) || 0;
}

// Apporteurs N1/N2 d'une piste : ses parrains, sinon le partenaire porté
// par son dernier devis (et le parrain de ce partenaire en niveau 2).
export function resolveLeadPartners(lead, devisList = [], partners = []) {
  if (!lead) return { l1: null, l2: null };
  let l1 = lead.parrainL1 || null;
  let l2 = lead.parrainL2 || null;
  if (!l1) {
    const avecPartenaire = devisList
      .filter((d) => d.leadId === lead.id && d.partnerId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (avecPartenaire.length) {
      l1 = avecPartenaire[0].partnerId;
      l2 = l2 || partners.find((p) => p.id === l1)?.sponsorId || null;
    }
  }
  if (l2 && l2 === l1) l2 = null; // un même partenaire ne cumule pas deux niveaux
  return { l1, l2 };
}

// Commissions manquantes pour UNE piste validée (idempotent : les
// commissions déjà enregistrées pour (piste, partenaire, niveau) sont
// conservées telles quelles, quel que soit leur montant ou statut).
export function missingCommissionsForLead({ lead, devis = [], partners = [], commissions = [] }, rates, today) {
  if (!lead) return [];
  const basis = commissionBasis(lead, devis);
  if (!basis) return [];
  const { l1, l2 } = resolveLeadPartners(lead, devis, partners);
  const exists = (partnerId, level) =>
    commissions.some((c) => c.leadId === lead.id && c.partnerId === partnerId && c.level === level);
  const nouvelle = (partnerId, level) => ({
    id: crypto.randomUUID(),
    partnerId,
    leadId: lead.id,
    level,
    amount: Math.round(basis * rates[level]),
    status: 'en_attente',
    paidAt: null,
    createdAt: today,
  });
  const out = [];
  if (l1 && !exists(l1, 1)) out.push(nouvelle(l1, 1));
  if (l2 && !exists(l2, 2)) out.push(nouvelle(l2, 2));
  return out;
}

// Commissions manquantes pour UN devis gagné (suivi par affaire : chaque
// devis gagné rémunère son apporteur — deux devis gagnés d'un même client =
// deux commissions). Idempotent par (devis, partenaire, niveau).
export function missingCommissionsForDevis({ devis, lead, partners = [], commissions = [] }, rates, today) {
  if (!devis) return [];
  const basis = Number(devis.total) || 0;
  if (!basis) return [];
  let l1 = lead?.parrainL1 || devis.partnerId || null;
  let l2 = lead?.parrainL2 || (l1 ? partners.find((p) => p.id === l1)?.sponsorId || null : null);
  if (l2 && l2 === l1) l2 = null; // un même partenaire ne cumule pas deux niveaux
  const exists = (partnerId, level) =>
    commissions.some((c) => c.devisId === devis.id && c.partnerId === partnerId && c.level === level);
  const nouvelle = (partnerId, level) => ({
    id: crypto.randomUUID(),
    partnerId,
    leadId: devis.leadId || lead?.id || null,
    devisId: devis.id,
    level,
    amount: Math.round(basis * rates[level]),
    status: 'en_attente',
    paidAt: null,
    createdAt: today,
  });
  const out = [];
  if (l1 && !exists(l1, 1)) out.push(nouvelle(l1, 1));
  if (l2 && !exists(l2, 2)) out.push(nouvelle(l2, 2));
  return out;
}

// Rattrapage global : recense toutes les affaires déjà validées (pistes
// gagnées + conversions « devis » validées) et retourne les commissions
// qui auraient dû exister mais manquent. Idempotent : relancé deux fois,
// le second passage ne retourne rien.
export function reconcileMissingCommissions({ leads = [], devis = [], partners = [], commissions = [], referrals = [] }, rates, today) {
  const eligibles = new Set(leads.filter((l) => l.stage === 'gagne').map((l) => l.id));
  (referrals || [])
    .filter((r) => r.type === 'devis' && r.status === 'validé' && r.leadId)
    .forEach((r) => eligibles.add(r.leadId));
  const out = [];
  let pool = commissions;
  for (const leadId of eligibles) {
    const lead = leads.find((l) => l.id === leadId);
    const created = missingCommissionsForLead({ lead, devis, partners, commissions: pool }, rates, today);
    if (created.length) {
      out.push(...created);
      pool = [...created, ...pool];
    }
  }
  return out;
}
