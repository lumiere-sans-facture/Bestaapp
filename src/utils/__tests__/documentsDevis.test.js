// Documents d'un devis envoyés au client : nom du fichier, message WhatsApp,
// et fiche de dimensionnement reconstituée depuis un devis ENREGISTRÉ — elle
// doit dire la même chose que celle produite dans l'assistant.
import { describe, it, expect } from 'vitest';
import { segmentFichier, nomFichierPdf } from '../nomFichier';
import { devisEnvoiMessage } from '../affaires';
import { factureEnvoiMessage } from '../paiement';
import { capturerDimensionnement } from '../dimensionnement';
import { consommationEtude, donneesFiche, donneesFicheDepuisDevis, picDeCharge, materielCalcule } from '../sizingSheet/donnees';
import { calculateSystemSize } from '../solarSizing';

describe('nom de fichier', () => {
  it('sans accents ni ponctuation', () => {
    expect(segmentFichier('Kossi Adjé & fils')).toBe('Kossi-Adje-fils');
    expect(segmentFichier('  ')).toBe('');
    expect(nomFichierPdf('Devis', 'BS-20261009-0001', 'Kossi Adjé')).toBe('Devis-BS-20261009-0001-Kossi-Adje.pdf');
    expect(nomFichierPdf('Devis', '', null)).toBe('Devis.pdf');
    expect(nomFichierPdf()).toBe('document.pdf');
  });
});

