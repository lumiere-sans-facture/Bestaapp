/* Squelette de chargement à la forme de LA page rechargée : colonnes du
   suivi, cartes clients, grille de la boutique, liste des devis, menu
   « Plus », vitrine pour la page d'accueil — plus jamais celui du tableau
   de bord partout. L'écran demandé est volontairement jamais livré pour
   figer le squelette. Lancer `npm run dev` à côté. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const cas = [
  ['/dashboard', 'Dashboard', 'tableau', null, 'Tableau'],
  ['/pipeline', 'Pipeline', 'kanban', 'Suivi clients', 'Suivi'],
  ['/clients', 'Clients', 'cartes', 'Clients', null],
  ['/boutique', 'Boutique', 'boutique', 'Boutique', 'Boutique'],
  ['/devis', 'Devis', 'liste', 'Devis', 'Devis'],
  ['/plus', 'Plus', 'menu', 'Plus', 'Plus'],
  ['/plus/kits', 'Plus', 'sous-page', null, 'Plus'],
];
for (const [url, ecran, forme, titre, onglet] of cas) {
  const ctx = await nav.newContext({ viewport: { width: 412, height: 860 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => R.push(`❌ ERREUR JS (${url}) : ${e}`));
  await page.goto(B + '/privacy.html');
  await page.evaluate(() => localStorage.setItem('bestasolar_user', JSON.stringify({ id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' })));
  await page.route(new RegExp(`/src/screens/${ecran}\\.jsx`), () => {});
  await page.goto(B + url, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-squelette]').first().waitFor({ timeout: 15000 }).catch(() => {});
  const vu = await page.evaluate(() => ({
    forme: document.querySelector('[data-squelette]')?.dataset.squelette || null,
    titre: document.querySelector('.page-title')?.textContent || null,
    onglet: document.querySelector('.tab-item.active')?.textContent || null,
  }));
  ok(vu.forme === forme && vu.titre === titre && vu.onglet === onglet,
    `${url} : squelette « ${vu.forme} », titre ${vu.titre ?? '(barre)'}, onglet ${vu.onglet ?? '(aucun)'}`);
  await ctx.close();
}

// Page d'accueil (vitrine) : un squelette de vitrine, pas celui de l'app.
const ctx = await nav.newContext({ viewport: { width: 412, height: 860 } });
const page = await ctx.newPage();
await page.route(/\/src\/screens\/Landing\.jsx/, () => {});
await page.goto(B + '/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500);
const accueil = await page.evaluate(() => ({ app: !!document.querySelector('.app-shell, .tab-bar'), chargement: /Chargement/.test(document.body.innerText) }));
ok(accueil.chargement && !accueil.app, 'page d’accueil : squelette de vitrine, sans barre d’onglets de l’application');
await ctx.close();

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Chargement : chaque page garde sa forme au rafraîchissement');
process.exit(echecs ? 1 : 0);
