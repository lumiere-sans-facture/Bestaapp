/* Code partenaire imprimé sur le devis : un client de démonstration apporté par un partenaire
   → devis créé par l'assistant → le document imprimable porte la référence
   (nom et code). Lancer `npm run dev` à côté. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };
await page.goto(B + '/');
await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
await page.waitForTimeout(1200);
const etat = () => page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')));
const suivant = () => page.locator('button:has-text("Suivant")').first();

// ---- 1. DEVIS SOLAIRE PAR L'ASSISTANT ----
await page.goto(B + '/devis');
await page.waitForTimeout(1800);
await page.locator('button:has-text("Créer un devis"), button:has-text("Nouveau devis")').first().click();
await page.waitForTimeout(900);
await page.locator(':text("Dimensionnement solaire")').first().click();
await page.waitForTimeout(1000);
await page.locator('.page-content button').nth(1).click();
await page.waitForTimeout(600);
// Le client de démonstration choisi est apporté par un partenaire.
const etape1 = await page.evaluate(() => document.querySelector('.page-content')?.innerText || '');
await suivant().click(); await page.waitForTimeout(900);
const select = page.locator('select').first();
const val = await select.evaluate((el) => [...el.options].find((x) => x.text.includes('Téléviseur'))?.value || '');
await select.selectOption(val); await page.waitForTimeout(300);
await page.locator('.wizard-form button.btn-primary').first().click(); await page.waitForTimeout(500);
await suivant().click(); await page.waitForTimeout(900);
await suivant().click(); await page.waitForTimeout(1600);
await page.locator('button:has-text("Finaliser"), button:has-text("Enregistrer"), button:has-text("Créer le devis")').first().click();
await page.waitForTimeout(2000);
const s = await etat();
const devis = s.devis.find((d) => d.type === 'solar');
const partenaire = s.partners.find((p) => p.id === devis?.partnerId);
ok(!!partenaire && devis.partnerCode === partenaire.code, `le devis garde le partenaire et son code [${partenaire?.name} · ${devis?.partnerCode}]`);
ok(etape1.includes(partenaire?.name), `l’assistant affichait cet apporteur [${partenaire?.name}]`);

// ---- 2. DOCUMENT IMPRIMABLE ----
await page.goto(B + '/devis');
await page.waitForTimeout(1500);
await page.locator('.flat-row').first().click();
await page.waitForTimeout(700);
const [doc] = await Promise.all([ctx.waitForEvent('page'), page.locator('.sheet button', { hasText: 'Devis imprimable' }).click()]);
await doc.waitForLoadState(); await doc.waitForTimeout(800);
const texte = await doc.evaluate(() => document.body.innerText);
const attendu = `Réf. partenaire : ${partenaire?.name} · ${partenaire?.code}`;
ok(texte.includes(attendu), `le devis imprimé porte « ${attendu} »`);
const deborde = await doc.evaluate(() => [...document.querySelectorAll('.page')].some((p) => p.scrollHeight > p.clientHeight + 1));
ok(!deborde, 'aucune page du document ne déborde');
await doc.screenshot({ path: '/tmp/claude-0/devis-partenaire.png', clip: { x: 0, y: 0, width: 1280, height: 620 } });

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Partenaire : le code figure sur le devis imprimé');
process.exit(echecs ? 1 : 0);
