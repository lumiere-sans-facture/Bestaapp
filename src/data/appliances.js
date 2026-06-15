// Catalogue d'appareils pour le calculateur de consommation solaire.
// Puissance en Watts, heures d'utilisation jour (6h-18h) / nuit (18h-6h).
// Porté depuis l'application besta-solar.

export const applianceCategories = [
  {
    label: 'Climatisation',
    items: [
      { id: 'ac3cv', name: 'Climatiseur 3 CV', power: 2200, day: 4, night: 4 },
      { id: 'ac25cv', name: 'Climatiseur 2.5 CV', power: 1850, day: 4, night: 4 },
      { id: 'ac2cv', name: 'Climatiseur 2 CV', power: 1500, day: 3, night: 4 },
      { id: 'ac15cv', name: 'Climatiseur 1.5 CV', power: 1100, day: 3, night: 4 },
      { id: 'ac1cv', name: 'Climatiseur 1 CV', power: 735, day: 3, night: 4 },
    ],
  },
  {
    label: 'Réfrigération',
    items: [
      { id: 'fridge', name: 'Réfrigérateur (250-300 L)', power: 250, day: 12, night: 12 },
      { id: 'freezer', name: 'Congélateur Coffre (425 L)', power: 270, day: 12, night: 12 },
      { id: 'minifreezer', name: 'Mini Congélateur', power: 120, day: 12, night: 12 },
    ],
  },
  {
    label: 'Cuisine',
    items: [
      { id: 'dishwasher', name: 'Lave-vaisselle', power: 1500, day: 1, night: 0 },
      { id: 'waterheater', name: 'Chauffe-eau Électrique', power: 1000, day: 0.2, night: 0 },
      { id: 'microwave', name: 'Four à Micro-ondes', power: 1000, day: 0.3, night: 0 },
      { id: 'coffeemachine', name: 'Machine à Café', power: 1500, day: 0.2, night: 0 },
      { id: 'blender', name: 'Mixeur (Blender)', power: 500, day: 1, night: 0 },
    ],
  },
  {
    label: 'Électronique',
    items: [
      { id: 'tv55', name: 'Téléviseur 55"', power: 100, day: 3, night: 2 },
      { id: 'tv32', name: 'Téléviseur 32"', power: 50, day: 3, night: 2 },
      { id: 'starlink', name: 'Antenne Satellite (Starlink)', power: 70, day: 12, night: 0 },
    ],
  },
  {
    label: 'Confort',
    items: [
      { id: 'humidifier', name: 'Humidificateur', power: 120, day: 4, night: 0 },
      { id: 'ceilingfan', name: 'Ventilateur de Plafond', power: 70, day: 4, night: 2 },
      { id: 'standfan', name: 'Ventilateur à Pied', power: 50, day: 4, night: 2 },
    ],
  },
  {
    label: 'Éclairage',
    items: [
      { id: 'ledlamp', name: 'Lampe LED', power: 10, day: 0, night: 12 },
      { id: 'spotled', name: 'Spot LED Encastré', power: 7, day: 0, night: 4 },
    ],
  },
  {
    label: 'Petits appareils',
    items: [
      { id: 'alarmclock', name: 'Radio-Réveil', power: 7, day: 1, night: 0 },
      { id: 'shaver', name: 'Rasoir Électrique', power: 15, day: 1, night: 0 },
    ],
  },
];

// Liste à plat pour la recherche par identifiant
export const appliances = applianceCategories.flatMap((c) => c.items);

export const getApplianceById = (id) => appliances.find((a) => a.id === id);
