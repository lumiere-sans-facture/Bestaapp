/* Simulateur ROI et assistant de devis : le même kit, composé de la même
   façon. Le Simulateur garde son écran d'avant (ni boutons +/−, ni « Créer le
   devis »), avec la question « Quand consomme-t-il le plus ? » sur la
   facture ; il décrit la composition réellement chiffrée : modules batterie
   ajoutés au besoin (60 kWh porté à 72 kWh), panneaux complétés au besoin,
   onduleur — et l'assistant, pour la même facture et la même réponse, donne
   le même kit, les mêmes panneaux et le même total.
   Nécessite `npm run dev` à côté. */
import { chromium } from '@playwright/test';

const B = 'http://localhost:3000';
const CAPTURES = process.env.CAPTURES || '/tmp';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const jsErr = [];
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam Adébiyi', role: 'gerant', phone: '+228 97 12 34 56', avatar: 'AA' };

const page = await nav.newPage({ viewport: { width: 1280, height: 950 } });
page.on('pageerror', (e) => jsErr.push(String(e)));
page.on('console', (m) => {
  if (m.type() !== 'error' || /net::ERR_|Failed to load resource/.test(m.text())) return;
  jsErr.push('console: ' + m.text());
});
await page.goto(B + '/');
await page.evaluate((u) => {
  localStorage.clear();
  localStorage.setItem('bestasolar_user', JSON.stringify(u));
  localStorage.setItem(`bestasolar_guide_accueil_v1:${u.id}`, 'termine');
}, GERANT);

const chiffres = (t) => Number(String(t || '').replace(/[^\d]/g, ''));
const espaces = (t) => String(t || '').replace(/[\s  ]+/g, ' ').trim();
const prixSimulateur = async () => chiffres(await page.locator('.roi-ligne.is-forte .roi-ligne-montant').first().innerText());
// Les trois réponses de « Quand consomme-t-il le plus ? » tiennent dans leur
// carte : elles passent à la ligne au lieu de défiler hors de vue.
const reponsesVisibles = (p) => p.locator('.chip-selector', { hasText: 'Quand consomme-t-il le plus ?' }).locator('.categories-scroll').evaluate((el) => {
  const boite = el.getBoundingClientRect();
  const boutons = [...el.querySelectorAll('button')];
  return boutons.length === 3 && el.scrollWidth <= el.clientWidth
    && boutons.every((b) => b.getBoundingClientRect().right <= boite.right + 0.5);
});

// ---- 1. SIMULATEUR : l'écran d'avant ----
await page.goto(B + '/plus/roi');
await page.waitForSelector('.roi-kit', { timeout: 15000 });
await page.selectOption('#roi-pays', 'tg');
await page.waitForTimeout(300);
ok(await page.locator('.reglage-kit').count() === 0, 'pas de boutons +/− au Simulateur');
ok(await page.locator('button:has-text("Créer le devis")').count() === 0, 'pas de « Créer le devis » au Simulateur');
ok(await page.locator(':text("Kits suggérés"), .roi-variantes').count() === 0, 'pas de choix de variante au Simulateur');
ok(await page.locator('.roi-mode.is-actif').innerText() === 'D’après sa facture', 'le Simulateur s’ouvre sur « D’après sa facture »');
await page.locator('button:has-text("D’après ses appareils")').click();
await page.waitForTimeout(300);
const kitSim = await page.locator('.roi-kit-nom').innerText();
ok(/10 kWh/.test(kitSim), `appareils de départ : le kit de l’assistant [${kitSim}]`);
ok(await prixSimulateur() === 1851000, `même prix que le devis au Togo, main-d’œuvre doublée [${(await prixSimulateur()).toLocaleString('fr-FR')} F]`);

