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

// Profil partenaire d'un utilisateur de l'app (chaque membre de l'équipe en a
// un, créé à sa première visite de l'espace partenaire ou à son premier devis).
const partnerOfUser = (userId, partners = []) =>
  (userId ? partners.find((p) => p.userId === userId)?.id : null) || null;

// Apporteurs N1/N2 d'une piste : ses parrains, sinon le partenaire porté
// par son dernier devis (et le parrain de ce partenaire en niveau 2), sinon
// le commercial qui suit l'affaire — TOUTE affaire gagnée a un apporteur,
// donc une commission.
export function resolveLeadPartners(lead, devisList = [], partners = []) {
  if (!lead) return { l1: null, l2: null };
  let l1 = lead.parrainL1 || null;
  let l2 = lead.parrainL2 || null;
  if (!l1) {
    const avecPartenaire = devisList
      .filter((d) => d.leadId === lead.id && d.partnerId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (avecPartenaire.length) l1 = avecPartenaire[0].partnerId;
  }
  if (!l1) {
    // Dernier recours : le créateur du dernier devis, sinon l'assigné de la piste.
    const dernierDevis = devisList
      .filter((d) => d.leadId === lead.id && d.createdBy)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    l1 = partnerOfUser(dernierDevis?.createdBy, partners) || partnerOfUser(lead.assignedTo, partners);
  }
  if (l1 && !l2) l2 = partners.find((p) => p.id === l1)?.sponsorId || null;
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
  // Apporteur : parrain de la piste > partenaire du devis > créateur du devis
  // > commercial assigné. Une affaire gagnée génère TOUJOURS sa commission.
  let l1 = lead?.parrainL1 || devis.partnerId
    || partnerOfUser(devis.createdBy, partners)
    || partnerOfUser(lead?.assignedTo, partners);
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

/**
 * Réconcilie les commissions « niveau client » (sans devisId) quand un devis
 * de ce client est gagné : la rémunération bascule alors devis par devis.
 * - commission encore EN ATTENTE : retirée (le devis va générer la sienne) ;
 * - commission DÉJÀ PAYÉE : jamais supprimée — elle est rattachée au devis
 *   (devisId posé), ce qui la rend visible comme la rémunération de CE devis
 *   et empêche d'en créer une seconde. Le montant payé n'est pas retouché :
 *   un versement effectué ne se réécrit pas.
 * Retourne la nouvelle liste de commissions.
 */
export function rattacherCommissionsClient(commissions = [], devis) {
  if (!devis?.leadId) return commissions;
  const concernee = (c) => !c.devisId && c.leadId === devis.leadId;
  if (!commissions.some(concernee)) return commissions;
  return commissions.flatMap((c) => {
    if (!concernee(c)) return [c];
    if (c.status === 'payée') return [{ ...c, devisId: devis.id }];
    return []; // en attente : remplacée par la commission du devis
  });
}

// Rattrapage global : recense toutes les affaires déjà validées (pistes
// gagnées + conversions « devis » validées) et retourne les commissions
// qui auraient dû exister mais manquent. Idempotent : relancé deux fois,
// le second passage ne retourne rien.
export function reconcileMissingCommissions({ leads = [], devis = [], partners = [], commissions = [], referrals = [] }, rates, today) {
  const out = [];
  let pool = commissions;
  const ajouter = (created) => {
    if (created.length) {
      out.push(...created);
      pool = [...created, ...pool];
    }
  };

  // 1) Suivi PAR AFFAIRE : chaque devis public gagné rémunère son apporteur
  // (deux devis gagnés d'un même client = deux commissions).
  const devisGagnes = devis.filter((d) => d.stage === 'gagne' && d.type !== 'pro');
  const pistesCouvertes = new Set(devisGagnes.map((d) => d.leadId));
  // Répare aussi les doublons DÉJÀ enregistrés : une commission « niveau
  // client » sur une piste dont un devis est gagné est caduque (retirée si en
  // attente, rattachée au devis si déjà payée).
  for (const d of devisGagnes) pool = rattacherCommissionsClient(pool, d);
  for (const d of devisGagnes) {
    ajouter(missingCommissionsForDevis(
      { devis: d, lead: leads.find((l) => l.id === d.leadId), partners, commissions: pool },
      rates, today
    ));
  }

  // 2) Affaires suivies au niveau du CLIENT (pistes gagnées sans devis gagné,
  // conversions « devis » validées au registre) : commission par piste.
  const eligibles = new Set(leads.filter((l) => l.stage === 'gagne').map((l) => l.id));
  (referrals || [])
    .filter((r) => r.type === 'devis' && r.status === 'validé' && r.leadId)
    .forEach((r) => eligibles.add(r.leadId));
  for (const leadId of eligibles) {
    if (pistesCouvertes.has(leadId)) continue; // déjà rémunérée par affaire
    const lead = leads.find((l) => l.id === leadId);
    ajouter(missingCommissionsForLead({ lead, devis, partners, commissions: pool }, rates, today));
  }
  return out;
}
