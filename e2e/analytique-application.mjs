/* Analytique de l'application Android : première ouverture « app_installee »
   puis « app_ouverte », avec plateforme, build et identifiant ANONYME de
   l'appareil ; ouverture suivante : seulement « app_ouverte ». Diagnostic du
   gérant : plateforme de l'appareil et téléchargements de l'APK (GitHub).
   Nécessite un serveur lancé avec une clé PostHog de test et un build :
     VITE_ANDROID_BUILD=195 VITE_POSTHOG_KEY=phc_aaaa…(30 car.) \
     VITE_POSTHOG_HOST=https://eu.i.posthog.com npm run dev
   PostHog et GitHub sont simulés : rien ne part réellement. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const recus = [];
const ctx = await nav.newContext({ viewport: { width: 412, height: 860 } });
await ctx.addInitScript(() => { // Téléphone simulé par le mécanisme officiel de Capacitor : @capacitor/core
  // y lit la plateforme (« android ») au lieu de la détecter.
  window.CapacitorCustomPlatform = { name: 'android', plugins: {} }; });
await ctx.route('https://eu.i.posthog.com/e/', async (route) => {
  try { recus.push(...(JSON.parse(route.request().postData() || '{}').batch || [])); } catch { /* corps illisible */ }
  await route.fulfill({ status: 200, body: '{}' });
});
await ctx.route('https://api.github.com/repos/lumiere-sans-facture/Bestaapp/releases?*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
  { tag_name: 'android-195', assets: [{ name: 'BestaSolar.apk', download_count: 3 }] },
  { tag_name: 'android-192', assets: [{ name: 'BestaSolar.apk', download_count: 5 }] },
]) }));
await ctx.route('https://api.github.com/repos/lumiere-sans-facture/Bestaapp/releases/latest', (r) => r.fulfill({ status: 404, body: '{}' }));
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));

// 1re ouverture (l'app s'ouvre sur la connexion).
await page.goto(B + '/connexion');
await page.waitForTimeout(17000); // lot envoyé toutes les 15 s
const premiers = recus.filter((e) => e.event.startsWith('app_'));
ok(premiers.map((e) => e.event).join(',') === 'app_installee,app_ouverte', `1re ouverture : ${premiers.map((e) => e.event).join(', ') || 'rien'}`);
const e0 = premiers[0];
ok(e0?.properties?.plateforme === 'android' && e0?.properties?.build === 195, `plateforme android, build 195 [${e0?.properties?.plateforme}, ${e0?.properties?.build}]`);
ok(/^[0-9a-f-]{36}$/.test(e0?.distinct_id || '') && e0?.properties?.$device_id === e0?.distinct_id, 'identifiant anonyme de l’appareil (avant connexion)');

// 2e ouverture : seulement « app_ouverte ».
recus.length = 0;
await page.reload(); await page.waitForTimeout(17000);
const seconds = recus.filter((e) => e.event.startsWith('app_')).map((e) => e.event);
ok(seconds.join(',') === 'app_ouverte', `ouverture suivante : ${seconds.join(', ') || 'rien'}`);

// Diagnostic du gérant.
await page.evaluate(() => localStorage.setItem('bestasolar_user', JSON.stringify({ id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' })));
await page.goto(B + '/plus/parametres'); await page.waitForTimeout(2500);
const diag = (await page.locator('.card', { hasText: 'Version installée' }).innerText().catch(() => '')).replace(/\s+/g, ' ');
ok(/Cet appareil Application Android, build 195/.test(diag), 'diagnostic : plateforme et build de l’appareil');
ok(/App Android 8 téléchargements de l’APK/.test(diag), `diagnostic : téléchargements additionnés [${/App Android [^U]*/.exec(diag)?.[0]}]`);
await page.locator('.card', { hasText: 'Version installée' }).screenshot({ path: '/tmp/claude-0/diagnostic.png' }).catch(() => {});

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Analytique de l’app : installations, mises à jour et ouvertures comptées');
process.exit(echecs ? 1 : 0);
