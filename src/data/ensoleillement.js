// Référentiel d'ensoleillement : heures de pic solaire (peak sun hours) du
// PIRE MOIS de l'année par ville du Togo — pas la moyenne annuelle. Un
// système taillé sur la moyenne manque d'énergie chaque saison des pluies
// (juillet-août, ciel couvert) ; taillé sur le pire mois, il tient toute
// l'année. Valeurs calées sur les données satellite NASA POWER (pire mois
// mesuré : 4,3 h à Lomé) — la recherche en ligne d'une ville donne toujours
// la valeur exacte du point ; cette table est le repli hors-ligne. Le
// gradient sud → nord suit l'éloignement de la côte (moins de nébulosité).
export const ENSOLEILLEMENT = [
  { city: 'Lomé', psh: 4.3 },
  { city: 'Aného', psh: 4.3 },
  { city: 'Tsévié', psh: 4.3 },
  { city: 'Kpalimé', psh: 4.2 },
  { city: 'Notsè', psh: 4.3 },
  { city: 'Atakpamé', psh: 4.4 },
  { city: 'Sotouboua', psh: 4.5 },
  { city: 'Sokodé', psh: 4.5 },
  { city: 'Bassar', psh: 4.5 },
  { city: 'Kara', psh: 4.6 },
  { city: 'Niamtougou', psh: 4.6 },
  { city: 'Mango', psh: 4.7 },
  { city: 'Dapaong', psh: 4.8 },
];

export const DEFAULT_CITY = 'Lomé';

export const pshForCity = (city) =>
  ENSOLEILLEMENT.find((e) => e.city === city)?.psh ?? null;
