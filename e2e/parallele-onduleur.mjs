/* Mise en parallèle des onduleurs : réglée par modèle dans « Plus ›
   Onduleurs » (oui/non + nombre maximal). Un kit 24 V gonflé à 20 panneaux
   (10 000 Wc) reçoit 3 × 3 kVA si le modèle en accepte 4 ; si le modèle est
   déclaré « non couplable », l'assistant avertit au lieu d'en doubler. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const page = await nav.newPage({ viewport: { width: 1280, height: 950 } });
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
const B = 'http://localhost:3000';
await page.goto(B + '/');
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('bestasolar_user', JSON.stringify({ id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' })); });

const regler = async (parallele, max, marque = 'HZ') => {
  await page.goto(B + '/plus/inverters');
  await page.waitForTimeout(1200);
  await page.locator('.kit-card', { hasText: marque }).filter({ hasText: '3 kVA' }).locator('button:has-text("Modifier")').click();
  await page.waitForTimeout(400);
  const choixParallele = page.locator('.sheet .input-group', { hasText: 'Mise en parallèle' }).locator('select');
  await choixParallele.selectOption(parallele ? 'oui' : 'non');
  if (parallele) await page.locator('.sheet .input-group', { hasText: 'Nombre max en parallèle' }).locator('input').fill(String(max));
  else ok(await page.locator('.sheet :text("Nombre max en parallèle")').count() === 0, 'le nombre max disparaît quand l’onduleur n’est pas couplable');
  await page.locator('.sheet button[type="submit"]').click();
  await page.waitForTimeout(700);
  return page.evaluate(() => document.querySelector('.page-content')?.innerText || '');
};

const devis = async () => {
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
  return page.evaluate(() => document.querySelector('.page-content')?.innerText || '');
};

// Kit 2,5 kWh Essentiel (24 V) gonflé à 20 panneaux 500 Wc.
await page.goto(B + '/plus/kits');
await page.waitForTimeout(1500);
await page.locator('.kit-card', { hasText: 'Kit 2,5 kWh — Essentiel' }).locator('button:has-text("Modifier")').click();
await page.waitForTimeout(400);
await page.locator('.sheet .input-group', { hasText: 'Nombre de panneaux' }).locator('input').fill('20');
await page.locator('.sheet button[type="submit"]').click();
await page.waitForTimeout(800);

// ---- 1. Parallèle jusqu'à 4 ----
const liste = await regler(true, 4);
ok(/3 kVA · 24 V · PV max 3900 Wc · parallèle ×4 max/.test(liste), 'la liste affiche « parallèle ×4 max »');
let ecran = await devis();
if (process.env.DEBUG) console.log(ecran.slice(0, 1200));
ok(/Onduleur hybride 3kVA HZ × 3/.test(ecran), '20 panneaux : 3 × 3 kVA HZ en parallèle au devis');
ok(!/ne tient ce besoin/.test(ecran), 'aucune alerte : trois appareils suffisent');
await page.locator('.storage-alert, .abo-alert', { hasText: 'en parallèle' }).first().screenshot({ path: '/tmp/claude-0/parallele-3.png' }).catch(() => {});

// ---- 2. Non couplable : les DEUX 3 kVA 24 V (HZ et Itel), sinon l'assistant
// se rabat — à juste titre — sur 2 × Itel ----
await regler(false, 0, 'Itel');
const liste2 = await regler(false);
ok(/3 kVA · 24 V · PV max 3900 Wc · sans parallèle/.test(liste2), 'la liste affiche « sans parallèle »');
ecran = await devis();
if (process.env.DEBUG) console.log(ecran.slice(ecran.indexOf('ÉQUIPEMENTS'), ecran.indexOf('ÉQUIPEMENTS') + 400));
ok(!/× 2|× 3/.test(ecran.slice(ecran.indexOf('ÉQUIPEMENTS')).split('\n').filter((l) => /Onduleur/.test(l)).join(' ')) && /Onduleur hybride 3kVA (HZ|Itel)/i.test(ecran), 'un seul 3 kVA au devis, jamais doublé (ni HZ ni Itel)');
ok(/Aucun onduleur 24 V configuré\s+ne tient ce besoin, même en parallèle/.test(ecran), 'l’assistant avertit que rien ne suffit');

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Parallèle : l’assistant respecte le réglage de chaque onduleur');
process.exit(echecs ? 1 : 0);
