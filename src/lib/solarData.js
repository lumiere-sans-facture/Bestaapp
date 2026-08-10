// Données solaires en ligne : géocodage (Open-Meteo) + ensoleillement réel
// (PVGIS, repli NASA POWER). Ces APIs publiques s'exécutent dans le navigateur
// du client. Tout échec (hors-ligne, CORS, API down) est rattrapé par l'appelant,
// qui propose alors la saisie manuelle des heures de pic.

const round1 = (n) => Math.round(n * 10) / 10;

// ---- Transformations pures (testables, sans réseau) ----
//
// DIMENSIONNEMENT SUR LE PIRE MOIS : les heures de pic retenues sont celles
// du mois le moins ensoleillé (saison des pluies), pas la moyenne annuelle.
// Un système taillé sur la moyenne tombe en panne d'énergie chaque
// juillet-août ; taillé sur le pire mois, il tient toute l'année. Le
// productible annuel (yearlyYield), lui, reste un total annuel.

const MOIS_NASA = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Pire mois d'une climatologie NASA { JAN…DEC, ANN } (kWh/m²/jour).
 *  Les valeurs de remplissage NASA (-999) sont ignorées. */
export const nasaPireMois = (param) => {
  const vals = MOIS_NASA.map((m) => Number(param?.[m])).filter((v) => Number.isFinite(v) && v > 0);
  return vals.length ? Math.min(...vals) : null;
};

const JOURS_MOIS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Pire mois du détail mensuel PVGIS (H(i)_m, kWh/m²/mois) → h de pic/jour. */
export const pvgisPireMoisPsh = (monthly) => {
  const vals = (monthly || [])
    .map((m) => {
      const h = Number(m?.['H(i)_m']);
      const jours = JOURS_MOIS[(Number(m?.month) || 1) - 1] || 30;
      return Number.isFinite(h) && h > 0 ? h / jours : null;
    })
    .filter((v) => v != null);
  return vals.length ? Math.min(...vals) : null;
};

/** Climatologie NASA { JAN…DEC, ANN } → modèle solaire (pire mois). */
export const nasaToSolar = (param, lat) => {
  const ann = Number(param?.ANN);
  return {
    peakSunHours: round1(nasaPireMois(param) ?? ann),
    yearlyYield: Math.round(ann * 365),
    optimalAngle: Math.round(Math.abs(lat)),
    source: 'NASA POWER',
  };
};

/** irradiation = H(i)_y au plan optimal (kWh/m²/an, PVGIS) + détail mensuel
 *  → modèle solaire (pire mois ; repli moyenne annuelle sans le détail). */
export const pvgisToSolar = (irradiation, slope, lat, monthly = null) => ({
  peakSunHours: round1(pvgisPireMoisPsh(monthly) ?? irradiation / 365),
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

/** Ville la plus proche pour des coordonnées (géocodage inverse BigDataCloud,
 *  gratuit, sans clé, CORS). Renvoie '' si aucune localité identifiable —
 *  l'appelant garde alors son libellé de repli (« Ma position »). */
export async function reverseGeocode(lat, lon) {
  const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=fr`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Géocodage inverse indisponible.');
  const d = await res.json();
  return d.city || d.locality || d.principalSubdivision || '';
}

async function fromPVGIS(lat, lon) {
  const url = `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?lat=${lat}&lon=${lon}&peakpower=1&loss=14&optimalangles=1&outputformat=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('PVGIS indisponible');
  const data = await res.json();
  const irradiation = data.outputs?.totals?.fixed?.['H(i)_y'];
  const slope = data.inputs?.mounting_system?.fixed?.slope?.value;
  if (irradiation == null) throw new Error('PVGIS : données incomplètes');
  return pvgisToSolar(irradiation, slope, lat, data.outputs?.monthly?.fixed);
}

async function fromNASA(lat, lon) {
  const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${lon}&latitude=${lat}&format=JSON`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('NASA POWER indisponible');
  const data = await res.json();
  const param = data.properties?.parameter?.ALLSKY_SFC_SW_DWN;
  if (param?.ANN == null) throw new Error('Données solaires indisponibles');
  return nasaToSolar(param, lat);
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
