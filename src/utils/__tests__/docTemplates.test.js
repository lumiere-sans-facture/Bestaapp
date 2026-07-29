import { describe, it, expect } from 'vitest';
import { buildDocHtml, MODELS, modelsPour, normaliserModel } from '../docTemplates';
import { donneesDeDevis, donneesDeFacture, lignesDeDevis, totauxDe, nf, emetteurDe, eclaircir } from '../docTemplates/shared';
import { COMPANY } from '../../config/company';

const LEAD = { name: 'Benz-Benz Radio', contact: 'Felix Sossa', phone: '+229 94 22 33 44', address: 'Parakou' };

// Devis solaire : lignes issues du chiffrage (composants + prestations).
const DEVIS_SOLAIRE = {
  devisNumber: 'BS-20260315-0007',
  createdAt: '2026-03-15T09:00:00.000Z',
  type: 'solar',
  quotation: {
    components: [
      { name: 'Panneau photovoltaïque 620 Wc', quantity: 9, unitPrice: 70000 },
      { name: 'Onduleur hybride 5 kVA', quantity: 1, unitPrice: 380000 },
    ],
    prestations: [{ name: 'Main d’œuvre et installation', quantity: 1, unitPrice: 190000 }],
    tva: 0,
  },
  total: 1200000,
};

// Devis à lignes libres (espace Pro).
const DEVIS_LIBRE = {
  devisNumber: 'BS-20260320-0011',
  createdAt: '2026-03-20T09:00:00.000Z',
  type: 'pro',
  clientName: 'Felix Sossa', clientPhone: '+229 94 22 33 44', clientVille: 'Parakou',
  lignes: [
    { designation: 'Batterie lithium 48V 100Ah', qty: 2, pu: 425000 },
    { designation: 'Coffret de protection DC/AC', qty: 1, pu: 85000 },
  ],
  tva: 0,
};

const FACTURE = {
  numero: 'FAC-2026-014',
  createdAt: '2026-03-22T09:00:00.000Z',
  echeance: '2026-04-21',
  clientName: 'Felix Sossa', clientPhone: '+229 94 22 33 44', clientVille: 'Parakou',
  lignes: [{ designation: 'Kit solaire 5 kWh', qty: 1, pu: 1200000 }],
  tva: 0, tvaActive: false, totalHT: 1200000, totalTTC: 1200000,
};

const dataDevis = donneesDeDevis({ devis: DEVIS_SOLAIRE, company: COMPANY, lead: LEAD, partner: null });
const dataFacture = donneesDeFacture({ facture: FACTURE, company: COMPANY });

describe('catalogue de modèles', () => {
  it('expose trois modèles, Studio seul disponible côté public', () => {
    expect(MODELS.map((m) => m.id)).toEqual(['studio', 'vague', 'classique']);
    expect(modelsPour('public').map((m) => m.id)).toEqual(['studio']);
    expect(modelsPour('pro').map((m) => m.id)).toEqual(['studio', 'vague', 'classique']);
  });

  it('ramène les identifiants inconnus ou hérités sur Studio', () => {
    for (const legacy of ['couleur', 'sobre', 'moderne', undefined, null, 'inconnu']) {
      expect(normaliserModel(legacy)).toBe('studio');
    }
  });
});

describe('rendu des six combinaisons kind × model', () => {
  for (const model of ['studio', 'vague', 'classique']) {
    for (const kind of ['devis', 'facture']) {
      it(`${kind} · ${model} produit un document complet`, () => {
        const html = buildDocHtml({ kind, model, data: kind === 'facture' ? dataFacture : dataDevis });
        expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
        expect(html.length).toBeGreaterThan(2000);
        expect(html).toContain('<section class="page">');
        expect(html).toContain('IBM+Plex+Sans');
        expect(html).toContain('tabular-nums');
        expect(html).toContain('width: 794px; height: 1123px');
        expect(html).toContain('Imprimer / Exporter en PDF');
      });
    }
  }
});

