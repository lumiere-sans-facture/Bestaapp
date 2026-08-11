// FIGURE 1 — graphique de couverture mensuelle : SVG inline autonome, sans
// bibliothèque, sans dégradé ni ombre, lisible en noir et blanc (les mois en
// déficit restent identifiables par leurs hachures).
// Les deux couleurs de marque viennent de l'émetteur du document (l'abonné Pro
// ou BestaSolar) ; la terre cuite du déficit, elle, est SÉMANTIQUE : elle
// signale un manque et ne suit aucune marque.
const NAVY_DEFAUT = '#0a2472';
const ORANGE_DEFAUT = '#f5a623';
const TERRE = '#c2410c';
const GRILLE = '#eef0f3';
const BASE = '#9ca3af';
const GRIS_TITRE = '#4b5563';

const nfInt = (v) => Math.round(v).toLocaleString('fr-FR').replace(/[  ]/g, ' ');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Plafond adaptatif de l'axe Y : pas de 75/150/300/600 selon le pic.
export const plafondAxe = (pic) => {
  const pas = [75, 150, 300, 600].find((p) => p * 4 >= pic) || 600;
  return { pas, plafond: Math.max(pas, Math.ceil(pic / pas) * pas) };
};

/**
 * @param {Array<{mois:string, prod:number, besoin:number, deficit:boolean}>} monthly
 * @param {{kwc:number, tauxUtilisation:number, couleurs?:{primaire:string, accent:string}}} opts
 * @returns {string} chaîne <svg>
 */
