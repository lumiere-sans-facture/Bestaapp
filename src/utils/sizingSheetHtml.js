// Fiche de dimensionnement — document HTML autonome, imprimable (Ctrl+P).
// Récapitulatif technique complet : charges saisies, hypothèses de calcul
// (lues depuis solarSizing.js), résultats avec formules, matériel retenu.
// Document TECHNIQUE uniquement : aucun prix, aucun plan de financement.
//
// Mise en page : exactement DEUX pages A4 (794 × 1123 px), marges 40 px,
// espacements multiples de 8. Système typographique unique (IBM Plex Sans,
// graisses 400/500/600 ; échelle 28 / 18 / 13 / 11 px). Couleur 60/30/10 :
// blanc dominant, navy #0a2472 pour la structure, orange #f5a623 réservé à un
// SEUL élément du document — le chiffre focal de puissance à installer.
import { SIZING_PARAMS, SYSTEM_VOLTAGE, PANEL_SPEC, SYSTEM_TYPES } from './solarSizing';
import { COMPANY } from '../config/company';
import { CUSTOM_APPLIANCE_LABEL } from '../data/appliances';
import { LOGO_BESTASOLAR } from '../assets/logoBestaSolar';

// Milliers avec espaces (« 5 400 ») — espaces insécables normalisées.
const nf = (v, dec = 0) =>
  Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
    .replace(/[\u202f\u00a0]/g, ' ');
const pct = (v) => `${nf(v * 100)} %`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SYSTEM_LABEL = Object.fromEntries(SYSTEM_TYPES.map((t) => [t.id, t.label]));

/** Bloc statistique : micro-libellé, valeur navy, précision grise. */
const stat = (label, valeur, precision = '') => `
  <div class="stat">
    <div class="stat-label">${label}</div>
    <div class="stat-value">${valeur}</div>
    ${precision ? `<div class="stat-note">${precision}</div>` : ''}
  </div>`;

/** Ligne de résultat : valeur mise en avant à gauche, formules à droite. */
const resultat = (label, valeur, precision, formule, application) => `
  <div class="result">
    <div class="result-main">
      <div class="result-label">${label}</div>
      <div class="result-value">${valeur}</div>
      ${precision ? `<div class="result-note">${precision}</div>` : ''}
    </div>
    <div class="result-calc">
      <div>${formule}</div>
      <div>${application}</div>
    </div>
  </div>`;

/**
 * Construit le document HTML de la fiche (chaîne complète, autonome).
 * @param {object} d
 * @param {{name:string, phone?:string, ville?:string}} d.client
 * @param {{name:string, code?:string}|null} d.apporteur  partenaire apporteur (commission)
 * @param {Array<{name:string, power:number, quantity:number, day:number, night:number}>} d.appliances
 * @param {boolean} d.manualMode        saisie directe (pas de détail d'appareils)
 * @param {{day:number, night:number}} d.consumption   kWh/jour
 * @param {string} d.systemType         'off-grid' | 'hybrid' | 'on-grid'
 * @param {number} d.sunHours           HSP retenu (h/j)
 * @param {string|null} d.cityName      ville / localisation retenue
 * @param {string|null} d.solarSource   source des données solaires (PVGIS, NASA…)
 * @param {object} d.sizing             résultat de calculateSystemSize()
 * @param {{capacity:number, maxPower?:number}|null} d.inverter
 * @param {Array<{capacity:number, qty:number}>} d.batteries
 * @param {string} d.panelName          désignation du panneau (catalogue)
 */
