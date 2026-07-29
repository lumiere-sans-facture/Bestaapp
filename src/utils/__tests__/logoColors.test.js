import { describe, it, expect } from 'vitest';
import { couleursDepuisPixels } from '../logoColors';

/** Tableau RGBA plat depuis une liste de [r, g, b, a, répétitions]. */
const pixels = (motifs) => motifs.flatMap(([r, g, b, a, n]) => Array(n).fill([r, g, b, a]).flat());

const canal = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
const luminance = (hex) => (0.2126 * canal(hex, 0) + 0.7152 * canal(hex, 1) + 0.0722 * canal(hex, 2)) / 255;

describe('couleursDepuisPixels', () => {
  it('détecte la couleur dominante et l’accent d’une autre teinte', () => {
    // Logo vert à accent rouge sur fond blanc, avec un peu de transparence.
    const data = pixels([
      [27, 122, 67, 255, 300], // vert dominant
      [212, 53, 24, 255, 60], // accent rouge
      [255, 255, 255, 255, 200], // fond blanc (ignoré)
      [0, 0, 0, 0, 100], // transparent (ignoré)
    ]);
    const c = couleursDepuisPixels(data);
    // Primaire verte : le canal vert domine.
    expect(canal(c.primaire, 1)).toBeGreaterThan(canal(c.primaire, 0));
    expect(canal(c.primaire, 1)).toBeGreaterThan(canal(c.primaire, 2));
    // Secondaire rouge : le canal rouge domine.
    expect(canal(c.secondaire, 0)).toBeGreaterThan(canal(c.secondaire, 1));
  });

  it('un aplat vif l’emporte sur un gris plus nombreux', () => {
    const data = pixels([
      [120, 120, 120, 255, 400], // gris terne majoritaire
      [10, 36, 114, 255, 250], // navy vif
    ]);
    const c = couleursDepuisPixels(data);
    expect(canal(c.primaire, 2)).toBeGreaterThan(canal(c.primaire, 0)); // bleu
  });

  it('assombrit une primaire trop claire pour garder un texte blanc lisible', () => {
    const data = pixels([[255, 210, 120, 255, 300]]); // orange très clair
    const c = couleursDepuisPixels(data);
    expect(luminance(c.primaire)).toBeLessThanOrEqual(0.56);
  });

  it('dérive une secondaire éclaircie pour un logo monochrome', () => {
    const data = pixels([[10, 36, 114, 255, 300]]); // navy seul
    const c = couleursDepuisPixels(data);
    expect(c.secondaire).not.toBe(c.primaire);
    // Même famille, plus claire : chaque canal est supérieur ou égal.
    for (const i of [0, 1, 2]) expect(canal(c.secondaire, i)).toBeGreaterThanOrEqual(canal(c.primaire, i));
  });

  it('retourne null quand rien n’est exploitable (blanc et transparent)', () => {
    const data = pixels([
      [255, 255, 255, 255, 300],
      [40, 90, 200, 40, 100], // trop transparent
    ]);
    expect(couleursDepuisPixels(data)).toBeNull();
  });

  it('produit toujours des hexadécimaux valides', () => {
    const data = pixels([[27, 122, 67, 255, 50], [212, 53, 24, 255, 50]]);
    const c = couleursDepuisPixels(data);
    expect(c.primaire).toMatch(/^#[0-9a-f]{6}$/);
    expect(c.secondaire).toMatch(/^#[0-9a-f]{6}$/);
  });
});
