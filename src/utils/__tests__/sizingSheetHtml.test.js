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

  it('page 2 : paramètres réels du moteur et tarif retenu', () => {
    expect(html).toContain(`${Math.round(SIZING_PARAMS.panelEfficiency * 100)} %`);
    expect(html).toContain(`${SYSTEM_VOLTAGE} V`);
    expect(html).toContain('Tarif de l’électricité');
  });

  it('page 2 : production = puissance installée × rendement × ensoleillement', () => {
    // La procédure tient en une ligne vérifiable à la main : aucune « perte
    // système », aucun « productible théorique » en plus du rendement.
    expect(html).toContain('Production estimée');
    expect(html).toContain('Production = puissance installée × rendement des panneaux × ensoleillement');
    expect(html).toContain('au pire mois');
    for (const disparu of ['pertes système', 'théorique', 'ratio de performance', '0,75']) {
      expect(html).not.toContain(disparu);
    }
  });

  it('page 2 : le rendement intervient à la puissance, pas à l’énergie à produire', () => {
    // L'énergie journalière à produire EST la consommation du client : aucun
    // panneau, aucun rendement à ce stade. Le rendement n'apparaît qu'en
    // convertissant cette énergie en puissance crête à installer.
    const [energie, puissance] = html
      .split('Énergie journalière à produire')[1]
      .split('Capacité batterie nécessaire')[0]
      .split('Puissance panneaux nécessaire');
    expect(energie).toContain('E = Jour + Nuit × nuits d’autonomie'.replace('’', "'"));
    expect(energie).toContain('E = 2,20 + 3,20 × 1 =');
    expect(energie).not.toContain('rendement');
    expect(energie).not.toContain('panneaux');
    expect(puissance).toContain('P = E ÷ (rendement des panneaux × HSP)');
    expect(puissance).toContain('÷ (0,85 ×');
  });

  it('page 2 : les deux taux homonymes sont nommés distinctement', () => {
    // « Rendement des panneaux 85 % » et « Taux d'utilisation 85 % » côte à
    // côte faisaient croire à un lien : ce sont deux notions étrangères.
    expect(html).toContain('Rendement des panneaux');
    expect(html).toContain('Part autoconsommée (rentabilité)');
    expect(html).not.toContain('Taux d’utilisation');
  });

  it('page 2 : le calibre de l’onduleur et le parc batterie installé sont explicités', () => {
    expect(html).toContain('premier calibre au-dessus');
    expect(html).toContain('pic de charge');
    // Les modules ont des capacités fixes : le parc dépasse le besoin calculé,
    // et la fiche affiche les deux valeurs côte à côte.
    expect(html).toContain('Capacité batterie nécessaire');
    expect(html).toContain('parc installé');
  });

  it('page 3 : graphique de couverture (12 mois, hachures, source PVGIS)', () => {
    expect(html).toContain('FIGURE');
    expect(html).toContain('Production mensuelle estimée et consommation du client');
    expect(html).toContain('id="hachures"');
    // Système dimensionné par le moteur : le besoin est couvert les 12 mois —
    // la SEULE occurrence des hachures est la pastille de légende.
    expect(html.match(/url\(#hachures\)/g)).toHaveLength(1);
    expect(html).toContain('couvert sur les 12 mois');
    // La comparaison porte sur la consommation ENTIÈRE, pas sur une fraction.
    expect(html).toContain('Consommation du client (5,4 kWh/jour)');
    expect(html).toContain(`rendement des panneaux ${Math.round(SIZING_PARAMS.panelEfficiency * 100)} %`);
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
    // Batteries : 15 ans en grand, le détail des cycles en note.
    const vies = html.split('Durée de vie des équipements')[1];
    expect(vies).toContain('<div class="stat-value">15 ans</div>');
    expect(vies).toContain('<div class="stat-note">6 000 cycles · 1 par jour</div>');
    // De la plus longue durée à la plus courte : l'onduleur ferme la marche.
    expect(vies.match(/stat-label">([^<]+)/g).map((m) => m.split('">')[1]))
      .toEqual(['Panneaux photovoltaïques', 'Structure et câblages', 'Batteries lithium', 'Onduleur']);
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

// La fiche est un document commercial de l'installateur : côté Pro elle porte
// SA marque, exactement comme ses devis et ses factures.
describe('buildSizingSheetHtml — émetteur Pro (entreprise abonnée)', () => {
  const company = {
    nomEntreprise: 'Soleil du Golfe',
    slogan: 'L’énergie qui ne s’arrête jamais',
    logo: 'data:image/png;base64,iVBORw0KGgo=',
    telephone: '+228 90 11 22 33',
    email: 'contact@soleildugolfe.tg',
    adresse: 'Lomé, Nyékonakpoè',
    rccm: 'TG-LOM-2024-B-1234',
    ifu: '1000987654321',
    couleurPrimaire: '#1b5e20',
    couleurSecondaire: '#e65100',
  };
  const html = buildSizingSheetHtml({ ...data, company });

  it('porte le logo, les couleurs et le nom de l’abonné', () => {
    expect(html).toContain('--primaire: #1b5e20');
    expect(html).toContain('--accent: #e65100');
    expect(html).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    expect(html).toContain('Soleil du Golfe');
  });

  it('porte ses coordonnées et ses mentions légales, jamais celles de BestaSolar', () => {
    expect(html).toContain('Lomé, Nyékonakpoè');
    expect(html).toContain('+228 90 11 22 33');
    expect(html).toContain('RCCM TG-LOM-2024-B-1234');
    expect(html).toContain('IFU 1000987654321');
    for (const bestasolar of ['BESTA SOLAR', 'Cotonou Saint Rita', 'RB/PKO/23 A 19308', '0202274882317']) {
      expect(html).not.toContain(bestasolar);
    }
  });

  it('teinte aussi le graphique de couverture aux couleurs de l’abonné', () => {
    const figure = html.split('<svg')[1].split('</svg>')[0];
    expect(figure).toContain('#e65100'); // productible
    expect(figure).toContain('#1b5e20'); // besoin retenu
    expect(figure).not.toContain('#f5a623');
  });

  it('sans logo : le nom et le slogan tiennent la place de l’en-tête', () => {
    const sansLogo = buildSizingSheetHtml({ ...data, company: { ...company, logo: '' } });
    expect(sansLogo).toContain('class="head-marque"');
    expect(sansLogo).toContain('L’énergie qui ne s’arrête jamais');
    expect(sansLogo).not.toContain('<img');
  });

  it('entreprise incomplète : ni tiret orphelin, ni mention légale vide', () => {
    const minimal = buildSizingSheetHtml({
      ...data,
      company: { nomEntreprise: 'Kekeli Énergie', logo: '', telephone: '', adresse: '', rccm: '', ifu: '' },
    });
    expect(minimal).toContain('Kekeli Énergie');
    expect(minimal).not.toContain('Kekeli Énergie —');
    expect(minimal).not.toContain('<div class="foot-legal">');
    // Palette par défaut quand l'abonné n'a rien choisi.
    expect(minimal).toContain('--primaire: #0a2472');
    expect(minimal.match(/<section class="page">/g)).toHaveLength(3);
  });

  it('une palette trop claire est assombrie pour rester imprimable', () => {
    const pale = buildSizingSheetHtml({
      ...data,
      company: { ...company, couleurPrimaire: '#7bd0ff', couleurSecondaire: '#fffbe0' },
    });
    expect(pale).not.toContain('--primaire: #7bd0ff');
    expect(pale).not.toContain('--accent: #fffbe0');
  });
});
