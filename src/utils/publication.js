// Publication des produits du catalogue boutique — logique pure, sans React.
// Un produit importé arrive en BROUILLON (`brouillon: true`) : seul le gérant
// de l'organisation qui possède le catalogue le voit, en boutique, jusqu'à ce
// qu'il le publie. Partout ailleurs (boutique des autres comptes, devis,
// dimensionnement, panier), un brouillon n'existe pas.

/** Vrai si le produit est un brouillon, pas encore publié en boutique. */
export const estBrouillon = (p) => p?.brouillon === true;

/** Produits publiés seulement — la même liste s'il n'y a aucun brouillon. */
export const produitsPublies = (products = []) =>
  products.some(estBrouillon) ? products.filter((p) => !estBrouillon(p)) : products;

/**
 * Le compte voit-il les brouillons du catalogue ? Le gérant de l'organisation
 * interne BestaSolar (ou d'une installation sans backend), comme la règle
 * d'envoi du catalogue (lib/remoteSync.js) : organisation déclarée mais type
 * inconnu → non, par prudence.
 */
export const voitLesBrouillons = (user) =>
  user?.role === 'gerant' && (!user.org_id || user.org?.kind === 'interne');

/**
 * Produits affichés en boutique. Qui voit les brouillons les voit tous, sauf
 * ceux reçus en lecture d'une autre organisation (`partage`) : un brouillon
 * n'appartient qu'au catalogue qui le prépare.
 */
export const produitsBoutique = (products = [], { brouillons = false } = {}) =>
  brouillons ? products.filter((p) => !estBrouillon(p) || !p.partage) : produitsPublies(products);
