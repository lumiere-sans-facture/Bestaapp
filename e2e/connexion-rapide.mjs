/* Connexion sur réseau lent (400 ms par requête, Supabase simulé) : le
   profil et l'organisation se lisent EN MÊME TEMPS, pas l'un après l'autre.
   Lancer : VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=x npm run dev */
import { chromium } from '@playwright/test';
const LAT = 400;
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
const P = { id: 'p1', email: 'essai@x.tg', name: 'Essai', role: 'gerant', org_id: 'org-1', phone: '+228', avatar: 'E', is_platform_admin: false };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url'); const exp = Math.floor(Date.now() / 1000) + 86400;
const JETON = `${b64({ alg: 'HS256' })}.${b64({ email: P.email, exp, sub: '00000000-0000-0000-0000-000000000001' })}.x`;
let t0 = 0; const log = []; const departs = {};
await ctx.route('http://127.0.0.1:54321/**', async (route) => {
  const req = route.request(); const u = new URL(req.url()); const c = u.pathname;
  const debut = Date.now() - t0;
  if (!departs[c]) departs[c] = debut;
  await new Promise((r) => setTimeout(r, LAT));
  log.push(`${String(debut).padStart(5)} → ${String(Date.now() - t0).padStart(5)} ms  ${req.method()} ${c}${u.search.slice(0, 60)}`);
  const unique = (req.headers().accept || '').includes('vnd.pgrst.object');
  const json = (b, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
  if (c === '/auth/v1/token') return json({ access_token: JETON, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: exp, user: { id: '00000000-0000-0000-0000-000000000001', email: P.email, aud: 'authenticated', app_metadata: {}, user_metadata: {} } });
  if (c.startsWith('/auth/v1/user')) return json({ id: '00000000-0000-0000-0000-000000000001', email: P.email });
  if (c === '/rest/v1/profiles') return json(unique ? P : [P]);
  if (c === '/rest/v1/orgs') { const o = { id: 'org-1', name: 'Essai', kind: 'pro' }; return json(unique ? o : [o]); }
  if (c.endsWith('/auth_org_id')) return json('org-1');
  if (c.startsWith('/rest/v1/rpc/')) return json(null);
  return json([]);
});
const page = await ctx.newPage();
await page.goto('http://localhost:3000/login');
await page.waitForSelector('.login-form');
await page.fill('input[type="email"]', P.email);
await page.fill('input[type="password"]', 'motdepasse123');
t0 = Date.now();
await page.click('button[type="submit"]');
await page.waitForFunction(() => !document.querySelector('.login-form') && document.querySelector('.page-content, main'), null, { timeout: 60000 });
const dansApp = Date.now() - t0;
await page.waitForTimeout(4000);
await nav.close();
const ecart = Math.abs((departs['/rest/v1/orgs'] ?? 1e9) - (departs['/rest/v1/profiles'] ?? -1e9));
console.log(`Entrée dans l'app : ${dansApp} ms après le clic · profil et organisation lancés à ${ecart} ms d'écart`);
if (ecart > 100 || dansApp > 1200) { console.log('❌ connexion : trois allers-retours enchaînés ?'); process.exit(1); }
console.log('✅ Connexion : deux allers-retours au lieu de trois');
