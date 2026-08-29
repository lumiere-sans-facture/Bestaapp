/* « Mes kits » : les kits sont récupérés, modifiables, et l'assistant de devis
   suit immédiatement. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const jsErr = [];

const GERANT = { id: 'u1', email: 'boss@bestasolar.bj', name: 'Adam', role: 'gerant', phone: '+229', avatar: 'A' };
const TECH = { id: 'u2', email: 'sid@bestasolar.bj', name: 'Siddik', role: 'technicien', phone: '+229', avatar: 'S' };

const page = await nav.newPage({ viewport: { width: 1280, height: 950 } });
page.on('pageerror', (e) => jsErr.push(String(e)));
await page.goto('http://localhost:3000');
await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
await page.goto('http://localhost:3000/plus/kits');
await page.waitForSelector('.kits-list', { timeout: 15000 });
await page.waitForTimeout(700);

const lireKits = () => page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')).kits || []);

// ---- 1. LES KITS EXISTANTS SONT RÉCUPÉRÉS ----
const kits = await lireKits();
ok(kits.length === 10, `les 10 kits existants sont récupérés dans les données [${kits.length}]`);
const cartes = await page.locator('.kit-card').count();
ok(cartes === 10, `« Mes kits » affiche les ${cartes} kits`);
const texte = await page.locator('.page-content').innerText();
ok(/Kit 5 kWh/.test(texte) && /Kit 32 kWh/.test(texte), 'les noms d’origine sont là');
ok(/1 200 000 F/.test(texte), 'le total du Kit 5 kWh est calculé (1 200 000 F)');
ok(/5 kWh · 4 × 590 Wc · onduleur 6 kVA/.test(texte), 'les caractéristiques techniques sont résumées');

// ---- 2. MODIFIER UN PRIX ----
await page.locator('.kit-card:has-text("Kit 5 kWh") button:has-text("Modifier")').first().click();
await page.waitForTimeout(600);
const champPu = page.locator('.sheet .doc-line').first().locator('input[type="number"]').nth(1);
await champPu.fill('500000');
const capacite = page.locator('.sheet input[aria-label="Capacité de stockage (kWh)"]');
await capacite.fill('5.12');
await page.waitForTimeout(300);
const totalForm = await page.locator('.kit-form-total strong').innerText();
ok(/1 240 000/.test(totalForm), `le total se recalcule à la saisie [${totalForm}]`);
await page.locator('.sheet button:has-text("Enregistrer")').first().click();
await page.waitForTimeout(1000);

const apres = await lireKits();
const k5 = apres.find((k) => k.id === 'kit-5kwh');
ok(k5.lines[0].pu === 500000, `le prix est enregistré [${k5.lines[0].pu}]`);
ok(k5.battery === 5.12, `la capacité de stockage décimale est enregistrée [${k5.battery} kWh]`);
ok(k5.id === 'kit-5kwh', 'l’identifiant du kit ne change pas (les devis émis y font référence)');
ok(apres.length === 10, 'aucun kit dupliqué par la modification');

// ---- 3. L'ASSISTANT DE DEVIS SUIT ----
await page.goto('http://localhost:3000/devis');
await page.waitForTimeout(1500);
const pageDevis = await page.locator('body').innerText();
ok(!/Erreur|Something went wrong/.test(pageDevis), 'l’écran Devis s’ouvre sans erreur');

// ---- 4. CRÉER, DUPLIQUER, SUPPRIMER ----
await page.goto('http://localhost:3000/plus/kits');
await page.waitForSelector('.kits-list', { timeout: 15000 });
await page.waitForTimeout(600);
await page.locator('button:has-text("Nouveau kit")').first().click();
await page.waitForTimeout(600);
await page.locator('.sheet input').first().fill('Kit 1 kWh — Mini');
const ligne = page.locator('.sheet .doc-line').first();
await ligne.locator('input').first().fill('Batterie 1 kWh');
await ligne.locator('input[type="number"]').nth(1).fill('120000');
await page.locator('.sheet button:has-text("Ajouter le kit")').click();
await page.waitForTimeout(1000);
ok((await lireKits()).length === 11, 'un kit créé s’ajoute à la liste');
ok(await page.locator('.kit-card:has-text("Kit 1 kWh — Mini")').count() === 1, 'le nouveau kit est affiché');

await page.locator('.kit-card:has-text("Kit 1 kWh — Mini") button[aria-label^="Dupliquer"]').click();
await page.waitForTimeout(900);
const dupli = await lireKits();
ok(dupli.length === 12 && dupli.some((k) => k.name === 'Kit 1 kWh — Mini (copie)'),
   'la duplication crée une variante indépendante');

await page.locator('.kit-card:has-text("(copie)") button[aria-label^="Supprimer"]').click();
await page.waitForTimeout(500);
await page.locator('.sheet button:has-text("Supprimer")').last().click();
await page.waitForTimeout(1000);
ok((await lireKits()).length === 11, 'la suppression retire bien le kit');

// ---- 5. LE RATTRAPAGE DES KITS D'ORIGINE ----
await page.locator('.kit-card:has-text("Kit 32 kWh") button[aria-label^="Supprimer"]').click();
await page.waitForTimeout(500);
await page.locator('.sheet button:has-text("Supprimer")').last().click();
await page.waitForTimeout(1000);
ok(await page.locator('.callout:has-text("d\'origine absent")').count() === 1,
   'un kit d’origine supprimé est signalé, avec une remise en place possible');
await page.locator('button:has-text("Remettre les kits d\'origine")').click();
await page.waitForTimeout(1000);
const remis = await lireKits();
ok(remis.some((k) => k.id === 'kit-32kwh'), 'le kit d’origine est remis');
ok(remis.find((k) => k.id === 'kit-5kwh').lines[0].pu === 500000,
   'la remise n’écrase PAS le prix modifié à la main');

// ---- 6. RÉSERVÉ AU GÉRANT ----
await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), TECH);
await page.goto('http://localhost:3000/plus/kits');
await page.waitForSelector('.page', { timeout: 15000 });
await page.waitForTimeout(900);
ok(new URL(page.url()).pathname === '/plus', 'un simple utilisateur est renvoyé au menu');
ok(await page.locator('.kits-list').count() === 0, 'il ne voit aucun kit à modifier');

console.log('\n' + R.join('\n'));
console.log(jsErr.length ? `\n❌ erreurs JS : ${jsErr.slice(0, 2).join(' | ')}` : '\naucune erreur JS');
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length + jsErr.length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ « Mes kits » : récupération, modification et contrôle conformes');
process.exit(echecs ? 1 : 0);
