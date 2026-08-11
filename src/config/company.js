// Coordonnées officielles BestaSolar — utilisées sur les devis PDF.
export const COMPANY = {
  name: 'BESTA SOLAR',
  slogan: 'Énergie lumineuse sans facture',
  // Coordonnées OFFICIELLES BestaSolar (immatriculation béninoise) — celles
  // qui figurent sur les devis, factures et fiches techniques. L'application
  // s'adresse au marché togolais, mais l'entreprise émettrice reste celle-ci.
  phone: '+229 016 173 2956',
  email: 'contact@bestasolar.com',
  website: 'www.bestasolar.com',
  address: 'Cotonou Saint Rita, République du Bénin',
  addressShort: 'Cotonou Saint Rita, Bénin',
  // Mentions légales portées en pied des documents techniques
  rccm: 'RB/PKO/23 A 19308',
  ifu: '0202274882317', // IFU béninois (clé `ifu` : données existantes)
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

// Numéro Mobile Money encaissant les abonnements Devis Pro (paywall public
// et écran Abonnement des installateurs inscrits).
export const PAY_NUMBER = '+229 016 173 2956';

export const TVA_RATE = 0.18;
// Libellé du taux pour l'UI (« 18 ») — toujours dérivé, jamais recopié.
export const TVA_PCT = Math.round(TVA_RATE * 100);
