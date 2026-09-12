import { describe, expect, it } from 'vitest';
import { lignesDepuisDevisKit, lignesModifiables } from '../EditableQuotation';

describe('proposition de devis modifiable', () => {
  it('reprend les équipements et les prestations du kit avec leurs prix unitaires', () => {
    const lines = lignesDepuisDevisKit({
      components: [{ name: 'Panneau 620 W', quantity: 4, unitPrice: 95000 }],
      prestations: [{ name: 'Installation', quantity: 1, unitPrice: 150000 }],
    });

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ designation: 'Panneau 620 W', qty: 4, pu: 95000 });
    expect(lines[1]).toMatchObject({ designation: 'Installation', qty: 1, pu: 150000 });
    expect(lines[0].id).not.toBe(lines[1].id);
  });

  it('copie une composition professionnelle sans modifier les lignes sources', () => {
    const source = [{ designation: 'Batterie', qty: 2, pu: 300000 }];
    const editable = lignesModifiables(source);

    expect(editable[0]).toMatchObject(source[0]);
    expect(editable[0]).not.toBe(source[0]);
    expect(typeof editable[0].id).toBe('string');
  });
});
