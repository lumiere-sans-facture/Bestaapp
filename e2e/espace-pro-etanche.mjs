/* Espace Pro étanche + aperçu des documents dans l'application.
   1. Les devis et clients PUBLICS de l'abonné n'apparaissent pas en Pro :
      liste Devis & Factures, carnet de clients (plus d'import depuis le
      suivi public), historique d'un client homonyme, cloche de notifications
      (alertes Pro seulement, liens vers les écrans Pro). Inversement, le
      devis Pro n'apparaît pas dans les devis publics.
   2. L'aperçu d'un document s'ouvre DANS l'application — pas d'onglet — avec
      « ← Retour » ; le retour du navigateur/téléphone le ferme sans quitter
      l'écran ; depuis l'aperçu, on télécharge le PDF.
   Serveur : npm run dev */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };
const DEVIS_PRO = 'BS-20261010-0077';
const DEVIS_PUBLIC = 'BS-20261001-0055';

const ctx = await nav.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, acceptDownloads: true });
const page = await ctx.newPage();
let onglets = 0; ctx.on('page', () => { onglets += 1; }); // pages ouvertes APRÈS celle-ci
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
await page.goto(B + '/privacy.html');
await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
await page.goto(B + '/dashboard'); await page.locator('.tab-bar').waitFor(); await page.waitForTimeout(1200);
await page.goto(B + '/privacy.html');
await page.evaluate(({ DEVIS_PRO, DEVIS_PUBLIC }) => {
  const s = JSON.parse(localStorage.getItem('bestasolar_data'));
  const maintenant = new Date().toISOString();
  const ilYa = (j) => new Date(Date.now() - j * 864e5).toISOString();
  s.subscriptions = [{ id: 'sub-e2e', userId: 'u1', status: 'actif', formule: 'essentiel', dateDebut: maintenant, dateFin: new Date(Date.now() + 30 * 864e5).toISOString() }];
  s.companies = [{ id: 'comp-u1', userId: 'u1', facturePrefix: 'FAC', factureCounter: 0, nomEntreprise: 'Lumière Sans Facture', telephone: '+228 79 98 02 09', modeleDefaut: 'sobre', pays: 'tg' }];
  // Le même nom des deux côtés : un client public ET un client Pro.
  const lead = { id: crypto.randomUUID(), name: 'Kodjo Mensah', contact: 'Kodjo Mensah', phone: '+228 90 11 11 11', address: 'Lomé', stage: 'devis', assignedTo: 'u1', createdAt: ilYa(40), lastActivity: ilYa(30) };
  s.leads = [lead, ...(s.leads || [])];
  const proClient = { id: crypto.randomUUID(), userId: 'u1', name: 'Kodjo Mensah', phone: '90 22 22 22', ville: 'Lomé', type: 'particulier', createdAt: maintenant };
  s.proClients = [proClient];
  const lignes = [{ designation: 'Kit solaire 3 kVA', qty: 1, pu: 1500000 }];
  s.devis = [
    { id: crypto.randomUUID(), type: 'manuel', devisNumber: DEVIS_PUBLIC, createdAt: ilYa(30), date: ilYa(30), createdBy: 'u1', leadId: lead.id, clientName: 'Kodjo Mensah', lignes, total: 1500000, stage: 'devis', pro: true },
    { id: crypto.randomUUID(), type: 'pro', pro: true, devisNumber: DEVIS_PRO, createdAt: maintenant, createdBy: 'u1', clientId: proClient.id, clientName: 'Kodjo Mensah', clientPhone: '90 22 22 22', lignes, subtotal: 1500000, tva: 0, total: 1500000, statut: 'finalise' },
    ...(s.devis || []).filter((d) => d.createdBy !== 'u1'),
  ];
  s.factures = [{ id: crypto.randomUUID(), userId: 'u1', numero: 'FAC-2026-009', clientId: proClient.id, clientName: 'Kodjo Mensah', clientPhone: '90 22 22 22', lignes, tvaActive: false, totalHT: 1500000, tva: 0, totalTTC: 1500000, statut: 'emise', createdAt: ilYa(40), echeance: ilYa(10) }];
  localStorage.setItem('bestasolar_data', JSON.stringify(s));
  localStorage.setItem('bestasolar_mode_u1', 'pro');
}, { DEVIS_PRO, DEVIS_PUBLIC });

