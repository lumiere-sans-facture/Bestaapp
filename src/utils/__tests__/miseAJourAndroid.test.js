import { describe, it, expect } from 'vitest';
import { buildDeEtiquette, lireRelease, miseAJourDisponible, tailleLisible, totalTelechargements } from '../miseAJourAndroid';
import { URL_APK, CHEMIN_TELECHARGEMENT, URL_TELECHARGEMENT } from '../../config/android';
import vercel from '../../../vercel.json';

const RELEASE = {
  tag_name: 'android-245', name: 'BestaSolar Android 1.1.0 (build 245)', published_at: '2026-10-07T16:00:00Z',
  assets: [{ name: 'BestaSolar.apk', size: 8_808_038 }],
};

describe('APK Android : versions et mises à jour', () => {
  it('lit le build dans l’étiquette', () => {
    expect(buildDeEtiquette('android-245')).toBe(245);
    expect(buildDeEtiquette('v1.1.0')).toBeNull();
    expect(buildDeEtiquette('android-')).toBeNull();
  });

  it('retient build, version, taille et date de la Release', () => {
    expect(lireRelease(RELEASE)).toEqual({ build: 245, version: '1.1.0', tailleOctets: 8_808_038, date: '2026-10-07T16:00:00Z' });
    expect(lireRelease({ ...RELEASE, assets: [] })).toBeNull();
    expect(lireRelease({ ...RELEASE, tag_name: 'v1' })).toBeNull();
  });

  it('mise à jour seulement si le build publié est plus récent', () => {
    const r = lireRelease(RELEASE);
    expect(miseAJourDisponible(244, r)).toBe(true);
    expect(miseAJourDisponible(245, r)).toBe(false);
    expect(miseAJourDisponible(undefined, r)).toBe(false); // version web : rien à proposer
    expect(miseAJourDisponible(244, null)).toBe(false);
  });

  it('taille lisible et adresse fixe de téléchargement', () => {
    expect(tailleLisible(8_808_038)).toBe('8,4 Mo');
    expect(tailleLisible(0)).toBe('');
    expect(URL_APK).toBe('https://github.com/lumiere-sans-facture/Bestaapp/releases/latest/download/BestaSolar.apk');
  });

  it('lien public sur notre domaine, que Vercel redirige vers le dernier APK', () => {
    expect(URL_TELECHARGEMENT).toBe('https://app.bestasolar.com/telecharger');
    // Le lien de la page d'accueil et la règle Vercel doivent rester d'accord :
    // un chemin renommé d'un côté seulement donnerait un bouton mort.
    const regle = (vercel.redirects || []).find((r) => r.source === CHEMIN_TELECHARGEMENT);
    expect(regle?.destination).toBe(URL_APK);
    expect(regle?.permanent).toBe(false); // jamais mise en cache à vie par les navigateurs
  });
});

describe('téléchargements de l’APK', () => {
  it('additionne toutes les versions Android, et seulement l’APK', () => {
    const releases = [
      { tag_name: 'android-192', assets: [{ name: 'BestaSolar.apk', download_count: 5 }] },
      { tag_name: 'android-191', assets: [{ name: 'BestaSolar.apk', download_count: 1 }, { name: 'notes.txt', download_count: 40 }] },
      { tag_name: 'v1.0.0', assets: [{ name: 'BestaSolar.apk', download_count: 99 }] },
    ];
    expect(totalTelechargements(releases)).toBe(6);
    expect(totalTelechargements([])).toBe(0);
  });
});
