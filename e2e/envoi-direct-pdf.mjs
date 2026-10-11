/* Application Android : « Envoyer sur WhatsApp » part DIRECTEMENT dans la
   conversation du client (comme la relance), PDF et message joints — sans
   menu de partage ni recherche du contact ; « Télécharger » enregistre le PDF
   dans Documents/BestaSolar ET l'ouvre aussitôt (devis, facture, fiche de
   dimensionnement). Sans WhatsApp sur le téléphone : menu de partage, comme
   avant. Le module natif (FichiersNatifsPlugin.java) est simulé : on relève
   ce que l'app lui demande.
   Serveur : npm run dev */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const R = []; const ok = (c, m) => { R.push(`${c ? '✓ ' : '❌'} ${m}`); return c; };
const B = 'http://localhost:3000';
const GERANT = { id: 'u1', email: 'adam@bestasolar.tg', name: 'Adam', role: 'gerant', phone: '+228', avatar: 'A' };
const DEVIS = 'BS-20261011-0007';
const FACTURE = 'FAC-2026-021';
const PUBLIC = 'BS-20261011-0008';

// Téléphone Android simulé, avec le module natif de l'application.
const android = async ({ whatsappAbsent = false } = {}) => {
  const c = await nav.newContext({ viewport: { width: 412, height: 860 } });
  await c.addInitScript((absent) => {
    window.CapacitorCustomPlatform = { name: 'android', plugins: {} };
    window.__natif = [];
    window.__partages = [];
    navigator.share = async (x) => { window.__partages.push({ texte: x.text }); };
    window.Capacitor = {
      PluginHeaders: [{ name: 'FichiersNatifs', methods: [{ name: 'ouvrir', rtype: 'promise' }, { name: 'envoyerWhatsApp', rtype: 'promise' }] }],
      nativePromise: async (plugin, methode, options) => {
        window.__natif.push({ plugin, methode, options });
        if (methode === 'envoyerWhatsApp' && absent) { const e = new Error('WhatsApp absent'); e.code = 'WHATSAPP_ABSENT'; throw e; }
        return {};
      },
    };
  }, whatsappAbsent);
  const p = await c.newPage();
  p.on('pageerror', (e) => R.push('❌ ERREUR JS : ' + e));
  return { c, p };
};
const appels = (p, methode) => p.evaluate((m) => window.__natif.filter((a) => a.methode === m), methode);
const attendreAppel = (p, methode, n = 1) => p.waitForFunction(({ m, n }) => window.__natif.filter((a) => a.methode === m).length >= n, { m: methode, n }, { timeout: 30000 }).catch(() => {});

