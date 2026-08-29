/* Le client qui choisit une formule sur la page d'accueil doit arriver au
   PAIEMENT de cette formule-là — pas au tableau de bord, pas sur l'offre
   mensuelle qu'il n'a pas demandée.

   Chaque scénario ouvre son PROPRE contexte : l'app écrit dans localStorage à
   chaque changement d'état, et un scénario qui hérite du précédent teste
   autre chose que ce qu'il croit. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const jsErr = [];
const B = 'http://127.0.0.1:3000';

const ETAT = {
  version: 5,
  leads: [], devis: [], partners: [], commissions: [], referrals: [], orders: [],
  products: [], formations: [], formationProgress: [], subscriptions: [],
  subscriptionPayments: [], companies: [], factures: [], proClients: [],
  devisCounter: 0, orderCounter: 0,
};
const UTILISATEUR = { id: 'u9', email: 'neuf@bestasolar.bj', name: 'Nouveau', role: 'technicien', phone: '+22990000000', avatar: 'N' };

const nouvelOnglet = async () => {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => jsErr.push(String(e)));
  p.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/net::ERR_|Failed to load resource/.test(m.text())) return;
    jsErr.push('console: ' + m.text());
  });
  return p;
};
const semer = (p, data, extra = {}) => p.evaluate(([e, u, x]) => {
  localStorage.setItem('bestasolar_data', JSON.stringify(e));
  localStorage.setItem('bestasolar_user', JSON.stringify(u));
  Object.entries(x).forEach(([k, v]) => localStorage.setItem(k, v));
}, [data, UTILISATEUR, extra]);

// ---- 1. LA PAGE D'ACCUEIL PORTE LA FORMULE DANS SES LIENS ----
{
  const page = await nouvelOnglet();
  await page.goto(B + '/');
  await page.waitForSelector('.landing');
  const liens = await page.evaluate(() => {
    const t = (txt) => [...document.querySelectorAll('#tarifs a')].find((a) => a.textContent.trim() === txt)?.getAttribute('href');
    return { gratuit: t('Créer mon compte'), mensuel: t('Personnaliser'),
      trimestriel: t('Choisir Pro Confort'), annuel: t('Choisir Pro Premium') };
  });
  ok(liens.gratuit === '/inscription', `carte gratuite : aucune formule (${liens.gratuit})`);
  ok(liens.mensuel === '/inscription?formule=mensuel', `Pro Essentiel → mensuel (${liens.mensuel})`);
  ok(liens.trimestriel === '/inscription?formule=trimestriel', `Pro Confort → trimestriel (${liens.trimestriel})`);
  ok(liens.annuel === '/inscription?formule=annuel', `Pro Premium → annuel (${liens.annuel})`);
  await page.context().close();
}

// ---- 2. LA FORMULE EST CAPTÉE, ET L'ADRESSE NETTOYÉE ----
{
  const page = await nouvelOnglet();
  await page.goto(B + '/inscription?formule=annuel');
  await page.waitForTimeout(900);
  const capte = await page.evaluate(() => ({
    memorisee: localStorage.getItem('bestasolar_formule_choisie'),
    adresse: window.location.search,
  }));
  ok(capte.memorisee === 'annuel', `formule mémorisée (${capte.memorisee})`);
  ok(!capte.adresse.includes('formule'), `adresse nettoyée (${capte.adresse || 'vide'})`);
  await page.context().close();
}

// ---- 3. UNE FORMULE INVENTÉE N'EST JAMAIS RETENUE ----
{
  const page = await nouvelOnglet();
  await page.goto(B + '/inscription?formule=gratuit_a_vie');
  await page.waitForTimeout(700);
  ok(await page.evaluate(() => localStorage.getItem('bestasolar_formule_choisie')) === null,
     'formule inventée : rien de mémorisé');
  await page.context().close();
}

// ---- 4. LE COMPTE CRÉÉ ARRIVE DIRECTEMENT AU PAIEMENT DE SA FORMULE ----
{
  const page = await nouvelOnglet();
  await page.goto(B + '/');
  await semer(page, ETAT, { bestasolar_formule_choisie: 'annuel' });
  await page.goto(B + '/dashboard');
  await page.waitForTimeout(2500);

  ok(await page.locator('.formule').count() === 3, 'la fiche d’abonnement s’ouvre d’elle-même, avec ses trois formules');
  const retenue = (await page.locator('.formule-choisie').innerText()).replace(/\n/g, ' ');
  ok(retenue.includes('Pro Premium'), `la formule choisie sur la page d’accueil est pré-sélectionnée (${retenue.slice(0, 40)})`);
  ok(/45\s?000/.test(retenue), 'à son tarif annuel');
  ok(/365 jours/.test(retenue), 'et sa durée annoncée');

  // Le bouton qui engage la dépense porte le montant, pas un tarif générique.
  // (Le bouton KKiaPay, lui, n'apparaît que si une clé publique est
  // configurée — hors sujet ici, où l'app tourne sans backend.)
  const bouton = await page.locator('button:has-text("S\'abonner")').first().innerText();
  ok(/45\s?000/.test(bouton), `le bouton d’abonnement porte le montant annuel (${bouton.trim()})`);

  // ---- 5. CHANGER DE FORMULE CHANGE LE MONTANT ENGAGÉ ----
  await page.locator('.formule', { hasText: 'Pro Confort' }).click();
  await page.waitForTimeout(300);
  const retenue2 = (await page.locator('.formule-choisie').innerText()).replace(/\n/g, ' ');
  ok(retenue2.includes('Pro Confort'), 'changer de formule change la sélection');
  const bouton2 = await page.locator('button:has-text("S\'abonner")').first().innerText();
  ok(/12\s?750/.test(bouton2), `le montant engagé suit la formule (${bouton2.trim()})`);
  await page.context().close();
}

// ---- 6. SANS FORMULE CHOISIE, RIEN NE CHANGE ----
{
  const page = await nouvelOnglet();
  await page.goto(B + '/');
  await semer(page, ETAT);
  await page.goto(B + '/dashboard');
  await page.waitForTimeout(2500);
  ok(new URL(page.url()).pathname === '/dashboard',
     `sans formule choisie : le tableau de bord, comme avant (${new URL(page.url()).pathname})`);
  ok(await page.locator('.formule').count() === 0, 'aucune fiche d’abonnement imposée');
  await page.context().close();
}

// ---- 7. UN ABONNÉ ACTIF N'EST PAS RENVOYÉ AU PAIEMENT ----
{
  const page = await nouvelOnglet();
  const fin = new Date(Date.now() + 300 * 86400000).toISOString();
  await page.goto(B + '/');
  await semer(page, { ...ETAT, subscriptions: [{
    id: 'sub-u9', userId: 'u9', type: 'devis_pro', status: 'actif',
    formule: 'annuel', montant: 45000, dateDebut: new Date().toISOString(), dateFin: fin,
  }] }, { bestasolar_formule_choisie: 'annuel' });
  await page.goto(B + '/dashboard');
  await page.waitForTimeout(2500);
  ok(new URL(page.url()).pathname === '/dashboard',
     `abonné actif : aucun renvoi au paiement (${new URL(page.url()).pathname})`);
  ok(await page.locator('.formule').count() === 0, 'aucune fiche d’abonnement pour qui a déjà payé');
  await page.context().close();
}

ok(jsErr.length === 0, `aucune erreur JS${jsErr.length ? ' — ' + jsErr.slice(0, 3).join(' | ') : ''}`);
console.log(R.join('\n'));
await nav.close();
process.exit(R.some((l) => l.startsWith('❌')) ? 1 : 0);