describe('message d’envoi du devis', () => {
  it('présente le PDF joint, le montant et la validité', () => {
    const m = devisEnvoiMessage({ devisNumber: 'BS-20261009-0001', total: 1250000, date: '2026-10-09', validiteJours: 30 }, { name: 'Kossi' });
    expect(m).toMatch(/^Bonjour Kossi,/);
    expect(m).toMatch(/ci-joint votre devis BS-20261009-0001 d'un montant de 1[\s  ]250[\s  ]000/);
    expect(m).toMatch(/valable jusqu'au/);
  });
  it('sans nom ni numéro, reste correct', () => {
    const m = devisEnvoiMessage({ total: 1000 });
    expect(m).toMatch(/^Bonjour,/);
    expect(m).not.toMatch(/devis {2}/);
  });
});

describe('envoi des documents Pro', () => {
  const ENTREPRISE = { nomEntreprise: 'Lumière Sans Facture', momo: '+228 90 11 22 33', momoNom: 'L. S. F.' };

  it('le devis Pro est signé par l’entreprise de l’abonné, pas par BestaSolar', () => {
    const m = devisEnvoiMessage({ devisNumber: 'BS-20261009-0002', total: 500000, clientName: 'Felix Sossa' }, null, ENTREPRISE.nomEntreprise);
    expect(m).toMatch(/^Bonjour Felix Sossa,/);
    expect(m.split('\n').at(-1)).toBe('Lumière Sans Facture');
    expect(m).not.toMatch(/BestaSolar/);
  });

  it('facture à régler : montant, échéance et Mobile Money', () => {
    const m = factureEnvoiMessage({ numero: 'FAC-2026-014', clientName: 'Felix Sossa', totalTTC: 1200000, statut: 'emise', echeance: '2026-11-08T00:00:00.000Z' }, ENTREPRISE);
    expect(m).toMatch(/^Bonjour Felix Sossa,/);
    expect(m).toMatch(/ci-joint votre facture FAC-2026-014 d'un montant de 1[\s  ]200[\s  ]000 F CFA\./);
    expect(m).toMatch(/À régler avant le \d{2}\/\d{2}\/2026\./);
    expect(m).toContain('Règlement Mobile Money : +228 90 11 22 33 (L. S. F.).');
    expect(m).not.toMatch(/Reste à régler/);
    expect(m.split('\n').at(-1)).toBe('Lumière Sans Facture');
  });

  it('facture partiellement réglée : le reste dû', () => {
    const m = factureEnvoiMessage({ numero: 'FAC-1', totalTTC: 100000, montantPaye: 40000, statut: 'emise' }, ENTREPRISE);
    expect(m).toMatch(/^Bonjour,/);
    expect(m).toMatch(/Reste à régler : 60[\s  ]000 F CFA\./);
  });

  it('facture soldée : ni échéance ni moyen de paiement', () => {
    const m = factureEnvoiMessage({ numero: 'FAC-2', totalTTC: 100000, montantPaye: 100000, statut: 'payee', echeance: '2026-11-08' }, ENTREPRISE);
    expect(m).toContain('Elle est intégralement réglée.');
    expect(m).not.toMatch(/À régler|Mobile Money/);
  });
});

const APPAREILS = [
  { rowId: 1, name: 'Réfrigérateur', power: 150, quantity: 1, day: 10, night: 10 },
  { rowId: 2, name: 'Ampoule LED', power: 10, quantity: 6, day: 0, night: 5 },
];

describe('consommation de l’étude', () => {
  it('selon le mode de saisie', () => {
    expect(consommationEtude({ consoMode: 'appareils', rows: APPAREILS })).toEqual({ day: 1.5, night: 1.8 });
    expect(consommationEtude({ consoMode: 'direct', manual: { day: '4', night: '2.5' } })).toEqual({ day: 4, night: 2.5 });
    expect(picDeCharge(APPAREILS)).toBe(210);
  });
});

describe('fiche reconstituée depuis un devis enregistré', () => {
  const dimensionnement = capturerDimensionnement({
    consoMode: 'appareils', rows: APPAREILS, systemType: 'off-grid', autonomyNights: 1, sunHours: 5.2,
    location: { name: 'Lomé', lat: 6.13, lon: 1.22 }, solar: { source: 'pvgis' },
  });
  const devis = {
    id: 'd1', type: 'solar', total: 2400000, partnerCode: 'ADJ-123456',
    consumption: { day: 1.5, night: 1.8 },
    quotation: { components: [{ name: 'Onduleur hybride 3kVA', quantity: 1, unitPrice: 300000, totalPrice: 300000 }] },
    dimensionnement,
  };

  it('null sans étude (devis manuel, ancien devis)', () => {
    expect(donneesFicheDepuisDevis({ type: 'manual', total: 1 })).toBeNull();
    expect(donneesFicheDepuisDevis({ type: 'solar', total: 1 })).toBeNull();
  });

  it('même contenu que la fiche produite dans l’assistant', () => {
    const lead = { name: 'Kossi', phone: '+22890000000', address: 'Adidogomé' };
    const fiche = donneesFicheDepuisDevis(devis, { lead, partner: { name: 'Adjé', code: 'ANCIEN' } });
    const sizing = calculateSystemSize({ day: 1.5, night: 1.8 }, 'off-grid', 5.2, undefined, 1, { peakLoad: 210, inverters: [] });
    const attendu = donneesFiche({
      lead, apporteur: { name: 'Adjé', code: 'ADJ-123456' }, rows: dimensionnement.appareils, consoMode: 'appareils',
      consumption: { day: 1.5, night: 1.8 }, systemType: 'off-grid', sunHours: 5.2,
      location: dimensionnement.location, solarSource: 'pvgis', sizing, investissement: 2400000, provisionOnduleur: 300000,
    });
    expect(fiche).toEqual(attendu);
    expect(fiche.client).toEqual({ name: 'Kossi', phone: '+22890000000', ville: 'Adidogomé' });
    expect(fiche.cityName).toBe('Lomé');
    expect(fiche.apporteur.code).toBe('ADJ-123456'); // le code figé sur le devis prime
    expect(fiche.rentabilite).toEqual({ provisionOnduleur: 300000 });
    expect(fiche.manualMode).toBe(false);
  });

  it('sans consommation enregistrée, la recalcule depuis les appareils', () => {
    const fiche = donneesFicheDepuisDevis({ ...devis, consumption: null });
    expect(fiche.consumption).toEqual({ day: 1.5, night: 1.8 });
  });
});

describe('matériel de la fiche : celui du calcul, jamais celui d’un kit', () => {
  const sizing = calculateSystemSize({ day: 9, night: 6 }, 'off-grid', 5.2, undefined, 1, { peakLoad: 1500 });

  it('reprend le calibre d’onduleur et le parc batterie prescrits', () => {
    const m = materielCalcule(sizing);
    expect(m.inverter).toEqual({ capacity: sizing.inverter.capacity, maxPvPower: sizing.inverter.maxPvPower || null, quantite: sizing.inverterQuantite });
    expect(m.batteries).toEqual(sizing.batteries.map((b) => ({ capacity: b.capacity, qty: b.quantity })));
    expect(m.batteries.reduce((s, b) => s + b.capacity * b.qty, 0)).toBeGreaterThan(0);
    // Aucune désignation commerciale : la fiche ne parle que de grandeurs.
    expect(JSON.stringify(m)).not.toMatch(/kit|model|brand/i);
  });

  it('la fiche de l’assistant et celle de la liste partagent ce matériel', () => {
    const d = donneesFiche({ rows: [], consoMode: 'direct', consumption: { day: 9, night: 6 }, systemType: 'off-grid', sunHours: 5.2, sizing });
    expect({ inverter: d.inverter, batteries: d.batteries }).toEqual(materielCalcule(sizing));
  });

  it('sans onduleur calculé, la fiche n’en invente pas', () => {
    expect(materielCalcule({ ...sizing, inverter: null }).inverter).toBeNull();
  });
});
