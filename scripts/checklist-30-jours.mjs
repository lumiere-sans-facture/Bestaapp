// Génère public/formations/checklist-30-jours.pdf : la checklist du plan
// d'action sur 30 jours (formation « Gagner de l'argent avec BestaSolar
// Pro », module 5). Une page A4, à imprimer ou à garder sur le téléphone.
//
//   node scripts/checklist-30-jours.mjs
//
// La page est écrite ici en HTML puis imprimée par Chromium (Playwright,
// déjà présent pour les tests de bout en bout). Polices de l'application
// (public/fonts), aucune image : le PDF reste léger pour une connexion faible.
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, statSync } from 'node:fs';

const CIBLE = 'public/formations/checklist-30-jours.pdf';
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
// Polices en data URL : une page ouverte par setContent n'a pas le droit de
// lire un fichier local, Chromium retomberait en silence sur une autre police.
const police = (graisse) => `data:font/woff2;base64,${readFileSync(`public/fonts/ibm-plex-sans-latin-${graisse}-normal.woff2`).toString('base64')}`;

const SEMAINES = [
  ['Semaine 1', 'Préparer', [
    'Terminer la formation « Démarrer avec BestaSolar Pro »',
    'Terminer la formation « Créer des devis qui signent »',
    'Connaître vos kits et leurs prix dans l’application',
    'Copier votre lien : Plus → Mon espace partenaire',
    'Écrire votre message WhatsApp de présentation',
  ]],
  ['Semaine 2', 'Prospecter', [
    'Ouvrir 20 pistes : Suivi clients → « Nouvelle piste »',
    'Noter la source de chaque contact (marché, voisin…)',
    'Viser ceux que les coupures font perdre de l’argent',
    'Montrer le Simulateur ROI aux plus pressés',
    'Partager votre lien dans vos statuts et groupes',
  ]],
  ['Semaine 3', 'Visiter et chiffrer', [
    'Visiter au moins 8 clients',
    'Faire le dimensionnement le jour de la visite',
    'Envoyer devis et fiche de dimensionnement sur WhatsApp',
    'Proposer une date de rappel dans le message',
    'Déplacer chaque carte à la bonne étape',
  ]],
  ['Semaine 4', 'Relancer et signer', [
    'Traiter chaque « Devis sans suite » : « Relancer par WhatsApp »',
    'Passer les refus définitifs en « Perdu »',
    'À chaque signature : proposer le contrat de maintenance',
    'À chaque signature : demander deux noms',
    'Appeler chaque client installé dans la semaine',
  ]],
];

const INDICATEURS = ['Pistes actives', 'Devis · ce mois', 'Devis sans suite', 'Gagnées · ce mois'];

const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Plan d’action 30 jours — Académie BestaSolar</title>
<style>
@font-face { font-family: Plex; font-weight: 400; src: url(${police(400)}) format('woff2'); }
@font-face { font-family: Plex; font-weight: 600; src: url(${police(600)}) format('woff2'); }
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Plex, Arial, sans-serif; color: #172033; font-size: 10.5pt; line-height: 1.35; }
.page { width: 210mm; height: 297mm; padding: 13mm 14mm 11mm; display: flex; flex-direction: column; }
header { background: #0D3483; color: #fff; border-radius: 4mm; padding: 6mm 7mm; margin-bottom: 5mm; }
.marque { color: #FFA800; font-weight: 600; letter-spacing: .14em; font-size: 8.5pt; }
h1 { margin: 1.5mm 0 1mm; font-size: 20pt; line-height: 1.15; }
.sous { margin: 0; opacity: .85; font-size: 10pt; }
.grille { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
section { border: .35mm solid #d5dcea; border-radius: 3mm; padding: 4mm 4.5mm 3mm; break-inside: avoid; }
h2 { margin: 0 0 2.5mm; font-size: 11.5pt; color: #0D3483; display: flex; gap: 2mm; align-items: baseline; }
h2 span { background: #FFA800; color: #08215A; border-radius: 1.5mm; padding: .4mm 2mm; font-size: 8.5pt; letter-spacing: .04em; }
ul { list-style: none; margin: 0; padding: 0; }
li { display: flex; gap: 2.5mm; align-items: flex-start; margin-bottom: 2mm; }
li::before { content: ''; flex: none; width: 3.6mm; height: 3.6mm; margin-top: .5mm; border: .4mm solid #0D3483; border-radius: .8mm; }
.vendredi { margin-top: 4mm; }
table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
th, td { border: .3mm solid #d5dcea; padding: 1.8mm 2mm; text-align: left; }
th { background: #eef2fa; color: #0D3483; font-weight: 600; }
td.vide { width: 17%; }
.note { margin: 2.5mm 0 0; font-size: 9pt; color: #4a5568; }
footer { margin-top: auto; padding-top: 3mm; border-top: .35mm solid #d5dcea; font-size: 8.5pt; color: #4a5568; display: flex; justify-content: space-between; gap: 6mm; }
</style></head><body><div class="page">
<header>
  <div class="marque">ACADÉMIE BESTASOLAR</div>
  <h1>Plan d’action sur 30 jours</h1>
  <p class="sous">Objectif : vos 5 premiers clients. Une méthode, pas une promesse : cochez chaque action au fil des semaines.</p>
</header>
<div class="grille">
${SEMAINES.map(([s, titre, actions]) => `<section><h2><span>${s.toUpperCase()}</span>${titre}</h2><ul>${actions.map((a) => `<li>${a}</li>`).join('')}</ul></section>`).join('\n')}
</div>
<section class="vendredi">
  <h2><span>CHAQUE VENDREDI</span>Le point avec le tableau de bord</h2>
  <table>
    <tr><th>Pastille</th><th>Semaine 1</th><th>Semaine 2</th><th>Semaine 3</th><th>Semaine 4</th></tr>
    ${INDICATEURS.map((i) => `<tr><td>${i}</td><td class="vide"></td><td class="vide"></td><td class="vide"></td><td class="vide"></td></tr>`).join('')}
  </table>
  <p class="note">Beaucoup de pistes mais peu de devis : visitez davantage. Beaucoup de devis mais peu de ventes : soignez la présentation et les relances.</p>
</section>
<footer>
  <span>Formation « Gagner de l’argent avec BestaSolar Pro » · Module 5</span>
  <span>Le résultat dépend de votre zone, de vos prix et de votre travail : aucun gain n’est garanti.</span>
</footer>
</div></body></html>`;

// Typographie française : espaces insécables autour de « », : et ?, pour
// qu'aucun guillemet ne reste seul en bout de ligne.
const insecables = (t) => t.replace(/« /g, '«\u00a0').replace(/ »/g, '\u00a0»').replace(/ ([:?;!])/g, '\u00a0$1');
const [tete, corps] = html.split('</style>');
const page = `${tete}</style>${insecables(corps)}`;

mkdirSync('public/formations', { recursive: true });
const nav = await chromium.launch({ executablePath: CHROMIUM });
const onglet = await nav.newPage();
await onglet.setContent(page, { waitUntil: 'load' });
await onglet.evaluate(() => document.fonts.ready);
await onglet.pdf({ path: CIBLE, format: 'A4', printBackground: true, preferCSSPageSize: true });
await nav.close();
console.log(`${CIBLE} généré (${Math.round(statSync(CIBLE).size / 1024)} Ko).`);
