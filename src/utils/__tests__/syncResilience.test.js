// Résilience de la réplication : une donnée dont l'envoi échoue ne doit JAMAIS
// être considérée comme synchronisée — sinon elle est perdue en silence.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Double minimal de Supabase : on choisit quelles tables échouent ou manquent.
const state = { echoue: new Set(), absentes: new Set(), pushes: [], deletes: [], rows: {}, avantUpsert: null };
vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (table) => ({
      select: () => Promise.resolve({ data: state.rows[table] || [], error: null }),
      upsert: (rows) => {
        if (state.avantUpsert && state.avantUpsert(table)) return Promise.reject(new TypeError('Failed to fetch'));
        if (state.absentes.has(table)) return Promise.resolve({ error: { code: '42P01', message: `relation "public.${table}" does not exist` } });
        if (state.echoue.has(table)) return Promise.resolve({ error: { message: 'réseau' } });
        state.pushes.push({ table, rows });
        return Promise.resolve({ error: null });
      },
      delete: () => ({ eq: (_col, val) => { state.deletes.push({ table, id: val }); return Promise.resolve({ error: null }); } }),
    }),
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
    rpc: () => Promise.resolve({ data: null, error: null }),
  },
}));

const { pushCollections, pushTombstone, pullAll, setSyncOrg, decouperEnLots } = await import('../../lib/remoteSync');

beforeEach(() => {
  state.echoue.clear(); state.absentes.clear();
  state.pushes = []; state.deletes = []; state.rows = {}; state.avantUpsert = null;
  setSyncOrg(null); // mode mono-équipe par défaut
});

describe('pushCollections signale les échecs au lieu de les avaler', () => {
  it('rejette quand le serveur refuse une écriture', async () => {
    state.echoue.add('leads');
    await expect(pushCollections({ leads: [{ id: 'l1', name: 'X' }] })).rejects.toBeTruthy();
  });

  it('retourne les tables répliquées quand tout passe', async () => {
    await expect(pushCollections({ leads: [{ id: 'l1', name: 'X' }] })).resolves.toEqual(['leads']);
  });

  it('une collection vide n’émet aucune écriture', async () => {
    await pushCollections({ leads: [] });
    expect(state.pushes).toHaveLength(0);
  });

  it('une table en échec n’annule PAS les tables déjà passées', async () => {
    state.echoue.add('partners');
    try {
      await pushCollections({
        leads: [{ id: 'l1' }],
        partners: [{ id: 'p1' }],
        devis: [{ id: 'd1' }],
      });
      throw new Error('aurait dû échouer');
    } catch (e) {
      // Le bénéfice des tables réussies est conservé pour la reprise.
      expect(e.reussies).toContain('leads');
      expect(e.reussies).toContain('devis');
      expect(e.reussies).not.toContain('partners');
      expect(e.message).toMatch(/partners/);
    }
  });

  it('réessaie avant d’abandonner (micro-coupure réseau)', async () => {
    // La table échoue aux deux premiers essais, réussit au troisième.
    let n = 0;
    state.avantUpsert = (table) => { n += 1; return n < 3 && table === 'leads'; };
    await expect(pushCollections({ leads: [{ id: 'l1' }] })).resolves.toEqual(['leads']);
    expect(n).toBeGreaterThanOrEqual(3);
    state.avantUpsert = null;
  });

  it('une table absente du schéma distant est sautée ET comptée traitée', async () => {
    // Schéma distant en retard d'une mise à jour : la collection existe côté
    // client mais pas côté serveur. Ni erreur, ni renvoi en boucle.
    state.absentes.add('factures');
    await expect(pushCollections({ factures: [{ id: 'f1' }], proClients: [{ id: 'c1' }] }))
      .resolves.toEqual(expect.arrayContaining(['factures', 'proClients']));
    // Mémorisée absente : plus aucune tentative d'envoi ensuite.
    state.absentes.delete('factures');
    state.pushes = [];
    await pushCollections({ factures: [{ id: 'f1' }] });
    expect(state.pushes).toHaveLength(0);
  });
});

