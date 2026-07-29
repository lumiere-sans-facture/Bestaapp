// Détection des couleurs de marque d'un logo importé.
// La partie pure (analyse d'un tableau de pixels RGBA) est testée
// unitairement ; le chargement du logo dans un canvas n'est qu'un adaptateur
// DOM en fin de fichier. Module volontairement autonome (aucun import) pour
// rester utilisable hors de l'app.

/** #rrggbb depuis des composantes 0-255. */
const hexDe = (r, g, b) => `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

/** Luminance relative approchée (0 noir → 1 blanc). */
const luminance = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** Saturation HSV (0 gris → 1 vif). */
const saturation = (r, g, b) => {
  const max = Math.max(r, g, b);
  return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
};

/** Teinte HSV en degrés (0-360). */
function teinte(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (!d) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** Écart circulaire entre deux teintes (0-180°). */
const ecartTeinte = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** Assombrit une couleur jusqu'à ce qu'un texte blanc reste lisible dessus
 *  (les modèles posent du blanc sur la couleur primaire). */
function lisibleSousBlanc(r, g, b) {
  while (luminance(r, g, b) > 0.55) { r *= 0.9; g *= 0.9; b *= 0.9; }
  return [r, g, b];
}

/** Mélange vers le blanc (teinte claire de secours pour la secondaire). */
const versBlanc = (rgb, ratio) => rgb.map((c) => c + (255 - c) * ratio);

/**
 * Couleurs dominantes d'un tableau RGBA plat (Uint8ClampedArray d'un canvas).
 * - primaire : la couleur la plus présente, pondérée par sa saturation
 *   (un aplat vif l'emporte sur un fond terne), assombrie si besoin pour
 *   qu'un texte blanc reste lisible dessus ;
 * - secondaire : la couleur vive la plus présente de teinte franchement
 *   différente ; à défaut, une version éclaircie de la primaire.
 * Retourne null si le logo ne contient rien d'exploitable (blanc/transparent).
 */
export function couleursDepuisPixels(data) {
  // Quantification 3 bits par canal : les nuances proches se regroupent.
  const seaux = new Map();
  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue; // transparent
    if (Math.min(r, g, b) > 230) continue; // blanc / fond clair
    const cle = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const s = seaux.get(cle) || { n: 0, r: 0, g: 0, b: 0 };
    s.n += 1; s.r += r; s.g += g; s.b += b;
    seaux.set(cle, s);
  }

  const candidats = [...seaux.values()]
    .map(({ n, r, g, b }) => {
      const rgb = [r / n, g / n, b / n];
      return { n, rgb, sat: saturation(...rgb), score: n * (0.15 + saturation(...rgb)) };
    })
    .sort((a, b) => b.score - a.score);

  const prim = candidats[0];
  if (!prim || prim.n < 8) return null; // trop peu de pixels utiles

  const teintePrim = teinte(...prim.rgb);
  const second = candidats.find(
    (c) => c !== prim && c.sat >= 0.25 && c.n >= prim.n * 0.02 && ecartTeinte(teinte(...c.rgb), teintePrim) >= 40,
  );

  return {
    primaire: hexDe(...lisibleSousBlanc(...prim.rgb)),
    secondaire: hexDe(...(second ? second.rgb : versBlanc(prim.rgb, 0.45))),
  };
}

/**
 * Charge un logo (data-URI ou URL) dans un canvas et en détecte les couleurs.
 * Résout en { primaire, secondaire } ou null — jamais de rejet : un échec de
 * détection ne doit pas bloquer l'import du logo.
 */
export function couleursDuLogo(src, taille = 64) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = taille;
        canvas.height = taille;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, taille, taille);
        resolve(couleursDepuisPixels(ctx.getImageData(0, 0, taille, taille).data));
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
