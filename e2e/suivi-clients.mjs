import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await nav.newPage();
const jsErr = [];
page.on('pageerror', (e) => jsErr.push(String(e)));
const R = [];
const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };

await page.goto('http://localhost:3000');

// État de départ maîtrisé : 1 client avec DEUX devis, 1 client sans devis.
await page.evaluate(() => {
  const etat = {
    version: 5,
    leads: [
      { id: 'L1', name: 'HOTEL TEST', contact: 'M. Kossi', phone: '+229 90', address: 'Parakou',
        clientType: 'entreprise', stage: 'qualifie', estimatedValue: 500000,
        assignedTo: 'u1', parrainL1: null, parrainL2: null, createdAt: '2026-08-01', lastActivity: '2026-08-01' },
      { id: 'L2', name: 'PHARMA TEST', contact: 'Mme A', phone: '+229 91', address: 'Parakou',
        clientType: 'entreprise', stage: 'nouveau', estimatedValue: 0,
        assignedTo: 'u1', parrainL1: null, parrainL2: null, createdAt: '2026-08-01', lastActivity: '2026-08-01' },
    ],
    devis: [
      { id: 'D1', leadId: 'L1', devisNumber: 'BS-20260801-0001', type: 'manual', total: 500000,
        statut: 'finalise', stage: 'proposition', createdBy: 'u1', createdAt: '2026-08-01T08:00:00Z',
        partnerId: 'p-user-u1', lignes: [{ designation: 'Kit A', qty: 1, pu: 500000 }] },
      { id: 'D2', leadId: 'L1', devisNumber: 'BS-20260801-0002', type: 'solar', total: 300000,
        statut: 'finalise', stage: 'negociation', createdBy: 'u1', createdAt: '2026-08-02T08:00:00Z',
        partnerId: 'p-user-u1', lignes: [{ designation: 'Kit B', qty: 1, pu: 300000 }] },
    ],
    partners: [{ id: 'p-user-u1', userId: 'u1', name: 'Adam Adébiyi', code: 'BESTA-ADAM',
      status: 'actif', sponsorId: null, registeredAt: '2026-01-01', momoNumber: '' }],
    commissions: [], referrals: [], orders: [], products: [], formations: [], formationProgress: [],
    subscriptions: [], subscriptionPayments: [], companies: [], factures: [], proClients: [],
    devisCounter: 2, orderCounter: 0,
  };
  localStorage.setItem('bestasolar_data', JSON.stringify(etat));
  localStorage.setItem('bestasolar_user', JSON.stringify({ id: 'u1', email: 'adam@bestasolar.bj', name: 'Adam Adébiyi', role: 'gerant', phone: '+229 97', avatar: 'AA' }));
});
await page.goto('http://localhost:3000/pipeline');
await page.waitForSelector('.kanban-container', { timeout: 15000 });
await page.waitForTimeout(700);

// 1. Deux devis d'un client → deux cartes
const cartesHotel = page.locator('.kanban-card:has-text("HOTEL TEST")');
const n = await cartesHotel.count();
ok(n === 2, `client à deux devis → ${n} carte(s) [attendu 2]`);

// 2. Chaque carte porte SON numéro et SON montant
const textes = await cartesHotel.allTextContents();
ok(textes.some((t) => t.includes('BS-20260801-0001')) && textes.some((t) => t.includes('BS-20260801-0002')),
   'chaque carte affiche son numéro de devis');
ok(textes.some((t) => t.replace(/\s/g, '').includes('500000')) && textes.some((t) => t.replace(/\s/g, '').includes('300000')),
   'chaque carte affiche le montant de SON devis');

// 3. Les deux cartes sont dans des colonnes différentes
const colonnes = await page.locator('.kanban-column').evaluateAll((cols) =>
  cols.map((c) => ({
    titre: c.querySelector('.kanban-column-title span')?.textContent?.trim(),
    hotel: c.querySelectorAll('.kanban-card').length
      ? [...c.querySelectorAll('.kanban-card')].filter((k) => k.textContent.includes('HOTEL TEST')).length : 0,
  })));
const avecHotel = colonnes.filter((c) => c.hotel > 0).map((c) => c.titre);
ok(avecHotel.length === 2, `les deux affaires sont dans DEUX colonnes distinctes : ${avecHotel.join(' + ')}`);

// 4. Client sans devis → carte de prospection
ok(await page.locator('.kanban-card:has-text("PHARMA TEST")').count() === 1,
   'client sans devis → carte de prospection conservée');

// 5. Déplacer UNE affaire ne touche pas l'autre
await cartesHotel.filter({ hasText: 'BS-20260801-0001' }).first().click();
await page.waitForTimeout(600);
const stepper = page.locator('.sheet .stage-stepper .stage-step');
ok(await stepper.count() >= 5, `barre de progression visible dans la fiche (${await stepper.count()} étapes)`);
await stepper.filter({ hasText: 'Négociation' }).first().click();
await page.waitForTimeout(600);
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
const apres = await page.locator('.kanban-column').evaluateAll((cols) =>
  cols.flatMap((c) => [...c.querySelectorAll('.kanban-card')]
    .filter((k) => k.textContent.includes('HOTEL TEST'))
    .map((k) => ({ colonne: c.querySelector('.kanban-column-title span')?.textContent?.trim(),
                   devis: (k.textContent.match(/BS-\d+-\d+/) || [''])[0] }))));
ok(apres.length === 2, 'toujours deux affaires après déplacement');
console.log('   position des affaires :', JSON.stringify(apres));

console.log(R.join('\n'));
console.log(jsErr.length ? `\nERREURS JS : ${jsErr.slice(0, 2).join(' | ')}` : '\naucune erreur JS');
await nav.close();
