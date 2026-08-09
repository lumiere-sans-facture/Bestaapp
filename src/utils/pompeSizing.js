// Dimensionnement d'un POMPAGE SOLAIRE : du besoin en eau du client au kit
// suggéré et à son devis chiffré. Logique pure, sans React.
//
// Deux grandeurs décident de tout :
//   - le DÉBIT requis (m³/h) : volume d'eau quotidien ÷ heures de pompage
//     utiles (la pompe ne tourne qu'au fil du soleil) ;
//   - la HMT (hauteur manométrique totale, m) : profondeur de l'eau
//     + hauteur de refoulement (château/réservoir) + pertes de charge.

// Heures de pompage utiles par jour (au fil du soleil, sans batterie).
export const HEURES_POMPAGE = 5.5;

// Marge de pertes de charge (frottements dans la tuyauterie) : +10 %.
const PERTES_CHARGE = 1.1;

export const SOURCES_EAU = [
  { id: 'forage', label: 'Forage' },
  { id: 'puits', label: 'Puits' },
  { id: 'surface', label: 'Rivière / bassin' },
];

/** Débit horaire nécessaire (m³/h) pour tirer `volumeJour` m³ au fil du soleil. */
export const debitRequis = (volumeJour, heures = HEURES_POMPAGE) => {
  const v = Number(volumeJour) || 0;
  return heures > 0 ? Number((v / heures).toFixed(2)) : 0;
};

/** HMT estimée (m) : profondeur de l'eau + hauteur du réservoir + 10 % de pertes. */
export const hmtEstimee = ({ profondeur = 0, hauteurReservoir = 0 } = {}) =>
  Math.ceil(((Number(profondeur) || 0) + (Number(hauteurReservoir) || 0)) * PERTES_CHARGE);

/**
 * Kit suggéré : le MOINS CHER qui couvre à la fois la HMT et le débit requis
 * (jamais moins — une pompe sous-dimensionnée ne remplit jamais le réservoir).
 * Retourne null si aucun kit ne suffit (besoin hors gamme → étude sur mesure).
 */
export const suggestPompeKit = (kits, { volumeJour, hmt }) => {
  const requis = debitRequis(volumeJour);
  if (!(requis > 0) || !(Number(hmt) > 0)) return null;
  return [...(kits || [])]
    .sort((a, b) => a.price - b.price)
    .find((k) => k.maxHmt >= hmt && k.maxDebit >= requis) || null;
};

// Accessoires du chantier de pompage, chiffrés sur la profondeur réelle.
const PRIX_CABLE_PAR_M = 1500;   // câble immergé + accessoires électriques
const PRIX_TUYAU_PAR_M = 2000;   // tuyauterie PEHD + raccords
const MARGE_LONGUEUR_M = 10;     // mou de câble/tuyau au-dessus de la tête
const PRIX_SUPPORT_PANNEAUX = 75000;
const TAUX_INSTALLATION = 0.12;  // pose + mise en service, % du kit

/**
 * Devis complet du pompage : kit + accessoires (longueurs selon la
 * profondeur) + installation. Même forme que les devis solaires
 * ({ components, prestations, subtotalHT, tva, total }) pour que l'affichage
 * et le PDF existants fonctionnent sans rien changer.
 * Le solaire est exonéré de TVA par défaut : tva = 0.
 */
export const buildPompeQuotation = (kit, { profondeur = 0 } = {}) => {
  if (!kit) return null;
  const longueur = Math.max(0, Math.round(Number(profondeur) || 0)) + MARGE_LONGUEUR_M;
  const components = [
    { name: kit.name, quantity: 1, totalPrice: kit.price },
    { name: `Tuyauterie PEHD et raccords (${longueur} m)`, quantity: 1, totalPrice: longueur * PRIX_TUYAU_PAR_M },
    { name: `Câble immergé et accessoires électriques (${longueur} m)`, quantity: 1, totalPrice: longueur * PRIX_CABLE_PAR_M },
    { name: 'Support panneaux galvanisé', quantity: 1, totalPrice: PRIX_SUPPORT_PANNEAUX },
  ];
  const installation = Math.round((kit.price * TAUX_INSTALLATION) / 1000) * 1000;
  const prestations = [
    { name: 'Installation et mise en service', quantity: 1, totalPrice: installation },
  ];
  const subtotalHT = [...components, ...prestations].reduce((s, c) => s + c.totalPrice, 0);
  return { components, prestations, subtotalHT, tva: 0, total: subtotalHT };
};
