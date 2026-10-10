// Code partenaire transmis à l'application Android installée par un lien :
// la page de téléchargement copie un texte, l'app le relit au premier
// lancement. Les deux côtés, et la règle Vercel qui mène à la page, doivent
// rester d'accord.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  codeParrainageDepuisTexte, doitChercherCodeInstallation, enregistrerRef, getActiveRef,
  lienInstallationApp, messageParrainage, partnerLink, texteParrainageApp, REF_TTL_DAYS,
} from '../referral';
import { CHEMIN_TELECHARGEMENT, URL_APK } from '../../config/android';
import { SITE_PUBLIC } from '../../config/legal';
import vercel from '../../../vercel.json';

const PAGE = readFileSync(new URL('../../../public/telecharger.js', import.meta.url), 'utf8');

const stockage = () => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
};

describe('texte copié au téléchargement', () => {
  it('aller-retour : le texte de l’app se relit en code', () => {
    expect(texteParrainageApp('kodjo-k8r4mz')).toBe('Code partenaire BestaSolar : KODJO-K8R4MZ');
    expect(codeParrainageDepuisTexte(texteParrainageApp('KODJO-K8R4MZ'))).toBe('KODJO-K8R4MZ');
  });

  it('la page de téléchargement écrit exactement ce texte', () => {
    // public/telecharger.js : PREFIXE + code.
    const prefixe = PAGE.match(/var PREFIXE = '([^']+)'/)?.[1];
    expect(prefixe).toBeDefined();
    expect(`${prefixe}KODJO-K8R4MZ`).toBe(texteParrainageApp('KODJO-K8R4MZ'));
    // Et n'accepte que des codes que l'app sait relire.
    const motif = new RegExp(PAGE.match(/if \(!\/(.+?)\/\.test\(code\)\)/)?.[1]);
    expect(motif.test('KODJO-K8R4MZ')).toBe(true);
    expect(motif.test('<SCRIPT>')).toBe(false);
  });

  it('tolérant à l’écriture, strict sur le format', () => {
    expect(codeParrainageDepuisTexte('code partenaire bestasolar:aminata-23xyzq')).toBe('AMINATA-23XYZQ');
    expect(codeParrainageDepuisTexte('  Code partenaire BestaSolar :  KODJO-K8R4MZ\n')).toBe('KODJO-K8R4MZ');
    // Ancien préfixe « BESTA- » : retiré, comme pour un lien.
    expect(codeParrainageDepuisTexte('Code partenaire BestaSolar : BESTA-KODJO-K8R4MZ')).toBe('KODJO-K8R4MZ');
  });

  it('tout autre contenu du presse-papiers est ignoré', () => {
    expect(codeParrainageDepuisTexte('')).toBeNull();
    expect(codeParrainageDepuisTexte(null)).toBeNull();
    expect(codeParrainageDepuisTexte('KODJO-K8R4MZ')).toBeNull(); // un code seul, sans la formule
    expect(codeParrainageDepuisTexte('Mon code secret : 1234')).toBeNull();
    expect(codeParrainageDepuisTexte('+228 90 00 00 00')).toBeNull();
  });
});

describe('lecture au premier lancement', () => {
  const neuf = { plateforme: 'android', dejaFait: false, clesStockage: [], refActive: false };

  it('APK fraîchement installé : oui, une fois', () => {
    expect(doitChercherCodeInstallation(neuf)).toBe(true);
    expect(doitChercherCodeInstallation({ ...neuf, dejaFait: true })).toBe(false);
  });

  it('jamais sur le web ni sur iPhone', () => {
    expect(doitChercherCodeInstallation({ ...neuf, plateforme: 'web' })).toBe(false);
    expect(doitChercherCodeInstallation({ ...neuf, plateforme: 'ios' })).toBe(false);
  });

  it('jamais après une simple mise à jour : compte, données ou session déjà là', () => {
    expect(doitChercherCodeInstallation({ ...neuf, clesStockage: ['bestasolar_user'] })).toBe(false);
    expect(doitChercherCodeInstallation({ ...neuf, clesStockage: ['bestasolar_data'] })).toBe(false);
    expect(doitChercherCodeInstallation({ ...neuf, clesStockage: ['sb-abcd-auth-token'] })).toBe(false);
    // Des réglages sans compte (thème…) ne comptent pas.
    expect(doitChercherCodeInstallation({ ...neuf, clesStockage: ['bestasolar_theme'] })).toBe(true);
  });

  it('jamais quand un code partenaire est déjà retenu', () => {
    expect(doitChercherCodeInstallation({ ...neuf, refActive: true })).toBe(false);
  });
});

