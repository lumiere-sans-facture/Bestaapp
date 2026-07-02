// Constantes partagées du module Devis Pro (identité entreprise, modèles PDF).

export const MODELES = [
  { id: 'couleur', label: 'Couleur', desc: 'Bandeau aux couleurs de votre entreprise' },
  { id: 'sobre', label: 'Noir & blanc', desc: 'Sobre et universel, imprimable partout' },
];

// Normalise un modèle (rétrocompat des anciens : classique/moderne/compact).
export const normalizeModele = (m) => (m === 'sobre' ? 'sobre' : 'couleur');

export const EMPTY_COMPANY = {
  nomEntreprise: '', logo: '', telephone: '', email: '', adresse: '',
  ifu: '', rccm: '', couleurPrimaire: '#0a2472', couleurSecondaire: '#f5a623',
  slogan: '', modeleDefaut: 'couleur', facturePrefix: 'FAC', assujettieVAT: false,
  momo: '', momoNom: '', conditions: '',
};

export const EMPTY_LIGNE = { designation: '', qty: 1, pu: '' };
