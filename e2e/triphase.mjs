/* Réseau monophasé / triphasé, à côté du type de support : en triphasé,
   l'onduleur du kit est remplacé par un triphasé de « Mes onduleurs » s'il
   ne l'est pas déjà ; sans modèle triphasé de la bonne tension, l'assistant
   le dit. Assistant de devis puis espace Pro. Lancer `npm run dev` à côté. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const page = await nav.newPage({ viewport: { width: 1280, height: 1100 } });
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
const B = 'http://localhost:3000';
await page.goto(B + '/');
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('bestasolar_user', JSON.stringify({ id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' })); });
const texte = async () => (await page.locator('.page-content').innerText()).replace(/\s+/g, ' ');
const equipements = (t) => t.slice(t.indexOf('ÉQUIPEMENTS'), t.indexOf('PRESTATIONS'));

// ---- 1. ASSISTANT : Kit 5 kWh Deye (Deye 6 kVA monophasé) ----
const suivant = () => page.locator('button:has-text("Suivant")').first();
const assistant = async (jour, nuit, kit) => {
  await page.goto(B + '/devis'); await page.waitForTimeout(1500);
  await page.locator('button:has-text("Créer un devis"), button:has-text("Nouveau devis")').first().click(); await page.waitForTimeout(800);
  await page.locator(':text("Dimensionnement solaire")').first().click(); await page.waitForTimeout(900);
  await page.locator('.page-content button').nth(1).click(); await page.waitForTimeout(300);
  await suivant().click(); await page.waitForTimeout(800);
  await page.locator('button:has-text("Saisie directe")').click();
  await page.locator('.manual-consumption-grid input').nth(0).fill(jour);
  await page.locator('.manual-consumption-grid input').nth(1).fill(nuit);
  await suivant().click(); await page.waitForTimeout(800);
  await suivant().click(); await page.waitForTimeout(1600);
  await page.locator('.kit-option', { hasText: kit }).first().click(); await page.waitForTimeout(800);
};
await assistant('8', '3', 'Kit 5 kWh — Deye');
let t = await texte();
ok(/Type de support/.test(t) && /Réseau électrique Monophasé Triphasé/.test(t), 'le choix Monophasé / Triphasé est à côté du type de support');
ok(await page.locator('.category-chip.active', { hasText: 'Monophasé' }).count() === 1, 'kit à onduleur monophasé : « Monophasé » sélectionné tout seul');
ok(/6kVA Deye/i.test(equipements(t)) && !/12kVA/.test(equipements(t)), `monophasé : le Deye 6 kVA du kit [${(/Onduleur[^F]*F/.exec(equipements(t)) || [''])[0]}]`);
await page.locator('.category-chip', { hasText: 'Triphasé' }).click(); await page.waitForTimeout(800);
t = await texte();
ok(/Onduleur hybride 12kVA Deye/.test(equipements(t)), `triphasé : un onduleur triphasé de « Mes onduleurs » [${(/Onduleur[^F]*F/.exec(equipements(t)) || [''])[0]}]`);
ok(/n’est pas triphasé/.test(t), 'la raison est dite : l’onduleur du kit n’est pas triphasé');
await page.locator('.chip-selector', { hasText: 'Réseau électrique' }).screenshot({ path: '/tmp/claude-0/triphase-choix.png' }).catch(() => {});
await page.locator('button:has-text("Créer le devis")').first().click(); await page.waitForTimeout(1200);
const d = await page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')).devis.at(-1));
ok(d?.dimensionnement?.phases === 3 && (d.quotation?.components || []).some((c) => /12kVA/.test(c.name)), 'le devis enregistré garde le triphasé et l’onduleur triphasé');

// ---- 1 bis. Kit à onduleur triphasé (48 kWh, Deye 12 kVA) : « Triphasé » tout seul ----
await assistant('27', '27', 'Kit 48 kWh');
ok(await page.locator('.category-chip.active', { hasText: 'Triphasé' }).count() === 1, 'kit à onduleur triphasé : « Triphasé » sélectionné tout seul');
t = await texte();
ok(/Onduleur hybride Deye 12kva/i.test(equipements(t)) && !/n’est pas triphasé/.test(t), `son onduleur triphasé est gardé, sans remplacement [${(/Onduleur[^F]*F/.exec(equipements(t)) || [''])[0]}]`);

// ---- 2. Kit 24 V : aucun triphasé de cette tension ----
await assistant('2', '1', 'Kit 2,5 kWh — Essentiel');
await page.locator('.category-chip', { hasText: 'Triphasé' }).click(); await page.waitForTimeout(800);
t = await texte();
ok(/Aucun onduleur triphasé 24 V/.test(t) && /3kva HZ/i.test(equipements(t)), 'kit 24 V : l’assistant avertit, l’onduleur du kit reste');

// ---- 3. ESPACE PRO : même choix, même effet ----
await page.goto(B + '/privacy.html');
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('bestasolar_data'));
  s.subscriptions = [{ id: 'sub-e2e', userId: 'u1', status: 'actif', formule: 'essentiel', dateDebut: new Date().toISOString(), dateFin: new Date(Date.now() + 30 * 864e5).toISOString() }];
  localStorage.setItem('bestasolar_data', JSON.stringify(s));
  localStorage.setItem('bestasolar_mode_u1', 'pro');
});
await page.goto(B + '/pro/documents'); await page.waitForTimeout(1800);
await page.locator('button:has-text("Nouveau devis")').first().click(); await page.waitForTimeout(600);
await page.locator('.devis-mode-card.featured').click(); await page.waitForTimeout(800);
await page.getByLabel('Nom complet *').fill('Client Triphasé');
const etape = () => page.locator('.wizard-actions .btn-primary').first();
await etape().click(); await page.waitForTimeout(600);
await page.locator('button:has-text("Saisie directe")').click();
await page.locator('.manual-consumption-grid input').nth(0).fill('8');
await page.locator('.manual-consumption-grid input').nth(1).fill('3');
await etape().click(); await page.waitForTimeout(800);
await etape().click(); await page.waitForTimeout(1500);
await page.locator('.kit-option', { hasText: 'Kit 5 kWh — Deye' }).first().click(); await page.waitForTimeout(800);
await page.locator('.category-chip', { hasText: 'Triphasé' }).click(); await page.waitForTimeout(800);
t = await texte();
ok(/Réseau électrique/.test(t) && /12kVA Deye/.test(t) && /n’est pas triphasé/.test(t), 'espace Pro : choix présent, onduleur triphasé retenu');

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Triphasé : onduleur triphasé proposé, choix gardé avec le devis');
process.exit(echecs ? 1 : 0);
