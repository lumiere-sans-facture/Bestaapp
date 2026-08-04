import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await nav.newPage();
const jsErr = []; page.on('pageerror', (e) => jsErr.push(String(e)));
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };

const ETAT = {
  version: 5,
  leads: [{ id: 'L1', name: 'HOTEL TEST', contact: 'M. K', phone: '+229', address: 'Parakou',
    clientType: 'entreprise', stage: 'negociation', estimatedValue: 500000, assignedTo: 'u1',
    parrainL1: null, parrainL2: null, createdAt: '2026-08-01', lastActivity: '2026-08-01' }],
  devis: [
    { id: 'D1', leadId: 'L1', devisNumber: 'BS-20260801-0001', type: 'manual', total: 500000,
      statut: 'finalise', stage: 'negociation', createdBy: 'u1', createdAt: '2026-08-01T08:00:00Z',
      partnerId: 'p-user-u1', lignes: [{ designation: 'Kit A', qty: 1, pu: 500000 }] },
    { id: 'D2', leadId: 'L1', devisNumber: 'BS-20260801-0002', type: 'solar', total: 300000,
      statut: 'finalise', stage: 'proposition', createdBy: 'u1', createdAt: '2026-08-02T08:00:00Z',
      partnerId: 'p-user-u1', lignes: [{ designation: 'Kit B', qty: 1, pu: 300000 }] }],
  partners: [{ id: 'p-user-u1', userId: 'u1', name: 'Adam Adébiyi', code: 'BESTA-ADAM',
    status: 'actif', sponsorId: null, registeredAt: '2026-01-01', momoNumber: '' }],
  commissions: [], referrals: [], orders: [], products: [], formations: [], formationProgress: [],
  subscriptions: [], subscriptionPayments: [], companies: [], factures: [], proClients: [],
  devisCounter: 2, orderCounter: 0,
};

await page.goto('http://localhost:3000');
await page.evaluate((e) => {
  localStorage.setItem('bestasolar_data', JSON.stringify(e));
  localStorage.setItem('bestasolar_user', JSON.stringify({ id: 'u1', email: 'adam@bestasolar.bj', name: 'Adam Adébiyi', role: 'gerant', phone: '+229', avatar: 'AA' }));
}, ETAT);
await page.goto('http://localhost:3000/pipeline');
await page.waitForSelector('.kanban-container', { timeout: 15000 });
await page.waitForTimeout(700);

const lire = () => page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')).commissions || []);
ok((await lire()).length === 0, 'aucune commission au départ');

// Affaire 1 → GAGNÉ (via la fiche)
await page.locator('.kanban-card:has-text("BS-20260801-0001")').first().click();
await page.waitForTimeout(600);
const btnGagne = page.locator('.sheet button:has-text("Gagné")').first();
ok(await btnGagne.count() === 1, 'bouton « Gagné » présent dans la fiche');
await btnGagne.click();
await page.waitForTimeout(1200);
await page.keyboard.press('Escape'); await page.waitForTimeout(800);

const c1 = await lire();
ok(c1.length === 1, `affaire gagnée → ${c1.length} commission créée AUTOMATIQUEMENT [attendu 1]`);
if (c1.length) {
  ok(c1[0].amount === 15000, `montant = ${c1[0].amount} F [attendu 15 000 = 3 % de 500 000]`);
  ok(c1[0].devisId === 'D1', 'la commission est rattachée au bon devis');
  ok(c1[0].status === 'en_attente', 'commission en attente de paiement');
}

// Affaire 2 → GAGNÉ : une SECONDE commission, pas un doublon
await page.locator('.kanban-card:has-text("BS-20260801-0002")').first().click();
await page.waitForTimeout(600);
await page.locator('.sheet button:has-text("Gagné")').first().click();
await page.waitForTimeout(1200);
await page.keyboard.press('Escape'); await page.waitForTimeout(800);

const c2 = await lire();
ok(c2.length === 2, `deux affaires gagnées → ${c2.length} commissions [attendu 2]`);
ok(c2.reduce((t, c) => t + c.amount, 0) === 24000,
   `total des commissions = ${c2.reduce((t, c) => t + c.amount, 0)} F [attendu 24 000]`);

