import { describe, it, expect } from 'vitest';
import { buildFicheTechniqueHtml } from '../ficheTechniqueHtml';
import { dimensionner } from '../dimensionnementV2';

const SITE = {
  nom: 'Parakou',
  productibleMensuel: [5.1, 5.3, 5.2, 4.9, 4.7, 4.3, 4.0, 3.9, 4.4, 4.8, 5.0, 5.0],
  source: 'PVGIS',
};

const dim = dimensionner({
  equipements: [
    { nom: 'Climatiseur 1.5 CV', puissanceW: 1100, quantite: 2, heuresJour: 3, heuresNuit: 4, demarrage: true },
    { nom: 'Réfrigérateur', puissanceW: 250, quantite: 1, heuresJour: 12, heuresNuit: 12 },
  ],
  site: SITE,
  tensionSysteme: 48,
  distances: { pvOnduleurM: 25, batterieOnduleurM: 3, onduleurTableauM: 12 },
  materiel: {
    panneau: { puissanceWc: 620, voc: 41.5, vmp: 34.5, isc: 18.9, imp: 17.9, coeffVoc: -0.27, coeffVmp: -0.35 },
    batterie: { capaciteKwh: 5, dod: 0.8, rendement: 0.975, cRateChargeMax: 0.5 },
    catalogueOnduleurs: [
      { id: '5k', kva: 5, puissanceW: 5000, surgeW: 10000, pvMaxWc: 6500, vDcMax: 500, vMpptMin: 120, iMppt: 26, iChargeMax: 110 },
      { id: '8k', kva: 8, puissanceW: 8000, surgeW: 16000, pvMaxWc: 10400, vDcMax: 550, vMpptMin: 150, iMppt: 26, iChargeMax: 190 },
    ],
    nbPanneauxImpose: 12,
    kitNom: 'Kit 20 kWh',
  },
});

const MARQUES = ['Felicity', 'Taico', 'Growatt', 'Itel', 'Luxsun', 'Must', 'Deye', 'Pylontech', 'Jinko', 'Marstek', 'Victron'];

const client = { name: 'Kossi Agboka', phone: '+229 96 11 22 33', ville: 'Parakou' };
const html = buildFicheTechniqueHtml({ dim, client, apporteur: { name: 'Aminata Kesso', code: 'BESTA-AMINATA' } });

