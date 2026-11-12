/* Champs numériques : on peut les VIDER pour retaper un autre nombre.
   Avant, plusieurs champs convertissaient la saisie à chaque frappe : effacé,
   le champ redevenait aussitôt « 1 » ou « 0 », et le dernier chiffre ne
   partait jamais. Ici, sur chaque écran concerné, on efface au clavier
   (retour arrière, comme sur le téléphone), on vérifie que le champ est vide,
   on tape le nouveau nombre et on contrôle le calcul qui en dépend ; quitté
   vide, un champ réaffiche la valeur en vigueur.
   Lancer `npm run dev` à côté. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };
const sansEspaces = (t) => t.replace(/[\s  ]+/g, ' ');

const ctx = await nav.newContext({ viewport: { width: 412, height: 900 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));

/** Efface le champ comme au téléphone : curseur à la fin, retour arrière jusqu'au bout. */
const vider = async (champ) => {
  await champ.click();
  await champ.press('End');
  const n = (await champ.inputValue()).length + 2;
  for (let i = 0; i < n; i += 1) await champ.press('Backspace');
};
const effacerPuisTaper = async (champ, texte, nom) => {
  await vider(champ);
  const vide = await champ.inputValue();
  ok(vide === '', `${nom} : le champ se vide entièrement [« ${vide} »]`);
  await champ.pressSequentially(texte);
  const tape = await champ.inputValue();
  ok(tape === texte, `${nom} : on tape ${texte} sans chiffre parasite [« ${tape} »]`);
};
const ajouterAppareil = async (nom) => {
  const select = page.locator('.wizard-form select').filter({ has: page.locator('option', { hasText: nom }) }).first();
  const valeur = await select.evaluate((el, lbl) => [...el.options].find((o) => o.text.includes(lbl))?.value || '', nom);
  await select.selectOption(valeur);
  await page.locator('.wizard-form').getByRole('button', { name: /Ajouter/ }).first().click();
  await page.waitForTimeout(300);
};
const totalJour = async () => sansEspaces(await page.locator('.wizard-form').innerText()).match(/([\d,]+) Total \/ jour/)?.[1];

// ---- Données : abonnement Pro, un client Pro, un devis public ----
await page.goto(B + '/privacy.html');
await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
await page.goto(B + '/dashboard'); await page.locator('.tab-bar').waitFor({ timeout: 15000 }); await page.waitForTimeout(1200);
await page.goto(B + '/privacy.html');
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('bestasolar_data'));
  const maintenant = new Date().toISOString();
  s.subscriptions = [{ id: 'sub', userId: 'u1', status: 'actif', formule: 'essentiel', dateDebut: maintenant, dateFin: new Date(Date.now() + 30 * 864e5).toISOString() }];
  s.companies = [{ id: 'comp-u1', userId: 'u1', nomEntreprise: 'Lumière Sans Facture', pays: 'tg', facturePrefix: 'FAC', factureCounter: 0 }];
  s.proClients = [{ id: 'pc1', userId: 'u1', name: 'Client Démo', phone: '+228 90 00 00 00', ville: 'Lomé', createdAt: maintenant }];
  s.devis = [{
    id: 'd-num', type: 'manual', devisNumber: 'BS-20261112-0001', createdBy: 'u1', createdAt: maintenant, statut: 'finalise',
    clientName: 'Client Démo', lignes: [{ id: 'l1', designation: 'Panneau 550 Wc', itemType: 'bien', qty: 1, unit: 'pcs', pu: 95000, taxRate: 0 }],
    subtotal: 95000, tva: 0, total: 95000,
  }];
  localStorage.setItem('bestasolar_data', JSON.stringify(s));
  localStorage.setItem('bestasolar_mode_u1', 'pro');
});

// ---- 1. Assistant de l'espace Pro, étape 2 (la capture) ----
await page.goto(B + '/pro/documents');
await page.getByRole('button', { name: /Nouveau devis/ }).first().click({ timeout: 15000 });
await page.locator('.devis-mode-card', { hasText: 'Dimensionnement solaire' }).click();
await page.locator('.wizard-form').waitFor();
const etapeSuivante = () => page.locator('.wizard-actions .btn-primary').click();
await etapeSuivante();
await page.locator('.steps-label', { hasText: 'Étape 2' }).waitFor();
await ajouterAppareil('Climatiseur 3 CV');
const ligne = page.locator('.appliance-row').first();
const quantite = ligne.getByLabel('Quantité');
await effacerPuisTaper(quantite, '3', 'Pro · Quantité');
await effacerPuisTaper(ligne.getByLabel('Puissance (W)'), '1500', 'Pro · Puissance');
await effacerPuisTaper(ligne.getByLabel('Heures de jour'), '6', 'Pro · Heures de jour');
let total = await totalJour();
ok(total === '45', `Pro · le calcul suit : 3 × 1 500 W × (6 h + 4 h) = 45 kWh par jour [${total}]`);
await vider(quantite);
await page.locator('.steps-label').click();
ok(await quantite.inputValue() === '3' && await totalJour() === '45', `Pro · quitté vide, le champ réaffiche 3 et le total ne bouge pas [« ${await quantite.inputValue()} », ${await totalJour()}]`);

