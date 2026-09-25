/* Tension batterie : un onduleur n'est jamais proposé pour un kit d'une
   autre tension. Les formulaires « Onduleurs » et « Mes kits » affichent la
   tension ; un kit 24 V dont les panneaux dépassent son onduleur 3 kVA ne
   reçoit PAS un 6 kVA 48 V : l'assistant avertit à la place. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const page = await nav.newPage({ viewport: { width: 1280, height: 950 } });
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
const B = 'http://localhost:3000';
await page.goto(B + '/');
await page.evaluate(() => localStorage.setItem('bestasolar_user', JSON.stringify({ id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' })));

// ---- 1. ONDULEURS : tension affichée et modifiable ----
await page.goto(B + '/plus/inverters');
await page.waitForTimeout(1500);
const listeOnd = await page.evaluate(() => document.querySelector('.page-content')?.innerText || '');
ok(/3 kVA · 24 V/.test(listeOnd) && /6 kVA · 48 V/.test(listeOnd), 'Onduleurs : la tension figure dans la liste (3 kVA · 24 V, 6 kVA · 48 V)');
await page.locator('button:has-text("Modifier")').first().click();
await page.waitForTimeout(400);
const choix = await page.locator('.sheet select').first().evaluate((s) => [...s.options].map((o) => o.text));
ok(choix.join('|') === 'Non renseignée|12 V|24 V|48 V', `formulaire onduleur : ${choix.join(' / ')}`);
await page.keyboard.press('Escape');

// ---- 2. MES KITS : tension affichée ; on gonfle le kit 2,5 kWh à 20 panneaux (10 000 Wc, au-delà de 2 × 3 kVA) ----
await page.goto(B + '/plus/kits');
await page.waitForTimeout(1500);
const listeKits = await page.evaluate(() => document.querySelector('.page-content')?.innerText || '');
ok(/batterie 24 V/.test(listeKits) && /batterie 48 V/.test(listeKits) && /batterie 12 V/.test(listeKits), 'Mes kits : la tension batterie figure dans la liste');
const carte = page.locator('.kit-card', { hasText: 'Kit 2,5 kWh — Essentiel' });
await carte.locator('button:has-text("Modifier")').click();
await page.waitForTimeout(400);
const tensionKit = await page.locator('.sheet select').first().inputValue();
ok(tensionKit === '24', `formulaire kit : tension 24 V déjà renseignée [${tensionKit}]`);
const champPanneaux = page.locator('.sheet .input-group', { hasText: 'Nombre de panneaux' }).locator('input');
await champPanneaux.fill('20');
await page.locator('.sheet button[type="submit"]').click();
await page.waitForTimeout(800);

// ---- 3. ASSISTANT : un petit besoin → kit 2,5 kWh 24 V, 20 panneaux ----
const suivant = () => page.locator('button:has-text("Suivant")').first();
await page.goto(B + '/devis');
await page.waitForTimeout(1500);
await page.locator('button:has-text("Créer un devis"), button:has-text("Nouveau devis")').first().click();
await page.waitForTimeout(800);
await page.locator(':text("Dimensionnement solaire")').first().click();
await page.waitForTimeout(900);
await page.locator('.page-content button').nth(1).click();
await page.waitForTimeout(300);
await suivant().click(); await page.waitForTimeout(800);
const sel = page.locator('select').first();
await sel.selectOption(await sel.evaluate((el) => [...el.options].find((x) => x.text.includes('Téléviseur'))?.value || ''));
await page.locator('.wizard-form button.btn-primary').first().click(); await page.waitForTimeout(500);
await suivant().click(); await page.waitForTimeout(800);
await suivant().click(); await page.waitForTimeout(1600);
const ecran = await page.evaluate(() => document.querySelector('.page-content')?.innerText || '');
if (process.env.DEBUG) console.log(ecran.slice(0, 1500));
ok(/Kit 2,5 kWh — Essentiel/.test(ecran), 'le kit 2,5 kWh (24 V) est suggéré pour ce petit besoin');
const equipements = ecran.slice(ecran.indexOf('ÉQUIPEMENTS'));
ok(!/6kVA|12kVA|6kva|12kva/.test(equipements), 'aucun onduleur 48 V (6 ou 12 kVA) dans le devis du kit 24 V');
ok(/Aucun onduleur 24 V configuré\s+ne tient ce besoin/.test(ecran), 'l’assistant avertit : aucun onduleur 24 V ne suffit');
await page.locator('[role="alert"]', { hasText: 'Aucun onduleur 24 V' }).first().screenshot({ path: '/tmp/claude-0/alerte-tension.png' }).catch(() => {});

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Tension : jamais d’onduleur d’une autre tension que la batterie du kit');
process.exit(echecs ? 1 : 0);
