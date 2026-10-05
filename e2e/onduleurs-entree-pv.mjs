/* Configuration des onduleurs : tension DC max et nombre de MPPT, saisis
   dans « Plus › Onduleurs », puis utilisés par l'assistant pour calculer les
   chaînes d'un kit étendu. Lancer `npm run dev` à côté. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
const B = 'http://localhost:3000';
await page.goto(B + '/');
await page.evaluate(() => localStorage.setItem('bestasolar_user', JSON.stringify({ id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' })));

// ---- 1. LISTE : ce qui manque est signalé ----
await page.goto(B + '/plus/inverters'); await page.waitForTimeout(1500);
const carteHz = () => page.locator('.kit-card', { hasText: 'HZ Onduleur hybride 6kVA' });
ok(/à compléter : tension max et nombre de MPPT/.test(await carteHz().innerText()), 'HZ 6 kVA : « à compléter : tension max et nombre de MPPT »');
ok(/2 MPPT · 500 V DC max/.test(await page.locator('.kit-card', { hasText: 'Deye Onduleur hybride 6kVA' }).innerText()), 'Deye 6 kVA : déjà renseigné (2 MPPT · 500 V DC max)');

// ---- 2. FORMULAIRE : les deux valeurs en avant, le reste replié ----
await carteHz().locator('button:has-text("Modifier")').click(); await page.waitForTimeout(500);
const feuille = page.locator('.sheet');
ok(await feuille.getByLabel('Tension DC max (V)').isVisible() && await feuille.getByLabel('Nombre de MPPT').isVisible(),
   'tension DC max et nombre de MPPT visibles d’emblée');
ok(!(await feuille.getByLabel('Plage MPPT min (V)').isVisible()), 'les détails (plage MPPT, courants) sont repliés');
await feuille.getByLabel('Tension DC max (V)').fill('500');
await feuille.getByLabel('Nombre de MPPT').fill('1');
await feuille.screenshot({ path: '/tmp/claude-0/onduleur-formulaire.png' });
await feuille.locator('button[type="submit"]').click(); await page.waitForTimeout(800);
const texteHz = await carteHz().innerText();
ok(/1 MPPT · 500 V DC max/.test(texteHz) && !/à compléter/.test(texteHz), `HZ 6 kVA enregistré : ${/\d MPPT · \d+ V DC max/.exec(texteHz)?.[0]}`);
const hz = await page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')).inverters.find((o) => o.id === 'hz-6kva'));
ok(hz?.electrique?.vocMax === 500 && hz.electrique.nbMppt === 1, 'valeurs enregistrées dans les données');

// ---- 3. ASSISTANT : le kit HZ étendu est vérifié avec ces valeurs ----
const suivant = () => page.locator('button:has-text("Suivant")').first();
await page.goto(B + '/devis'); await page.waitForTimeout(1500);
await page.locator('button:has-text("Créer un devis"), button:has-text("Nouveau devis")').first().click();
await page.waitForTimeout(800);
await page.locator(':text("Dimensionnement solaire")').first().click(); await page.waitForTimeout(900);
await page.locator('.page-content button').nth(1).click(); await page.waitForTimeout(400);
await suivant().click(); await page.waitForTimeout(700);
await page.locator('button:has-text("Saisie directe")').click();
await page.locator('.manual-consumption-grid input').nth(0).fill('30');
await page.locator('.manual-consumption-grid input').nth(1).fill('3');
await suivant().click(); await page.waitForTimeout(900);
await suivant().click(); await page.waitForTimeout(1500);
await page.locator('.kit-option', { hasText: /^Kit 5 kWh\s*Suggéré/ }).first().click(); await page.waitForTimeout(800);
const section = (await page.locator('.ajustements-kit').innerText()).replace(/\s+/g, ' ');
ok(/Kit de base — Kit 5 kWh 4 panneaux/.test(section), 'kit 5 kWh HZ étendu');
ok(!/non vérifiées/.test(section) && /Chaînes solaires 1 chaîne de 4 panneaux →/.test(section), `chaînes calculées avec les valeurs saisies [${/Chaînes solaires (.*?) Onduleur/.exec(section)?.[1]}]`);
ok(/Onduleur remplacé/i.test(section) && /au plus 1 chaîne/.test(section), 'raison : 1 seul MPPT, une seule chaîne possible');

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Onduleurs : tension max et MPPT saisis, utilisés pour les chaînes');
process.exit(echecs ? 1 : 0);
