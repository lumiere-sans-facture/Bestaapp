/* « Mon entreprise » : les couleurs des documents se règlent au nuancier OU
   en tapant le code de la charte (« #E30613 », « E30613 », « #E31 »,
   « rgb(227, 6, 19) »). Le code s'applique dès qu'il est complet (aperçu en
   direct), un code faux est signalé sans rien effacer, le nuancier met le
   code à jour, et le document produit porte la couleur tapée.
   Serveur : npm run dev */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };

const ctx = await nav.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
await page.goto(B + '/privacy.html');
await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
await page.goto(B + '/dashboard'); await page.locator('.tab-bar').waitFor(); await page.waitForTimeout(1200);
await page.goto(B + '/privacy.html');
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('bestasolar_data'));
  const maintenant = new Date().toISOString();
  s.subscriptions = [{ id: 'sub-e2e', userId: 'u1', status: 'actif', formule: 'essentiel', dateDebut: maintenant, dateFin: new Date(Date.now() + 30 * 864e5).toISOString() }];
  s.companies = [{ id: 'comp-u1', userId: 'u1', facturePrefix: 'FAC', factureCounter: 0, nomEntreprise: 'ORT Bâtiment', telephone: '+228 90 00 00 00', modeleDefaut: 'studio', pays: 'tg', couleurPrimaire: '#0a2472', couleurSecondaire: '#f5a623' }];
  localStorage.setItem('bestasolar_data', JSON.stringify(s));
  localStorage.setItem('bestasolar_mode_u1', 'pro');
});
await page.goto(B + '/pro/entreprise');
const code = page.getByLabel('Couleur principale — code couleur');
const nuancier = page.getByLabel('Couleur principale — nuancier');
await code.waitFor({ timeout: 15000 });
const bandeau = () => page.locator('.fp-band').evaluate((b) => getComputedStyle(b).backgroundColor);
const taper = async (texte) => { await code.fill(''); await code.pressSequentially(texte, { delay: 20 }); };

ok(await code.inputValue() === '#0A2472', `code affiché, modifiable [${await code.inputValue()}]`);
await page.locator('label', { hasText: /^Couleur principale$/ }).click();
ok(await code.evaluate((i) => i === document.activeElement), 'toucher le libellé « Couleur principale » place le curseur dans le code');

await taper('#E30613');
ok(await bandeau() === 'rgb(227, 6, 19)' && await nuancier.inputValue() === '#e30613', `« #E30613 » : aperçu et nuancier en rouge [${await bandeau()}]`);

await taper('1b3a8f');
ok(await bandeau() === 'rgb(27, 58, 143)', `sans dièse « 1b3a8f » : appliqué [${await bandeau()}]`);

await taper('#E31');
await code.blur();
ok(await bandeau() === 'rgb(238, 51, 17)' && await code.inputValue() === '#EE3311', `forme courte « #E31 » → #EE3311 [${await code.inputValue()}]`);

await taper('rgb(227, 6, 19)');
await code.blur();
ok(await bandeau() === 'rgb(227, 6, 19)' && await code.inputValue() === '#E30613', `« rgb(227, 6, 19) » → #E30613 [${await code.inputValue()}]`);

// Code faux : rien n'est effacé, le champ reprend la couleur en place et le dit.
await taper('#E3');
ok(await bandeau() === 'rgb(227, 6, 19)', 'code incomplet « #E3 » : la couleur en place reste');
await code.blur();
const erreur = await page.locator('.field-error', { hasText: 'Code non reconnu' }).innerText().catch(() => '');
ok(/Code non reconnu/.test(erreur) && await code.inputValue() === '#E30613', `quitté incomplet : signalé, le champ reprend #E30613 [${await code.inputValue()}]`);
await taper('#GG0613'); await code.blur();
ok(await page.locator('.field-error', { hasText: 'Code non reconnu' }).count() === 1 && /^#[0-9A-F]{6}$/.test(await code.inputValue()), `code faux « #GG0613 » : signalé, couleur conservée [${await code.inputValue()}]`);

// Le nuancier met le code à jour.
await taper('#E30613'); await code.blur();
// (Setter natif : c'est ce que fait le nuancier du téléphone, React le voit.)
await nuancier.evaluate((i) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, '#2e7d32');
  i.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(200);
ok(await code.inputValue() === '#2E7D32' && await page.locator('.field-error', { hasText: 'Code non reconnu' }).count() === 0, `nuancier → code « #2E7D32 », erreur effacée`);

// Couleur secondaire aussi, puis enregistrement et document.
await taper('#E30613'); await code.blur();
const code2 = page.getByLabel('Couleur secondaire — code couleur');
await code2.fill(''); await code2.pressSequentially('FFD100', { delay: 20 }); await code2.blur();
await page.locator('.pro-company-form .my-partner-section', { hasText: 'Couleurs des documents' }).screenshot({ path: '/tmp/claude-0/couleurs-code.png' });
await page.getByRole('button', { name: 'Enregistrer' }).click(); await page.waitForTimeout(700);
const c = await page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')).companies.find((x) => x.userId === 'u1'));
ok(c.couleurPrimaire === '#e30613' && c.couleurSecondaire === '#ffd100', `enregistrées [${c.couleurPrimaire} · ${c.couleurSecondaire}]`);

await page.getByRole('button', { name: /Voir un aperçu du document/ }).click();
const cadre = page.frameLocator('.apercu-doc-cadre');
await cadre.locator('.pave').waitFor({ timeout: 15000 });
const pave = await cadre.locator('.pave').evaluate((p) => getComputedStyle(p).backgroundColor);
ok(pave === 'rgb(227, 6, 19)', `document Studio : bandeau titre à la couleur tapée [${pave}]`);

await nav.close();
console.log(R.join('\n'));
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : `\n✅ Couleurs : nuancier ou code couleur (${R.length} vérifications)`);
process.exit(echecs ? 1 : 0);
