// Référentiel d'ensoleillement : heures de pic solaire (peak sun hours)
// moyennes annuelles par ville du Bénin. Valeurs indicatives, ajustables.
export const ENSOLEILLEMENT = [
  { city: 'Cotonou', psh: 4.8 },
  { city: 'Porto-Novo', psh: 4.9 },
  { city: 'Lokossa', psh: 4.9 },
  { city: 'Abomey / Bohicon', psh: 5.1 },
  { city: 'Dassa-Zoumè', psh: 5.2 },
  { city: 'Savè', psh: 5.3 },
  { city: 'Parakou', psh: 5.4 },
  { city: 'Djougou', psh: 5.5 },
  { city: 'Natitingou', psh: 5.7 },
  { city: 'Kandi', psh: 5.8 },
  { city: 'Malanville', psh: 6.0 },
];

export const DEFAULT_CITY = 'Parakou';

export const pshForCity = (city) =>
  ENSOLEILLEMENT.find((e) => e.city === city)?.psh ?? null;
