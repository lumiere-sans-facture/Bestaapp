// Prix du kWh domestique dans les huit pays de l'UEMOA, avec leur opérateur
// national. Le simulateur de rentabilité s'adresse à toute la zone : le même
// client, la même installation, mais une facture qui change du simple au
// double selon le pays — de 86 F le kWh au Niger à 180 F en Guinée-Bissau.
//
// ⚠️ Ce sont des ORDRES DE GRANDEUR de la tranche domestique courante, pas des
// tarifs officiels : chaque opérateur applique des tranches (basse, moyenne,
// haute tension), des primes fixes et des révisions. Le curseur de l'écran
// reste donc modifiable — ces valeurs ne sont qu'un point de départ, et c'est
// la facture du client qui fait foi.
export const TARIFS_UEMOA = [
  { id: 'bj', pays: 'Bénin', operateur: 'SBEE', prixKwh: 115 },
  { id: 'bf', pays: 'Burkina Faso', operateur: 'SONABEL', prixKwh: 127 },
  { id: 'ci', pays: 'Côte d’Ivoire', operateur: 'CIE', prixKwh: 90 },
  { id: 'gw', pays: 'Guinée-Bissau', operateur: 'EAGB', prixKwh: 180 },
  { id: 'ml', pays: 'Mali', operateur: 'EDM', prixKwh: 100 },
  { id: 'ne', pays: 'Niger', operateur: 'NIGELEC', prixKwh: 86 },
  { id: 'sn', pays: 'Sénégal', operateur: 'Senelec', prixKwh: 115 },
  { id: 'tg', pays: 'Togo', operateur: 'CEET', prixKwh: 114 },
];

// Bénin par défaut : c'est le pays d'immatriculation de BestaSolar
// (voir config/company.js), donc le cas le plus fréquent en visite.
export const PAYS_DEFAUT = 'bj';

export const tarifPays = (id) => TARIFS_UEMOA.find((t) => t.id === id) || null;

/** Libellé de l'opérateur d'un pays — « SBEE » — pour les lignes de coût. */
export const operateurPays = (id) => tarifPays(id)?.operateur || 'Réseau';
