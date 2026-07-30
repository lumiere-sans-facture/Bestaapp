import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TVA_PCT } from '../config/company';

// Module Devis Pro : documents (devis / factures) à l'identité de l'entreprise
// du technicien, en 2 modèles : « couleur » (bandeau aux couleurs de
// l'entreprise) et « sobre » (noir & blanc, imprimable partout).

const fmt = (n) => Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' F CFA';
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
 * @param {object} opts
 * @param {'devis'|'facture'} opts.kind
 * @param {object} opts.company  identité de l'entreprise du technicien
 * @param {'couleur'|'sobre'} opts.modele  couleur = bandeau aux couleurs ; sobre = noir & blanc
 * @param {object} opts.doc  { numero, date, client: {name, phone, ville}, lignes:[{designation, qty, pu}], totalHT, tvaActive, tva, totalTTC, statut?, validiteJours? }
 * @param {boolean} [opts.preview]  n'enregistre pas le fichier, renvoie le blob URL (aperçu)
 */
export function generateProPdf({ kind, company = {}, modele = 'couleur', doc: d, preview = false }) {
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const bw = modele === 'sobre';
  const M = 40;
  // En noir & blanc, on force une palette neutre (ignore les couleurs de l'entreprise).
  const primary = bw ? [33, 37, 41] : hexToRgb(company.couleurPrimaire, [10, 36, 114]);
  const secondary = bw ? [90, 96, 104] : hexToRgb(company.couleurSecondaire, [245, 166, 35]);
  const title = kind === 'facture' ? 'FACTURE' : 'DEVIS';
  const name = company.nomEntreprise || 'Mon Entreprise';

  const drawLogo = (x, y, size, onBand = false) => {
    if (company.logo) {
      try {
        pdf.addImage(company.logo, x, y, size, size, undefined, 'FAST');
        return;
      } catch { /* logo illisible : repli sur les initiales */ }
    }
    pdf.setFillColor(...(onBand ? secondary : primary));
    pdf.roundedRect(x, y, size, size, 6, 6, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(size * 0.42);
    const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    pdf.text(initials, x + size / 2, y + size / 2 + size * 0.15, { align: 'center' });
  };

  const coordLines = [
    [company.telephone && `Tél : ${company.telephone}`, company.email && company.email].filter(Boolean).join('   ·   '),
    [company.adresse, company.ifu && `IFU : ${company.ifu}`, company.rccm && `RCCM : ${company.rccm}`].filter(Boolean).join('   ·   '),
  ].filter(Boolean);

  let y;

  // ---------- En-tête ----------
  if (!bw) {
    // Modèle Couleur : bandeau plein aux couleurs de l'entreprise
    const bandH = 92;
    pdf.setFillColor(...primary);
    pdf.rect(0, 0, W, bandH, 'F');
    drawLogo(M, 22, 48, true);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(17);
    pdf.text(name, M + 62, 44);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    if (company.slogan) pdf.text(company.slogan, M + 62, 58);
    coordLines.forEach((l, i) => pdf.text(l, M + 62, 70 + i * 10));
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(24);
    pdf.text(title, W - M, 50, { align: 'right' });
    pdf.setFontSize(10);
    pdf.setTextColor(...secondary.map((c) => Math.min(255, c + 40)));
    pdf.text(d.numero, W - M, 68, { align: 'right' });
    y = bandH + 26;
  } else {
    // Modèle Sobre (N&B) : logo à gauche, coordonnées à droite, filet noir
    const logoSize = 46;
    drawLogo(M, 32, logoSize);
    pdf.setTextColor(...DARK);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text(name, M + logoSize + 12, 52);
    if (company.slogan) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...GRAY);
      pdf.text(company.slogan, M + logoSize + 12, 64);
    }
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...GRAY);
    coordLines.forEach((l, i) => pdf.text(l, W - M, 38 + i * 11, { align: 'right' }));
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.setTextColor(...DARK);
    pdf.text(title, W - M, 76, { align: 'right' });
    pdf.setDrawColor(...primary);
    pdf.setLineWidth(2);
    pdf.line(M, 90, W - M, 90);
    y = 110;
  }

  // ---------- Références + client ----------
  pdf.setFontSize(8.5);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...GRAY);
  pdf.text(kind === 'facture' ? 'FACTURÉ À' : 'DEVIS ÉTABLI POUR', M, y);
  pdf.setTextColor(...DARK);
  pdf.setFontSize(12);
  pdf.text(d.client?.name || 'Client', M, y + 15);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  let cy = y + 28;
  if (d.client?.phone) { pdf.text(`Tél : ${d.client.phone}`, M, cy); cy += 11; }
  if (d.client?.ville) { pdf.text(d.client.ville, M, cy); cy += 11; }

  const metaRows = [
    ['Numéro', d.numero],
    ['Date', fmtDate(d.date)],
    kind === 'devis'
      ? ["Valide jusqu'au", fmtDate(new Date(new Date(d.date).getTime() + (d.validiteJours || 30) * 86400000))]
      : ['Statut', { brouillon: 'Brouillon', emise: 'Émise', payee: 'Payée' }[d.statut] || d.statut],
  ];
  if (kind === 'facture' && d.echeance && d.statut !== 'payee') metaRows.push(['Échéance', fmtDate(d.echeance)]);
  let my = y;
  pdf.setFontSize(8.5);
  metaRows.forEach(([label, value]) => {
    pdf.setTextColor(...GRAY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(label, W - M - 140, my);
    pdf.setTextColor(...DARK);
    pdf.setFont('helvetica', 'bold');
    pdf.text(String(value), W - M, my, { align: 'right' });
    my += 13;
  });

  // ---------- Tableau des lignes ----------
  const body = (d.lignes || []).map((l, i) => [
    String(i + 1),
    l.designation,
    fmt(l.pu),
    String(l.qty),
    fmt(l.pu * l.qty),
  ]);

  autoTable(pdf, {
    startY: Math.max(cy, my) + 18,
    margin: { left: M, right: M },
    head: [['N°', 'DÉSIGNATION', 'PRIX UNIT.', 'QTÉ', 'MONTANT']],
    body,
    theme: bw ? 'grid' : 'plain',
    styles: { fontSize: 8.5, cellPadding: { top: 6, bottom: 6, left: 8, right: 8 }, textColor: DARK, lineColor: [225, 228, 235] },
    headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 85, halign: 'right' },
      3: { cellWidth: 38, halign: 'center' },
      4: { cellWidth: 90, halign: 'right' },
    },
    alternateRowStyles: bw ? undefined : { fillColor: [248, 249, 252] },
  });

  let endY = pdf.lastAutoTable.finalY + 22;

  // ---------- Totaux ----------
  const totalsX = W - M - 210;
  const rows = [['Total HT', fmt(d.totalHT)]];
  if (d.tvaActive) rows.push([`TVA (${d.tvaRate || TVA_PCT} %)`, fmt(d.tva)]);
  else rows.push(['TVA', 'Exonérée']);
  pdf.setFontSize(9);
  rows.forEach(([label, value]) => {
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...GRAY);
    pdf.text(label, totalsX, endY);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...DARK);
    pdf.text(value, W - M, endY, { align: 'right' });
    endY += 15;
  });
  pdf.setFillColor(...primary);
  pdf.rect(totalsX - 10, endY - 9, 230, 24, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(10);
  pdf.text(kind === 'facture' ? 'TOTAL À PAYER' : 'TOTAL TTC', totalsX, endY + 7);
  pdf.text(fmt(d.totalTTC), W - M, endY + 7, { align: 'right' });
  endY += 38;

  // Suivi du règlement (factures partiellement encaissées) : déjà réglé + reste dû.
  const paye = Number(d.montantPaye) || 0;
  if (kind === 'facture' && paye > 0 && paye < (d.totalTTC || 0)) {
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...GRAY);
    pdf.text('Déjà réglé', totalsX, endY);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...DARK);
    pdf.text(fmt(paye), W - M, endY, { align: 'right' });
    endY += 15;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...GRAY);
    pdf.text('Reste à payer', totalsX, endY);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...primary);
    pdf.text(fmt((d.totalTTC || 0) - paye), W - M, endY, { align: 'right' });
    endY += 24;
  }

  // ---------- Règlement + mentions ----------
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(...primary);
  pdf.text('Règlement', M, endY);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...GRAY);
  pdf.setFontSize(8);
  const reglement = company.momo
    ? `Mobile Money : ${company.momo}${company.momoNom ? ` (${company.momoNom})` : ''} — ou espèces à la livraison.`
    : 'Paiement comptant. Mobile Money ou espèces à la livraison.';
  pdf.text(reglement, M, endY + 12);
  const defaultMentions = kind === 'devis'
    ? `Devis valable ${d.validiteJours || 30} jours à compter de sa date d'émission. Prix exprimés en F CFA.`
    : 'Facture exonérée de TVA sur équipements solaires (sauf mention contraire). Prix en F CFA.';
  const mentions = company.conditions?.trim() || defaultMentions;
  pdf.text(pdf.splitTextToSize(mentions, W - 2 * M), M, endY + 24);

  // ---------- Pied de page ----------
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(...primary);
  pdf.text('MERCI DE VOTRE CONFIANCE', W / 2, H - 52, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(...GRAY);
  pdf.text(
    [name, company.telephone, company.email, company.adresse].filter(Boolean).join('  ·  '),
    W / 2, H - 38, { align: 'center' }
  );
  pdf.setFillColor(...secondary);
  pdf.rect(0, H - 12, W, 12, 'F');

  const fileName = `${title === 'FACTURE' ? 'Facture' : 'Devis'}-${d.numero}.pdf`;
  if (preview) return pdf.output('bloburl');
  pdf.save(fileName);
  return fileName;
}

/** Convertit un devis existant (Pro, manuel ou solaire) en lignes de document Pro. */
export function devisToLignes(devisDoc, products = []) {
  // Lignes déjà stockées (devis Pro ou devis édité) : on les prend telles quelles.
  if (Array.isArray(devisDoc.lignes) && devisDoc.lignes.length) {
    return devisDoc.lignes.map((l) => ({ designation: l.designation, qty: l.qty, pu: l.pu }));
  }
  if (devisDoc.type === 'solar' && devisDoc.quotation) {
    return [...devisDoc.quotation.components, ...(devisDoc.quotation.prestations || [])].map((c) => ({
      designation: c.name,
      qty: c.quantity,
      pu: c.unitPrice,
    }));
  }
  return (devisDoc.items || []).map(({ productId, qty }) => {
    const product = products.find((p) => p.id === productId);
    const pu = (devisDoc.unitPrices || {})[productId] ?? product?.basePrice ?? 0;
    return { designation: product?.name || 'Article', qty, pu };
  });
}
