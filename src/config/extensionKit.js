// Règles d'EXTENSION d'un kit solaire — paramètres, sans logique.
//
// Un kit est la référence. Quand une proposition exige plus de panneaux que
// le kit n'en compte, le devis reçoit des AJUSTEMENTS explicites (chaînes,
// onduleur, câbles, protections, main-d'œuvre) calculés par
// utils/ajustementsKit.js à partir des règles ci-dessous. Le kit d'origine
// n'est jamais modifié.
//
// Tout ce qui est chiffré ici est un PARAMÈTRE : à ajuster quand un
// fournisseur, un tarif ou une hypothèse change.

// ---- Main-d'œuvre (règle du gérant) ----
// main_oeuvre_finale = main_oeuvre_kit_base
//                    + panneaux_supplementaires × parPanneau
//                    + kWh_batterie_supplementaires × parKwhBatterie
// Le supplément de 3 500 F se compte par kWh de BATTERIE ajouté (modules d'un
// kit extensible), pas par kWc de panneaux. Le coefficient pays (Togo × 2,
// sauf kits haute tension) s'applique ensuite à toute la main-d'œuvre,
// suppléments compris (utils/mainOeuvre.js).
export const MAIN_OEUVRE_EXTENSION = {
  parPanneau: 10000,     // F CFA par panneau ajouté
  parKwhBatterie: 3500,  // F CFA par kWh de batterie ajouté (précision décimale gardée)
};

// ---- Conditions du site (calcul des tensions de chaîne) ----
// La tension d'un panneau MONTE quand il fait froid et BAISSE quand il
// chauffe. Hypothèses prudentes pour le Togo et le Bénin : jamais moins de
// 10 °C au lever du soleil (plancher volontairement bas), et des cellules
// jusqu'à 70 °C en plein midi.
export const CONDITIONS_SITE = {
  temperatureMin: 10,          // °C — calcul de la tension à vide maximale
  temperatureCelluleMax: 70,   // °C — calcul de la tension MPP minimale
};

// ---- Panneaux de référence (caractéristiques électriques, conditions STC) ----
// Valeurs TYPES de fiches constructeur pour les puissances posées dans les
// kits (Jinko Tiger Neo N-type pour 590 et 620 Wc, monocristallin 132
// demi-cellules pour 500 Wc). À vérifier sur la fiche exacte du modèle livré
// avant de s'y fier ; un panneau absent de cette liste rend les chaînes
// « non vérifiées » plutôt que calculées sur une supposition.
//   voc / vmp : tensions à vide et au point de puissance max (V)
//   isc / imp : courants de court-circuit et au point de puissance max (A)
//   coefVoc / coefVmp : coefficients de température (%/°C, négatifs)
export const PANNEAUX_REFERENCE = {
  500: { voc: 45.6, vmp: 38.0, isc: 13.9, imp: 13.16, coefVoc: -0.28, coefVmp: -0.35 },
  590: { voc: 52.9, vmp: 43.6, isc: 14.2, imp: 13.53, coefVoc: -0.25, coefVmp: -0.29 },
  620: { voc: 55.7, vmp: 46.0, isc: 14.2, imp: 13.5, coefVoc: -0.25, coefVmp: -0.29 },
};

// ---- Câble DC : section selon le courant de la chaîne ----
// Courant de calcul = Isc × 1,25 (marge normative). Courant admissible
// prudent pour un câble solaire posé sous gaine, au soleil.
export const SECTIONS_CABLE_PV = [
  { section: 4, courantMax: 32, prixDefaut: 500 },
  { section: 6, courantMax: 41, prixDefaut: 700 },
  { section: 10, courantMax: 57, prixDefaut: 1500 },
];
export const COEF_COURANT_CABLE = 1.25;

// ---- Matériel ajouté par CHAÎNE supplémentaire ----
// `re` reconnaît la ligne équivalente du kit : son prix fait alors foi (même
// fournisseur, même tarif). À défaut, un produit de la boutique dont le nom
// correspond, au prix public ; sinon `prixDefaut`.
export const MATERIEL_PAR_CHAINE = [
  {
    cle: 'cable-pv',
    re: /c[âa]ble\s+(pv|solaire)/i,
    // Aller et retour de la chaîne jusqu'au coffret.
    quantite: 30, unit: 'm',
    // La désignation et le prix suivent la section (voir SECTIONS_CABLE_PV).
  },
  {
    cle: 'mc4',
    re: /mc4/i,
    designation: 'Connecteurs MC4 (paire)',
    // Une paire en tête de chaîne, une au coffret.
    quantite: 2, unit: 'pcs', prixDefaut: 1000,
  },
  {
    cle: 'fusible',
    re: /fusible/i,
    designation: 'Fusible DC et porte-fusible',
    // Un sur le + et un sur le − de la chaîne.
    quantite: 2, unit: 'pcs', prixDefaut: 4000,
  },
  {
    cle: 'gaine',
    re: /gaine|moulure/i,
    designation: 'Gaine et accessoires de pose DC',
    quantite: 1, unit: 'pcs', prixDefaut: 5500,
  },
];

// ---- Matériel ajouté par ENTRÉE MPPT supplémentaire utilisée ----
export const MATERIEL_PAR_MPPT = [
  {
    cle: 'sectionneur-dc',
    // Pas les disjoncteurs « compacts » de batterie, qui sont aussi en DC.
    re: /sectionneur|disjoncteur\s+dc\b/i,
    designation: 'Disjoncteur/sectionneur DC',
    quantite: 1, unit: 'pcs', prixDefaut: 8000,
  },
  {
    cle: 'parafoudre-dc',
    re: /parafoudre\s+dc/i,
    designation: 'Parafoudre DC',
    quantite: 1, unit: 'pcs', prixDefaut: 9000,
  },
];

// ---- Coffret de jonction (combiner box) ----
// Le coffret DC du kit accepte un nombre d'entrées de chaînes : lu dans sa
// désignation (« 4 entrée et 4 sortie »), sinon `entreesParDefaut`. Au-delà,
// un coffret de jonction s'ajoute, une seule fois.
export const COFFRET_JONCTION = {
  re: /coffret[^,]*\bdc\b/i,
  entreesParDefaut: 2,
  designation: 'Coffret de jonction DC (combiner box)',
  prixDefaut: 45000,
};

// ---- Protections AC de l'onduleur retenu ----
// Une protection par onduleur ajouté ou remplacé, calibrée sur son courant de
// sortie × 1,25, au calibre normalisé supérieur.
export const PROTECTION_AC = {
  coefCourant: 1.25,
  tensionMono: 230,
  tensionTri: 400,
  calibres: [
    { a: 16, prix: 12000 }, { a: 20, prix: 12000 }, { a: 25, prix: 12000 },
    { a: 32, prix: 14000 }, { a: 40, prix: 16000 }, { a: 50, prix: 18000 },
    { a: 63, prix: 22000 }, { a: 80, prix: 35000 }, { a: 100, prix: 45000 },
    { a: 125, prix: 55000 },
  ],
  parafoudreAc: { designation: 'Parafoudre AC', prixDefaut: 8000 },
};
