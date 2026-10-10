// Couleurs de marque des documents : lisibilité garantie sans jamais retoucher
// une couleur qui va déjà bien (l'identité de l'abonné est respectée).
import { describe, it, expect } from 'vitest';
import {
  contraste, foncerJusqua, melerVersBlanc, couleursLisibles,
  CONTRASTE_PRIMAIRE, CONTRASTE_ACCENT, normaliserCodeCouleur,
} from '../couleurDocument';

describe('contraste', () => {
  it('mesure le rapport WCAG, symétrique et borné', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contraste('#ffffff', '#000000')).toBeCloseTo(21, 1);
    expect(contraste('#ffffff', '#ffffff')).toBeCloseTo(1, 3);
    // Le navy BestaSolar porte du blanc très confortablement.
    expect(contraste('#0a2472', '#ffffff')).toBeGreaterThan(12);
  });
});

describe('foncerJusqua', () => {
  it('laisse INTACTE une couleur qui atteint déjà le seuil', () => {
    expect(foncerJusqua('#0a2472', CONTRASTE_PRIMAIRE)).toBe('#0a2472');
    // L'orange BestaSolar (2,0:1) reste l'orange BestaSolar.
    expect(foncerJusqua('#f5a623', CONTRASTE_ACCENT)).toBe('#f5a623');
  });

  it('assombrit une couleur trop pâle jusqu’au seuil, pas au-delà', () => {
    const fonce = foncerJusqua('#ffe680', CONTRASTE_ACCENT);
    expect(fonce).not.toBe('#ffe680');
    expect(contraste(fonce, '#ffffff')).toBeGreaterThanOrEqual(CONTRASTE_ACCENT);
    // Un pas de plus (4 %) serait déjà en dessous du seuil : on s'arrête juste au-dessus.
    expect(contraste(fonce, '#ffffff')).toBeLessThan(CONTRASTE_ACCENT * 1.15);
  });

  it('rend une primaire claire compatible avec du texte blanc', () => {
    const fonce = foncerJusqua('#f5a623', CONTRASTE_PRIMAIRE);
    expect(contraste(fonce, '#ffffff')).toBeGreaterThanOrEqual(CONTRASTE_PRIMAIRE);
  });

  it('ne casse pas sur une valeur non hexadécimale', () => {
    expect(foncerJusqua('', CONTRASTE_PRIMAIRE)).toBe('');
    expect(foncerJusqua('rouge', CONTRASTE_PRIMAIRE)).toBe('rouge');
    expect(foncerJusqua('#fff', CONTRASTE_PRIMAIRE)).toBe('#fff');
  });

  it('termine même sur du blanc pur (aucune boucle infinie)', () => {
    const fonce = foncerJusqua('#ffffff', CONTRASTE_PRIMAIRE);
    expect(contraste(fonce, '#ffffff')).toBeGreaterThanOrEqual(CONTRASTE_PRIMAIRE);
  });
});

describe('melerVersBlanc', () => {
  it('interpole vers le blanc', () => {
    expect(melerVersBlanc('#000000', 0)).toBe('#000000');
    expect(melerVersBlanc('#000000', 1)).toBe('#ffffff');
    expect(melerVersBlanc('#000000', 0.5)).toBe('#808080');
  });
});

describe('couleursLisibles', () => {
  it('conserve la palette BestaSolar telle quelle', () => {
    expect(couleursLisibles({ primaire: '#0a2472', secondaire: '#f5a623' }))
      .toEqual({ primaire: '#0a2472', accent: '#f5a623' });
  });

  it('rattrape la palette d’un abonné aux couleurs trop claires', () => {
    const { primaire, accent } = couleursLisibles({ primaire: '#7bd0ff', secondaire: '#fffbe0' });
    expect(contraste(primaire, '#ffffff')).toBeGreaterThanOrEqual(CONTRASTE_PRIMAIRE);
    expect(contraste(accent, '#ffffff')).toBeGreaterThanOrEqual(CONTRASTE_ACCENT);
  });
});

describe('code couleur tapé au clavier', () => {
  it('formes acceptées, ramenées à #rrggbb', () => {
    expect(normaliserCodeCouleur('#E30613')).toBe('#e30613');
    expect(normaliserCodeCouleur('e30613')).toBe('#e30613');
    expect(normaliserCodeCouleur('  #1B3A8F ')).toBe('#1b3a8f');
    expect(normaliserCodeCouleur('#1BA')).toBe('#11bbaa');
    expect(normaliserCodeCouleur('fff')).toBe('#ffffff');
    expect(normaliserCodeCouleur('rgb(227, 6, 19)')).toBe('#e30613');
    expect(normaliserCodeCouleur('RGB(0,0,0)')).toBe('#000000');
  });

  it('code incomplet ou faux : null (rien n’est appliqué)', () => {
    for (const faux of ['', '#', '#E306', '#E3061', '#E306133', '#GG0613', 'rouge', 'rgb(300, 0, 0)', null, undefined]) {
      expect(normaliserCodeCouleur(faux)).toBeNull();
    }
  });
});