describe('libellés pilotés par le type de document', () => {
  it('un devis porte la série BS-… et jamais un numéro de facture', () => {
    for (const model of ['studio', 'vague', 'classique']) {
      const html = buildDocHtml({ kind: 'devis', model, data: dataDevis });
      expect(html).toContain('DEVIS');
      expect(html).toContain('BS-20260315-0007');
      expect(html).not.toContain('FAC-');
      expect(html).toContain('Valide jusqu’au');
    }
  });

  it('une facture porte la série FAC-… et jamais un numéro de devis', () => {
    for (const model of ['studio', 'vague', 'classique']) {
      const html = buildDocHtml({ kind: 'facture', model, data: dataFacture });
      expect(html).toContain('FACTURE');
      expect(html).toContain('FAC-2026-014');
      expect(html).not.toContain('BS-2026');
      expect(html).toContain('Échéance');
    }
  });

  it('les conditions d’une facture ne contiennent pas la validité 30 jours', () => {
    for (const model of ['studio', 'vague', 'classique']) {
      const facture = buildDocHtml({ kind: 'facture', model, data: dataFacture });
      expect(facture).not.toMatch(/valable 30 jours/i);
      const devis = buildDocHtml({ kind: 'devis', model, data: dataDevis });
      expect(devis).toMatch(/valable 30 jours/i);
    }
  });
});

describe('cohérence des montants', () => {
  it('la somme des lignes égale le total affiché — devis solaire', () => {
    const lignes = lignesDeDevis(DEVIS_SOLAIRE);
    const somme = lignes.reduce((s, l) => s + l.pu * l.qty, 0);
    expect(somme).toBe(1200000);
    expect(dataDevis.totaux.totalTTC).toBe(somme);
    for (const model of ['studio', 'vague', 'classique']) {
      expect(buildDocHtml({ kind: 'devis', model, data: dataDevis })).toContain(nf(somme));
    }
  });

  it('la somme des lignes égale le total affiché — devis à lignes libres', () => {
    const data = donneesDeDevis({ devis: DEVIS_LIBRE, company: COMPANY, lead: null, partner: null });
    const somme = DEVIS_LIBRE.lignes.reduce((s, l) => s + l.pu * l.qty, 0);
    expect(data.totaux.totalTTC).toBe(somme);
    expect(buildDocHtml({ kind: 'devis', model: 'studio', data })).toContain(nf(somme));
  });

  it('ajoute la TVA au total quand elle est due', () => {
    const t = totauxDe([{ designation: 'x', qty: 2, pu: 100000 }], { tva: 36000, tvaActive: true });
    expect(t.totalHT).toBe(200000);
    expect(t.totalTTC).toBe(236000);
  });
});

describe('unités et lisibilité', () => {
  it('porte l’unité F CFA dans les en-têtes de colonnes montants', () => {
    for (const model of ['studio', 'vague', 'classique']) {
      const html = buildDocHtml({ kind: 'devis', model, data: dataDevis });
      expect(html).toContain('P.U. (F CFA)');
      expect(html).toContain('Total (F CFA)');
      // Aucune colonne de montant sans unité.
      expect(html).not.toMatch(/<th[^>]*>\s*P\.U\.\s*</);
    }
  });

  it('formate les milliers avec des espaces normalisées', () => {
    const html = buildDocHtml({ kind: 'devis', model: 'studio', data: dataDevis });
    expect(html).toContain('1 200 000');
    expect(html).not.toContain('1 200 000');
  });

  it('n’utilise ni ombre, ni dégradé, ni emoji', () => {
    for (const model of ['studio', 'vague', 'classique']) {
      const html = buildDocHtml({ kind: 'devis', model, data: dataDevis });
      expect(html).not.toContain('box-shadow');
      expect(html).not.toContain('gradient');
      expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}☀-➿]/u);
    }
  });
});

