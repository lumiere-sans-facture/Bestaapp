/* Écran fixe en largeur sur mobile : aucune page ne défile à gauche ou à
   droite, et les cinq onglets du bas restent entièrement visibles. Un
   graphique trop large (catalogue par catégorie) élargissait le tableau de
   bord — la page glissait et l'onglet « Tableau » sortait de l'écran.
   Lancer `npm run dev` à côté. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
for (const largeur of [360, 412]) {
  const ctx = await nav.newContext({ viewport: { width: largeur, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
  await page.goto(B + '/privacy.html');
  await page.evaluate(() => localStorage.setItem('bestasolar_user', JSON.stringify({ id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' })));
  for (const url of ['/dashboard', '/pipeline', '/clients', '/boutique', '/devis', '/plus']) {
    await page.goto(B + url); await page.locator('.tab-bar').waitFor(); await page.waitForTimeout(1200);
    await page.evaluate(() => window.scrollTo(400, 0));
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      // Éléments qui dépassent l'écran, hors zones conçues pour défiler.
      const debords = [...document.querySelectorAll('.app-main *')].filter((e) => e.getBoundingClientRect().right > vw + 1
        && !e.closest('.kanban-container, .categories-scroll, .stat-strip')).length;
      const onglets = [...document.querySelectorAll('.tab-bar .tab-item')].filter((t) => { const b = t.getBoundingClientRect(); return b.left >= 0 && b.right <= vw; }).length;
      return { scrollX: window.scrollX, debords, onglets };
    });
    ok(r.scrollX === 0 && r.debords === 0 && r.onglets === 5, `${largeur} px ${url} : pas de défilement latéral, 5 onglets visibles [débords ${r.debords}, onglets ${r.onglets}]`);
  }
  await ctx.close();
}
console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Mobile : écran fixe en largeur, cinq onglets visibles');
process.exit(echecs ? 1 : 0);
