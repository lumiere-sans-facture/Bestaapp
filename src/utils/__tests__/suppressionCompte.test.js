import { describe, it, expect } from 'vitest';
import {
  clesAPurger, poserConsignePurge, executerConsignePurge, CLE_CONSIGNE_PURGE,
  confirmationValide, messageRefusSuppression, MESSAGES_REFUS_SUPPRESSION,
} from '../suppressionCompte';

// Stockage en mémoire, même interface que localStorage.
const stockage = (initial = {}) => {
  const m = new Map(Object.entries(initial));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    cles: () => [...m.keys()].sort(),
  };
};

describe('clesAPurger', () => {
  const cles = [
    'bestasolar_data_org-a', 'bestasolar_file_sync_org-a', 'bestasolar_data_org-b',
    'bestasolar_user', 'bestasolar_profil', 'bestasolar_mode_p1', 'bestasolar_mode_p2',
    'bestasolar_guide_accueil_v2:p1', 'bestasolar_guide_accueil_v2:p2',
    'bestasolar_theme', 'bestasolar_ref', 'autre_cle',
    'sb-abcd-auth-token', 'bestasolar_cart_org-a', 'bestasolar_cart_org-b',
  ];
  it('efface le compte et son entreprise, rien d’autre', () => {
    expect(clesAPurger(cles, { scope: 'org-a', userId: 'p1' }).sort()).toEqual([
      'bestasolar_cart_org-a', 'bestasolar_data_org-a', 'bestasolar_file_sync_org-a',
      'bestasolar_guide_accueil_v2:p1', 'bestasolar_mode_p1', 'bestasolar_profil', 'bestasolar_user',
      'sb-abcd-auth-token',
    ]);
  });
  it('laisse les données d’une autre entreprise (envois peut-être en attente)', () => {
    expect(clesAPurger(cles, { scope: 'org-a', userId: 'p1' })).not.toContain('bestasolar_data_org-b');
  });
  it('sans scope ni compte : seules les clés personnelles partent', () => {
    expect(clesAPurger(cles, {}).sort()).toEqual(['bestasolar_profil', 'bestasolar_user', 'sb-abcd-auth-token']);
  });
  it('efface toujours le jeton de session : sinon l’app rouvrirait le compte supprimé', () => {
    expect(clesAPurger(['sb-projet-auth-token', 'sb-autre'], {})).toEqual(['sb-projet-auth-token']);
  });
});

describe('consigne de purge', () => {
  it('est exécutée une fois, au démarrage suivant', () => {
    const s = stockage({ bestasolar_data_org_a: '{}', 'bestasolar_data_org-a': '{"leads":[1]}', bestasolar_user: '{}', bestasolar_theme: 'dark' });
    poserConsignePurge({ scope: 'org-a', userId: 'p1' }, s);
    expect(s.getItem(CLE_CONSIGNE_PURGE)).toBeTruthy();
    expect(executerConsignePurge(s)).toBe(2);
    expect(s.cles()).toEqual(['bestasolar_data_org_a', 'bestasolar_theme']);
    expect(executerConsignePurge(s)).toBe(0);
  });
  it('sans consigne : ne touche à rien', () => {
    const s = stockage({ bestasolar_user: '{}' });
    expect(executerConsignePurge(s)).toBe(0);
    expect(s.cles()).toEqual(['bestasolar_user']);
  });
  it('une consigne illisible ne fait pas planter le démarrage', () => {
    const s = stockage({ [CLE_CONSIGNE_PURGE]: '{pas du json' });
    expect(() => executerConsignePurge(s)).not.toThrow();
  });
});

describe('confirmation et messages', () => {
  it('exige le mot exact, sans tenir compte de la casse ni des espaces', () => {
    expect(confirmationValide(' supprimer ')).toBe(true);
    expect(confirmationValide('SUPPRIME')).toBe(false);
    expect(confirmationValide('')).toBe(false);
  });
  it('chaque refus du serveur a son message ; l’inconnu retombe sur « réseau »', () => {
    for (const r of ['admin', 'gerant', 'interne', 'session']) expect(messageRefusSuppression(r)).toBe(MESSAGES_REFUS_SUPPRESSION[r]);
    expect(messageRefusSuppression('autre')).toBe(MESSAGES_REFUS_SUPPRESSION.reseau);
  });
});
