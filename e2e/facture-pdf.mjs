/* Facture à acomptes imprimée (espace Pro) — l'exemple de référence :
   9 lignes, 66 876 000 F, acompte de 11 000 000 F reçu, complément attendu
   cette semaine, solde à la mise en service. Pour chacun des trois modèles,
   l'aperçu dans l'application montre « Arrêtée la présente facture… », le
   reste à payer (55 876 000 F), l'échéancier et ses statuts, les modes de
   paiement, le signataire, la CNSS ; aucune page ne déborde, et la dernière
   porte au moins une ligne avec les totaux ; le PDF a autant de pages.
   Puis le reçu du paiement (une page) et son envoi, et l'aperçu de
   « Mon entreprise ». Noms fictifs. Lancer `npm run dev` à côté. */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };
const NUMERO = 'FAC-2026-016';
const sansEspaces = (t) => t.replace(/[\s  ]+/g, ' ');
const jour = (decalage) => {
  const d = new Date(); d.setDate(d.getDate() + decalage);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const lirePdf = async (telechargement) => {
  const texte = readFileSync(await telechargement.path()).toString('latin1');
  return { nom: telechargement.suggestedFilename(), pdf: texte.startsWith('%PDF'), pages: (texte.match(/\/Type\s*\/Page[^s]/g) || []).length };
};
const CACHET = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGP4z8DwnwEJMMIBAgBEgQb+/vHvPgAAAABJRU5ErkJggg==';
const LIGNES = [
  ['Panneaux solaires monocristallins 585 Wc', 262, 76000], ['Onduleur hybride triphasé 125 kW', 1, 9000000],
  ['Batterie lithium (LiFePO4) 241 kWh', 1, 24000000], ['Câbles AC / DC et protections', 1, 4436000],
  ['Équipements électriques et tableauterie', 1, 4069000], ['Protection parafoudre', 1, 2388000],
  ['Structure et fixation des panneaux', 1, 1502000], ['Main d’œuvre (installation et mise en service)', 1, 1228000],
  ['Transport et logistique', 1, 341000],
].map(([designation, qty, pu]) => ({ designation, qty, pu }));

const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
await page.goto(B + '/privacy.html');
await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
await page.goto(B + '/dashboard'); await page.locator('.tab-bar:visible, .sidebar:visible').first().waitFor(); await page.waitForTimeout(1200);
await page.goto(B + '/privacy.html');
await page.evaluate(({ NUMERO, LIGNES, CACHET, j }) => {
  const s = JSON.parse(localStorage.getItem('bestasolar_data'));
  const maintenant = new Date().toISOString();
  s.subscriptions = [{ id: 'sub-e2e', userId: 'u1', status: 'actif', formule: 'essentiel', dateDebut: maintenant, dateFin: new Date(Date.now() + 30 * 864e5).toISOString() }];
  s.companies = [{
    id: 'comp-u1', userId: 'u1', facturePrefix: 'FAC', factureCounter: 16, modeleDefaut: 'studio', pays: 'tg',
    nomEntreprise: 'Lumière Sans Facture', telephone: '+228 79 98 02 09', email: 'contact@exemple.tg', adresse: 'Lomé — Togo',
    rccm: 'TG-LFW-01-2025-A10-01086', ifu: '1002023475', cnss: '180065-E2E',
    banque: 'Banque Démo', compteBancaire: 'TG116 0001 0002', momo: '+228 90 00 00 00', momoOperateur: 'Flooz (Moov Africa)',
    modesPaiement: ['Virement bancaire', 'Flooz (Moov Africa)', 'Espèces'], mentionFiscale: 'Entreprise non assujettie à la TVA — montants nets.',
    signataireTitre: 'Le Directeur Général', signataireNom: 'Prénom Nom', cachet: CACHET,
  }];
  s.factures = [{
    id: 'f1', userId: 'u1', numero: NUMERO, clientName: 'Client Démo SARL', clientPhone: '+228 90 00 00 00', clientVille: 'Lomé',
    lignes: LIGNES, tvaActive: false, totalHT: 66876000, tva: 0, totalTTC: 66876000, statut: 'emise', createdAt: new Date(Date.now() - 30 * 864e5).toISOString(),
    echeance: j.fin, objet: 'Fourniture et installation d’une centrale solaire hybride',
    echeancier: [
      { id: 'e1', libelle: 'Acompte', type: 'date', date: j.acompte, montant: 11000000 },
      { id: 'e2', libelle: 'Complément d’acompte', type: 'periode', date: j.debut, dateFin: j.fin, montant: 30000000 },
      { id: 'e3', libelle: 'Solde', type: 'condition', condition: 'À la réception / mise en service', montant: 25876000 },
    ],
    montantPaye: 11000000,
  }];
  s.facturePaiements = [{ id: 'p1', factureId: 'f1', userId: 'u1', montant: 11000000, date: j.acompte, mode: 'virement', reference: 'VIR-0001', createdAt: maintenant, majLe: maintenant }];
  localStorage.setItem('bestasolar_data', JSON.stringify(s));
  localStorage.setItem('bestasolar_mode_u1', 'pro');
}, { NUMERO, LIGNES, CACHET, j: { acompte: jour(-28), debut: jour(-2), fin: jour(2) } });
// Chaque étape repart de la liste : sur ordinateur, « Télécharger » ouvre
// aussi le PDF dans un onglet, et la fiche restée ouverte masquerait la liste.
const ligne = page.locator('.flat-row', { hasText: NUMERO });
const ouvrirFactures = async () => {
  await page.bringToFront();
  await page.goto(B + '/pro/documents');
  await page.getByRole('button', { name: /Factures \(1\)/ }).click({ timeout: 15000 });
  await ligne.waitFor();
};

for (const [modele, libelle] of [['studio', 'Studio'], ['vague', 'Vague'], ['sobre', 'Sobre']]) {
  await ouvrirFactures();
  await ligne.click();
  await page.locator('[aria-labelledby="doc-modele-label"] .segmented-btn', { hasText: libelle }).click();
  await page.getByRole('button', { name: 'Aperçu de la facture' }).click();
  const cadre = page.frameLocator('.apercu-doc-cadre');
  await cadre.locator('.page').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  const m = await page.locator('.apercu-doc-cadre').evaluate(async (f) => {
    const d = f.contentDocument;
    await d.fonts.ready;
    const pages = [...d.querySelectorAll('.page')];
    return {
      pages: pages.length,
      debordements: pages.map((p) => p.scrollHeight - p.clientHeight),
      lignesParPage: pages.map((p) => (p.classList.contains('page-fin') ? 'fin' : p.querySelectorAll('table.lignes tbody tr').length)),
      texte: d.body.innerText,
      images: [...d.querySelectorAll('img')].filter((i) => i.src.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQ')).length,
      statuts: [...d.querySelectorAll('.statut')].map((x) => x.textContent.trim()),
    };
  });
  const texte = sansEspaces(m.texte);
  const derniere = [...m.lignesParPage].reverse().find((x) => x !== 'fin');
  ok(m.debordements.every((x) => x <= 0), `${libelle} : aucune page ne déborde [${m.pages} page(s), lignes ${m.lignesParPage.join(' + ')}]`);
  ok(derniere >= 1, `${libelle} : la dernière page porte des lignes avec les totaux, jamais seuls`);
  ok(/Arrêtée la présente facture à la somme de SOIXANTE-SIX MILLIONS HUIT CENT SOIXANTE-SEIZE MILLE \(66 876 000\) FRANCS CFA/i.test(texte)
    && /reste à payer : CINQUANTE-CINQ MILLIONS HUIT CENT SOIXANTE-SEIZE MILLE \(55 876 000\) FRANCS CFA/i.test(texte),
  `${libelle} : total et reste en toutes lettres`);
  ok(/Acompte versé le \d\d\/\d\d\/\d{4}/.test(texte) && /RESTE À PAYER/i.test(texte) && /55 876 000/.test(texte), `${libelle} : acompte déduit, reste à payer 55 876 000`);
  ok(m.statuts.join('|') === 'Reçu|Attendu|À venir', `${libelle} : échéancier ${m.statuts.join(' · ')}`);
  ok(/Banque Démo — compte TG116 0001 0002/.test(texte) && /Flooz \(Moov Africa\)/.test(texte) && /Le Directeur Général/i.test(texte) && /Prénom Nom/.test(texte),
    `${libelle} : modes de paiement et signataire`);
  ok(/CNSS 180065-E2E/.test(texte) && /non assujettie à la TVA/.test(texte), `${libelle} : CNSS et mention fiscale`);
  ok(modele === 'sobre' ? m.images === 0 : m.images === 1, `${libelle} : ${modele === 'sobre' ? 'aucune image (noir et blanc)' : 'signature et cachet imprimés'}`);
  // Retour, puis le PDF : autant de pages que l'aperçu.
  await page.getByRole('button', { name: /Retour/ }).first().click();
  await page.waitForTimeout(300);
  if (!(await page.getByRole('button', { name: 'Télécharger la facture (PDF)' }).isVisible().catch(() => false))) await ligne.click();
  const [pdf] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByRole('button', { name: 'Télécharger la facture (PDF)' }).click()]);
  const lu = await lirePdf(pdf);
  ok(lu.pdf && lu.pages === m.pages, `${libelle} : PDF de ${lu.pages} page(s), comme l’aperçu [${lu.nom}]`);
}

