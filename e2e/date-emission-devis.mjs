/* Date d'émission d'un devis : modifiable dans l'éditeur, imprimée sur le
   document, reprise dans la liste — sans toucher au numéro ni à la date de
   création (activité du tableau de bord). */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };
await page.goto(B + '/');
await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
const etat = () => page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')));
const suivant = () => page.locator('button:has-text("Suivant")').first();

// ---- 1. UN DEVIS SOLAIRE (parcours réel) ----
await page.goto(B + '/devis');
await page.waitForTimeout(1800);
await page.locator('button:has-text("Créer un devis"), button:has-text("Nouveau devis")').first().click();
await page.waitForTimeout(900);
await page.locator(':text("Dimensionnement solaire")').first().click();
await page.waitForTimeout(1000);
await page.locator('.page-content button').nth(1).click();
await page.waitForTimeout(400);
await suivant().click(); await page.waitForTimeout(900);
const select = page.locator('select').first();
const val = await select.evaluate((el) => [...el.options].find((x) => x.text.includes('Téléviseur'))?.value || '');
await select.selectOption(val); await page.waitForTimeout(300);
await page.locator('.wizard-form button.btn-primary').first().click(); await page.waitForTimeout(500);
await suivant().click(); await page.waitForTimeout(900);
await suivant().click(); await page.waitForTimeout(1600);
await page.locator('button:has-text("Finaliser"), button:has-text("Enregistrer"), button:has-text("Créer le devis")').first().click();
await page.waitForTimeout(2000);
const avant = (await etat()).devis.find((d) => d.type === 'solar');
ok(!!avant, `devis créé [${avant?.devisNumber}]`);

// ---- 2. OUVRIR L'ÉDITEUR ET CHANGER LA DATE ----
await page.goto(B + '/devis');
await page.waitForTimeout(1500);
await page.locator('.flat-row').first().click();
await page.waitForTimeout(700);
const boutons = await page.evaluate(() => [...document.querySelectorAll('.sheet button')].map((b) => b.innerText.trim()).filter(Boolean));
ok(boutons.includes('Éditer'), 'le devis s’ouvre avec le bouton « Éditer »');
await page.locator('.sheet button', { hasText: 'Éditer' }).first().click();
await page.waitForSelector('.quote-date-card', { timeout: 10000 });
await page.waitForTimeout(600);
const entete = await page.locator('.quote-date-card > button').innerText();
ok(/Date d'émission/.test(entete), `l’éditeur affiche la date d’émission [${entete.replace(/\s+/g, ' ').replace('›', '').trim()}]`);

await page.locator('.quote-date-card > button').click();
await page.waitForTimeout(300);
const champ = page.locator('.quote-date-card input[type="date"]');
// Futur refusé.
const demain = new Date(Date.now() + 86400000);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
await champ.fill(iso(demain));
await page.locator('.quote-date-card button:has-text("Enregistrer la date")').click();
await page.waitForTimeout(400);
ok(/futur/.test(await page.locator('.quote-date-card .field-error').innerText().catch(() => '')), 'une date dans le futur est refusée');

// Antidatée de 10 jours.
const cible = new Date(Date.now() - 10 * 86400000);
await champ.fill(iso(cible));
await page.locator('.quote-date-card button:has-text("Enregistrer la date")').click();
await page.waitForTimeout(900);
const apres = (await etat()).devis.find((d) => d.id === avant.id);
const jourEmis = apres?.dateEmission ? iso(new Date(apres.dateEmission)) : null;
ok(jourEmis === iso(cible), `date d’émission enregistrée [${jourEmis}]`);
ok(apres.createdAt === avant.createdAt && apres.devisNumber === avant.devisNumber, 'numéro et date de création inchangés');
const nouvelEntete = await page.locator('.quote-date-card > button').innerText();
const attendu = cible.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
ok(nouvelEntete.includes(attendu), `l’en-tête affiche la nouvelle date [${nouvelEntete.replace(/\s+/g, ' ').replace('›', '').trim()}]`);
await page.locator('.quote-editor-sheet').screenshot({ path: '/tmp/claude-0/date-emission.png' }).catch(() => {});

// ---- 3. LISTE ET DOCUMENT ----
await page.keyboard.press('Escape');
await page.goto(B + '/devis');
await page.waitForTimeout(1500);
const ligne = await page.locator('.flat-row').first().innerText();
const affiche = await page.evaluate(async (d) => {
  const { formatDate } = await import('/src/utils/format.js');
  return formatDate(d);
}, apres.dateEmission);
ok(ligne.includes(affiche), `la liste des devis montre la date d’émission [${affiche}]`);
const doc = await page.evaluate(async (d) => {
  const { donneesDeDevis } = await import('/src/utils/docTemplates/shared.js');
  return donneesDeDevis({ devis: d, company: {}, lead: null, products: [] });
}, apres);
ok(iso(new Date(doc.date)) === iso(cible), 'le document imprimé porte la date d’émission');
ok(Math.round((new Date(doc.dateSecondaire) - new Date(doc.date)) / 86400000) === 30, 'sa validité (30 j) part de cette date');

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Date d’émission du devis : modifiable, imprimée, reprise dans la liste');
process.exit(echecs ? 1 : 0);
