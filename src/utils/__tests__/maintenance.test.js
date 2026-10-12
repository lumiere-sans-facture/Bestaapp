// Maintenance annuelle : 30 000 F sous 10 panneaux, puis 50 000 F + 2 000 F
// par panneau au-delà de 10 — une seule règle pour toute l'application.
import { describe, it, expect } from 'vitest';
import { calculMaintenanceAnnuelle, detailMaintenanceAnnuelle, BASE_PETIT, BASE, SEUIL, PAR_PANNEAU } from '../maintenance';
import { simulerRoi } from '../roi';
import { computeSheet } from '../sizingSheet/compute';
import { buildSizingSheetHtml } from '../sizingSheet';
import { buildQuotation, calculateSystemSize } from '../solarSizing';

describe('calculMaintenanceAnnuelle — exemples de contrôle', () => {
  it.each([
    [4, 30000],
    [9, 30000],
    [10, 50000],
    [11, 52000],
    [20, 70000],
    [30, 90000],
    [50, 130000],
    [100, 230000],
  ])('%i panneaux → %i F CFA/an', (n, attendu) => {
    expect(calculMaintenanceAnnuelle(n)).toBe(attendu);
  });

  it('constantes nommées de la règle', () => {
    expect({ BASE_PETIT, BASE, SEUIL, PAR_PANNEAU }).toEqual({ BASE_PETIT: 30000, BASE: 50000, SEUIL: 10, PAR_PANNEAU: 2000 });
  });

  it('nombre inconnu ou aberrant : le forfait des petits systèmes', () => {
    expect(calculMaintenanceAnnuelle(0)).toBe(30000);
    expect(calculMaintenanceAnnuelle(undefined)).toBe(30000);
    expect(calculMaintenanceAnnuelle(-5)).toBe(30000);
    expect(calculMaintenanceAnnuelle('12')).toBe(54000);
  });
});

describe('détail du calcul (fiche de dimensionnement)', () => {
  it('à partir de 10 panneaux seulement', () => {
    expect(detailMaintenanceAnnuelle(9)).toBeNull();
    expect(detailMaintenanceAnnuelle(10)).toBe('50 000 (forfait dès 10 panneaux)');
    expect(detailMaintenanceAnnuelle(11)).toBe('50 000 + 2 000 × 1 panneau supplémentaire');
    expect(detailMaintenanceAnnuelle(20)).toBe('50 000 + 2 000 × 10 panneaux supplémentaires');
  });

  it('mise en forme de l’écran appelant', () => {
    expect(detailMaintenanceAnnuelle(30, (v) => `${v}`)).toBe('50000 + 2000 × 20 panneaux supplémentaires');
  });
});

describe('un même système, une même maintenance partout', () => {
  const dossier = (numberOfPanels) => ({
    consumption: { day: 12, night: 3 }, sizing: { autonomyNights: 1, numberOfPanels, batteryCapacity: 0 },
    systemType: 'off-grid', panelName: 'Panneau 620W', sunHours: 4.3, batteries: [], cityName: 'Lomé', cityCountry: 'Togo',
  });

  it.each([4, 9, 10, 11, 20, 30, 50, 100])('%i panneaux : simulateur = fiche = devis sur mesure', (n) => {
    const attendu = calculMaintenanceAnnuelle(n);
    expect(simulerRoi({ nbPanneaux: n }).maintenance).toBe(attendu);
    expect(computeSheet(dossier(n)).renta.maintenanceAnnuelle).toBe(attendu);
    const sizing = { ...calculateSystemSize({ day: 5, night: 5 }, 'off-grid', 5.5), numberOfPanels: n };
    expect(buildQuotation(sizing, { products: [] }).maintenanceCost).toBe(attendu);
  });

  it('fiche imprimée : le montant formaté, et le détail à partir de 10 panneaux', () => {
    // (Espaces fines insécables de la fiche ramenées à des espaces simples.)
    const fiche = (n) => buildSizingSheetHtml({ ...dossier(n), client: { name: 'Client' }, appliances: [], consumption: { day: 12, night: 3 } })
      .replace(/[\u202f\u00a0]/g, ' ');
    expect(fiche(20)).toContain('Maintenance (70 000 F CFA/an dès la 2ᵉ année)');
    expect(fiche(20)).toContain('<span class="muted">50 000 + 2 000 × 10 panneaux supplémentaires</span>');
    expect(fiche(9)).toContain('Maintenance (30 000 F CFA/an dès la 2ᵉ année)');
    expect(fiche(9)).not.toContain('panneaux supplémentaires');
  });
});
