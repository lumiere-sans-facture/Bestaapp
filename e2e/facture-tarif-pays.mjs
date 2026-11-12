/* Dimensionnement par facture : le prix du kWh proposé est celui du pays du
   client — 145 F (SBEE) au Bénin, 114 F (CEET) au Togo — et la ligne d'aide
   le dit. Il suit le client choisi tant qu'il n'a pas été saisi à la main ;
   un prix tapé n'est jamais écrasé ; une étude par facture rouverte garde le
   prix avec lequel le devis a été chiffré. Assistant public, puis espace Pro.
   Lancer `npm run dev` à côté. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };
const plat = (t) => t.replace(/[\s  ]+/g, ' ').trim();

const ctx = await nav.newContext({ viewport: { width: 412, height: 900 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
await page.goto(B + '/privacy.html');
await page.evaluate((u) => {
  localStorage.setItem('bestasolar_user', JSON.stringify(u));
  localStorage.setItem(`bestasolar_guide_accueil_v1:${u.id}`, 'termine');
}, GERANT);
await page.goto(B + '/dashboard'); await page.locator('.tab-bar').waitFor({ timeout: 15000 }); await page.waitForTimeout(1000);
await page.goto(B + '/privacy.html');
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('bestasolar_data'));
  const maintenant = new Date().toISOString();
  const lead = (id, name, phone, address) => ({ id, clientType: 'particulier', name, contact: name, phone, address, stage: 'qualifie', estimatedValue: 0, assignedTo: 'u1', createdAt: maintenant, lastActivity: maintenant, activities: [] });
  s.leads = [
    lead('lead-bj', 'Famille Bio', '+229 01 97 00 00 00', 'Banikanni, Parakou'),
    lead('lead-tg', 'Boutique Zongo', '+228 94 77 88 99', 'Quartier Zongo, Lomé'),
    ...(s.leads || []),
  ];
  // Un devis chiffré par facture à 114 F, avant ce changement : rouvert, il garde son prix.
  s.devis = [{
    id: 'd-facture', type: 'solar', devisNumber: 'BS-20261112-0009', leadId: 'lead-bj', clientName: 'Famille Bio',
    createdBy: 'u1', createdAt: maintenant, statut: 'finalise', total: 775000, subtotal: 775000, tva: 0, lignes: [],
    dimensionnement: { version: 1, consoMode: 'facture', appareils: [], manuel: { day: '', night: '' },
      facture: { montant: '25000', prixKwh: 114, repartition: 'equilibre' }, systemType: 'off-grid', autonomyNights: 1,
      mountingType: 'tole', includeMounting: true, phases: 1, sunHours: 4.3, location: null, solarSource: null },
  }, ...(s.devis || [])];
  localStorage.setItem('bestasolar_data', JSON.stringify(s));
});

const prixKwh = () => page.getByLabel('Prix du kWh (F CFA)');
const aide = async () => plat(await page.locator('.facture-tarif-indicatif').innerText());
const choisirFacture = () => page.getByRole('button', { name: 'Facture CEET/SBEE (F CFA)' }).click();

// ---- 1. Assistant public ----
const ouvrirAssistant = async () => {
  await page.goto(B + '/devis'); await page.waitForTimeout(1000);
  await page.locator('button:has-text("Créer un devis"), button:has-text("Nouveau devis")').first().click();
  await page.locator(':text("Dimensionnement solaire")').first().click(); await page.waitForTimeout(600);
};
const choisirLead = async (nom) => { await page.locator('.lead-select-item', { hasText: nom }).click(); await page.waitForTimeout(200); };
const suivant = () => page.getByRole('button', { name: /Suivant/ }).first().click();
// « Précédent » aux étapes 2 et 3 (une simple flèche à l'étape 4).
const precedent = () => page.getByRole('button', { name: /Précédent|Étape précédente/ }).first().click();

await ouvrirAssistant();
await choisirLead('Famille Bio');
await suivant(); await choisirFacture();
ok(await prixKwh().inputValue() === '145', `public · client béninois (+229, Parakou) : 145 F le kWh [${await prixKwh().inputValue()}]`);
ok(/Tarif indicatif SBEE au Bénin : 145 F le kWh/.test(await aide()), `public · la ligne d’aide nomme la SBEE [${await aide()}]`);

await precedent(); await choisirLead('Boutique Zongo'); await suivant();
ok(await prixKwh().inputValue() === '114', `public · client togolais (+228, Lomé) : le prix suit, 114 F [${await prixKwh().inputValue()}]`);
ok(/CEET au Togo : 114 F/.test(await aide()), `public · la ligne d’aide nomme la CEET [${await aide()}]`);

await prixKwh().fill('130');
await precedent(); await choisirLead('Famille Bio'); await suivant();
ok(await prixKwh().inputValue() === '130', `public · un prix tapé à la main n’est pas écrasé en changeant de client [${await prixKwh().inputValue()}]`);
ok(/SBEE au Bénin : 145 F/.test(await aide()), 'public · la ligne d’aide, elle, suit le client');

// Étude par facture rouverte : son prix reste celui du devis.
await page.goto(B + '/devis'); await page.waitForTimeout(1000);
await page.locator('.flat-row', { hasText: 'BS-20261112-0009' }).click();
await page.getByRole('button', { name: /Revoir le dimensionnement/ }).click();
// Un devis rouvert s'ouvre directement sur l'étape Consommation.
await page.locator('.steps-label', { hasText: 'Étape 2' }).waitFor();
await page.waitForTimeout(400);
ok(await prixKwh().inputValue() === '114', `public · devis rouvert : il garde son prix de 114 F [${await prixKwh().inputValue()}]`);

// ---- 2. Espace Pro (entreprise au Bénin) ----
await page.goto(B + '/privacy.html');
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('bestasolar_data'));
  const maintenant = new Date().toISOString();
  s.subscriptions = [{ id: 'sub', userId: 'u1', status: 'actif', formule: 'essentiel', dateDebut: maintenant, dateFin: new Date(Date.now() + 30 * 864e5).toISOString() }];
  s.companies = [{ id: 'comp-u1', userId: 'u1', nomEntreprise: 'Lumière Sans Facture', pays: 'bj' }];
  s.proClients = [
    { id: 'pc-bj', userId: 'u1', name: 'M. Houngbo', phone: '', ville: 'Abomey-Calavi', createdAt: maintenant },
    { id: 'pc-tg', userId: 'u1', name: 'Mme Ayivi', phone: '+228 90 11 22 33', ville: '', createdAt: maintenant },
  ];
  localStorage.setItem('bestasolar_data', JSON.stringify(s));
  localStorage.setItem('bestasolar_mode_u1', 'pro');
});
await page.goto(B + '/pro/documents');
await page.getByRole('button', { name: /Nouveau devis/ }).first().click({ timeout: 15000 });
await page.locator('.devis-mode-card', { hasText: 'Dimensionnement solaire' }).click();
await page.locator('.wizard-form').waitFor();
const selectClient = page.locator('.wizard-form select').first();
await selectClient.selectOption('pc-bj');
const suivantPro = () => page.locator('.wizard-actions .btn-primary').click();
await suivantPro(); await choisirFacture();
ok(await prixKwh().inputValue() === '145', `Pro · entreprise au Bénin, client sans numéro : 145 F [${await prixKwh().inputValue()}]`);
ok(/SBEE au Bénin : 145 F/.test(await aide()), `Pro · la ligne d’aide nomme la SBEE [${await aide()}]`);
await page.locator('.wizard-actions .btn-outline').first().click();
await selectClient.selectOption('pc-tg');
await suivantPro();
ok(await prixKwh().inputValue() === '114', `Pro · client au numéro togolais : 114 F [${await prixKwh().inputValue()}]`);
await page.locator('.facture-tarif-indicatif').scrollIntoViewIfNeeded();
await page.screenshot({ path: (process.env.CAPTURES || '/tmp') + '/facture-tarif-pays.png' });

console.log(R.join('\n'));
await nav.close();
process.exit(R.some((l) => l.startsWith('❌')) ? 1 : 0);
