// Réglages de la page publique d'accueil.
import { COMPANY } from '../../config/company';

// Tous les appels à l'action de la page mènent au formulaire d'inscription.
export const LIEN_INSCRIPTION = '/inscription';

// Badge « Gratuit, sans limite de durée » du bandeau d'accueil : passer à
// false le jour où l'offre de lancement s'arrête.
export const OFFRE_LANCEMENT = true;

// Réseaux sociaux du pied de page. Une entrée vide masque son icône : mieux
// vaut pas de lien qu'un lien qui ne mène nulle part.
export const RESEAUX = {
  whatsapp: `https://wa.me/${COMPANY.phone.replace(/\D/g, '')}`,
  facebook: '',
  youtube: '',
};
