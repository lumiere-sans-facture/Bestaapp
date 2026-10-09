/* Documents du devis, produits DANS l'application — plus d'onglet à
   imprimer : téléchargement direct du PDF (bouton sur chaque ligne de la
   liste, et dans la fiche du devis), envoi sur WhatsApp avec le PDF JOINT
   (menu de partage), fiche de dimensionnement téléchargée depuis le devis
   enregistré comme depuis l'assistant (public et Pro). Application Android
   simulée : le fichier est rangé dans Documents/BestaSolar.
   Serveur : npm run dev */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };

// Un PDF valide, et son nombre de pages.
const lirePdf = async (telechargement) => {
  const chemin = await telechargement.path();
  const octets = readFileSync(chemin);
  const texte = octets.toString('latin1');
  return { nom: telechargement.suggestedFilename(), pdf: texte.startsWith('%PDF'), pages: (texte.match(/\/Type\s*\/Page[^s]/g) || []).length, taille: octets.length };
};

// Le devis créé à l'étape 1, déposé dans un autre navigateur. L'état se
// prépare depuis une page statique : l'app, absente, ne peut pas réécrire le
// stockage en partant.
const ouvrirAvecDevis = async (p, d) => {
  await p.goto(B + '/privacy.html');
  await p.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
  await p.goto(B + '/devis'); await p.waitForTimeout(1500);
  await p.goto(B + '/privacy.html');
  await p.evaluate((x) => { const s = JSON.parse(localStorage.getItem('bestasolar_data')); s.devis = [x, ...s.devis.filter((y) => y.id !== x.id)]; localStorage.setItem('bestasolar_data', JSON.stringify(s)); }, d);
  await p.goto(B + '/devis'); await p.waitForTimeout(1500);
};

const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 }, acceptDownloads: true });
let onglets = 0; ctx.on('page', () => { onglets += 1; });
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
await page.goto(B);
await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
const suivant = () => page.locator('button:has-text("Suivant")').first();

// ---- 1. Devis solaire créé dans l'assistant ; fiche depuis l'assistant ----
await page.goto(B + '/devis'); await page.waitForTimeout(1800);
await page.locator('button:has-text("Créer un devis"), button:has-text("Nouveau devis")').first().click(); await page.waitForTimeout(900);
await page.locator(':text("Dimensionnement solaire")').first().click(); await page.waitForTimeout(1000);
await page.locator('.page-content button').nth(1).click(); await page.waitForTimeout(400);
await suivant().click(); await page.waitForTimeout(900);
const ajouter = async (etiquette) => {
  const select = page.locator('select').first();
  const val = await select.evaluate((el, lbl) => [...el.options].find((x) => x.text.includes(lbl))?.value || '', etiquette);
  await select.selectOption(val); await page.waitForTimeout(300);
  await page.locator('.wizard-form button.btn-primary').first().click(); await page.waitForTimeout(500);
};
await ajouter('Réfrigérateur');
await ajouter('Téléviseur 32"');
await suivant().click(); await page.waitForTimeout(900);
await suivant().click(); await page.waitForTimeout(1600);
const ongletsAvant = onglets;
const [ficheAssistant] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  page.locator('button:has-text("Fiche de dimensionnement (PDF)")').click(),
]);
const fa = await lirePdf(ficheAssistant);
ok(fa.pdf && fa.pages === 3 && /^Fiche-dimensionnement.*\.pdf$/.test(fa.nom) && onglets === ongletsAvant,
  `assistant : fiche téléchargée en PDF, sans onglet [${fa.nom}, ${fa.pages} pages, ${Math.round(fa.taille / 1024)} Ko]`);
await page.locator('button:has-text("Créer le devis")').first().click(); await page.waitForTimeout(2000);
const devis = await page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')).devis.find((d) => d.type === 'solar'));
ok(!!devis?.dimensionnement, `devis solaire enregistré avec son étude [${devis?.devisNumber}]`);

