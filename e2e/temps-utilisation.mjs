/* Durée d'utilisation (web et application Android) : une période au premier
   plan donne un événement « temps_utilisation » au passage en arrière-plan,
   avec sa durée et la session ($session_id, UUID v7). Deux périodes proches
   partagent la session. Une période laissée par une app tuée est comptée à
   l'ouverture suivante ; celle d'un onglet encore vivant, non.
   Même serveur que e2e/analytique-application.mjs — clé PostHog de test et build :
     VITE_ANDROID_BUILD=195 VITE_POSTHOG_KEY=phc_aaaa…(30 car.) \
     VITE_POSTHOG_HOST=https://eu.i.posthog.com npm run dev
   PostHog est simulé : rien ne part réellement. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// L'arrière-plan simulé : le navigateur de test reste toujours « affiché ».
const basculer = (page, etat) => page.evaluate((e) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => e });
  document.dispatchEvent(new Event('visibilitychange'));
}, etat);

async function contexte({ android = false } = {}) {
  const recus = [];
  const ctx = await nav.newContext({ viewport: { width: 412, height: 860 } });
  if (android) await ctx.addInitScript(() => { window.CapacitorCustomPlatform = { name: 'android', plugins: {} }; });
  await ctx.route('https://eu.i.posthog.com/e/', async (route) => {
    try { recus.push(...(JSON.parse(route.request().postData() || '{}').batch || [])); } catch { /* corps illisible */ }
    await route.fulfill({ status: 200, body: '{}' });
  });
  await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
  return { ctx, page, recus, temps: () => recus.filter((e) => e.event === 'temps_utilisation') };
}

// --- Web : deux périodes proches, une même session ---------------------------
{
  const { ctx, page, temps } = await contexte();
  await page.goto(B + '/');
  await page.waitForTimeout(3000);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(3000);
  await basculer(page, 'hidden'); await page.waitForTimeout(1500);
  const [p1] = temps();
  ok(p1 && p1.properties.duree_secondes >= 5 && p1.properties.duree_secondes <= 9,
    `web : 1re période envoyée au passage en arrière-plan [${p1?.properties?.duree_secondes} s, ${p1?.properties?.duree_minutes} min]`);
  ok(p1?.properties?.plateforme === 'web' && V7.test(p1?.properties?.$session_id || ''), `web : plateforme et session UUID v7 [${p1?.properties?.$session_id}]`);
  ok(await page.evaluate(() => !Object.keys(localStorage).some((c) => c.startsWith('bestasolar_periode_'))), 'web : plus de copie de période une fois close');

  await basculer(page, 'visible'); await page.waitForTimeout(3000);
  await page.mouse.click(200, 300);
  await basculer(page, 'hidden'); await page.waitForTimeout(1500);
  const [, p2] = temps();
  ok(p2 && p2.properties.duree_secondes >= 2 && p2.properties.duree_secondes <= 5, `web : 2e période [${p2?.properties?.duree_secondes} s]`);
  ok(p2?.properties?.$session_id === p1?.properties?.$session_id, 'web : retour rapide = même session');
  await ctx.close();
}

// --- Reprise : période d'une app tuée comptée, onglet vivant ignoré ----------
{
  const { ctx, page, temps } = await contexte();
  await page.goto(B + '/');
  await page.evaluate(() => {
    const vu = Date.now() - 10 * 60 * 1000;
    localStorage.setItem('bestasolar_periode_morte', JSON.stringify({ debut: vu - 200000, derniere: vu, actifMs: 120000, vu, session: 'session-morte' }));
    localStorage.setItem('bestasolar_periode_vivante', JSON.stringify({ debut: Date.now(), derniere: Date.now(), actifMs: 5000, vu: Date.now(), session: 'session-vivante' }));
  });
  await page.reload(); await page.waitForTimeout(1000);
  await basculer(page, 'hidden'); await page.waitForTimeout(1500);
  const recup = temps().filter((e) => e.properties.recupere);
  ok(recup.length === 1 && recup[0].properties.duree_secondes === 120 && recup[0].properties.$session_id === 'session-morte',
    `reprise : période de l’app tuée comptée une fois [${recup.map((e) => `${e.properties.duree_secondes} s, ${e.properties.$session_id}`).join(' | ')}]`);
  ok(recup[0] && Math.abs(Date.parse(recup[0].timestamp) - (Date.now() - 10 * 60 * 1000)) < 60000, 'reprise : datée de sa vraie fin, pas d’aujourd’hui');
  const cles = await page.evaluate(() => Object.keys(localStorage).filter((c) => c.startsWith('bestasolar_periode_')));
  ok(cles.includes('bestasolar_periode_vivante') && !cles.includes('bestasolar_periode_morte'), `reprise : l’onglet encore vivant n’est pas touché [${cles.join(', ')}]`);
  await ctx.close();
}

// --- Application Android ------------------------------------------------------
{
  const { ctx, page, temps } = await contexte({ android: true });
  await page.goto(B + '/connexion');
  await page.waitForTimeout(4000);
  await page.mouse.click(200, 200);
  await basculer(page, 'hidden'); await page.waitForTimeout(1500);
  const [a] = temps();
  ok(a?.properties?.plateforme === 'android' && a?.properties?.build === 195 && a.properties.duree_secondes >= 3,
    `android : temps d’utilisation avec plateforme et build [${a?.properties?.plateforme}, build ${a?.properties?.build}, ${a?.properties?.duree_secondes} s]`);
  await ctx.close();
}

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Temps d’utilisation mesuré sur le web et dans l’app');
process.exit(echecs ? 1 : 0);
