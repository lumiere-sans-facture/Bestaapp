/* Espace Pro — devis et factures produits DANS l'application, comme le devis
   public : plus d'onglet « imprimable ». Téléchargement direct du PDF (icône
   sur chaque ligne, bouton dans la fiche), envoi sur WhatsApp avec le PDF
   JOINT et un message signé par l'entreprise de l'abonné ; le modèle est
   celui du document (ou celui choisi), retenu par le devis. Application
   Android simulée : rangé dans Documents/BestaSolar. Enfin, la fiche de
   dimensionnement de l'assistant Pro, en proposition par kit, présente le
   matériel du CALCUL — le kit n'apparaît que sur le devis.
   Serveur : npm run dev */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };
const DEVIS = 'BS-20261009-0042';
const FACTURE = 'FAC-2026-015';

const lirePdf = async (telechargement) => {
  const octets = readFileSync(await telechargement.path());
  const texte = octets.toString('latin1');
  return { nom: telechargement.suggestedFilename(), pdf: texte.startsWith('%PDF'), pages: (texte.match(/\/Type\s*\/Page[^s]/g) || []).length, taille: octets.length };
};

// Espace Pro préparé depuis une page statique : l'app, absente, ne réécrit
// pas le stockage en partant.
const ouvrirPro = async (p) => {
  await p.goto(B + '/privacy.html');
  await p.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
  await p.goto(B + '/dashboard'); await p.locator('.tab-bar:visible, .sidebar:visible').first().waitFor(); await p.waitForTimeout(1200);
  await p.goto(B + '/privacy.html');
  await p.evaluate(({ DEVIS, FACTURE }) => {
    const s = JSON.parse(localStorage.getItem('bestasolar_data'));
    const maintenant = new Date().toISOString();
    s.subscriptions = [{ id: 'sub-e2e', userId: 'u1', status: 'actif', formule: 'essentiel', dateDebut: maintenant, dateFin: new Date(Date.now() + 30 * 864e5).toISOString() }];
    s.companies = [{
      id: 'comp-u1', userId: 'u1', facturePrefix: 'FAC', factureCounter: 15, modeleDefaut: 'vague',
      nomEntreprise: 'Lumière Sans Facture', telephone: '+228 79 98 02 09', email: 'contact@bestasolar.com',
      adresse: 'Adidoadin, Lomé — Togo', momo: '+228 90 11 22 33', momoNom: 'L. S. F.',
    }];
    const lignes = [
      { designation: 'Panneau photovoltaïque 620 Wc', qty: 4, pu: 70000 },
      { designation: 'Onduleur hybride 3 kVA', qty: 1, pu: 250000 },
      { designation: 'Main d’œuvre et installation', qty: 1, pu: 80000 },
    ];
    s.devis = [{
      id: crypto.randomUUID(), type: 'pro', pro: true, devisNumber: DEVIS, createdAt: maintenant, createdBy: 'u1',
      clientName: 'Felix Sossa', clientPhone: '+228 90 00 00 00', clientVille: 'Agoè, Lomé', lignes,
      subtotal: 610000, tvaActive: false, tva: 0, total: 610000, statut: 'finalise',
    }, ...(s.devis || []).filter((d) => d.devisNumber !== DEVIS)];
    s.factures = [{
      id: crypto.randomUUID(), userId: 'u1', numero: FACTURE, clientName: 'Felix Sossa', clientPhone: '+228 90 00 00 00',
      clientVille: 'Agoè, Lomé', lignes, tvaActive: false, totalHT: 610000, tva: 0, totalTTC: 610000, statut: 'emise',
      modele: 'sobre', createdAt: maintenant, echeance: new Date(Date.now() + 30 * 864e5).toISOString(),
    }];
    localStorage.setItem('bestasolar_data', JSON.stringify(s));
    localStorage.setItem('bestasolar_mode_u1', 'pro');
  }, { DEVIS, FACTURE });
  await p.goto(B + '/pro/documents');
  await p.locator('.flat-row', { hasText: DEVIS }).waitFor({ timeout: 15000 });
};
const ongletFactures = (p) => p.getByRole('button', { name: /Factures \(1\)/ }).click();
const selecteur = (p) => p.locator('[aria-labelledby="doc-modele-label"]').evaluate((g) => [...g.querySelectorAll('.segmented-btn')]
  .map((b) => (b.classList.contains('active') ? `[${b.textContent.trim()}]` : b.textContent.trim())).join(' '));
