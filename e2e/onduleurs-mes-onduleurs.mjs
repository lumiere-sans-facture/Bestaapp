/* Espace Pro, proposition « sur mesure » : les onduleurs proposés sont ceux
   de « Mes onduleurs » (Plus › Onduleurs), jamais ceux de la boutique.
   Un onduleur reconnaissable est ajouté de chaque côté ; seul celui de
   « Mes onduleurs » doit apparaître. Lancer `npm run dev` à côté. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const page = await nav.newPage({ viewport: { width: 1280, height: 1000 } });
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
const B = 'http://localhost:3000';
await page.goto(B + '/');
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('bestasolar_user', JSON.stringify({ id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' })); });
await page.goto(B + '/dashboard'); await page.waitForTimeout(1500); // état initial écrit par l'app

// État préparé depuis une page statique (l'app ne réécrit pas le stockage).
await page.goto(B + '/privacy.html');
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('bestasolar_data'));
  s.subscriptions = [{ id: 'sub-e2e', userId: 'u1', status: 'actif', formule: 'essentiel', dateDebut: new Date().toISOString(), dateFin: new Date(Date.now() + 30 * 864e5).toISOString() }];
  s.inverters = [...s.inverters, { id: 'ond-victron', brand: 'Victron', model: 'Onduleur hybride 10kVA', capacity: 10, maxPvPower: 13000, price: 1234000, tension: 48 }];
  s.products = [...s.products, { id: 'prod-boutique', name: 'Onduleur Boutiquex 10kva', category: 'onduleurs', basePrice: 500000, stock: 3 }];
  localStorage.setItem('bestasolar_data', JSON.stringify(s));
  localStorage.setItem('bestasolar_mode_u1', 'pro');
});
await page.goto(B + '/pro/documents'); await page.waitForTimeout(1800);
await page.locator('button:has-text("Nouveau devis")').first().click(); await page.waitForTimeout(600);
await page.locator('.devis-mode-card.featured').click(); await page.waitForTimeout(800);
await page.getByLabel('Nom complet *').fill('Client Essai Onduleurs');
const etape = () => page.locator('.wizard-actions .btn-primary').first();
await etape().click(); await page.waitForTimeout(600);
await page.locator('button:has-text("Saisie directe")').click();
await page.locator('.manual-consumption-grid input').nth(0).fill('30');
await page.locator('.manual-consumption-grid input').nth(1).fill('10');
await etape().click(); await page.waitForTimeout(800);
await etape().click(); await page.waitForTimeout(1500);
await page.locator('.client-type-btn', { hasText: 'sur mesure' }).or(page.locator('.client-type-btn').nth(1)).first().click();
await page.waitForTimeout(800);
const marques = await page.locator('.categories-scroll').first().innerText();
ok(/Victron/.test(marques) && /Deye/.test(marques), `marques de « Mes onduleurs » proposées [${marques.replace(/\s+/g, ' ')}]`);
ok(!/Boutiquex/i.test(marques), 'aucune marque de la boutique');
await page.locator('.category-chip', { hasText: 'Victron' }).click(); await page.waitForTimeout(600);
const options = (await page.locator('.kit-options').first().innerText()).replace(/\s+/g, ' ');
ok(/Onduleur hybride 10kVA Victron/.test(options) && /1\s?234\s?000/.test(options), `l’onduleur configuré, à son prix [${options.slice(0, 120)}]`);
// Hors du menu « ajouter un produit » (un article boutique s'y ajoute à la
// main, c'est voulu) : rien de ce que l'assistant propose ne vient de la boutique.
const ecran = await page.evaluate(() => {
  const c = document.querySelector('.page-content').cloneNode(true);
  c.querySelectorAll('select').forEach((x) => x.remove());
  return c.innerText;
});
ok(!/Boutiquex/i.test(ecran), 'l’onduleur de la boutique n’est ni proposé ni au devis');
await page.locator('.page-content').screenshot({ path: '/tmp/claude-0/pro-onduleurs.png' }).catch(() => {});

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Onduleurs : ceux de « Mes onduleurs », jamais la boutique');
process.exit(echecs ? 1 : 0);
