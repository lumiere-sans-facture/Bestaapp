// Fiche de dimensionnement — MISE EN PAGE : trois pages A4 fixes.
//   Page 1 · Synthèse et besoin   Page 2 · Étude technique   Page 3 · Analyse
// Socle visuel identique aux modèles de devis : IBM Plex Sans 400/500/600,
// échelle 28/18/13/11, navy #0a2472, orange #f5a623 (UN point focal par
// page : le kWc en page 1, l'économie annuelle en page 3 — page 2 sans
// orange), terre cuite #c2410c réservée au graphique.
import { SIZING_PARAMS, SYSTEM_VOLTAGE, SYSTEM_TYPES } from '../solarSizing';
import { COMPANY } from '../../config/company';
import { CUSTOM_APPLIANCE_LABEL } from '../../data/appliances';
import { LOGO_BESTASOLAR } from '../../assets/logoBestaSolar';
import { RATIO_PRODUCTIBLE_NET, DUREES_VIE, libelleRoi } from './compute';
import { renderCoverageChart } from './chart';

// Milliers à espaces (« 5 400 »). L'unité, elle, est TOUJOURS accrochée à sa
// valeur par une espace fine insécable ( ) via u().
const nf = (v, dec = 0) =>
  Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
    .replace(/[  ]/g, ' ');
const u = (valeur, unite) => `${valeur} ${unite}`;
const pct = (v) => u(nf(v * 100), '%');
const cfa = (v) => u(nf(v), 'F CFA');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SYSTEM_LABEL = Object.fromEntries(SYSTEM_TYPES.map((t) => [t.id, t.label]));

const stat = (label, valeur, precision = '') => `
  <div class="stat">
    <div class="stat-label">${label}</div>
    <div class="stat-value">${valeur}</div>
    ${precision ? `<div class="stat-note">${precision}</div>` : ''}
  </div>`;

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

/** Assemble le document complet (3 pages) à partir des données du dossier
 *  (`d`, contrat inchangé) et du dossier calculé (`c` = computeSheet(d)). */
