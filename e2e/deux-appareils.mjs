/* Deux appareils, un même compte : une modification faite sur l'un n'est
   plus effacée par l'autre. Le faux Supabase ci-dessous GARDE les données
   (tables en mémoire), comme le vrai.

   Avant la correction, chaque envoi renvoyait la collection ENTIÈRE avec la
   copie de l'appareil : l'ordinateur, en notant l'issue d'une relance Google
   Contacts sur un autre contact, réécrivait aussi le contact que le téléphone
   venait de modifier — l'ancien nom revenait partout. Et sur un appareil
   neuf, le profil partenaire créé avant la première lecture du serveur
   écrasait le vrai (numéro effacé, code partenaire changé).

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

const fiche = (id, name, phone, extra = {}) => ({
  id, org_id: 'org-1',
  data: { id, name, phone, clientType: 'particulier', stage: 'nouveau', source: 'terrain', assignedTo: 'p1', registeredByUserId: 'p1', createdAt: '2026-10-01T10:00:00.000Z', ...extra },
});

/** Un serveur neuf : trois contacts, le profil partenaire du compte. */
const serveur = () => ({
  leads: new Map([
    ['x', fiche('x', 'Ama Mensah', '+22890000001', { google_contact_sync_status: 'synced' })],
    ['y', fiche('y', 'Kossi Agbo', '+22890000002')],
    ['z', fiche('z', 'Yao Dzifa', '+22890000003')],
  ]),
  partners: new Map([['p-user-p1', { id: 'p-user-p1', org_id: 'org-1', data: {
    id: 'p-user-p1', userId: 'p1', name: 'Kofi Gérant', code: 'KOFI-ABC123', status: 'actif',
    phone: '+22890000009', momoNumber: '+22890000009', google_contact_sync_status: 'synced',
  } }]]),
});

/** L'ordinateur : un navigateur neuf, branché sur `db`. */
const ordinateur = async (db, envois) => {
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
    // Google Contacts non relié : chaque contact repart en reprise (~15 s).
    if (c === '/functions/v1/google-contacts-sync') return json({ error: 'Google Contacts non relié' });
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
      envois.push({ table, ids: rows.map((r) => r.id), t: Date.now() });
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
  await page.locator('.sidebar').waitFor({ timeout: 30000 });
  await page.goto(B + '/clients');
  await page.waitForFunction(() => document.body.innerText.includes('Ama Mensah'), null, { timeout: 15000 });
  return { ctx, page };
};

/** Attend un envoi de `table` postérieur à `depuis` (relance Google ~15 s). */
const attendreEnvoi = async (envois, table, depuis, delai = 30000) => {
  const fin = Date.now() + delai;
  while (Date.now() < fin) {
    if (envois.some((e) => e.table === table && e.t > depuis)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
};
const texte = (page) => page.evaluate(() => document.body.innerText);

// 1. Le téléphone modifie X ; l'ordinateur relance Google sur Y et Z.
{
  const db = serveur(); const envois = [];
  const { ctx, page } = await ordinateur(db, envois);
  await page.waitForTimeout(2500);
  const x = db.leads.get('x');
  db.leads.set('x', { ...x, data: { ...x.data, name: 'Ama Mensah-Lawson' } }); // envoi du téléphone
  const depuis = Date.now();
  ok(await attendreEnvoi(envois, 'leads', depuis), 'l’ordinateur renvoie bien ses relances Google (Y, Z)');
  const apres = envois.filter((e) => e.table === 'leads' && e.t > depuis);
  ok(apres.every((e) => !e.ids.includes('x')), `seuls les contacts modifiés ici partent (${apres.map((e) => e.ids.join('+')).join(', ')}), jamais X`);
  ok(db.leads.get('x').data.name === 'Ama Mensah-Lawson', 'le serveur garde le nom saisi sur le téléphone');
  await page.reload();
  await page.waitForFunction(() => document.body.innerText.includes('Ama Mensah'), null, { timeout: 15000 });
  await page.waitForTimeout(1500);
  ok((await texte(page)).includes('Ama Mensah-Lawson'), 'après rafraîchissement, l’ordinateur affiche le nouveau nom');
  await ctx.close();
}

// 2. Le téléphone modifie Y — celui-là même que l'ordinateur relance vers
//    Google, sur sa copie périmée.
{
  const db = serveur(); const envois = [];
  const { ctx, page } = await ordinateur(db, envois);
  await page.waitForTimeout(2500);
  const y = db.leads.get('y');
  db.leads.set('y', { ...y, data: { ...y.data, name: 'Kossi Agbo-Mensah' } });
  const depuis = Date.now();
  await attendreEnvoi(envois, 'leads', depuis);
  await page.waitForTimeout(1500);
  const recue = db.leads.get('y').data;
  ok(recue.name === 'Kossi Agbo-Mensah', `même contact : le nom du téléphone survit à la relance de l’ordinateur (« ${recue.name} »)`);
  ok(Number(recue.google_contact_sync_attempts) >= 2, 'même contact : la relance Google de l’ordinateur est bien enregistrée aussi');
  ok((await texte(page)).includes('Kossi Agbo-Mensah'), 'même contact : l’ordinateur affiche aussitôt le nom du téléphone, sans rafraîchir');
  await ctx.close();
}

// 3. Appareil neuf : le profil partenaire existant n'est pas réinitialisé.
{
  const db = serveur(); const envois = [];
  const { ctx, page } = await ordinateur(db, envois);
  await page.waitForTimeout(3000);
  const p = db.partners.get('p-user-p1').data;
  ok(p.code === 'KOFI-ABC123', `appareil neuf : le code partenaire ne change pas (${p.code})`);
  ok(p.momoNumber === '+22890000009', 'appareil neuf : le numéro Mobile Money n’est pas effacé');
  await ctx.close();
}

await nav.close();
console.log(R.join('\n'));
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(`\n${R.length - echecs}/${R.length} vérifications`);
process.exit(echecs ? 1 : 0);
