// Fonction serverless Vercel — proxy des données solaires.
// Interroge PVGIS ET NASA POWER côté serveur (pas de CORS), les combine, et
// renvoie un résultat unifié. Permet d'obtenir les valeurs PVGIS (plan optimal,
// angle réel) de façon fiable, là où l'appel direct depuis le navigateur peut
// être bloqué par CORS.

import { limiter, erreurServeur, PLAFONDS } from './_lib/garde.js';

const round1 = (n) => Math.round(n * 10) / 10;

// Dimensionnement sur le PIRE MOIS (saison des pluies), pas la moyenne
// annuelle : un système taillé sur la moyenne manque d'énergie chaque
// juillet-août. Le productible annuel reste un total annuel.
const MOIS_NASA = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const JOURS_MOIS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const nasaPireMois = (param) => {
  const vals = MOIS_NASA.map((m) => Number(param?.[m])).filter((v) => Number.isFinite(v) && v > 0);
  return vals.length ? Math.min(...vals) : null;
};
const pvgisPireMoisPsh = (monthly) => {
  const vals = (monthly || [])
    .map((m) => {
      const h = Number(m?.['H(i)_m']);
      const jours = JOURS_MOIS[(Number(m?.month) || 1) - 1] || 30;
      return Number.isFinite(h) && h > 0 ? h / jours : null;
    })
    .filter((v) => v != null);
  return vals.length ? Math.min(...vals) : null;
};

async function fetchPVGIS(lat, lon) {
  const url = `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?lat=${lat}&lon=${lon}&peakpower=1&loss=14&optimalangles=1&outputformat=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('pvgis');
  const d = await res.json();
  const irr = d.outputs?.totals?.fixed?.['H(i)_y'];
  const slope = d.inputs?.mounting_system?.fixed?.slope?.value;
  if (irr == null) throw new Error('pvgis-empty');
  return {
    peakSunHours: round1(pvgisPireMoisPsh(d.outputs?.monthly?.fixed) ?? irr / 365),
    yearlyYield: Math.round(irr),
    optimalAngle: slope != null ? Math.round(slope) : null,
  };
}

async function fetchNASA(lat, lon) {
  const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${lon}&latitude=${lat}&format=JSON`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('nasa');
  const d = await res.json();
  const param = d.properties?.parameter?.ALLSKY_SFC_SW_DWN;
  const ann = param?.ANN;
  if (ann == null) throw new Error('nasa-empty');
  return { peakSunHours: round1(nasaPireMois(param) ?? ann), yearlyYield: Math.round(ann * 365) };
}

export default async function handler(req, res) {
  if (limiter(req, res, PLAFONDS.solar, 'solar')) return;

  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return res.status(400).json({ error: 'Paramètres lat/lon invalides.' });
  }

  const [pv, na] = await Promise.allSettled([fetchPVGIS(lat, lon), fetchNASA(lat, lon)]);
  const pvgis = pv.status === 'fulfilled' ? pv.value : null;
  const nasa = na.status === 'fulfilled' ? na.value : null;

  if (!pvgis && !nasa) {
    // Le motif exact de chaque source part au journal, pas au client.
    return erreurServeur(req, res, 502, 'Sources solaires indisponibles.', [
      pv.status === 'rejected' ? `pvgis: ${pv.reason?.message}` : null,
      na.status === 'rejected' ? `nasa: ${na.reason?.message}` : null,
    ].filter(Boolean).join(' · '));
  }

  // Valeurs réelles = NASA en priorité (irradiation horizontale, plus
  // conservatrice → dimensionnement avec marge) ; angle optimal depuis PVGIS.
  // Le libellé reste « NASA/PVGIS » quand les deux répondent.
  const irr = nasa || pvgis;
  const source = pvgis && nasa ? 'NASA/PVGIS' : (nasa ? 'NASA POWER' : 'PVGIS');

  // Données climatologiques stables → cache CDN agressif.
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  return res.status(200).json({
    peakSunHours: irr.peakSunHours,
    yearlyYield: irr.yearlyYield,
    optimalAngle: pvgis?.optimalAngle ?? Math.round(Math.abs(lat)),
    source,
    sources: {
      pvgis: pvgis || null,
      nasa: nasa || null,
    },
  });
}
