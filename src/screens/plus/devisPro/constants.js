// Constantes partagées du module Devis Pro (identité entreprise, modèles PDF).

// Modèles de documents : la liste fait autorité dans utils/docTemplates, on la
// ré-exporte ici pour les écrans Pro (les anciens identifiants couleur/sobre
// sont ramenés sur « studio » par normaliserModel).
export { MODELS as MODELES, normaliserModel as normalizeModele } from '../../../utils/docTemplates';

export const EMPTY_COMPANY = {
  nomEntreprise: '', logo: '', telephone: '', email: '', adresse: '',
  ifu: '', rccm: '', couleurPrimaire: '#0a2472', couleurSecondaire: '#f5a623',
  slogan: '', modeleDefaut: 'studio', facturePrefix: 'FAC', assujettieVAT: false,
  momo: '', momoNom: '', momoOperateur: '', conditions: '',
  // Facture : CNSS, mention fiscale sous les totaux, virement, modes de
  // paiement affichés (null = déduits des coordonnées), signataire et cachet.
  cnss: '', mentionFiscale: '', banque: '', compteBancaire: '', modesPaiement: null,
  signataireNom: '', signataireTitre: '', cachet: '',
  // Pays de l'entreprise (data/pays.js). Vide = déduit du téléphone, sinon Togo.
  pays: '',
};

export const EMPTY_LIGNE = { designation: '', qty: 1, pu: '' };
