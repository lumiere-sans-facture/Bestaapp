/* Espace Pro — le pays de l'entreprise (Bénin, Burkina Faso, Cameroun, Côte
   d'Ivoire, Mali, Niger, Sénégal, Togo) règle ses documents.
   Une entreprise enregistrée avant ce réglage (+228) reste au Togo : NIF,
   TVA 18 %. Passée au Cameroun : identifiant « NIU », exemples en +237, TVA
   19,25 % sur la nouvelle facture, franc CFA BEAC, opérateurs Mobile Money
   du pays ; la facture imprimée porte « NIU … » et l'opérateur ; la relance
   WhatsApp d'un client au numéro local part vers +237.
   Serveur : npm run dev */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };

const ctx = await nav.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, acceptDownloads: true });
// La relance WhatsApp ouvre un onglet : son adresse est relevée, sans réseau.
await ctx.addInitScript(() => { window.__ouverts = []; window.open = (url) => { window.__ouverts.push(String(url)); return null; }; });
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
await page.goto(B + '/privacy.html');
await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
await page.goto(B + '/dashboard'); await page.locator('.tab-bar').waitFor(); await page.waitForTimeout(1200);
await page.goto(B + '/privacy.html');
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('bestasolar_data'));
  const maintenant = new Date().toISOString();
  s.subscriptions = [{ id: 'sub-e2e', userId: 'u1', status: 'actif', formule: 'essentiel', dateDebut: maintenant, dateFin: new Date(Date.now() + 30 * 864e5).toISOString() }];
  // Entreprise d'avant le réglage : pas de pays, un téléphone togolais.
  s.companies = [{ id: 'comp-u1', userId: 'u1', facturePrefix: 'FAC', factureCounter: 0, nomEntreprise: 'Lumière Sans Facture', telephone: '+228 79 98 02 09', modeleDefaut: 'sobre' }];
  s.proClients = [{ id: crypto.randomUUID(), userId: 'u1', name: 'Paul Biya Ndzana', phone: '6 77 12 34 56', ville: 'Douala', type: 'particulier', createdAt: maintenant }];
  s.factures = [];
  localStorage.setItem('bestasolar_data', JSON.stringify(s));
  localStorage.setItem('bestasolar_mode_u1', 'pro');
});

// ---- 1. Entreprise d'avant : Togo, déduit du téléphone ----
await page.goto(B + '/pro/entreprise');
const choixPays = page.getByLabel("Pays de l'entreprise");
await choixPays.waitFor({ timeout: 15000 });
const resume = () => page.locator('.pays-resume').innerText();
ok(await choixPays.inputValue() === 'tg', `entreprise sans pays (+228) : Togo [${await choixPays.inputValue()}]`);
ok(await page.getByLabel('NIF (optionnel)').count() === 1 && /TVA 18 %/.test(await resume()), `Togo : NIF, ${await resume()}`);
const options = await choixPays.evaluate((s) => [...s.options].map((o) => o.textContent.replace(/^\S+\s/, '')));
ok(options.join(', ') === 'Bénin, Burkina Faso, Cameroun, Côte d’Ivoire, Mali, Niger, Sénégal, Togo', `huit pays proposés [${options.join(', ')}]`);

// ---- 2. Passage au Cameroun ----
await choixPays.selectOption('cm'); await page.waitForTimeout(200);
const r = await resume();
ok(/Indicatif \+237/.test(r) && /TVA 19,25 %/.test(r) && /Franc CFA \(BEAC\)/.test(r) && /NIU/.test(r), `Cameroun : ${r}`);
const niu = page.getByLabel('NIU (optionnel)');
ok(await niu.count() === 1, 'identifiant fiscal : « NIU (optionnel) »');
ok((await page.getByLabel('Téléphone', { exact: true }).getAttribute('placeholder')).startsWith('+237'), 'exemple de téléphone en +237');
const alerte = await page.locator('.field-hint.text-warning').first().innerText().catch(() => '');
ok(/Numéro en \+228 \(Togo\) : est-ce le bon \?/.test(alerte), `téléphone resté en +228 : alerte [${alerte}]`);
const operateurs = await page.locator('#operateurs-mobile-money option').evaluateAll((os) => os.map((o) => o.value));
ok(operateurs.join(', ') === 'MTN MoMo, Orange Money', `opérateurs Mobile Money suggérés [${operateurs.join(', ')}]`);
ok(await page.getByRole('button', { name: 'TVA 19,25 %' }).count() === 1, 'réglage TVA : « TVA 19,25 % »');
await page.locator('.pro-company-form .my-partner-section', { hasText: 'Coordonnées' }).screenshot({ path: '/tmp/claude-0/pays-entreprise-coordonnees.png' });
await niu.fill('M012400012345A');
await page.getByLabel('Opérateur Mobile Money').fill('Orange Money');
await page.getByLabel('Numéro Mobile Money').fill('+237 6 99 00 00 00');
await page.getByRole('button', { name: 'Enregistrer' }).click(); await page.waitForTimeout(800);
const enregistree = await page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')).companies.find((c) => c.userId === 'u1'));
ok(enregistree?.pays === 'cm' && enregistree.ifu === 'M012400012345A' && enregistree.momoOperateur === 'Orange Money', `entreprise enregistrée au Cameroun [${enregistree?.pays}]`);

