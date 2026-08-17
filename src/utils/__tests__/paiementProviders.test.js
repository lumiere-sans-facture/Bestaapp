// Configuration des agrégateurs de paiement.
// L'enjeu de ces tests n'est pas l'ergonomie : c'est qu'une clé secrète ne
// puisse pas être enregistrée dans une donnée répliquée.
import { describe, it, expect } from 'vitest';
import {
  PROVIDERS, providerById, ressembleAUnSecret, problemeConfig, masquerCle,
  configActive, champConfig,
} from '../paiementProviders';

const kkiapay = (champs, reste = {}) => ({ provider: 'kkiapay', mode: 'test', champs, ...reste });

describe('catalogue des agrégateurs', () => {
  it('déclare pour chacun ses champs publics et ses secrets serveur', () => {
    for (const p of PROVIDERS) {
      expect(p.champs.length).toBeGreaterThan(0);
      expect(p.secrets.length).toBeGreaterThan(0);
      // Aucun secret ne doit être déclaré comme champ saisissable.
      const cles = p.champs.map((c) => c.cle.toLowerCase());
      expect(cles.some((c) => c.includes('secret') || c.includes('private'))).toBe(false);
    }
  });

  it('n’annonce « prêt » que pour l’encaissement réellement branché', () => {
    expect(providerById('kkiapay').pret).toBe(true);
    expect(providerById('cinetpay').pret).toBe(false);
    expect(providerById('fedapay').pret).toBe(false);
    expect(providerById('inconnu')).toBeNull();
  });
});

describe('ressembleAUnSecret', () => {
  it('repère les formes usuelles de clé secrète', () => {
    expect(ressembleAUnSecret('sk_live_51H8kQ')).toBe(true);
    expect(ressembleAUnSecret('wsk_test_abc')).toBe(true);
    expect(ressembleAUnSecret('ma_clef_secrete')).toBe(true);
    expect(ressembleAUnSecret('KKIAPAY_PRIVATE_KEY')).toBe(true);
  });

  it('laisse passer une clé publique', () => {
    expect(ressembleAUnSecret('pk_live_51H8kQ')).toBe(false);
    expect(ressembleAUnSecret('1a2b3c4d-5e6f-7890-abcd-ef1234567890')).toBe(false);
    expect(ressembleAUnSecret('')).toBe(false);
  });
});

describe('problemeConfig', () => {
  it('exige un agrégateur et ses champs', () => {
    expect(problemeConfig({})).toMatch(/Choisissez un agrégateur/);
    expect(problemeConfig(kkiapay({}))).toMatch(/Clé publique/);
  });

  it('REFUSE une clé secrète collée dans le champ public', () => {
    expect(problemeConfig(kkiapay({ publicKey: 'sk_live_ABCDEF' }))).toMatch(/SECRÈTE/);
  });

  it('exige un mode explicite', () => {
    expect(problemeConfig(kkiapay({ publicKey: 'pk_1' }, { mode: '' }))).toMatch(/test ou réel/);
  });

  it('accepte une configuration saine', () => {
    expect(problemeConfig(kkiapay({ publicKey: 'pk_test_123' }))).toBeNull();
    expect(problemeConfig({ provider: 'cinetpay', mode: 'live', champs: { siteId: '5872314' } })).toBeNull();
  });
});

describe('masquerCle', () => {
  it('laisse deviner la clé sans l’étaler', () => {
    expect(masquerCle('1a2b3c4d-5e6f-7890')).toBe('1a2b…7890');
    expect(masquerCle('court')).toBe('court');
    expect(masquerCle('')).toBe('');
  });
});

describe('configActive', () => {
  it('ne retient que l’entrée activée', () => {
    const configs = [
      { id: 'a', provider: 'kkiapay', actif: false, majLe: '2026-08-13T10:00:00Z' },
      { id: 'b', provider: 'fedapay', actif: true, majLe: '2026-08-12T10:00:00Z' },
    ];
    expect(configActive(configs).id).toBe('b');
  });

  it('départage deux entrées actives par la plus récente', () => {
    const configs = [
      { id: 'a', actif: true, majLe: '2026-08-11T10:00:00Z' },
      { id: 'b', actif: true, majLe: '2026-08-13T10:00:00Z' },
    ];
    expect(configActive(configs).id).toBe('b');
  });

  it('rend null quand rien n’est activé', () => {
    expect(configActive([{ id: 'a', actif: false }])).toBeNull();
    expect(configActive([])).toBeNull();
    expect(configActive()).toBeNull();
  });
});

describe('champConfig', () => {
  it('lit un champ public, vide par défaut', () => {
    expect(champConfig({ champs: { publicKey: ' pk_1 ' } }, 'publicKey')).toBe('pk_1');
    expect(champConfig(null, 'publicKey')).toBe('');
  });
});
