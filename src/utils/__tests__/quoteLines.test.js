import { describe, expect, it } from 'vitest';
import { cleanQuoteLines, moveQuoteLine, normalizeQuoteLine, quoteLineTotals } from '../quoteLines';

describe('lignes de devis', () => {
  it('normalise les anciens devis sans perdre leurs données', () => {
    const line = normalizeQuoteLine({ designation: 'Panneau', qty: '10', pu: '58000' }, { defaultTaxRate: 0.18 });
    expect(line).toMatchObject({ designation: 'Panneau', qty: 10, unit: 'pcs', pu: 58000, taxRate: 0.18, itemType: 'bien' });
    expect(line.id).toBeTruthy();
  });

  it('calcule le HT, la TVA et le TTC d’une ligne', () => {
    expect(quoteLineTotals({ qty: 2, pu: 1000, taxRate: 0.18 }))
      .toEqual({ subtotalHT: 2000, tva: 360, totalTTC: 2360 });
  });

  it('réorganise les lignes sans modifier le tableau source', () => {
    const source = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(moveQuoteLine(source, 2, 0).map((line) => line.id)).toEqual(['c', 'a', 'b']);
    expect(source.map((line) => line.id)).toEqual(['a', 'b', 'c']);
  });

  it('nettoie les lignes vides tout en conservant les métadonnées', () => {
    expect(cleanQuoteLines([
      { id: 'a', designation: '  Pose  ', itemType: 'service', qty: 1, unit: 'forfait', pu: 50000, taxRate: 0 },
      { id: 'b', designation: ' ', qty: 1, pu: 1000 },
    ])).toEqual([{ id: 'a', designation: 'Pose', itemType: 'service', qty: 1, unit: 'forfait', pu: 50000, taxRate: 0 }]);
  });
});