// L'état s'écrit dans le stockage avec un court délai : on attend la valeur.
const devisStocke = async (p, modele) => {
  await p.waitForFunction(({ n, m }) => JSON.parse(localStorage.getItem('bestasolar_data')).devis.find((d) => d.devisNumber === n)?.modele === m,
    { n: DEVIS, m: modele }, { timeout: 5000 }).catch(() => {});
  return p.evaluate((n) => JSON.parse(localStorage.getItem('bestasolar_data')).devis.find((d) => d.devisNumber === n), DEVIS);
};

// ---- 1. Ordinateur ----
{
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 }, acceptDownloads: true });
  let onglets = 0; ctx.on('page', () => { onglets += 1; });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
  await ouvrirPro(page);
  const ongletsAvant = onglets;

  // Devis : téléchargement direct sur la ligne, au modèle de l'entreprise.
  const ligneDevis = page.locator('.flat-row', { hasText: DEVIS });
  const [direct] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), ligneDevis.locator('.flat-row-action').click()]);
  const pd = await lirePdf(direct);
  ok(pd.pdf && pd.pages === 1 && pd.nom === `Devis-${DEVIS}-Felix-Sossa.pdf`, `ligne du devis : PDF téléchargé directement [${pd.nom}, ${pd.pages} page, ${Math.round(pd.taille / 1024)} Ko]`);
  ok(!(await page.locator('.doc-actions-list').count()), 'la ligne ne s’est pas ouverte pour autant');
  let d = await devisStocke(page, 'vague');
  ok(d.modele === 'vague' && d.companySnapshot?.nomEntreprise === 'Lumière Sans Facture', `le devis retient le modèle et l’identité de son envoi [${d.modele}]`);

  // Fiche du devis : boutons, modèle choisi, retenu à la réouverture.
  await ligneDevis.click(); await page.locator('.doc-actions-list').waitFor();
  let boutons = (await page.locator('.doc-actions-list').innerText()).replace(/\s+/g, ' ');
  ok(/Télécharger le devis \(PDF\)/.test(boutons) && /Envoyer le devis sur WhatsApp/.test(boutons) && !/imprimable/i.test(boutons),
    'fiche du devis : Télécharger, Envoyer sur WhatsApp — plus de « Devis imprimable »');
  ok(await selecteur(page) === 'Studio [Vague] Sobre', `modèle proposé : celui du devis [${await selecteur(page)}]`);
  await page.locator('.doc-actions-list').screenshot({ path: '/tmp/claude-0/documents-pro-devis.png' });
  await page.locator('[aria-labelledby="doc-modele-label"] .segmented-btn', { hasText: 'Sobre' }).click();
  const [auChoix] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator('.doc-actions-list button', { hasText: 'Télécharger le devis (PDF)' }).click()]);
  d = await devisStocke(page, 'sobre');
  ok((await lirePdf(auChoix)).pdf && d.modele === 'sobre', `PDF au modèle choisi, retenu par le devis [${d.modele}]`);
  const toastDevis = await page.locator('.toast').last().innerText().catch(() => '');
  ok(/Devis BS-20261009-0042 téléchargé\./.test(toastDevis), `annonce : « ${toastDevis} »`);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await ligneDevis.click(); await page.locator('.doc-actions-list').waitFor();
  ok(await selecteur(page) === 'Studio Vague [Sobre]', `réouvert : le devis propose son dernier modèle [${await selecteur(page)}]`);

  // WhatsApp sur ordinateur : PDF téléchargé, conversation du client prête.
  const [pourWhatsapp] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator('.doc-actions-list button', { hasText: 'Envoyer le devis sur WhatsApp' }).click()]);
  const envoi = page.locator('.sheet', { hasText: 'Envoyer le devis' }).last();
  const lien = decodeURIComponent(await envoi.locator('a:has-text("Ouvrir WhatsApp")').getAttribute('href').catch(() => '') || '');
  ok((await lirePdf(pourWhatsapp)).pdf && lien.startsWith('https://wa.me/22890000000?text=') && lien.includes(DEVIS) && /Lumière Sans Facture$/.test(lien) && !lien.includes('BestaSolar'),
    `ordinateur : PDF téléchargé, WhatsApp prêt, message signé par l’entreprise [${lien.split('\n').at(-1)}]`);
  await page.locator('.sheet', { hasText: 'Envoyer le devis' }).last().locator('a:has-text("Ouvrir WhatsApp")').evaluate((a) => a.removeAttribute('target'));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);

  // Factures : ligne, puis fiche au modèle de la facture (Sobre, pas Vague).
  await ongletFactures(page);
  const ligneFacture = page.locator('.flat-row', { hasText: FACTURE });
  const [fDirect] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), ligneFacture.locator('.flat-row-action').click()]);
  const pf = await lirePdf(fDirect);
  ok(pf.pdf && pf.pages === 1 && pf.nom === `Facture-${FACTURE}-Felix-Sossa.pdf`, `ligne de la facture : PDF téléchargé directement [${pf.nom}]`);
  const toastFacture = await page.locator('.toast').last().innerText().catch(() => '');
  ok(/Facture FAC-2026-015 téléchargée\./.test(toastFacture), `annonce accordée : « ${toastFacture} »`);
  await ligneFacture.click(); await page.locator('.doc-actions-list').waitFor();
  boutons = (await page.locator('.doc-actions-list').innerText()).replace(/\s+/g, ' ');
  ok(/Télécharger la facture \(PDF\)/.test(boutons) && /Envoyer la facture sur WhatsApp/.test(boutons) && /Relancer par WhatsApp/.test(boutons) && !/imprimable/i.test(boutons),
    'fiche de la facture : Télécharger, Envoyer sur WhatsApp (PDF), Relancer — plus d’« imprimable »');
  ok(await selecteur(page) === 'Studio Vague [Sobre]', `modèle proposé : celui de la facture, pas celui de l’entreprise [${await selecteur(page)}]`);
  await page.locator('.doc-actions-list').screenshot({ path: '/tmp/claude-0/documents-pro-facture.png' });
  ok(onglets === ongletsAvant, `aucun onglet ouvert par les documents [${onglets - ongletsAvant}]`);
  await ctx.close();
}

