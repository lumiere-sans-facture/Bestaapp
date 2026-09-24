/* Aucun paiement de test visible par un client : en mode test (bac à sable
   KKiaPay), ni bouton, ni numéros de test, ni mention « (test) ». Seul le
   gérant est prévenu ; en mode réel, le bouton s'affiche pour tous. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };
const TECH = { id: 'u2', email: 'fatou@bestasolar.tg', name: 'Fatou Boko', role: 'technicien', phone: '+22896789012', avatar: 'FB' };
const config = (mode) => ({ id: 'cfg-kkia', provider: 'kkiapay', actif: true, mode,
  champs: { publicKey: 'cle-publique-factice' }, majLe: new Date().toISOString() });

// Chaque scénario : son propre contexte. La configuration est injectée par
// un script d'initialisation, AVANT que l'app ne lise son stockage : écrite
// après coup, elle serait écrasée par l'état en mémoire au déchargement.
const scriptWidget = {};
const fiche = async (utilisateur, mode) => {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
  await page.goto(B + '/');
  await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), utilisateur);
  await page.goto(B + '/plus');                       // dote l'état initial
  await page.waitForTimeout(1500);
  await page.addInitScript((c) => {
    if (sessionStorage.getItem('cfg-posee')) return;
    const d = JSON.parse(localStorage.getItem('bestasolar_data') || 'null');
    if (!d) return;
    d.paiementConfigs = c ? [c] : [];
    localStorage.setItem('bestasolar_data', JSON.stringify(d));
    sessionStorage.setItem('cfg-posee', '1');
  }, mode ? config(mode) : null);
  await page.goto(B + '/plus/gopro');
  await page.waitForSelector('.sheet', { timeout: 15000 });
  await page.waitForTimeout(500);
  const texte = await page.evaluate(() => document.querySelector('.sheet')?.innerText || '');
  // Le script du widget n'est chargé que là où un bouton de paiement s'affiche
  // (il bloquait autrefois l'ouverture de toute l'app, depuis index.html).
  scriptWidget[`${utilisateur.role}-${mode}`] = await page.evaluate(() => !!document.querySelector('script[src*="cdn.kkiapay.me"]'));
  if (process.env.DEBUG) console.log(mode, texte);
  await ctx.close();
  return texte;
};

const clientTest = await fiche(TECH, 'sandbox');
ok(!/KKiaPay|Mode test|mode test|\(test\)|numéros acceptés/i.test(clientTest),
   'mode test : le client ne voit ni bouton KKiaPay, ni numéros de test, ni « (test) »');
ok(/Envoyez 5 000 F par Mobile Money/.test(clientTest) && /S'abonner/.test(clientTest),
   'le paiement Mobile Money manuel reste proposé');

const gerantTest = await fiche(GERANT, 'sandbox');
ok(!/KKiaPay|mode test|\(test\)|masqué/i.test(gerantTest), 'le gérant non plus ne voit aucune mention de test');
ok(!/numéros acceptés|Payer 5 000/.test(gerantTest), 'aucun bouton ni numéro de test, même pour le gérant');

const clientReel = await fiche(TECH, 'live');
ok(/Payer 5 000 F par Mobile Money/.test(clientReel), 'mode réel : le bouton de paiement s’affiche, sans « (test) »');
ok(!/\(test\)|masqué/.test(clientReel), 'mode réel : aucune mention de test');

ok(!scriptWidget['technicien-sandbox'] && !scriptWidget['gerant-sandbox'], 'mode test : le script KKiaPay n’est même pas téléchargé');
ok(scriptWidget['technicien-live'] === true, 'mode réel : le script KKiaPay est chargé à la demande, avec le bouton');

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Paiement : rien de test n’est visible des clients');
process.exit(echecs ? 1 : 0);
