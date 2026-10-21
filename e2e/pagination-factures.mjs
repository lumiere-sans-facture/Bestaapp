/* Factures : la découpe en pages tient ses promesses, pour les trois modèles,
   de 1 à 40 lignes et huit cas — exemple de référence (3 échéances, un
   acompte), désignations longues (sur deux lignes) ou tout en capitales,
   deux versements et logo,
   règlement minimal, logo seul, émetteur BestaSolar, et un cas extrême
   (6 échéances longues, 4 versements, 5 modes de paiement, longue mention).
   Aucune page ne déborde ; la dernière page de lignes en porte au moins une
   avec les totaux — sauf le cas extrême à une seule ligne, où les totaux ne
   peuvent pas tenir avec elle. Les mesures se font dans le navigateur, sur
   le HTML même du PDF. Lancer `npm run dev` à côté. */
import { chromium } from '@playwright/test';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await nav.newPage({ viewport: { width: 900, height: 1200 } });
page.on('pageerror', (e) => console.log('ERREUR', e.message));
await page.goto('http://localhost:3000/privacy.html');
const modeles = (process.argv[2] || 'studio,vague,sobre').split(',');
const res = await page.evaluate(async (modeles) => {
  const { buildDocHtml } = await import('/src/utils/docTemplates/index.js');
  const { donneesDeFacture } = await import('/src/utils/docTemplates/shared.js');
  const { COMPANY } = await import('/src/config/company.js');
  const toile = document.createElement('canvas'); toile.width = 360; toile.height = 140;
  const g = toile.getContext('2d'); g.fillStyle = '#1a4fa0'; g.beginPath(); g.arc(70, 70, 60, 0, 7); g.fill(); g.font = '40px serif'; g.fillText('Signature', 140, 90);
  const cachet = toile.toDataURL('image/png');
  const logoToile = document.createElement('canvas'); logoToile.width = 200; logoToile.height = 160; const lg = logoToile.getContext('2d'); lg.fillStyle = '#0a2472'; lg.fillRect(0, 0, 200, 160);
  const logo = logoToile.toDataURL('image/png');
  const jour = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
  const pro = (extra = {}) => ({
    id: 'comp-u1', userId: 'u1', nomEntreprise: 'Lumière Sans Facture SARL', telephone: '+228 79 98 02 09', email: 'contact@exemple.tg',
    adresse: 'Adidoadin, Lomé — Togo', rccm: 'TG-LFW-01-2025-A10-01086', ifu: '1002023475', cnss: '180065', pays: 'tg',
    banque: 'Orabank Togo', compteBancaire: 'TG116 01001 000123456789 12', momo: '+228 90 00 00 00', momoOperateur: 'Flooz (Moov Africa)', momoNom: 'LSF SARL',
    modesPaiement: ['Virement bancaire', 'Flooz (Moov Africa)', 'Espèces'], mentionFiscale: 'Entreprise non assujettie à la TVA — montants nets.',
    signataireTitre: 'Le Directeur Général', signataireNom: 'Prénom Nom', cachet, ...extra,
  });
  const DESIGNATIONS = {
    long: (i) => `Onduleur hybride triphasé 125 kW avec module de communication et protections intégrées, lot ${i + 1}`,
    capitales: (i) => `PANNEAU SOLAIRE MONOCRISTALLIN 550 W HALF-CELL BIFACIAL DOUBLE VERRE — LOT N° ${i + 1}`,
    court: (i) => (i % 4 === 0 ? `Panneaux solaires monocristallins 585 Wc — lot ${i + 1}` : `Article de catalogue numéro ${i + 1}`),
  };
  const lignes = (n, long) => Array.from({ length: n }, (_, i) => ({ designation: DESIGNATIONS[long || 'court'](i), qty: 1 + (i % 3), pu: 100000 + i * 1000 }));
  const ech3 = [
    { id: 'e1', libelle: 'Acompte', type: 'date', date: jour(-20), montant: 0.165 },
    { id: 'e2', libelle: 'Complément d’acompte', type: 'periode', date: jour(-2), dateFin: jour(2), montant: 0.45 },
    { id: 'e3', libelle: 'Solde', type: 'condition', condition: 'À la réception / mise en service', montant: 0.385 },
  ];
  const ech6 = Array.from({ length: 6 }, (_, i) => ({ id: `x${i}`, libelle: `Tranche ${i + 1} — versement convenu à la commande`, type: i % 2 ? 'condition' : 'periode', date: jour(i * 10 - 20), dateFin: jour(i * 10 - 15), condition: 'À la livraison du matériel sur le chantier du client', montant: 1 / 6 }));
  const SCENARIOS = {
    exemple: { company: pro(), ech: ech3, paiements: 1 },
    exempleLong: { company: pro(), ech: ech3, paiements: 1, long: 'long' },
    capitales: { company: pro(), ech: ech3, paiements: 1, long: 'capitales' },
    deuxVersements: { company: pro({ logo }), ech: ech3, paiements: 2 },
    pire: { company: pro({ modesPaiement: ['Virement bancaire', 'Flooz (Moov Africa)', 'TMoney (Yas)', 'Espèces', 'Chèque'], mentionFiscale: 'Entreprise soumise au régime réel d’imposition — TVA collectée selon la réglementation en vigueur, montants exprimés en francs CFA.', logo }), ech: ech6, paiements: 4 },
    minimal: { company: { id: 'comp-u1', userId: 'u1', nomEntreprise: 'Entreprise Démo', pays: 'tg' }, ech: [], paiements: 0 },
    logoSeul: { company: pro({ logo, modesPaiement: null, mentionFiscale: '', signataireTitre: '', signataireNom: '', cachet: '' }), ech: [], paiements: 0 },
    public: { company: COMPANY, ech: [], paiements: 0 },
  };
  const sortie = [];
  for (const model of modeles) for (const [nom, sc] of Object.entries(SCENARIOS)) {
    const pbs = [];
    let vides = [];
    for (let n = 1; n <= 40; n++) {
      const l = lignes(n, sc.long);
      const total = l.reduce((s, x) => s + x.qty * x.pu, 0);
      const echeancier = sc.ech.map((e, i, arr) => ({ ...e, montant: i === arr.length - 1 ? total - arr.slice(0, -1).reduce((s, x) => s + Math.round(x.montant * total), 0) : Math.round(e.montant * total) }));
      const paiements = Array.from({ length: sc.paiements }, (_, i) => ({ id: `p${i}`, montant: Math.round(total * (sc.paiements > 1 ? 0.05 : 0.165)), date: jour(-20 + i), mode: i % 2 ? 'momo' : 'virement', operateur: i % 2 ? 'Flooz' : '', reference: `REF-${i}`, majLe: new Date().toISOString(), createdAt: new Date(Date.now() - 864e5 * 30).toISOString() }));
      const facture = { id: 'f1', userId: 'u1', numero: 'FAC-2026-016', clientName: 'Client Démo SARL', clientPhone: '+228 90 00 00 00', clientVille: 'Lomé', createdAt: new Date(Date.now() - 864e5 * 30).toISOString(), echeance: jour(10), lignes: l, totalHT: total, tva: 0, tvaActive: false, totalTTC: total, objet: 'Fourniture et installation d’une centrale solaire hybride', echeancier, paiements, statut: 'emise' };
      const data = donneesDeFacture({ facture, company: sc.company });
      const html = buildDocHtml({ kind: 'facture', model, data });
      const cadre = document.createElement('iframe'); cadre.style.cssText = 'width:900px;height:1200px;position:absolute;left:-9999px';
      document.body.appendChild(cadre);
      await new Promise((ok) => { cadre.onload = ok; cadre.srcdoc = html; });
      await cadre.contentDocument.fonts.ready; await new Promise((ok) => setTimeout(ok, 30));
      const pagesEl = [...cadre.contentDocument.querySelectorAll('.page')];

      const mesures = pagesEl.map((p) => {
        const rangs = p.querySelectorAll('table.lignes tbody tr').length;
        // Place libre au-dessus du pied (le pied est poussé en bas).
        const pied = p.querySelector('.pied, .legal');
        const enfants = [...p.querySelectorAll(':scope > *, :scope > .corps > *')].filter((x) => x !== pied && !x.classList.contains('corps') && !x.classList.contains('vague-basse') && !x.classList.contains('vague-haute') && !x.classList.contains('filigrane'));
        const bas = Math.max(...enfants.map((x) => x.getBoundingClientRect().bottom));
        const corps = p.querySelector('.corps');
        const libre = corps && pied && pied.classList.contains('legal')
          ? Math.round(corps.getBoundingClientRect().bottom - pied.getBoundingClientRect().bottom)
          : (pied ? Math.round(pied.getBoundingClientRect().top - bas) : null);
        return { rangs, deborde: p.scrollHeight - p.clientHeight, libre, fin: p.classList.contains('page-fin') };
      });
      cadre.remove();
      const dernier = [...mesures].reverse().find((m) => !m.fin);
      if (mesures.some((m) => m.deborde > 0)) pbs.push(`n=${n} DÉBORDE ${mesures.map((m) => `${m.rangs}l/+${m.deborde}`).join(' | ')}`);
      // Seule exception admise : le cas extrême à une seule ligne.
      if (dernier.rangs === 0 && !(nom === 'pire' && n === 1)) pbs.push(`n=${n} ORPHELIN ${mesures.map((m) => m.rangs).join('+')}`);
      vides.push(`${n}:${mesures.map((m) => (m.fin ? `FIN(${m.libre})` : `${m.rangs}(${m.libre})`)).join('+')}`);
    }
    sortie.push({ model, nom, pbs, apercu: vides.filter((_, i) => [0, 4, 8, 9, 11, 15, 19, 24, 29, 39].includes(i)).join('  ') });
  }
  return sortie;
}, modeles);
const R = res.map((r) => `${r.pbs.length ? '❌' : '✓ '} ${r.model} · ${r.nom} : ${r.pbs.length ? r.pbs.slice(0, 4).join(' ; ') : `1 à 40 lignes, rien ne déborde ni ne reste seul [${r.apercu.split('  ').slice(2, 4).join('  ')}]`}`);
console.log(R.join('\n'));
await nav.close();
process.exit(R.some((l) => l.startsWith('❌')) ? 1 : 0);
