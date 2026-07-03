import { DAY_MS } from './date';

// Suivi des encaissements & relances — logique métier pure, sans React.
// Le statut stocké d'une facture reste { brouillon | emise | payee } ; les états
// « partiel » et « en retard » sont DÉRIVÉS ici (montant encaissé + échéance),
// jamais stockés — invariant sync non-destructive préservé.

// Modes d'encaissement acceptés (Mobile Money majoritaire au Bénin).
export const PAIEMENT_MODES = [
  ['momo', 'Mobile Money'],
  ['especes', 'Espèces'],
  ['virement', 'Virement bancaire'],
  ['cheque', 'Chèque'],
];
export const PAIEMENT_MODE_LABEL = Object.fromEntries(PAIEMENT_MODES);

// Délai de paiement par défaut (jours) — aligné sur la validité des devis.
export const DELAI_ECHEANCE_JOURS = 30;

/** Échéance par défaut : +N jours après la date de référence (émission). */
export const defaultEcheance = (dateISO, jours = DELAI_ECHEANCE_JOURS) => {
  const base = dateISO ? new Date(dateISO) : new Date();
  return new Date(base.getTime() + jours * DAY_MS).toISOString();
};

/** Somme encaissée : priorité au détail des paiements, sinon champ montantPaye. */
export const montantPaye = (f) => {
  if (Array.isArray(f?.paiements) && f.paiements.length)
    return f.paiements.reduce((s, p) => s + (Number(p.montant) || 0), 0);
  return Number(f?.montantPaye) || 0;
};

/** Reste dû sur une facture (jamais négatif). */
export const resteAPayer = (f) => Math.max(0, (Number(f?.totalTTC) || 0) - montantPaye(f));

/**
 * Encaissements datés d'une facture : [{ date, montant }].
 * Détail des paiements si présent ; sinon repli sur les factures soldées sans
 * détail (marquées payées ou montantPaye direct), datées à la création.
 */
export const paiementEntries = (f) => {
  if (Array.isArray(f?.paiements) && f.paiements.length)
    return f.paiements.map((p) => ({ date: p.date, montant: Number(p.montant) || 0 }));
  const paye = f?.statut === 'payee' ? (Number(f.totalTTC) || 0) : (Number(f?.montantPaye) || 0);
  return paye > 0 ? [{ date: f.createdAt, montant: paye }] : [];
};

/** Une facture est en retard si elle n'est pas soldée et l'échéance est dépassée. */
export const isEnRetard = (f, now = Date.now()) => {
  if (!f || f.statut === 'brouillon' || f.statut === 'payee') return false;
  if (resteAPayer(f) <= 0) return false;
  const ech = f.echeance ? new Date(f.echeance).getTime() : null;
  return ech != null && ech < now;
};

/** Nombre de jours de retard (0 si la facture n'est pas en retard). */
export const joursRetard = (f, now = Date.now()) =>
  isEnRetard(f, now) ? Math.floor((now - new Date(f.echeance).getTime()) / DAY_MS) : 0;

/** Jours restants avant échéance (négatif si dépassé, null si pas d'échéance). */
export const joursAvantEcheance = (f, now = Date.now()) =>
  f?.echeance ? Math.ceil((new Date(f.echeance).getTime() - now) / DAY_MS) : null;

/**
 * Statut d'affichage effectif — dérive « partiel » et « retard » sans les stocker.
 * @returns 'brouillon' | 'emise' | 'partiel' | 'payee' | 'retard'
 */
export const statutEffectif = (f, now = Date.now()) => {
  if (!f) return 'emise';
  if (f.statut === 'brouillon') return 'brouillon';
  if (f.statut === 'payee' || resteAPayer(f) <= 0) return 'payee';
  if (isEnRetard(f, now)) return 'retard';
  if (montantPaye(f) > 0) return 'partiel';
  return 'emise';
};

export const STATUT_EFFECTIF_LABEL = {
  brouillon: 'Brouillon', emise: 'Émise', partiel: 'Partiel', payee: 'Payée', retard: 'En retard',
};
// Classe de couleur pour .flat-badge et .badge (suffixe partagé).
export const STATUT_EFFECTIF_BADGE = {
  payee: 'success', partiel: 'info', emise: 'warning', retard: 'danger', brouillon: 'muted',
};

const nf = (v) => Math.round(Number(v) || 0).toLocaleString('fr-FR');

/** Message de relance pré-rempli (WhatsApp / SMS), en français. */
export const relanceMessage = (f, company) => {
  const nom = f?.clientName || 'Cher client';
  const ent = company?.nomEntreprise || 'BestaSolar';
  const reste = resteAPayer(f);
  const lines = [
    `Bonjour ${nom},`,
    `Nous vous rappelons que la facture ${f?.numero || ''} d'un montant de ${nf(reste)} F CFA reste à régler.`,
  ];
  if (f?.echeance) lines.push(`Échéance : ${new Date(f.echeance).toLocaleDateString('fr-FR')}.`);
  if (company?.momo)
    lines.push(`Règlement Mobile Money : ${company.momo}${company.momoNom ? ` (${company.momoNom})` : ''}.`);
  lines.push('Merci de votre confiance.', ent);
  return lines.join('\n');
};

/** Lien WhatsApp pré-rempli (numéro normalisé en chiffres, indicatif compris). */
export const whatsappLink = (phone, text) => {
  const num = String(phone || '').replace(/\D/g, '');
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
};
