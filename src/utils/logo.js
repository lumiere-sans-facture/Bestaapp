// Logo de l'entreprise sur les documents — logique pure.
//
// Une hauteur fixe (32 px) rendait minuscule tout logo un peu carré, ou
// entouré de marges : la hauteur était la même pour un sigle carré et pour
// un nom en longueur, si bien que le sigle n'occupait qu'un timbre-poste.
// Ici, la taille dépend des PROPORTIONS de l'image : chaque logo reçoit la
// même SURFACE visuelle (un carré de 80 × 80, un bandeau de 180 × 36…),
// bornée en hauteur et en largeur pour ne jamais déborder de son en-tête.

/**
 * Emplacements du logo : surface visée (px²) et bornes (px). `hauteurMin` :
 * la hauteur fixe d'avant — un logo très allongé (BestaSolar) n'y rapetisse
 * jamais.
 */
export const GABARITS_LOGO = {
  // En-tête des devis et factures (Studio, Vague).
  document: { aire: 6400, hauteurMin: 32, hauteurMax: 80, largeurMax: 300 },
  // En-tête de la fiche de dimensionnement (trois pages calibrées).
  fiche: { aire: 3600, hauteurMin: 31, hauteurMax: 56, largeurMax: 280 },
  // Aperçu en direct de « Mon entreprise » (petite vignette).
  vignette: { aire: 1600, hauteurMin: 18, hauteurMax: 40, largeurMax: 130 },
};

const octetsBase64 = (dataUrl, nb) => {
  const virgule = String(dataUrl || '').indexOf(',');
  if (virgule < 0 || !/;base64,/.test(dataUrl.slice(0, virgule + 1))) return null;
  // Assez de caractères pour `nb` octets (4 caractères = 3 octets).
  const morceau = dataUrl.slice(virgule + 1, virgule + 1 + Math.ceil(nb / 3) * 4);
  try {
    const brut = atob(morceau);
    const out = new Uint8Array(brut.length);
    for (let i = 0; i < brut.length; i += 1) out[i] = brut.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
};

/**
 * Dimensions d'une image en data URL (PNG, JPEG, GIF, WebP), lues dans son
 * en-tête — sans la décoder, donc aussi hors navigateur.
 * @returns {{largeur: number, hauteur: number}|null}
 */
export function dimensionsImage(dataUrl) {
  const o = octetsBase64(dataUrl, 64 * 1024);
  if (!o || o.length < 30) return null;
  const be16 = (i) => (o[i] << 8) | o[i + 1];
  const be32 = (i) => ((o[i] << 24) >>> 0) + (o[i + 1] << 16) + (o[i + 2] << 8) + o[i + 3];
  const le16 = (i) => o[i] | (o[i + 1] << 8);
  const ok = (l, h) => (l > 0 && h > 0 ? { largeur: l, hauteur: h } : null);
  // PNG : signature puis bloc IHDR.
  if (o[0] === 0x89 && o[1] === 0x50 && o[2] === 0x4e && o[3] === 0x47) return ok(be32(16), be32(20));
  // GIF
  if (o[0] === 0x47 && o[1] === 0x49 && o[2] === 0x46) return ok(le16(6), le16(8));
  // WebP (RIFF … WEBP)
  if (o[0] === 0x52 && o[1] === 0x49 && o[8] === 0x57 && o[9] === 0x45) {
    const bloc = String.fromCharCode(o[12], o[13], o[14], o[15]);
    if (bloc === 'VP8X') return ok(1 + (o[24] | (o[25] << 8) | (o[26] << 16)), 1 + (o[27] | (o[28] << 8) | (o[29] << 16)));
    if (bloc === 'VP8L') {
      const b = o[21] | (o[22] << 8) | (o[23] << 16) | (o[24] << 24);
      return ok((b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1);
    }
    if (bloc === 'VP8 ') return ok(le16(26) & 0x3fff, le16(28) & 0x3fff);
    return null;
  }
  // JPEG : premier marqueur SOFn.
  if (o[0] === 0xff && o[1] === 0xd8) {
    let i = 2;
    while (i + 9 < o.length) {
      if (o[i] !== 0xff) { i += 1; continue; }
      const m = o[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return ok(be16(i + 7), be16(i + 5));
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      i += 2 + be16(i + 2);
    }
  }
  return null;
}

/**
 * Taille d'affichage d'un logo de proportions `ratio` (largeur / hauteur) :
 * la surface visée du gabarit, puis réduite pour tenir dans ses bornes.
 * @returns {{largeur: number, hauteur: number}}
 */
export function tailleLogo(ratio, gabarit = GABARITS_LOGO.document) {
  const r = Number(ratio) > 0 ? Number(ratio) : 1;
  let hauteur = Math.max(Math.sqrt(gabarit.aire / r), gabarit.hauteurMin || 0);
  let largeur = hauteur * r;
  const reduction = Math.min(1, gabarit.hauteurMax / hauteur, gabarit.largeurMax / largeur);
  hauteur *= reduction;
  largeur *= reduction;
  return { largeur: Math.round(largeur), hauteur: Math.round(hauteur) };
}

/**
 * Style CSS du logo pour un gabarit : dimensions exactes quand l'image dit
 * les siennes ; sinon des bornes, l'image gardant ses proportions.
 */
export function styleLogo(dataUrl, gabarit = GABARITS_LOGO.document) {
  const d = dimensionsImage(dataUrl);
  if (!d) return `max-height:${gabarit.hauteurMax}px;max-width:${gabarit.largeurMax}px;width:auto;height:auto;object-fit:contain`;
  const t = tailleLogo(d.largeur / d.hauteur, gabarit);
  return `width:${t.largeur}px;height:${t.hauteur}px;object-fit:contain`;
}

/**
 * Cadre utile d'un logo : le plus petit rectangle qui contient tout ce qui
 * n'est pas du fond. Fond = pixels transparents, ou de la couleur des coins
 * quand ceux-ci sont opaques et identiques (logo sur fond blanc).
 * @param {Uint8ClampedArray|number[]} px  RGBA, ligne par ligne
 * @returns {{x: number, y: number, largeur: number, hauteur: number}|null}
 *   null si l'image n'est que du fond.
 */
export function cadreUtile(px, largeur, hauteur, tolerance = 24) {
  const at = (x, y) => (y * largeur + x) * 4;
  const coins = [at(0, 0), at(largeur - 1, 0), at(0, hauteur - 1), at(largeur - 1, hauteur - 1)];
  const coinsOpaques = coins.every((i) => px[i + 3] > 240);
  const ecart = (i, j) => Math.max(Math.abs(px[i] - px[j]), Math.abs(px[i + 1] - px[j + 1]), Math.abs(px[i + 2] - px[j + 2]));
  const fondUni = coinsOpaques && coins.every((i) => ecart(i, coins[0]) <= tolerance);
  const estFond = (i) => px[i + 3] < 20 || (fondUni && px[i + 3] > 240 && ecart(i, coins[0]) <= tolerance);
  let x0 = largeur; let y0 = hauteur; let x1 = -1; let y1 = -1;
  for (let y = 0; y < hauteur; y += 1) {
    for (let x = 0; x < largeur; x += 1) {
      if (estFond(at(x, y))) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return { x: x0, y: y0, largeur: x1 - x0 + 1, hauteur: y1 - y0 + 1 };
}
