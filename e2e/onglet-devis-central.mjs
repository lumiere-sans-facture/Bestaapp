/* Barre d'onglets mobile : Tableau, Suivi, DEVIS AU CENTRE (un « + » sur
   pastille pleine), Boutique, Plus. Les libellés restent alignés, le « + »
   mène aux devis et s'entoure d'un anneau quand l'onglet est actif ; pendant
   le chargement d'un écran, la barre est la même. Serveur : npm run dev */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };

const ctx = await nav.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
await page.goto(B + '/');
await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
await page.goto(B + '/dashboard'); await page.locator('.tab-bar').waitFor(); await page.waitForTimeout(1200);

const barre = () => page.evaluate(() => [...document.querySelectorAll('.tab-bar .tab-item')].map((t) => {
  const libelle = t.querySelector('span:last-child');
  return {
    texte: libelle.textContent,
    central: t.classList.contains('tab-central'),
    pastille: !!t.querySelector('.tab-pastille'),
    actif: t.classList.contains('active'),
    basLibelle: Math.round(libelle.getBoundingClientRect().bottom),
    anneau: getComputedStyle(t.querySelector('.tab-pastille') || t).boxShadow,
  };
}));

let o = await barre();
ok(o.map((t) => t.texte).join(',') === 'Tableau,Suivi,Devis,Boutique,Plus', `ordre des onglets [${o.map((t) => t.texte).join(', ')}]`);
ok(o[2].central && o[2].pastille && o.filter((t) => t.pastille).length === 1, 'Devis au centre, seul onglet à pastille « + »');
ok(new Set(o.map((t) => t.basLibelle)).size === 1, `libellés alignés [${o.map((t) => t.basLibelle).join(', ')}]`);
await page.locator('.tab-bar').screenshot({ path: '/tmp/claude-0/onglets-repos.png' });

await page.locator('.tab-bar .tab-central').click(); await page.waitForTimeout(1200);
o = await barre();
ok(new URL(page.url()).pathname === '/devis' && o[2].actif, `le « + » mène aux devis [${new URL(page.url()).pathname}]`);
ok(/245, 166, 35/.test(o[2].anneau), 'onglet Devis actif : anneau orange autour du « + »');
await page.locator('.tab-bar').screenshot({ path: '/tmp/claude-0/onglets-devis-actif.png' });

// Pendant le chargement d'un écran (jamais livré ici) : même barre, même ordre.
await page.route(/\/src\/screens\/Boutique\.jsx/, () => {});
await page.goto(B + '/boutique', { waitUntil: 'domcontentloaded' });
await page.locator('[data-squelette]').first().waitFor({ timeout: 15000 }).catch(() => {});
const charge = await page.evaluate(() => [...document.querySelectorAll('.tab-bar .tab-item')].map((t) => (t.querySelector('.tab-pastille') ? '+' : '') + t.textContent));
ok(charge.join(',') === 'Tableau,Suivi,+Devis,Boutique,Plus', `barre pendant le chargement [${charge.join(', ')}]`);
await ctx.close();

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Onglets : Devis au centre avec un « + »');
process.exit(echecs ? 1 : 0);
