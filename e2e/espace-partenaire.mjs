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
ok(!/gagné|gagnée/i.test(profil), 'profil : plus aucune affaire gagnée (elles mènent aux commissions)');
ok(!/CLINIQUE SAINT JEAN/.test(profil), 'profil : l’affaire gagnée n’y est plus listée');
ok(/BOULANGERIE KANDI/.test(profil), 'profil : le client EN COURS, lui, reste sur le profil');
const tuiles = await page.locator('.profile-stats .profile-stat-label').allInnerTexts();
ok(JSON.stringify(tuiles) === JSON.stringify(['Clients en cours', 'Devis créés']),
   `profil : tuiles du travail en cours — ${tuiles.join(' / ')}`);

// Le formulaire d'édition ne propose plus le Mobile Money
await page.locator('button:has-text("Modifier")').first().click();
await page.waitForTimeout(400);
const form = await page.locator('.card:has(form)').innerText();
ok(!/Mobile Money/.test(form), 'profil : le formulaire ne demande plus le numéro Mobile Money');
await page.locator('button:has-text("Annuler")').first().click();
await page.waitForTimeout(400);

// ---- 2. ZÉRO MENTION DE COMMISSION, NULLE PART SUR LE PROFIL ----
const profilFinal = await page.locator('.page-content').innerText();
ok(!/[Cc]ommission/.test(profilFinal), 'profil : le mot « commission » n’apparaît plus du tout');
ok(!/Mobile Money|momo/i.test(profilFinal), 'profil : aucune mention du paiement Mobile Money');
ok(await page.locator('.profile-link-card').count() === 0,
   'profil : plus aucun bouton ni renvoi vers les commissions');

// ---- 3. L'ESPACE PARTENAIRE PORTE TOUT L'ARGENT ----
await page.goto('http://localhost:3000/plus/mypartner');
await page.waitForSelector('.partner-kpis', { timeout: 15000 });
await page.waitForTimeout(500);

// La page tient sur un écran tant que rien n'est déplié : c'est tout l'objet
// des sections repliables.
const sections = await page.locator('.accordion').count();
ok(sections >= 6, `espace partenaire : ${sections} sections repliables`);
ok(await page.locator('.accordion[open]').count() === 0,
   'espace partenaire : tout est replié à l’ouverture (page courte)');
const hReplie = await page.evaluate(() => document.querySelector('.page-content').scrollHeight);
ok(hReplie < 1000, `espace partenaire : page repliée courte (${hReplie} px)`);

// Les en-têtes annoncent le contenu sans qu'on ouvre.
const entetes = await page.locator('.accordion-head').allInnerTexts();
ok(entetes.some((t) => /Historique de mes commissions/.test(t) && /15 000 F à venir/.test(t)),
   'espace partenaire : l’en-tête annonce le montant à encaisser sans ouvrir');
ok(entetes.some((t) => /Mes affaires gagnées/.test(t) && /500 000 F/.test(t)),
   'espace partenaire : l’en-tête des affaires gagnées annonce le total');

// On déplie tout pour vérifier le contenu.
for (const h of await page.locator('.accordion-head').all()) await h.click();
await page.waitForTimeout(500);
ok(await page.locator('.accordion[open]').count() === sections,
   'espace partenaire : chaque section s’ouvre au clic');
const espace = await page.locator('.page-content').innerText();
ok(/CLINIQUE SAINT JEAN/.test(espace), 'espace partenaire : les affaires gagnées ont bien migré ici');
ok(/gagnée le 2 août 2026/.test(espace), 'espace partenaire : la date du gain est affichée');
const lignesCom = await page.locator('.accordion:has-text("Historique de mes commissions") .sheet-row').count();
ok(lignesCom === 2, `espace partenaire : l’historique des commissions liste ${lignesCom} ligne(s) [attendu 2]`);
ok(/N1\s*·\s*3\s*%/.test(espace) && /N2\s*·\s*1,5\s*%/.test(espace),
   'espace partenaire : le niveau et son taux sont affichés');
// Le niveau se lit à la COULEUR de sa pastille, et jamais dans l'ambre/vert
// réservés à l'état de paiement — c'est ce qui prêtait à confusion.
const pastilles = await page.locator('.accordion:has-text("Historique de mes commissions") .chip-level').evaluateAll(
  (els) => els.map((e) => [e.className, getComputedStyle(e).color]));
ok(pastilles.some(([c]) => /\bn1\b/.test(c)) && pastilles.some(([c]) => /\bn2\b/.test(c)),
   'espace partenaire : les pastilles portent leur niveau (n1 / n2)');
ok(new Set(pastilles.map(([, col]) => col)).size === 2,
   'espace partenaire : N1 et N2 ont deux couleurs distinctes');
ok(/BS-20260801-0001/.test(espace), 'espace partenaire : le devis d’origine est rappelé');
ok(/payée le 3 août 2026/.test(espace), 'espace partenaire : la date de paiement est affichée');
ok(await page.locator('#mpd-momo').inputValue() === '+229 97 11 22 33',
   'espace partenaire : le numéro Mobile Money se règle ici');
ok(/15 000 F/.test(espace) && /7 500 F/.test(espace),
   'espace partenaire : les deux montants sont listés');
// L'ordre : à encaisser d'abord
const lignes = await page.locator('.accordion:has-text("Historique de mes commissions") .sheet-row').allInnerTexts();
ok(/En attente/.test(lignes[0] || '') && /Payée/.test(lignes[1] || ''),
   'espace partenaire : les commissions à encaisser passent en premier');

console.log('\n' + R.join('\n'));
console.log(erreurs.length ? `\n❌ erreurs JS : ${erreurs.join(' | ')}` : '\naucune erreur JS');
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length + erreurs.length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ commissions bien regroupées dans l’espace partenaire');
process.exit(echecs ? 1 : 0);
