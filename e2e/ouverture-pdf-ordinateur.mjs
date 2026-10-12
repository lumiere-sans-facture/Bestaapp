/* Ordinateur : « Télécharger » enregistre le PDF ET l'ouvre dans un onglet
   (devis, facture, fiche de dimensionnement), comme l'application Android
   l'ouvre dans le lecteur du téléphone. Onglet bloqué par le navigateur (la
   préparation a duré trop longtemps) : la notification propose « Ouvrir ».
   Téléphone (navigateur sans lecteur PDF) : téléchargement seul, comme
   avant — un onglet y retéléchargerait le fichier. L'envoi WhatsApp sur
   ordinateur (PDF à joindre) n'ouvre pas d'onglet en plus.
   Serveur : npm run dev */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };
const DEVIS = 'BS-20261012-0003';
const FACTURE = 'FAC-2026-030';

// lecteurPdf : ce que le navigateur dit de lui (ordinateur : oui ; Chrome
// Android : non). bloquerPremier : le navigateur refuse le premier onglet.
const contexte = async ({ lecteurPdf = true, bloquerPremier = false, mobile = false } = {}) => {
  const c = await nav.newContext({ viewport: mobile ? { width: 412, height: 860 } : { width: 1280, height: 950 }, acceptDownloads: true });
  await c.addInitScript(({ lecteurPdf, bloquerPremier }) => {
    Object.defineProperty(Navigator.prototype, 'pdfViewerEnabled', { get: () => lecteurPdf, configurable: true });
    window.__onglets = [];
    const original = window.open.bind(window);
    let bloque = bloquerPremier;
    window.open = (url, ...reste) => {
      window.__onglets.push(String(url));
      if (bloque) { bloque = false; return null; }
      return original(url, ...reste);
    };
  }, { lecteurPdf, bloquerPremier });
  const p = await c.newPage();
  p.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
  return { c, p };
};

const ouvrirPro = async (p) => {
  await p.goto(B + '/privacy.html');
  await p.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
  await p.goto(B + '/dashboard'); await p.locator('.tab-bar:visible, .sidebar:visible').first().waitFor(); await p.waitForTimeout(1200);
  await p.goto(B + '/privacy.html');
  await p.evaluate(({ DEVIS, FACTURE }) => {
    const s = JSON.parse(localStorage.getItem('bestasolar_data'));
    const maintenant = new Date().toISOString();
    s.subscriptions = [{ id: 'sub-e2e', userId: 'u1', status: 'actif', formule: 'essentiel', dateDebut: maintenant, dateFin: new Date(Date.now() + 30 * 864e5).toISOString() }];
    s.companies = [{ id: 'comp-u1', userId: 'u1', facturePrefix: 'FAC', factureCounter: 30, modeleDefaut: 'studio', pays: 'tg', nomEntreprise: 'Lumière Sans Facture', telephone: '+228 79 98 02 09' }];
    const lignes = [{ designation: 'Panneau photovoltaïque 620 Wc', qty: 4, pu: 70000 }, { designation: 'Onduleur hybride 3 kVA', qty: 1, pu: 250000 }];
    s.devis = [{ id: crypto.randomUUID(), type: 'pro', pro: true, devisNumber: DEVIS, createdAt: maintenant, createdBy: 'u1',
      clientName: 'Felix Sossa', clientPhone: '+228 90 00 00 00', lignes, subtotal: 530000, tvaActive: false, tva: 0, total: 530000, statut: 'finalise' },
      ...(s.devis || []).filter((d) => d.devisNumber !== DEVIS)];
    s.factures = [{ id: crypto.randomUUID(), userId: 'u1', numero: FACTURE, clientName: 'Felix Sossa', clientPhone: '+228 90 00 00 00',
      lignes, tvaActive: false, totalHT: 530000, tva: 0, totalTTC: 530000, statut: 'emise', createdAt: maintenant }];
    localStorage.setItem('bestasolar_data', JSON.stringify(s));
    localStorage.setItem('bestasolar_mode_u1', 'pro');
  }, { DEVIS, FACTURE });
  await p.goto(B + '/pro/documents');
  await p.locator('.flat-row', { hasText: DEVIS }).waitFor({ timeout: 15000 });
};
// Un clic : le fichier téléchargé, et l'onglet ouvert (ou non) sur le PDF.
const telechargerEtOuvrir = async (c, p, clic) => {
  const onglet = c.waitForEvent('page', { timeout: 30000 }).catch(() => null);
  const [fichier] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), clic()]);
  // L'onglet suit le téléchargement de près : 3 s au plus, ensuite il n'y en a pas.
  const page = await Promise.race([onglet, new Promise((ok) => { setTimeout(() => ok(null), 3000); })]);
  return { nom: fichier.suggestedFilename(), onglet: page ? page.url() : null };
};

