/* Pages légales accessibles DANS l'app (exigence Google Play / App Store) :
   connexion, inscription (phrase d'acceptation), paramètres, pied de la page
   d'accueil ; les trois pages s'affichent, lisibles sur téléphone.
   Lancer l'app avec un Supabase simulé (l'inscription n'existe qu'en ligne) :
     VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=x npm run dev */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const SB = 'http://127.0.0.1:54321';

const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
// Serveur simulé : aucune session au départ, puis un compte pour les paramètres.
const PROFIL = { id: 'p-essai', email: 'essai@exemple.tg', name: 'Compte Essai', role: 'technicien', org_id: 'org-essai', phone: '+22890000000', avatar: 'CE' };
await ctx.route(`${SB}/**`, (route) => {
  const req = route.request();
  const chemin = new URL(req.url()).pathname;
  const unique = (req.headers().accept || '').includes('vnd.pgrst.object');
  const json = (c) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(c) });
  if (chemin === '/rest/v1/profiles') return json(unique ? PROFIL : [PROFIL]);
  if (chemin === '/rest/v1/orgs') { const o = { id: PROFIL.org_id, name: 'Essai', kind: 'client' }; return json(unique ? o : [o]); }
  if (chemin.startsWith('/rest/v1/rpc/auth_org_id')) return json(PROFIL.org_id);
  if (chemin.startsWith('/rest/v1/rpc/')) return json(null);
  return json([]);
});
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));

// ---- 1. CONNEXION ----
await page.goto(B + '/login');
await page.waitForSelector('.login-form', { timeout: 15000 });
const liens = await page.locator('.liens-legaux a').evaluateAll((as) => as.map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('target')]));
ok(liens.length === 3 && liens.every(([, , t]) => t === '_blank'), `écran de connexion : ${liens.map(([t, h]) => `${t} → ${h}`).join(' · ')}`);

const [onglet] = await Promise.all([ctx.waitForEvent('page'), page.locator('.liens-legaux a', { hasText: "Conditions d'utilisation" }).click()]);
await onglet.waitForLoadState();
const cgu = await onglet.evaluate(() => document.body.innerText);
ok(/Conditions générales d'utilisation et de vente/.test(cgu) && /BESTA SOLAR TOGO/.test(cgu), 'le lien ouvre les conditions dans un nouvel onglet, sans quitter l’app');
await onglet.close();

// ---- 2. INSCRIPTION : phrase d'acceptation ----
await page.locator('button:has-text("Créer un compte")').click();
await page.waitForTimeout(500);
const consentement = await page.locator('.liens-legaux-consentement').innerText().catch(() => '');
ok(/En créant un compte, vous acceptez les conditions d'utilisation et la politique de confidentialité/.test(consentement),
   'inscription : la phrase d’acceptation précède « Créer mon compte »');
const ordre = await page.evaluate(() => {
  const p = document.querySelector('.liens-legaux-consentement');
  const b = [...document.querySelectorAll('.login-form button[type="submit"]')].pop();
  return !!(p && b && (p.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING));
});
ok(ordre, 'la phrase est placée avant le bouton, pas après');

// ---- 3. PAGES PUBLIQUES, LISIBLES SUR TÉLÉPHONE ----
for (const [chemin, titre] of [['/privacy.html', /Politique de confidentialité/], ['/conditions.html', /Conditions générales/], ['/suppression-compte.html', /Supprimer son compte/]]) {
  await page.goto(B + chemin);
  const info = await page.evaluate(() => ({ texte: document.body.innerText, deborde: document.documentElement.scrollWidth > window.innerWidth }));
  ok(titre.test(info.texte) && !info.deborde, `${chemin} s’affiche, sans défilement horizontal`);
}
const privacy = await (await page.goto(B + '/privacy.html')).text();
ok(!/gmail|Parakou|usage interne|restent sur l'appareil de l'utilisateur/.test(privacy), 'l’ancienne politique (usage interne, Gmail, Parakou) a disparu');

// ---- 4. PIED DE LA PAGE D'ACCUEIL ----
await page.goto(B + '/');
await page.waitForTimeout(1500);
const pied = await page.evaluate(() => document.querySelector('footer')?.innerText || '');
ok(/BESTA SOLAR TOGO/.test(pied) && /Conditions d'utilisation/.test(pied) && /Confidentialité/.test(pied), 'pied de page d’accueil : éditeur et deux liens');

// ---- 5. PARAMÈTRES (compte connecté) ----
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400;
const jeton = `${b64({ alg: 'HS256' })}.${b64({ sub: '00000000-0000-0000-0000-000000000001', email: PROFIL.email, exp })}.x`;
await page.evaluate(([j, e, p]) => {
  localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: j, refresh_token: 'r', token_type: 'bearer', expires_in: 86400, expires_at: e,
    user: { id: '00000000-0000-0000-0000-000000000001', email: p.email, aud: 'authenticated', app_metadata: {}, user_metadata: {} } }));
  localStorage.setItem('bestasolar_user', JSON.stringify(p));
}, [jeton, exp, PROFIL]);
await page.goto(B + '/plus/parametres');
await page.waitForSelector('.settings-legal', { timeout: 15000 });
const reglages = await page.locator('.settings-legal a').allInnerTexts();
ok(reglages.length === 3, `Paramètres : ${reglages.join(' · ')}`);

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Pages légales : accessibles depuis l’app, l’inscription et l’accueil');
process.exit(echecs ? 1 : 0);