export function buildSizingSheetHtml(d) {
  const { panelEfficiency, batteryEfficiency, depthOfDischarge, hybridBatteryRatio, inverterMargin } = SIZING_PARAMS;
  const conso = d.consumption;
  const totalKwh = conso.day + conso.night;
  const totalWh = Math.round(totalKwh * 1000);
  const maintenant = new Date();
  const date = maintenant.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  // Référence de fiche : date + initiales du client, stable et lisible.
  const initiales = String(d.client?.name || 'CLI').replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 3).toUpperCase() || 'CLI';
  const reference = `FD-${maintenant.getFullYear()}${String(maintenant.getMonth() + 1).padStart(2, '0')}${String(maintenant.getDate()).padStart(2, '0')}-${initiales}`;

  // --- Détail des calculs (mêmes formules que calculateSystemSize) ---
  const puissanceRequise = d.sizing.requiredPanelPower;  // W crête
  const batterieKwh = d.sizing.batteryCapacity;          // kWh (0 en on-grid)
  const batterieWh = Math.round(batterieKwh * 1000);
  const batterieAh = batterieKwh > 0 ? Math.round(batterieWh / SYSTEM_VOLTAGE) : 0;
  const autonomyNights = d.sizing.autonomyNights || 1;
  const nuitsLabel = `${nf(autonomyNights, autonomyNights % 1 ? 1 : 0)} nuit${autonomyNights > 1 ? 's' : ''}`;
  // Énergie que les panneaux doivent produire chaque jour : la conso de jour,
  // plus la conso de nuit multipliée par l'autonomie (recharge complète du
  // parc batterie possible en une journée, même après une nuit blanche).
  // Sans batterie (on-grid), l'autonomie ne joue pas.
  const nightEnergyForPanels = d.systemType === 'on-grid' ? conso.night : conso.night * autonomyNights;
  const totalKwhPanels = conso.day + nightEnergyForPanels;
  const energieNecessaire = totalKwhPanels / panelEfficiency; // kWh/j à produire

  const autonomie = d.systemType === 'off-grid'
    ? `Consommation nocturne complète (${nuitsLabel})`
    : d.systemType === 'hybrid'
      ? `${pct(hybridBatteryRatio)} de la consommation nocturne (${nuitsLabel}, appoint réseau)`
      : 'Sans batterie (injection réseau)';

  // --- Charges ---
  const h = (v) => (v ? nf(v, v % 1 ? 1 : 0) : '—');
  const lignes = d.manualMode
    ? [
        ['Consommation de jour (saisie directe)', '—', '—', '—', '—', nf(conso.day * 1000)],
        ['Consommation de nuit (saisie directe)', '—', '—', '—', '—', nf(conso.night * 1000)],
      ]
    : d.appliances.map((a) => [
        esc((a.name || '').trim() || CUSTOM_APPLIANCE_LABEL),
        nf(a.power), nf(a.quantity), h(a.day), h(a.night),
        nf(a.power * a.quantity * ((a.day || 0) + (a.night || 0))),
      ]);
  // La page 1 a une hauteur fixe (A4) : le tableau des charges s'y adapte en
  // deux temps. D'abord la densité — les lignes se resserrent quand elles sont
  // nombreuses (40 px jusqu'à 4 lignes, 32 px à 5 lignes, 24 px au-delà).
  // Ensuite le plafond : au-delà de LIGNES_MAX, les appareils excédentaires
  // sont regroupés sur une dernière ligne « + N autres appareils », dont la
  // consommation reste comptée dans les totaux. Le détail complet des charges
  // reste consultable dans l'assistant de dimensionnement.
  const LIGNES_MAX = 6;
  const densite = lignes.length <= 4 ? '' : lignes.length === 5 ? ' dense' : ' tres-dense';
  const visibles = lignes.length > LIGNES_MAX ? lignes.slice(0, LIGNES_MAX - 1) : lignes;
  const reste = lignes.slice(visibles.length);
  const ligneHtml = ([nom, p, q, j, n, wh]) =>
    `<tr><td>${nom}</td><td class="num">${p}</td><td class="num">${q}</td><td class="num">${j}</td><td class="num">${n}</td><td class="num">${wh}</td></tr>`;
  const resteWh = d.manualMode ? 0 : d.appliances
    .slice(visibles.length)
    .reduce((sum, a) => sum + a.power * a.quantity * ((a.day || 0) + (a.night || 0)), 0);
  const chargesRows = visibles.map(ligneHtml).join('')
    + (reste.length
      ? `<tr><td class="muted">+ ${nf(reste.length)} autre${reste.length > 1 ? 's' : ''} appareil${reste.length > 1 ? 's' : ''} regroupé${reste.length > 1 ? 's' : ''}</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">${nf(resteWh)}</td></tr>`
      : '');
  const picDeCharge = d.manualMode ? null : d.appliances.reduce((s, a) => s + a.power * a.quantity, 0);

  // --- Récapitulatif matériel : désignations TECHNIQUES uniquement (type,
  // tension, capacité, puissance) + quantité. Les marques et références du
  // catalogue servent au calcul mais n'apparaissent jamais sur le document.
  const panelWc = Number((String(d.panelName || '').match(/(\d{3,4})\s*W/i) || [])[1]) || PANEL_SPEC.power;
  // Puissance installée : nombre de panneaux × puissance du panneau retenu.
  const kwcInstalle = (d.sizing.numberOfPanels * panelWc) / 1000;
  // Batteries regroupées par capacité (les marques disparaissent → fusion des identiques).
  const batParCapacite = new Map();
  d.batteries.forEach((b) => batParCapacite.set(b.capacity, (batParCapacite.get(b.capacity) || 0) + b.qty));
  const materiel = [
    { ref: `Panneau photovoltaïque ${nf(panelWc)} Wc`, qty: d.sizing.numberOfPanels },
    ...(d.inverter ? [{ ref: `Onduleur hybride ${nf(d.inverter.capacity, d.inverter.capacity % 1 ? 1 : 0)} kVA`, qty: 1 }] : []),
    ...[...batParCapacite.entries()].map(([capacite, qty]) => ({
      ref: `Batterie lithium ${SYSTEM_VOLTAGE}V ${nf(Math.round((capacite * 1000) / SYSTEM_VOLTAGE))}Ah (${nf(capacite, capacite % 1 ? 1 : 0)} kWh)`,
      qty,
    })),
    { ref: 'Structure de montage', qty: Math.max(1, Math.round(d.sizing.numberOfPanels / 10)) },
    { ref: 'Kit de câblage solaire', qty: 1 },
    { ref: 'Coffret de protection DC/AC', qty: 1 },
  ];

  const paramRows = [
    ['Localisation retenue', d.cityName ? esc(d.cityName) : 'Non précisée'],
    ['Heures d’ensoleillement pic (HSP)', `${nf(d.sunHours, 1)} h/jour${d.solarSource ? ` <span class="muted">(source ${esc(d.solarSource)})</span>` : ''}`],
    ['Rendement des panneaux appliqué au calcul', pct(panelEfficiency)],
    ['Autonomie couverte par les batteries', autonomie],
    ['Profondeur de décharge batterie (DoD)', pct(depthOfDischarge)],
    ['Rendement charge/décharge batterie', pct(batteryEfficiency)],
    ['Tension du parc batterie', `${SYSTEM_VOLTAGE} V`],
    ['Marge de sécurité onduleur', `+${nf((inverterMargin - 1) * 100)} %`],
  ];

  const clientNom = esc(d.client?.name || 'À compléter');
  const ville = esc(d.cityName || d.client?.ville || '—');

  // --- Résultats (page 2) : cinq blocs, dans l'ordre, mêmes formules ---
  const blocsResultats = [
    resultat(
      'Énergie journalière à produire',
      `${nf(energieNecessaire, 2)} kWh/jour`,
      d.systemType === 'on-grid' ? '' : `dont recharge batterie sur ${nuitsLabel}`,
      `E = (Jour + Nuit${d.systemType === 'on-grid' ? '' : ' × nuits d\'autonomie'}) ÷ rendement des panneaux`,
      `E = (${nf(conso.day, 2)} + ${nf(conso.night, 2)}${d.systemType === 'on-grid' ? '' : ` × ${nf(autonomyNights, autonomyNights % 1 ? 1 : 0)}`}) kWh ÷ ${nf(panelEfficiency, 2)}`,
    ),
    resultat(
      'Puissance panneaux nécessaire',
      `${nf(Math.round(puissanceRequise))} Wc`,
      `→ ${nf(d.sizing.numberOfPanels)} panneau${d.sizing.numberOfPanels > 1 ? 'x' : ''} de ${nf(panelWc)} Wc = ${nf(kwcInstalle, 2)} kWc installés`,
      'P = E ÷ HSP',
      `P = ${nf(energieNecessaire, 2)} kWh ÷ ${nf(d.sunHours, 1)} h`,
    ),
    ...(d.systemType === 'on-grid' ? [] : [resultat(
      'Capacité batterie nécessaire',
      `${nf(batterieKwh, 2)} kWh`,
      `soit ${nf(batterieWh)} Wh ≈ ${nf(batterieAh)} Ah sous ${SYSTEM_VOLTAGE} V · autonomie ${nuitsLabel}`,
      `C = (Conso. nocturne × nuits d'autonomie) ÷ rendement batterie ÷ DoD${d.systemType === 'hybrid' ? ' × ratio hybride' : ''}`,
      `C = (${nf(conso.night, 2)} kWh × ${nf(autonomyNights, autonomyNights % 1 ? 1 : 0)}) ÷ ${nf(batteryEfficiency, 2)} ÷ ${nf(depthOfDischarge, 2)}${d.systemType === 'hybrid' ? ` × ${nf(hybridBatteryRatio, 2)}` : ''}`,
    )]),
    ...(d.inverter ? [resultat(
      'Onduleur hybride recommandé',
      `${nf(d.inverter.capacity, d.inverter.capacity % 1 ? 1 : 0)} kVA`,
      `MPPT intégré · tension système ${SYSTEM_VOLTAGE} V${d.inverter.maxPower ? ` · ${nf(d.inverter.maxPower)} W` : ''}`,
      `Puissance onduleur ≥ puissance requise × ${nf(inverterMargin, 1)}`,
      `≥ ${nf(Math.round(puissanceRequise))} W × ${nf(inverterMargin, 1)} = ${nf(Math.round(puissanceRequise * inverterMargin))} W`,
    )] : []),
    resultat(
      'Production annuelle estimée',
      `${nf(Math.round(d.sizing.estimatedProduction))} kWh/an`,
      '',
      'Production = puissance installée × HSP × 365',
      `= ${nf(kwcInstalle, 2)} kWc × ${nf(d.sunHours, 1)} h × 365`,
    ),
  ].join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fiche de dimensionnement — ${clientNom}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root { --navy: #0a2472; --orange: #f5a623; --texte: #3a3a3a; --gris: #6b6b6b; --filet: #e5e5e5; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'IBM Plex Sans', system-ui, sans-serif;
    font-size: 13px; line-height: 1.5; color: var(--texte);
    background: #eceef2; padding: 32px 0;
  }

  /* ---- Pages A4 ---- */
  .page {
    width: 794px; height: 1123px; padding: 40px; box-sizing: border-box;
    display: flex; flex-direction: column;
    background: #fff; margin: 0 auto 32px; overflow: hidden;
    font-variant-numeric: tabular-nums;
  }
  .page:last-of-type { margin-bottom: 0; }

  /* ---- Typographie ---- */
  .micro { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; color: var(--gris); }
  .muted { color: var(--gris); font-weight: 400; }
  h2 {
    font-size: 18px; font-weight: 600; color: var(--navy);
    padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid var(--filet);
  }

  /* ---- En-tête page 1 ---- */
  .head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px;
          padding-bottom: 16px; border-bottom: 2px solid var(--navy); margin-bottom: 32px; }
  .head img { height: 32px; width: auto; display: block; }
  .head-right { text-align: right; }
  .head-title { font-size: 18px; font-weight: 600; color: var(--navy); text-transform: uppercase; letter-spacing: 1.6px; }
  .head-sub { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 1.4px; color: var(--gris); margin-top: 8px; }

  /* ---- Bandeau de continuité page 2 ---- */
  .runner { display: flex; align-items: baseline; justify-content: space-between; gap: 24px;
            padding-bottom: 8px; border-bottom: 2px solid var(--navy); margin-bottom: 32px;
            font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; }
  .runner .marque { color: var(--navy); }
  .runner .contexte { color: var(--gris); }

  /* ---- Bloc focal (unique point orange du document) ---- */
  .focal { display: flex; align-items: flex-end; justify-content: space-between; gap: 32px;
           padding-bottom: 16px; border-bottom: 1px solid var(--filet); margin-bottom: 32px; }
  .focal-value { font-size: 28px; font-weight: 600; color: var(--orange); line-height: 1.2; margin: 8px 0; }
  .focal-note { font-size: 11px; color: var(--gris); }
  .focal-stats { display: grid; grid-template-columns: repeat(3, auto); gap: 32px; text-align: right; }

  /* ---- Statistiques ---- */
  .stat-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; color: var(--gris); }
  .stat-value { font-size: 18px; font-weight: 600; color: var(--navy); line-height: 1.4; margin-top: 4px; }
  .stat-note { font-size: 11px; color: var(--gris); }
  .synthese { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 8px; }
  .synthese .stat-value { line-height: 1.3; }

  /* ---- Client ---- */
  .client { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
  .client-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; color: var(--gris); }
  .client-value { font-size: 13px; margin-top: 4px; }
  .client-value.fort { font-weight: 600; color: var(--navy); }

  /* ---- Tableaux ---- */
  table { width: 100%; border-collapse: collapse; }
  th { background: var(--navy); color: #fff; font-size: 11px; font-weight: 600;
       text-transform: uppercase; letter-spacing: 0.5px; text-align: left; padding: 10px 12px; }
  th.num { text-align: right; }
  td { padding: 0 12px; border-bottom: 1px solid var(--filet); font-size: 13px; }
  td:first-child { height: 40px; box-sizing: border-box; }
  .dense td:first-child { height: 32px; }
  .tres-dense td:first-child { height: 24px; }
  .tres-dense td { font-size: 12px; }
  .num { text-align: right; white-space: nowrap; }

  /* ---- Paramètres (deux colonnes : libellé / valeur) ---- */
  .params td { border-bottom: 1px solid var(--filet); }
  .params td:first-child { height: 28px; }
  .params .valeur { text-align: right; font-weight: 600; color: var(--navy); }

  /* ---- Résultats (page 2) ---- */
  .result { display: flex; align-items: flex-start; justify-content: space-between; gap: 32px;
            padding: 8px 0; border-bottom: 1px solid var(--filet); }
  .result:last-child { border-bottom: none; }
  .result-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; color: var(--gris); }
  .result-value { font-size: 18px; font-weight: 600; color: var(--navy); line-height: 1.4; margin-top: 4px; }
  .result-note { font-size: 11px; color: var(--gris); margin-top: 4px; }
  .result-calc { font-size: 11px; color: var(--gris); text-align: right; white-space: nowrap; line-height: 1.6; }

  /* ---- Pieds de page ---- */
  .foot { margin-top: auto; padding-top: 8px; border-top: 2px solid var(--navy);
          display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .foot-line { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; color: var(--gris); }
  .foot-line.navy { color: var(--navy); }
  .foot-legal { font-size: 11px; font-weight: 400; text-transform: none; letter-spacing: 0; color: var(--gris); margin-top: 4px; }
  .foot-right { text-align: right; }

  /* ---- Barre d'impression (hors pages) ---- */
  .print-bar { width: 794px; margin: 32px auto 0; display: flex; justify-content: flex-end; }
  .print-btn { font-family: inherit; font-size: 13px; font-weight: 600; color: #fff;
               background: var(--navy); border: none; border-radius: 4px; padding: 12px 24px; cursor: pointer; }

  @page { size: A4; margin: 0; }
  @media print {
    body { background: #fff; padding: 0; }
    .page { margin: 0; }
    .page:first-of-type { page-break-after: always; }
    .print-bar { display: none; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- ================= PAGE 1 ================= -->
<section class="page">
  <div class="head">
    <img src="${LOGO_BESTASOLAR}" alt="${esc(COMPANY.name)}">
    <div class="head-right">
      <div class="head-title">Fiche de dimensionnement</div>
      <div class="head-sub">Étude technique · ${date} · Réf. ${reference}</div>
    </div>
  </div>

  <div class="focal">
    <div>
      <div class="micro">Puissance photovoltaïque à installer</div>
      <div class="focal-value">${nf(kwcInstalle, 2)} kWc</div>
      <div class="focal-note">${nf(d.sizing.numberOfPanels)} panneau${d.sizing.numberOfPanels > 1 ? 'x' : ''} de ${nf(panelWc)} Wc · ${nf(Math.round(d.sizing.estimatedProduction))} kWh/an estimés</div>
    </div>
    <div class="focal-stats">
      ${stat('Stockage', batterieKwh > 0 ? `${nf(batterieKwh, 1)} kWh` : '—', batterieKwh > 0 ? `${nf(batterieAh)} Ah · ${SYSTEM_VOLTAGE} V` : 'Sans batterie')}
      ${stat('Onduleur', d.inverter ? `${nf(d.inverter.capacity, d.inverter.capacity % 1 ? 1 : 0)} kVA` : '—', d.inverter ? 'Hybride' : 'Non retenu')}
      ${stat('Consommation', `${nf(totalKwh, 1)} kWh/j`, `${nf(totalWh)} Wh/jour`)}
    </div>
  </div>

  <section style="margin-bottom:32px">
    <h2>1 · Client</h2>
    <div class="client">
      <div><div class="client-label">Nom</div><div class="client-value fort">${clientNom}</div></div>
      <div><div class="client-label">Contact</div><div class="client-value">${esc(d.client?.phone || '—')}</div></div>
      <div><div class="client-label">Localisation</div><div class="client-value">${ville}</div></div>
      <div><div class="client-label">Type de système</div><div class="client-value">${esc(SYSTEM_LABEL[d.systemType] || d.systemType)}</div></div>
    </div>
  </section>

  <section style="margin-bottom:32px">
    <h2>2 · Charges saisies</h2>
    <table class="charges${densite}">
      <thead>
        <tr><th>Désignation</th><th class="num">Puissance (W)</th><th class="num">Qté</th><th class="num">Jour (h)</th><th class="num">Nuit (h)</th><th class="num">Conso. (Wh/j)</th></tr>
      </thead>
      <tbody>${chargesRows}</tbody>
    </table>
    <div class="synthese">
      ${stat('Pic de charge', picDeCharge != null ? `${nf(picDeCharge)} W` : '—', picDeCharge != null ? 'Toutes charges simultanées' : 'Saisie directe')}
      ${stat('Consommation journalière', `${nf(totalKwh, 2)} kWh`, `${nf(totalWh)} Wh par jour`)}
      ${stat('Répartition', `${nf(conso.day, 2)} / ${nf(conso.night, 2)} kWh`, 'Jour / nuit')}
    </div>
  </section>

  <section>
    <h2>3 · Paramètres de calcul utilisés</h2>
    <table class="params">
      <tbody>
        ${paramRows.map(([k, v]) => `<tr><td>${k}</td><td class="valeur">${v}</td></tr>`).join('')}
      </tbody>
    </table>
  </section>

  <div class="foot">
    <div class="foot-line">${esc(COMPANY.name)} — ${esc(COMPANY.addressShort)}</div>
    <div class="foot-line foot-right">Fiche de dimensionnement — ${clientNom} · Page 1 / 2</div>
  </div>
</section>

<!-- ================= PAGE 2 ================= -->
<section class="page">
  <div class="runner">
    <div class="marque">${esc(COMPANY.name)}</div>
    <div class="contexte">${clientNom} · ${ville} · Page 2 / 2</div>
  </div>

  <section style="margin-bottom:32px">
    <h2>4 · Résultats du dimensionnement</h2>
    ${blocsResultats}
  </section>

  <section>
    <h2>5 · Récapitulatif matériel</h2>
    <table>
      <thead><tr><th>Désignation technique</th><th class="num">Quantité</th></tr></thead>
      <tbody>
        ${materiel.map((m) => `<tr><td>${esc(m.ref)}</td><td class="num">${nf(m.qty)}</td></tr>`).join('')}
      </tbody>
    </table>
  </section>

  <div class="foot">
    <div>
      <div class="foot-line navy">${esc(COMPANY.name)} — ${esc(COMPANY.addressShort)} · ${esc(COMPANY.phone)}</div>
      <div class="foot-legal">RCCM ${esc(COMPANY.rccm)} · IFU ${esc(COMPANY.ifu)}${d.apporteur?.name ? ` · Apporteur d’affaires : ${esc(d.apporteur.name)}${d.apporteur.code ? ` · ${esc(d.apporteur.code)}` : ''}` : ''}</div>
    </div>
    <div class="foot-line foot-right">Document technique — ne constitue ni un devis ni une offre de prix.</div>
  </div>
</section>

<div class="print-bar">
  <button class="print-btn" onclick="window.print()">Imprimer / Exporter en PDF</button>
</div>

</body>
</html>`;
}

/** Ouvre la fiche dans un nouvel onglet (repli : téléchargement du fichier). */
export function openSizingSheet(data) {
  const html = buildSizingSheetHtml(data);
  const fenetre = window.open('', '_blank');
  if (fenetre) {
    fenetre.document.write(html);
    fenetre.document.close();
    return;
  }
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fiche-dimensionnement.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
