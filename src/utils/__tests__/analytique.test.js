// Analytique produit. Le risque n'est pas de rater une statistique : c'est
// que la liste des pages vues devienne l'annuaire des clients d'un installateur.
import { describe, it, expect } from 'vitest';
import {
  EVENEMENTS, evenementValide, cheminNormalise, proprietesSures, construireEvenement, evenementsOuvertureApp,
  hoteAnalytiqueValide, cleProjetValide, estClePersonnelle, problemeAnalytique,
} from '../analytique';

describe('cheminNormalise', () => {
  it('remplace les identifiants par :id', () => {
    expect(cheminNormalise('/clients/c-4f2a-9b3e-0011')).toBe('/clients/:id');
    expect(cheminNormalise('/devis/12')).toBe('/devis/:id');
    expect(cheminNormalise('/plus/formation/8f2c1d4e5a6b7c8d9e0f1a2b')).toBe('/plus/formation/:id');
  });

  it('laisse les vraies routes intactes', () => {
    expect(cheminNormalise('/plus/paiements')).toBe('/plus/paiements');
    expect(cheminNormalise('/boutique')).toBe('/boutique');
    expect(cheminNormalise('/')).toBe('/');
  });

  it('jette les paramètres de requête et les ancres', () => {
    // « ?ref=BESTA-XXXX » identifie un partenaire : hors de question.
    expect(cheminNormalise('/inscription?ref=BESTA-9K2P')).toBe('/inscription');
    expect(cheminNormalise('/devis#etape-3')).toBe('/devis');
  });

  it('supporte une entrée vide', () => {
    expect(cheminNormalise('')).toBe('/');
    expect(cheminNormalise(null)).toBe('/');
  });
});

describe('proprietesSures', () => {
  it('garde nombres et booléens tels quels', () => {
    expect(proprietesSures({ montant: 5000, actif: true })).toEqual({ montant: 5000, actif: true });
  });

  it('NETTOIE les chaînes', () => {
    expect(proprietesSures({ note: 'appeler le +228 90 12 34 56' }))
      .toEqual({ note: 'appeler le [tel]' });
  });

  it('ÉCARTE les objets et tableaux — trop faciles à remplir d’une fiche client', () => {
    const p = proprietesSures({ client: { nom: 'Kossi', tel: '+22890123456' }, lignes: [1, 2], ok: true });
    expect(p).toEqual({ ok: true });
  });

  it('tronque les textes longs et plafonne le nombre de propriétés', () => {
    expect(proprietesSures({ t: 'x'.repeat(200) }).t).toHaveLength(80);
    const beaucoup = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`p${i}`, i]));
    expect(Object.keys(proprietesSures(beaucoup))).toHaveLength(12);
  });

  it('supporte une entrée absente', () => {
    expect(proprietesSures()).toEqual({});
    expect(proprietesSures(null)).toEqual({});
    expect(proprietesSures('texte')).toEqual({});
  });
});

describe('evenementValide', () => {
  it('n’accepte que les noms déclarés', () => {
    expect(evenementValide(EVENEMENTS.DEVIS_CREE)).toBe(true);
    expect(evenementValide('devis_Kossi_Adje')).toBe(false);
    expect(evenementValide('')).toBe(false);
  });
});

describe('construireEvenement', () => {
  it('assemble un événement complet', () => {
    const e = construireEvenement(EVENEMENTS.PAGE_VUE, { chemin: '/devis' },
      { distinctId: 'u1', version: 'abc1234', date: '2026-08-14T10:00:00.000Z' });
    expect(e.event).toBe('page_vue');
    expect(e.distinct_id).toBe('u1');
    expect(e.timestamp).toBe('2026-08-14T10:00:00.000Z');
    expect(e.properties.chemin).toBe('/devis');
    expect(e.properties.version).toBe('abc1234');
  });

  it('REFUSE un nom non déclaré', () => {
    expect(construireEvenement('n_importe_quoi', {}, {})).toBeNull();
  });

  it('reste comptable avant connexion', () => {
    expect(construireEvenement(EVENEMENTS.PAGE_VUE, {}, {}).distinct_id).toBe('anonyme');
  });

  it('avant connexion : l’identifiant anonyme de l’appareil, pour compter les téléphones', () => {
    const e = construireEvenement(EVENEMENTS.APP_OUVERTE, {}, { appareil: 'app-123' });
    expect(e.distinct_id).toBe('app-123');
    expect(e.properties.$device_id).toBe('app-123');
    // Connecté : le compte prime, l'appareil reste en propriété.
    expect(construireEvenement(EVENEMENTS.APP_OUVERTE, {}, { distinctId: 'u1', appareil: 'app-123' }).distinct_id).toBe('u1');
  });

  it('plateforme et build sur chaque événement', () => {
    const app = construireEvenement(EVENEMENTS.PAGE_VUE, { chemin: '/devis' }, { plateforme: 'android', build: 195 });
    expect(app.properties).toMatchObject({ plateforme: 'android', build: 195 });
    const web = construireEvenement(EVENEMENTS.PAGE_VUE, {}, {});
    expect(web.properties.plateforme).toBe('web');
    expect('build' in web.properties).toBe(false);
  });

  it('nettoie les propriétés au passage', () => {
    const e = construireEvenement(EVENEMENTS.DEVIS_CREE, { note: 'client kossi@exemple.tg' }, {});
    expect(e.properties.note).toBe('client [email]');
  });
});

