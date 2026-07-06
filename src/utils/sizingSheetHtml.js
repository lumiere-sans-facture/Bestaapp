// Fiche de dimensionnement — document HTML imprimable (export PDF via Ctrl+P).
// Récapitulatif technique complet : charges saisies, hypothèses de calcul
// (lues depuis solarSizing.js), résultats avec formules, matériel retenu.
// Document TECHNIQUE uniquement : aucun prix, aucun plan de financement.
import { SIZING_PARAMS, SYSTEM_VOLTAGE, PANEL_SPEC, SYSTEM_TYPES } from './solarSizing';
import { COMPANY } from '../config/company';

// Milliers avec espaces (« 5 400 ») — espaces insécables normalisées.
const nf = (v, dec = 0) =>
  Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
    .replace(/[  ]/g, ' ');
const pct = (v) => `${nf(v * 100)} %`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SYSTEM_LABEL = Object.fromEntries(SYSTEM_TYPES.map((t) => [t.id, t.label]));

/**
 * Construit le document HTML de la fiche (chaîne complète, autonome).
 * @param {object} d
 * @param {{name:string, phone?:string, ville?:string}} d.client
 * @param {Array<{name:string, power:number, quantity:number, day:number, night:number}>} d.appliances
 * @param {boolean} d.manualMode        saisie directe (pas de détail d'appareils)
 * @param {{day:number, night:number}} d.consumption   kWh/jour
 * @param {string} d.systemType         'off-grid' | 'hybrid' | 'on-grid'
 * @param {number} d.sunHours           HSP retenu (h/j)
 * @param {string|null} d.cityName      ville / localisation retenue
 * @param {string|null} d.solarSource   source des données solaires (PVGIS, NASA…)
 * @param {object} d.sizing             résultat de calculateSystemSize()
 * @param {{brand:string, model:string, capacity:number, maxPower:number}|null} d.inverter
 * @param {Array<{brand:string, model:string, capacity:number, qty:number}>} d.batteries
 * @param {string} d.panelName          désignation du panneau (catalogue)
 */
