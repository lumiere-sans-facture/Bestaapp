// Données solaires en ligne : géocodage (Open-Meteo) + ensoleillement réel
// (PVGIS, repli NASA POWER). Ces APIs publiques s'exécutent dans le navigateur
// du client. Tout échec (hors-ligne, CORS, API down) est rattrapé par l'appelant,
// qui propose alors la saisie manuelle des heures de pic.

const round1 = (n) => Math.round(n * 10) / 10;

// ---- Transformations pures (testables, sans réseau) ----

/** ANN = irradiation horizontale moyenne (kWh/m²/jour, NASA) → modèle solaire. */
export const nasaToSolar = (ann, lat) => ({
  peakSunHours: round1(ann),
  yearlyYield: Math.round(ann * 365),
  optimalAngle: Math.round(Math.abs(lat)),
  source: 'NASA POWER',
});

/** irradiation = H(i)_y au plan optimal (kWh/m²/an, PVGIS) → modèle solaire. */
export const pvgisToSolar = (irradiation, slope, lat) => ({
  peakSunHours: round1(irradiation / 365),
  yearlyYield: Math.round(irradiation),
  optimalAngle: slope != null ? Math.round(slope) : Math.round(Math.abs(lat)),
  source: 'PVGIS',
});

// ---- Accès réseau ----

/** Recherche une ville → { name, country, lat, lon }. (Open-Meteo, sans clé, CORS). */
export async function geocodeCity(query) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=fr&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Recherche de ville indisponible.');
  const data = await res.json();
  const r = data.results?.[0];
  if (!r) throw new Error('Ville introuvable.');
  return { name: r.name, country: r.country || '', lat: r.latitude, lon: r.longitude };
}

async function fromPVGIS(lat, lon) {
  const url = `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?lat=${lat}&lon=${lon}&peakpower=1&loss=14&optimalangles=1&outputformat=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('PVGIS indisponible');
  const data = await res.json();
  const irradiation = data.outputs?.totals?.fixed?.['H(i)_y'];
  const slope = data.inputs?.mounting_system?.fixed?.slope?.value;
  if (irradiation == null) throw new Error('PVGIS : données incomplètes');
  return pvgisToSolar(irradiation, slope, lat);
}

async function fromNASA(lat, lon) {
  const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${lon}&latitude=${lat}&format=JSON`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('NASA POWER indisponible');
  const data = await res.json();
  const ann = data.properties?.parameter?.ALLSKY_SFC_SW_DWN?.ANN;
  if (ann == null) throw new Error('Données solaires indisponibles');
  return nasaToSolar(ann, lat);
}

/** Ensoleillement pour des coordonnées : PVGIS d'abord, repli NASA POWER. */
export async function fetchSolarData(lat, lon) {
  try {
    return await fromPVGIS(lat, lon);
  } catch {
    return await fromNASA(lat, lon);
  }
}