export function renderCoverageChart(monthly, { kwc, tauxUtilisation, couleurs = {} }) {
  const NAVY = couleurs.primaire || NAVY_DEFAUT;
  const ORANGE = couleurs.accent || ORANGE_DEFAUT;
  const W = 714;
  const H = 273;
  const plotTop = 36;             // 14px de titre + 22px de marge
  const plotH = 170;
  const base = plotTop + plotH;   // ligne de base y = 206
  const left = 46;                // gouttière des graduations Y
  const right = W - 4;
  const plotW = right - left;
  const groupW = plotW / 12;

  const pic = Math.max(...monthly.map((m) => Math.max(m.prod, m.besoin)), 1);
  const { pas, plafond } = plafondAxe(pic);
  const y = (v) => base - (v / plafond) * plotH;

  // Grille + graduations Y
  let grille = '';
  for (let v = 0; v <= plafond; v += pas) {
    grille += `<line x1="${left}" y1="${y(v)}" x2="${right}" y2="${y(v)}" stroke="${v === 0 ? BASE : GRILLE}" stroke-width="1"/>`;
    grille += `<text x="${left - 6}" y="${y(v) + 3}" text-anchor="end" font-size="9" fill="${BASE}">${nfInt(v)}</text>`;
  }

  // Barres accolées : productible 26px, besoin 15px, coins arrondis 1,5px.
  const LARG_PROD = 26;
  const LARG_BESOIN = 15;
  const paires = LARG_PROD + LARG_BESOIN;
  let barres = '';
  let labels = '';
  monthly.forEach((m, i) => {
    const x0 = left + i * groupW + (groupW - paires) / 2;
    const hP = Math.max(1.5, (m.prod / plafond) * plotH);
    const hB = Math.max(1.5, (m.besoin / plafond) * plotH);
    const fillProd = m.deficit ? 'url(#hachures)' : ORANGE;
    barres += `<rect x="${x0.toFixed(1)}" y="${(base - hP).toFixed(1)}" width="${LARG_PROD}" height="${hP.toFixed(1)}" rx="1.5" fill="${fillProd}"/>`;
    barres += `<rect x="${(x0 + LARG_PROD).toFixed(1)}" y="${(base - hB).toFixed(1)}" width="${LARG_BESOIN}" height="${hB.toFixed(1)}" rx="1.5" fill="${NAVY}"/>`;
    // Valeur du productible au-dessus de sa barre
    barres += `<text x="${(x0 + LARG_PROD / 2).toFixed(1)}" y="${(base - hP - 4).toFixed(1)}" text-anchor="middle" font-size="9"${m.deficit ? ` font-weight="600" fill="${TERRE}"` : ` fill="${GRIS_TITRE}"`}>${nfInt(m.prod)}</text>`;
    // Libellé du mois, 18px sous la ligne de base
    labels += `<text x="${(x0 + paires / 2).toFixed(1)}" y="${base + 18}" text-anchor="middle" font-size="10"${m.deficit ? ` font-weight="600" fill="${TERRE}"` : ` fill="${GRIS_TITRE}"`}>${esc(m.mois)}</text>`;
  });

  // Accolade sous les mois en déficit s'ils sont CONSÉCUTIFS.
  const idxDeficit = monthly.map((m, i) => (m.deficit ? i : null)).filter((i) => i != null);
  const consecutifs = idxDeficit.length > 1
    && idxDeficit.every((v, k) => k === 0 || v === idxDeficit[k - 1] + 1);
  let accolade = '';
  if (consecutifs) {
    const x1 = left + idxDeficit[0] * groupW + (groupW - paires) / 2;
    const x2 = left + idxDeficit[idxDeficit.length - 1] * groupW + (groupW - paires) / 2 + paires;
    const yA = base + 24;
    accolade = `<path d="M ${x1.toFixed(1)} ${yA} v 4 h ${(x2 - x1).toFixed(1)} v -4" fill="none" stroke="${TERRE}" stroke-width="1"/>`
      + `<text x="${((x1 + x2) / 2).toFixed(1)}" y="${yA + 12}" text-anchor="middle" font-size="8.5" fill="${TERRE}">saison des pluies</text>`;
  }

  // Légende centrée (pastilles, entrées espacées de 18px) + ligne de source.
  const entrees = [
    { fill: ORANGE, label: 'Productible mensuel estimé' },
    { fill: 'url(#hachures)', label: 'Productible inférieur au besoin' },
    { fill: NAVY, label: `Besoin énergétique retenu (foisonnement ${String(tauxUtilisation).replace('.', ',')})` },
  ];
  const LARG_CAR = 5.1; // approx. par caractère à 9,5px — pour centrer la légende
  const largeurs = entrees.map((e) => 11 + 6 + e.label.length * LARG_CAR);
  const totale = largeurs.reduce((s, l) => s + l, 0) + 18 * (entrees.length - 1);
  let xL = (W - totale) / 2;
  const yL = 257;
  let legende = '';
  entrees.forEach((e, i) => {
    legende += `<rect x="${xL.toFixed(1)}" y="${yL - 9}" width="11" height="11" rx="2" fill="${e.fill}"/>`
      + `<text x="${(xL + 17).toFixed(1)}" y="${yL}" font-size="9.5" fill="${GRIS_TITRE}">${esc(e.label)}</text>`;
    xL += largeurs[i] + 18;
  });
  const source = `<text x="0" y="${yL + 13}" font-size="8.5" fill="${BASE}">Source : base PVGIS (SARAH-3) — plan incliné à 10°, orientation Sud — ratio de performance 0,75</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Couverture mensuelle des besoins" xmlns="http://www.w3.org/2000/svg" font-family="'IBM Plex Sans', system-ui, sans-serif">
  <defs>
    <pattern id="hachures" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
      <rect width="6" height="6" fill="${TERRE}"/>
      <line x1="0" y1="0" x2="0" y2="6" stroke="#fff" stroke-width="1.5"/>
    </pattern>
  </defs>
  <text x="0" y="12" font-size="10" fill="${GRIS_TITRE}"><tspan font-size="8.5" letter-spacing="1">FIGURE</tspan> 1 — Productible mensuel estimé et besoin énergétique retenu</text>
  <text x="${W}" y="12" text-anchor="end" font-size="10" fill="${GRIS_TITRE}">Générateur ${String(kwc.toFixed(2)).replace('.', ',')} kWc</text>
  <text x="10" y="${plotTop + plotH / 2}" text-anchor="middle" font-size="9" fill="${BASE}" transform="rotate(-90 10 ${plotTop + plotH / 2})">kWh/mois</text>
  ${grille}
  ${barres}
  ${labels}
  ${accolade}
  ${legende}
  ${source}
</svg>`;
}
