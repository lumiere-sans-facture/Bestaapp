/* Modifier un devis pendant que l'app se synchronise : la modification reste.
   Avant la correction, chaque relecture du serveur (retour dans l'app,
   signal temps réel, relecture d'une minute) rechargeait l'éditeur depuis la
   copie du devis prise à son ouverture : la ligne modifiée et enregistrée
   reprenait son ancienne valeur quelques secondes plus tard, une ligne en
   cours de saisie se refermait, et l'enregistrement suivant renvoyait au
   serveur l'ancienne version — la première modification était perdue.
   Et une relecture lente, partie juste avant un enregistrement, ramenait
   l'ancienne version par-dessus la nouvelle une fois l'envoi confirmé.

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
const NUMERO = 'BS-20261020-0001';
const ligne = (data) => ({ id: data.id, org_id: 'org-1', data });
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

const db = {
  devis: new Map([['d1', ligne({
    id: 'd1', type: 'manual', devisNumber: NUMERO, createdBy: 'p1', createdAt: '2026-10-20T09:00:00.000Z', statut: 'finalise',
    clientName: 'Client Démo', clientPhone: '+228 90 00 00 00',
    lignes: [
      { id: 'l1', designation: 'Panneau 550 Wc', itemType: 'bien', qty: 4, unit: 'pcs', pu: 95000, taxRate: 0 },
      { id: 'l2', designation: 'Onduleur hybride 5 kVA', itemType: 'bien', qty: 1, unit: 'pcs', pu: 450000, taxRate: 0 },
    ],
    subtotal: 830000, tva: 0, total: 830000,
  })]]),
  products: new Map([['pr1', ligne({ id: 'pr1', name: 'Panneau 550 Wc', basePrice: 80000, categorie: 'panneaux', statut: 'publie' })]]),
  partners: new Map([['p-user-p1', ligne({ id: 'p-user-p1', userId: 'p1', name: 'Kofi Gérant', code: 'KOFI-ABC123', status: 'actif' })]]),
};
const envois = []; const lectures = [];
// Lecture lente : la réponse est la photo du serveur AU MOMENT de la demande,
// rendue plus tard — comme un réseau mobile lent.
let lenteur = 0;

const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
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
  const lignes = db[table] || (db[table] = new Map());
  if (req.method() === 'GET') {
    const filtre = url.searchParams.get('id');
    const ids = (filtre || '').replace(/^in\.\(|\)$/g, '').split(',').filter(Boolean);
    const photo = JSON.parse(JSON.stringify([...lignes.values()].filter((l) => !ids.length || ids.includes(l.id))));
    lectures.push({ table, t: Date.now(), complete: !filtre });
    // Seule la relecture complète (pullAll) est lente ; le recalage d'avant
    // envoi (lecture par identifiant) reste rapide.
    if (lenteur && !filtre) await attendre(lenteur);
    return json(table === 'tombstones' ? photo.map((l) => l.data) : photo);
  }
  if (req.method() === 'POST') {
    const corps = JSON.parse(req.postData() || '[]');
    const rows = Array.isArray(corps) ? corps : [corps];
    for (const r of rows) lignes.set(r.id, { id: r.id, org_id: r.org_id, data: r.data ?? r });
    envois.push({ table, ids: rows.map((r) => r.id), t: Date.now() });
    return route.fulfill({ status: 201, body: '' });
  }
  if (req.method() === 'DELETE') {
    lignes.delete((url.searchParams.get('id') || '').replace(/^eq\./, ''));
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
await page.goto(B + '/devis');
const rang = page.locator('.flat-row', { hasText: NUMERO });
await rang.waitFor({ timeout: 15000 });

const editeur = page.locator('.quote-editor-sheet');
const lignesEditeur = () => editeur.locator('.quote-line-content').allInnerTexts();
const ouvrirEditeur = async () => {
  await rang.click();
  await page.getByRole('button', { name: 'Éditer' }).click();
  await editeur.locator('.quote-line-content').first().waitFor();
};
const modifierLigne = async (i, designation, { enregistrer = true } = {}) => {
  await editeur.locator('.quote-line-content').nth(i).click();
  const champ = editeur.getByLabel('Nom du produit');
  await champ.fill(designation);
  if (enregistrer) {
    await editeur.getByRole('button', { name: 'Enregistrer les modifications' }).click();
    await editeur.getByLabel('Nom du produit').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
  }
};
// Attend que le dernier envoi soit parti et que la fenêtre « écho » soit passée.
const attendreEnvoi = async (depuis) => {
  const fin = Date.now() + 15000;
  while (Date.now() < fin && !envois.some((e) => e.table === 'devis' && e.t > depuis)) await attendre(200);
  await attendre(2800);
};
// Relecture du serveur, comme au retour dans l'app.
const relire = async () => {
  const depuis = Date.now();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  const fin = Date.now() + 15000;
  while (Date.now() < fin && !lectures.some((l) => l.table === 'devis' && l.complete && l.t > depuis)) await attendre(100);
  await attendre(lenteur + 1200);
};
const serveur = () => db.devis.get('d1').data.lignes.map((l) => l.designation);

// 1. Ligne enregistrée, puis relecture du serveur : elle reste modifiée.
await ouvrirEditeur();
let t = Date.now();
await modifierLigne(0, 'Panneau 550 Wc — modifié');
await attendreEnvoi(t);
ok(serveur()[0] === 'Panneau 550 Wc — modifié', `l’enregistrement part au serveur [${serveur()[0]}]`);
await relire();
let affiche = await lignesEditeur();
ok(/Panneau 550 Wc — modifié/.test(affiche[0] || ''), `après une relecture du serveur, l’éditeur garde la ligne modifiée [${(affiche[0] || '').split('\n')[0]}]`);

// 2. Seconde modification : la première n'est pas écrasée au serveur.
t = Date.now();
await modifierLigne(1, 'Onduleur hybride 5 kVA — modifié');
await attendreEnvoi(t);
ok(serveur().join(' | ') === 'Panneau 550 Wc — modifié | Onduleur hybride 5 kVA — modifié',
  `deux modifications successives : les deux sont au serveur [${serveur().join(' | ')}]`);

// 3. Saisie en cours pendant une relecture : le formulaire reste ouvert, le texte aussi.
await modifierLigne(0, 'Saisie en cours', { enregistrer: false });
await relire();
const champ = editeur.getByLabel('Nom du produit');
ok(await champ.isVisible().catch(() => false) && (await champ.inputValue().catch(() => '')) === 'Saisie en cours',
  'une ligne en cours de saisie n’est ni refermée ni effacée par la relecture');
const annuler = editeur.getByRole('button', { name: 'Annuler' });
if (await annuler.isVisible().catch(() => false)) await annuler.click();

// 4. Relecture LENTE partie juste avant un enregistrement : la photo du
//    serveur qu'elle rapporte est antérieure à l'envoi — elle ne doit pas
//    ramener l'ancienne version.
await modifierLigne(0, 'Panneau 550 Wc — troisième', { enregistrer: false });
lenteur = 2500;
const depuis = Date.now();
await page.evaluate(() => window.dispatchEvent(new Event('focus')));
const fin = Date.now() + 5000;
while (Date.now() < fin && !lectures.some((l) => l.table === 'devis' && l.complete && l.t > depuis)) await attendre(50);
await editeur.getByRole('button', { name: 'Enregistrer les modifications' }).click();
await attendre(lenteur + 2500);
lenteur = 0;
ok(serveur()[0] === 'Panneau 550 Wc — troisième', `l’enregistrement fait pendant la relecture lente est au serveur [${serveur()[0]}]`);
await page.keyboard.press('Escape');
await editeur.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
await rang.click();
await page.getByRole('button', { name: 'Éditer' }).click();
await editeur.locator('.quote-line-content').first().waitFor();
affiche = await lignesEditeur();
ok(/Panneau 550 Wc — troisième/.test(affiche[0] || ''), `rouvert, le devis montre la dernière version, pas celle de la relecture lente [${(affiche[0] || '').split('\n')[0]}]`);

console.log(R.join('\n'));
await nav.close();
process.exit(R.some((l) => l.startsWith('❌')) ? 1 : 0);
