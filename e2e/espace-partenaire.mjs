/* Les commissions vivent dans l'espace partenaire, plus dans le profil. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };

const ETAT = {
  version: 5,
  leads: [
    { id: 'L1', name: 'CLINIQUE SAINT JEAN', contact: 'Dr H', phone: '+229', address: 'Parakou',
      clientType: 'entreprise', stage: 'gagne', estimatedValue: 500000, assignedTo: 'u1',
      parrainL1: 'p-user-u1', parrainL2: null, createdAt: '2026-08-01', wonAt: '2026-08-02', lastActivity: '2026-08-02' },
    { id: 'L2', name: 'BOULANGERIE KANDI', contact: 'M. B', phone: '+229', address: 'Kandi',
      clientType: 'entreprise', stage: 'negociation', estimatedValue: 300000, assignedTo: 'u1',
      parrainL1: null, parrainL2: null, createdAt: '2026-08-01', lastActivity: '2026-08-03' },
  ],
  devis: [{ id: 'D1', devisNumber: 'BS-20260801-0001', leadId: 'L1', total: 500000, type: 'manual',
    stage: 'gagne', statut: 'valide', partnerId: 'p-user-u1', createdAt: '2026-08-01', lignes: [] }],
  partners: [{ id: 'p-user-u1', userId: 'u1', name: 'Adam Adébiyi', code: 'BESTA-ADAM', status: 'actif',
    sponsorId: null, momoNumber: '+229 97 11 22 33', registeredAt: '2026-01-01' }],
  commissions: [
    { id: 'C1', partnerId: 'p-user-u1', leadId: 'L1', devisId: 'D1', level: 1, amount: 15000,
      status: 'en_attente', paidAt: null, createdAt: '2026-08-02' },
    { id: 'C2', partnerId: 'p-user-u1', leadId: 'L1', devisId: null, level: 2, amount: 7500,
      status: 'payée', paidAt: '2026-08-03', payMode: 'momo', createdAt: '2026-08-01' },
  ],
  referrals: [], orders: [], products: [], formations: [], formationProgress: [],
  subscriptions: [], subscriptionPayments: [], companies: [], factures: [], proClients: [],
  devisCounter: 1, orderCounter: 0,
};
const GERANT = { id: 'u1', email: 'adam@bestasolar.bj', name: 'Adam Adébiyi', role: 'gerant', phone: '+229', avatar: 'AA' };

const page = await nav.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message));
await page.goto('http://localhost:3000');
await page.evaluate(([e, u]) => {
  localStorage.setItem('bestasolar_data', JSON.stringify(e));
  localStorage.setItem('bestasolar_user', JSON.stringify(u));
}, [ETAT, GERANT]);

// ---- 1. LE PROFIL NE PARLE PLUS D'ARGENT ----
await page.goto('http://localhost:3000/plus/profile');
await page.waitForSelector('.profile-card', { timeout: 15000 });
await page.waitForTimeout(500);
const profil = await page.locator('.page-content').innerText();
ok(!/En attente \(F\)|Payées \(F\)/.test(profil), 'profil : plus de tuiles « En attente / Payées »');
ok(!/Commission niveau/.test(profil), 'profil : plus de lignes « Commission niveau … » dans l’historique');
ok(!/\+229 97 11 22 33/.test(profil), 'profil : le numéro Mobile Money n’y figure plus');
ok(/Mes affaires gagnées/.test(profil), 'profil : l’historique ne garde que les affaires gagnées');
ok(/CLINIQUE SAINT JEAN/.test(profil), 'profil : l’affaire gagnée est bien listée');
const tuiles = await page.locator('.profile-stats .profile-stat-label').allInnerTexts();
ok(JSON.stringify(tuiles) === JSON.stringify(['En cours', 'Gagnées', 'Perdues']),
   `profil : tuiles d’activité commerciale — ${tuiles.join(' / ')}`);

// Le formulaire d'édition ne propose plus le Mobile Money
await page.locator('button:has-text("Modifier")').first().click();
await page.waitForTimeout(400);
const form = await page.locator('.card:has(form)').innerText();
ok(!/Mobile Money/.test(form), 'profil : le formulaire ne demande plus le numéro Mobile Money');
await page.locator('button:has-text("Annuler")').first().click();
await page.waitForTimeout(300);

// ---- 2. LE RENVOI VERS L'ESPACE PARTENAIRE ----
const lien = page.locator('.profile-link-card');
ok(await lien.count() === 1, 'profil : une carte renvoie vers « Mes commissions »');
await lien.click();
await page.waitForTimeout(700);
ok(page.url().endsWith('/plus/mypartner'), 'profil : le renvoi ouvre bien Mon espace partenaire');

// ---- 3. L'ESPACE PARTENAIRE PORTE TOUT L'ARGENT ----
await page.waitForSelector('.my-partner-kpis', { timeout: 15000 });
const espace = await page.locator('.page-content').innerText();
ok(/Historique de mes commissions \(2\)/.test(espace),
   'espace partenaire : l’historique des commissions est présent (2 lignes)');
ok(/Niveau 1 \(3\s*%\)/.test(espace), 'espace partenaire : le niveau et son taux sont affichés');
ok(/BS-20260801-0001/.test(espace), 'espace partenaire : le devis d’origine est rappelé');
ok(/payée le 3 août 2026/.test(espace), 'espace partenaire : la date de paiement est affichée');
ok(await page.locator('#mpd-momo').inputValue() === '+229 97 11 22 33',
   'espace partenaire : le numéro Mobile Money se règle ici');
ok(/15 000 F/.test(espace) && /7 500 F/.test(espace),
   'espace partenaire : les deux montants sont listés');
// L'ordre : à encaisser d'abord
const lignes = await page.locator('.card:has-text("Historique de mes commissions") .sheet-row').allInnerTexts();
ok(/En attente/.test(lignes[0] || '') && /Payée/.test(lignes[1] || ''),
   'espace partenaire : les commissions à encaisser passent en premier');

console.log('\n' + R.join('\n'));
console.log(erreurs.length ? `\n❌ erreurs JS : ${erreurs.join(' | ')}` : '\naucune erreur JS');
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length + erreurs.length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ commissions bien regroupées dans l’espace partenaire');
process.exit(echecs ? 1 : 0);
