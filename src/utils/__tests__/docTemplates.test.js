import { describe, it, expect } from 'vitest';
import { buildDocHtml, MODELS, modelsPour, normaliserModel } from '../docTemplates';
import { donneesDeDevis, donneesDeFacture, lignesDeDevis, totauxDe, nf, emetteurDe, eclaircir, apporteurDe } from '../docTemplates/shared';
import { CSS_SOBRE, COULEURS_SOBRE } from '../docTemplates/sobre';
import { COMPANY } from '../../config/company';

const LEAD = { name: 'Benz-Benz Radio', contact: 'Felix Sossa', phone: '+228 94 22 33 44', address: 'Lomé' };

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
  clientName: 'Felix Sossa', clientPhone: '+228 94 22 33 44', clientVille: 'Lomé',
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
  clientName: 'Felix Sossa', clientPhone: '+228 94 22 33 44', clientVille: 'Lomé',
  lignes: [{ designation: 'Kit solaire 5 kWh', qty: 1, pu: 1200000 }],
  tva: 0, tvaActive: false, totalHT: 1200000, totalTTC: 1200000,
};

const dataDevis = donneesDeDevis({ devis: DEVIS_SOLAIRE, company: COMPANY, lead: LEAD, partner: null });
const dataFacture = donneesDeFacture({ facture: FACTURE, company: COMPANY });

describe('catalogue de modèles', () => {
  it('expose trois modèles, Studio seul disponible côté public', () => {
    expect(MODELS.map((m) => m.id)).toEqual(['studio', 'vague', 'sobre']);
    expect(modelsPour('public').map((m) => m.id)).toEqual(['studio']);
    expect(modelsPour('pro').map((m) => m.id)).toEqual(['studio', 'vague', 'sobre']);
  });

  it('ramène les identifiants inconnus ou hérités sur Studio', () => {
    for (const legacy of ['couleur', 'moderne', undefined, null, 'inconnu']) {
      expect(normaliserModel(legacy)).toBe('studio');
    }
  });

  it('« Classique », remplacé, s’ouvre en Sobre (entreprises et factures déjà réglées)', () => {
    expect(normaliserModel('classique')).toBe('sobre');
    expect(normaliserModel('sobre')).toBe('sobre');
  });
});

describe('rendu des six combinaisons kind × model', () => {
  for (const model of ['studio', 'vague', 'sobre']) {
    for (const kind of ['devis', 'facture']) {
      it(`${kind} · ${model} produit un document complet`, () => {
        const html = buildDocHtml({ kind, model, data: kind === 'facture' ? dataFacture : dataDevis });
        expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
        expect(html.length).toBeGreaterThan(2000);
        expect(html).toContain('<section class="page">');
        // La police est SERVIE PAR L'APP : un document composé hors ligne doit
        // être identique à celui composé en ligne. Une dépendance à Google
        // Fonts faisait retomber le document en police système, sans bruit.
        expect(html).toContain("@font-face");
        expect(html).toContain('ibm-plex-sans-latin-600-normal.woff2');
        expect(html).not.toContain('fonts.googleapis.com');
        expect(html).toContain('tabular-nums');
        expect(html).toContain('width: 794px; height: 1123px');
        expect(html).toContain('Imprimer / Exporter en PDF');
      });
    }
  }
});

