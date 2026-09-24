import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { lienLegal, estAppNative } from '../liensLegaux';
import { PAGES_LEGALES, SITE_PUBLIC, EDITEUR } from '../../config/legal';

const publicDir = new URL('../../../public/', import.meta.url);

describe('lienLegal', () => {
  it('web : chemin relatif, nouvel onglet', () => {
    expect(lienLegal('conditions', { natif: false })).toEqual({ href: '/conditions.html', target: '_blank', rel: 'noopener' });
  });
  it('app native : le site public, confié au navigateur du téléphone', () => {
    expect(lienLegal('confidentialite', { natif: true })).toEqual({ href: `${SITE_PUBLIC}/privacy.html` });
  });
  it('détecte la coquille Capacitor', () => {
    expect(estAppNative({ Capacitor: { isNativePlatform: () => true } })).toBe(true);
    expect(estAppNative({})).toBe(false);
    expect(estAppNative(undefined)).toBe(false);
  });
});

describe('pages légales publiées', () => {
  for (const [cle, { chemin }] of Object.entries(PAGES_LEGALES)) {
    it(`${cle} existe dans public/ et n'est pas réécrite vers l'app (vercel.json)`, () => {
      expect(existsSync(new URL(`.${chemin}`, publicDir))).toBe(true);
      const vercel = readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8');
      expect(vercel).toContain(chemin.slice(1).replace('.', '\\\\.'));
    });
  }
  it('confidentialité et conditions citent l’éditeur exact et le contact', () => {
    for (const page of ['privacy.html', 'conditions.html']) {
      const html = readFileSync(new URL(page, publicDir), 'utf8');
      expect(html).toContain(EDITEUR.raisonSociale);
      expect(html).toContain(EDITEUR.rccm);
      expect(html).toContain(EDITEUR.email);
      expect(html).not.toMatch(/gmail\.com|Parakou|usage interne/);
    }
  });
});
