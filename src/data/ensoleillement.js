// Référentiel d'ensoleillement : heures de pic solaire (peak sun hours) du
// PIRE MOIS de l'année par ville du Togo — pas la moyenne annuelle. Un
// système taillé sur la moyenne manque d'énergie chaque saison des pluies
// (juillet-août, ciel couvert) ; taillé sur le pire mois, il tient toute
// l'année. Valeurs indicatives, ajustables — le gradient sud → nord suit
// l'éloignement de la côte (moins de nébulosité au nord).
export const ENSOLEILLEMENT = [
  { city: 'Lomé', psh: 3.8 },
  { city: 'Aného', psh: 3.8 },
  { city: 'Tsévié', psh: 3.9 },
  { city: 'Kpalimé', psh: 3.8 },
  { city: 'Notsè', psh: 3.9 },
  { city: 'Atakpamé', psh: 4.0 },
  { city: 'Sotouboua', psh: 4.2 },
  { city: 'Sokodé', psh: 4.3 },
  { city: 'Bassar', psh: 4.3 },
  { city: 'Kara', psh: 4.4 },
  { city: 'Niamtougou', psh: 4.4 },
  { city: 'Mango', psh: 4.6 },
  { city: 'Dapaong', psh: 4.7 },
];

export const DEFAULT_CITY = 'Lomé';

export const pshForCity = (city) =>
  ENSOLEILLEMENT.find((e) => e.city === city)?.psh ?? null;