describe('pushTombstone — une table tombstones manquante ne bloque plus tout', () => {
  it('erreur réseau sur tombstones : signalée, la suppression n’est pas perdue en silence', async () => {
    state.echoue.add('tombstones');
    await expect(pushTombstone('leads', 'l9')).rejects.toBeTruthy();
  });

  it('table tombstones absente : pas d’erreur, la ligne source est quand même supprimée', async () => {
    // C'est le scénario « bloc tombstones de schema.sql jamais exécuté » :
    // avant, la première suppression locale rendait la réplication rouge
    // en permanence — plus rien ne montait, sur cet appareil uniquement.
    state.absentes.add('tombstones');
    await expect(pushTombstone('leads', 'l1')).resolves.toBeUndefined();
    expect(state.deletes).toContainEqual({ table: 'leads', id: 'l1' });
  });

  it('…et les suppressions suivantes n’essaient même plus l’upsert tombstones', async () => {
    await pushTombstone('leads', 'l2');
    expect(state.pushes.filter((p) => p.table === 'tombstones')).toHaveLength(0);
    expect(state.deletes).toContainEqual({ table: 'leads', id: 'l2' });
  });
});

// Régression : l'admin plateforme LIT les abonnements de toutes les
// organisations (policies « subs read » / « subpay read »). Ces lignes
// entraient dans son état local, repartaient sous SON org_id, puis revenaient
// en double au pull suivant — la clé primaire étant (org_id, id). Deux lignes
// de même clé dans un envoi = lot rejeté en bloc par Postgres, en boucle.
describe('pullAll — les lignes des autres organisations restent dehors', () => {
  it('ne garde que les lignes de MON organisation', async () => {
    setSyncOrg('org-moi', 'pro');
    state.rows.subscriptionPayments = [
      { id: 'pay1', org_id: 'org-moi', data: { statut: 'initie' } },
      { id: 'pay2', org_id: 'org-autre', data: { statut: 'initie' } },
    ];
    const { collections } = await pullAll();
    expect(collections.subscriptionPayments.map((p) => p.id)).toEqual(['pay1']);
  });

  it('une ligne déjà dupliquée entre organisations n’arrive qu’une fois', async () => {
    setSyncOrg('org-moi', 'pro');
    state.rows.subscriptionPayments = [
      { id: 'pay1', org_id: 'org-autre', data: { statut: 'initie' } },
      { id: 'pay1', org_id: 'org-moi', data: { statut: 'initie' } },
    ];
    const { collections } = await pullAll();
    expect(collections.subscriptionPayments).toHaveLength(1);
  });

  it('le catalogue partagé BestaSolar reste lisible malgré le filtrage', async () => {
    setSyncOrg('org-moi', 'pro');
    state.rows.products = [
      { id: 'cat1', org_id: 'org-bestasolar', data: { name: 'Panneau officiel' } },
      { id: 'cat1', org_id: 'org-moi', data: { name: 'Copie historique' } },
      { id: 'perso1', org_id: 'org-moi', data: { name: 'Mon produit' } },
    ];
    const { collections } = await pullAll();
    const ids = collections.products.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['cat1', 'perso1']));
    // La ligne BestaSolar prime sur la copie locale (source de vérité).
    expect(collections.products.find((p) => p.id === 'cat1').name).toBe('Panneau officiel');
  });

  it('mode mono-équipe (sans organisation) : aucun filtrage, rien n’est perdu', async () => {
    state.rows.leads = [{ id: 'l1', data: { name: 'A' } }, { id: 'l2', data: { name: 'B' } }];
    const { collections } = await pullAll();
    expect(collections.leads.map((l) => l.id)).toEqual(['l1', 'l2']);
  });
});

