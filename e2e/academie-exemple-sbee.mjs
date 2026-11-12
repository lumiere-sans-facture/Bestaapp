/* Académie : l'exemple de facture SBEE se refait dans l'application et donne
   les chiffres de la leçon. Le stagiaire suit l'exercice (25 000 F par mois
   à 145 F le kWh) dans l'assistant de dimensionnement, de l'espace public
   puis de l'espace Pro, en « Équilibré » puis « Surtout le soir » : il doit
   lire environ 172 kWh par mois, une batterie conseillée de 3,8 puis
   5,3 kWh, et les kits 3,8 kWh puis 10 kWh. La leçon affiche bien ces
   chiffres. Lancer `npm run dev` à côté. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };
const plat = (t) => t.replace(/[\s  ]+/g, ' ');

const ctx = await nav.newContext({ viewport: { width: 412, height: 900 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
await page.goto(B + '/privacy.html');
await page.evaluate((u) => {
  localStorage.setItem('bestasolar_user', JSON.stringify(u));
  localStorage.setItem(`bestasolar_guide_accueil_v1:${u.id}`, 'termine');
}, GERANT);
await page.goto(B + '/dashboard'); await page.locator('.tab-bar').waitFor({ timeout: 15000 }); await page.waitForTimeout(1000);

/** Étape Consommation : facture SBEE de l'exercice, répartition choisie. */
const saisirFacture = async (repartition) => {
  await page.getByRole('button', { name: 'Facture CEET/SBEE (F CFA)' }).click();
  await page.getByLabel('Facture mensuelle moyenne (F CFA)').fill('25000');
  await page.getByLabel('Prix du kWh (F CFA)').fill('145');
  await page.getByRole('button', { name: repartition, exact: true }).click();
  return plat(await page.locator('.field-hint[role="status"]').innerText());
};
// Affichée à la française, comme dans la leçon : « 3,8 kWh ».
const batterie = async () => plat(await page.locator('.sizing-card', { hasText: 'Batterie conseillée' }).locator('.sizing-value').innerText());
const kits = async () => (await page.locator('.kit-option-name').allInnerTexts()).map((t) => plat(t).replace(/ Suggéré$/, '').trim());
const etape = async (n) => page.locator('.steps-label', { hasText: `Étape ${n}` }).waitFor({ timeout: 10000 });

const ATTENDU = { 'Équilibré jour / nuit': ['3,8 kWh', /^Kit 3,8 kWh/], 'Surtout le soir': ['5,3 kWh', /^Kit 10 kWh/] };

// ---- 1. Assistant de l'espace public (+ → Dimensionnement solaire) ----
for (const [repartition, [batt, kit]] of Object.entries(ATTENDU)) {
  await page.goto(B + '/devis'); await page.waitForTimeout(1000);
  await page.locator('button:has-text("Créer un devis"), button:has-text("Nouveau devis")').first().click();
  await page.locator(':text("Dimensionnement solaire")').first().click(); await page.waitForTimeout(800);
  await page.locator('.page-content button').nth(1).click(); await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Suivant/ }).first().click();
  await etape(2);
  const conso = await saisirFacture(repartition);
  ok(/≈ 172,41 kWh consommés par mois, soit 5,74 kWh par jour/.test(conso), `public · ${repartition} : 172 kWh par mois, 5,7 par jour [${conso.slice(0, 70)}]`);
  // Étape 3 : besoins calculés (dont la batterie) ; étape 4 : le kit.
  await page.getByRole('button', { name: /Suivant/ }).first().click(); await etape(3); await page.waitForTimeout(600);
  const b = await batterie();
  await page.getByRole('button', { name: /Suivant/ }).first().click(); await etape(4); await page.waitForTimeout(600);
  const k = await kits();
  ok(b === batt, `public · ${repartition} : batterie conseillée ${batt} [${b}]`);
  ok(k.length > 0 && k.every((n) => kit.test(n)), `public · ${repartition} : kit suggéré ${kit.source.slice(1)} [${k.join(' / ')}]`);
}

