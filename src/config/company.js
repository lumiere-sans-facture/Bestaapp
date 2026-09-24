// Coordonnées officielles BestaSolar — utilisées sur les devis PDF.
export const COMPANY = {
  name: 'BESTA SOLAR TOGO',
  slogan: 'Énergie lumineuse sans facture',
  // Coordonnées OFFICIELLES de l'entreprise émettrice — celles qui figurent
  // sur les devis, factures et fiches techniques BestaSolar : BESTA SOLAR
  // TOGO, entreprise individuelle (voir aussi config/legal.js, l'éditeur de
  // l'application).
  //
  // `phone` : UN numéro, celui des liens WhatsApp (wa.me) et du signalement
  // d'incident — un lien ne peut viser qu'un seul numéro.
  // `telephones` : les numéros IMPRIMÉS sur les documents (Togo et Bénin).
  phone: '+229 016 173 2956',
  telephones: ['+228 799 802 090', '+229 01 61 73 29 56'],
  email: 'contact@bestasolar.com',
  website: 'www.bestasolar.com',
  address: 'Adidoadin, Lomé — Togo',
  addressShort: 'Adidoadin, Lomé',
  // Mentions légales portées en pied des documents techniques
  rccm: 'TG-LFW-01-2025-A10-01086',
  // Numéro d'identification fiscale togolais (NIF). La clé reste `ifu` :
  // c'est elle que lisent les documents et les données déjà enregistrées.
  ifu: '1002023475',
  bank: {
    name: 'Bank of Africa Bénin',
    account: 'BJ66 BJ01 1000 0000 0123 4567 890',
    swift: 'AFRIBJBJ',
  },
  // Conditions générales : la clause de validité ne vaut que pour un devis.
  termsDevis:
    "Ce devis est valable 30 jours. Tout acompte versé est non remboursable. BestaSolar se réserve le droit de réviser les prix en cas de variation significative des cours. La livraison est effectuée après réception de l'acompte convenu.",
  termsFacture:
    "Tout acompte versé est non remboursable. BestaSolar se réserve le droit de réviser les prix en cas de variation significative des cours. La livraison est effectuée après réception de l'acompte convenu. Tout retard de paiement pourra donner lieu à des pénalités.",
};

// Alias historique : les documents existants lisent encore COMPANY.terms.
COMPANY.terms = COMPANY.termsDevis;

/**
 * Numéros tels qu'imprimés sur un document : « +228 … / +229 … ». Espaces
 * INSÉCABLES à l'intérieur de chaque numéro : une ligne trop courte ne peut
 * couper qu'entre les deux, jamais au milieu d'un numéro.
 */
export const telephonesImprimes = (liste = []) => liste.map((t) => String(t).replace(/ /g, '\u00A0')).join(' / ');
export const TELEPHONES_DOCUMENTS = telephonesImprimes(COMPANY.telephones);

// Numéro Mobile Money encaissant les abonnements Devis Pro (paywall public
// et écran Abonnement des installateurs inscrits).
export const PAY_NUMBER = '+229 016 173 2956';

export const TVA_RATE = 0.18;
// Libellé du taux pour l'UI (« 18 ») — toujours dérivé, jamais recopié.
export const TVA_PCT = Math.round(TVA_RATE * 100);
