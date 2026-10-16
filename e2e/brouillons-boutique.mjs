/* Produits en brouillon (import Deye) : le gérant de BestaSolar les trouve
   dès l'arrivée en boutique, sur téléphone ; le gérant d'une entreprise Pro,
   qui reçoit le même catalogue en lecture, ne les voit jamais.

   Défaut d'origine : les brouillons étaient bien là, mais introuvables. La
   puce « Brouillons » fermait la rangée des catégories, hors de l'écran d'un
   téléphone, et dans « Tous » le premier brouillon arrivait en 158ᵉ position.

   Lancer avec un Supabase simulé :
     VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=x npm run dev */
import { chromium } from '@playwright/test';
import { catalogueProducts } from '../src/data/catalogue.js';
import { produitsDeye } from '../src/data/catalogueDeye.js';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); const exp = Math.floor(Date.now() / 1000) + 86400;
const LARGEUR = 390;

/** Un compte sur un téléphone neuf, branché sur `db` ; renvoie la page. */
const telephone = async (db, org, envois) => {
  const UID = `00000000-0000-0000-0000-00000000000${org.kind === 'interne' ? 1 : 2}`;
  const P = { id: `p-${org.id}`, email: `gerant@${org.id}.tg`, name: 'Gérant', role: 'gerant', org_id: org.id, phone: '', avatar: 'G', is_platform_admin: false };
  const JETON = `${b64({ alg: 'HS256' })}.${b64({ email: P.email, exp, sub: UID })}.x`;
  const ctx = await nav.newContext({ viewport: { width: LARGEUR, height: 844 } });
  await ctx.route('**/api/erreur**', (route) => route.fulfill({ status: 204, body: '' }));
  await ctx.route('http://127.0.0.1:54321/**', async (route) => {
    const req = route.request(); const url = new URL(req.url()); const c = url.pathname;
    const json = (b, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    const unique = (req.headers().accept || '').includes('vnd.pgrst.object');
    if (c === '/auth/v1/token') return json({ access_token: JETON, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: { id: UID, email: P.email, aud: 'authenticated', app_metadata: {}, user_metadata: {} } });
    if (c.startsWith('/auth/v1/user')) return json({ id: UID, email: P.email });
    if (c === '/rest/v1/profiles') return json(unique ? P : [P]);
    if (c === '/rest/v1/orgs') return json(unique ? org : [org]);
    if (c.startsWith('/functions/') || c.startsWith('/rest/v1/rpc/')) return json(null);
    const table = decodeURIComponent(c.replace('/rest/v1/', ''));
    const lignes = db[table] || (db[table] = new Map());
    if (req.method() === 'GET') {
      const ids = (url.searchParams.get('id') || '').replace(/^in\.\(|\)$/g, '').split(',').filter(Boolean);
      return json([...lignes.values()].filter((l) => !ids.length || ids.includes(l.id)));
    }
    if (req.method() === 'POST') {
      const rows = JSON.parse(req.postData() || '[]');
      for (const r of rows) lignes.set(r.id, { id: r.id, org_id: r.org_id, data: r.data });
      envois.push({ table, rows });
      return route.fulfill({ status: 201, body: '' });
    }
    return json([]);
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
  await page.goto(B + '/login'); await page.waitForSelector('.login-form');
  await page.fill('input[type="email"]', P.email);
  await page.fill('input[type="password"]', 'motdepasse123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  await page.goto(B + '/boutique');
  await page.waitForTimeout(3000);
  return { ctx, page };
};

// ---- 1. Gérant BestaSolar : catalogue officiel au serveur, Deye reçus à la mise à jour ----
const dbInterne = { products: new Map(catalogueProducts.map((p) => [p.id, { id: p.id, org_id: 'org-bestasolar', data: p }])) };
const envois = [];
const { ctx: c1, page } = await telephone(dbInterne, { id: 'org-bestasolar', name: 'BestaSolar', kind: 'interne' }, envois);
const n = produitsDeye.length;
const bandeau = page.locator('.page-content > .brouillon-note');
ok(await bandeau.count() === 1, 'bandeau des brouillons en tête de boutique');
ok((await bandeau.innerText().catch(() => '')).includes(`${n} produits en brouillon`), `il annonce ${n} produits en brouillon`);
const bb = await bandeau.boundingBox();
ok(bb && bb.y + bb.height < 400, `bandeau visible sans défiler (y = ${bb && Math.round(bb.y)})`);
const puce = await page.locator('.category-chip', { hasText: 'Brouillons' }).boundingBox();
ok(puce && puce.x + puce.width <= LARGEUR, `puce « Brouillons » dans l'écran (x = ${puce && Math.round(puce.x)})`);
await bandeau.locator('button', { hasText: 'Voir' }).click();
await page.waitForTimeout(500);
ok(await page.locator('.product-card').count() === n, `« Voir » : les ${n} brouillons, et eux seuls`);
ok(await page.locator('.product-card .cart-add-btn:disabled').count() === n, 'aucun brouillon ne se met au panier');
ok(await bandeau.count() === 0, 'le bandeau s’efface une fois dans les brouillons');
ok([...dbInterne.products.keys()].filter((k) => k.startsWith('deye-')).length === n, `les ${n} brouillons sont partis au serveur`);
// Publier un produit : il quitte les brouillons, et la publication part au serveur.
await page.locator('.product-card', { hasText: 'SUN-8K-SG04LP3-EU' }).locator('.product-open').first().click();
await page.waitForSelector('.sheet .brouillon-note');
await page.locator('.sheet .brouillon-note button', { hasText: 'Publier' }).click();
await page.waitForTimeout(3500);
ok(dbInterne.products.get('deye-sun-8k-sg04lp3-eu')?.data?.brouillon === false, 'publication enregistrée au serveur');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
ok((await page.locator('.category-chip', { hasText: 'Brouillons' }).innerText()).includes(String(n - 1)), `puce : ${n - 1} brouillons restants`);
await c1.close();

// ---- 2. Gérant d'une entreprise Pro : même catalogue, reçu en lecture ----
const dbPro = { products: new Map([...dbInterne.products.values()].map((l) => [l.id, { ...l }])) };
const { ctx: c2, page: pro } = await telephone(dbPro, { id: 'org-pro', name: 'Solaire Kara', kind: 'pro' }, []);
ok(await pro.locator('.brouillon-note').count() === 0, 'entreprise Pro : aucun bandeau de brouillons');
ok(await pro.locator('.category-chip', { hasText: 'Brouillons' }).count() === 0, 'entreprise Pro : aucune puce Brouillons');
ok(await pro.locator('.brouillon-badge').count() === 0, 'entreprise Pro : aucun produit en brouillon affiché');
await pro.fill('input[aria-label="Rechercher un produit"]', 'SG04LP3');
await pro.waitForTimeout(400);
ok(await pro.locator('.product-card').count() === 1, 'entreprise Pro : le produit publié est en boutique');
await c2.close();

console.log(R.join('\n'));
await nav.close();
process.exit(R.some((l) => l.startsWith('❌')) ? 1 : 0);
