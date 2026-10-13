// Couvertures des formations de l'Académie BestaSolar (format 16:9).
//
// Elles vont dans le champ `cover` d'un cours, le même que la photo choisie
// par le gérant : une image en data URL, donc AUCUN fichier à télécharger —
// elles s'affichent hors ligne et voyagent avec le cours jusqu'en base.
// Couleurs de la charte : navy #0D3483, orange #FFA800. Le fond est plein
// (une couverture est une image, elle ne suit pas le thème) : elle se lit
// pareil en clair et en sombre.
//
// Deux recadrages à tenir (object-fit: cover) : la carte du catalogue, en
// bandeau d'environ 3:1 (y de 180 à 720 visibles), et l'en-tête du cours
// ouvert, qui sur ordinateur n'en garde qu'une fente de 10:1 (y de 372 à 528).
// Le texte tient donc dans cette fente, et rien ne descend sous y = 530 à
// gauche, où la carte pose son badge de durée. Le niveau et la durée ne sont
// pas écrits sur l'image : la carte les affiche déjà.

const NAVY = '#0D3483';
const NAVY_FONCE = '#08215A';
const ORANGE = '#FFA800';

const cadre = (titre, dessin) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${NAVY_FONCE}"/><stop offset="1" stop-color="${NAVY}"/></linearGradient></defs>
<rect width="1600" height="900" fill="url(#g)"/>
<circle cx="1480" cy="120" r="260" fill="#ffffff" opacity=".05"/>
<circle cx="120" cy="860" r="220" fill="#ffffff" opacity=".05"/>
<text x="110" y="400" fill="${ORANGE}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" letter-spacing="4">ACADÉMIE BESTASOLAR</text>
${titre.map((ligne, i) => `<text x="110" y="${455 + i * 60}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="700">${ligne}</text>`).join('')}
${dessin}
</svg>`;

// F1 : soleil, panneaux, téléphone.
const DESSIN_DEMARRER = `
<circle cx="1330" cy="285" r="62" fill="${ORANGE}"/>
${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
    const r = (a * Math.PI) / 180;
    return `<line x1="${1330 + Math.cos(r) * 82}" y1="${285 + Math.sin(r) * 82}" x2="${1330 + Math.cos(r) * 108}" y2="${285 + Math.sin(r) * 108}" stroke="${ORANGE}" stroke-width="12" stroke-linecap="round"/>`;
  }).join('')}
<g transform="translate(1010 470) skewX(-12)">
  <rect width="300" height="170" rx="10" fill="#1F4FBF" stroke="#ffffff" stroke-width="6"/>
  <line x1="100" y1="0" x2="100" y2="170" stroke="#ffffff" stroke-width="4"/>
  <line x1="200" y1="0" x2="200" y2="170" stroke="#ffffff" stroke-width="4"/>
  <line x1="0" y1="85" x2="300" y2="85" stroke="#ffffff" stroke-width="4"/>
</g>
<line x1="1120" y1="640" x2="1100" y2="700" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
<line x1="1240" y1="640" x2="1260" y2="700" stroke="#ffffff" stroke-width="10" stroke-linecap="round"/>
<g transform="translate(1335 395)">
  <rect width="170" height="300" rx="26" fill="#ffffff"/>
  <rect x="14" y="34" width="142" height="222" rx="8" fill="${NAVY}"/>
  <rect x="28" y="52" width="114" height="22" rx="5" fill="${ORANGE}"/>
  <rect x="28" y="88" width="114" height="14" rx="4" fill="#ffffff" opacity=".7"/>
  <rect x="28" y="112" width="84" height="14" rx="4" fill="#ffffff" opacity=".5"/>
  <rect x="28" y="146" width="52" height="52" rx="8" fill="#ffffff" opacity=".22"/>
  <rect x="90" y="146" width="52" height="52" rx="8" fill="#ffffff" opacity=".22"/>
  <circle cx="85" cy="276" r="11" fill="${NAVY}" opacity=".35"/>
</g>`;

// F2 : un devis et un stylo.
const DESSIN_DEVIS = `
<g transform="translate(1060 210) rotate(-6)">
  <rect width="330" height="430" rx="16" fill="#ffffff"/>
  <rect x="34" y="40" width="150" height="26" rx="6" fill="${NAVY}"/>
  <rect x="226" y="40" width="70" height="26" rx="6" fill="${ORANGE}"/>
  ${[110, 150, 190, 230, 270].map((y) => `<rect x="34" y="${y}" width="200" height="14" rx="4" fill="${NAVY}" opacity=".22"/><rect x="250" y="${y}" width="46" height="14" rx="4" fill="${NAVY}" opacity=".35"/>`).join('')}
  <rect x="34" y="320" width="262" height="3" fill="${NAVY}" opacity=".3"/>
  <rect x="150" y="342" width="146" height="34" rx="8" fill="${NAVY}"/>
  <path d="M40 398 q24 -28 48 0 t48 0" stroke="${NAVY}" stroke-width="5" fill="none" stroke-linecap="round"/>
</g>
<g transform="translate(1310 380) rotate(38)">
  <rect width="34" height="300" rx="10" fill="${ORANGE}"/>
  <rect y="230" width="34" height="38" fill="#ffffff" opacity=".85"/>
  <path d="M0 300 L17 352 L34 300 Z" fill="#ffffff"/>
  <path d="M11 334 L17 352 L23 334 Z" fill="${NAVY_FONCE}"/>
</g>`;

// F3 : des pièces et un graphique qui monte.
const DESSIN_REVENUS = `
${[0, 1, 2, 3, 4].map((i) => `<ellipse cx="1110" cy="${660 - i * 34}" rx="92" ry="28" fill="${ORANGE}" stroke="#ffffff" stroke-width="5"/>`).join('')}
<text x="1110" y="535" text-anchor="middle" fill="${NAVY_FONCE}" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700">F</text>
${[0, 1, 2].map((i) => `<ellipse cx="1260" cy="${660 - i * 34}" rx="72" ry="22" fill="${ORANGE}" stroke="#ffffff" stroke-width="5" opacity=".9"/>`).join('')}
${[[1370, 560, 120], [1440, 470, 210], [1510, 380, 300]].map(([x, y, h]) => `<rect x="${x}" y="${y}" width="48" height="${h}" rx="8" fill="#ffffff" opacity=".9"/>`).join('')}
<polyline points="1330,520 1400,450 1460,470 1540,300" fill="none" stroke="${ORANGE}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M1512 292 L1556 280 L1548 326 Z" fill="${ORANGE}"/>`;

const enDataUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\n\s*/g, ' '))}`;

export const COUVERTURE_DEMARRER = enDataUrl(cadre(
  ['Démarrer avec', 'BestaSolar Pro'], DESSIN_DEMARRER,
));
export const COUVERTURE_DEVIS = enDataUrl(cadre(
  ['Créer des devis', 'qui signent'], DESSIN_DEVIS,
));
export const COUVERTURE_REVENUS = enDataUrl(cadre(
  ['Gagner de l’argent', 'avec BestaSolar Pro'], DESSIN_REVENUS,
));