// Reçu du paiement : une page, numéroté, et son envoi.
await ouvrirFactures();
await ligne.click();
await page.getByRole('button', { name: /Voir les paiements|Enregistrer un paiement/ }).click();
await page.locator('.pay-history-item').first().waitFor();
const [recu] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByRole('button', { name: /Reçu du paiement du/ }).click()]);
const lu = await lirePdf(recu);
ok(lu.pdf && lu.pages === 1 && lu.nom === `Recu-${NUMERO}-R1-Client-Demo-SARL.pdf`, `reçu du paiement : PDF d’une page [${lu.nom}]`);
await page.waitForTimeout(500);
const [pourEnvoi] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }).catch(() => null), page.getByRole('button', { name: /Envoyer le reçu du/ }).click()]);
await page.waitForTimeout(800);
const feuille = await page.locator('[role="dialog"]:visible .sheet-title').allInnerTexts();
ok((pourEnvoi && feuille.includes('Envoyer le reçu')) || feuille.includes('Envoyer le reçu'), `envoi du reçu : prêt à joindre dans WhatsApp [${feuille.join(' | ')}]`);
// Aperçu de « Mon entreprise » : la facture d'exemple montre les réglages.
await page.bringToFront();
await page.goto(B + '/pro/entreprise');
await page.getByRole('button', { name: 'Voir un aperçu du document' }).click({ timeout: 15000 });
await page.frameLocator('.apercu-doc-cadre').locator('.page').first().waitFor({ timeout: 15000 });
const apercu = sansEspaces(await page.locator('.apercu-doc-cadre').evaluate((f) => f.contentDocument.body.innerText));
ok(/Arrêtée la présente facture/.test(apercu) && /Banque Démo/.test(apercu) && /Le Directeur Général/i.test(apercu) && /Échéancier de paiement/i.test(apercu),
  'aperçu de « Mon entreprise » : montant en lettres, échéancier, modes de paiement et signataire');

console.log(R.join('\n'));
await nav.close();
process.exit(R.some((l) => l.startsWith('❌')) ? 1 : 0);
