// Squelette de chargement : à quoi ressemble la page qu'on recharge ?
//
// Au rafraîchissement, l'app affiche un squelette le temps de retrouver la
// session puis de charger l'écran. Il doit avoir la FORME de la page en
// cours — colonnes du suivi, grille de la boutique, menu « Plus »… — et non
// toujours celle du tableau de bord : sinon la page « saute » d'une forme à
// l'autre à chaque rechargement.
//
// Logique pure : l'adresse seule décide (la session n'est pas encore connue).

const sansSlashFinal = (chemin = '/') => String(chemin || '/').replace(/\/+$/, '') || '/';

/**
 * Forme du squelette pour cette adresse :
 * 'accueil' | 'connexion' | 'tableau' | 'kanban' | 'cartes' | 'fiche' |
 * 'boutique' | 'liste' | 'menu' | 'sous-page' | 'formulaire'.
 */
export const formeSquelette = (chemin) => {
  const p = sansSlashFinal(chemin);
  if (p === '/') return 'accueil';
  if (p === '/connexion' || p === '/inscription') return 'connexion';
  if (p === '/dashboard' || p === '/pro') return 'tableau';
  if (p.startsWith('/pipeline')) return 'kanban';
  if (p === '/clients' || p === '/pro/clients') return 'cartes';
  if (p.startsWith('/clients/')) return 'fiche';
  if (p.startsWith('/boutique')) return 'boutique';
  if (p.startsWith('/devis') || p.startsWith('/pro/documents')) return 'liste';
  if (p === '/plus') return 'menu';
  if (p.startsWith('/plus/')) return 'sous-page';
  if (p.startsWith('/pro/')) return 'formulaire';
  return 'tableau';
};

// Titres FIXES des pages (ceux de leur en-tête). Le tableau de bord, la
// fiche client et les sous-pages de « Plus » ont un titre qui dépend des
// données : leur squelette garde une barre grise.
const TITRES = {
  '/pipeline': 'Suivi clients',
  '/clients': 'Clients',
  '/boutique': 'Boutique',
  '/devis': 'Devis',
  '/plus': 'Plus',
  '/pro/documents': 'Devis & Factures',
  '/pro/clients': 'Clients',
  '/pro/entreprise': 'Mon entreprise',
  '/pro/abonnement': 'Mon abonnement',
};

/** Titre de l'en-tête de la page, ou null s'il dépend des données. */
export const titreSquelette = (chemin) => TITRES[sansSlashFinal(chemin)] || null;

/** Espace Pro (onglets Pro) d'après l'adresse. */
export const estAdressePro = (chemin) => {
  const p = sansSlashFinal(chemin);
  return p === '/pro' || p.startsWith('/pro/');
};

/** L'onglet de cette adresse est-il actif ? (même règle que la navigation) */
export const ongletActif = (cheminOnglet, chemin) => {
  const p = sansSlashFinal(chemin);
  if (cheminOnglet === '/pro') return p === '/pro';
  return p === cheminOnglet || p.startsWith(`${cheminOnglet}/`);
};
