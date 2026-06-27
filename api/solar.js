// Fonction serverless Vercel — proxy des données solaires.
// Interroge PVGIS ET NASA POWER côté serveur (pas de CORS), les combine, et
// renvoie un résultat unifié. Permet d'obtenir les valeurs PVGIS (plan optimal,
// angle réel) de façon fiable, là où l'appel direct depuis le navigateur peut
// être bloqué par CORS.

const round1 = (n) => Math.round(n * 10) / 10;

async function fetchPVGIS(lat, lon) {
  const url = `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?lat=${lat}&lon=${lon}&peakpower=1&loss=14&optimalangles=1&outputformat=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('pvgis');
  const d = await res.json();
  const irr = d.outputs?.totals?.fixed?.['H(i)_y'];
  const slope = d.inputs?.mounting_system?.fixed?.slope?.value;
  if (irr == null) throw new Error('pvgis-empty');
  return {
    peakSunHours: round1(irr / 365),
    yearlyYield: Math.round(irr),
    optimalAngle: slope != null ? Math.round(slope) : null,
  };
}

async function fetchNASA(lat, lon) {
  const url = `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${lon}&latitude=${lat}&format=JSON`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('nasa');
  const d = await res.json();
  const ann = d.properties?.parameter?.ALLSKY_SFC_SW_DWN?.ANN;
  if (ann == null) throw new Error('nasa-empty');
  return { peakSunHours: round1(ann), yearlyYield: Math.round(ann * 365) };
}

export default async function handler(req, res) {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  if (Number.isNaN(lat) || Number.isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return res.status(400).json({ error: 'Paramètres lat/lon invalides.' });
  }

  const [pv, na] = await Promise.allSettled([fetchPVGIS(lat, lon), fetchNASA(lat, lon)]);
  const pvgis = pv.status === 'fulfilled' ? pv.value : null;
  const nasa = na.status === 'fulfilled' ? na.value : null;

  if (!pvgis && !nasa) {
    return res.status(502).json({ error: 'Sources solaires indisponibles.' });
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