// ---- 2. Liste : téléchargement direct sur la ligne ----
await page.goto(B + '/devis'); await page.waitForTimeout(1500);
const ligne = page.locator('.flat-row', { hasText: devis.devisNumber });
const [direct] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  ligne.locator('.flat-row-action').click(),
]);
const pd = await lirePdf(direct);
ok(pd.pdf && pd.pages >= 1 && pd.nom.startsWith(`Devis-${devis.devisNumber}`), `ligne : PDF du devis téléchargé directement [${pd.nom}, ${pd.pages} page(s), ${Math.round(pd.taille / 1024)} Ko]`);
ok(!(await page.locator('.sheet.open, .sheet-overlay.active').count()), 'la ligne ne s’est pas ouverte pour autant');

// ---- 3. Fiche du devis : télécharger, fiche de dimensionnement ----
await ligne.click(); await page.waitForTimeout(700);
const sheet = page.locator('.doc-actions-list').first();
const boutons = (await sheet.innerText()).replace(/\s+/g, ' ');
ok(/Télécharger le devis \(PDF\)/.test(boutons) && /Envoyer le devis sur WhatsApp/.test(boutons) && /Fiche de dimensionnement \(PDF\)/.test(boutons) && !/imprimable/.test(boutons),
  'fiche du devis : Télécharger, Envoyer sur WhatsApp, Fiche de dimensionnement');
const [ficheDevis] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  sheet.locator('button:has-text("Fiche de dimensionnement (PDF)")').click(),
]);
const fd = await lirePdf(ficheDevis);
ok(fd.pdf && fd.pages === 3, `fiche de dimensionnement depuis le devis enregistré [${fd.nom}, ${fd.pages} pages]`);
await page.locator('.doc-actions-list').first().screenshot({ path: '/tmp/claude-0/documents-devis-actions.png' });

// ---- 4. WhatsApp sur ordinateur : PDF téléchargé, conversation ouverte ----
const [pourWhatsapp] = await Promise.all([
  page.waitForEvent('download', { timeout: 30000 }),
  sheet.locator('button:has-text("Envoyer le devis sur WhatsApp")').click(),
]);
await page.waitForTimeout(500);
const envoi = page.locator('.sheet', { hasText: 'Envoyer le devis' }).last();
const lien = await envoi.locator('a:has-text("Ouvrir WhatsApp")').getAttribute('href').catch(() => null);
ok((await lirePdf(pourWhatsapp)).pdf && /^https:\/\/wa\.me\/\d*\?text=/.test(lien || '') && decodeURIComponent(lien).includes(devis.devisNumber),
  `ordinateur : PDF téléchargé et WhatsApp prêt sur la conversation [${(lien || '').slice(0, 40)}…]`);
ok(onglets === ongletsAvant, `aucun onglet ouvert par les documents [${onglets - ongletsAvant}]`);
await ctx.close();

// ---- 5. Téléphone : le PDF part JOINT par le menu de partage ----
for (const premierRefus of [false, true]) {
  const c = await nav.newContext({ viewport: { width: 412, height: 860 }, acceptDownloads: true });
  await c.addInitScript((refus) => {
    let refuse = refus;
    window.__partages = [];
    navigator.canShare = (d) => !!d?.files?.length;
    navigator.share = async (d) => {
      // Le navigateur réclame parfois un nouveau toucher quand la préparation a duré.
      if (refuse) { refuse = false; throw new DOMException('activation expirée', 'NotAllowedError'); }
      const f = d.files[0];
      window.__partages.push({ nom: f.name, type: f.type, taille: f.size, texte: d.text });
    };
  }, premierRefus);
  const p = await c.newPage();
  p.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
  await ouvrirAvecDevis(p, devis);
  await p.locator('.flat-row', { hasText: devis.devisNumber }).click(); await p.waitForTimeout(600);
  await p.locator('button:has-text("Envoyer le devis sur WhatsApp")').click();
  if (premierRefus) {
    const bouton = p.locator('.sheet button:has-text("Envoyer sur WhatsApp")');
    await bouton.waitFor({ timeout: 30000 });
    ok(true, 'toucher expiré : « Le PDF du devis est prêt » et un bouton pour l’envoyer');
    await bouton.click();
  }
  await p.waitForFunction(() => window.__partages.length > 0, null, { timeout: 30000 }).catch(() => {});
  const [partage] = await p.evaluate(() => window.__partages);
  ok(partage?.type === 'application/pdf' && partage.taille > 10000 && partage.nom.startsWith(`Devis-${devis.devisNumber}`) && /ci-joint votre devis/.test(partage.texte),
    `${premierRefus ? 'après un second toucher' : 'téléphone'} : PDF joint au partage, avec le message [${partage?.nom}, ${Math.round((partage?.taille || 0) / 1024)} Ko]`);
  await c.close();
}

