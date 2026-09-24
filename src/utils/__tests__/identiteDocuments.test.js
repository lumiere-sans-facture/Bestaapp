import { describe, it, expect } from 'vitest';
import { buildDocHtml, donneesDeDevis } from '../docTemplates';
import { COMPANY, TELEPHONES_DOCUMENTS } from '../../config/company';
import { LOGO_BESTASOLAR } from '../../assets/logoBestaSolar';

// Identité imprimée sur les devis et factures BestaSolar : l'entité togolaise,
// ses deux numéros et le logo BestaSolar Pro — sur les TROIS modèles.
const devis = {
  id: 'd1', devisNumber: 'BS-20260925-0001', createdAt: '2026-09-25T10:00:00.000Z', type: 'cash',
  lignes: [{ designation: 'Panneau 580 Wc', qty: 2, pu: 70000 }],
};

describe('identité BestaSolar sur les documents', () => {
  it('BESTA SOLAR TOGO, RCCM et NIF togolais, adresse de Lomé', () => {
    expect(COMPANY.name).toBe('BESTA SOLAR TOGO');
    expect(COMPANY.rccm).toBe('TG-LFW-01-2025-A10-01086');
    expect(COMPANY.ifu).toBe('1002023475');
    expect(COMPANY.address).toContain('Lomé');
  });

  it('les deux numéros, Togo et Bénin, sont imprimés', () => {
    // Insécables DANS chaque numéro, coupure possible seulement entre les deux.
    expect(TELEPHONES_DOCUMENTS).toBe('+228\u00A0799\u00A0802\u00A0090 / +229\u00A001\u00A061\u00A073\u00A029\u00A056');
    // Le numéro des liens WhatsApp reste UN numéro exploitable.
    expect(COMPANY.phone.replace(/\D/g, '')).toMatch(/^229\d{10}$/);
  });

  // Les écrans passent COMPANY lui-même comme émetteur (Devis.jsx) : c'est
  // CE cas qui doit imprimer les deux numéros, pas seulement le repli.
  for (const [model, company] of [['studio', COMPANY], ['studio', null], ['vague', COMPANY], ['classique', COMPANY]]) {
    it(`modèle « ${model} » (émetteur ${company ? 'COMPANY' : 'par défaut'}) : deux numéros, RCCM et NIF`, () => {
      const html = buildDocHtml({ kind: 'devis', model, data: donneesDeDevis({ devis, company, lead: null, products: [] }) })
        .replace(/\u00A0|&nbsp;/g, ' ');
      // « Classique » est sans logo par conception (document administratif) ;
      // les devis BestaSolar utilisent « Studio ».
      if (model !== 'classique') expect(html).toContain(LOGO_BESTASOLAR.slice(0, 80));
      expect(html).toContain('+228 799 802 090');
      expect(html).toContain('+229 01 61 73 29 56');
      expect(html).toContain('TG-LFW-01-2025-A10-01086');
      expect(html).toContain('1002023475');
      expect(html).not.toMatch(/RB\/PKO|0202274882317|Cotonou Saint Rita/);
    });
  }
});
