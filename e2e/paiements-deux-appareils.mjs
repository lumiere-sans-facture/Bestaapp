/* Deux appareils encaissent la même facture : aucun paiement ne se perd.
   Chaque paiement est une fiche à part (table `facturePaiements`) : le
   téléphone envoie la sienne, l'ordinateur — resté sur une copie d'avant —
   envoie la sienne, et les deux restent sur le serveur. Une suppression part
   en pierre tombale, sans toucher au paiement de l'autre appareil.
   Montants de l'exemple de référence (66 876 000 F), noms fictifs.

   Puis une base restée en arrière (migration 20261021 pas encore passée) :
   la table manque, l'encaissement reste enregistré sur l'appareil et le
   reste de la synchronisation continue.

   Lancer avec un Supabase simulé :
     VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=x npm run dev */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const UID = '00000000-0000-0000-0000-000000000001';
const P = { id: 'p1', email: 'gerant@x.tg', name: 'Kofi Gérant', role: 'gerant', org_id: 'org-1', phone: '', avatar: 'KG', is_platform_admin: false };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); const exp = Math.floor(Date.now() / 1000) + 86400;
const JETON = `${b64({ alg: 'HS256' })}.${b64({ email: P.email, exp, sub: UID })}.x`;
const NUMERO = 'FAC-2026-016';
const sansEspaces = (t) => t.replace(/[\s  ]+/g, ' ');
const jour = (decalage) => {
  const d = new Date(); d.setDate(d.getDate() + decalage);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const ligne = (data) => ({ id: data.id, org_id: 'org-1', data });
const maintenant = new Date().toISOString();

/** Le serveur : abonnement Pro actif, une facture à trois échéances, aucun paiement. */
const base = () => ({
  subscriptions: new Map([['sub-p1', ligne({ id: 'sub-p1', userId: 'p1', status: 'actif', formule: 'essentiel', dateDebut: maintenant, dateFin: new Date(Date.now() + 30 * 864e5).toISOString() })]]),
  companies: new Map([['comp-p1', ligne({ id: 'comp-p1', userId: 'p1', nomEntreprise: 'Lumière Sans Facture', pays: 'tg', facturePrefix: 'FAC', factureCounter: 16 })]]),
  factures: new Map([['f1', ligne({
    id: 'f1', userId: 'p1', numero: NUMERO, clientName: 'Client Démo SARL', clientPhone: '', statut: 'emise', createdAt: maintenant,
    lignes: [{ designation: 'Centrale solaire hybride', qty: 1, pu: 66876000 }], tvaActive: false, totalHT: 66876000, tva: 0, totalTTC: 66876000,
    echeancier: [
      { id: 'e1', libelle: 'Acompte', type: 'date', date: jour(-10), montant: 11000000 },
      { id: 'e2', libelle: 'Complément d’acompte', type: 'periode', date: jour(-2), dateFin: jour(2), montant: 30000000 },
      { id: 'e3', libelle: 'Solde', type: 'condition', condition: 'À la mise en service', montant: 25876000 },
    ],
  })]]),
  facturePaiements: new Map(),
  partners: new Map([['p-user-p1', ligne({ id: 'p-user-p1', userId: 'p1', name: 'Kofi Gérant', code: 'KOFI-ABC123', status: 'actif' })]]),
});

/** Un navigateur branché sur `db` ; `sansTable` : tables absentes du serveur. */
const appareil = async (db, envois, sansTable = []) => {
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem('bestasolar_mode_p1', 'pro'));
await ctx.route('**/api/erreur**', (route) => route.fulfill({ status: 204, body: '' }));
await ctx.route('http://127.0.0.1:54321/**', async (route) => {
  const req = route.request(); const url = new URL(req.url()); const c = url.pathname;
  const json = (b, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
  const unique = (req.headers().accept || '').includes('vnd.pgrst.object');
  if (c === '/auth/v1/token') return json({ access_token: JETON, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: { id: UID, email: P.email, aud: 'authenticated', app_metadata: {}, user_metadata: {} } });
  if (c.startsWith('/auth/v1/user')) return json({ id: UID, email: P.email });
  if (c === '/rest/v1/profiles') return json(unique ? P : [P]);
  if (c === '/rest/v1/orgs') { const o = { id: 'org-1', name: 'BestaSolar', kind: 'interne' }; return json(unique ? o : [o]); }
  if (c.startsWith('/functions/') || c.startsWith('/rest/v1/rpc/')) return json(null);
  const table = decodeURIComponent(c.replace('/rest/v1/', ''));
  if (sansTable.includes(table)) return json({ code: 'PGRST205', message: `Could not find the table 'public.${table}' in the schema cache` }, 404);
  const lignes = db[table] || (db[table] = new Map());
  if (req.method() === 'GET') {
    const ids = (url.searchParams.get('id') || '').replace(/^in\.\(|\)$/g, '').split(',').filter(Boolean);
    const rows = [...lignes.values()].filter((l) => !ids.length || ids.includes(l.id));
    return json(table === 'tombstones' ? rows.map((l) => l.data) : rows);
  }
  if (req.method() === 'POST') {
    const corps = JSON.parse(req.postData() || '[]');
    const rows = Array.isArray(corps) ? corps : [corps];
    for (const r of rows) lignes.set(r.id, { id: r.id, org_id: r.org_id, data: r.data ?? r });
    envois.push({ table, ids: rows.map((r) => r.id), t: Date.now() });
    return route.fulfill({ status: 201, body: '' });
  }
  if (req.method() === 'DELETE') {
    const id = (url.searchParams.get('id') || '').replace(/^eq\./, '');
    lignes.delete(id);
    return route.fulfill({ status: 204, body: '' });
  }
  return json([]);
});

const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
await page.goto(B + '/login'); await page.waitForSelector('.login-form');
await page.fill('input[type="email"]', P.email);
await page.fill('input[type="password"]', 'motdepasse123');
await page.click('button[type="submit"]');
await page.locator('.sidebar').waitFor({ timeout: 30000 });
return { ctx, page };
};

let db = base(); let envois = [];
let { ctx, page } = await appareil(db, envois);
const ouvrirPaiements = async () => {
  // Juste après la connexion, l'abonnement n'est pas encore relu : l'espace
  // Pro n'est pas ouvert et l'adresse renvoie au tableau de bord. On réessaie.
  const onglet = page.getByRole('button', { name: /Factures \(1\)/ });
  for (let essai = 0; essai < 4; essai += 1) {
    await page.goto(B + '/pro/documents');
    if (await onglet.waitFor({ timeout: 8000 }).then(() => true, () => false)) break;
    await page.waitForTimeout(1500);
  }
  await onglet.click({ timeout: 15000 });
  await page.locator('.flat-row', { hasText: NUMERO }).click();
  await page.getByRole('button', { name: /Enregistrer un paiement|Voir les paiements/ }).click();
  await page.locator('.pay-echeance-row').first().waitFor();
};
await ouvrirPaiements();
const dialogue = () => page.locator('[role="dialog"]:visible').last();
ok(/Reste à payer 66 876 000 F/.test(sansEspaces(await dialogue().innerText())), 'l’ordinateur ouvre la facture : rien de payé');

// Le téléphone encaisse un premier versement pendant que l'ordinateur a la fiche ouverte.
db.facturePaiements.set('p-tel', ligne({
  id: 'p-tel', factureId: 'f1', userId: 'p1', montant: 8000000, date: jour(-1), mode: 'momo', operateur: 'Flooz',
  reference: 'TEL-1', note: '', createdAt: maintenant, majLe: maintenant,
}));

// L'ordinateur, sur sa copie d'avant, encaisse l'acompte.
const depuis = Date.now();
await dialogue().getByLabel('Montant reçu (F CFA) *').fill('11000000');
await dialogue().getByLabel('Mode').selectOption('virement');
await dialogue().getByLabel('Référence (facultatif)').fill('ORDI-1');
await dialogue().getByRole('button', { name: 'Enregistrer le paiement' }).click();
const fin = Date.now() + 15000;
while (Date.now() < fin && !envois.some((e) => e.table === 'facturePaiements' && e.t > depuis)) await page.waitForTimeout(250);
const partis = envois.filter((e) => e.table === 'facturePaiements' && e.t > depuis).flatMap((e) => e.ids);
ok(partis.length === 1 && partis[0] !== 'p-tel', `l’ordinateur n’envoie que SON paiement (${partis.length} fiche)`);
await page.waitForTimeout(800);
const serveur = [...db.facturePaiements.values()].map((l) => l.data);
ok(serveur.length === 2 && serveur.some((p) => p.id === 'p-tel' && p.montant === 8000000) && serveur.some((p) => p.reference === 'ORDI-1' && p.montant === 11000000),
  `serveur : les deux paiements y sont (${serveur.map((p) => p.montant).join(' + ')})`);

// Rechargé, l'ordinateur voit les deux encaissements.
await page.reload();
await page.locator('.sidebar').waitFor({ timeout: 30000 });
await ouvrirPaiements();
await page.waitForFunction(() => document.querySelectorAll('[role="dialog"] .pay-history-item').length === 2, null, { timeout: 15000 }).catch(() => {});
let texte = sansEspaces(await dialogue().innerText());
ok(await dialogue().locator('.pay-history-item').count() === 2 && /TEL-1/.test(texte) && /ORDI-1/.test(texte), 'l’ordinateur liste les deux paiements');
ok(/Reste à payer 47 876 000 F/.test(texte), 'reste à payer : 66 876 000 − 8 000 000 − 11 000 000 = 47 876 000 F');

// L'ordinateur supprime son paiement : pierre tombale, celui du téléphone reste.
await dialogue().locator('.pay-history-item', { hasText: 'ORDI-1' }).getByRole('button', { name: /Supprimer le paiement/ }).click();
await dialogue().getByRole('button', { name: 'Supprimer', exact: true }).click();
const fin2 = Date.now() + 15000;
while (Date.now() < fin2 && db.facturePaiements.size !== 1) await page.waitForTimeout(250);
const tombe = [...(db.tombstones?.values() || [])].map((l) => l.data).find((t) => t.collection === 'facturePaiements');
ok(db.facturePaiements.size === 1 && db.facturePaiements.has('p-tel'), 'suppression : seul le paiement du téléphone reste sur le serveur');
ok(!!tombe && tombe.id !== 'p-tel', 'suppression : une pierre tombale est envoyée pour ce paiement-là seulement');
texte = sansEspaces(await dialogue().innerText());
ok(/Reste à payer 58 876 000 F/.test(texte), 'reste à payer après suppression : 58 876 000 F');

await ctx.close();

// Base restée en arrière : la table des paiements n'existe pas encore.
db = base(); envois = [];
({ ctx, page } = await appareil(db, envois, ['facturePaiements']));
await ouvrirPaiements();
const depuis2 = Date.now();
await dialogue().getByLabel('Montant reçu (F CFA) *').fill('11000000');
await dialogue().getByRole('button', { name: 'Enregistrer le paiement' }).click();
const fin3 = Date.now() + 15000;
while (Date.now() < fin3 && !envois.some((e) => e.table === 'factures' && e.t > depuis2)) await page.waitForTimeout(250);
await page.waitForTimeout(800);
texte = sansEspaces(await dialogue().innerText());
ok(/Reste à payer 55 876 000 F/.test(texte) && await dialogue().locator('.pay-history-item').count() === 1, 'table absente : le paiement reste enregistré sur l’appareil');
ok(envois.some((e) => e.table === 'factures' && e.t > depuis2) && db.factures.get('f1').data.montantPaye === 11000000,
  'table absente : la facture, elle, continue de se synchroniser (montant encaissé à jour)');
await ctx.close();

console.log(R.join('\n'));
await nav.close();
process.exit(R.some((l) => l.startsWith('❌')) ? 1 : 0);