describe('fiche technique — version client', () => {
  it('porte les huit sections attendues, dans l’ordre', () => {
    const titres = [
      '1 · Bilan de consommation', '2 · Hypothèses de calcul', '3 · Résultats du dimensionnement',
      '4 · Vérifications de compatibilité', '5 · Câblage', '6 · Récapitulatif matériel',
      '7 · Production estimée', '8 · Références normatives',
    ];
    let position = 0;
    for (const titre of titres) {
      const i = html.indexOf(titre);
      expect(i, titre).toBeGreaterThan(position);
      position = i;
    }
  });

  it('détaille le bilan : sous-totaux, pointe simultanée et appel au démarrage', () => {
    expect(html).toContain('Consommation en journée');
    expect(html).toContain('Consommation nocturne');
    expect(html).toContain('Puissance de pointe simultanée');
    expect(html).toContain('Puissance d’appel au démarrage');
    expect(html).toContain('(démarrage moteur)'); // marqueur sur la ligne climatiseur
  });

  it('nomme correctement les rendements et bannit « rendement des panneaux »', () => {
    expect(html).toContain('Rendement de chaîne en journée');
    expect(html).toContain('Rendement de chaîne la nuit');
    expect(html).not.toMatch(/rendement des panneaux/i);
  });

  it('affiche le mois le plus défavorable et sa mention', () => {
    expect(html).toContain('Mois le plus défavorable');
    expect(html).toContain('août');
    expect(html).toMatch(/saison des pluies/i);
  });

  it('détaille l’énergie à produire flux par flux', () => {
    expect(html).toContain('E = (conso. jour ÷ rendement jour) + (conso. nuit ÷ rendement nuit)');
    expect(html).toMatch(/Les deux flux sont corrigés séparément/);
  });

  it('justifie l’écart puissance minimale → installée', () => {
    expect(html).toContain('Puissance PV minimale calculée');
    expect(html).toContain('Puissance PV installée');
    expect(html).toContain('Kit 20 kWh');
    expect(html).toMatch(/pas du matériel/);
  });

  it('donne la formule de l’onduleur sur les charges, pas sur les Wc', () => {
    expect(html).toMatch(/pointe simultanée des charges × marge de sécurité/);
    expect(html).toMatch(/n’entre pas dans ce calcul/);
  });

  it('porte le bloc de vérifications de compatibilité', () => {
    expect(html).toContain('Configuration du champ');
    expect(html).toContain('Tension Voc à froid');
    expect(html).toContain('Tension Vmp à chaud');
    expect(html).toContain('Taux de charge du parc');
    expect(html).toContain('Conforme');
  });

  it('tabule les trois liaisons de câblage avec leur critère dimensionnant', () => {
    expect(html).toContain('Champ PV → onduleur');
    expect(html).toContain('Parc batterie → onduleur');
    expect(html).toContain('Onduleur → tableau de distribution');
    expect(html).toContain('Critère dimensionnant');
    expect(html).toMatch(/UTE C15-712/);
  });

  it('rappelle la consigne de câblage diagonal quand le parc a plusieurs modules', () => {
    expect(dim.batterie.nbModules).toBeGreaterThan(1);
    expect(html).toMatch(/câblage en diagonale/i);
  });

  it('liste le matériel en désignations techniques et quantités', () => {
    expect(html).toContain('Désignation technique');
    expect(html).toContain('Panneau photovoltaïque 620 Wc');
    expect(html).toContain('Batterie lithium 48 V');
  });

  it('porte la production estimée et les références normatives', () => {
    expect(html).toContain('Production annuelle');
    expect(html).toMatch(/hors ombrages locaux/);
    expect(html).toContain('UTE C15-712-2');
    expect(html).toContain('IEC 62548');
  });

  it('ne contient AUCUNE marque ni référence produit (règle absolue)', () => {
    for (const marque of MARQUES) expect(html, marque).not.toContain(marque);
    expect(html).not.toContain('Document interne');
  });

  it('ne contient aucun prix', () => {
    expect(html).not.toMatch(/F CFA/);
    expect(html).not.toMatch(/\d[\d\s]*\s?F CFA/);
  });

  it('applique le format francophone sans fausse précision', () => {
    expect(html).toMatch(/\d,\d kWc/);          // 7,4 kWc
    expect(html).not.toMatch(/\d{4} Wc</);      // jamais 7440 Wc
    expect(html).toMatch(/\d \d{3}/);           // milliers séparés par une espace
  });

  it('mentionne le client et l’apporteur d’affaires', () => {
    expect(html).toContain('Kossi Agboka');
    expect(html).toContain('Aminata Kesso');
    expect(html).toContain('BESTA-AMINATA');
  });
});

describe('fiche technique — version interne', () => {
  const interne = buildFicheTechniqueHtml({
    dim, client, interne: true,
    materielDetaille: [
      { ref: 'Panneau photovoltaïque 620 Wc', qty: 12, marque: 'Jinko', modele: 'Tiger Neo' },
      { ref: 'Onduleur hybride 8 kVA', qty: 1, marque: 'Deye', modele: 'SUN-8K', reference: 'SUN-8K-SG04LP3' },
    ],
  });

  it('affiche marques, modèles et références', () => {
    expect(interne).toContain('Marque · modèle · référence');
    expect(interne).toContain('Jinko');
    expect(interne).toContain('Deye');
    expect(interne).toContain('SUN-8K-SG04LP3');
  });

  it('porte la mention d’usage interne', () => {
    expect(interne).toContain('Document interne');
    expect(interne).toMatch(/Ne pas remettre au client/i);
  });

  it('conserve la même structure que la version client', () => {
    for (const titre of ['1 · Bilan de consommation', '5 · Câblage', '8 · Références normatives']) {
      expect(interne).toContain(titre);
    }
  });
});