// Espace Pro d'une entreprise ivoirienne, client saisi en local.
const ouvrirPro = async (p) => {
  await p.goto(B + '/privacy.html');
  await p.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
  await p.goto(B + '/dashboard'); await p.locator('.tab-bar:visible, .sidebar:visible').first().waitFor(); await p.waitForTimeout(1200);
  await p.goto(B + '/privacy.html');
  await p.evaluate(({ DEVIS, FACTURE, PUBLIC }) => {
    const s = JSON.parse(localStorage.getItem('bestasolar_data'));
    const maintenant = new Date().toISOString();
    s.subscriptions = [{ id: 'sub-e2e', userId: 'u1', status: 'actif', formule: 'essentiel', dateDebut: maintenant, dateFin: new Date(Date.now() + 30 * 864e5).toISOString() }];
    s.companies = [{ id: 'comp-u1', userId: 'u1', facturePrefix: 'FAC', factureCounter: 21, modeleDefaut: 'studio', pays: 'ci',
      nomEntreprise: 'Soleil d’Abidjan', telephone: '+225 07 00 00 00 00', momo: '+225 05 11 22 33 44', momoOperateur: 'Wave' }];
    const lignes = [{ designation: 'Panneau photovoltaïque 620 Wc', qty: 4, pu: 70000 }, { designation: 'Onduleur hybride 3 kVA', qty: 1, pu: 250000 }];
    s.devis = [
      { id: crypto.randomUUID(), type: 'pro', pro: true, devisNumber: DEVIS, createdAt: maintenant, createdBy: 'u1',
        clientName: 'Awa Koné', clientPhone: '07 08 09 10 11', clientVille: 'Cocody', lignes,
        subtotal: 530000, tvaActive: false, tva: 0, total: 530000, statut: 'finalise' },
      { id: crypto.randomUUID(), type: 'manuel', devisNumber: PUBLIC, createdAt: maintenant, createdBy: 'u1', leadId: null,
        clientName: 'Kossi Mensah', clientPhone: '90 12 34 56', lignes, subtotal: 530000, total: 530000, statut: 'finalise', stage: 'devis' },
      ...(s.devis || []).filter((d) => d.devisNumber !== DEVIS && d.devisNumber !== PUBLIC),
    ];
    s.factures = [{ id: crypto.randomUUID(), userId: 'u1', numero: FACTURE, clientName: 'Awa Koné', clientPhone: '07 08 09 10 11',
      lignes, tvaActive: false, totalHT: 530000, tva: 0, totalTTC: 530000, statut: 'emise', createdAt: maintenant,
      echeance: new Date(Date.now() + 30 * 864e5).toISOString() }];
    localStorage.setItem('bestasolar_data', JSON.stringify(s));
    localStorage.setItem('bestasolar_mode_u1', 'pro');
  }, { DEVIS, FACTURE, PUBLIC });
  await p.goto(B + '/pro/documents');
  await p.locator('.flat-row', { hasText: DEVIS }).waitFor({ timeout: 15000 });
};

// ---- 1. Pro : devis et facture envoyés droit au client ----
{
  const { c, p } = await android();
  await ouvrirPro(p);
  await p.locator('.flat-row', { hasText: DEVIS }).click(); await p.locator('.doc-actions-list').waitFor();
  await p.locator('.doc-actions-list button', { hasText: 'Envoyer le devis sur WhatsApp' }).click();
  await attendreAppel(p, 'envoyerWhatsApp');
  let [envoi] = await appels(p, 'envoyerWhatsApp');
  ok(envoi?.options.numero === '2250708091011', `devis : conversation du client ouverte directement [${envoi?.options.numero}@s.whatsapp.net]`);
  ok(/Devis-BS-20261011-0007/.test(envoi?.options.chemin || '') && envoi.options.type === 'application/pdf' && envoi.options.texte.includes(DEVIS) && /Soleil d’Abidjan$/.test(envoi.options.texte),
    `devis : PDF et message joints [${(envoi?.options.chemin || '').split('/').pop()}]`);
  ok(await p.evaluate(() => window.__partages.length) === 0, 'devis : pas de menu de partage');
  const toast = await p.locator('.toast', { hasText: 'Devis' }).first().innerText({ timeout: 5000 }).catch(() => '');
  ok(/Devis partagé/.test(toast), `confirmation : « ${toast} »`);

  await p.locator('.sheet-overlay.active, .sheet.open').first().press('Escape').catch(() => {});
  await p.goto(B + '/pro/documents'); await p.locator('.flat-row', { hasText: DEVIS }).waitFor();
  await p.getByRole('button', { name: /Factures \(1\)/ }).click();
  await p.locator('.flat-row', { hasText: FACTURE }).click(); await p.locator('.doc-actions-list').waitFor();
  await p.locator('.doc-actions-list button', { hasText: 'Envoyer la facture sur WhatsApp' }).click();
  // (Page rechargée : le relevé des appels est reparti de zéro.)
  await attendreAppel(p, 'envoyerWhatsApp');
  [envoi] = await appels(p, 'envoyerWhatsApp');
  ok(envoi?.options.numero === '2250708091011' && /Facture-FAC-2026-021/.test(envoi.options.chemin) && /Wave/.test(envoi.options.texte),
    `facture : conversation du client, PDF et message (Wave) joints [${envoi?.options.numero}]`);

  // Télécharger : enregistré ET ouvert.
  await p.goto(B + '/pro/documents'); await p.locator('.flat-row', { hasText: DEVIS }).waitFor();
  await p.locator('.flat-row', { hasText: DEVIS }).locator('.flat-row-action').click();
  await attendreAppel(p, 'ouvrir');
  const [ouverture] = await appels(p, 'ouvrir');
  ok(/BestaSolar\/Devis-BS-20261011-0007.*\.pdf$/.test(ouverture?.options.chemin || '') && ouverture.options.type === 'application/pdf',
    `télécharger le devis : PDF ouvert aussitôt [${(ouverture?.options.chemin || '').split('/').slice(-2).join('/')}]`);
  const toastDl = await p.locator('.toast', { hasText: 'Documents/BestaSolar' }).first().innerText({ timeout: 5000 }).catch(() => '');
  ok(/enregistré dans Documents\/BestaSolar/.test(toastDl), `et rangé dans Documents/BestaSolar [${toastDl}]`);
  await c.close();
}

