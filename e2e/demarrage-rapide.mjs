/* L'app s'ouvre sans attendre les serveurs externes. KKiaPay (3 s) et
   Google Fonts (1,5 s) sont simulés LENTS : le formulaire de connexion doit
   pourtant s'afficher tout de suite. Avant correction : 3,4 s, car le script
   de KKiaPay, placé dans index.html, bloquait le démarrage de toute l'app.
   Lancer sur le build : npm run build && npx vite preview --port 4173 */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const mesures = [];
for (let essai = 0; essai < 3; essai++) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(/cdn\.kkiapay\.me/, async (r) => { await new Promise((s) => setTimeout(s, 3000)); r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.openKkiapayWidget=function(){};window.addSuccessListener=function(){};' }); });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, async (r) => { await new Promise((s) => setTimeout(s, 1500)); r.fulfill({ status: 200, contentType: 'text/css', body: '' }); });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto('http://localhost:4173/connexion', { waitUntil: 'commit' });
  await page.waitForSelector('.login-form', { timeout: 20000 });
  mesures.push(Date.now() - t0);
  await ctx.close();
}
const pire = Math.max(...mesures);
console.log(`Formulaire de connexion affiché après : ${mesures.map((m) => `${m} ms`).join(' · ')}`);
await nav.close();
if (pire > 1500) { console.log(`❌ ouverture trop lente (${pire} ms) : un chargement externe bloque-t-il de nouveau ?`); process.exit(1); }
console.log('✅ Ouverture : aucun serveur externe ne bloque l’affichage');
