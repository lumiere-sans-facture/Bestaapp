/* Statut de synchronisation (« Données partagées en temps réel », éléments
   en attente, « Synchroniser maintenant ») : visible du gérant seulement,
   dans « Plus » comme dans les paramètres. La carte « Passer en mode Pro »
   reste pour tous. Lancer `npm run dev` à côté. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
for (const role of ['gerant', 'technicien']) {
  const ctx = await nav.newContext({ viewport: { width: 412, height: 860 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
  await page.goto(B + '/privacy.html');
  await page.evaluate((r) => localStorage.setItem('bestasolar_user', JSON.stringify({ id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: r, phone: '+228', avatar: 'A' })), role);
  for (const url of ['/plus', '/plus/parametres']) {
    await page.goto(B + url); await page.locator('.page-content').first().waitFor(); await page.waitForTimeout(1200);
    const statut = await page.locator('.sync-inline').count();
    ok(role === 'gerant' ? statut === 1 : statut === 0, `${role} ${url} : statut de synchronisation ${statut ? 'affiché' : 'masqué'}`);
  }
  await page.goto(B + '/plus'); await page.waitForTimeout(1000);
  ok(await page.locator('.pro-cta').count() === 1, `${role} : la carte « Passer en mode Pro » reste affichée`);
  await ctx.close();
}
console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Synchronisation : statut réservé au gérant');
process.exit(echecs ? 1 : 0);