export function buildSizingSheetHtml(d) {
  const { systemEfficiency, batteryEfficiency, depthOfDischarge, hybridBatteryRatio, inverterMargin } = SIZING_PARAMS;
  const conso = d.consumption;
  const totalKwh = conso.day + conso.night;
  const totalWh = Math.round(totalKwh * 1000);
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  // --- Détail des calculs (mêmes formules que calculateSystemSize) ---
  const energieNecessaire = totalKwh / systemEfficiency; // kWh/j à produire
  const puissanceRequise = d.sizing.requiredPanelPower;  // W crête
  const batterieKwh = d.sizing.batteryCapacity;          // kWh (0 en on-grid)
  const batterieWh = Math.round(batterieKwh * 1000);
  const batterieAh = batterieKwh > 0 ? Math.round(batterieWh / SYSTEM_VOLTAGE) : 0;

  const autonomie = d.systemType === 'off-grid'
    ? 'Consommation nocturne complète (1 nuit)'
    : d.systemType === 'hybrid'
      ? `${pct(hybridBatteryRatio)} de la consommation nocturne (appoint réseau)`
      : 'Sans batterie (injection réseau)';

  // --- Tableau des charges — heures jour / nuit séparées, comme dans le wizard ---
  const h = (v) => (v ? nf(v, v % 1 ? 1 : 0) : '—');
  const chargesRows = d.manualMode
    ? `<tr><td>Consommation de jour (saisie directe)</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">${nf(conso.day * 1000)}</td></tr>
       <tr><td>Consommation de nuit (saisie directe)</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">${nf(conso.night * 1000)}</td></tr>`
    : d.appliances.map((a) => {
        const wh = a.power * a.quantity * ((a.day || 0) + (a.night || 0));
        return `<tr><td>${esc(a.name)}</td><td class="num">${nf(a.power)}</td><td class="num">${nf(a.quantity)}</td><td class="num">${h(a.day)}</td><td class="num">${h(a.night)}</td><td class="num">${nf(wh)}</td></tr>`;
      }).join('');

  // --- Récapitulatif matériel (référence, marque, quantité — sans prix) ---
  const materiel = [
    { ref: d.panelName, marque: PANEL_SPEC.brand, qty: d.sizing.numberOfPanels },
    ...(d.inverter ? [{ ref: d.inverter.model, marque: d.inverter.brand, qty: 1 }] : []),
    ...d.batteries.map((b) => ({ ref: b.model, marque: b.brand, qty: b.qty })),
    { ref: 'Structure de montage', marque: '—', qty: Math.max(1, Math.round(d.sizing.numberOfPanels / 10)) },
    { ref: 'Kit de câblage solaire', marque: '—', qty: 1 },
    { ref: 'Coffret de protection DC/AC', marque: '—', qty: 1 },
  ];

  const paramRows = [
    ['Localisation retenue', d.cityName ? esc(d.cityName) : 'Non précisée'],
    ['Heures d’ensoleillement pic (HSP)', `${nf(d.sunHours, 1)} h/jour${d.solarSource ? ` <span class="muted">(source ${esc(d.solarSource)})</span>` : ''}`],
    ['Rendement global du système <span class="muted">(pertes câblage, température, salissures)</span>', pct(systemEfficiency)],
    ['Autonomie couverte par les batteries', autonomie],
    ['Profondeur de décharge batterie (DoD)', pct(depthOfDischarge)],
    ['Rendement charge/décharge batterie', pct(batteryEfficiency)],
    ['Tension du parc batterie', `${SYSTEM_VOLTAGE} V`],
    ['Marge de sécurité onduleur', `+${nf((inverterMargin - 1) * 100)} %`],
  ];

  const batterieFormule = d.systemType === 'on-grid'
    ? ''
    : `<div class="calc">
        <div class="calc-head">Capacité batterie nécessaire</div>
        <div class="calc-formula">C = Conso. nocturne ÷ rendement batterie ÷ DoD${d.systemType === 'hybrid' ? ' × ratio hybride' : ''}</div>
        <div class="calc-apply">C = ${nf(conso.night, 2)} kWh ÷ ${nf(batteryEfficiency, 2)} ÷ ${nf(depthOfDischarge, 2)}${d.systemType === 'hybrid' ? ` × ${nf(hybridBatteryRatio, 2)}` : ''} = <strong>${nf(batterieKwh, 2)} kWh</strong></div>
        <div class="calc-result">soit ${nf(batterieWh)} Wh ≈ <strong>${nf(batterieAh)} Ah</strong> sous ${SYSTEM_VOLTAGE} V</div>
      </div>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fiche de dimensionnement — ${esc(d.client?.name || 'Client')}</title>
<style>
  :root { --bleu: #0a2472; --bleu-fonce: #061540; --orange: #f5a623; --gris: #6b7280; --ligne: #e5e7eb; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; font-size: 13px; line-height: 1.5; background: #f4f6fb; }
  .sheet { max-width: 800px; margin: 0 auto; background: white; }
  @media screen { .sheet { margin: 24px auto; box-shadow: 0 8px 30px rgba(10,36,114,.16); border-radius: 8px; overflow: hidden; } }

  header { background: var(--bleu); color: white; padding: 22px 28px; display: flex; align-items: center; gap: 16px; }
  .logo { width: 46px; height: 46px; border-radius: 12px; background: var(--orange); color: var(--bleu-fonce); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 26px; }
  .brand-name { font-size: 18px; font-weight: 800; letter-spacing: .3px; }
  .brand-slogan { font-size: 11px; opacity: .85; font-style: italic; }
  .doc-meta { margin-left: auto; text-align: right; }
  .doc-title { font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; }
  .doc-date { font-size: 11px; opacity: .8; }
  .band { height: 5px; background: var(--orange); }

  main { padding: 22px 28px 28px; }
  section { margin-bottom: 20px; }
  h2 { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .6px; color: var(--bleu); border-bottom: 2px solid var(--orange); padding-bottom: 4px; margin-bottom: 10px; }
  .muted { color: var(--gris); font-weight: 400; font-size: 11px; }

  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { background: var(--bleu); color: white; text-align: left; padding: 7px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; }
  td { padding: 7px 10px; border-bottom: 1px solid var(--ligne); vertical-align: top; }
  tr:nth-child(even) td { background: #f8f9fc; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  th.num { text-align: right; }
  tfoot td { font-weight: 800; background: #fef3e0 !important; border-top: 2px solid var(--orange); border-bottom: none; }

  .kv { display: grid; grid-template-columns: 1fr; gap: 0; }
  .kv-row { display: flex; justify-content: space-between; gap: 16px; padding: 6px 2px; border-bottom: 1px dashed var(--ligne); }
  .kv-row:last-child { border-bottom: none; }
  .kv-label { color: #374151; }
  .kv-value { font-weight: 700; text-align: right; white-space: nowrap; }
  .kv-value .muted { white-space: normal; }

  .calc { border: 1.5px solid var(--ligne); border-left: 4px solid var(--orange); border-radius: 6px; padding: 10px 14px; margin-bottom: 10px; page-break-inside: avoid; }
  .calc-head { font-weight: 800; color: var(--bleu); margin-bottom: 3px; }
  .calc-formula { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: 11.5px; color: var(--gris); margin-bottom: 3px; }
  .calc-apply { font-size: 12.5px; }
  .calc-result { font-size: 12.5px; color: var(--bleu); margin-top: 2px; }

  .client-grid { display: flex; flex-wrap: wrap; gap: 6px 28px; }
  .client-item strong { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: var(--gris); font-weight: 700; }

  footer { padding: 14px 28px; border-top: 1px solid var(--ligne); display: flex; justify-content: space-between; gap: 12px; font-size: 10.5px; color: var(--gris); }
  .footer-band { height: 8px; background: var(--bleu); }

  .print-bar { max-width: 800px; margin: 16px auto 40px; display: flex; justify-content: center; }
  .print-btn { background: var(--bleu); color: white; border: none; border-radius: 10px; padding: 12px 26px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .print-btn:hover { background: #1a3a8c; }

  @page { size: A4; margin: 10mm; }
  @media print {
    body { background: white; font-size: 12px; }
    .sheet { max-width: none; box-shadow: none; border-radius: 0; }
    .print-bar { display: none; }
    header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    section { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="sheet">
  <header>
    <div class="logo">☀</div>
    <div>
      <div class="brand-name">${esc(COMPANY.name)}</div>
      <div class="brand-slogan">${esc(COMPANY.slogan)}</div>
    </div>
    <div class="doc-meta">
      <div class="doc-title">Fiche de dimensionnement</div>
      <div class="doc-date">${date}</div>
    </div>
  </header>
  <div class="band"></div>

  <main>
    <!-- 1. Client -->
    <section>
      <h2>1 · Client</h2>
      <div class="client-grid">
        <div class="client-item"><strong>Nom</strong>${esc(d.client?.name || 'À compléter')}</div>
        <div class="client-item"><strong>Contact</strong>${esc(d.client?.phone || '—')}</div>
        <div class="client-item"><strong>Localisation</strong>${esc(d.cityName || d.client?.ville || '—')}</div>
        <div class="client-item"><strong>Type de système</strong>${esc(SYSTEM_LABEL[d.systemType] || d.systemType)}</div>
      </div>
    </section>

    <!-- 2. Charges -->
    <section>
      <h2>2 · Charges saisies</h2>
      <table>
        <thead>
          <tr><th>Désignation</th><th class="num">Puissance (W)</th><th class="num">Qté</th><th class="num">☀ Jour (h)</th><th class="num">☾ Nuit (h)</th><th class="num">Conso. (Wh/j)</th></tr>
        </thead>
        <tbody>${chargesRows}</tbody>
        <tfoot>
          <tr><td colspan="5">Total consommation journalière</td><td class="num">${nf(totalWh)} Wh/j — ${nf(totalKwh, 2)} kWh/j</td></tr>
        </tfoot>
      </table>
      <div class="muted" style="margin-top:4px">Dont jour : ${nf(conso.day, 2)} kWh — nuit : ${nf(conso.night, 2)} kWh.</div>
    </section>

    <!-- 3. Paramètres -->
    <section>
      <h2>3 · Paramètres de calcul utilisés</h2>
      <div class="kv">
        ${paramRows.map(([k, v]) => `<div class="kv-row"><span class="kv-label">${k}</span><span class="kv-value">${v}</span></div>`).join('')}
      </div>
    </section>

    <!-- 4. Résultats + formules -->
    <section>
      <h2>4 · Résultats du dimensionnement</h2>

      <div class="calc">
        <div class="calc-head">Énergie journalière à produire</div>
        <div class="calc-formula">E = Consommation totale ÷ rendement global</div>
        <div class="calc-apply">E = ${nf(totalKwh, 2)} kWh ÷ ${nf(systemEfficiency, 2)} = <strong>${nf(energieNecessaire, 2)} kWh/jour</strong></div>
      </div>

      <div class="calc">
        <div class="calc-head">Puissance panneaux nécessaire</div>
        <div class="calc-formula">P = E ÷ HSP</div>
        <div class="calc-apply">P = ${nf(energieNecessaire, 2)} kWh ÷ ${nf(d.sunHours, 1)} h = <strong>${nf(Math.round(puissanceRequise))} Wc</strong></div>
        <div class="calc-result">→ ${nf(d.sizing.numberOfPanels)} panneau(x) de ${nf(PANEL_SPEC.power)} Wc = <strong>${nf(d.sizing.panelCapacity, 2)} kWc installés</strong></div>
      </div>

      ${batterieFormule}

      ${d.inverter ? `<div class="calc">
        <div class="calc-head">Onduleur hybride recommandé</div>
        <div class="calc-formula">Puissance onduleur ≥ puissance requise × ${nf(inverterMargin, 1)}</div>
        <div class="calc-apply">≥ ${nf(Math.round(puissanceRequise))} W × ${nf(inverterMargin, 1)} = ${nf(Math.round(puissanceRequise * inverterMargin))} W
          → <strong>${esc(d.inverter.brand)} ${esc(d.inverter.model)}</strong> (${nf(d.inverter.capacity, d.inverter.capacity % 1 ? 1 : 0)} kVA · ${nf(d.inverter.maxPower)} W)</div>
        <div class="calc-result">Régulateur MPPT intégré à l’onduleur hybride · tension système ${SYSTEM_VOLTAGE} V</div>
      </div>` : ''}

      <div class="calc">
        <div class="calc-head">Production annuelle estimée</div>
        <div class="calc-formula">Production = puissance installée × HSP × 365</div>
        <div class="calc-apply">= <strong>${nf(Math.round(d.sizing.estimatedProduction))} kWh/an</strong></div>
      </div>
    </section>

    <!-- 5. Matériel -->
    <section>
      <h2>5 · Récapitulatif matériel</h2>
      <table>
        <thead><tr><th>Référence</th><th>Marque</th><th class="num">Quantité</th></tr></thead>
        <tbody>
          ${materiel.map((m) => `<tr><td>${esc(m.ref)}</td><td>${esc(m.marque)}</td><td class="num">${nf(m.qty)}</td></tr>`).join('')}
        </tbody>
      </table>
    </section>
  </main>

  <footer>
    <span>${esc(COMPANY.name)} — ${esc(COMPANY.addressShort)} · ${esc(COMPANY.phone)}</span>
    <span>Document technique — ne constitue ni un devis ni une offre de prix.</span>
  </footer>
  <div class="footer-band"></div>
</div>

<div class="print-bar">
  <button class="print-btn" onclick="window.print()">🖨 Imprimer / Exporter en PDF</button>
</div>
</body>
</html>`;
}

/** Ouvre la fiche dans un nouvel onglet, prête à imprimer (Ctrl+P). */
export function openSizingSheet(data) {
  const w = window.open('about:blank', '_blank');
  if (!w) return; // bloqueur de popups
  w.document.write(buildSizingSheetHtml(data));
  w.document.close();
}
