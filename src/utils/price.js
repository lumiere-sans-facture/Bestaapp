// Prix affichés en boutique — logique métier pure, sans React.
// Le catalogue stocke le prix technicien (basePrice) ; le prix public
// applique une marge unique, définie ici et nulle part ailleurs.
export const PUBLIC_MARKUP = 1.15;

/** Prix public affiché : prix technicien majoré de la marge standard. */
export const prixPublic = (basePrice) => Math.round((Number(basePrice) || 0) * PUBLIC_MARKUP);