describe('libellés pilotés par le type de document', () => {
  it('un devis porte la série BS-… et jamais un numéro de facture', () => {
    for (const model of ['studio', 'vague', 'sobre']) {
      const html = buildDocHtml({ kind: 'devis', model, data: dataDevis });
      expect(html).toContain('DEVIS');
      expect(html).toContain('BS-20260315-0007');
      expect(html).not.toContain('FAC-');
      expect(html).toContain(model === 'sobre' ? 'Valable jusqu’au' : 'Valide jusqu’au');
    }
  });

  it('une facture porte la série FAC-… et jamais un numéro de devis', () => {
    for (const model of ['studio', 'vague', 'sobre']) {
      const html = buildDocHtml({ kind: 'facture', model, data: dataFacture });
      expect(html).toContain('FACTURE');
      expect(html).toContain('FAC-2026-014');
      expect(html).not.toContain('BS-2026');
      expect(html).toContain(model === 'sobre' ? 'Payable au 21/04/2026' : 'Échéance');
    }
  });

  it('les conditions d’une facture ne contiennent pas la validité 30 jours', () => {
    for (const model of ['studio', 'vague', 'sobre']) {
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
    for (const model of ['studio', 'vague', 'sobre']) {
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
    for (const model of ['studio', 'vague']) {
      const html = buildDocHtml({ kind: 'devis', model, data: dataDevis });
      expect(html).toContain('P.U. (F CFA)');
      expect(html).toContain('Total (F CFA)');
      // Aucune colonne de montant sans unité.
      expect(html).not.toMatch(/<th[^>]*>\s*P\.U\.\s*</);
    }
  });

  it('Sobre : colonnes « Prix unitaire » / « Prix total », la devise dite une fois', () => {
    const html = buildDocHtml({ kind: 'devis', model: 'sobre', data: dataDevis });
    expect(html).toContain('<th>Prix unitaire</th>');
    expect(html).toContain('<th>Prix total</th>');
    expect(html).toContain('TOTAL (F CFA)');
    expect(html).toContain('Franc CFA');
  });

  it('formate les milliers avec des espaces normalisées', () => {
    const html = buildDocHtml({ kind: 'devis', model: 'studio', data: dataDevis });
    expect(html).toContain('1 200 000');
    expect(html).not.toContain('1 200 000');
  });

  it('n’utilise ni ombre, ni dégradé, ni emoji', () => {
    for (const model of ['studio', 'vague', 'sobre']) {
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
    nomEntreprise: 'Soleil de la Kara', telephone: '+228 97 00 00 00', email: 'contact@kara.tg',
    adresse: 'Lomé', couleurPrimaire: '#1b7a43', couleurSecondaire: '#d43518',
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

  it('le modèle Sobre reste noir et blanc quelles que soient les couleurs', () => {
    const html = buildDocHtml({ kind: 'facture', model: 'sobre', data: facturePro });
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

describe('modèle Sobre — noir, blanc et gris', () => {
  const html = buildDocHtml({ kind: 'facture', model: 'sobre', data: dataFacture });
  const pagesDe = (h) => (h.match(/<section class="page">[\s\S]*?<\/section>/g) || []).join('');
  const normaliser = (c) => (c.length === 4 ? `#${[...c.slice(1)].map((x) => x + x).join('')}` : c).toLowerCase();

  it('n’emploie aucune couleur de marque', () => {
    expect(html).not.toContain('#0a2472');
    expect(html).not.toContain('#f5a623');
  });

  it('n’emploie que les couleurs autorisées — styles du modèle et pages', () => {
    // Le gris de l'écran autour des pages et le bouton « Imprimer » (styles
    // communs) ne s'impriment pas : seules les pages comptent.
    const couleurs = [...new Set([...(CSS_SOBRE + pagesDe(html)).matchAll(/#[0-9a-f]{3,6}\b/gi)].map((m) => normaliser(m[0])))];
    expect(couleurs.filter((c) => !COULEURS_SOBRE.includes(c))).toEqual([]);
    expect(couleurs.length).toBeGreaterThan(4);
  });

  it('se passe de logo et d’image', () => {
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('url(data:');
  });

  it('en-tête : nom en majuscules, slogan, titre, numéro, condition et date', () => {
    expect(CSS_SOBRE).toMatch(/\.nom \{[^}]*font-size: 28px[^}]*letter-spacing: 2px[^}]*text-transform: uppercase/);
    expect(html).toContain('<div class="titre">FACTURE</div>');
    expect(html).toContain('Facture n° FAC-2026-014');
    expect(html).toContain('Date : 22/03/2026');
    const sansEcheance = buildDocHtml({ kind: 'facture', model: 'sobre', data: { ...dataFacture, dateSecondaire: null } });
    expect(sansEcheance).toContain('Payable à réception');
  });

  it('bloc client : six libellés toujours présents, « — » quand la valeur manque', () => {
    for (const lib of ['Client', 'IFU', 'Adresse', 'Objet', 'Tél', 'Email']) expect(html).toContain(`<div class="lib">${lib}</div>`);
    expect(html).toContain('<div class="lib">IFU</div><div>—</div>');
    expect(html).toContain('Client ID');
    expect(html).toContain('Franc CFA');
  });

  it('repeint l’annexe « Ajustements du kit » aux couleurs de Sobre', () => {
    for (const regle of [/\.page\.annexe \{ color: #333333/, /\.annexe h2 \{ color: #111111/, /\.annexe td \{ border-bottom-color: #e3e3e3/]) {
      expect(CSS_SOBRE).toMatch(regle);
    }
  });

  it('n’emploie que les tailles 28 / 18 / 13 / 11 px', () => {
    const tailles = [...new Set([...CSS_SOBRE.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
    expect(tailles).toEqual([11, 13, 18, 28]);
  });
});

describe('modèle Sobre — dossier Felix Sossa (9 lignes, 1 200 000 F CFA)', () => {
  const NEUF = [
    { designation: 'Panneau photovoltaïque 620 Wc', qty: 4, pu: 70000 },
    { designation: 'Onduleur hybride 3 kVA', qty: 1, pu: 250000 },
    { designation: 'Batterie lithium 48V 100Ah', qty: 1, pu: 425000 },
    { designation: 'Coffret de protection DC/AC', qty: 1, pu: 45000 },
    { designation: 'Structure de montage galvanisée', qty: 1, pu: 60000 },
    { designation: 'Kit de câblage solaire', qty: 1, pu: 30000 },
    { designation: 'Mise à la terre (piquet et câble)', qty: 1, pu: 20000 },
    { designation: 'Main d’œuvre et installation', qty: 1, pu: 80000 },
    { designation: 'Mise en service et formation', qty: 1, pu: 10000 },
  ];
  const devis = donneesDeDevis({ devis: { ...DEVIS_LIBRE, lignes: NEUF }, company: COMPANY, lead: null, partner: null });
  const facture = donneesDeFacture({ facture: { ...FACTURE, lignes: NEUF }, company: COMPANY });

  it('la colonne Cat. est remplie pour les 9 lignes', () => {
    expect(devis.lignes.map((l) => l.categorie)).toEqual([
      'Panneau', 'Onduleur', 'Batterie', 'Protection', 'Structure', 'Câblage', 'Mise à la terre', 'Service', 'Service',
    ]);
    const html = buildDocHtml({ kind: 'devis', model: 'sobre', data: devis });
    const cats = [...html.matchAll(/<td class="cat">([^<]*)<\/td>/g)].map((m) => m[1]);
    expect(cats).toHaveLength(9);
    expect(cats.every(Boolean)).toBe(true);
  });

  it('la somme des lignes égale le total affiché, sur une seule page', () => {
    for (const [kind, data] of [['devis', devis], ['facture', facture]]) {
      const html = buildDocHtml({ kind, model: 'sobre', data });
      const totaux = [...html.matchAll(/<td class="num">([\d ]+)<\/td>\s*<\/tr>/g)].map((m) => Number(m[1].replace(/ /g, '')));
      expect(totaux).toHaveLength(9);
      expect(totaux.reduce((a, b) => a + b, 0)).toBe(1200000);
      expect(html).toContain('<span class="num montant">1 200 000</span>');
      expect((html.match(/<section class="page">/g) || [])).toHaveLength(1);
    }
  });

  it('un seul numéro, pas de montant en toutes lettres', () => {
    const html = buildDocHtml({ kind: 'devis', model: 'sobre', data: devis });
    expect(html).toContain('BS-20260320-0011');
    expect(html).not.toContain('FAC-');
    expect(html).not.toMatch(/million|mille/i);
  });
});

describe('pagination', () => {
  const vingt = Array.from({ length: 20 }, (_, i) => ({
    designation: `Article de catalogue numéro ${i + 1}`, qty: 1 + (i % 3), pu: 25000 + i * 1000,
  }));
  const data = { ...dataDevis, lignes: vingt, totaux: totauxDe(vingt) };

  it('répartit sur plusieurs pages en répétant l’en-tête de tableau', () => {
    for (const model of ['studio', 'vague', 'sobre']) {
      const html = buildDocHtml({ kind: 'devis', model, data });
      const pages = html.match(/<section class="page">/g) || [];
      expect(pages.length).toBeGreaterThan(1);
      // Un <thead> par page : l'en-tête se répète.
      const theads = html.match(/<thead>/g) || [];
      expect(theads.length).toBe(pages.length);
      if (model === 'sobre') {
        expect(html).toContain(`suite (page 2 / ${pages.length})`);
        expect(html.match(/TOTAL \(F CFA\)/g)).toHaveLength(1);
        expect(html.match(/Signature et cachet/g)).toHaveLength(1);
        expect(html.match(/class="pied/g)).toHaveLength(1);
      } else {
        expect(html).toContain(`Page 1 / ${pages.length}`);
        expect(html).toContain(`Page ${pages.length} / ${pages.length}`);
      }
      // Toutes les lignes sont présentes, aucune perdue au découpage.
      expect(html).toContain('Article de catalogue numéro 1<');
      expect(html).toContain('Article de catalogue numéro 20<');
    }
  });

  it('reste sur une seule page pour un document court', () => {
    for (const model of ['studio', 'vague', 'sobre']) {
      const html = buildDocHtml({ kind: 'devis', model, data: dataDevis });
      expect((html.match(/<section class="page">/g) || [])).toHaveLength(1);
    }
  });
});

describe('partenaire apporteur sur le devis', () => {
  const PARTENAIRE = { id: 'p1', name: 'Kodjo Agbeko', code: 'BS-KODJO' };
  // Sur sa ligne, juste avant le pied de page (qui cède son margin-top: auto).
  const PIED = /<div class="push"[^>]*>Réf\. partenaire : BS-KODJO<\/div>\s*<div class="(pied|legal) ">/;

  it('son code figure en pied de page des trois modèles', () => {
    const data = donneesDeDevis({ devis: { ...DEVIS_SOLAIRE, partnerId: 'p1', partnerCode: 'BS-KODJO' }, company: COMPANY, lead: LEAD, partner: PARTENAIRE });
    for (const m of MODELS) {
      const html = buildDocHtml({ kind: 'devis', model: m.id, data });
      expect(html).toMatch(PIED);
      expect(html.match(/Réf\. partenaire/g)).toHaveLength(1);
      expect(html.match(/class="push"/g)).toHaveLength(1);
    }
  });

  it('le code figé sur le devis suffit, même sans la fiche partenaire', () => {
    const data = donneesDeDevis({ devis: { ...DEVIS_SOLAIRE, partnerId: 'p1', partnerCode: 'BS-KODJO' }, company: COMPANY, lead: LEAD, partner: null });
    expect(data.apporteur).toEqual({ name: '', code: 'BS-KODJO' });
    expect(buildDocHtml({ kind: 'devis', model: 'studio', data })).toMatch(PIED);
  });

  it('Sobre : la référence prend la place d’une ligne sur la page unique', () => {
    const lignes = Array.from({ length: 9 }, (_, i) => ({ designation: `Article ${i}`, qty: 1, pu: 1000 }));
    const devis = { ...DEVIS_LIBRE, type: 'manuel', lignes, items: lignes.map((l) => ({ name: l.designation, qty: l.qty, price: l.pu })) };
    const pages = (d) => (buildDocHtml({ kind: 'devis', model: 'sobre', data: d }).match(/<section/g) || []).length;
    expect(pages(donneesDeDevis({ devis, company: COMPANY, lead: null, partner: null }))).toBe(1);
    expect(pages(donneesDeDevis({ devis: { ...devis, partnerCode: 'BS-KODJO' }, company: COMPANY, lead: null, partner: null }))).toBe(2);
  });

  it('le code figé prime sur le code actuel de la fiche', () => {
    expect(apporteurDe({ partnerCode: 'ANCIEN' }, { name: 'X', code: 'NOUVEAU' })).toEqual({ name: 'X', code: 'ANCIEN' });
  });

  it('sans code, le nom ; toujours échappé', () => {
    const data = donneesDeDevis({ devis: DEVIS_SOLAIRE, company: COMPANY, lead: LEAD, partner: { name: 'Jo & <i>Co</i>' } });
    expect(buildDocHtml({ kind: 'devis', model: 'sobre', data })).toContain('Réf. partenaire : Jo &amp; &lt;i&gt;Co&lt;/i&gt;');
  });

  it('rien sans partenaire, ni sur un devis Pro, ni sur une facture', () => {
    const sans = buildDocHtml({ kind: 'devis', model: 'studio', data: dataDevis });
    expect(sans).not.toContain('Réf. partenaire');
    expect(sans).toContain('class="pied push"');
    expect(apporteurDe({ type: 'pro', partnerCode: 'BS-KODJO' }, PARTENAIRE)).toBeNull();
    const facture = donneesDeFacture({ facture: { numero: 'FAC-2026-001', lignes: [] }, company: COMPANY });
    expect(buildDocHtml({ kind: 'facture', model: 'studio', data: facture })).not.toContain('Réf. partenaire');
  });
});