// ---- 6. Application Android (simulée) : rangé dans Documents/BestaSolar ----
{
  const c = await nav.newContext({ viewport: { width: 412, height: 860 } });
  await c.addInitScript(() => { window.CapacitorCustomPlatform = { name: 'android', plugins: {} }; });
  const p = await c.newPage();
  p.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
  await ouvrirAvecDevis(p, devis);
  await p.locator('.flat-row', { hasText: devis.devisNumber }).locator('.flat-row-action').click();
  const toast = await p.locator('.toast').first().innerText({ timeout: 30000 }).catch(() => '');
  ok(/enregistré dans Documents\/BestaSolar/.test(toast), `app : devis rangé dans Documents/BestaSolar [${toast}]`);
  await c.close();
}

// ---- 7. Espace Pro : la fiche de l'assistant se télécharge aussi ----
{
  const c = await nav.newContext({ viewport: { width: 1280, height: 950 }, acceptDownloads: true });
  let ongletsPro = 0; c.on('page', () => { ongletsPro += 1; });
  const p = await c.newPage();
  p.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
  await p.goto(B + '/privacy.html');
  await p.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
  await p.goto(B + '/devis'); await p.waitForTimeout(1500);
  await p.goto(B + '/privacy.html');
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('bestasolar_data'));
    s.subscriptions = [{ id: 'sub-e2e', userId: 'u1', status: 'actif', formule: 'essentiel', dateDebut: new Date().toISOString(), dateFin: new Date(Date.now() + 30 * 864e5).toISOString() }];
    localStorage.setItem('bestasolar_data', JSON.stringify(s));
    localStorage.setItem('bestasolar_mode_u1', 'pro');
  });
  await p.goto(B + '/pro/documents'); await p.waitForTimeout(1800);
  await p.locator('button:has-text("Nouveau devis")').first().click(); await p.waitForTimeout(600);
  await p.locator('.devis-mode-card.featured').click(); await p.waitForTimeout(800);
  await p.getByLabel('Nom complet *').fill('Client Essai Pro');
  const etape = () => p.locator('.wizard-actions .btn-primary').first();
  await etape().click(); await p.waitForTimeout(600);
  await p.locator('button:has-text("Saisie directe")').click();
  await p.locator('.manual-consumption-grid input').nth(0).fill('8');
  await p.locator('.manual-consumption-grid input').nth(1).fill('4');
  await etape().click(); await p.waitForTimeout(800);
  await etape().click(); await p.waitForTimeout(1500);
  const avant = ongletsPro;
  const [fichePro] = await Promise.all([
    p.waitForEvent('download', { timeout: 30000 }),
    p.locator('button:has-text("Fiche de dimensionnement")').first().click(),
  ]);
  const fp = await lirePdf(fichePro);
  ok(fp.pdf && fp.pages === 3 && ongletsPro === avant, `Pro : fiche de l’assistant téléchargée, sans onglet [${fp.nom}, ${fp.pages} pages]`);
  await c.close();
}

console.log('\n' + R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : '\n✅ Documents du devis produits dans l’application');
process.exit(echecs ? 1 : 0);
