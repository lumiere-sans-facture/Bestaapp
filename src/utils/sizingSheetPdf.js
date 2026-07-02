import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Fiche de dimensionnement solaire : document de synthèse technique reprenant
// les besoins, les résultats du dimensionnement calculé et le récap matériel.
// Marques réelles issues du catalogue BestaSolar (Taico, Felicity, Growatt…).

// Hypothèses de calcul (alignées sur calculateSystemSize).
const SYSTEM_EFFICIENCY = 0.75;
const BATTERY_EFFICIENCY = 0.85;
const DEPTH_OF_DISCHARGE = 0.8;
const BATTERY_VOLTAGE = 48;

const SYS_LABEL = { 'off-grid': 'Autonome (off-grid)', hybrid: 'Hybride', 'on-grid': 'Raccordé réseau' };

const fmtCFA = (n) => Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' F CFA';
const nf = (n) => Math.round(n || 0).toLocaleString('fr-FR');
const fmtDate = (d) => {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};
const hexToRgb = (hex, fallback = [10, 36, 114]) => {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return fallback;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const GRAY = [110, 116, 128];
const DARK = [25, 28, 40];

/**
 * @param {object} o
 * @param {object} o.company   identité entreprise (couleurs, logo, nom)
 * @param {object} o.client    { name, phone, ville }
 * @param {Array}  o.appliances [{ name, power, quantity, hours, dailyWh }]
 * @param {boolean} o.manualMode
 * @param {object} o.consumption { day, night } en kWh
 * @param {object} o.sizing     { numberOfPanels, panelCapacity, requiredPanelPower, batteryCapacity, estimatedProduction }
 * @param {object|null} o.inverter { brand, model, capacity }
 * @param {Array}  o.batteries  [{ brand, model, capacity, qty }]
 * @param {string} o.systemType
 * @param {number} o.sunHours
 * @param {number} [o.date]
 */
export function generateSizingSheetPdf({
  company = {}, client = {}, appliances = [], manualMode = false,
  consumption = { day: 0, night: 0 }, sizing, inverter = null, batteries = [],
  systemType = 'hybrid', sunHours = 5, date,
}) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 40;
  const primary = hexToRgb(company.couleurPrimaire, [10, 36, 114]);
  const secondary = hexToRgb(company.couleurSecondaire, [245, 166, 35]);
  const name = company.nomEntreprise || 'BestaSolar';

  // ---------- En-tête ----------
  const bandH = 74;
  pdf.setFillColor(...primary);
  pdf.rect(0, 0, W, bandH, 'F');
  if (company.logo) {
    try { pdf.addImage(company.logo, M, 18, 40, 40, undefined, 'FAST'); } catch { /* ignore */ }
  }
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(15);
  pdf.text(name, company.logo ? M + 52 : M, 34);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  if (company.slogan) pdf.text(company.slogan, company.logo ? M + 52 : M, 47);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('FICHE DE DIMENSIONNEMENT', W - M, 36, { align: 'right' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...secondary.map((c) => Math.min(255, c + 40)));
  pdf.text(fmtDate(date || Date.now()), W - M, 50, { align: 'right' });

  let y = bandH + 24;

  // ---------- Client / localisation ----------
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(...GRAY);
  pdf.text('CLIENT', M, y);
  pdf.setTextColor(...DARK);
  pdf.setFontSize(11);
  pdf.text(client.name || 'À renseigner', M, y + 15);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  let cy = y + 28;
  if (client.phone) { pdf.text(`Tél : ${client.phone}`, M, cy); cy += 12; }
  if (client.ville) { pdf.text(`Localisation : ${client.ville}`, M, cy); cy += 12; }
  const sysInfo = `${SYS_LABEL[systemType] || systemType} · ${sunHours} h de pic solaire / jour`;
  pdf.setTextColor(...GRAY);
  pdf.text(sysInfo, M, cy);
  y = cy + 18;

  // ---------- Besoins énergétiques ----------
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(...primary);
  pdf.text('1. Besoins énergétiques', M, y);
  y += 8;

  const totalWh = Math.round((consumption.day + consumption.night) * 1000);
  if (!manualMode && appliances.length) {
    autoTable(pdf, {
      startY: y + 6,
      margin: { left: M, right: M },
      head: [['Appareil', 'Puiss. (W)', 'Qté', 'h/j', 'Conso (Wh/j)']],
      body: appliances.map((a) => [a.name, nf(a.power), String(a.quantity), String(a.hours), nf(a.dailyWh)]),
      foot: [['Total', '', '', '', `${nf(totalWh)} Wh/j`]],
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: { top: 5, bottom: 5, left: 8, right: 8 }, textColor: DARK, lineColor: [225, 228, 235] },
      headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      footStyles: { fillColor: [244, 246, 251], textColor: DARK, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'right' } },
    });
    y = pdf.lastAutoTable.finalY + 18;
  } else {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...DARK);
    pdf.text(`Consommation jour : ${consumption.day.toFixed(2)} kWh · nuit : ${consumption.night.toFixed(2)} kWh · total : ${(consumption.day + consumption.night).toFixed(2)} kWh/j`, M, y + 18);
    y += 34;
  }

  // ---------- Résultats du dimensionnement ----------
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(...primary);
  pdf.text('2. Résultats du dimensionnement', M, y);
  y += 10;

  const perPanel = sizing.numberOfPanels ? Math.round((sizing.panelCapacity * 1000) / sizing.numberOfPanels) : 0;
  const totalWc = Math.round(sizing.panelCapacity * 1000);
  const batteryAh = sizing.batteryCapacity > 0 ? Math.round((sizing.batteryCapacity * 1000) / BATTERY_VOLTAGE) : 0;
  const usableKwh = sizing.batteryCapacity * DEPTH_OF_DISCHARGE * BATTERY_EFFICIENCY;
  const nights = consumption.night > 0 ? usableKwh / consumption.night : null;
  const batBrands = [...new Set(batteries.map((b) => b.brand))].join(' / ') || '—';

  const results = [
    ['Panneaux solaires', `${sizing.numberOfPanels} × ${perPanel} Wc = ${nf(totalWc)} Wc (${sizing.panelCapacity.toFixed(1)} kWc)`],
    ['Puissance requise', `${nf(Math.round(sizing.requiredPanelPower))} W`],
    ['Onduleur / hybride', inverter ? `${inverter.brand} ${inverter.model} — ${inverter.capacity} kVA` : 'À sélectionner'],
    ['Batteries', sizing.batteryCapacity > 0 ? `${sizing.batteryCapacity.toFixed(1)} kWh ≈ ${nf(batteryAh)} Ah @ ${BATTERY_VOLTAGE} V — ${batBrands}` : 'Aucune (raccordé réseau)'],
    ['Régulateur / config', `${SYS_LABEL[systemType] || systemType} · ${BATTERY_VOLTAGE} V · MPPT intégré à l'onduleur`],
    ['Autonomie estimée', sizing.batteryCapacity > 0 ? `${usableKwh.toFixed(1)} kWh utiles${nights ? ` · ~${nights.toFixed(1)}× la consommation de nuit` : ''}` : '—'],
    ['Production estimée', `${nf(sizing.estimatedProduction)} kWh / an`],
  ];
  autoTable(pdf, {
    startY: y + 6,
    margin: { left: M, right: M },
    body: results,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: { top: 6, bottom: 6, left: 8, right: 8 }, textColor: DARK, lineColor: [225, 228, 235] },
    columnStyles: { 0: { cellWidth: 150, fontStyle: 'bold', textColor: GRAY }, 1: { cellWidth: 'auto' } },
  });
  y = pdf.lastAutoTable.finalY + 8;

  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...GRAY);
  pdf.text(
    `Hypothèses : rendement système ${SYSTEM_EFFICIENCY * 100} %, rendement batterie ${BATTERY_EFFICIENCY * 100} %, profondeur de décharge ${DEPTH_OF_DISCHARGE * 100} %, ensoleillement ${sunHours} h/j.`,
    M, y + 10, { maxWidth: W - 2 * M }
  );
  y += 26;

  // ---------- Récapitulatif matériel ----------
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(...primary);
  pdf.text('3. Récapitulatif matériel', M, y);

  const mounting = Math.max(1, Math.round(sizing.numberOfPanels / 10));
  const matRows = [
    [`Panneau solaire ${perPanel} Wc`, String(sizing.numberOfPanels)],
    ...(inverter ? [[`Onduleur ${inverter.brand} ${inverter.model} (${inverter.capacity} kVA)`, '1']] : []),
    ...batteries.map((b) => [`Batterie ${b.brand} ${b.model} (${b.capacity} kWh)`, String(b.qty)]),
    ['Structure de montage', String(mounting)],
    ['Kit de câblage solaire', '1'],
    ['Coffret de protection DC/AC', '1'],
  ];
  autoTable(pdf, {
    startY: y + 8,
    margin: { left: M, right: M },
    head: [['Référence / désignation', 'Qté']],
    body: matRows,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: { top: 5, bottom: 5, left: 8, right: 8 }, textColor: DARK, lineColor: [225, 228, 235] },
    headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    columnStyles: { 1: { cellWidth: 50, halign: 'center' } },
  });

  // ---------- Pied de page ----------
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...GRAY);
  pdf.text(
    [name, company.telephone, company.email].filter(Boolean).join('  ·  '),
    W / 2, H - 26, { align: 'center' }
  );
  pdf.setFillColor(...secondary);
  pdf.rect(0, H - 12, W, 12, 'F');

  const fileName = `Fiche-dimensionnement-${(client.ville || 'solaire').replace(/\s+/g, '-')}.pdf`;
  pdf.save(fileName);
  return fileName;
}
