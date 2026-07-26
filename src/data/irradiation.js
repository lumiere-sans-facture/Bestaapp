// Référentiel d'irradiation par site — base du dimensionnement v2.
//
// `productibleMensuel` : productible PVGIS en kWh/kWc/JOUR, de janvier
// (indice 0) à décembre (indice 11). C'est cette série qui permet de caler le
// dimensionnement sur le MOIS LE PLUS DÉFAVORABLE plutôt que sur une moyenne
// annuelle (qui garantit un déficit en saison des pluies).
//
// ⚠️ Les trois sites ci-dessous sont volontairement livrés SANS productible
// mensuel (null) : ces valeurs doivent être relevées sur PVGIS, pas inventées.
// Tant que la série est absente, le moteur bascule en méthode dégradée (HSP
// moyen) et le signale explicitement dans la fiche.
//
// Mode opératoire PVGIS :
//   1. https://re.jrc.ec.europa.eu/pvg_tools/fr/
//   2. Saisir les coordonnées du site → « Performance PV connectée au réseau »
//   3. Puissance crête 1 kWc, pertes système 14 %, angles optimisés
//   4. Relever E_m (kWh/mois) pour les 12 mois
//   5. productibleMensuel[i] = E_m[i] ÷ nombre de jours du mois

export const IRRADIATION_SITES = [
  {
    id: 'site-cotonou',
    nom: 'Cotonou',
    latitude: 6.3703,
    longitude: 2.3912,
    inclinaison: null,
    azimut: 0,
    productibleMensuel: null,
    source: null,
    dateExtraction: null,
  },
  {
    id: 'site-parakou',
    nom: 'Parakou',
    latitude: 9.3372,
    longitude: 2.6303,
    inclinaison: null,
    azimut: 0,
    productibleMensuel: null,
    source: null,
    dateExtraction: null,
  },
  {
    id: 'site-save',
    nom: 'Savè',
    latitude: 8.0342,
    longitude: 2.4864,
    inclinaison: null,
    azimut: 0,
    productibleMensuel: null,
    source: null,
    dateExtraction: null,
  },
];

export const DEFAULT_SITE_ID = 'site-parakou';

/** Un site a-t-il une série mensuelle exploitable (12 valeurs > 0) ? */
export const siteComplet = (site) =>
  Array.isArray(site?.productibleMensuel)
  && site.productibleMensuel.length === 12
  && site.productibleMensuel.every((v) => Number(v) > 0);