describe('code retenu comme un lien suivi', () => {
  let avant;
  beforeEach(() => { avant = globalThis.localStorage; globalThis.localStorage = stockage(); });
  afterEach(() => { globalThis.localStorage = avant; });

  it(`${REF_TTL_DAYS} jours, clic à compter, forme canonique`, () => {
    expect(enregistrerRef(' besta-kodjo-k8r4mz ')).toBe('KODJO-K8R4MZ');
    const r = getActiveRef();
    expect(r).toMatchObject({ code: 'KODJO-K8R4MZ', clickPending: true });
    expect(Math.round((r.expiresAt - Date.now()) / 864e5)).toBe(REF_TTL_DAYS);
  });
});

describe('liens partagés', () => {
  afterEach(() => { delete globalThis.window; });

  it('dans l’application Android, ils pointent vers le site public (pas « localhost »)', () => {
    globalThis.window = { location: { origin: 'https://localhost' }, Capacitor: { isNativePlatform: () => true } };
    expect(partnerLink('KODJO-K8R4MZ')).toBe(`${SITE_PUBLIC}/?ref=KODJO-K8R4MZ`);
    expect(lienInstallationApp('KODJO-K8R4MZ')).toBe(`${SITE_PUBLIC}/telecharger?ref=KODJO-K8R4MZ`);
  });

  it('dans un navigateur, ils gardent l’adresse ouverte (recette, production)', () => {
    globalThis.window = { location: { origin: 'https://recette.example.app' } };
    expect(partnerLink('KODJO-K8R4MZ')).toBe('https://recette.example.app/?ref=KODJO-K8R4MZ');
    expect(lienInstallationApp('KODJO-K8R4MZ')).toBe('https://recette.example.app/telecharger?ref=KODJO-K8R4MZ');
  });

  it('le message WhatsApp porte les deux liens et le code', () => {
    globalThis.window = { location: { origin: SITE_PUBLIC } };
    const m = messageParrainage('KODJO-K8R4MZ');
    expect(m).toContain(`${SITE_PUBLIC}/?ref=KODJO-K8R4MZ`);
    expect(m).toContain(`${SITE_PUBLIC}/telecharger?ref=KODJO-K8R4MZ`);
    expect(m).toMatch(/Code partenaire : KODJO-K8R4MZ$/);
  });
});

describe('aiguillage Vercel de /telecharger', () => {
  it('sans code : droit vers l’APK ; avec code : la page qui le copie', () => {
    const renvoi = vercel.redirects.find((r) => r.source === CHEMIN_TELECHARGEMENT);
    expect(renvoi.destination).toBe(URL_APK);
    expect(renvoi.missing).toEqual([{ type: 'query', key: 'ref' }]);
    const page = vercel.rewrites.find((r) => r.source === CHEMIN_TELECHARGEMENT);
    expect(page).toMatchObject({ has: [{ type: 'query', key: 'ref' }], destination: '/telecharger.html' });
    // Avant la règle « tout vers l'app », qui l'avalerait sinon.
    expect(vercel.rewrites.indexOf(page)).toBe(0);
  });

  it('la page et son script ne sont pas remplacés par l’app', () => {
    const toutVersApp = new RegExp(`^${vercel.rewrites.at(-1).source}$`);
    expect(toutVersApp.test('/telecharger.html')).toBe(false);
    expect(toutVersApp.test('/telecharger.js')).toBe(false);
    expect(toutVersApp.test('/pro/documents')).toBe(true);
  });
});