// Étape 4 : le devis modifiable, quantité et prix.
await etapeSuivante(); await page.waitForTimeout(600);
await etapeSuivante(); await page.waitForTimeout(1200);
const ligneDevis = page.locator('.editable-quotation-fields').first();
if (await ligneDevis.count()) {
  await effacerPuisTaper(ligneDevis.getByLabel('Quantité'), '2', 'Pro · devis · Quantité');
  await effacerPuisTaper(ligneDevis.getByLabel('Prix unitaire'), '125000', 'Pro · devis · Prix unitaire');
} else {
  R.push('· devis modifiable de l’étape 4 non affiché ici (catalogue de démonstration)');
}

// ---- 2. Assistant public (écran Devis), étape 2 ----
await page.goto(B + '/privacy.html');
await page.evaluate(() => localStorage.setItem('bestasolar_mode_u1', 'public'));
await page.goto(B + '/devis'); await page.waitForTimeout(1200);
await page.locator('button:has-text("Créer un devis"), button:has-text("Nouveau devis")').first().click();
await page.locator(':text("Dimensionnement solaire")').first().click(); await page.waitForTimeout(800);
await page.locator('.page-content button').nth(1).click(); await page.waitForTimeout(300);
await page.getByRole('button', { name: /Suivant/ }).first().click();
await page.waitForTimeout(800);
await ajouterAppareil('Climatiseur 3 CV');
const lignePub = page.locator('.appliance-row').first();
await effacerPuisTaper(lignePub.getByLabel('Qté'), '2', 'Public · Quantité');
await effacerPuisTaper(lignePub.getByLabel('Puiss. (W)'), '1000', 'Public · Puissance');
await effacerPuisTaper(lignePub.getByLabel('h nuit'), '5', 'Public · Heures de nuit');

// ---- 3. Éditeur de devis : quantité et prix d'une ligne ----
await page.goto(B + '/devis'); await page.waitForTimeout(1200);
await page.locator('.flat-row', { hasText: 'BS-20261112-0001' }).click();
await page.getByRole('button', { name: 'Éditer' }).click();
const editeur = page.locator('.quote-editor-sheet');
await editeur.locator('.quote-line-content').first().click();
await effacerPuisTaper(editeur.getByRole('spinbutton', { name: 'Quantité' }), '4', 'Ligne de devis · Quantité');
await effacerPuisTaper(editeur.locator('.quote-currency-input input'), '87500', 'Ligne de devis · Prix unitaire');
await editeur.getByRole('button', { name: 'Enregistrer les modifications' }).click();
await page.waitForTimeout(800);
const devis = await page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')).devis.find((d) => d.id === 'd-num'));
ok(devis.lignes[0].qty === 4 && devis.lignes[0].pu === 87500 && devis.total === 350000,
  `Ligne de devis : enregistrée 4 × 87 500 = 350 000 F [${devis.lignes[0].qty} × ${devis.lignes[0].pu} = ${devis.total}]`);
await page.keyboard.press('Escape');

// ---- 4. Simulateur ROI : quantité d'un appareil ----
await page.goto(B + '/plus/roi');
await page.getByRole('button', { name: 'D’après ses appareils' }).click({ timeout: 15000 });
await page.locator('#roi-ajout').waitFor();
const option = await page.locator('#roi-ajout').evaluate((el) => [...el.options].find((o) => o.value)?.value);
await page.locator('#roi-ajout').selectOption(option);
await effacerPuisTaper(page.locator('.roi-appareil-qte').first(), '5', 'Simulateur ROI · Quantité');

// ---- 5. Échéancier d'une facture : montant d'une échéance ----
await page.goto(B + '/privacy.html');
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('bestasolar_data'));
  s.factures = [{ id: 'f1', userId: 'u1', numero: 'FAC-2026-001', clientName: 'Client Démo', lignes: [{ designation: 'Kit', qty: 1, pu: 1000000 }],
    tvaActive: false, totalHT: 1000000, tva: 0, totalTTC: 1000000, statut: 'emise', createdAt: new Date().toISOString(),
    echeancier: [{ id: 'e1', libelle: 'Acompte', type: 'date', date: '2026-11-12', montant: 500000 }, { id: 'e2', libelle: 'Solde', type: 'condition', condition: 'À la livraison', montant: 500000 }] }];
  localStorage.setItem('bestasolar_data', JSON.stringify(s));
  localStorage.setItem('bestasolar_mode_u1', 'pro');
});
await page.goto(B + '/pro/documents');
await page.getByRole('button', { name: /Factures \(1\)/ }).click({ timeout: 15000 });
await page.locator('.flat-row', { hasText: 'FAC-2026-001' }).click();
await page.getByRole('button', { name: 'Modifier la facture' }).click();
const montant = page.locator('.echeance-ligne').first().getByLabel('Montant (F CFA)');
await effacerPuisTaper(montant, '300000', 'Échéancier · Montant');
ok(/Il manque 200 000 F/.test(sansEspaces(await page.locator('.echeancier-total').innerText())), 'Échéancier : l’écart suit le nouveau montant (il manque 200 000 F)');

console.log(R.join('\n'));
await nav.close();
process.exit(R.some((l) => l.startsWith('❌')) ? 1 : 0);
