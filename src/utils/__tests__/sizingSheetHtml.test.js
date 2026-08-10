// Fiche de dimensionnement 3 pages — synthèse, étude technique, analyse
// (rentabilité + couverture mensuelle). Importée via l'alias déprécié pour
// vérifier que la bascule ne casse aucun appelant existant.
import { describe, it, expect } from 'vitest';
import { buildSizingSheetHtml } from '../sizingSheetHtml';
import { calculateSystemSize, SIZING_PARAMS, SYSTEM_VOLTAGE } from '../solarSizing';

const consumption = { day: 2.2, night: 3.2 }; // 5,4 kWh/j
const sizing = calculateSystemSize(consumption, 'off-grid', 5.2);

const data = {
  client: { name: 'Kossi Agbodjan', phone: '+228 97 00 00 00', ville: 'Lomé' },
  appliances: [
    { name: 'Téléviseur LED 32"', power: 60, quantity: 2, day: 3, night: 2 },
    { name: 'Réfrigérateur 200 L', power: 150, quantity: 1, day: 12, night: 12 },
  ],
  manualMode: false,
  consumption,
  systemType: 'off-grid',
  sunHours: 5.2,
  cityName: 'Lomé',
  solarSource: 'PVGIS',
  sizing,
  inverter: { brand: 'Felicity', model: 'Onduleur Felicity 5kVA', capacity: 5, maxPower: 4000 },
  batteries: [{ brand: 'Taico', model: 'Batterie Taico 5kWh', capacity: 5, qty: 1 }],
  // Même référence 620 Wc que le moteur de dimensionnement : la fiche d'un
  // système taillé par le moteur doit couvrir le besoin les 12 mois.
  panelName: 'Panneau photovoltaïque 620W',
  investissement: 2500000,
};

describe('buildSizingSheetHtml — 3 pages', () => {
  const html = buildSizingSheetHtml(data);

  it('tient sur exactement trois pages A4 numérotées', () => {
    expect(html.match(/<section class="page">/g)).toHaveLength(3);
    expect(html).toContain('width: 794px; height: 1123px');
    expect(html).toContain('Page 1 / 3');
    expect(html).toContain('Page 2 / 3');
    expect(html).toContain('Page 3 / 3');
  });

  it('un seul point focal orange par page : kWc (p.1) et économie annuelle (p.3)', () => {
    // Deux emplois de la classe focale — la page 2 n'a AUCUN orange.
    expect(html.match(/class="focal-value"/g)).toHaveLength(2);
    const [, page2] = html.split('<section class="page">').slice(1);
    expect(page2).not.toContain('focal-value');
  });

  it('contient client, localisation, charges et synthèse', () => {
    expect(html).toContain('Kossi Agbodjan');
    expect(html).toContain('+228 97 00 00 00');
    expect(html).toContain('Autonome (off-grid)');
    expect(html).toContain('Téléviseur LED 32&quot;');
    expect(html).toContain('5 400');
    expect(html).toContain('Pic de charge');
  });

  it('les unités sont accrochées à leur valeur par une espace fine insécable', () => {
    for (const unite of [' kWc', ' kWh', ' W', ' V', ' %', ' F CFA']) {
      expect(html).toContain(unite);
    }
  });

  it('page 2 : paramètres réels du moteur, formules et productible net', () => {
    expect(html).toContain(`${Math.round(SIZING_PARAMS.panelEfficiency * 100)} %`);
    expect(html).toContain(`${SYSTEM_VOLTAGE} V`);
    expect(html).toContain('Productible annuel net');
    expect(html).toContain('× 0,75');
    expect(html).toContain('Tarif de l’électricité');
  });

  it('page 3 : graphique de couverture (12 mois, hachures, source PVGIS)', () => {
    expect(html).toContain('FIGURE');
    expect(html).toContain('Productible mensuel estimé et besoin énergétique retenu');
    expect(html).toContain('id="hachures"');
    // Système dimensionné par le moteur : le besoin est couvert les 12 mois —
    // la SEULE occurrence des hachures est la pastille de légende.
    expect(html.match(/url\(#hachures\)/g)).toHaveLength(1);
    expect(html).toContain('couvert sur les 12 mois');
    expect(html).toContain('SARAH-3');
    expect(html).toContain('kWh/mois');
    for (const mois of ['Jan', 'Juil', 'Déc']) expect(html).toContain(`>${mois}</text>`);
  });

  it('page 3 : rentabilité complète, calculable à la main', () => {
    expect(html).toContain('Estimation de rentabilité sur 10 ans');
    expect(html).toContain('Économie annuelle');
    expect(html).toContain('Retour sur investissement');
    expect(html).toContain('Gain net');
    expect(html).toContain('Investissement estimé');
    expect(html).toContain('2 500 000 F CFA');
    expect(html).toContain('Durée de vie des équipements');
    expect(html).toContain('6 000 cycles');
  });

  it('aucune marque du catalogue, aucun prix hors section rentabilité', () => {
    for (const marque of ['Felicity', 'Taico', 'Jinko', 'Growatt', 'Deye', 'Pylontech']) {
      expect(html).not.toContain(marque);
    }
    // Le récapitulatif matériel reste sans le moindre montant (le tarif de
    // l'électricité, lui, est un PARAMÈTRE de calcul, pas un prix de vente).
    const materiel = html.split('5 · Récapitulatif matériel')[1].split('</section>')[0];
    expect(materiel).not.toContain('F CFA');
  });

  it('mentions légales et prudence commerciale au pied de la page 3', () => {
    const avec = buildSizingSheetHtml({ ...data, apporteur: { name: 'Aminata Kesso', code: 'BESTA-AMINATA' } });
    expect(avec).toContain('RCCM RB/PKO/23 A 19308');
    expect(avec).toContain('IFU 0202274882317');
    expect(avec).toContain('Aminata Kesso');
    expect(avec).toContain('Estimation indicative — ne constitue pas une offre de prix ferme.');
  });

  it('sans investissement : la rentabilité reste affichable (ROI et gain à —)', () => {
    const sans = buildSizingSheetHtml({ ...data, investissement: null });
    expect(sans).toContain('À renseigner');
    expect(sans.match(/<section class="page">/g)).toHaveLength(3);
  });

  it('gère la saisie directe (mode manuel)', () => {
    const manual = buildSizingSheetHtml({ ...data, manualMode: true, appliances: [] });
    expect(manual).toContain('Consommation de jour (saisie directe)');
    expect(manual).toContain('2 200');
  });
});
