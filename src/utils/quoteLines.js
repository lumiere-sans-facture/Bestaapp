import { TVA_RATE } from '../config/company';

export const QUOTE_UNITS = [
  { id: 'pcs', label: 'pcs' },
  { id: 'm', label: 'm' },
  { id: 'm2', label: 'm²' },
  { id: 'kg', label: 'kg' },
  { id: 'h', label: 'heure' },
  { id: 'forfait', label: 'forfait' },
];

export const TAX_RATES = [0, TVA_RATE];

export const quoteLineId = () => crypto.randomUUID();

export function normalizeQuoteLine(line = {}, { defaultTaxRate = 0 } = {}) {
  const qty = Number(line.qty);
  const pu = Number(line.pu);
  const taxRate = Number(line.taxRate);
  return {
    ...line,
    id: line.id || quoteLineId(),
    designation: String(line.designation || ''),
    itemType: line.itemType === 'service' ? 'service' : 'bien',
    qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
    unit: String(line.unit || (line.itemType === 'service' ? 'forfait' : 'pcs')),
    pu: Number.isFinite(pu) && pu >= 0 ? pu : 0,
    taxRate: Number.isFinite(taxRate) && taxRate >= 0 ? taxRate : defaultTaxRate,
  };
}

export function quoteLineTotals(line = {}) {
  const subtotalHT = (Number(line.qty) || 0) * (Number(line.pu) || 0);
  const tva = Math.round(subtotalHT * (Number(line.taxRate) || 0));
  return { subtotalHT, tva, totalTTC: subtotalHT + tva };
}

export function cleanQuoteLines(lines = []) {
  return lines
    .filter((line) => String(line.designation || '').trim())
    .map((line) => {
      const normalized = normalizeQuoteLine(line);
      return { ...normalized, designation: normalized.designation.trim() };
    });
}

export function moveQuoteLine(lines = [], from, to) {
  if (from === to || from < 0 || to < 0 || from >= lines.length || to >= lines.length) return lines;
  const next = [...lines];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function formatQuoteCurrency(amount, currency = 'XOF') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0).replace(/[\u00a0\u202f]/g, ' ');
}