// ---- 2. Téléphone : la facture part JOINTE, message de l'entreprise ----
for (const premierRefus of [false, true]) {
  const c = await nav.newContext({ viewport: { width: 412, height: 860 }, acceptDownloads: true });
  await c.addInitScript((refus) => {
    let refuse = refus;
    window.__partages = [];
    navigator.canShare = (x) => !!x?.files?.length;
    navigator.share = async (x) => {
      if (refuse) { refuse = false; throw new DOMException('activation expirée', 'NotAllowedError'); }
      const f = x.files[0];
      window.__partages.push({ nom: f.name, type: f.type, taille: f.size, texte: x.text });
    };
  }, premierRefus);
  const p = await c.newPage();
  p.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
  await ouvrirPro(p);
  if (!premierRefus) await p.locator('.flat-list').screenshot({ path: '/tmp/claude-0/documents-pro-liste-devis.png' });
  await ongletFactures(p);
  if (!premierRefus) await p.locator('.flat-list').screenshot({ path: '/tmp/claude-0/documents-pro-liste-factures.png' });
  await p.locator('.flat-row', { hasText: FACTURE }).click(); await p.locator('.doc-actions-list').waitFor();
  await p.locator('.doc-actions-list button', { hasText: 'Envoyer la facture sur WhatsApp' }).click();
  if (premierRefus) {
    const bouton = p.locator('.sheet', { hasText: 'Le PDF de la facture est prêt' }).locator('button:has-text("Envoyer sur WhatsApp")');
    await bouton.waitFor({ timeout: 30000 }).catch(() => {});
    ok(await bouton.isVisible(), 'toucher expiré : « Le PDF de la facture est prêt » et un bouton pour l’envoyer');
    await bouton.click().catch(() => {});
  }
  await p.waitForFunction(() => window.__partages.length > 0, null, { timeout: 30000 }).catch(() => {});
  const [partage] = await p.evaluate(() => window.__partages);
  ok(partage?.type === 'application/pdf' && partage.nom === `Facture-${FACTURE}-Felix-Sossa.pdf`
    && /ci-joint votre facture FAC-2026-015/.test(partage.texte) && /Mobile Money : \+228 90 11 22 33/.test(partage.texte) && /Lumière Sans Facture$/.test(partage.texte),
    `${premierRefus ? 'après un second toucher' : 'téléphone'} : facture jointe au partage, message de l’entreprise [${partage?.nom}, ${Math.round((partage?.taille || 0) / 1024)} Ko]`);
  if (!premierRefus) {
    const toast = await p.locator('.toast').last().innerText().catch(() => '');
    ok(/Facture partagée/.test(toast), `confirmation : « ${toast} »`);
  }
  await c.close();
}

