// Coordonnées officielles BestaSolar — utilisées sur les devis PDF.
export const COMPANY = {
  name: 'BESTA SOLAR',
  slogan: 'Énergie lumineuse sans facture',
  // ⚠ Numéro togolais à confirmer : valeur provisoire issue de l'ancien
  // numéro béninois — à remplacer par la vraie ligne (+228) avant lancement.
  phone: '+228 90 00 00 00',
  email: 'contact@bestasolar.com',
  website: 'www.bestasolar.com',
  address: 'Lomé, République Togolaise',
  addressShort: 'Lomé, Togo',
  // Mentions légales portées en pied des documents techniques.
  // ⚠ VALEURS PROVISOIRES : renseigner le RCCM togolais (format
  // TG-LOM-01-AAAA-…) et le NIF délivrés par l'OTR avant lancement.
  rccm: 'TG-LOM-01-0000-A-00000',
  ifu: '0000000000000', // NIF (clé `ifu` conservée : données existantes)
  bank: {
    // ⚠ Coordonnées bancaires togolaises à renseigner avant lancement.
    name: 'Bank of Africa Togo',
    account: 'TG00 0000 0000 0000 0000 0000 000',
    swift: 'AFRITGTG',
  },
  // Conditions générales : la clause de validité ne vaut que pour un devis.
  termsDevis:
    "Ce devis est valable 30 jours. Tout acompte versé est non remboursable. BestaSolar se réserve le droit de réviser les prix en cas de variation significative des cours. La livraison est effectuée après réception de l'acompte convenu.",
  termsFacture:
    "Tout acompte versé est non remboursable. BestaSolar se réserve le droit de réviser les prix en cas de variation significative des cours. La livraison est effectuée après réception de l'acompte convenu. Tout retard de paiement pourra donner lieu à des pénalités.",
};

// Alias historique : les documents existants lisent encore COMPANY.terms.
COMPANY.terms = COMPANY.termsDevis;

// Numéro Mobile Money encaissant les abonnements Devis Pro (paywall public
// et écran Abonnement des installateurs inscrits).
// ⚠ À remplacer par le VRAI numéro T-Money/Flooz togolais avant lancement :
// c'est lui que les clients voient pour payer.
export const PAY_NUMBER = '+228 90 00 00 00';

export const TVA_RATE = 0.18;
// Libellé du taux pour l'UI (« 18 ») — toujours dérivé, jamais recopié.
export const TVA_PCT = Math.round(TVA_RATE * 100);
