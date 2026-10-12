/* Synchronisation sans voyant : la pastille de synchronisation a quitté le
   menu, la réplication tourne toujours. Un contact refusé une fois par Google
   repart au bout de ~15 s (plus 5 min), sans jamais être renvoyé en boucle ;
   un envoi qui échoue durablement est signalé au journal des erreurs — une
   seule fois — puisque plus rien ne s'affiche à l'écran.
   Lancer avec un Supabase simulé :
     VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=x npm run dev */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const P = { id: 'p1', email: 'tech@x.tg', name: 'Kossi Tech', role: 'technicien', org_id: 'org-1', phone: '+228 90 12 34 56', avatar: 'KT', is_platform_admin: false };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); const exp = Math.floor(Date.now() / 1000) + 86400;
const JETON = `${b64({ alg: 'HS256' })}.${b64({ email: P.email, exp, sub: '00000000-0000-0000-0000-000000000001' })}.x`;

const session = async ({ refuserPartenaires = false } = {}) => {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  const t = { google: [], partenaires: [], rapports: [] };
  const t0 = Date.now();
  await ctx.route('**/api/erreur**', async (route) => {
    try { t.rapports.push(...(JSON.parse(route.request().postData() || '{}').rapports || [JSON.parse(route.request().postData() || '{}')])); } catch { /* corps illisible */ }
    await route.fulfill({ status: 204, body: '' });
  });
  await ctx.route('http://127.0.0.1:54321/**', async (route) => {
    const req = route.request(); const c = new URL(req.url()).pathname;
    const json = (b, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    const unique = (req.headers().accept || '').includes('vnd.pgrst.object');
    if (c === '/auth/v1/token') return json({ access_token: JETON, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: { id: '00000000-0000-0000-0000-000000000001', email: P.email, aud: 'authenticated', app_metadata: {}, user_metadata: {} } });
    if (c.startsWith('/auth/v1/user')) return json({ id: '00000000-0000-0000-0000-000000000001', email: P.email });
    if (c === '/rest/v1/profiles') return json(unique ? P : [P]);
    if (c === '/rest/v1/orgs') { const o = { id: 'org-1', name: 'BestaSolar', kind: 'interne' }; return json(unique ? o : [o]); }
    if (c.endsWith('/auth_org_id')) return json('org-1');
    if (c === '/functions/v1/google-contacts-sync') {
      t.google.push(Date.now() - t0);
      // Premier essai refusé (raté passager de Google), le suivant accepté.
      return t.google.length === 1
        ? json({ status: 'failed', error: 'Google momentanément indisponible' })
        : json({ status: 'synced', resourceName: 'people/c1' });
    }
    if (c === '/rest/v1/partners' && req.method() === 'POST') {
      t.partenaires.push(Date.now() - t0);
      if (refuserPartenaires) return json({ code: '57014', message: 'canceling statement due to statement timeout' }, 500);
    }
    if (c.startsWith('/rest/v1/rpc/')) return json(null);
    return json([]);
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
  await page.goto(B + '/login'); await page.waitForSelector('.login-form');
  await page.fill('input[type="email"]', P.email);
  await page.fill('input[type="password"]', 'motdepasse123');
  await page.click('button[type="submit"]');
  await page.locator('.sidebar').waitFor({ timeout: 30000 });
  return { ctx, page, t };
};

// Données de l'appareil : rangées sous la clé du compte (bestasolar_data_<portée>).
const donnees = (page) => page.evaluate(() => {
  const cle = Object.keys(localStorage).find((k) => k.startsWith('bestasolar_data'));
  return JSON.parse(localStorage.getItem(cle) || '{}');
});

// ---- 1. Plus de voyant ; contact Google repris vite, sans boucle ----
{
  const { ctx, page, t } = await session();
  ok(await page.locator('.sync-dot').count() === 0, 'menu : plus de voyant de synchronisation');
  await page.waitForTimeout(8000);
  ok(t.google.length === 1, `refus de Google : un seul envoi, pas de renvoi en boucle [${t.google.length} en 8 s]`);
  await page.waitForFunction(() => Object.keys(localStorage).filter((k) => k.startsWith('bestasolar_data'))
    .some((k) => (JSON.parse(localStorage.getItem(k) || '{}').partners || []).some((p) => p.google_contact_sync_status === 'synced')),
  null, { timeout: 30000 }).catch(() => {});
  const ecart = t.google.length > 1 ? (t.google[1] - t.google[0]) / 1000 : null;
  ok(ecart !== null && ecart >= 14 && ecart <= 22, `nouvel essai au bout de ~15 s (plus 5 min) [${ecart?.toFixed(1)} s]`);
  const partenaire = ((await donnees(page)).partners || []).find((p) => p.userId === 'p1');
  ok(partenaire?.google_contact_sync_status === 'synced' && partenaire.google_contact_sync_attempts === 0, `contact enregistré dans Google, compteur remis à zéro [${partenaire?.google_contact_sync_status}]`);
  ok(t.partenaires.length <= 4, `partenaires renvoyés au serveur avec mesure [${t.partenaires.length} envois]`);
  await page.locator('.sidebar-footer, .sidebar').first().screenshot({ path: '/tmp/claude-0/menu-sans-voyant.png' }).catch(() => {});
  await ctx.close();
}

// ---- 2. Envoi qui échoue durablement : signalé au journal, une fois ----
{
  const { ctx, page, t } = await session({ refuserPartenaires: true });
  await page.waitForTimeout(26000);
  const synchro = t.rapports.filter((r) => /Synchronisation en échec/.test(JSON.stringify(r)));
  ok(t.partenaires.length >= 3, `envois retentés malgré l'échec [${t.partenaires.length} : ${t.partenaires.map((x) => (x / 1000).toFixed(1)).join(', ')} s]`);
  ok(synchro.length === 1 && /statement timeout/.test(JSON.stringify(synchro[0])), `échec durable signalé au journal, une seule fois [${synchro.length}]`);
  ok(!/Kossi|90 12 34 56/.test(JSON.stringify(synchro)), 'le rapport ne contient ni nom ni numéro');
  await ctx.close();
}

await nav.close();
console.log(R.join('\n'));
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : `\n✅ Synchronisation sans voyant, contacts repris vite (${R.length} vérifications)`);
process.exit(echecs ? 1 : 0);