// ---- 1. Étanchéité ----
await page.goto(B + '/pro/documents');
// (La liste passe d'abord par un squelette de chargement.)
await page.locator('.flat-row-title', { hasText: DEVIS_PRO }).waitFor({ timeout: 15000 }).catch(() => {});
const titres = await page.locator('.flat-row-title').allInnerTexts();
ok(titres.some((t) => t.includes(DEVIS_PRO)) && !titres.some((t) => t.includes(DEVIS_PUBLIC)), `Devis & Factures : le devis Pro seul [${titres.join(' | ')}]`);
ok(await page.getByRole('button', { name: /Devis \(1\)/ }).count() === 1, 'compteur : « Devis (1) »');

// Cloche : alertes Pro (facture en retard), aucun client public.
await page.locator('.notif-bell:visible').first().click();
const cloche = page.locator('.sheet', { hasText: 'Notifications' });
await cloche.waitFor();
const alertes = (await cloche.innerText()).replace(/\s+/g, ' ');
ok(/En retard de \d+ j/.test(alertes) && /FAC-2026-009/.test(alertes), `cloche Pro : facture en retard [${alertes.slice(0, 90)}…]`);
ok(!/Kodjo|Sans activité|Devis sans suite|commission/i.test(alertes), 'cloche Pro : aucun client, devis ou commission du public');
const liens = await cloche.locator('a.alert-feed-row').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
ok(liens.length > 0 && liens.every((h) => h.startsWith('/pro/')), `liens de la cloche vers l'espace Pro [${[...new Set(liens)].join(', ')}]`);
await page.keyboard.press('Escape'); await page.waitForTimeout(300);

await page.goto(B + '/pro/clients');
await page.locator('.section-title', { hasText: 'Mes clients' }).waitFor({ timeout: 15000 });
ok(await page.getByRole('button', { name: /Importer depuis mes clients/ }).count() === 0, 'clients Pro : plus d’import depuis le suivi public');
const clientsPro = await page.locator('.flat-row-title, .flat-row-main').allInnerTexts();
ok(clientsPro.filter((t) => /Kodjo Mensah/.test(t)).length >= 1, `clients Pro : le client du carnet Pro [${clientsPro.length} ligne(s)]`);
await page.locator('.flat-row', { hasText: 'Kodjo Mensah' }).first().click();
const fiche = page.locator('.sheet', { hasText: 'Historique' });
await fiche.waitFor({ timeout: 10000 }).catch(() => {});
const historique = (await fiche.innerText().catch(() => '')).replace(/\s+/g, ' ');
ok(historique.includes(DEVIS_PRO) && !historique.includes(DEVIS_PUBLIC), `historique du client Pro homonyme : sans le devis public [${(historique.match(/Historique \(\d+ devis[^·]*· \d+ facture/) || [''])[0]}…]`);
await page.keyboard.press('Escape'); await page.waitForTimeout(300);

