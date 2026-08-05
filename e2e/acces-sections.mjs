/* Les écrans d'administration sont fermés à un simple utilisateur — y compris
   par l'URL, et y compris après une déconnexion / reconnexion. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const jsErr = [];

const ETAT = {
  version: 5,
  leads: [], devis: [],
  partners: [{ id: 'p-user-u2', userId: 'u2', name: 'Siddik', code: 'BESTA-SIDDIK', status: 'actif', sponsorId: null, registeredAt: '2026-01-01' }],
  commissions: [{ id: 'C1', partnerId: 'p-user-u2', leadId: null, level: 1, amount: 111690,
    status: 'en_attente', paidAt: null, createdAt: '2026-08-03' }],
  referrals: [], orders: [], products: [], formations: [], formationProgress: [],
  subscriptions: [], subscriptionPayments: [], companies: [], factures: [], proClients: [],
  devisCounter: 0, orderCounter: 0,
};
const GERANT = { id: 'u1', email: 'boss@bestasolar.bj', name: 'Adam', role: 'gerant', phone: '+229', avatar: 'A' };
const UTILISATEUR = { id: 'u2', email: 'siddik@bestasolar.bj', name: 'Siddik', role: 'technicien', phone: '+229', avatar: 'S' };

const page = await nav.newPage({ viewport: { width: 1280, height: 900 } });
page.on('pageerror', (e) => jsErr.push(String(e)));
const seConnecter = async (compte, url) => {
  await page.goto('http://localhost:3000');
  await page.evaluate(([e, u]) => {
    localStorage.setItem('bestasolar_data', JSON.stringify(e));
    localStorage.setItem('bestasolar_user', JSON.stringify(u));
  }, [ETAT, compte]);
  await page.goto(`http://localhost:3000${url}`);
  await page.waitForSelector('.page', { timeout: 15000 });
  await page.waitForTimeout(800);
};

// ---- 1. LE GÉRANT, LUI, A BIEN ACCÈS ----
await seConnecter(GERANT, '/plus/commissions');
ok(page.url().endsWith('/plus/commissions'), 'gérant : reste sur /plus/commissions');
ok(await page.locator('button:has-text("Commission manuelle")').count() === 1,
   'gérant : les actions d’administration sont là');

// ---- 2. LE SCÉNARIO SIGNALÉ : on se reconnecte sur un compte simple ----
// Sans quitter l'adresse — c'est exactement ce qui arrivait après une
// déconnexion suivie d'une reconnexion : l'app est une page unique.
await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), UTILISATEUR);
await page.goto('http://localhost:3000/plus/commissions');
await page.waitForSelector('.page', { timeout: 15000 });
await page.waitForTimeout(1000);

ok(page.url().endsWith('/plus'), `utilisateur : renvoyé au menu (URL = ${new URL(page.url()).pathname})`);
const texte = await page.locator('.page-content').innerText();
ok(!/Commission manuelle|Synchroniser/.test(texte),
   'utilisateur : plus aucune action d’administration à l’écran');
ok(!/111\s?690/.test(texte), 'utilisateur : les montants du gérant ne sont plus affichés');
ok(await page.locator('button:has-text("Payer")').count() === 0,
   'utilisateur : aucun bouton « Payer »');

// ---- 3. TOUTES LES SECTIONS D'ADMINISTRATION SONT FERMÉES ----
for (const s of ['partners', 'commissions', 'orders', 'team', 'backup', 'subsadmin']) {
  await page.goto(`http://localhost:3000/plus/${s}`);
  await page.waitForSelector('.page', { timeout: 15000 });
  await page.waitForTimeout(600);
  ok(new URL(page.url()).pathname === '/plus', `utilisateur : /plus/${s} → renvoi au menu`);
}

// ---- 4. SES PROPRES SECTIONS RESTENT OUVERTES ----
for (const s of ['mypartner', 'profile', 'formation']) {
  await page.goto(`http://localhost:3000/plus/${s}`);
  await page.waitForSelector('.page', { timeout: 15000 });
  await page.waitForTimeout(600);
  ok(new URL(page.url()).pathname === `/plus/${s}`, `utilisateur : /plus/${s} reste accessible`);
}

// ---- 5. LA BARRE LATÉRALE NE PROPOSE PAS L'ADMINISTRATION ----
const sidebar = await page.locator('.sidebar-nav').innerText();
ok(!/Partenaires|Commissions|Équipe|Sauvegarde|Abonnements Pro|Commandes en ligne/.test(sidebar),
   'utilisateur : aucun lien d’administration dans la barre latérale');
ok(/Mon espace partenaire/.test(sidebar), 'utilisateur : son espace partenaire y figure bien');

console.log('\n' + R.join('\n'));
console.log(jsErr.length ? `\n❌ erreurs JS : ${jsErr.slice(0, 2).join(' | ')}` : '\naucune erreur JS');
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length + jsErr.length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ sections d’administration correctement fermées');
process.exit(echecs ? 1 : 0);