// ---- 2. Sans WhatsApp sur le téléphone : menu de partage, comme avant ----
{
  const { c, p } = await android({ whatsappAbsent: true });
  await ouvrirPro(p);
  await p.locator('.flat-row', { hasText: DEVIS }).click(); await p.locator('.doc-actions-list').waitFor();
  await p.locator('.doc-actions-list button', { hasText: 'Envoyer le devis sur WhatsApp' }).click();
  await p.waitForFunction(() => window.__partages.length > 0, null, { timeout: 30000 }).catch(() => {});
  const partages = await p.evaluate(() => window.__partages);
  ok(partages.length === 1 && partages[0].texte.includes(DEVIS), 'WhatsApp absent : le menu de partage prend le relais');
  await c.close();
}

// ---- 3. Devis public : numéro local togolais ----
{
  const { c, p } = await android();
  await ouvrirPro(p);
  await p.evaluate(() => localStorage.setItem('bestasolar_mode_u1', 'public'));
  await p.goto(B + '/devis'); await p.locator('.flat-row', { hasText: PUBLIC }).waitFor({ timeout: 15000 });
  await p.locator('.flat-row', { hasText: PUBLIC }).click(); await p.locator('.doc-actions-list').first().waitFor();
  await p.locator('button:has-text("Envoyer le devis sur WhatsApp")').first().click();
  await attendreAppel(p, 'envoyerWhatsApp');
  const [envoi] = await appels(p, 'envoyerWhatsApp');
  ok(envoi?.options.numero === '22890123456' && envoi.options.texte.includes(PUBLIC), `devis public : « 90 12 34 56 » → conversation +228 90 12 34 56 [${envoi?.options.numero}]`);
  await c.close();
}

// ---- 4. Fiche de dimensionnement (assistant Pro) : enregistrée et ouverte ----
{
  const { c, p } = await android();
  await ouvrirPro(p);
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
  await p.locator('button:has-text("Fiche de dimensionnement")').first().click();
  await attendreAppel(p, 'ouvrir');
  const [ouverture] = await appels(p, 'ouvrir');
  ok(/BestaSolar\/Fiche-dimensionnement.*\.pdf$/.test(ouverture?.options.chemin || ''), `fiche de dimensionnement : PDF ouvert aussitôt [${(ouverture?.options.chemin || '').split('/').pop()}]`);
  await c.close();
}

await nav.close();
console.log(R.join('\n'));
const echecs = R.filter((l) => l.startsWith('❌')).length;
console.log(echecs ? `\n❌ ${echecs} échec(s)` : `\n✅ PDF envoyés au client et ouverts au téléchargement (${R.length} vérifications)`);
process.exit(echecs ? 1 : 0);
