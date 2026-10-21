/* Factures à acomptes (espace Pro) : un devis converti en facture avec son
   échéancier en trois tranches, un acompte enregistré, le reste à payer et
   le statut de chaque échéance ; correction, suppression, trop-perçu à
   confirmer ; échéancier incohérent refusé à l'enregistrement ; facture
   annulée puis rétablie ; anciens paiements rangés dans la facture repris
   dans la collection ; réglages « Mon entreprise » de la facture.
   Montants de l'exemple de référence (66 876 000 F, acompte 11 000 000 F),
   noms fictifs. Lancer `npm run dev` à côté. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };
const DEVIS = 'BS-20260920-0007';
const ANCIENNE = 'FAC-2026-015';
const NOUVELLE = 'FAC-2026-016';
const sansEspaces = (t) => t.replace(/[\s  ]+/g, ' ');

// Jours relatifs à aujourd'hui : statuts déterministes quel que soit le jour du test.
const jour = (decalage) => {
  const d = new Date(); d.setDate(d.getDate() + decalage);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const LIGNES = [
  ['Panneaux solaires monocristallins 585 Wc', 262, 76000],
  ['Onduleur hybride triphasé 125 kW', 1, 9000000],
  ['Batterie lithium (LiFePO4) 241 kWh', 1, 24000000],
  ['Câbles AC / DC et protections', 1, 4436000],
  ['Équipements électriques et tableauterie', 1, 4069000],
  ['Protection parafoudre', 1, 2388000],
  ['Structure et fixation des panneaux', 1, 1502000],
  ['Main d’œuvre (installation et mise en service)', 1, 1228000],
  ['Transport et logistique', 1, 341000],
].map(([designation, qty, pu]) => ({ designation, qty, pu }));

const etat = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('bestasolar_data')));
const attendreEtat = (p, test, arg) => p.waitForFunction(test, arg, { timeout: 5000 }).catch(() => {});

const ouvrirPro = async (p) => {
  await p.goto(B + '/privacy.html');
  await p.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
  await p.goto(B + '/dashboard'); await p.locator('.tab-bar:visible, .sidebar:visible').first().waitFor(); await p.waitForTimeout(1200);
  await p.goto(B + '/privacy.html');
  await p.evaluate(({ DEVIS, ANCIENNE, LIGNES }) => {
    const s = JSON.parse(localStorage.getItem('bestasolar_data'));
    const maintenant = new Date().toISOString();
    s.subscriptions = [{ id: 'sub-e2e', userId: 'u1', status: 'actif', formule: 'essentiel', dateDebut: maintenant, dateFin: new Date(Date.now() + 30 * 864e5).toISOString() }];
    s.companies = [{
      id: 'comp-u1', userId: 'u1', facturePrefix: 'FAC', factureCounter: 15, modeleDefaut: 'studio', pays: 'tg',
      nomEntreprise: 'Lumière Sans Facture', telephone: '+228 79 98 02 09', email: 'contact@exemple.tg', adresse: 'Lomé — Togo',
    }];
    s.devis = [{
      id: crypto.randomUUID(), type: 'pro', pro: true, devisNumber: DEVIS, createdAt: maintenant, createdBy: 'u1',
      clientName: 'Client Démo SARL', clientPhone: '+228 90 00 00 00', clientVille: 'Lomé', lignes: LIGNES,
      subtotal: 66876000, tvaActive: false, tva: 0, total: 66876000, statut: 'finalise',
    }];
    // Facture d'une version précédente : son paiement est rangé DANS la facture.
    s.factures = [{
      id: 'f-ancienne', userId: 'u1', numero: ANCIENNE, clientName: 'Client Ancien', clientPhone: '', lignes: [{ designation: 'Kit solaire', qty: 1, pu: 500000 }],
      tvaActive: false, totalHT: 500000, tva: 0, totalTTC: 500000, statut: 'emise', createdAt: maintenant,
      echeance: new Date(Date.now() + 30 * 864e5).toISOString(),
      paiements: [{ id: 'ancien-p1', montant: 100000, mode: 'momo', note: 'acompte', date: maintenant }], montantPaye: 100000,
    }];
    s.facturePaiements = [];
    localStorage.setItem('bestasolar_data', JSON.stringify(s));
    localStorage.setItem('bestasolar_mode_u1', 'pro');
  }, { DEVIS, ANCIENNE, LIGNES });
  await p.goto(B + '/pro/documents');
  await p.locator('.flat-row', { hasText: DEVIS }).waitFor({ timeout: 15000 });
};

const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
await ouvrirPro(page);
const dialogue = () => page.locator('[role="dialog"]:visible').last();

// ---- 0. Ancien paiement repris dans la collection ----
await attendreEtat(page, () => (JSON.parse(localStorage.getItem('bestasolar_data')).facturePaiements || []).length > 0);
let s = await etat(page);
const repris = (s.facturePaiements || []).find((p) => p.id === 'ancien-p1');
ok(repris && repris.factureId === 'f-ancienne' && repris.montant === 100000 && /^\d{4}-\d{2}-\d{2}$/.test(repris.date),
  `ancien paiement recopié une fois dans la collection [${JSON.stringify(repris && { f: repris.factureId, m: repris.montant, d: repris.date })}]`);

// ---- 1. Conversion du devis : objet et échéancier en trois tranches ----
await page.locator('.flat-row', { hasText: DEVIS }).click();
await page.getByRole('button', { name: 'Convertir en facture' }).click();
await page.locator('.sheet-title', { hasText: 'Facturer ' + DEVIS }).waitFor();
const objet = await dialogue().locator('textarea').inputValue();
ok(/centrale solaire hybride : 262 panneaux 585.Wc \(≈.153.kWc\), onduleur hybride triphasé 125 kW, stockage lithium 241.kWh/.test(objet),
  `objet pré-rempli depuis le devis [${objet}]`);
await dialogue().getByRole('button', { name: 'Appliquer' }).click();
const lignesEch = dialogue().locator('.echeance-ligne');
ok(await lignesEch.count() === 3, `modèle 3 tranches : ${await lignesEch.count()} échéances`);
await lignesEch.nth(0).getByLabel('Montant (F CFA)').fill('11000000');
await lignesEch.nth(0).getByLabel('Date', { exact: true }).fill(jour(-28));
const creer = dialogue().getByRole('button', { name: 'Créer la facture' });
ok(await creer.isDisabled(), 'tant que l’échéancier n’égale pas le total, la facture ne se crée pas');
ok(/Il manque/.test(await dialogue().locator('.echeancier-total').innerText()), 'l’écart est annoncé');
await lignesEch.nth(1).locator('select').first().selectOption('periode');
await lignesEch.nth(1).getByLabel('Du', { exact: true }).fill(jour(-2));
await lignesEch.nth(1).getByLabel('Au', { exact: true }).fill(jour(2));
await lignesEch.nth(1).getByLabel('Montant (F CFA)').fill('30000000');
await lignesEch.nth(2).getByLabel('Montant (F CFA)').fill('25876000');
ok(await creer.isEnabled(), 'échéancier égal au total : création possible');
await creer.click();
await page.getByRole('button', { name: /Factures \(2\)/ }).click();
const ligneNouvelle = page.locator('.flat-row', { hasText: NOUVELLE });
await ligneNouvelle.waitFor();
await attendreEtat(page, (n) => JSON.parse(localStorage.getItem('bestasolar_data')).factures.some((f) => f.numero === n), NOUVELLE);
s = await etat(page);
const fac = s.factures.find((f) => f.numero === NOUVELLE);
ok(fac && fac.echeancier.length === 3 && fac.echeancier.reduce((t, e) => t + e.montant, 0) === 66876000 && fac.objet === objet,
  'facture enregistrée avec son objet et ses trois échéances');

// ---- 2. Paiement de l'acompte ----
await ligneNouvelle.click();
await page.getByRole('button', { name: 'Enregistrer un paiement' }).click();
await dialogue().getByText('Paiements — ' + NOUVELLE).waitFor();
const montant = dialogue().getByLabel('Montant reçu (F CFA) *');
ok(await montant.inputValue() === '11000000', `montant pré-rempli avec la prochaine échéance [${await montant.inputValue()}]`);
await dialogue().getByLabel('Date du paiement').fill(jour(-28));
await dialogue().getByLabel('Mode').selectOption('virement');
await dialogue().getByLabel('Référence (facultatif)').fill('VIR-0001');
await dialogue().getByRole('button', { name: 'Enregistrer le paiement' }).click();
await dialogue().locator('.pay-history-item').first().waitFor();
let texte = sansEspaces(await dialogue().innerText());
ok(/Reste à payer 55 876 000 F/.test(texte), 'reste à payer : 55 876 000 F');
ok(/16 % payé/.test(texte), 'barre de progression : 16 % payé');
const statuts = await dialogue().locator('.pay-echeance-row .flat-badge').allInnerTexts();
ok(statuts.join('|') === 'Reçu|Attendu|À venir', `statuts des échéances : ${statuts.join(' · ')}`);
ok(/VIR-0001/.test(texte) && /Virement bancaire/.test(texte), 'paiement listé avec son mode et sa référence');
ok(await montant.inputValue() === '30000000', `saisie suivante pré-remplie avec le complément [${await montant.inputValue()}]`);

// Trop-perçu : à confirmer, jamais silencieux.
await montant.fill('60000000');
const enregistrer = dialogue().getByRole('button', { name: 'Enregistrer le paiement' });
ok(await enregistrer.isDisabled() && /dépasse le reste dû de 4 124 000 F/.test(sansEspaces(await dialogue().innerText())),
  'au-delà du reste : trop-perçu annoncé, enregistrement bloqué tant qu’il n’est pas confirmé');
await dialogue().locator('.pay-trop input').check();
ok(await enregistrer.isEnabled(), 'confirmé, le trop-perçu peut s’enregistrer');
await montant.fill('1000');
await enregistrer.click();
await page.waitForTimeout(400);
ok(await dialogue().locator('.pay-history-item').count() === 2, 'second paiement enregistré');

// Correction puis suppression.
await dialogue().locator('.pay-history-item').first().getByRole('button', { name: /Modifier le paiement/ }).click();
await montant.fill('2000');
await dialogue().getByRole('button', { name: 'Enregistrer la correction' }).click();
await page.waitForTimeout(300);
ok(/2 000 F/.test(sansEspaces(await dialogue().locator('.pay-history-item').first().innerText())), 'paiement corrigé (1 000 → 2 000 F)');
await dialogue().locator('.pay-history-item').first().getByRole('button', { name: /Supprimer le paiement/ }).click();
await dialogue().getByRole('button', { name: 'Supprimer', exact: true }).click();
await page.waitForTimeout(300);
ok(await dialogue().locator('.pay-history-item').count() === 1, 'paiement supprimé');
await attendreEtat(page, (n) => {
  const st = JSON.parse(localStorage.getItem('bestasolar_data'));
  const f = st.factures.find((x) => x.numero === n);
  return st.facturePaiements.filter((p) => p.factureId === f.id).length === 1;
}, NOUVELLE);
s = await etat(page);
const facApres = s.factures.find((f) => f.numero === NOUVELLE);
const sesPaiements = s.facturePaiements.filter((p) => p.factureId === facApres.id);
ok(sesPaiements.length === 1 && sesPaiements[0].montant === 11000000 && sesPaiements[0].date === jour(-28) && sesPaiements[0].reference === 'VIR-0001'
  && !facApres.paiements && facApres.montantPaye === 11000000 && facApres.statut === 'emise',
  'stockage : un paiement dans la collection, rien dans la facture, montant encaissé tenu à jour');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

// ---- 3. Liste : payé, reste, filtres ----
const sous = sansEspaces(await ligneNouvelle.innerText());
ok(/Payé 11 000 000 F · reste 55 876 000 F/.test(sous), `ligne de la liste : payé et reste [${sous.split('\n')[1] || sous}]`);
const ancienne = sansEspaces(await page.locator('.flat-row', { hasText: ANCIENNE }).innerText());
ok(/Payé 100 000 F · reste 400 000 F/.test(ancienne), 'ancienne facture : son paiement repris compte toujours');
await page.locator('.category-chip', { hasText: 'Impayées' }).click();
ok(await page.locator('.flat-row', { hasText: NOUVELLE }).count() === 1, 'filtre « Impayées » : la facture y est');

// ---- 4. Échéancier incohérent refusé à l'enregistrement ----
await ligneNouvelle.click();
await page.getByRole('button', { name: 'Modifier la facture' }).click();
await dialogue().getByText('Modifier ' + NOUVELLE).waitFor();
await dialogue().locator('.echeance-ligne').nth(2).getByLabel('Montant (F CFA)').fill('20000000');
await dialogue().getByRole('button', { name: 'Enregistrer les modifications' }).click();
const alerte = dialogue().getByRole('alert');
ok(await alerte.isVisible() && /il manque 5 876 000 F/.test(sansEspaces(await alerte.innerText())), 'échéancier incohérent : enregistrement refusé, écart annoncé');
await dialogue().getByRole('button', { name: 'Ajuster la dernière échéance' }).click();
await dialogue().getByRole('button', { name: 'Enregistrer les modifications' }).click();
await page.waitForTimeout(400);
ok(!(await page.locator('[role="dialog"]:visible').count()), 'ajusté, l’échéancier s’enregistre');

// ---- 5. Annuler puis rétablir ----
await page.locator('.category-chip', { hasText: 'Tous' }).click();
await ligneNouvelle.click();
await page.getByRole('button', { name: 'Annuler la facture' }).click();
await dialogue().getByRole('button', { name: 'Annuler la facture' }).click();
await page.waitForTimeout(300);
await page.locator('.category-chip', { hasText: 'Annulées' }).click();
ok(await page.locator('.flat-row', { hasText: NOUVELLE }).count() === 1, 'facture annulée : rangée dans « Annulées »');
await page.locator('.category-chip', { hasText: 'Impayées' }).click();
ok(await page.locator('.flat-row', { hasText: NOUVELLE }).count() === 0, '… et sortie des impayées');
await page.locator('.category-chip', { hasText: 'Annulées' }).click();
await ligneNouvelle.click();
await page.getByRole('button', { name: 'Rétablir la facture' }).click();
await attendreEtat(page, (n) => JSON.parse(localStorage.getItem('bestasolar_data')).factures.find((f) => f.numero === n).statut !== 'annulee', NOUVELLE);
s = await etat(page);
ok(s.factures.find((f) => f.numero === NOUVELLE).statut === 'emise', 'rétablie : de nouveau émise, paiements intacts');

// ---- 6. Mon entreprise : réglages de la facture ----
await page.goto(B + '/pro/entreprise');
await page.getByLabel('CNSS (optionnel)').waitFor({ timeout: 10000 });
await page.getByLabel('CNSS (optionnel)').fill('180065-E2E');
await page.getByLabel('Mention fiscale (sous les totaux de la facture)').selectOption('non-assujettie');
await page.getByLabel('Banque (virement)').fill('Banque Démo');
const modes = await page.locator('[aria-labelledby="company-modes-label"] .checkbox-row').allInnerTexts();
ok(modes.join('|').includes('Virement bancaire') && modes.some((m) => /T-Money|Flooz|Mixx/.test(m)), `modes de paiement proposés pour le Togo : ${modes.join(', ')}`);
// Rien de choisi : les modes suivent les champs remplis (banque → virement).
const caseMode = (nom) => page.locator('[aria-labelledby="company-modes-label"] .checkbox-row', { hasText: nom }).locator('input');
ok(await caseMode('Virement bancaire').isChecked() && !(await caseMode('Espèces').isChecked()), 'banque saisie : « Virement bancaire » coché d’office');
await caseMode('Espèces').check();
await page.getByLabel('Titre').fill('Le Directeur Général');
await page.getByLabel('Nom', { exact: true }).fill('Prénom Nom');
// Signature et cachet : une image PNG, gardée en data URL.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGP4z8DwnwEJMMIBAgBEgQb+/vHvPgAAAABJRU5ErkJggg==', 'base64');
await page.getByLabel('Image de la signature et du cachet').setInputFiles({ name: 'cachet.png', mimeType: 'image/png', buffer: PNG });
await page.locator('.cachet-preview img').waitFor({ timeout: 5000 }).catch(() => {});
ok(await page.locator('.cachet-preview img').count() === 1, 'image de signature et cachet ajoutée, aperçu affiché');
await page.getByRole('button', { name: /Enregistrer/ }).first().click();
await attendreEtat(page, () => JSON.parse(localStorage.getItem('bestasolar_data')).companies.find((c) => c.id === 'comp-u1').cnss === '180065-E2E');
s = await etat(page);
const comp = s.companies.find((c) => c.id === 'comp-u1');
ok(comp.cnss === '180065-E2E' && /non assujettie/.test(comp.mentionFiscale) && comp.banque === 'Banque Démo'
  && comp.modesPaiement?.join('|') === 'Virement bancaire|Espèces' && comp.signataireTitre === 'Le Directeur Général' && /^data:image\//.test(comp.cachet || ''),
  'réglages enregistrés : CNSS, mention fiscale, banque, modes de paiement, signataire, cachet');

// ---- 7. Mobile : la fiche des paiements tient dans l'écran ----
const mob = await nav.newContext({ viewport: { width: 390, height: 844 } });
const m = await mob.newPage();
m.on('pageerror', (e) => R.push('❌ ERREUR JS (mobile) : ' + e));
await m.goto(B + '/privacy.html');
await m.evaluate((st) => { localStorage.setItem('bestasolar_user', JSON.stringify({ id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' })); localStorage.setItem('bestasolar_data', st); localStorage.setItem('bestasolar_mode_u1', 'pro'); }, JSON.stringify(s));
await m.goto(B + '/pro/documents');
await m.getByRole('button', { name: /Factures \(2\)/ }).click();
await m.locator('.flat-row', { hasText: NOUVELLE }).click();
await m.getByRole('button', { name: 'Enregistrer un paiement' }).click();
await m.locator('.pay-echeance-row').first().waitFor();
await m.waitForTimeout(500); // fin de l'animation d'ouverture
const debord = await m.evaluate(() => Math.max(...[...document.querySelectorAll('[role="dialog"]')].map((d) => d.scrollWidth - d.clientWidth)));
ok(debord <= 0, `mobile : aucun débordement horizontal dans la fiche (${debord}px)`);
await m.screenshot({ path: process.env.CAPTURE || '/tmp/facture-acomptes-mobile.png' });

console.log(R.join('\n'));
await nav.close();
process.exit(R.some((l) => l.startsWith('❌')) ? 1 : 0);
