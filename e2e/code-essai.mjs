/* Code d'essai Devis Pro, en mode local : le gérant crée un code, un
   technicien le saisit dans « Passer en mode Pro » et entre dans l'espace
   Pro sans payer ; un second essai du même code est refusé. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const page = await nav.newPage({ viewport: { width: 1280, height: 950 } });
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
const B = 'http://localhost:3000';

const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };
const TECH = { id: 'u2', email: 'fatou@bestasolar.tg', name: 'Fatou Boko', role: 'technicien', phone: '+22896789012', avatar: 'FB' };
// La page d'accueil ne monte pas les données : changer d'utilisateur depuis
// elle évite que l'état en mémoire n'écrase ce qu'on vient d'écrire.
const connecter = async (u) => {
  await page.goto(B + '/');
  await page.waitForTimeout(800);
  await page.evaluate((x) => localStorage.setItem('bestasolar_user', JSON.stringify(x)), u);
};
const etat = () => page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data') || '{}'));

// ---- 1. LE GÉRANT CRÉE UN CODE ----
await connecter(GERANT);
await page.goto(B + '/plus/subsadmin');
await page.waitForSelector(':text("Codes d\'essai")', { timeout: 15000 });
await page.locator('button:has-text("Nouveau code")').click();
await page.waitForTimeout(300);
const propose = await page.locator('input[required]').first().inputValue();
ok(/^ESSAI-[A-Z0-9]{6}$/.test(propose), `un code aléatoire est proposé [${propose}]`);
await page.locator('input[required]').first().fill('BESTA30');
await page.locator('button:has-text("Créer le code")').click();
await page.waitForTimeout(600);
const liste = await page.evaluate(() => document.querySelector('.page-content')?.innerText || '');
ok(/BESTA30/.test(liste) && /30 j · 0 utilisation/.test(liste), 'le code apparaît dans la liste, 30 j, 0 utilisation');

// ---- 2. UN TECHNICIEN L'UTILISE ----
await connecter(TECH);
await page.goto(B + '/plus/gopro');
await page.waitForSelector('.code-essai', { timeout: 15000 });
const fiche = await page.evaluate(() => document.querySelector('.sheet')?.innerText || '');
ok(/Vous avez un code d'essai/.test(fiche), 'la fiche « Passer en mode Pro » propose le code d’essai');

await page.locator('.code-essai input').fill('FAUX-CODE');
await page.locator('.code-essai button[type="submit"]').click();
await page.waitForTimeout(400);
const refus = await page.locator('.code-essai .field-error').innerText().catch(() => '');
ok(/Code inconnu/.test(refus), `un code inconnu est refusé [${refus}]`);

await page.locator('.code-essai input').fill(' besta 30 ');
await page.locator('.code-essai button[type="submit"]').click();
await page.waitForTimeout(800);
const succes = await page.locator('.code-essai-ok').innerText().catch(() => '');
ok(/Essai activé : 30 jours/.test(succes), `le code est accepté, écrit en minuscules et avec espaces [${succes.split('\n')[0]}]`);

const d = await etat();
const sub = (d.subscriptions || []).find((s) => s.id === 'sub-u2');
const jours = sub ? Math.round((new Date(sub.dateFin) - Date.now()) / 86400000) : 0;
ok(sub?.status === 'actif' && sub?.formule === 'essai' && jours === 30,
   `abonnement : ${sub?.status} · ${sub?.formule} · ${jours} j`);
ok(d.codesPromo?.find((c) => c.code === 'BESTA30')?.utilisations?.length === 1, 'l’utilisation est tracée sur le code');

await page.locator('.code-essai-ok button:has-text("Ouvrir mon espace Pro")').click();
await page.waitForTimeout(1500);
ok(new URL(page.url()).pathname.startsWith('/pro') || /Nouveau devis|Devis \(/.test(await page.evaluate(() => document.body.innerText)),
   `l’espace Pro s’ouvre [${new URL(page.url()).pathname}]`);

// ---- 3. LE MÊME CODE NE SERT PAS DEUX FOIS AU MÊME COMPTE ----
await page.goto(B + '/plus');
await page.waitForTimeout(1200);
const retour = await page.locator('button:has-text("Revenir au mode public")').first();
if (await retour.count()) { await retour.click(); await page.waitForTimeout(1200); }
await page.goto(B + '/plus/parametres');
await page.waitForTimeout(1200);
const parametres = await page.evaluate(() => document.querySelector('.page-content')?.innerText || '');
ok(/Essai · 30 j restants/.test(parametres), `l’état de l’abonnement se lit « Essai » [${(parametres.match(/Essai[^\n]*/) || ['—'])[0]}]`);

const deja = await page.evaluate(async () => {
  const { verifierCode } = await import('/src/utils/codePromo.js');
  const d = JSON.parse(localStorage.getItem('bestasolar_data'));
  return verifierCode('BESTA30', d.codesPromo.find((c) => c.code === 'BESTA30'), 'u2').raison;
});
ok(deja === 'deja', `réutiliser le code sur ce compte est refusé [${deja}]`);

// ---- 4. LE GÉRANT VOIT L'ESSAI, SANS QU'IL GONFLE LE REVENU ----
await connecter(GERANT);
await page.goto(B + '/plus/subsadmin');
await page.waitForSelector(':text("Codes d\'essai")', { timeout: 15000 });
const ligneCode = await page.locator('.sheet-row', { hasText: 'BESTA30' }).first().innerText();
ok(/1 utilisation/.test(ligneCode), `le code compte une utilisation [${ligneCode.replace(/\s+/g, ' ')}]`);
ok(await page.locator('.badge', { hasText: /^Essai$/ }).count() === 1, 'l’abonné apparaît avec le badge « Essai »');
await page.screenshot({ path: '/tmp/claude-0/admin-codes.png', fullPage: true });

// ---- 5. MOBILE : LA FICHE TIENT DANS L'ÉCRAN ----
await page.setViewportSize({ width: 375, height: 800 });
await connecter({ ...TECH, id: 'u3', email: 'ibrahim@bestasolar.tg', name: 'Ibrahim' });
await page.goto(B + '/plus/gopro');
await page.waitForSelector('.code-essai', { timeout: 15000 });
const deborde = await page.evaluate(() => {
  const f = document.querySelector('.code-essai').getBoundingClientRect();
  return f.right > window.innerWidth || document.documentElement.scrollWidth > window.innerWidth;
});
ok(!deborde, 'sur téléphone, le bloc du code ne déborde pas');
await page.screenshot({ path: '/tmp/claude-0/fiche-mobile.png' });

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Code d’essai : créé, utilisé, espace Pro ouvert, réutilisation refusée');
process.exit(echecs ? 1 : 0);
