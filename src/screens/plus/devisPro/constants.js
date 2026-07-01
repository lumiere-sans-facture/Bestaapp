// Constantes partagées du module Devis Pro (identité entreprise, modèles PDF).

export const MODELES = [
  { id: 'classique', label: 'Classique', desc: 'Logo à gauche, tableau sobre' },
  { id: 'moderne', label: 'Moderne', desc: 'Bandeau couleur en en-tête' },
  { id: 'compact', label: 'Compact', desc: 'Dense, optimisé une page' },
];

export const EMPTY_COMPANY = {
  nomEntreprise: '', logo: '', telephone: '', email: '', adresse: '',
  ifu: '', rccm: '', couleurPrimaire: '#0a2472', couleurSecondaire: '#f5a623',
  slogan: '', modeleDefaut: 'classique', facturePrefix: 'FAC', assujettieVAT: false,
};

export const EMPTY_LIGNE = { designation: '', qty: 1, pu: '' };
