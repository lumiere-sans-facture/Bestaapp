/* Un seul onduleur tant qu'un modèle suffit : l'assistant ne met deux
   appareils en parallèle que lorsque AUCUN modèle configuré ne tient le
   besoin à lui seul. Cas relevé sur le kit 32 kWh — 19 panneaux de 620 Wc
   (11 780 Wc) : l'onduleur 6 kVA du kit n'accepte que 7 800 Wc, mais un seul
   12 kVA (15 000 Wc) suffit. */
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

// Le résumé du kit annonce l'onduleur retenu : « 12 kVA », sans « 2 × ».
const resume = (ecran.match(/onduleur [^\n]*/) || ['—'])[0];
ok(/onduleur 12 kVA/.test(resume) && !/2 ×/.test(resume),
   `un seul onduleur retenu, pas deux en parallèle [${resume}]`);

// Et la ligne du devis le confirme : un seul appareil facturé (la quantité
// n'est affichée qu'au-delà de 1 — « × 2 » signalerait deux boîtiers).
const equipements = ecran.slice(ecran.indexOf('ÉQUIPEMENTS'));
const ligne = (equipements.match(/Onduleur hybride[^\n]*/) || ['—'])[0];
ok(/12kVA/.test(ligne) && !/×/.test(ligne), `la ligne du devis porte un seul onduleur [${ligne}]`);

// Français : « retenu » au singulier quand il n'y en a qu'un.
ok(/Deye retenu à la place/.test(ecran) && !/retenus à la place/.test(ecran),
   'le message d’adaptation est au singulier');

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Onduleur : un seul appareil tant qu’un modèle suffit');
process.exit(echecs ? 1 : 0);
