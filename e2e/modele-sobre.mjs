/* Espace Pro — le modèle « Sobre » remplace « Classique ».
   Une entreprise et une facture restées réglées sur « classique » s'ouvrent
   en Sobre : sélecteurs Studio / Vague / Sobre (Sobre actif) dans Mon
   entreprise, dans la fiche d'une facture et dans son formulaire ; la
   facture du dossier Felix Sossa (9 lignes, 1 200 000 F CFA), téléchargée en PDF,
   tient sur UNE page, sans débordement, sans désignation sur deux lignes,
   avec de l'air au-dessus du pied, en noir, blanc et gris seulement.
   Serveur : npm run dev */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };

const ctx = await nav.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
await page.goto(B + '/');
await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
await page.goto(B + '/dashboard'); await page.locator('.tab-bar').waitFor(); await page.waitForTimeout(1200);

// Préparation depuis une page statique : l'app, absente, ne réécrit pas le stockage.
await page.goto(B + '/privacy.html');
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('bestasolar_data'));
  const maintenant = new Date().toISOString();
  s.subscriptions = [{ id: 'sub-e2e', userId: 'u1', status: 'actif', formule: 'essentiel', dateDebut: maintenant, dateFin: new Date(Date.now() + 30 * 864e5).toISOString() }];
  s.companies = [{
    id: 'comp-u1', userId: 'u1', facturePrefix: 'FAC', factureCounter: 14, modeleDefaut: 'classique',
    nomEntreprise: 'Lumière Sans Facture', slogan: 'Énergie lumineuse sans facture', telephone: '+228 79 98 02 09',
    email: 'contact@bestasolar.com', website: 'www.bestasolar.com', adresse: 'Adidoadin, Lomé — Togo',
    rccm: 'TG-LFW-01-2025-A10-01086', ifu: '1002023475',
  }];
  const lignes = [
    ['Panneau photovoltaïque 620 Wc', 4, 70000], ['Onduleur hybride 3 kVA', 1, 250000],
    ['Batterie lithium 48V 100Ah', 1, 425000], ['Coffret de protection DC/AC', 1, 45000],
    ['Structure de montage galvanisée', 1, 60000], ['Kit de câblage solaire', 1, 30000],
    ['Mise à la terre (piquet et câble)', 1, 20000], ['Main d’œuvre et installation', 1, 80000],
    ['Mise en service et formation', 1, 10000],
  ].map(([designation, qty, pu]) => ({ designation, qty, pu }));
  s.factures = [{
    id: crypto.randomUUID(), userId: 'u1', numero: 'FAC-2026-014', clientName: 'Felix Sossa',
    clientPhone: '+228 90 00 00 00', clientVille: 'Agoè, Lomé', lignes, tvaActive: false,
    totalHT: 1200000, tva: 0, totalTTC: 1200000, statut: 'emise', modele: 'classique',
    createdAt: maintenant, echeance: new Date(Date.now() + 30 * 864e5).toISOString(),
  }];
  localStorage.setItem('bestasolar_data', JSON.stringify(s));
  localStorage.setItem('bestasolar_mode_u1', 'pro');
});

const segments = (selecteur) => page.locator(selecteur).first().evaluate((g) => [...g.querySelectorAll('.segmented-btn')]
  .map((b) => (b.classList.contains('active') ? `[${b.textContent.trim()}]` : b.textContent.trim())).join(' '));

// 1. Mon entreprise : trois modèles, l'entreprise « classique » est en Sobre.
await page.goto(B + '/pro/entreprise'); await page.locator('[aria-labelledby="modele-doc-label"]').waitFor({ timeout: 15000 });
let s = await segments('[aria-labelledby="modele-doc-label"]');
ok(s === 'Studio Vague [Sobre]', `Mon entreprise : ${s}`);
ok(await page.getByText('Noir, blanc et gris, sans logo').isVisible(), 'description du modèle Sobre affichée');
const apercu = await page.locator('.pro-preview-wrap').evaluate((w) => ({
  images: w.querySelectorAll('img').length,
  couleurs: [...new Set([...w.querySelectorAll('*')].map((e) => getComputedStyle(e).color))],
}));
ok(apercu.images === 0, 'aperçu en direct : aucun logo');
ok(apercu.couleurs.every((c) => { const m = c.match(/\d+/g); return m && m[0] === m[1] && m[1] === m[2]; }), `aperçu en direct en gris seulement [${apercu.couleurs.join(' ')}]`);

// 2. Devis & Factures → la facture : sélecteur, puis document imprimable.
await page.goto(B + '/pro/documents'); await page.getByRole('button', { name: /Factures \(1\)/ }).waitFor({ timeout: 15000 });
await page.getByRole('button', { name: /Factures \(1\)/ }).click();
await page.getByText('FAC-2026-014 - Felix Sossa').click();
await page.locator('[aria-labelledby="doc-modele-label"]').waitFor();
s = await segments('[aria-labelledby="doc-modele-label"]');
ok(s === 'Studio Vague [Sobre]', `fiche de la facture : ${s}`);