export function renderSheet(d, c) {
  const { panelEfficiency, batteryEfficiency, depthOfDischarge, hybridBatteryRatio, inverterMargin } = SIZING_PARAMS;
  const conso = d.consumption;
  const totalKwh = c.consoJour;
  const totalWh = Math.round(totalKwh * 1000);
  const maintenant = new Date();
  const date = maintenant.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const initiales = String(d.client?.name || 'CLI').replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 3).toUpperCase() || 'CLI';
  const reference = `FD-${maintenant.getFullYear()}${String(maintenant.getMonth() + 1).padStart(2, '0')}${String(maintenant.getDate()).padStart(2, '0')}-${initiales}`;

  const batterieKwh = d.sizing.batteryCapacity;
  const autonomyNights = c.autonomyNights;
  const nuitsLabel = `${nf(autonomyNights, autonomyNights % 1 ? 1 : 0)} nuit${autonomyNights > 1 ? 's' : ''}`;
  const autonomie = d.systemType === 'off-grid'
    ? `Consommation nocturne complète (${nuitsLabel})`
    : d.systemType === 'hybrid'
      ? `${pct(hybridBatteryRatio)} de la consommation nocturne (${nuitsLabel}, appoint réseau)`
      : 'Sans batterie (injection réseau)';

  // --- Charges (page 1) ---
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
  const LIGNES_MAX = 9; // la page 1 ne porte plus les paramètres : plus d'air
  const densite = lignes.length <= 6 ? '' : lignes.length <= 8 ? ' dense' : ' tres-dense';
  const visibles = lignes.length > LIGNES_MAX ? lignes.slice(0, LIGNES_MAX - 1) : lignes;
  const reste = lignes.slice(visibles.length);
  const resteWh = d.manualMode ? 0 : d.appliances
    .slice(visibles.length)
    .reduce((sum, a) => sum + a.power * a.quantity * ((a.day || 0) + (a.night || 0)), 0);
  const ligneHtml = ([nom, p, q, j, n, wh]) =>
    `<tr><td>${nom}</td><td class="num">${p}</td><td class="num">${q}</td><td class="num">${j}</td><td class="num">${n}</td><td class="num">${wh}</td></tr>`;
  const chargesRows = visibles.map(ligneHtml).join('')
    + (reste.length
      ? `<tr><td class="muted">+ ${nf(reste.length)} autre${reste.length > 1 ? 's' : ''} appareil${reste.length > 1 ? 's' : ''} regroupé${reste.length > 1 ? 's' : ''}</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">${nf(resteWh)}</td></tr>`
      : '');
  const picDeCharge = d.manualMode ? null : d.appliances.reduce((s, a) => s + a.power * a.quantity, 0);

  // --- Paramètres (page 2) ---
  const renta = c.renta;
  const paramRows = [
    ['Localisation retenue', d.cityName ? esc(d.cityName) : 'Non précisée'],
    ['Ensoleillement pic (HSP)', `${u(nf(d.sunHours, 1), 'h/jour')}`],
    ['Rendement des panneaux', pct(panelEfficiency)],
    ['Décharge batterie (DoD)', pct(depthOfDischarge)],
    ['Rendement batterie', pct(batteryEfficiency)],
    ['Tension du parc batterie', u(SYSTEM_VOLTAGE, 'V')],
    ['Autonomie batterie', autonomie],
    ['Marge de sécurité onduleur', `+${pct(inverterMargin - 1)}`],
    ['Tarif de l’électricité', u(nf(renta.tarifElec), 'F CFA/kWh')],
    ['Taux d’utilisation', pct(renta.tauxUtilisation)],
  ];

  // --- Matériel (page 2, deux tableaux côte à côte) ---
  const panelWc = c.panelWc;
  const batParCapacite = new Map();
  d.batteries.forEach((b) => batParCapacite.set(b.capacity, (batParCapacite.get(b.capacity) || 0) + b.qty));
  const materiel = [
    { ref: `Panneau photovoltaïque ${u(nf(panelWc), 'Wc')}`, qty: d.sizing.numberOfPanels },
    ...(d.inverter ? [{ ref: `Onduleur hybride ${u(nf(d.inverter.capacity, d.inverter.capacity % 1 ? 1 : 0), 'kVA')}`, qty: 1 }] : []),
    ...[...batParCapacite.entries()].map(([capacite, qty]) => ({
      ref: `Batterie lithium ${u(SYSTEM_VOLTAGE, 'V')} ${u(nf(Math.round((capacite * 1000) / SYSTEM_VOLTAGE)), 'Ah')} (${u(nf(capacite, capacite % 1 ? 1 : 0), 'kWh')})`,
      qty,
    })),
    { ref: 'Structure de montage', qty: Math.max(1, Math.round(d.sizing.numberOfPanels / 10)) },
    { ref: 'Kit de câblage solaire', qty: 1 },
    { ref: 'Coffret de protection DC/AC', qty: 1 },
  ];
  const moitie = Math.ceil(materiel.length / 2);
  const tableMateriel = (items) => `
    <table>
      <thead><tr><th>Désignation technique</th><th class="num">Quantité</th></tr></thead>
      <tbody>${items.map((m) => `<tr><td>${m.ref}</td><td class="num">${nf(m.qty)}</td></tr>`).join('')}</tbody>
    </table>`;

  // --- Résultats (page 2) ---
  const blocsResultats = [
    resultat(
      'Énergie journalière à produire',
      u(nf(c.energieNecessaire, 2), 'kWh/jour'),
      d.systemType === 'on-grid' ? '' : `dont recharge batterie sur ${nuitsLabel}`,
      `E = (Jour + Nuit${d.systemType === 'on-grid' ? '' : ' × nuits d\'autonomie'}) ÷ rendement des panneaux`,
      `E = (${nf(conso.day, 2)} + ${nf(conso.night, 2)}${d.systemType === 'on-grid' ? '' : ` × ${nf(autonomyNights, autonomyNights % 1 ? 1 : 0)}`}) kWh ÷ ${nf(panelEfficiency, 2)}`,
    ),
    resultat(
      'Puissance panneaux nécessaire',
      u(nf(Math.round(d.sizing.requiredPanelPower)), 'Wc'),
      `→ ${nf(d.sizing.numberOfPanels)} panneau${d.sizing.numberOfPanels > 1 ? 'x' : ''} de ${u(nf(panelWc), 'Wc')} = ${u(nf(c.kwc, 2), 'kWc')} installés`,
      'P = E ÷ HSP',
      `P = ${u(nf(c.energieNecessaire, 2), 'kWh')} ÷ ${u(nf(d.sunHours, 1), 'h')}`,
    ),
    ...(d.systemType === 'on-grid' ? [] : [resultat(
      'Capacité batterie nécessaire',
      u(nf(batterieKwh, 2), 'kWh'),
      `soit ${u(nf(Math.round(batterieKwh * 1000)), 'Wh')} ≈ ${u(nf(c.batterieAh), 'Ah')} sous ${u(SYSTEM_VOLTAGE, 'V')} · autonomie ${nuitsLabel}`,
      `C = (Conso. nocturne × nuits d'autonomie) ÷ rendement batterie ÷ DoD${d.systemType === 'hybrid' ? ' × ratio hybride' : ''}`,
      `C = (${u(nf(conso.night, 2), 'kWh')} × ${nf(autonomyNights, autonomyNights % 1 ? 1 : 0)}) ÷ ${nf(batteryEfficiency, 2)} ÷ ${nf(depthOfDischarge, 2)}${d.systemType === 'hybrid' ? ` × ${nf(hybridBatteryRatio, 2)}` : ''}`,
    )]),
    ...(d.inverter ? [resultat(
      'Onduleur hybride recommandé',
      u(nf(d.inverter.capacity, d.inverter.capacity % 1 ? 1 : 0), 'kVA'),
      `MPPT intégré · tension système ${u(SYSTEM_VOLTAGE, 'V')}${d.inverter.maxPower ? ` · ${u(nf(d.inverter.maxPower), 'W')}` : ''}`,
      `Puissance onduleur ≥ puissance requise × ${nf(inverterMargin, 1)}`,
      `≥ ${u(nf(Math.round(d.sizing.requiredPanelPower)), 'W')} × ${nf(inverterMargin, 1)} = ${u(nf(Math.round(d.sizing.requiredPanelPower * inverterMargin)), 'W')}`,
    )] : []),
    resultat(
      'Productible annuel net',
      u(nf(c.prods.net), 'kWh/an'),
      `théorique ${u(nf(c.prods.theorique), 'kWh/an')} × ${nf(RATIO_PRODUCTIBLE_NET, 2)} de pertes système`,
      'Net = kWc × HSP × 365 × ratio de pertes',
      `= ${u(nf(c.kwc, 2), 'kWc')} × ${u(nf(d.sunHours, 1), 'h')} × 365 × ${nf(RATIO_PRODUCTIBLE_NET, 2)}`,
    ),
  ].join('');

  // --- Analyse (page 3) ---
  const chart = renderCoverageChart(c.couverture.mois, { kwc: c.kwc, tauxUtilisation: renta.tauxUtilisation });
  const rentaRows = [
    ['Consommation couverte', `${u(nf(renta.kwhAnnuels), 'kWh/an')} <span class="muted">(${u(nf(totalKwh, 2), 'kWh/j')} × ${nf(renta.tauxUtilisation, 2)} × 365)</span>`],
    ['Investissement estimé', renta.investissement != null ? cfa(renta.investissement) : 'À renseigner'],
    [`Remplacement onduleur (1 × sur ${nf(renta.horizon)} ans)`, cfa(renta.provisionOnduleur)],
    [`Maintenance (${cfa(renta.maintenanceAnnuelle)}/an dès la 2ᵉ année)`, cfa(renta.maintenanceTotale)],
    [`Économies cumulées sur ${nf(renta.horizon)} ans`, cfa(renta.economiesCumulees)],
  ];

  const clientNom = esc(d.client?.name || 'À compléter');
  const ville = esc(d.cityName || d.client?.ville || '—');
  const runner = (page) => `
  <div class="runner">
    <div class="marque">${esc(COMPANY.name)}</div>
    <div class="contexte">${clientNom} · ${ville} · Page ${page} / 3</div>
  </div>`;

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
  :root { --navy: #0a2472; --orange: #f5a623; --texte: #3a3a3a; --gris: #6b6b6b; --filet: #e5e5e5; --terre: #c2410c; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'IBM Plex Sans', system-ui, sans-serif;
    font-size: 13px; line-height: 1.5; color: var(--texte);
    background: #eceef2; padding: 32px 0;
  }
  .page {
    width: 794px; height: 1123px; padding: 40px; box-sizing: border-box;
    display: flex; flex-direction: column;
    background: #fff; margin: 0 auto 32px; overflow: hidden;
    font-variant-numeric: tabular-nums;
  }
  .page:last-of-type { margin-bottom: 0; }
  .micro { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; color: var(--gris); }
  .muted { color: var(--gris); font-weight: 400; }
  h2 {
    font-size: 18px; font-weight: 600; color: var(--navy);
    padding-bottom: 6px; margin-bottom: 8px; border-bottom: 1px solid var(--navy);
  }
  .head { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px;
          padding-bottom: 16px; border-bottom: 2px solid var(--navy); margin-bottom: 32px; }
  .head img { height: 32px; width: auto; display: block; }
  .head-right { text-align: right; }
  .head-title { font-size: 18px; font-weight: 600; color: var(--navy); text-transform: uppercase; letter-spacing: 1.6px; }
  .head-sub { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 1.4px; color: var(--gris); margin-top: 8px; }
  .runner { display: flex; align-items: baseline; justify-content: space-between; gap: 24px;
            padding-bottom: 8px; border-bottom: 2px solid var(--navy); margin-bottom: 32px;
            font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; }
  .runner .marque { color: var(--navy); }
  .runner .contexte { color: var(--gris); }
  .focal { display: flex; align-items: flex-end; justify-content: space-between; gap: 32px;
           padding-bottom: 16px; border-bottom: 1px solid var(--filet); margin-bottom: 32px; }
  .focal-value { font-size: 28px; font-weight: 600; color: var(--orange); line-height: 1.2; margin: 8px 0; }
  .focal-note { font-size: 11px; color: var(--gris); }
  .focal-stats { display: grid; grid-template-columns: repeat(3, auto); gap: 32px; text-align: right; }
  .stat-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; color: var(--gris); }
  .stat-value { font-size: 18px; font-weight: 600; color: var(--navy); line-height: 1.4; margin-top: 4px; }
  .stat-note { font-size: 11px; color: var(--gris); }
  .synthese { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 8px; }
  .client { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
  .client-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; color: var(--gris); }
  .client-value { font-size: 13px; margin-top: 4px; }
  .client-value.fort { font-weight: 600; color: var(--navy); }
  table { width: 100%; border-collapse: collapse; }
  th { background: var(--navy); color: #fff; font-size: 11px; font-weight: 600;
       text-transform: uppercase; letter-spacing: 0.5px; text-align: left; padding: 10px 12px; }
  th.num { text-align: right; }
  td { padding: 0 12px; border-bottom: 1px solid var(--filet); font-size: 13px; }
  td:first-child { height: 36px; box-sizing: border-box; }
  .dense td:first-child { height: 36px; }
  .tres-dense td:first-child { height: 36px; }
  .num { text-align: right; white-space: nowrap; }
  .params { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 32px; }
  .param-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; color: var(--gris); }
  .param-value { font-size: 13px; font-weight: 600; color: var(--navy); margin-top: 2px; }
  .cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: start; }
  .result { display: flex; align-items: flex-start; justify-content: space-between; gap: 32px;
            padding: 3px 0; border-bottom: 1px solid var(--filet); }
  .result:last-child { border-bottom: none; }
  .result-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; color: var(--gris); }
  .result-value { font-size: 18px; font-weight: 600; color: var(--navy); line-height: 1.3; margin-top: 2px; }
  .result-note { font-size: 11px; color: var(--gris); margin-top: 2px; }
  .result-calc { font-size: 11px; color: var(--gris); text-align: right; white-space: nowrap; line-height: 1.5; }
  .renta-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 24px; }
  .chart-note { font-size: 11px; color: var(--gris); margin-top: 4px; }
  .vies { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-top: 16px; }
  .foot { margin-top: auto; padding-top: 8px; border-top: 2px solid var(--navy);
          display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .foot-line { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; color: var(--gris); }
  .foot-line.navy { color: var(--navy); }
  .foot-legal { font-size: 11px; font-weight: 400; text-transform: none; letter-spacing: 0; color: var(--gris); margin-top: 4px; }
  .foot-right { text-align: right; }
  .print-bar { width: 794px; margin: 32px auto 0; display: flex; justify-content: flex-end; }
  .print-btn { font-family: inherit; font-size: 13px; font-weight: 600; color: #fff;
               background: var(--navy); border: none; border-radius: 4px; padding: 12px 24px; cursor: pointer; }
  @page { size: A4; margin: 0; }
  @media print {
    body { background: #fff; padding: 0; }
    .page { margin: 0; page-break-after: always; }
    .page:last-of-type { page-break-after: auto; }
    .print-bar { display: none; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- ============ PAGE 1 · Synthèse et besoin ============ -->
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
      <div class="focal-value">${u(nf(c.kwc, 2), 'kWc')}</div>
      <div class="focal-note">${nf(d.sizing.numberOfPanels)} panneau${d.sizing.numberOfPanels > 1 ? 'x' : ''} de ${u(nf(panelWc), 'Wc')} · productible net ${u(nf(c.prods.net), 'kWh/an')}</div>
    </div>
    <div class="focal-stats">
      ${stat('Stockage', batterieKwh > 0 ? u(nf(batterieKwh, 1), 'kWh') : '—', batterieKwh > 0 ? `${u(nf(c.batterieAh), 'Ah')} · ${u(SYSTEM_VOLTAGE, 'V')}` : 'Sans batterie')}
      ${stat('Onduleur', d.inverter ? u(nf(d.inverter.capacity, d.inverter.capacity % 1 ? 1 : 0), 'kVA') : '—', d.inverter ? 'Hybride' : 'Non retenu')}
      ${stat('Consommation', u(nf(totalKwh, 1), 'kWh/j'), `${u(nf(totalWh), 'Wh')} par jour`)}
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

  <section>
    <h2>2 · Charges saisies</h2>
    <table class="charges${densite}">
      <thead>
        <tr><th>Désignation</th><th class="num">Puissance (W)</th><th class="num">Qté</th><th class="num">Jour (h)</th><th class="num">Nuit (h)</th><th class="num">Conso. (Wh/j)</th></tr>
      </thead>
      <tbody>${chargesRows}</tbody>
    </table>
    <div class="synthese">
      ${stat('Pic de charge', picDeCharge != null ? u(nf(picDeCharge), 'W') : '—', picDeCharge != null ? 'Toutes charges simultanées' : 'Saisie directe')}
      ${stat('Consommation journalière', u(nf(totalKwh, 2), 'kWh'), `${u(nf(totalWh), 'Wh')} par jour`)}
      ${stat('Répartition', `${nf(conso.day, 2)} / ${u(nf(conso.night, 2), 'kWh')}`, 'Jour / nuit')}
    </div>
  </section>

  <div class="foot">
    <div class="foot-line">${esc(COMPANY.name)} — ${esc(COMPANY.addressShort)}</div>
    <div class="foot-line foot-right">Fiche de dimensionnement — ${clientNom} · Page 1 / 3</div>
  </div>
</section>

<!-- ============ PAGE 2 · Étude technique ============ -->
<section class="page">
  ${runner(2)}

  <section style="margin-bottom:16px">
    <h2>3 · Paramètres de calcul utilisés</h2>
    <div class="params">
      ${paramRows.map(([k, v]) => `<div><div class="param-label">${k}</div><div class="param-value">${v}</div></div>`).join('')}
    </div>
    <div class="chart-note">Source ensoleillement : ${esc(d.solarSource || 'NASA/PVGIS')} — heures de pic du pire mois de l'année.</div>
  </section>

  <section style="margin-bottom:16px">
    <h2>4 · Résultats du dimensionnement</h2>
    ${blocsResultats}
  </section>

  <section>
    <h2>5 · Récapitulatif matériel</h2>
    <div class="cols2">
      ${tableMateriel(materiel.slice(0, moitie))}
      ${tableMateriel(materiel.slice(moitie))}
    </div>
  </section>

  <div class="foot">
    <div class="foot-line">${esc(COMPANY.name)} — ${esc(COMPANY.addressShort)}</div>
    <div class="foot-line foot-right">Document technique — Page 2 / 3</div>
  </div>
</section>

<!-- ============ PAGE 3 · Analyse ============ -->
<section class="page">
  ${runner(3)}

  <section style="margin-bottom:32px">
    <h2>6 · Couverture mensuelle des besoins</h2>
    ${chart}
    <div class="chart-note">
      Productible net ${u(nf(c.prods.net), 'kWh/an')} (théorique ${u(nf(c.prods.theorique), 'kWh/an')}) ·
      déficit cumulé de saison des pluies ${u(nf(Math.round(c.couverture.deficitCumule)), 'kWh')}, absorbé par le parc batterie.
    </div>
  </section>

  <section>
    <h2>7 · Estimation de rentabilité sur ${nf(renta.horizon)} ans</h2>
    <div class="renta-stats">
      ${`<div class="stat">
        <div class="stat-label">Économie annuelle</div>
        <div class="focal-value">${cfa(renta.economieAnnuelle)}</div>
        <div class="stat-note">${u(nf(renta.kwhAnnuels), 'kWh')} × ${u(nf(renta.tarifElec), 'F CFA/kWh')}</div>
      </div>`}
      ${stat('Retour sur investissement', libelleRoi(renta.roiMois), renta.roiMois != null ? 'investissement + provision onduleur couverts' : 'investissement à renseigner')}
      ${stat('Gain net sur la période', renta.gainNet != null ? cfa(renta.gainNet) : '—', 'économies − investissement − coûts d’exploitation')}
    </div>
    <table>
      <tbody>
        ${rentaRows.map(([k, v]) => `<tr><td>${k}</td><td class="num" style="font-weight:600;color:var(--navy)">${v}</td></tr>`).join('')}
      </tbody>
    </table>
    <div class="micro" style="margin-top:24px">Durée de vie des équipements</div>
    <div class="vies">
      ${DUREES_VIE.map((v) => stat(v.equipement, v.duree)).join('')}
    </div>
  </section>

  <div class="foot">
    <div>
      <div class="foot-line navy">${esc(COMPANY.name)} — ${esc(COMPANY.addressShort)} · ${esc(COMPANY.phone)}</div>
      <div class="foot-legal">RCCM ${esc(COMPANY.rccm)} · IFU ${esc(COMPANY.ifu)}${d.apporteur?.name ? ` · Apporteur d’affaires : ${esc(d.apporteur.name)}${d.apporteur.code ? ` · ${esc(d.apporteur.code)}` : ''}` : ''}</div>
    </div>
    <div class="foot-line foot-right">Estimation indicative — ne constitue pas une offre de prix ferme. · Page 3 / 3</div>
  </div>
</section>

<div class="print-bar">
  <button class="print-btn" onclick="window.print()">Imprimer / Exporter en PDF</button>
</div>

</body>
</html>`;
}
