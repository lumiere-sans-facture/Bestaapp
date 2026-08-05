/* Circuit de paiement des commissions : le partenaire demande, le gérant règle
   ou refuse — et une commission réglée ne peut plus l'être une seconde fois. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const jsErr = [];

const ETAT = {
  version: 5,
  leads: [
    { id: 'L1', name: 'CLINIQUE SAINT JEAN', contact: 'Dr H', phone: '+229', address: 'Parakou',
      clientType: 'entreprise', stage: 'gagne', estimatedValue: 500000, assignedTo: 'u2',
      createdAt: '2026-08-01', wonAt: '2026-08-02', lastActivity: '2026-08-02' },
    { id: 'L2', name: 'HOTEL DU LAC', contact: 'M. K', phone: '+229', address: 'Parakou',
      clientType: 'entreprise', stage: 'gagne', estimatedValue: 250000, assignedTo: 'u2',
      createdAt: '2026-08-01', wonAt: '2026-08-03', lastActivity: '2026-08-03' },
  ],
  devis: [],
  partners: [
    { id: 'p-user-u1', userId: 'u1', name: 'Adam', code: 'BESTA-ADAM', status: 'actif', sponsorId: null, registeredAt: '2026-01-01' },
    { id: 'p-user-u2', userId: 'u2', name: 'Fatou Boko', code: 'BESTA-FATOU', status: 'actif', sponsorId: null, momoNumber: '+229 97 55 44 33', registeredAt: '2026-01-01' },
  ],
  commissions: [
    { id: 'C1', partnerId: 'p-user-u2', leadId: 'L1', level: 1, amount: 15000, status: 'en_attente', paidAt: null, createdAt: '2026-08-02' },
    { id: 'C2', partnerId: 'p-user-u2', leadId: 'L2', level: 1, amount: 7500, status: 'en_attente', paidAt: null, createdAt: '2026-08-03' },
    { id: 'C3', partnerId: 'p-user-u2', leadId: 'L1', level: 2, amount: 30000, status: 'payée', paidAt: '2026-07-30', payMode: 'momo', createdAt: '2026-07-01' },
  ],
  payoutRequests: [],
  referrals: [], orders: [], products: [], formations: [], formationProgress: [],
  subscriptions: [], subscriptionPayments: [], companies: [], factures: [], proClients: [],
  devisCounter: 0, orderCounter: 0,
};
const GERANT = { id: 'u1', email: 'adam@bestasolar.bj', name: 'Adam', role: 'gerant', phone: '+229', avatar: 'A' };
const PARTENAIRE = { id: 'u2', email: 'fatou@bestasolar.bj', name: 'Fatou Boko', role: 'technicien', phone: '+229', avatar: 'FB' };

// Un seul CONTEXTE pour tout le scénario : `browser.newPage()` ouvrirait un
// contexte isolé et les deux comptes ne partageraient pas le même stockage —
// or c'est précisément le passage de relais entre eux que l'on teste.
// Une page neuve par session en revanche : l'app réenregistre son état à la
// fermeture de l'onglet et écraserait le jeu de données qu'on vient d'installer.
const ctx = await nav.newContext({ viewport: { width: 1280, height: 1000 } });
let page;
const lire = () => page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')));
const session = async (compte, url, etat) => {
  if (page) await page.close();
  page = await ctx.newPage();
  page.on('pageerror', (e) => jsErr.push(String(e)));
  // Le jeu de données est installé AVANT que l'app ne démarre : passer par
  // evaluate() après un premier chargement laisserait l'enregistrement différé
  // de l'app écraser ce qu'on vient d'écrire. Le drapeau de session garantit
  // que le rechargement de l'onglet ne réinstalle pas l'état de départ.
  await page.addInitScript(([e, u]) => {
    if (e && !sessionStorage.getItem('__seed')) {
      localStorage.setItem('bestasolar_data', JSON.stringify(e));
      sessionStorage.setItem('__seed', '1');
    }
    localStorage.setItem('bestasolar_user', JSON.stringify(u));
  }, [etat || null, compte]);
  await page.goto(`http://localhost:3000${url}`);
  await page.waitForSelector('.page', { timeout: 15000 });
  await page.waitForTimeout(900);
};

// ---- 1. LE PARTENAIRE VOIT CE QU'IL PEUT DEMANDER ----
await session(PARTENAIRE, '/plus/mypartner', ETAT);
const barre = await page.locator('.retrait-bar').innerText();
ok(/22 500 F/.test(barre), `partenaire : le solde mobilisable est annoncé [${barre.replace(/\n/g, ' ')}]`);
ok(!/30 000/.test(barre), 'partenaire : une commission DÉJÀ payée n’entre pas dans le solde');

// ---- 2. IL DEMANDE — ET PEUT NE DEMANDER QU'UNE PARTIE ----
await page.locator('button:has-text("Demander un paiement")').click();
await page.waitForTimeout(700);
const lignes = await page.locator('.retrait-ligne').count();
ok(lignes === 2, `demande : ${lignes} commission(s) proposée(s) [attendu 2]`);
ok(await page.locator('.retrait-ligne.is-on').count() === 2, 'demande : tout est coché par défaut');
ok(/22 500 F/.test(await page.locator('.retrait-total').innerText()), 'demande : le total suit les cases cochées');

// On décoche la plus petite : le total doit suivre — et le minimum bloquer si besoin
await page.locator('.retrait-ligne').nth(1).locator('input').uncheck();
await page.waitForTimeout(400);
ok(/15 000 F/.test(await page.locator('.retrait-total').innerText()),
   'demande : décocher une commission recalcule le total');
await page.locator('.retrait-ligne').nth(1).locator('input').check();
await page.waitForTimeout(300);

const champTel = page.locator('.sheet input[placeholder="+229 ..."]');
ok(await champTel.inputValue() === '+229 97 55 44 33', 'demande : le numéro Mobile Money du profil est pré-rempli');
await page.locator('.sheet button:has-text("Envoyer la demande")').click();
await page.waitForTimeout(1200);

let etat = await lire();
const demande = etat.payoutRequests[0];
ok(etat.payoutRequests.length === 1, 'demande : une demande est enregistrée');
ok(demande.amount === 22500, `demande : montant ${demande.amount} [attendu 22 500]`);
ok(demande.status === 'en_attente', 'demande : elle attend la validation du gérant');
ok((demande.commissionIds || []).length === 2, 'demande : elle porte les 2 commissions couvertes');
ok(etat.commissions.filter((c) => c.status === 'payée').length === 1,
   'demande : RIEN n’est payé tant que le gérant n’a pas tranché');

// ---- 3. PAS DE SECONDE DEMANDE SUR LE MÊME ARGENT ----
await page.reload();
await page.waitForSelector('.retrait-bar', { timeout: 15000 });
await page.waitForTimeout(800);
const barre2 = await page.locator('.retrait-bar').innerText();
ok(/en attente de validation/.test(barre2), 'partenaire : sa demande en cours est affichée');
ok(await page.locator('button:has-text("Demander un paiement")').count() === 0,
   'partenaire : impossible d’en lancer une seconde sur le même argent');

// ---- 3 bis. LA COMMISSION DEMANDÉE QUITTE « À RÉCLAMER » ----
const kpis = await page.locator('.partner-kpis').innerText();
ok(/0 F\nÀ réclamer/.test(kpis) || /0 F[\s\S]{0,20}À réclamer/.test(kpis),
   `partenaire : plus rien « à réclamer » [${kpis.split('\n').slice(0, 4).join(' / ')}]`);
ok(/22 500 F[\s\S]{0,60}Demandées/.test(kpis),
   'partenaire : le montant bascule dans « Demandées, en attente de validation »');
for (const h of await page.locator('.accordion-head').all()) await h.click();
await page.waitForTimeout(500);
const histo = await page.locator('.accordion:has-text("Historique de mes commissions")').innerText();
ok((histo.match(/Demandée/g) || []).length === 2,
   'partenaire : les 2 commissions portent l’état « Demandée »');

// ---- 4. LE GÉRANT REÇOIT LA DEMANDE ----
await session(GERANT, '/plus/commissions', null);
ok(await page.locator('.validation-bar').count() === 1, 'gérant : la demande apparaît en tête de l’écran Commissions');
const bloc = await page.locator('.validation-bar').innerText();
ok(/Fatou Boko/.test(bloc) && /22 500 F/.test(bloc), `gérant : partenaire et montant sont lisibles`);
ok(/\+229 97 55 44 33/.test(bloc), 'gérant : le numéro à créditer est affiché');
ok(/2 commissions/.test(bloc), 'gérant : le nombre de commissions couvertes est indiqué');

// Les commissions demandées sortent du lot payable — sinon elles pourraient
// être réglées à côté de la demande, donc deux fois.
const totaux = await page.locator('.commission-totals').innerText();
ok(/0 F[\s\S]{0,30}à payer/.test(totaux), `gérant : plus rien « à payer » à l’unité [${totaux.split('\n').join(' / ')}]`);
ok(/22 500 F[\s\S]{0,40}Demandées/.test(totaux), 'gérant : le montant apparaît en « Demandées, à trancher »');
ok(await page.locator('.commission-card button:has-text("Payer ")').count() === 0,
   'gérant : aucune commission demandée ne garde son bouton « Payer » individuel');
ok((await page.locator('.commissions-list').innerText()).includes('Incluse dans une demande'),
   'gérant : la carte explique pourquoi elle n’est plus payable seule');
await page.locator('.category-chip:has-text("Demandées")').click();
await page.waitForTimeout(500);
ok(await page.locator('.commission-card').count() === 2, 'gérant : le filtre « Demandées » isole les deux commissions');
await page.locator('.category-chip:has-text("Toutes")').click();
await page.waitForTimeout(400);

// ---- 5. IL RÈGLE, ET LES COMMISSIONS SUIVENT ----
await page.locator('.validation-bar button:has-text("Payer")').click();
await page.waitForTimeout(700);
await page.locator('.sheet input[placeholder*="transaction"]').fill('MP-99120');
await page.locator('.sheet button:has-text("Confirmer le paiement")').click();
await page.waitForTimeout(1200);

etat = await lire();
const reglee = etat.payoutRequests[0];
ok(reglee.status === 'paye', 'gérant : la demande passe « payée »');
ok(reglee.payRef === 'MP-99120', 'gérant : la référence de transaction est conservée');
const payees = etat.commissions.filter((c) => c.status === 'payée');
ok(payees.length === 3, `gérant : les 2 commissions couvertes deviennent payées [${payees.length}/3]`);
ok(payees.every((c) => c.id !== 'C1' || c.payRef === 'MP-99120'),
   'gérant : la référence est reportée sur chaque commission réglée');
ok(await page.locator('.validation-bar').count() === 0, 'gérant : la demande traitée disparaît de la barre');

// ---- 6. PLUS RIEN À DEMANDER ----
await session(PARTENAIRE, '/plus/mypartner', null);
const barre3 = await page.locator('.retrait-bar').innerText();
ok(/Aucune commission à faire régler/.test(barre3),
   'partenaire : son solde est à zéro — impossible de redemander ce qui est payé');

// ---- 7. LE REFUS LIBÈRE LES COMMISSIONS ----
const ETAT_REFUS = JSON.parse(JSON.stringify(ETAT));
ETAT_REFUS.payoutRequests = [{
  id: 'PR1', partnerId: 'p-user-u2', partnerName: 'Fatou Boko', partnerCode: 'BESTA-FATOU',
  commissionIds: ['C1', 'C2'], amount: 22500, methode: 'momo', telephone: '+229 97 55 44 33',
  note: '', status: 'en_attente', requestedBy: 'u2', requestedAt: '2026-08-05T10:00:00Z',
  decidedBy: null, decidedAt: null, motif: null, payRef: null, paidAt: null,
}];
await session(GERANT, '/plus/commissions', ETAT_REFUS);
await page.locator('.validation-bar button:has-text("Refuser")').click();
await page.waitForTimeout(700);
await page.locator('.sheet input[placeholder*="encaissée"]').fill('Client pas encore encaissé');
await page.locator('.sheet button:has-text("Refuser la demande")').click();
await page.waitForTimeout(1200);

etat = await lire();
ok(etat.payoutRequests[0].status === 'refuse', 'refus : la demande est marquée refusée');
ok(etat.payoutRequests[0].motif === 'Client pas encore encaissé', 'refus : le motif est conservé');
ok(etat.commissions.filter((c) => c.status === 'payée').length === 1,
   'refus : AUCUNE commission n’a été payée');

await session(PARTENAIRE, '/plus/mypartner', null);
const barre4 = await page.locator('.retrait-bar').innerText();
ok(/22 500 F/.test(barre4), 'refus : les commissions redeviennent demandables');
const kpis4 = await page.locator('.partner-kpis').innerText();
ok(/22 500 F[\s\S]{0,30}À réclamer/.test(kpis4),
   'refus : le montant revient dans « À réclamer »');
ok(!/Demandées/.test(kpis4), 'refus : la tuile « Demandées » disparaît');

console.log('\n' + R.join('\n'));
console.log(jsErr.length ? `\n❌ erreurs JS : ${jsErr.slice(0, 2).join(' | ')}` : '\naucune erreur JS');
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length + jsErr.length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ circuit de paiement des commissions conforme');
process.exit(echecs ? 1 : 0);