// ---- 1. Ordinateur : devis, facture, fiche — téléchargés ET ouverts ----
{
  const { c, p } = await contexte();
  await ouvrirPro(p);
  let r = await telechargerEtOuvrir(c, p, () => p.locator('.flat-row', { hasText: DEVIS }).locator('.flat-row-action').click());
  ok(/^Devis-BS-20261012-0003.*\.pdf$/.test(r.nom) && /^blob:http:\/\/localhost:3000\//.test(r.onglet || ''), `devis : téléchargé et ouvert dans un onglet [${r.nom} · ${r.onglet?.slice(0, 32)}…]`);
  await p.getByRole('button', { name: /Factures \(1\)/ }).click();
  r = await telechargerEtOuvrir(c, p, () => p.locator('.flat-row', { hasText: FACTURE }).locator('.flat-row-action').click());
  ok(/^Facture-FAC-2026-030.*\.pdf$/.test(r.nom) && /^blob:/.test(r.onglet || ''), `facture : téléchargée et ouverte [${r.nom}]`);
  // Fiche de dimensionnement de l'assistant Pro.
  await p.getByRole('button', { name: /Devis \(/ }).first().click().catch(() => {});
  await p.locator('button:has-text("Nouveau devis")').first().click(); await p.waitForTimeout(600);
  await p.locator('.devis-mode-card.featured').click(); await p.waitForTimeout(800);
  await p.getByLabel('Nom complet *').fill('Client Fiche');
  const etape = () => p.locator('.wizard-actions .btn-primary').first();
  await etape().click(); await p.waitForTimeout(600);
  await p.locator('button:has-text("Saisie directe")').click();
  await p.locator('.manual-consumption-grid input').nth(0).fill('8');
  await p.locator('.manual-consumption-grid input').nth(1).fill('4');
  await etape().click(); await p.waitForTimeout(800);
  await etape().click(); await p.waitForTimeout(1500);
  r = await telechargerEtOuvrir(c, p, () => p.locator('button:has-text("Fiche de dimensionnement")').first().click());
  ok(/^Fiche-dimensionnement.*\.pdf$/.test(r.nom) && /^blob:/.test(r.onglet || ''), `fiche de dimensionnement : téléchargée et ouverte [${r.nom}]`);
  await c.close();
}

// ---- 2. Onglet bloqué par le navigateur : « Ouvrir » dans la notification ----
{
  const { c, p } = await contexte({ bloquerPremier: true });
  await ouvrirPro(p);
  const r = await telechargerEtOuvrir(c, p, () => p.locator('.flat-row', { hasText: DEVIS }).locator('.flat-row-action').click());
  ok(r.onglet === null, 'onglet refusé par le navigateur : le fichier est quand même téléchargé');
  const bouton = p.locator('.toast', { hasText: 'Devis' }).getByRole('button', { name: 'Ouvrir' });
  await bouton.waitFor({ timeout: 5000 }).catch(() => {});
  ok(await bouton.isVisible().catch(() => false), `la notification propose « Ouvrir » [${(await p.locator('.toast').allInnerTexts()).join(' | ')} ; onglets demandés : ${(await p.evaluate(() => window.__onglets.length))}]`);
  await p.locator('.toast').first().screenshot({ path: '/tmp/claude-0/notification-ouvrir.png' }).catch(() => {});
  const [onglet] = await Promise.all([c.waitForEvent('page', { timeout: 10000 }).catch(() => null), bouton.click({ timeout: 5000 }).catch(() => {})]);
  ok(/^blob:/.test(onglet?.url() || ''), `« Ouvrir » : le PDF s'ouvre [${onglet?.url().slice(0, 32)}…]`);
  await c.close();
}

// ---- 3. Téléphone, navigateur sans lecteur PDF : téléchargement seul ----
{
  const { c, p } = await contexte({ lecteurPdf: false, mobile: true });
  await ouvrirPro(p);
  const r = await telechargerEtOuvrir(c, p, () => p.locator('.flat-row', { hasText: DEVIS }).locator('.flat-row-action').click());
  ok(/\.pdf$/.test(r.nom) && r.onglet === null && (await p.evaluate(() => window.__onglets.length)) === 0, 'téléphone : PDF téléchargé, aucun onglet (il serait retéléchargé)');
  ok(!(await p.locator('.toast-action').count()), 'téléphone : pas de bouton « Ouvrir »');
  await c.close();
}

// ---- 4. Ordinateur, envoi WhatsApp (PDF à joindre) : pas d'onglet en plus ----
{
  const { c, p } = await contexte();
  await ouvrirPro(p);
  await p.locator('.flat-row', { hasText: DEVIS }).click(); await p.locator('.doc-actions-list').waitFor();
  await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.locator('.doc-actions-list button', { hasText: 'Envoyer le devis sur WhatsApp' }).click()]);
  await p.waitForTimeout(500);
  ok((await p.evaluate(() => window.__onglets.length)) === 0 && await p.locator('a:has-text("Ouvrir WhatsApp")').isVisible(),
    'envoi WhatsApp sur ordinateur : PDF à joindre, aucun onglet PDF ouvert');
  await c.close();
}

await nav.close();
console.log(R.join('\n'));
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : `\n✅ Ordinateur : PDF téléchargé et ouvert (${R.length} vérifications)`);
process.exit(echecs ? 1 : 0);
