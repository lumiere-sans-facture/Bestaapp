/* Simulateur ROI → Devis : la proposition de kit est la même des deux côtés.
   On règle panneaux et modules batterie au Simulateur (+/−, recalcul en
   direct, limites), on crée le devis depuis la proposition, et l'assistant de
   devis affiche — puis enregistre — exactement la même composition et le même
   total. Le réglage « Modules batterie max » de Mes kits borne le bouton « + ».
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
const resume = async (p, libelle) => (await p.locator('.reglage-kit-resume div', { has: p.locator(`span:text-is("${libelle}")`) }).locator('strong').innerText()).trim();
const valeur = (p, i) => p.locator('.reglage-kit-ligne .qty-value').nth(i).innerText();
const bouton = (p, nom) => p.locator(`button[aria-label="${nom}"]`);
const etat = () => page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')));

// ---- 1. SIMULATEUR : la proposition, chiffrée comme au devis ----
await page.goto(B + '/plus/roi');
await page.waitForSelector('.reglage-kit', { timeout: 15000 });
await page.selectOption('#roi-pays', 'tg');
await page.waitForTimeout(300);
const kitSim = await page.locator('.roi-kit-nom').innerText();
const prixAuto = chiffres(await resume(page, 'Prix'));
ok(/10 kWh/.test(kitSim), `le Simulateur propose le kit de l’assistant [${kitSim}]`);
ok(prixAuto === 1851000, `même prix que le devis pour le même besoin au Togo : main-d’œuvre doublée [${prixAuto.toLocaleString('fr-FR')} F]`);
const panneauxAuto = Number(await valeur(page, 0));
ok(await valeur(page, 1) === '1', 'un module batterie au départ (celui du kit)');

// ---- 2. FACTURE, ET SOUS LE BESOIN : permis, avec alerte ----
// Au Bénin (SBEE, 115 F le kWh), comme le test unitaire de la même facture.
await page.selectOption('#roi-pays', 'bj');
await page.locator('button:has-text("D’après sa facture")').click();
await page.locator('input[aria-label="Facture d’électricité"]').fill('250000');
await page.waitForTimeout(300);
ok(await page.locator('.chip-selector', { hasText: 'Quand consomme-t-il le plus ?' }).count() === 1, 'facture : la même question jour/nuit que l’assistant de devis');
const kitFacture = await page.locator('.roi-kit-nom').innerText();
ok(/48 kWh/.test(kitFacture), `facture 250 000 F à 115 F le kWh : Kit 48 kWh, comme au devis [${kitFacture}]`);
await bouton(page, 'Retirer un module batterie').click();
const alerte = await page.locator('.reglage-kit-alerte').allInnerTexts();
ok(alerte.some((t) => /Autonomie insuffisante/.test(t)), 'sous le besoin : alerte « autonomie insuffisante »');
ok(await page.locator('button:has-text("Créer le devis avec cette proposition")').isEnabled(), 'le devis reste possible');
await page.locator('button:has-text("Revenir à la proposition automatique")').click();
ok(await page.locator('.reglage-kit-alerte').count() === 0, '« Revenir à la proposition automatique » efface le réglage');
await page.locator('button:has-text("D’après ses appareils")').click();
await page.selectOption('#roi-pays', 'tg');
await page.waitForTimeout(300);
ok(chiffres(await resume(page, 'Prix')) === prixAuto, 'retour aux appareils au Togo : la proposition automatique de départ');

// ---- 3. +/− : recalcul en direct, dans les limites ----
await bouton(page, 'Ajouter un module batterie').click();
ok(await valeur(page, 1) === '2', '« + » ajoute un module');
ok(/20 kWh/.test(await resume(page, 'Capacité')), `la capacité suit [${await resume(page, 'Capacité')}]`);
const prix2 = chiffres(await resume(page, 'Prix'));
ok(prix2 > prixAuto, `le prix suit [${prix2.toLocaleString('fr-FR')} F]`);
ok(/nuit/.test(await resume(page, 'Autonomie')), `l’autonomie est recalculée [${await resume(page, 'Autonomie')}]`);
await bouton(page, 'Ajouter un module batterie').click();
await bouton(page, 'Ajouter un module batterie').click();
ok(await valeur(page, 1) === '4' && await bouton(page, 'Ajouter un module batterie').isDisabled(),
  '4 modules au plus par défaut : « + » se désactive');
ok(/Maximum : 4 modules/.test(await page.locator('.reglage-kit-limite').first().innerText()), 'la limite est expliquée (réglable dans Mes kits)');
await bouton(page, 'Retirer un module batterie').click();
await bouton(page, 'Retirer un module batterie').click();
await bouton(page, 'Retirer un module batterie').click();
ok(await valeur(page, 1) === '1' && await bouton(page, 'Retirer un module batterie').isDisabled(), 'pas moins d’un module');
await bouton(page, 'Ajouter un module batterie').click();
await bouton(page, 'Ajouter un panneau').click();
ok(Number(await valeur(page, 0)) === panneauxAuto + 1, `« + » ajoute un panneau [${panneauxAuto} → ${await valeur(page, 0)}]`);
ok(/kWc/.test(await resume(page, 'Puissance')), `la puissance suit [${await resume(page, 'Puissance')}]`);
ok(await page.locator('button:has-text("Revenir à la proposition automatique")').count() === 1, 'retour à la proposition automatique proposé');
const prixSim = chiffres(await resume(page, 'Prix'));
const panneauxSim = await valeur(page, 0);
const investSim = chiffres(await page.locator('.roi-ligne.is-forte .roi-ligne-montant').first().innerText());
ok(investSim === prixSim, `la rentabilité se calcule sur le prix réglé [${investSim.toLocaleString('fr-FR')} F]`);
await page.screenshot({ path: `${CAPTURES}/simulateur-reglage.png`, fullPage: true });

// ---- 4. CRÉER LE DEVIS DEPUIS LA PROPOSITION ----
await page.locator('button:has-text("Créer le devis avec cette proposition")').click();
await page.waitForURL(/\/devis/);
await page.waitForSelector('.devis-client-note');
ok(/Simulateur ROI/.test(await page.locator('.devis-client-note').innerText()), 'l’assistant annonce la proposition reprise du Simulateur');
await page.locator('.lead-option, .page-content .lead-picker button, .page-content button').filter({ hasNotText: /Annuler|Précédent|Suivant/ }).first().click();
await page.waitForTimeout(300);
const suivant = () => page.locator('button:has-text("Suivant")').first();
await suivant().click(); await page.waitForTimeout(500);
ok(await page.locator('.appliance-row').count() === 4, 'les appareils du Simulateur sont repris');
await suivant().click(); await page.waitForTimeout(500);
await suivant().click(); await page.waitForSelector('.reglage-kit');
ok((await page.locator('.kit-option.selected .kit-option-name').innerText()).includes(kitSim), 'même kit');
ok(await valeur(page, 1) === '2', 'mêmes modules batterie (2)');
ok(await valeur(page, 0) === panneauxSim, `mêmes panneaux (${panneauxSim})`);
const totalDevis = chiffres(await page.locator('.devis-summary-row.total span').last().innerText());
ok(totalDevis === prixSim, `même total au devis : ${totalDevis.toLocaleString('fr-FR')} F = ${prixSim.toLocaleString('fr-FR')} F`);
await page.screenshot({ path: `${CAPTURES}/devis-depuis-simulateur.png`, fullPage: true });
await page.locator('button:has-text("Créer le devis")').last().click();
await page.waitForTimeout(1200);
const enregistre = (await etat()).devis.find((d) => d.type === 'solar');
ok(enregistre?.total === prixSim, `le devis enregistré porte ce total [${enregistre?.total}]`);
ok(enregistre?.dimensionnement?.reglages?.modules === 2 && enregistre?.dimensionnement?.kitId, 'l’étude enregistrée garde le kit et les réglages');

// ---- 5. ROUVRIR : même composition ----
await page.locator('.flat-row').first().click();
await page.locator('.sheet button:has-text("Revoir le dimensionnement")').first().click();
await page.waitForTimeout(800);
await suivant().click(); await page.waitForTimeout(400);
await suivant().click(); await page.waitForSelector('.reglage-kit');
ok(await valeur(page, 1) === '2' && chiffres(await page.locator('.devis-summary-row.total span').last().innerText()) === prixSim,
  'rouvert, le devis retrouve ses 2 modules et son total');

// ---- 6. MES KITS : « Modules batterie max » borne le « + » ----
await page.goto(B + '/plus/kits');
await page.waitForTimeout(800);
const carte48 = page.locator('.card', { hasText: 'Kit 48 kWh' }).first();
await carte48.locator('button:has-text("Modifier")').click();
const champ = page.locator('input[aria-label="Modules batterie max"]');
ok(await champ.getAttribute('placeholder') === '4', 'champ « Modules batterie max », 4 par défaut');
await champ.fill('6');
await page.locator('.sheet button[type="submit"]').click();
await page.waitForTimeout(600);
ok((await etat()).kits.find((k) => k.id === 'kit-48kwh')?.modulesMax === 6, 'la limite est enregistrée sur le kit');
await page.goto(B + '/plus/roi');
await page.waitForSelector('.reglage-kit');
await page.locator('button:has-text("D’après sa facture")').click();
await page.locator('input[aria-label="Facture d’électricité"]').fill('250000');
await page.waitForTimeout(300);
for (let i = 0; i < 5; i += 1) if (await bouton(page, 'Ajouter un module batterie').isEnabled()) await bouton(page, 'Ajouter un module batterie').click();
ok(await valeur(page, 1) === '6', `Kit 48 kWh : jusqu’à 6 modules une fois réglé [${await valeur(page, 1)}]`);
await page.close();

// ---- 7. TÉLÉPHONE ----
const mobile = await nav.newPage({ viewport: { width: 375, height: 800 } });
mobile.on('pageerror', (e) => jsErr.push(String(e)));
await mobile.goto(B + '/');
await mobile.evaluate((u) => { localStorage.setItem('bestasolar_user', JSON.stringify(u)); localStorage.setItem(`bestasolar_guide_accueil_v1:${u.id}`, 'termine'); }, GERANT);
await mobile.goto(B + '/plus/roi');
await mobile.waitForSelector('.reglage-kit');
await bouton(mobile, 'Ajouter un module batterie').click();
const debord = await mobile.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
ok(debord <= 0, `téléphone : aucun défilement horizontal (${debord} px)`);
await mobile.locator('.reglage-kit').screenshot({ path: `${CAPTURES}/simulateur-reglage-mobile.png` });
await mobile.close();

console.log('\n' + R.join('\n'));
console.log(jsErr.length ? `\n❌ erreurs JS : ${jsErr.join(' | ')}` : '\naucune erreur JS');
await nav.close();
const echecs = R.filter((r) => r.startsWith('❌')).length + jsErr.length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Simulateur et devis : même proposition');
process.exit(echecs ? 1 : 0);