describe('couleurs de marque de l’émetteur', () => {
  // Entreprise Pro avec sa propre identité visuelle (vert / rouge).
  const companyPro = {
    nomEntreprise: 'Soleil du Borgou', telephone: '+229 97 00 00 00', email: 'contact@borgou.bj',
    adresse: 'Parakou', couleurPrimaire: '#1b7a43', couleurSecondaire: '#d43518',
  };
  const facturePro = donneesDeFacture({
    facture: { numero: 'FAC-2026-020', createdAt: '2026-03-25T09:00:00.000Z', clientName: 'Client', lignes: [{ designation: 'Kit', qty: 1, pu: 500000 }] },
    company: companyPro,
  });

  it('les documents Pro portent les couleurs de l’abonné, pas celles par défaut', () => {
    for (const model of ['studio', 'vague']) {
      const html = buildDocHtml({ kind: 'facture', model, data: facturePro });
      expect(html).toContain('#1b7a43');
      expect(html).toContain('#d43518');
      expect(html).not.toContain('#0a2472');
      expect(html).not.toContain('#f5a623');
    }
  });

  it('l’espace public garde la palette BestaSolar', () => {
    for (const model of ['studio', 'vague']) {
      const html = buildDocHtml({ kind: 'devis', model, data: dataDevis });
      expect(html).toContain('#0a2472');
    }
  });

  it('le modèle Classique reste noir et blanc quelles que soient les couleurs', () => {
    const html = buildDocHtml({ kind: 'facture', model: 'classique', data: facturePro });
    expect(html).not.toContain('#1b7a43');
    expect(html).not.toContain('#d43518');
  });

  it('rejette une couleur invalide et retombe sur la palette par défaut', () => {
    const e = emetteurDe({ nomEntreprise: 'X', couleurPrimaire: 'red;} body{display:none', couleurSecondaire: '#12345' });
    expect(e.couleurPrimaire).toBe('#0a2472');
    expect(e.couleurSecondaire).toBe('#f5a623');
  });

  it('éclaircit une couleur en restant un hexadécimal valide', () => {
    expect(eclaircir('#0a2472', 0.24)).toMatch(/^#[0-9a-f]{6}$/);
    expect(eclaircir('#000000', 1)).toBe('#ffffff');
  });
});

describe('modèle Classique — noir et blanc', () => {
  const html = buildDocHtml({ kind: 'facture', model: 'classique', data: dataFacture });

  it('n’emploie aucune couleur de marque', () => {
    expect(html).not.toContain('#0a2472');
    expect(html).not.toContain('#f5a623');
  });

  it('n’emploie que des gris et les deux bleus très clairs déclarés', () => {
    const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
    const couleurs = [...new Set(css.match(/#[0-9a-f]{3,6}/gi) || [])].map((c) => c.toLowerCase());
    const autorisees = ['#212529', '#666666', '#888888', '#808080', '#e0eefb', '#e7eff7', '#fff', '#ffffff', '#eceef2'];
    expect(couleurs.filter((c) => !autorisees.includes(c))).toEqual([]);
  });

  it('quadrille entièrement le tableau et se passe de logo', () => {
    expect(html).toContain('border: 1px solid #888888');
    expect(html).not.toContain('<img');
  });
});

describe('pagination', () => {
  const vingt = Array.from({ length: 20 }, (_, i) => ({
    designation: `Article de catalogue numéro ${i + 1}`, qty: 1 + (i % 3), pu: 25000 + i * 1000,
  }));
  const data = { ...dataDevis, lignes: vingt, totaux: totauxDe(vingt) };

  it('répartit sur plusieurs pages en répétant l’en-tête de tableau', () => {
    for (const model of ['studio', 'vague', 'classique']) {
      const html = buildDocHtml({ kind: 'devis', model, data });
      const pages = html.match(/<section class="page">/g) || [];
      expect(pages.length).toBeGreaterThan(1);
      // Un <thead> par page : l'en-tête se répète.
      const theads = html.match(/<thead>/g) || [];
      expect(theads.length).toBe(pages.length);
      expect(html).toContain(`Page 1 / ${pages.length}`);
      expect(html).toContain(`Page ${pages.length} / ${pages.length}`);
      // Toutes les lignes sont présentes, aucune perdue au découpage.
      expect(html).toContain('Article de catalogue numéro 1<');
      expect(html).toContain('Article de catalogue numéro 20<');
    }
  });

  it('reste sur une seule page pour un document court', () => {
    for (const model of ['studio', 'vague', 'classique']) {
      const html = buildDocHtml({ kind: 'devis', model, data: dataDevis });
      expect((html.match(/<section class="page">/g) || [])).toHaveLength(1);
    }
  });
});
