// Logo sur les documents : dimensions lues dans l'en-tête de l'image, taille
// équilibrée selon les proportions, rognage des marges vides.
import { describe, it, expect } from 'vitest';
import { dimensionsImage, tailleLogo, styleLogo, cadreUtile, GABARITS_LOGO } from '../logo';
import { LOGO_BESTASOLAR } from '../../assets/logoBestaSolar';

const dataUrl = (type, octets) => `data:${type};base64,${Buffer.from(octets).toString('base64')}`;
const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le16 = (n) => [n & 255, (n >>> 8) & 255];

// En-têtes minimaux, suffisants pour la lecture des dimensions.
const png = (l, h) => dataUrl('image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...be32(l), ...be32(h), 8, 6, 0, 0, 0, 0, 0, 0, 0, 0]);
const gif = (l, h) => dataUrl('image/gif', [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, ...le16(l), ...le16(h), ...new Array(24).fill(0)]);
const jpeg = (l, h) => dataUrl('image/jpeg', [
  0xff, 0xd8,
  0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, // APP0 (16 octets)
  0xff, 0xc0, 0, 17, 8, (h >> 8) & 255, h & 255, (l >> 8) & 255, l & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, // SOF0
  ...new Array(8).fill(0),
]);
const webpVp8x = (l, h) => dataUrl('image/webp', [
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58, 10, 0, 0, 0, 0x10, 0, 0, 0,
  (l - 1) & 255, ((l - 1) >> 8) & 255, ((l - 1) >> 16) & 255, (h - 1) & 255, ((h - 1) >> 8) & 255, ((h - 1) >> 16) & 255, 0, 0,
]);

describe('dimensions lues dans l’en-tête', () => {
  it('PNG, JPEG, GIF, WebP', () => {
    expect(dimensionsImage(png(480, 200))).toEqual({ largeur: 480, hauteur: 200 });
    expect(dimensionsImage(jpeg(640, 360))).toEqual({ largeur: 640, hauteur: 360 });
    expect(dimensionsImage(gif(120, 60))).toEqual({ largeur: 120, hauteur: 60 });
    expect(dimensionsImage(webpVp8x(300, 300))).toEqual({ largeur: 300, hauteur: 300 });
  });

  it('le logo BestaSolar est lisible', () => {
    const d = dimensionsImage(LOGO_BESTASOLAR);
    expect(d.largeur / d.hauteur).toBeGreaterThan(4);
  });

  it('rien de lisible : null', () => {
    expect(dimensionsImage('')).toBeNull();
    expect(dimensionsImage('https://exemple.tg/logo.png')).toBeNull();
    expect(dimensionsImage('data:image/png;base64,AAAA')).toBeNull();
  });
});

describe('taille équilibrée selon les proportions', () => {
  const doc = GABARITS_LOGO.document;

  it('un sigle carré occupe tout son emplacement (80 × 80, plus 32 × 32)', () => {
    expect(tailleLogo(1, doc)).toEqual({ largeur: 80, hauteur: 80 });
  });

  it('même surface pour un logo en longueur, bornée en largeur', () => {
    const large = tailleLogo(480 / 200, doc);
    expect(large).toEqual({ largeur: 124, hauteur: 52 });
    expect(Math.abs(large.largeur * large.hauteur - 6400)).toBeLessThan(100);
    expect(tailleLogo(20, doc).largeur).toBeLessThanOrEqual(doc.largeurMax);
  });

  it('jamais plus bas qu’avant pour un logo très allongé (32 px)', () => {
    const d = dimensionsImage(LOGO_BESTASOLAR);
    expect(tailleLogo(d.largeur / d.hauteur, doc).hauteur).toBe(32);
    expect(tailleLogo(d.largeur / d.hauteur, GABARITS_LOGO.fiche).hauteur).toBe(31);
  });

  it('un logo vertical tient dans la hauteur', () => {
    expect(tailleLogo(0.5, doc)).toEqual({ largeur: 40, hauteur: 80 });
  });

  it('style : dimensions exactes, sinon des bornes', () => {
    expect(styleLogo(png(300, 300))).toBe('width:80px;height:80px;object-fit:contain');
    expect(styleLogo('data:image/svg+xml;base64,PHN2Zy8+')).toMatch(/^max-height:80px;max-width:300px/);
  });
});

describe('rognage des marges vides', () => {
  // Image 10 × 6 : un rectangle « encre » de x 3→6, y 2→3.
  const image = (fond, encre = [27, 58, 143, 255]) => {
    const px = [];
    for (let y = 0; y < 6; y += 1) for (let x = 0; x < 10; x += 1) {
      px.push(...(x >= 3 && x <= 6 && y >= 2 && y <= 3 ? encre : fond));
    }
    return px;
  };

  it('fond transparent', () => {
    expect(cadreUtile(image([0, 0, 0, 0]), 10, 6)).toEqual({ x: 3, y: 2, largeur: 4, hauteur: 2 });
  });

  it('fond blanc uni (JPEG)', () => {
    expect(cadreUtile(image([255, 255, 255, 255]), 10, 6)).toEqual({ x: 3, y: 2, largeur: 4, hauteur: 2 });
    // Un blanc « presque » blanc (compression) est encore du fond.
    expect(cadreUtile(image([250, 252, 249, 255]), 10, 6)).toEqual({ x: 3, y: 2, largeur: 4, hauteur: 2 });
  });

  it('image pleine, sans marge : rien à rogner', () => {
    const plein = image([200, 30, 40, 255], [200, 30, 40, 255]);
    // Coins et encre de même couleur : tout est « fond » — l'appelant garde l'image.
    expect(cadreUtile(plein, 10, 6)).toBeNull();
    // Coins de couleurs différentes : pas de fond uni, l'image entière est utile.
    const mixte = image([0, 0, 0, 255]);
    mixte.splice(0, 4, 255, 255, 255, 255);
    expect(cadreUtile(mixte, 10, 6)).toEqual({ x: 0, y: 0, largeur: 10, hauteur: 6 });
  });
});