// ---- 3. Application Android (simulée) : rangé dans Documents/BestaSolar ----
{
  const c = await nav.newContext({ viewport: { width: 412, height: 860 } });
  await c.addInitScript(() => { window.CapacitorCustomPlatform = { name: 'android', plugins: {} }; });
  const p = await c.newPage();
  p.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
  await ouvrirPro(p);
  await ongletFactures(p);
  await p.locator('.flat-row', { hasText: FACTURE }).locator('.flat-row-action').click();
  const toast = await p.locator('.toast', { hasText: 'Facture' }).first().innerText({ timeout: 30000 }).catch(() => '');
  ok(/Facture FAC-2026-015 enregistrée dans Documents\/BestaSolar\./.test(toast), `app : facture rangée dans Documents/BestaSolar [${toast}]`);
  await c.close();
}

// ---- 4. Assistant Pro, proposition par kit : la fiche présente le calcul ----
{
  const c = await nav.newContext({ viewport: { width: 1280, height: 950 }, acceptDownloads: true });
  // Les données remises au moteur de la fiche sont relevées au passage (le
  // PDF, lui, est une image).
  await c.route(/\/src\/utils\/sizingSheet\/pdf\.js/, async (route) => {
    const reponse = await route.fetch();
    const source = (await reponse.text()).replace(
      /export async function construireFichePdf\(data, options = \{\}\) \{/,
      '$&\n  window.__fiches = [...(window.__fiches || []), JSON.parse(JSON.stringify(data))];',
    );
    await route.fulfill({ response: reponse, body: source });
  });
  const p = await c.newPage();
  p.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
  await ouvrirPro(p);
  await p.locator('button:has-text("Nouveau devis")').first().click(); await p.waitForTimeout(600);
  await p.locator('.devis-mode-card.featured').click(); await p.waitForTimeout(800);
  await p.getByLabel('Nom complet *').fill('Client Kit Pro');
  const etape = () => p.locator('.wizard-actions .btn-primary').first();
  await etape().click(); await p.waitForTimeout(600);
  await p.locator('button:has-text("Saisie directe")').click();
  await p.locator('.manual-consumption-grid input').nth(0).fill('8');
  await p.locator('.manual-consumption-grid input').nth(1).fill('4');
  await etape().click(); await p.waitForTimeout(800);
  await etape().click(); await p.waitForTimeout(1500);
  const modeKit = await p.locator('.client-type-btn.active', { hasText: /kit/i }).count();
  const kitAffiche = await p.locator('.kit-option.selected, .kit-option.active').first().innerText().catch(() => '');
  const [fiche] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.locator('button:has-text("Fiche de dimensionnement")').first().click()]);
  const fp = await lirePdf(fiche);
  const [donnees] = await p.evaluate(() => window.__fiches || []);
  const calcul = donnees && {
    inverter: donnees.sizing.inverter ? { capacity: donnees.sizing.inverter.capacity, maxPvPower: donnees.sizing.inverter.maxPvPower || null, quantite: donnees.sizing.inverterQuantite } : null,
    batteries: donnees.sizing.batteries.map((b) => ({ capacity: b.capacity, qty: b.quantity })),
  };
  ok(modeKit > 0, `assistant en proposition par kit [${kitAffiche.split('\n')[0] || 'kit retenu'}]`);
  ok(fp.pdf && fp.pages === 3, `fiche téléchargée [${fp.nom}, ${fp.pages} pages]`);
  ok(!!donnees && JSON.stringify(donnees.inverter) === JSON.stringify(calcul.inverter) && JSON.stringify(donnees.batteries) === JSON.stringify(calcul.batteries),
    `fiche : onduleur et batteries du calcul [${donnees?.inverter?.capacity} kVA ; ${(donnees?.batteries || []).map((b) => `${b.qty} × ${b.capacity} kWh`).join(' + ')}]`);
  ok(!!donnees && !/du kit|kit /i.test(JSON.stringify({ i: donnees.inverter, b: donnees.batteries, p: donnees.panelName })), `aucune mention du kit dans le matériel de la fiche [${donnees?.panelName}]`);
  await c.close();
}

console.log(R.join('\n'));
await nav.close();
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : `\n✅ Documents Pro produits dans l’application (${R.length} vérifications)`);
process.exit(echecs ? 1 : 0);
