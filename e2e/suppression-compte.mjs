/* Suppression de compte, parcours EN LIGNE : le serveur Supabase est simulé
   dans le navigateur (aucune base réelle n'est touchée). Lancer l'app avec
     VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=x npm run dev
   Vérifie : bouton présent dans Profil, confirmation exigée, refus du
   serveur affiché, puis suppression → déconnexion et appareil nettoyé. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const SB = 'http://127.0.0.1:54321';

const PROFIL = { id: 'p-essai', email: 'essai@exemple.tg', name: 'Compte Essai', role: 'gerant', org_id: 'org-essai', phone: '+22890000000', avatar: 'CE', is_platform_admin: false };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600 * 24;
const JETON = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: '00000000-0000-0000-0000-000000000001', email: PROFIL.email, exp, role: 'authenticated' })}.signature`;
const SESSION = { access_token: JETON, refresh_token: 'rt', token_type: 'bearer', expires_in: 86400, expires_at: exp,
  user: { id: '00000000-0000-0000-0000-000000000001', email: PROFIL.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} } };

let reponseSuppression = { ok: false, raison: 'gerant' };
const appels = [];

const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
await ctx.route(`${SB}/**`, async (route) => {
  const req = route.request();
  const chemin = new URL(req.url()).pathname;
  const unique = (req.headers().accept || '').includes('vnd.pgrst.object');
  const json = (corps, statut = 200) => route.fulfill({ status: statut, contentType: 'application/json', body: JSON.stringify(corps) });
  if (chemin.startsWith('/auth/v1/logout')) { appels.push('logout'); return route.fulfill({ status: 204 }); }
  if (chemin.startsWith('/auth/v1/user')) return json(SESSION.user);
  if (chemin.startsWith('/rest/v1/rpc/')) {
    const fn = chemin.split('/').pop();
    appels.push(fn);
    if (fn === 'supprimer_mon_compte') return json(reponseSuppression);
    if (fn === 'auth_org_id') return json(PROFIL.org_id);
    if (fn === 'auth_profile_id') return json(PROFIL.id);
    if (fn === 'auth_is_platform_admin') return json(false);
    return json(null);
  }
  if (chemin === '/rest/v1/profiles') return json(unique ? PROFIL : [PROFIL]);
  if (chemin === '/rest/v1/orgs') {
    const org = { id: PROFIL.org_id, name: 'Entreprise Essai', kind: 'client' };
    return json(unique ? org : [org]);
  }
  if (req.method() === 'GET' || req.method() === 'HEAD') return json([]);
  return json([], 201);
});

await page.goto(B + '/');
await page.evaluate(([s, p]) => {
  localStorage.setItem('sb-127-auth-token', JSON.stringify(s));
  localStorage.setItem('bestasolar_user', JSON.stringify(p));
}, [SESSION, PROFIL]);
await page.goto(B + '/plus/profile');
await page.waitForSelector('.suppression-compte', { timeout: 20000 });
await page.waitForTimeout(1500);
ok(await page.locator('.suppression-compte button:has-text("Supprimer mon compte")').count() === 1, 'le bouton « Supprimer mon compte » est dans Profil');

const clesAvant = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('bestasolar_')));
ok(clesAvant.includes('bestasolar_data_org-essai'), `l’appareil garde les données de l’entreprise avant suppression [${clesAvant.join(', ')}]`);

await page.locator('.suppression-compte button:has-text("Supprimer mon compte")').click();
await page.waitForTimeout(400);
const bouton = page.locator('.sheet button[type="submit"]');
ok(await bouton.isDisabled(), 'sans le mot de confirmation, le bouton reste inactif');
await page.locator('.sheet input').fill('supprime');
ok(await bouton.isDisabled(), 'un mot approchant ne suffit pas');
await page.locator('.sheet input').fill('SUPPRIMER');
ok(!(await bouton.isDisabled()), '« SUPPRIMER » active le bouton');
ok(/sauvegarde/i.test(await page.locator('.sheet').innerText()), 'le gérant est invité à faire une sauvegarde');
await page.locator('.sheet').screenshot({ path: '/tmp/claude-0/suppression-fiche.png' });

// 1. Refus du serveur (gérant d'une équipe) : message clair, rien n'est effacé.
await bouton.click();
await page.waitForTimeout(800);
const refus = await page.locator('.sheet .field-error').innerText().catch(() => '');
ok(/gérant d’une équipe/.test(refus) && /contact@bestasolar\.com/.test(refus), `refus affiché avec le contact [${refus.slice(0, 60)}…]`);
ok(new URL(page.url()).pathname === '/plus/profile', 'après un refus, on reste connecté sur la page');

// 2. Suppression acceptée.
reponseSuppression = { ok: true, portee: 'entreprise' };
await bouton.click();
await page.waitForTimeout(3500);
ok(appels.filter((a) => a === 'supprimer_mon_compte').length === 2, 'le serveur a été appelé (refus puis suppression)');
ok(appels.includes('logout'), 'la session est fermée');
const clesApres = await page.evaluate(() => Object.keys(localStorage));
const restes = clesApres.filter((k) => /org-essai|^bestasolar_(user|profil|session_)|^sb-.+-auth-token$/.test(k));
ok(restes.length === 0, `données, profil et session du compte ont quitté l’appareil [restent : ${restes.join(', ') || 'aucune'}]`);
// Surtout : l'app ne rouvre pas la session du compte supprimé (elle
// recréerait un profil). Aucune lecture de profil après la suppression.
const idx = appels.lastIndexOf('supprimer_mon_compte');
ok(!appels.slice(idx + 1).some((a) => a === 'auth_org_id' || a === 'provision_profile'),
   `aucune reconnexion après suppression [appels suivants : ${appels.slice(idx + 1).join(', ') || 'aucun'}]`);
ok(!/Supprimer mon compte/.test(await page.evaluate(() => document.body.innerText)), `l’utilisateur n’est plus dans l’app [${new URL(page.url()).pathname}]`);

// Page publique pour les stores.
const pub = await ctx.newPage();
await pub.goto(B + '/suppression-compte.html');
const texte = await pub.evaluate(() => document.body.innerText);
ok(/Supprimer son compte BestaSolar Pro/.test(texte) && /contact@bestasolar\.com/.test(texte), 'la page web publique de suppression s’affiche');

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Suppression de compte : confirmée, refus expliqué, compte supprimé et appareil nettoyé');
process.exit(echecs ? 1 : 0);