// Catalogue de formation BestaSolar : partagé EN LECTURE à toutes les
// entreprises, y compris celles nées d'une inscription par code partenaire.
describe('cours partagés — reçus de l’organisation interne, jamais réémis', () => {
  it('les cours de l’org interne arrivent marqués « partage »', async () => {
    setSyncOrg('org-affilie', 'pro');
    state.rows.formations = [
      { id: 'f1', org_id: 'org-bestasolar', data: { title: 'Devenir installateur' } },
      { id: 'perso', org_id: 'org-affilie', data: { title: 'Mon cours maison' } },
    ];
    const { collections } = await pullAll();
    const partage = collections.formations.find((f) => f.id === 'f1');
    const mien = collections.formations.find((f) => f.id === 'perso');
    expect(partage.partage).toBe(true);
    expect(mien.partage).toBeUndefined();
  });

  it('la version BestaSolar prime sur une copie locale de même id', async () => {
    // Chaque entreprise est dotée des mêmes cours au départ (mêmes ids) :
    // sans arbitrage, le contenu enrichi par BestaSolar n'arriverait jamais.
    setSyncOrg('org-affilie', 'pro');
    state.rows.formations = [
      { id: 'f1', org_id: 'org-affilie', data: { title: 'Copie de départ' } },
      { id: 'f1', org_id: 'org-bestasolar', data: { title: 'Version enrichie' } },
    ];
    const { collections } = await pullAll();
    expect(collections.formations).toHaveLength(1);
    expect(collections.formations[0].title).toBe('Version enrichie');
  });

  it('un cours partagé n’est jamais repoussé sous notre organisation', async () => {
    setSyncOrg('org-affilie', 'pro');
    await pushCollections({
      formations: [
        { id: 'f1', title: 'Version BestaSolar', partage: true },
        { id: 'perso', title: 'Mon cours maison' },
      ],
    });
    const envoi = state.pushes.find((p) => p.table === 'formations');
    expect(envoi.rows).toHaveLength(1);
    expect(envoi.rows[0].id).toBe('perso');
  });

  it('l’organisation interne, elle, reste propriétaire de ses cours', async () => {
    setSyncOrg('org-bestasolar', 'interne');
    state.rows.formations = [{ id: 'f1', org_id: 'org-bestasolar', data: { title: 'Mon catalogue' } }];
    const { collections } = await pullAll();
    expect(collections.formations[0].partage).toBeUndefined();
  });

  it('les autres tables ne partagent rien : l’isolation reste stricte', async () => {
    setSyncOrg('org-affilie', 'pro');
    state.rows.leads = [
      { id: 'l1', org_id: 'org-affilie', data: { name: 'Mon client' } },
      { id: 'l2', org_id: 'org-bestasolar', data: { name: 'Client d’une autre entreprise' } },
    ];
    const { collections } = await pullAll();
    expect(collections.leads.map((l) => l.id)).toEqual(['l1']);
  });
});

describe('pushCollections — un doublon local ne bloque plus l’envoi', () => {
  it('n’envoie qu’une seule ligne par id', async () => {
    await pushCollections({
      subscriptionPayments: [
        { id: 'pay1', statut: 'initie', montant: 5000 },
        { id: 'pay1', statut: 'initie', montant: 5000 },
      ],
    });
    const envoi = state.pushes.find((p) => p.table === 'subscriptionPayments');
    expect(envoi.rows).toHaveLength(1);
  });
});

describe('decouperEnLots — un gros catalogue ne bloque plus la synchronisation', () => {
  it('un petit ensemble tient dans un seul envoi', () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    expect(decouperEnLots(rows, 10000)).toHaveLength(1);
  });

  it('découpe dès que le poids dépasse la limite', () => {
    // 10 lignes d'environ 1 Ko, limite à 3 Ko → au moins 4 lots.
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, data: 'x'.repeat(1000) }));
    const lots = decouperEnLots(rows, 3000);
    expect(lots.length).toBeGreaterThanOrEqual(4);
    expect(lots.flat()).toHaveLength(10); // rien n'est perdu
  });

  it('une ligne plus lourde que la limite part seule, jamais ignorée', () => {
    const rows = [{ id: 'photo', data: 'x'.repeat(50000) }, { id: 'b' }];
    const lots = decouperEnLots(rows, 1000);
    expect(lots[0]).toHaveLength(1);
    expect(lots.flat()).toHaveLength(2);
  });

  it('préserve l’ordre des lignes', () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, data: 'y'.repeat(500) }));
    expect(decouperEnLots(rows, 1200).flat().map((r) => r.id))
      .toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5']);
  });

  it('ensemble vide : aucun envoi', () => {
    expect(decouperEnLots([], 1000)).toHaveLength(0);
  });
});