// La facture se télécharge en PDF (une page = une page du document) ; sa
// mise en page se mesure sur le document dont ce PDF est la copie (même HTML).
const [pdf] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: /Télécharger la facture \(PDF\)/ }).click()]);
const octets = readFileSync(await pdf.path()).toString('latin1');
ok(octets.startsWith('%PDF') && (octets.match(/\/Type\s*\/Page[^s]/g) || []).length === 1, `facture téléchargée en PDF d'une page [${pdf.suggestedFilename()}]`);
const html = await page.evaluate(async () => {
  const s = JSON.parse(localStorage.getItem('bestasolar_data'));
  const f = s.factures.find((x) => x.numero === 'FAC-2026-014');
  const company = s.companies.find((c) => c.userId === 'u1');
  const [{ buildDocHtml, normaliserModel }, { donneesDeFacture }] = await Promise.all([
    import('/src/utils/docTemplates/index.js'), import('/src/utils/docTemplates/shared.js'),
  ]);
  return buildDocHtml({ kind: 'facture', model: normaliserModel(f.modele), data: donneesDeFacture({ facture: f, company }) });
});
const doc = await ctx.newPage();
await doc.setViewportSize({ width: 900, height: 1250 });
await doc.goto(B + '/privacy.html'); // même origine : la police du document se charge
await doc.setContent(html, { waitUntil: 'load' }); await doc.evaluate(() => document.fonts.ready); await doc.waitForTimeout(500);
const m = await doc.evaluate(() => {
  const pages = [...document.querySelectorAll('.page')];
  const pg = pages[0];
  const visibles = [];
  for (const el of document.querySelectorAll('.page, .page *')) {
    const cs = getComputedStyle(el);
    visibles.push(cs.color);
    if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)') visibles.push(cs.backgroundColor);
    for (const cote of ['Top', 'Bottom', 'Left', 'Right']) {
      if (cs[`border${cote}Style`] !== 'none' && parseFloat(cs[`border${cote}Width`]) > 0) visibles.push(cs[`border${cote}Color`]);
    }
  }
  const couleurs = [...new Set(visibles)];
  const surDeuxLignes = [...pg.querySelectorAll('tbody tr')].filter((tr) => {
    const r = document.createRange(); r.selectNodeContents(tr.children[2]);
    return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size > 1;
  }).length;
  const pied = pg.querySelector('.pied'); const sig = pg.querySelector('.signature');
  return {
    pages: pages.length, scroll: pg.scrollHeight, client: pg.clientHeight,
    lignes: pg.querySelectorAll('tbody tr').length, surDeuxLignes,
    ecart: pied && sig ? Math.round(pied.getBoundingClientRect().top - sig.getBoundingClientRect().bottom) : null,
    couleurs, horsGris: couleurs.filter((c) => { const n = c.match(/\d+/g); return !(n[0] === n[1] && n[1] === n[2]); }),
    cats: [...pg.querySelectorAll('td.cat')].map((t) => t.textContent),
    total: pg.querySelector('.montant')?.textContent, titre: pg.querySelector('.titre')?.textContent,
    nom: pg.querySelector('.nom')?.textContent, images: pg.querySelectorAll('img, svg').length,
    police: document.fonts.check('13px "IBM Plex Sans"'),
  };
});
ok(m.titre === 'FACTURE' && m.nom === 'Lumière Sans Facture', `facture « classique » rendue en Sobre [${m.titre} · ${m.nom}]`);
ok(m.pages === 1 && m.lignes === 9, `9 lignes sur une seule page [${m.pages} page(s), ${m.lignes} lignes]`);
ok(m.scroll === m.client, `aucun débordement [scrollHeight ${m.scroll} = clientHeight ${m.client}]`);
ok(m.surDeuxLignes === 0, `aucune désignation sur deux lignes [${m.surDeuxLignes}]`);
ok(m.ecart > 0, `de l'air au-dessus du pied de page [${m.ecart} px]`);
ok(m.horsGris.length === 0, `noir, blanc et gris seulement [${m.couleurs.length} teintes${m.horsGris.length ? ' ; hors gris : ' + m.horsGris.join(' ') : ''}]`);
ok(m.cats.length === 9 && m.cats.every(Boolean), `colonne Cat. remplie [${m.cats.join(', ')}]`);
ok(m.total === '1 200 000', `total affiché [${m.total}]`);
ok(m.images === 0, 'aucun logo ni image');
ok(m.police, 'police IBM Plex Sans chargée');
await doc.screenshot({ path: '/tmp/claude-0/modele-sobre-facture.png', fullPage: true });
await doc.emulateMedia({ media: 'print' });
await doc.pdf({ path: '/tmp/claude-0/modele-sobre-facture.pdf', format: 'A4', printBackground: true });
await doc.close();

// 3. Formulaire de la facture : le menu montre Sobre, pas Studio par défaut.
// (Rouverte si besoin.)
if (!(await page.getByRole('button', { name: /Modifier la facture/ }).isVisible())) await page.getByText('FAC-2026-014 - Felix Sossa').click();
await page.getByRole('button', { name: /Modifier la facture/ }).click();
const menu = page.locator('select').filter({ has: page.locator('option[value="sobre"]') }).first();
await menu.waitFor();
const choix = await menu.evaluate((el) => ({ valeur: el.value, options: [...el.options].map((o) => o.textContent).join(' ') }));
ok(choix.options === 'Studio Vague Sobre', `options du formulaire [${choix.options}]`);
ok(choix.valeur === 'sobre', `formulaire de la facture « classique » sur Sobre [${choix.valeur}]`);

await nav.close();
console.log(R.join('\n'));
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(`\n${R.length - echecs}/${R.length} vérifications passées`);
process.exit(echecs ? 1 : 0);