// ---- 2. Assistant de l'espace Pro ----
await page.goto(B + '/privacy.html');
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('bestasolar_data'));
  const maintenant = new Date().toISOString();
  s.subscriptions = [{ id: 'sub', userId: 'u1', status: 'actif', formule: 'essentiel', dateDebut: maintenant, dateFin: new Date(Date.now() + 30 * 864e5).toISOString() }];
  s.companies = [{ id: 'comp-u1', userId: 'u1', nomEntreprise: 'Lumière Sans Facture', pays: 'bj' }];
  s.proClients = [{ id: 'pc1', userId: 'u1', name: 'M. et Mme Bio', phone: '+229 01 97 00 00 00', ville: 'Parakou', createdAt: maintenant }];
  localStorage.setItem('bestasolar_data', JSON.stringify(s));
  localStorage.setItem('bestasolar_mode_u1', 'pro');
});
for (const [repartition, [batt, kit]] of Object.entries(ATTENDU)) {
  await page.goto(B + '/pro/documents');
  await page.getByRole('button', { name: /Nouveau devis/ }).first().click({ timeout: 15000 });
  await page.locator('.devis-mode-card', { hasText: 'Dimensionnement solaire' }).click();
  await page.locator('.wizard-form').waitFor();
  const suivant = () => page.locator('.wizard-actions .btn-primary').click();
  await suivant(); await etape(2);
  const conso = await saisirFacture(repartition);
  ok(/≈ 172,41 kWh consommés par mois/.test(conso), `Pro · ${repartition} : 172 kWh par mois [${conso.slice(0, 50)}]`);
  await suivant(); await etape(3); await page.waitForTimeout(600);
  if (!(await page.locator('.sizing-card', { hasText: 'Batterie conseillée' }).count())) { await suivant(); await etape(4); await page.waitForTimeout(600); }
  const b = await batterie();
  ok(b === batt, `Pro · ${repartition} : batterie conseillée ${batt} [${b}]`);
  if (!(await page.locator('.kit-option-name').count())) { await suivant(); await page.waitForTimeout(800); }
  const k = await kits();
  ok(k.length > 0 && k.every((n) => kit.test(n)), `Pro · ${repartition} : kit suggéré ${kit.source.slice(1)} [${k.join(' / ')}]`);
}

// ---- 3. La leçon affiche ces chiffres (sur ordinateur : leçon et plan côte à côte) ----
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(B + '/privacy.html');
await page.evaluate(() => localStorage.setItem('bestasolar_mode_u1', 'public'));
await page.goto(B + '/plus/formation');
await page.waitForSelector('.course-grid', { timeout: 15000 });
await page.locator('.course-card', { has: page.locator('.course-card-title', { hasText: /^Démarrer avec BestaSolar Pro$/ }) }).locator('button.btn-primary').click();
await page.waitForSelector('.school-content-title');
const fermes = page.locator('.school-module.closed .school-module-head');
while (await fermes.count()) await fermes.first().click();
await page.locator('.school-lecon', { has: page.locator('.school-lecon-title', { hasText: /^À partir de la facture SBEE ou CEET$/ }) }).first().click();
await page.waitForSelector('.school-content-title:text-is("À partir de la facture SBEE ou CEET")');
const lecon = plat(await page.locator('.school-content').first().innerText());
ok(/25 000 F par mois à 145 F le kWh : environ 172 kWh par mois, soit 5,7 kWh par jour/.test(lecon), 'la leçon affiche 145 F, 172 kWh par mois, 5,7 kWh par jour');
ok(/environ 3,8 kWh ; « surtout le soir », d’environ 5,3 kWh/.test(lecon), 'la leçon affiche les batteries 3,8 et 5,3 kWh');
ok(!/115 F/.test(lecon), 'plus aucun 115 F dans la leçon');
await page.getByText(/à 145 F le kWh : environ 172 kWh/).first().scrollIntoViewIfNeeded();
await page.screenshot({ path: (process.env.CAPTURES || '/tmp') + '/academie-sbee-lecon.png' });

console.log(R.join('\n'));
await nav.close();
process.exit(R.some((l) => l.startsWith('❌')) ? 1 : 0);
