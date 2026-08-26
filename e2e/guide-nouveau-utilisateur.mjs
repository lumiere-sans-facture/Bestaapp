/* Guide de bienvenue : un nouveau compte garde le focus dans la boîte
   modale, puis sa décision est mémorisée. */
import { chromium } from '@playwright/test';

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await nav.newPage({ viewport: { width: 1280, height: 900 } });
const resultats = [];
const ok = (condition, message) => { resultats.push(`${condition ? '✓ ' : '❌'}${message}`); return condition; };
const erreurs = [];
page.on('pageerror', (error) => erreurs.push(error.message));

const USER = { id: 'guide-u1', email: 'guide@bestasolar.bj', name: 'Nouvel utilisateur', role: 'technicien', phone: '+228', avatar: 'NU' };
await page.goto('http://localhost:3000');
await page.evaluate((user) => {
  localStorage.setItem('bestasolar_user', JSON.stringify(user));
  localStorage.setItem(`bestasolar_guide_accueil_v1:${user.id}`, 'a_voir');
}, USER);
await page.goto('http://localhost:3000/dashboard');
await page.waitForSelector('.guide-nouveau-carte', { timeout: 15000 });

const dialog = page.locator('.guide-nouveau-carte');
ok(await dialog.count() === 1, 'le guide est ouvert pour le nouveau compte');
ok(await page.evaluate(() => {
  const guide = document.querySelector('.guide-nouveau-carte');
  return document.activeElement === guide;
}), 'le guide reçoit le focus à son ouverture');

// Tab reste dans la boîte, même si le focus était placé sur le dernier bouton.
const boutons = dialog.locator('button');
const premier = boutons.first();
const dernier = boutons.last();
await dernier.focus();
await page.keyboard.press('Tab');
ok(await page.evaluate(() => {
  const guide = document.querySelector('.guide-nouveau-carte');
  return guide?.contains(document.activeElement)
    && document.activeElement === guide.querySelector('button');
}), 'Tab après le dernier bouton revient au premier bouton du guide');

await premier.focus();
await page.keyboard.press('Shift+Tab');
ok(await page.evaluate(() => {
  const guide = document.querySelector('.guide-nouveau-carte');
  const buttons = [...guide.querySelectorAll('button')];
  return document.activeElement === buttons[buttons.length - 1];
}), 'Maj+Tab avant le premier bouton revient au dernier bouton du guide');

await dialog.locator('button:has-text("Passer")').click();
await page.waitForTimeout(200);
ok(await dialog.count() === 0, 'le guide se ferme à la demande');
ok(await page.evaluate((user) =>
  localStorage.getItem(`bestasolar_guide_accueil_v1:${user.id}`) === 'termine', USER),
'la fermeture est mémorisée pour ce compte');

console.log('\n' + resultats.join('\n'));
console.log(erreurs.length ? `\n❌ erreurs JS : ${erreurs.join(' | ')}` : '\naucune erreur JS');
await nav.close();
const echecs = resultats.filter((resultat) => resultat.startsWith('❌')).length + erreurs.length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ guide nouveau utilisateur conforme');
process.exit(echecs ? 1 : 0);
