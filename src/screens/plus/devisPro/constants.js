// Constantes partagées du module Devis Pro (identité entreprise, modèles PDF).

// Modèles de documents : la liste fait autorité dans utils/docTemplates, on la
// ré-exporte ici pour les écrans Pro (les anciens identifiants couleur/sobre
// sont ramenés sur « studio » par normaliserModel).
export { MODELS as MODELES, normaliserModel as normalizeModele } from '../../../utils/docTemplates';

export const EMPTY_COMPANY = {
  nomEntreprise: '', logo: '', telephone: '', email: '', adresse: '',
  ifu: '', rccm: '', couleurPrimaire: '#0a2472', couleurSecondaire: '#f5a623',
  slogan: '', modeleDefaut: 'studio', facturePrefix: 'FAC', assujettieVAT: false,
  momo: '', momoNom: '', conditions: '',
};

export const EMPTY_LIGNE = { designation: '', qty: 1, pu: '' };
