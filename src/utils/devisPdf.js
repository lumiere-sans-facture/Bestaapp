import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { COMPANY } from '../config/company';

// Format de devis officiel BestaSolar (modèle « Énergie lumineuse sans facture »).
// Reproduit la mise en page du devis de référence : en-tête logo + contacts,
// bloc client / bloc devis, tableau ÉQUIPEMENTS / PRESTATIONS, totaux,
// informations de paiement et conditions générales.

const NAVY = [10, 36, 114];
const ACCENT = [245, 166, 35];
const GRAY = [107, 114, 128];
const LIGHT = [244, 246, 251];

const fmt = (n) => Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' F CFA';
const fmtDate = (d) => {
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
};
const qtyLabel = (q) => (q % 1 === 0 ? String(q) : q.toFixed(1));

/**
 * @param {object} devis    le devis enregistré (solaire ou manuel)
 * @param {object} lead     la piste cliente liée
 * @param {object} partner  le partenaire apporteur (ou null)
 * @param {Array}  products catalogue produits (pour résoudre les devis manuels)
 */
export function generateDevisPdf(devis, lead, partner, products = []) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;

  // ---------- En-tête ----------
  doc.setFillColor(...NAVY);
  doc.rect(M, 36, 34, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('BS', M + 17, 58, { align: 'center' });

  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text('BESTA', M + 44, 52);
  const bestaW = doc.getTextWidth('BESTA ');
  doc.setTextColor(...ACCENT);
  doc.text('SOLAR', M + 44 + bestaW, 52);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(COMPANY.slogan, M + 44, 64);

  doc.setFontSize(7.5);
  doc.text(`P. ${COMPANY.phone}  |  E. ${COMPANY.email}`, W - M, 48, { align: 'right' });
  doc.text(`W. ${COMPANY.website}  |  A. ${COMPANY.address}`, W - M, 60, { align: 'right' });

  doc.setDrawColor(...NAVY);
  doc.setLineWidth(2);
  doc.line(M, 84, W - M, 84);

  // ---------- Bloc client (gauche) ----------
  let y = 108;
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.setFont('helvetica', 'bold');
  doc.text('DEVIS ÉTABLI POUR', M, y);
  doc.setTextColor(20, 20, 40);
  doc.setFontSize(12);
  y += 16;
  doc.text(lead?.contact || 'Client', M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  y += 14;
  if (lead?.name) { doc.text(lead.name, M, y); y += 12; }
  if (lead?.phone) { doc.text(`P.  ${lead.phone}`, M, y); y += 12; }
  if (lead?.address) { doc.text(`A.  ${lead.address}`, M, y); y += 12; }
  if (partner || devis.partnerCode) {
    doc.setTextColor(...GRAY);
    doc.setFontSize(8);
    const code = devis.partnerCode || partner?.code || '';
    doc.text(`Réf. partenaire :  ${partner ? partner.name : ''}${code ? `  ·  ${code}` : ''}`, M, y + 2);
    y += 12;
  }

  // ---------- Bloc devis (droite) ----------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...NAVY);
  doc.text('DEVIS', W - M, 112, { align: 'right' });
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text('MONTANT TOTAL TTC', W - M, 126, { align: 'right' });
  doc.setFontSize(15);
  doc.setTextColor(...ACCENT);
  doc.text(fmt(devis.total), W - M, 142, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  const validUntil = new Date(devis.createdAt);
  validUntil.setDate(validUntil.getDate() + 30);
  const metaRows = [
    ['Date', fmtDate(devis.createdAt)],
    ["Valide jusqu'au", fmtDate(validUntil)],
    ['Numéro', devis.devisNumber || devis.id],
  ];
  let my = 158;
  metaRows.forEach(([label, value]) => {
    doc.setTextColor(...GRAY);
    doc.text(label, W - M - 150, my);
    doc.setTextColor(20, 20, 40);
    doc.setFont('helvetica', 'bold');
    doc.text(value, W - M, my, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    my += 13;
  });

  // ---------- Lignes du tableau ----------
  const body = [];
  let sl = 0;
  const sectionRow = (label) => [{
    content: label,
    colSpan: 5,
    styles: { fillColor: LIGHT, textColor: NAVY, fontStyle: 'bold', fontSize: 8, cellPadding: { top: 5, bottom: 5, left: 8 } },
  }];
  const itemRow = (item) => {
    sl += 1;
    const designation = item.description ? `${item.name}\n${item.description}` : item.name;
    return [String(sl), designation, fmt(item.unitPrice), qtyLabel(item.quantity), fmt(item.totalPrice)];
  };

  if (devis.type === 'solar' && devis.quotation) {
    body.push(sectionRow('ÉQUIPEMENTS'));
    devis.quotation.components.forEach((c) => body.push(itemRow(c)));
    body.push(sectionRow('PRESTATIONS'));
    (devis.quotation.prestations || []).forEach((c) => body.push(itemRow(c)));
  } else {
    body.push(sectionRow('ARTICLES'));
    (devis.items || []).forEach(({ productId, qty }) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;
      const unitPrice = devis.subtotal && devis.items.length
        ? Math.round(((devis.unitPrices || {})[productId] ?? product.basePrice))
        : product.basePrice;
      body.push(itemRow({
        name: product.name,
        description: product.description,
        quantity: qty,
        unitPrice,
        totalPrice: unitPrice * qty,
      }));
    });
  }

  autoTable(doc, {
    startY: Math.max(y, my) + 18,
    margin: { left: M, right: M },
    head: [['SL.', 'DÉSIGNATION', 'PRIX UNIT.', 'QTÉ', 'TOTAL']],
    body,
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: { top: 6, bottom: 6, left: 8, right: 8 }, textColor: [30, 30, 50] },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 85, halign: 'right' },
      3: { cellWidth: 40, halign: 'center' },
      4: { cellWidth: 90, halign: 'right' },
    },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    didParseCell: (data) => {
      // Descriptions sur 2e ligne en plus discret
      if (data.section === 'body' && data.column.index === 1 && typeof data.cell.raw === 'string' && data.cell.raw.includes('\n')) {
        data.cell.styles.fontSize = 8.5;
      }
    },
  });

  let endY = doc.lastAutoTable.finalY + 24;

  // ---------- Totaux (droite) ----------
  const totalRows = [];
  if (devis.type === 'solar' && devis.quotation) {
    totalRows.push(['Sous-total HT', fmt(devis.quotation.subtotalHT)]);
    if (devis.quotation.tva > 0) totalRows.push(['TVA (18 %)', fmt(devis.quotation.tva)]);
    if (devis.quotation.roi) totalRows.push(['ROI estimé', `${Math.round(devis.quotation.roi)} mois`]);
  } else {
    totalRows.push(['Sous-total', fmt(devis.subtotal)]);
    totalRows.push(['Mode de règlement', 'Comptant']);
  }

  const totalsX = W - M - 220;
  let ty = endY;
  doc.setFontSize(9);
  totalRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(label, totalsX, ty);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 40);
    doc.text(value, W - M, ty, { align: 'right' });
    ty += 16;
  });
  // Bande Total TTC
  doc.setFillColor(...NAVY);
  doc.rect(totalsX - 10, ty - 10, 230, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(devis.type === 'solar' ? 'Total TTC' : 'Total', totalsX, ty + 6);
  doc.text(fmt(devis.total), W - M, ty + 6, { align: 'right' });

  // ---------- Paiement + conditions (gauche) ----------
  let py = endY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text('Informations de Paiement', M, py);
  py += 14;
  doc.setFontSize(8);
  const payRows = [
    ['Banque :', COMPANY.bank.name],
    ['Compte :', COMPANY.bank.account],
    ['SWIFT :', COMPANY.bank.swift],
    ['Email :', COMPANY.email],
  ];
  payRows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAY);
    doc.text(label, M, py);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 50);
    doc.text(value, M + 48, py);
    py += 12;
  });

  py += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text('Conditions Générales', M, py);
  py += 12;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text(doc.splitTextToSize(COMPANY.terms, 280), M, py);

  // ---------- Pied de page ----------
  const H = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text('MERCI DE VOTRE CONFIANCE', W / 2, H - 64, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text(
    `BestaSolar  ·  ${COMPANY.phone}  ·  ${COMPANY.email}  ·  ${COMPANY.website}  ·  ${COMPANY.addressShort}`,
    W / 2, H - 50, { align: 'center' }
  );
  doc.setFillColor(...ACCENT);
  doc.rect(0, H - 14, W, 14, 'F');

  const fileName = `Devis-${devis.devisNumber || devis.id}.pdf`;
  doc.save(fileName);
  return fileName;
}