// ---- 2. Aperçu dans l'application ----
await page.goto(B + '/pro/entreprise');
await page.getByRole('button', { name: /Voir un aperçu du document/ }).click();
const apercu = page.locator('.apercu-doc');
await apercu.waitFor({ timeout: 15000 });
const cadre = page.frameLocator('.apercu-doc-cadre');
await cadre.locator('.page').first().waitFor({ timeout: 15000 });
const mesure = await page.locator('.apercu-doc-cadre').evaluate((f) => {
  const d = f.contentDocument;
  const pg = d.querySelector('.page');
  const zoom = parseFloat(getComputedStyle(d.documentElement).zoom) || 1;
  return { largeurPage: Math.round(pg.getBoundingClientRect().width * (zoom < 1 && pg.getBoundingClientRect().width > 700 ? zoom : 1)), largeurCadre: f.clientWidth, impression: !!d.querySelector('.print-bar') && getComputedStyle(d.querySelector('.print-bar')).display };
});
ok(onglets === 0, `Mon entreprise : aperçu dans l’application, aucun onglet [${onglets}]`);
ok(mesure.largeurPage <= mesure.largeurCadre, `page ramenée à la largeur de l’écran [${mesure.largeurPage} ≤ ${mesure.largeurCadre} px]`);
ok(mesure.impression === 'none', 'barre « Imprimer » masquée dans l’aperçu');
await page.screenshot({ path: '/tmp/claude-0/apercu-entreprise.png' });
await page.getByRole('button', { name: 'Retour' }).click(); await page.waitForTimeout(400);
ok(!(await apercu.count()) && new URL(page.url()).pathname === '/pro/entreprise', `« Retour » ferme l’aperçu, on reste sur Mon entreprise [${new URL(page.url()).pathname}]`);
// Le retour du téléphone (historique) ferme l'aperçu, sans quitter l'écran.
await page.getByRole('button', { name: /Voir un aperçu du document/ }).click();
await apercu.waitFor();
await page.goBack(); await page.waitForTimeout(500);
ok(!(await apercu.count()) && new URL(page.url()).pathname === '/pro/entreprise', `retour du téléphone : aperçu fermé, écran conservé [${new URL(page.url()).pathname}]`);

// Devis : aperçu depuis la fiche, téléchargement depuis l'aperçu, retour à la fiche.
await page.goto(B + '/pro/documents');
await page.locator('.flat-row', { hasText: DEVIS_PRO }).click();
await page.locator('.doc-actions-list').waitFor();
await page.locator('.doc-actions-list button', { hasText: 'Aperçu du devis' }).click();
await apercu.waitFor();
await cadre.locator('.page').first().waitFor({ timeout: 15000 });
const contenu = await cadre.locator('body').innerText();
ok(contenu.includes(DEVIS_PRO) && contenu.includes('LUMIÈRE SANS FACTURE'), `aperçu du devis : ${DEVIS_PRO}, modèle Sobre de l’entreprise`);
ok(await page.locator('.apercu-doc-titre').innerText() === `Devis ${DEVIS_PRO}`, 'titre de l’aperçu');
await page.screenshot({ path: '/tmp/claude-0/apercu-devis.png' });
const [pdf] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator('.apercu-doc-actions button', { hasText: 'Télécharger' }).click()]);
ok(pdf.suggestedFilename() === `Devis-${DEVIS_PRO}-Kodjo-Mensah.pdf`, `téléchargé depuis l’aperçu [${pdf.suggestedFilename()}]`);
ok(await apercu.isVisible(), 'l’aperçu reste ouvert après le téléchargement');
await page.getByRole('button', { name: 'Retour' }).click(); await page.waitForTimeout(400);
ok(!(await apercu.count()) && await page.locator('.doc-actions-list').isVisible(), '« Retour » ramène à la fiche du devis');
ok(onglets === 0, `aucun onglet ouvert [${onglets}]`);

// Inverse : le devis Pro n'apparaît pas dans les devis publics.
await page.goto(B + '/privacy.html');
await page.evaluate(() => localStorage.setItem('bestasolar_mode_u1', 'public'));
await page.goto(B + '/devis'); await page.waitForTimeout(1500);
const publics = (await page.locator('.flat-row-title').allInnerTexts()).join(' | ');
ok(publics.includes(DEVIS_PUBLIC) && !publics.includes(DEVIS_PRO), `devis publics : le devis public, pas le devis Pro`);

await nav.close();
console.log(R.join('\n'));
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : `\n✅ Espace Pro étanche, aperçu dans l’application (${R.length} vérifications)`);
process.exit(echecs ? 1 : 0);