// ---- 2. FACTURE DE 330 000 F : 60 kWh porté à 72 kWh, comme au devis ----
await page.locator('button:has-text("D’après sa facture")').click();
const question = page.locator('.chip-selector', { hasText: 'Quand consomme-t-il le plus ?' });
ok(await question.count() === 1, 'facture : la question « Quand consomme-t-il le plus ? » est là');
ok(await reponsesVisibles(page), 'Simulateur : les trois réponses visibles, à la ligne, sans défilement');
ok(await question.locator('button.active').innerText() === 'Équilibré jour / nuit', 'réponse par défaut : équilibré, comme dans l’assistant');
await page.locator('input[aria-label="Facture d’électricité"]').fill('330000');
await page.waitForTimeout(400);
let spec = espaces(await page.locator('.roi-kit-spec').innerText());
ok(/60 kWh/.test(await page.locator('.roi-kit-nom').innerText()), `kit 60 kWh [${await page.locator('.roi-kit-nom').innerText()}]`);
ok(/^72 kWh de batterie \(étendue depuis 60\)/.test(spec), `batterie portée à 72 kWh par un module [${spec}]`);
const panneauxSim = Number(/· (\d+) panneaux/.exec(spec)?.[1]);
ok(/\(complétés depuis 42\)/.test(spec), `panneaux complétés au besoin [${panneauxSim}]`);
const prixFacture = await prixSimulateur();
await page.locator('.roi-kit').screenshot({ path: `${CAPTURES}/simulateur-kit-72kwh.png` });

// La réponse change la part de nuit, donc la batterie.
await question.locator('button:has-text("Surtout le soir")').click();
await page.waitForTimeout(300);
spec = espaces(await page.locator('.roi-kit-spec').innerText());
ok(/^96 kWh de batterie \(étendue depuis 60\)/.test(spec) && /70 % la nuit/.test(await page.locator('.roi-note').first().innerText()),
  `« Surtout le soir » : 70 % la nuit, 96 kWh de batterie [${spec.slice(0, 40)}…]`);
await question.locator('button:has-text("Équilibré")').click();
await page.waitForTimeout(300);
ok(await prixSimulateur() === prixFacture, 'retour à « Équilibré » : la proposition de départ');

// ---- 3. ASSISTANT DE DEVIS : la même facture, le même kit ----
await page.goto(B + '/devis');
await page.waitForTimeout(1500);
await page.locator('button:has-text("Créer un devis"), button:has-text("Nouveau devis")').first().click();
await page.waitForTimeout(800);
await page.locator(':text("Dimensionnement solaire")').first().click();
await page.waitForTimeout(900);
await page.locator('.page-content button').nth(1).click(); // un client de Lomé (+228)
await page.waitForTimeout(400);
const suivant = () => page.locator('button:has-text("Suivant")').first();
await suivant().click(); await page.waitForTimeout(700);
await page.locator('button:has-text("Facture CEET/SBEE")').click();
await page.locator('.manual-consumption-grid input').nth(0).fill('330000');
await page.locator('.manual-consumption-grid input').nth(1).fill('114');
ok(await page.locator('.chip-selector button.active').innerText() === 'Équilibré jour / nuit', 'assistant : même réponse par défaut');
ok(await reponsesVisibles(page), 'assistant : les trois réponses visibles, à la ligne, sans défilement');
await suivant().click(); await page.waitForTimeout(900);
await suivant().click(); await page.waitForSelector('.kit-summary');
const resume = espaces(await page.locator('.kit-summary').first().innerText());
ok(/Kit 60 kWh/.test(resume) && /batterie 72 kWh \(étendue depuis 60\)/.test(resume), `assistant : le même kit, la même batterie [${resume.slice(0, 120)}…]`);
ok(new RegExp(`— ${panneauxSim} panneaux`).test(resume), `assistant : les mêmes panneaux (${panneauxSim})`);
const totalDevis = chiffres(await page.locator('.devis-summary-row.total span').last().innerText());
ok(totalDevis === prixFacture, `même total : devis ${totalDevis.toLocaleString('fr-FR')} F = Simulateur ${prixFacture.toLocaleString('fr-FR')} F`);
await page.close();

// ---- 4. TÉLÉPHONE ----
const mobile = await nav.newPage({ viewport: { width: 375, height: 800 } });
mobile.on('pageerror', (e) => jsErr.push(String(e)));
await mobile.goto(B + '/');
await mobile.evaluate((u) => { localStorage.setItem('bestasolar_user', JSON.stringify(u)); localStorage.setItem(`bestasolar_guide_accueil_v1:${u.id}`, 'termine'); }, GERANT);
await mobile.goto(B + '/plus/roi');
await mobile.waitForSelector('.roi-kit');
await mobile.locator('button:has-text("D’après sa facture")').click();
await mobile.locator('input[aria-label="Facture d’électricité"]').fill('330000');
await mobile.waitForTimeout(400);
const debord = await mobile.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
ok(debord <= 0, `téléphone : aucun défilement horizontal (${debord} px)`);
ok(await reponsesVisibles(mobile), 'téléphone : les trois réponses visibles, à la ligne');
await mobile.locator('.chip-selector', { hasText: 'Quand consomme-t-il le plus ?' }).screenshot({ path: `${CAPTURES}/simulateur-question-mobile.png` });
await mobile.locator('.roi-kit').screenshot({ path: `${CAPTURES}/simulateur-kit-mobile.png` });

