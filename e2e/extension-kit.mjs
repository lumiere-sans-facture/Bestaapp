/* Extension d'un kit : un besoin qui exige plus de panneaux que le kit en
   compte → section « Ajustements du kit » (chaînes, onduleur, matériel,
   main-d'œuvre, impact prix), devis créé, annexe sur le document imprimé.
   Puis les caractéristiques électriques dans « Plus › Onduleurs ».
   Lancer `npm run dev` à côté. */
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
const suivant = () => page.locator('button:has-text("Suivant")').first();

// ---- 1. ASSISTANT : beaucoup d'énergie de jour, peu la nuit ----
await page.goto(B + '/devis');
await page.waitForTimeout(1500);
await page.locator('button:has-text("Créer un devis"), button:has-text("Nouveau devis")').first().click();
await page.waitForTimeout(800);
await page.locator(':text("Dimensionnement solaire")').first().click();
await page.waitForTimeout(900);
await page.locator('.page-content button').nth(1).click();
await page.waitForTimeout(400);
await suivant().click(); await page.waitForTimeout(700);
await page.locator('button:has-text("Saisie directe")').click();
await page.locator('.manual-consumption-grid input').nth(0).fill('30');
await page.locator('.manual-consumption-grid input').nth(1).fill('3');
await suivant().click(); await page.waitForTimeout(900);
await suivant().click(); await page.waitForTimeout(1500);
await page.locator('.kit-option', { hasText: 'Deye' }).first().click();
await page.waitForTimeout(800);

const section = page.locator('.ajustements-kit');
ok(await section.count() === 1, 'la section « Ajustements du kit » s’affiche pour un kit étendu');
const texte = (await section.innerText().catch(() => '')).replace(/\s+/g, ' ');
const raison = /Onduleur remplacé(.*?)Matériel/i.exec(texte)?.[1]?.slice(0, 160);
ok(/Kit de base — Kit 5 kWh — Deye 4 panneaux/.test(texte), `kit de base : 4 panneaux [${texte.slice(0, 90)}…]`);
const final = Number(/Proposition \((\d+) demandés, \+(\d+) ajoutés\)/.exec(texte)?.[1] || 0);
ok(final > 4, `panneaux demandés et ajoutés affichés [${final} demandés]`);
ok(/Chaînes solaires 1 chaîne de 4 panneaux → \d+ chaînes? de \d+ panneaux/.test(texte), `chaînes calculées [${/Chaînes solaires (.*?) Onduleur/.exec(texte)?.[1]}]`);
ok(/Onduleur remplacé/.test(texte) && /Deye Onduleur hybride 12kVA/.test(texte) && /Raison :/.test(texte),
   `onduleur remplacé, raison donnée [${raison}]`);
ok(/Matériel ajouté/i.test(texte) && /Disjoncteur AC 25 A tétrapolaire/.test(texte), 'câbles, protections et disjoncteur AC du nouvel onduleur ajoutés');
// Batterie du kit inchangée (5 kWh) : le supplément batterie n'apparaît pas.
ok(/Supplément panneaux \(\d+ × 10 000 F\)/.test(texte.replace(/ /g, ' ')) && !/Supplément batterie|kWc ×/.test(texte),
   'main-d’œuvre justifiée : base et panneaux ; aucun supplément batterie sans module ajouté');
ok(/Kit de base [\d  ]+ F → proposition/.test(texte), 'impact sur le prix total');
const creer = page.locator('button:has-text("Créer le devis")');
ok(!(await creer.isDisabled()), 'configuration sûre : le devis peut être créé');
await section.screenshot({ path: '/tmp/claude-0/ajustements-kit.png' });

// ---- 2. DEVIS CRÉÉ, ANNEXE IMPRIMÉE ----
await creer.click();
await page.waitForTimeout(2000);
const d = await page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')).devis.find((x) => x.type === 'solar'));
ok(d?.quotation?.ajustements?.actif === true, 'les ajustements sont enregistrés avec le devis');
// Suppléments fondus dans LA ligne « Main d'œuvre » : une seule ligne, au montant final.
const prest = d?.quotation?.prestations || [];
ok(prest.length === 1 && prest[0].totalPrice === d.quotation.ajustements.mainOeuvre.totalFinal && !prest.some((p) => /supplément/.test(p.name)),
   `une seule ligne de main-d’œuvre au devis, suppléments inclus [${prest.map((p) => `${p.name} ${p.totalPrice}`).join(' · ')}]`);
await page.goto(B + '/devis'); await page.waitForTimeout(1500);
await page.locator('.flat-row').first().click(); await page.waitForTimeout(700);
const [doc] = await Promise.all([ctx.waitForEvent('page'), page.locator('.sheet button', { hasText: 'Devis imprimable' }).click()]);
await doc.waitForLoadState(); await doc.waitForTimeout(800);
const annexe = await doc.evaluate(() => document.querySelector('.page.annexe')?.innerText || '');
ok(/Ajustements du kit/.test(annexe) && /Main-d’œuvre finale/.test(annexe), 'annexe « Ajustements du kit » sur le document');
const deborde = await doc.evaluate(() => [...document.querySelectorAll('.page')].some((p) => p.scrollHeight > p.clientHeight + 1));
ok(!deborde, 'aucune page du document ne déborde');
await doc.locator('.page.annexe').screenshot({ path: '/tmp/claude-0/annexe-ajustements.png' });

