// Référentiel d'ensoleillement : heures de pic solaire (peak sun hours)
// moyennes annuelles par ville du Togo. Valeurs indicatives, ajustables —
// le gradient sud → nord suit l'éloignement de la côte (moins de nébulosité).
export const ENSOLEILLEMENT = [
  { city: 'Lomé', psh: 4.7 },
  { city: 'Aného', psh: 4.7 },
  { city: 'Tsévié', psh: 4.8 },
  { city: 'Kpalimé', psh: 4.8 },
  { city: 'Notsè', psh: 4.9 },
  { city: 'Atakpamé', psh: 5.0 },
  { city: 'Sotouboua', psh: 5.2 },
  { city: 'Sokodé', psh: 5.3 },
  { city: 'Bassar', psh: 5.3 },
  { city: 'Kara', psh: 5.4 },
  { city: 'Niamtougou', psh: 5.4 },
  { city: 'Mango', psh: 5.6 },
  { city: 'Dapaong', psh: 5.7 },
];

export const DEFAULT_CITY = 'Lomé';

export const pshForCity = (city) =>
  ENSOLEILLEMENT.find((e) => e.city === city)?.psh ?? null;