// Visible dans l'écran Commissions ?
await page.goto('http://localhost:3000/plus/commissions');
await page.waitForTimeout(1200);
const texte = await page.locator('.page-content, body').first().textContent();
ok(/15\s?000/.test(texte) && /9\s?000/.test(texte), 'les deux commissions sont affichées dans l’écran Commissions');

// ---- RÉSEAU À DEUX NIVEAUX : le parrain de l'apporteur touche 1,5 % ----
// MARIE parraine FATOU ; FATOU apporte l'affaire. Le passage à « Gagné » doit
// créer DEUX commissions : 3 % pour Fatou, 1,5 % pour Marie.
const ETAT_N2 = {
  version: 5,
  leads: [{ id: 'LN2', name: 'HOTEL DU LAC', contact: 'M. K', phone: '+229', address: 'Parakou',
    clientType: 'entreprise', stage: 'negociation', estimatedValue: 1000000, assignedTo: 'u2',
    parrainL1: 'p-fatou', parrainL2: null, createdAt: '2026-08-01', lastActivity: '2026-08-01' }],
  devis: [{ id: 'DN2', devisNumber: 'BS-20260801-0009', leadId: 'LN2', total: 1000000, type: 'manual',
    stage: 'proposition', statut: 'valide', partnerId: 'p-fatou', createdBy: 'u2', createdAt: '2026-08-01', lignes: [] }],
  partners: [
    { id: 'p-marie', userId: 'u1', name: 'Marie', code: 'BESTA-MARIE', status: 'actif', sponsorId: null, registeredAt: '2026-01-01' },
    { id: 'p-fatou', userId: 'u2', name: 'Fatou', code: 'BESTA-FATOU', status: 'actif', sponsorId: 'p-marie', registeredAt: '2026-02-01' },
  ],
  commissions: [], referrals: [], orders: [], products: [], formations: [], formationProgress: [],
  subscriptions: [], subscriptionPayments: [], companies: [], factures: [], proClients: [],
  devisCounter: 1, orderCounter: 0,
};
// Page neuve : la précédente a son propre état en mémoire, qu'elle
// ré-enregistrerait par-dessus le nôtre à la première sauvegarde différée.
const p2 = await nav.newPage();
p2.on('pageerror', (e) => jsErr.push(String(e)));
await p2.goto('http://localhost:3000');
await p2.evaluate((e) => {
  localStorage.setItem('bestasolar_data', JSON.stringify(e));
  localStorage.setItem('bestasolar_user', JSON.stringify({ id: 'u1', email: 'marie@bestasolar.bj', name: 'Marie', role: 'gerant', phone: '+229', avatar: 'M' }));
}, ETAT_N2);
await p2.goto('http://localhost:3000/pipeline');
await p2.waitForSelector('.kanban-container', { timeout: 15000 });
await p2.waitForTimeout(700);
await p2.locator('.kanban-card:has-text("HOTEL DU LAC")').first().click();
await p2.waitForTimeout(600);
await p2.locator('.sheet button:has-text("Gagné")').first().click();
await p2.waitForTimeout(1200);

const cn2 = await p2.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')).commissions || []);
const n1 = cn2.find((c) => c.level === 1);
const n2 = cn2.find((c) => c.level === 2);
ok(cn2.length === 2, `réseau à 2 niveaux → ${cn2.length} commission(s) [attendu 2]`);
ok(!!n1 && n1.partnerId === 'p-fatou' && n1.amount === 30000,
   `niveau 1 : ${n1?.amount} F pour l’apporteur [attendu 30 000 = 3 %]`);
ok(!!n2 && n2.partnerId === 'p-marie' && n2.amount === 15000,
   `niveau 2 : ${n2?.amount} F pour SON PARRAIN [attendu 15 000 = 1,5 %]`);

console.log(R.join('\n'));
console.log(jsErr.length ? `\nERREURS JS : ${jsErr.slice(0, 2).join(' | ')}` : '\naucune erreur JS');
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length + jsErr.length;
process.exit(echecs ? 1 : 0);
