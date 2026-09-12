import { formatQuoteCurrency } from '../../utils/quoteLines';

export default function QuoteTotals({ totals, currency = 'XOF' }) {
  return (
    <div className="quote-totals" aria-live="polite">
      <div><span>Total hors TVA</span><span>{formatQuoteCurrency(totals.totalHT, currency)}</span></div>
      <div><span>TVA</span><span>{formatQuoteCurrency(totals.tva, currency)}</span></div>
      <div className="quote-total-main"><strong>Total TTC</strong><strong>{formatQuoteCurrency(totals.totalTTC, currency)}</strong></div>
    </div>
  );
}
