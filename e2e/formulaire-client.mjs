/* Le formulaire client demande les informations du PARTICULIER quand ce
   type est choisi, et de l'ENTREPRISE quand cet autre type est choisi —
   plus jamais les deux à la fois pour un même profil. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const jsErr = [];

const GERANT = { id: 'u1', email: 'adam@bestasolar.bj', name: 'Adam', role: 'gerant', phone: '+229', avatar: 'A' };

const page = await nav.newPage({ viewport: { width: 500, height: 950 } });
page.on('pageerror', (e) => jsErr.push(String(e)));
await page.goto('http://localhost:3000');
await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);

const lire = () => page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')));

// ============ ÉCRAN CLIENTS ============
await page.goto('http://localhost:3000/clients');
await page.waitForSelector('.page', { timeout: 15000 });
await page.waitForTimeout(700);
await page.locator('button:has-text("Nouveau client")').click();
await page.waitForTimeout(500);

// ---- PARTICULIER par défaut : un seul champ, pas de « personne de contact » ----
ok(await page.locator('.client-type-btn.active:has-text("Particulier")').count() === 1,
   'clients : Particulier est le type par défaut');
ok(await page.locator('.sheet label:has-text("Nom complet")').count() === 1,
   'clients : le champ « Nom complet » est proposé pour un particulier');
ok(await page.locator('.sheet label:has-text("Personne de contact")').count() === 0,
   'clients : PAS de « Personne de contact » pour un particulier — il est son propre contact');
ok(await page.locator('.sheet label:has-text("Nom de l\'entreprise")').count() === 0,
   'clients : PAS de « Nom de l\'entreprise » pour un particulier');

// ---- Bascule sur ENTREPRISE : deux champs distincts ----
await page.locator('.client-type-btn:has-text("Entreprise")').click();
await page.waitForTimeout(300);
ok(await page.locator('.sheet label:has-text("Nom de l\'entreprise")').count() === 1,
   'clients : le champ « Nom de l\'entreprise » apparaît pour une entreprise');
ok(await page.locator('.sheet label:has-text("Personne de contact")').count() === 1,
   'clients : le champ « Personne de contact » apparaît pour une entreprise');
ok(await page.locator('.sheet label:has-text("Nom complet")').count() === 0,
   'clients : plus de « Nom complet » une fois sur Entreprise');

await page.locator('.sheet input[placeholder="Ex : Hôtel du Parc"]').fill('Hôtel Central');
await page.locator('.sheet input[placeholder="Ex : M. Kossi Agboka"]').fill('Mme Adjovi');
await page.locator('.sheet button[type="submit"]').click();
await page.waitForTimeout(900);
let etat = await lire();
let ent = etat.leads.find((l) => l.name === 'Hôtel Central');
ok(!!ent, 'clients : le client entreprise est bien créé');
ok(ent?.contact === 'Mme Adjovi', `clients : son contact est celui saisi [${ent?.contact}]`);
ok(ent?.clientType === 'entreprise', 'clients : son type est enregistré');

// ---- Nouveau, en PARTICULIER cette fois : le nom sert aussi de contact ----
await page.locator('button:has-text("Nouveau client")').click();
await page.waitForTimeout(500);
ok(await page.locator('.client-type-btn.active:has-text("Particulier")').count() === 1,
   'clients : chaque nouvelle fiche repart sur Particulier par défaut');
await page.locator('.sheet input[placeholder="Ex : Kossi Agboka"]').fill('Fatou Aina');
await page.locator('.sheet button[type="submit"]').click();
await page.waitForTimeout(900);
etat = await lire();
const part = etat.leads.find((l) => l.name === 'Fatou Aina');
ok(!!part, 'clients : le client particulier est bien créé');
ok(part?.contact === 'Fatou Aina', `clients : son contact reprend automatiquement son nom [${part?.contact}]`);

// ---- Fiche du particulier : pas de ligne « Contact » redondante avec le titre ----
await page.goto('http://localhost:3000/clients');
await page.waitForTimeout(600);
await page.locator('.client-list-row:has-text("Fatou Aina")').click();
await page.waitForTimeout(500);
const fiche = await page.locator('.sheet').innerText();
ok(/Fatou Aina/.test(fiche), 'clients : la fiche s’ouvre bien sur ce client');
ok((fiche.match(/Fatou Aina/g) || []).length === 1,
   'clients : son nom n’apparaît qu’une fois dans la fiche (pas de ligne Contact redondante)');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// ---- Fiche de l'entreprise : la ligne Contact, elle, reste utile ----
await page.locator('.client-list-row:has-text("Hôtel Central")').click();
await page.waitForTimeout(500);
const ficheEnt = await page.locator('.sheet').innerText();
ok(/Mme Adjovi/.test(ficheEnt), 'clients : la fiche entreprise garde la ligne Contact (personne différente du nom)');

// ============ ÉCRAN SUIVI CLIENTS (Pipeline) — même formulaire, même règle ============
await page.goto('http://localhost:3000/pipeline');
await page.waitForSelector('.page', { timeout: 15000 });
await page.waitForTimeout(700);
await page.locator('button:has-text("Nouvelle piste")').click();
await page.waitForTimeout(500);
ok(await page.locator('.sheet label:has-text("Nom complet")').count() === 1,
   'suivi clients : même comportement — « Nom complet » par défaut (Particulier)');
await page.locator('.client-type-btn:has-text("Entreprise")').click();
await page.waitForTimeout(300);
ok(await page.locator('.sheet label:has-text("Personne de contact")').count() === 1,
   'suivi clients : « Personne de contact » apparaît aussi ici en Entreprise');

console.log('\n' + R.join('\n'));
console.log(jsErr.length ? `\n❌ erreurs JS : ${jsErr.slice(0, 2).join(' | ')}` : '\naucune erreur JS');
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length + jsErr.length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ formulaire client adapté au type, sur les deux écrans');
process.exit(echecs ? 1 : 0);
