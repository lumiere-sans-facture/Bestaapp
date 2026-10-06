/* Règle du gérant (octobre 2026) : l'onduleur du kit est GARDÉ tant qu'il
   prend les panneaux ; sinon il est mis en PARALLÈLE avec un second
   identique, et un modèle plus grand n'arrive qu'en dernier. Cas du kit
   32 kWh — 19 panneaux de 620 Wc (11 780 Wc) : le 6 kVA du kit n'accepte que
   7 800 Wc ; deux 6 kVA en parallèle (15 600 Wc) les prennent, le 12 kVA
   n'est donc PAS proposé. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const page = await nav.newPage({ viewport: { width: 1280, height: 950 } });
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));

const GERANT = { id: 'u1', email: 'boss@bestasolar.bj', name: 'Adam', role: 'gerant', phone: '+229', avatar: 'A' };
await page.goto('http://localhost:3000');
await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);

const suivant = () => page.locator('button:has-text("Suivant")').first();
const ajouter = async (etiquette, n = 1) => {
  const select = page.locator('select').first();
  const val = await select.evaluate((el, lbl) => {
    const o = [...el.options].find((x) => x.text.includes(lbl));
    return o ? o.value : '';
  }, etiquette);
  if (!val) throw new Error(`appareil introuvable dans la liste : ${etiquette}`);
  for (let i = 0; i < n; i++) {
    await select.selectOption(val);
    await page.waitForTimeout(250);
    await page.locator('.wizard-form button.btn-primary').first().click();
    await page.waitForTimeout(500);
  }
};

// ---- DIMENSIONNEMENT MENANT AU KIT 32 kWh ----
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
await ajouter('Climatiseur 3 CV', 2);
await ajouter('Réfrigérateur', 1);
await suivant().click(); await page.waitForTimeout(900);   // étape 3 : système
await suivant().click(); await page.waitForTimeout(1800);  // étape 4 : kit + devis

const ecran = await page.evaluate(() => document.querySelector('.page-content')?.innerText || '');
ok(/Kit 32 kWh/.test(ecran), 'le kit 32 kWh est suggéré pour ce besoin');

// Le résumé du kit annonce l'onduleur retenu : deux 6 kVA du kit.
const resume = (ecran.match(/onduleur [^\n]*/) || ['—'])[0];
ok(/2 × 6 kVA/.test(resume) && !/12 kVA/.test(resume),
   `l’onduleur du kit doublé, pas un 12 kVA [${resume}]`);

// La ligne du devis : le 6 kVA du kit, en deux exemplaires.
const equipements = ecran.slice(ecran.indexOf('ÉQUIPEMENTS'));
const ligne = (equipements.match(/Onduleur hybride[^\n]*/) || ['—'])[0];
ok(/6kVA/.test(ligne) && /× 2/.test(ligne), `la ligne du devis porte deux 6 kVA [${ligne}]`);
ok(!/12kVA/.test(equipements), 'aucun 12 kVA dans le devis');

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Onduleur : celui du kit, doublé avant tout modèle plus grand');
process.exit(echecs ? 1 : 0);
