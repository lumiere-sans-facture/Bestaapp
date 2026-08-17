/* Phase 1 — états de devis, compte à rebours, conversion en vente.
   Les devis sont créés PAR L'INTERFACE, et le temps est avancé avec l'horloge
   simulée de Playwright : aucune donnée n'est écrite à la main. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const page = await nav.newPage({ viewport: { width: 1280, height: 950 } });
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
const JOUR = 86400000;
const T0 = Date.now();
await page.clock.install({ time: new Date(T0) });

const GERANT = { id: 'u1', email: 'boss@bestasolar.bj', name: 'Adam', role: 'gerant', phone: '+229', avatar: 'A' };
await page.goto('http://localhost:3000');
await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);

const creerDevis = async (indexClient) => {
  await page.goto('http://localhost:3000/devis');
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("Créer un devis"), button:has-text("Nouveau devis")').first().click();
  await page.waitForTimeout(800);
  await page.locator(':text("Sélection manuelle")').first().click();
  await page.waitForTimeout(1000);
  await page.locator('.page-content button').nth(indexClient + 1).click();   // 0 = « Annuler »
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Suivant")').first().click();
  await page.waitForTimeout(900);
  await page.locator('.page-content button').nth(2).click();                 // premier produit
  await page.waitForTimeout(500);
  const fin = page.locator('button:has-text("Finaliser"), button:has-text("Enregistrer"), button:has-text("Créer le devis")').first();
  await fin.click();
  await page.waitForTimeout(1800);
};

await creerDevis(0);
await creerDevis(1);
await page.goto('http://localhost:3000/devis');
await page.waitForTimeout(1800);
const nb = await page.evaluate(() => document.querySelectorAll('.flat-row').length);
ok(nb >= 2, `deux devis créés par l'interface [${nb} lignes]`);
let t = await page.evaluate(() => document.querySelector('.page-content')?.innerText || '');
ok(/En cours/.test(t), 'un devis neuf est « En cours »');
ok(!/Expire dans/.test(t), 'aucun compte à rebours tant que l’échéance est loin');

// --- J+26 : l'échéance approche (validité 30 jours) ---
await page.clock.setFixedTime(new Date(T0 + 26 * JOUR));
await page.reload(); await page.waitForTimeout(2000);
t = await page.evaluate(() => document.querySelector('.page-content')?.innerText || '');
ok(/Expire dans 4 j/.test(t), `le compte à rebours s'affiche à l'approche [${(t.match(/Expire[^\n·]*/) || ['absent'])[0]}]`);

// --- J+40 : la validité est passée ---
await page.clock.setFixedTime(new Date(T0 + 40 * JOUR));
await page.reload(); await page.waitForTimeout(2000);
// La LISTE seule : « En cours » figure aussi sur la puce de filtre.
const liste = await page.evaluate(() => document.querySelector('.flat-list')?.innerText || '');
ok(/Expiré/.test(liste) && !/En cours/.test(liste), 'passée la validité, les devis sont « Expirés »');

await page.locator('.category-chip:has-text("Expirés")').first().click();
await page.waitForTimeout(700);
ok((await page.evaluate(() => document.querySelectorAll('.flat-row').length)) === nb, 'le filtre « Expirés » les retrouve tous');
await page.locator('.category-chip:has-text("En cours")').first().click();
await page.waitForTimeout(700);
ok((await page.evaluate(() => document.querySelectorAll('.flat-row').length)) === 0, 'le filtre « En cours » n’en montre plus aucun');
await page.locator('.category-chip:has-text("Tous")').first().click();
await page.waitForTimeout(600);

// --- Conversion en vente ---
const avant = await page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')).commissions.length);
await page.locator('.flat-row').first().click();
await page.waitForTimeout(800);
const panneau = await page.evaluate(() => document.querySelector('.sheet')?.innerText || '');
ok(/Valable jusqu’au/.test(panneau), 'le panneau donne la date de fin de validité');
ok(/Convertir en vente/.test(panneau), 'le gérant peut convertir, même un devis expiré');
await page.locator('.sheet button:has-text("Convertir en vente")').first().click();
await page.waitForTimeout(700);
ok(/figé/.test(await page.evaluate(() => document.body.innerText)), 'la confirmation annonce que le montant est figé');
await page.locator('button:has-text("Convertir en vente")').last().click();
await page.waitForTimeout(2000);

const apres = await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('bestasolar_data'));
  const v = d.devis.find((x) => x.stage === 'gagne');
  return { commissions: d.commissions.length, montantVente: v?.montantVente, total: v?.total, wonAt: v?.wonAt };
});
ok(apres.montantVente > 0 && apres.montantVente === apres.total, `le montant de vente est figé [${apres.montantVente}]`);
ok(apres.commissions > avant, `la commission de l'apporteur est générée [${avant} → ${apres.commissions}]`);
ok(/Converti en vente/.test(await page.evaluate(() => document.querySelector('.flat-list')?.innerText || '')),
   'le devis vendu est badgé « Converti en vente »');

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Devis : expiration, filtres et conversion en vente conformes');
process.exit(echecs ? 1 : 0);
