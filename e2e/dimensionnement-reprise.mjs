/* L'étude solaire est gardée avec le devis : on peut y revenir, revoir les
   appareils saisis, les corriger, et le devis est MIS À JOUR — pas dupliqué. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const page = await nav.newPage({ viewport: { width: 1280, height: 950 } });
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));

const GERANT = { id: 'u1', email: 'boss@bestasolar.bj', name: 'Adam', role: 'gerant', phone: '+229', avatar: 'A' };
await page.goto('http://localhost:3000');
await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);

const etat = () => page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')));
const suivant = () => page.locator('button:has-text("Suivant")').first();

// ---- 1. CRÉER UN DEVIS SOLAIRE AVEC DEUX APPAREILS ----
await page.goto('http://localhost:3000/devis');
await page.waitForTimeout(1800);
await page.locator('button:has-text("Créer un devis"), button:has-text("Nouveau devis")').first().click();
await page.waitForTimeout(900);
await page.locator(':text("Dimensionnement solaire")').first().click();
await page.waitForTimeout(1000);
await page.locator('.page-content button').nth(1).click();          // premier client
await page.waitForTimeout(400);
await suivant().click();
await page.waitForTimeout(900);

// Deux appareils via le sélecteur.
// Le sélecteur ne fait que désigner l'appareil : c'est le bouton d'à côté qui
// ajoute la ligne.
const ajouter = async (etiquette) => {
  const select = page.locator('select').first();
  const val = await select.evaluate((el, lbl) => {
    const o = [...el.options].find((x) => x.text.includes(lbl));
    return o ? o.value : '';
  }, etiquette);
  if (!val) throw new Error(`appareil introuvable dans la liste : ${etiquette}`);
  await select.selectOption(val);
  await page.waitForTimeout(300);
  await page.locator('.wizard-form button.btn-primary').first().click();
  await page.waitForTimeout(600);
};
await ajouter('Climatiseur 3 CV');
await ajouter('Téléviseur 32"');
const lignes = await page.locator('.appliance-row').count();
ok(lignes >= 2, `deux appareils saisis [${lignes} lignes]`);

await suivant().click(); await page.waitForTimeout(900);   // étape 3 : système
await suivant().click(); await page.waitForTimeout(1600);  // étape 4 : kit + devis
await page.locator('button:has-text("Finaliser"), button:has-text("Enregistrer"), button:has-text("Créer le devis")').first().click();
await page.waitForTimeout(2000);

const apresCreation = await etat();
const devis = apresCreation.devis.find((d) => d.type === 'solar');
ok(!!devis, 'le devis solaire est enregistré');
ok(!!devis?.dimensionnement, 'l’étude est rangée AVEC le devis');
ok(devis?.dimensionnement?.appareils?.length === 2, `les appareils saisis sont conservés [${devis?.dimensionnement?.appareils?.length}]`);
ok(devis?.dimensionnement?.appareils?.[0]?.power > 0, 'chaque appareil garde sa puissance et ses heures');
const totalAvant = devis.total;
const nbDevisAvant = apresCreation.devis.length;

// ---- 2. ROUVRIR L'ÉTUDE ----
await page.goto('http://localhost:3000/devis');
await page.waitForTimeout(1500);
await page.locator('.flat-row').first().click();
await page.waitForTimeout(800);
const panneau = await page.evaluate(() => document.querySelector('.sheet')?.innerText || '');
ok(/Dimensionnement/.test(panneau), 'le panneau résume l’étude');
ok(/2 appareils/.test(panneau), `le résumé compte les appareils [${(panneau.match(/Dimensionnement\n?([^\n]*)/) || [])[1] || '—'}]`);
ok(/Revoir le dimensionnement/.test(panneau), '« Revoir le dimensionnement » est proposé');
await page.locator('.sheet button:has-text("Revoir le dimensionnement")').first().click();
await page.waitForTimeout(1800);

const titre = await page.locator('.page-title').first().innerText();
ok(/Modifier le dimensionnement/.test(titre), `l’écran annonce une modification, pas une création [${titre}]`);
const ecran = await page.evaluate(() => document.querySelector('.page-content')?.innerText || '');
ok(/Climatiseur 3 CV/.test(ecran), 'les appareils saisis sont bien de retour à l’écran');

// ---- 3. MODIFIER, PUIS ENREGISTRER ----
await ajouter('Réfrigérateur');
const lignes2 = await page.locator('.appliance-row').count();
ok(lignes2 > lignes, `un appareil peut être ajouté à l’étude rouverte [${lignes} → ${lignes2}]`);
await suivant().click(); await page.waitForTimeout(900);
await suivant().click(); await page.waitForTimeout(1600);
await page.locator('button:has-text("Finaliser"), button:has-text("Enregistrer"), button:has-text("Créer le devis")').first().click();
await page.waitForTimeout(2000);

const apres = await etat();
ok(apres.devis.length === nbDevisAvant, `le devis est mis à jour, pas dupliqué [${nbDevisAvant} → ${apres.devis.length}]`);
const majDevis = apres.devis.find((d) => d.id === devis.id);
ok(!!majDevis, 'le devis garde son identifiant');
ok(majDevis?.devisNumber === devis.devisNumber, `le numéro ne change pas [${majDevis?.devisNumber}]`);
ok(majDevis?.dimensionnement?.appareils?.length === 3, `l’étude enregistrée compte le nouvel appareil [${majDevis?.dimensionnement?.appareils?.length}]`);
// Le TOTAL peut ne pas bouger : un petit appareil de plus tient souvent dans
// le même kit du catalogue. Ce qui doit bouger, c'est le besoin calculé.
const consoAvant = devis.consumption.day + devis.consumption.night;
const consoApres = majDevis.consumption.day + majDevis.consumption.night;
ok(consoApres > consoAvant, `le besoin recalculé tient compte du nouvel appareil [${consoAvant.toFixed(2)} → ${consoApres.toFixed(2)} kWh/j]`);
// Le total peut rester identique sans que ce soit une anomalie : les kits ont
// des paliers, et celui déjà retenu couvre souvent le besoin augmenté. Ce qui
// se vérifie ici, c'est que le devis reste chiffré et cohérent.
ok(Number.isFinite(majDevis?.total) && majDevis.total > 0
   && majDevis.quotation?.total === majDevis.total,
   `le devis reste chiffré, total et chiffrage d'accord [${totalAvant} → ${majDevis?.total}]`);

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Dimensionnement : étude conservée, rouverte, modifiée sans dupliquer le devis');
process.exit(echecs ? 1 : 0);
