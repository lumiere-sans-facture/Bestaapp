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

/** Combine les deux sources : irradiation NASA en priorité (valeurs réelles,
 *  plus conservatrices), angle optimal PVGIS, libellé « NASA/PVGIS » si les
 *  deux répondent. nasa/pvgis = sorties de nasaToSolar/pvgisToSolar (ou null). */
export const combineSolar = (nasa, pvgis, lat) => {
  const irr = nasa || pvgis;
  if (!irr) return null;
  return {
    peakSunHours: irr.peakSunHours,
    yearlyYield: irr.yearlyYield,
    optimalAngle: pvgis?.optimalAngle ?? nasa?.optimalAngle ?? Math.round(Math.abs(lat)),
    source: nasa && pvgis ? 'NASA/PVGIS' : (nasa ? 'NASA POWER' : 'PVGIS'),
  };
};

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

/** Appel direct des deux APIs (apps natives, dev) puis combinaison. */
async function fromBoth(lat, lon) {
  const [na, pv] = await Promise.allSettled([fromNASA(lat, lon), fromPVGIS(lat, lon)]);
  const combined = combineSolar(
    na.status === 'fulfilled' ? na.value : null,
    pv.status === 'fulfilled' ? pv.value : null,
    lat,
  );
  if (!combined) throw new Error('Données solaires indisponibles.');
  return combined;
}

/** Ensoleillement pour des coordonnées.
 *  1) Proxy serveur /api/solar (web) : NASA + PVGIS combinés, sans souci CORS.
 *  2) Repli appel direct combiné (apps natives Capacitor, dev sans serverless). */
export async function fetchSolarData(lat, lon) {
  try {
    const res = await fetch(`/api/solar?lat=${lat}&lon=${lon}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.peakSunHours != null) return data;
    }
  } catch {
    /* pas de proxy (app native / dev local) → repli direct ci-dessous */
  }
  return await fromBoth(lat, lon);
}