// ---- 3. Nouvelle facture : TVA à 19,25 % ----
await page.goto(B + '/pro/documents');
await page.getByRole('button', { name: /Factures \(0\)/ }).click();
await page.locator('button', { hasText: 'Nouvelle facture' }).first().click();
await page.getByLabel('Désignation').first().waitFor();
const tvaBouton = page.locator('.sheet').getByRole('button', { name: 'TVA 19,25 %' });
ok(await tvaBouton.count() === 1, 'formulaire de facture : « TVA 19,25 % »');
const indication = await page.locator('.sheet .field-hint', { hasText: 'TVA à' }).first().innerText().catch(() => '');
ok(/TVA à 19,25 % au Cameroun/.test(indication), `indication : « ${indication.slice(0, 60)}… »`);
await page.getByLabel('Désignation').first().fill('Kit solaire 3 kVA');
await page.locator('.doc-line-field', { hasText: 'Prix unitaire' }).locator('input').first().fill('1000000');
await tvaBouton.click();
await page.locator('button', { hasText: 'Créer la facture' }).click(); await page.waitForTimeout(800);
const facture = await page.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')).factures[0]);
ok(facture?.tva === 192500 && facture.totalTTC === 1192500, `TVA au taux camerounais [HT ${facture?.totalHT} · TVA ${facture?.tva} · TTC ${facture?.totalTTC}]`);

// ---- 4. Facture imprimée : NIU et opérateur ----
const ligne = page.locator('.flat-row', { hasText: facture.numero });
const [pdf] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), ligne.locator('.flat-row-action').click()]);
ok(/\.pdf$/.test(pdf.suggestedFilename()), `facture téléchargée [${pdf.suggestedFilename()}]`);
const html = await page.evaluate(async () => {
  const s = JSON.parse(localStorage.getItem('bestasolar_data'));
  const [{ buildDocHtml, normaliserModel }, { donneesDeFacture }] = await Promise.all([
    import('/src/utils/docTemplates/index.js'), import('/src/utils/docTemplates/shared.js'),
  ]);
  const company = s.companies.find((c) => c.userId === 'u1');
  return buildDocHtml({ kind: 'facture', model: normaliserModel(s.factures[0].modele || company.modeleDefaut), data: donneesDeFacture({ facture: s.factures[0], company }) });
});
ok(html.includes('NIU M012400012345A') && html.includes('<div class="lib">NIU</div>'), 'document : « NIU M012400012345A » (pied et bloc client)');
ok(html.includes('<span class="lib">Paiement</span> Orange Money') && html.includes('192 500'), 'document : paiement « Orange Money », TVA 192 500');

// ---- 5. Relance WhatsApp : le numéro local du client part en +237 ----
await ligne.click(); await page.locator('.doc-actions-list').waitFor();
await page.locator('.doc-actions-list button', { hasText: 'Relancer par WhatsApp' }).click(); await page.waitForTimeout(400);
const [lien] = await page.evaluate(() => window.__ouverts);
ok((lien || '').startsWith('https://wa.me/237677123456?text='), `relance : wa.me/237… [${(lien || '').slice(0, 40)}]`);
ok(decodeURIComponent(lien || '').includes('Règlement Orange Money : +237 6 99 00 00 00'), 'relance : « Règlement Orange Money : … »');

await nav.close();
console.log(R.join('\n'));
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : `\n✅ Pays de l’entreprise : libellés, TVA et numéros du pays (${R.length} vérifications)`);
process.exit(echecs ? 1 : 0);