// La panne réellement rencontrée : les deux variables Vercel interverties.
// L'hôte n'étant plus une URL absolue, le navigateur poste sur notre propre
// serveur, qui répond « 405 » — un message qui n'accuse ni la clé ni la région.
describe('problemeAnalytique', () => {
  const CLE_OK = 'phc_' + 'a'.repeat(40);

  it('accepte une configuration correcte', () => {
    expect(problemeAnalytique({ cle: CLE_OK, hote: 'https://us.i.posthog.com' })).toBeNull();
    expect(problemeAnalytique({ cle: CLE_OK, hote: 'https://eu.i.posthog.com/' })).toBeNull();
  });

  it('détecte les variables inversées et le dit', () => {
    const msg = problemeAnalytique({ cle: CLE_OK, hote: 'phx_zYK27qrKJq7KJ3F76XuBair6Ffq' });
    expect(msg).toMatch(/inversées/);
    expect(msg).toMatch(/VITE_POSTHOG_HOST/);
  });

  it('ne recopie jamais la valeur fautive dans le message', () => {
    const secret = 'phx_zYK27qrKJq7KJ3F76XuBair6Ffq';
    expect(problemeAnalytique({ cle: secret, hote: secret })).not.toContain(secret);
    expect(problemeAnalytique({ cle: CLE_OK, hote: secret })).not.toContain(secret);
  });

  it('refuse un hôte relatif ou non https', () => {
    expect(problemeAnalytique({ cle: CLE_OK, hote: 'us.i.posthog.com' })).toMatch(/adresse valide/);
    expect(problemeAnalytique({ cle: CLE_OK, hote: 'http://us.i.posthog.com' })).toMatch(/adresse valide/);
    expect(problemeAnalytique({ cle: CLE_OK, hote: '' })).toMatch(/adresse valide/);
  });

  it('refuse une clé personnelle — c’est un mot de passe dans le bundle', () => {
    const msg = problemeAnalytique({ cle: 'phx_zYK27qrKJq7KJ3F76XuBair6Ffq', hote: 'https://us.i.posthog.com' });
    expect(msg).toMatch(/PERSONNELLE/);
    expect(msg).toMatch(/révoquer/);
  });

  it('signale une clé qui n’est pas une clé de projet', () => {
    expect(problemeAnalytique({ cle: 'abc123', hote: 'https://us.i.posthog.com' })).toMatch(/phc_/);
  });
});

describe('validation des valeurs analytiques', () => {
  it('hoteAnalytiqueValide', () => {
    expect(hoteAnalytiqueValide('https://eu.i.posthog.com')).toBe(true);
    expect(hoteAnalytiqueValide('https://analytics.bestasolar.com:8443')).toBe(true);
    expect(hoteAnalytiqueValide('https://posthog')).toBe(false);   // pas de domaine
    expect(hoteAnalytiqueValide('phc_abc')).toBe(false);
    expect(hoteAnalytiqueValide(null)).toBe(false);
  });

  it('distingue clé de projet et clé personnelle', () => {
    expect(cleProjetValide('phc_' + 'x'.repeat(40))).toBe(true);
    expect(cleProjetValide('phc_court')).toBe(false);
    expect(estClePersonnelle('phx_abcdef')).toBe(true);
    expect(estClePersonnelle('phc_abcdef')).toBe(false);
  });
});

describe('ouverture de l’application Android', () => {
  const noms = (l) => l.map((e) => e.nom);
  it('première ouverture : installée, puis ouverte', () => {
    expect(noms(evenementsOuvertureApp(195, null))).toEqual(['app_installee', 'app_ouverte']);
  });
  it('nouvelle version : mise à jour, depuis quel build', () => {
    const l = evenementsOuvertureApp(195, '192');
    expect(noms(l)).toEqual(['app_mise_a_jour', 'app_ouverte']);
    expect(l[0].props).toEqual({ depuis_build: 192 });
  });
  it('même version : seulement ouverte ; sur le web : rien', () => {
    expect(noms(evenementsOuvertureApp(195, '195'))).toEqual(['app_ouverte']);
    expect(evenementsOuvertureApp(null, null)).toEqual([]);
  });
});