// L'assistant de devis sur téléphone : les réponses à la ligne.
await mobile.goto(B + '/devis');
await mobile.waitForTimeout(1500);
await mobile.locator('button:has-text("Créer un devis"), button:has-text("Nouveau devis")').first().click();
await mobile.waitForTimeout(800);
await mobile.locator(':text("Dimensionnement solaire")').first().click();
await mobile.waitForTimeout(900);
await mobile.locator('.page-content button').nth(1).click();
await mobile.waitForTimeout(400);
await mobile.locator('button:has-text("Suivant")').first().click();
await mobile.waitForTimeout(700);
await mobile.locator('button:has-text("Facture CEET/SBEE")').click();
await mobile.waitForTimeout(300);
ok(await reponsesVisibles(mobile), 'téléphone, assistant : les trois réponses visibles, à la ligne');
const debordAssistant = await mobile.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
ok(debordAssistant <= 0, `téléphone, assistant : aucun défilement horizontal (${debordAssistant} px)`);
await mobile.screenshot({ path: `${CAPTURES}/assistant-question-mobile.png` });
await mobile.close();

// ---- 5. ABONNEMENT EXPIRÉ : pas de « Renouveler » devant le client ----
// Le Simulateur se montre au prospect : le rappel d'abonnement n'y figure
// pas. Il reste sur les autres écrans (tableau de bord, devis).
const expire = await nav.newPage({ viewport: { width: 375, height: 800 } });
expire.on('pageerror', (e) => jsErr.push(String(e)));
await expire.goto(B + '/');
await expire.evaluate((u) => { localStorage.setItem('bestasolar_user', JSON.stringify(u)); localStorage.setItem(`bestasolar_guide_accueil_v1:${u.id}`, 'termine'); }, GERANT);
await expire.goto(B + '/devis'); await expire.waitForTimeout(1200);
// L'état se prépare depuis une page statique : l'app, absente, ne peut pas
// réécrire le stockage en partant.
await expire.goto(B + '/privacy.html');
await expire.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('bestasolar_data'));
  s.subscriptions = [{ id: 'sub-expire', userId: 'u1', status: 'actif', formule: 'essentiel',
    dateDebut: new Date(Date.now() - 60 * 864e5).toISOString(), dateFin: new Date(Date.now() - 2 * 864e5).toISOString() }];
  localStorage.setItem('bestasolar_data', JSON.stringify(s));
  localStorage.setItem('bestasolar_mode_u1', 'public');
});
const bandeau = () => expire.locator('.abo-alert', { hasText: 'a expiré' });
await expire.goto(B + '/dashboard'); await expire.waitForTimeout(1500);
ok(await bandeau().count() === 1, 'abonnement expiré : le rappel « Renouveler » reste au tableau de bord');
await expire.goto(B + '/plus/roi'); await expire.waitForSelector('.roi-kit');
ok(await bandeau().count() === 0, 'Simulateur ROI : aucun rappel d’abonnement devant le client');
await expire.screenshot({ path: `${CAPTURES}/simulateur-sans-rappel.png` });
await expire.goto(B + '/devis'); await expire.waitForTimeout(1200);
ok(await bandeau().count() === 1, 'le rappel reste sur les autres écrans (Devis)');
await expire.close();

console.log('\n' + R.join('\n'));
console.log(jsErr.length ? `\n❌ erreurs JS : ${jsErr.join(' | ')}` : '\naucune erreur JS');
await nav.close();
const echecs = R.filter((r) => r.startsWith('❌')).length + jsErr.length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Simulateur et devis : le même kit, composé de la même façon');
process.exit(echecs ? 1 : 0);