// ---- 3. PLUS › ONDULEURS : entrée PV saisissable ----
await page.goto(B + '/plus/inverters'); await page.waitForTimeout(1200);
const liste = (await page.locator('.page-content').innerText()).replace(/\s+/g, ' ');
ok(/2 MPPT · 500 V DC max/.test(liste), 'la liste montre l’entrée PV du Deye 6 kVA');
await page.locator('.kit-card', { hasText: 'Deye Onduleur hybride 6kVA' }).locator('button:has-text("Modifier")').click();
await page.waitForTimeout(500);
const champ = page.locator('.sheet').getByLabel('Tension DC max (V)');
ok(await champ.inputValue().catch(() => '') === '500', 'le formulaire montre la tension DC max (500 V)');

// ---- 4. ESPACE PRO : même section, ajustements gardés avec le devis ----
// L'état se prépare depuis une page statique : l'app, absente, ne peut pas
// réécrire le stockage en partant.
await page.goto(B + '/privacy.html');
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('bestasolar_data'));
  s.subscriptions = [{ id: 'sub-e2e', userId: 'u1', status: 'actif', formule: 'essentiel', dateDebut: new Date().toISOString(), dateFin: new Date(Date.now() + 30 * 864e5).toISOString() }];
  localStorage.setItem('bestasolar_data', JSON.stringify(s));
  localStorage.setItem('bestasolar_mode_u1', 'pro');
});
await page.goto(B + '/pro/documents'); await page.waitForTimeout(1800);
await page.locator('button:has-text("Nouveau devis")').first().click(); await page.waitForTimeout(600);
await page.locator('.devis-mode-card.featured').click(); await page.waitForTimeout(800);
await page.getByLabel('Nom complet *').fill('Client Essai Pro');
const etapeSuivante = () => page.locator('.wizard-actions .btn-primary').first();
await etapeSuivante().click(); await page.waitForTimeout(600);
await page.locator('button:has-text("Saisie directe")').click();
await page.locator('.manual-consumption-grid input').nth(0).fill('30');
await page.locator('.manual-consumption-grid input').nth(1).fill('3');
await etapeSuivante().click(); await page.waitForTimeout(800);
await etapeSuivante().click(); await page.waitForTimeout(1500);
await page.locator('.kit-option', { hasText: 'Deye' }).first().click(); await page.waitForTimeout(800);
const pro = (await page.locator('.ajustements-kit').innerText().catch(() => '')).replace(/\s+/g, ' ');
ok(/Onduleur remplacé/.test(pro) && /Main-d’œuvre finale/.test(pro), 'espace Pro : section « Ajustements du kit » identique');
await page.locator('button:has-text("Créer le devis")').click(); await page.waitForTimeout(1500);
const dPro = await page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')).devis.find((x) => x.pro));
const moPro = (dPro?.lignes || []).filter((l) => /main d.œuvre/i.test(l.designation));
ok(dPro?.ajustements?.actif === true && moPro.length === 1 && moPro[0].qty * moPro[0].pu === dPro.ajustements.mainOeuvre.totalFinal
   && !dPro.lignes.some((l) => /supplément/.test(l.designation)),
   `devis Pro : ajustements enregistrés, une seule ligne de main-d’œuvre [${moPro.map((l) => l.qty * l.pu).join(' · ')}]`);

// ---- 5. CONFIGURATION IMPOSSIBLE : alerte, devis bloqué ----
// Sans le 12 kVA, et le 6 kVA non couplable, rien n'accepte 15 panneaux.
await page.goto(B + '/privacy.html');
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('bestasolar_data'));
  s.inverters = s.inverters.filter((o) => o.id !== 'deye-12kva').map((o) => (o.id === 'deye-6kva' ? { ...o, parallele: false, maxParallele: 1 } : o));
  localStorage.setItem('bestasolar_data', JSON.stringify(s));
  localStorage.setItem('bestasolar_mode_u1', 'public');
});
await page.goto(B + '/devis'); await page.waitForTimeout(1500);
await page.locator('button:has-text("Créer un devis"), button:has-text("Nouveau devis")').first().click();
await page.waitForTimeout(800);
await page.locator(':text("Dimensionnement solaire")').first().click();
await page.waitForTimeout(900);
await page.locator('.page-content button').nth(1).click();
await page.waitForTimeout(400);
await suivant().click(); await page.waitForTimeout(700);
await page.locator('button:has-text("Saisie directe")').click();
await page.locator('.manual-consumption-grid input').nth(0).fill('30');
await page.locator('.manual-consumption-grid input').nth(1).fill('3');
await suivant().click(); await page.waitForTimeout(900);
await suivant().click(); await page.waitForTimeout(1500);
await page.locator('.kit-option', { hasText: 'Deye' }).first().click(); await page.waitForTimeout(800);
const alerte = await page.locator('[role="alert"]', { hasText: 'Configuration impossible' }).count();
ok(alerte === 1, 'configuration impossible : alerte affichée');
ok(await page.locator('button:has-text("Créer le devis")').isDisabled(), 'configuration impossible : « Créer le devis » bloqué');
ok(/aucun ne convient/i.test(await page.locator('.ajustements-kit').innerText()), 'la section le dit : aucun onduleur ne convient');

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Extension de kit : ajustements explicites, vérifiés et imprimés');
process.exit(echecs ? 1 : 0);
