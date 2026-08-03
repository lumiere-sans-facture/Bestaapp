/* Circuit demande → validation : le commercial demande, le gérant tranche. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };

const ETAT = {
  version: 5,
  leads: [{ id: 'L1', name: 'CLINIQUE TEST', contact: 'Dr H', phone: '+229', address: 'Parakou',
    clientType: 'entreprise', stage: 'negociation', estimatedValue: 2450000, assignedTo: 'u2',
    parrainL1: null, parrainL2: null, createdAt: '2026-08-01', lastActivity: '2026-08-01' }],
  devis: [], partners: [
    { id: 'p-user-u1', userId: 'u1', name: 'Adam Adébiyi', code: 'BESTA-ADAM', status: 'actif', sponsorId: null, registeredAt: '2026-01-01' },
    { id: 'p-user-u2', userId: 'u2', name: 'Fatou Boko', code: 'BESTA-FATOU', status: 'actif', sponsorId: null, registeredAt: '2026-01-01' }],
  commissions: [], referrals: [], orders: [], products: [], formations: [], formationProgress: [],
  subscriptions: [], subscriptionPayments: [], companies: [], factures: [], proClients: [],
  devisCounter: 0, orderCounter: 0,
};
const COMPTES = {
  tech: { id: 'u2', email: 'fatou@bestasolar.bj', name: 'Fatou Boko', role: 'technicien', phone: '+229', avatar: 'FB' },
  gerant: { id: 'u1', email: 'adam@bestasolar.bj', name: 'Adam Adébiyi', role: 'gerant', phone: '+229', avatar: 'AA' },
};

async function session(compte, etat) {
  const page = await nav.newPage();
  await page.goto('http://localhost:3000');
  await page.evaluate(([e, u]) => {
    localStorage.setItem('bestasolar_data', JSON.stringify(e));
    localStorage.setItem('bestasolar_user', JSON.stringify(u));
  }, [etat, compte]);
  await page.goto('http://localhost:3000/pipeline');
  await page.waitForSelector('.kanban-container', { timeout: 15000 });
  await page.waitForTimeout(700);
  return page;
}
const lire = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')));

// ---- 1. LE COMMERCIAL DEMANDE ----
let page = await session(COMPTES.tech, ETAT);
await page.locator('.kanban-card:has-text("CLINIQUE TEST")').first().click();
await page.waitForTimeout(600);
await page.locator('.sheet .stage-stepper .stage-step:has-text("Proposition")').first().click();
await page.waitForTimeout(900);
let etat = await lire(page);
ok(etat.leads[0].stage === 'negociation', "commercial : l'étape N'EST PAS appliquée tout de suite");
ok(!!etat.leads[0].pendingStage && etat.leads[0].pendingStage.stage === 'proposition',
   'commercial : une DEMANDE est créée (→ Proposition)');
const banniere = await page.locator('.sheet .pending-banner').count();
ok(banniere === 1, 'commercial : le bandeau « en attente de validation » s’affiche');
const boutonsCommercial = await page.locator('.sheet .pending-banner button').count();
ok(boutonsCommercial === 0, 'commercial : PAS de bouton Valider/Refuser (ce n’est pas son rôle)');
await page.keyboard.press('Escape'); await page.waitForTimeout(400);
ok(await page.locator('.kanban-card .pending-chip').count() === 1,
   'commercial : la carte porte la puce « → Proposition »');
const etatApresDemande = await lire(page);
await page.close();

// ---- 2. LE GÉRANT VOIT ET VALIDE ----
page = await session(COMPTES.gerant, etatApresDemande);
ok(await page.locator('.validation-bar').count() === 1,
   'gérant : la barre « Progressions à valider » est affichée');
const ligne = await page.locator('.validation-bar .validation-row').first().textContent();
ok(/CLINIQUE TEST/.test(ligne) && /Proposition/.test(ligne) && /Fatou/.test(ligne),
   `gérant : la demande indique client, étape et demandeur — « ${ligne.replace(/\s+/g, ' ').trim().slice(0, 70)} »`);
ok(await page.locator('.validation-bar button:has-text("Valider")').count() === 1
   && await page.locator('.validation-bar button:has-text("Refuser")').count() === 1,
   'gérant : boutons Valider et Refuser présents');
await page.locator('.validation-bar button:has-text("Valider")').first().click();
await page.waitForTimeout(1000);
etat = await lire(page);
ok(etat.leads[0].stage === 'proposition', 'gérant : après validation, l’étape est appliquée');
ok(!etat.leads[0].pendingStage, 'gérant : la demande est levée');
ok(await page.locator('.validation-bar').count() === 0, 'gérant : la barre disparaît une fois traitée');
await page.close();

// ---- 3. LE GÉRANT REFUSE ----
page = await session(COMPTES.gerant, etatApresDemande);
await page.locator('.validation-bar button:has-text("Refuser")').first().click();
await page.waitForTimeout(1000);
etat = await lire(page);
ok(etat.leads[0].stage === 'negociation', 'refus : l’étape reste inchangée');
ok(!etat.leads[0].pendingStage, 'refus : la demande est levée');
await page.close();

// ---- 4. LE GÉRANT AGIT DIRECTEMENT ----
page = await session(COMPTES.gerant, ETAT);
await page.locator('.kanban-card:has-text("CLINIQUE TEST")').first().click();
await page.waitForTimeout(600);
await page.locator('.sheet .stage-stepper .stage-step:has-text("Visite")').first().click();
await page.waitForTimeout(900);
etat = await lire(page);
ok(etat.leads[0].stage === 'visite', 'gérant : sa propre action s’applique immédiatement');
ok(!etat.leads[0].pendingStage, 'gérant : aucune demande créée pour lui-même');

console.log(R.join('\n'));
console.log(R.some((x) => x.startsWith('❌')) ? '\n❌ ÉCHECS' : '\n✅ circuit de validation conforme');
await nav.close();
