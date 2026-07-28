import { describe, it, expect } from 'vitest';
import { buildSizingSheetHtml } from '../sizingSheetHtml';
import { calculateSystemSize, SIZING_PARAMS, SYSTEM_VOLTAGE } from '../solarSizing';

const consumption = { day: 2.2, night: 3.2 }; // 5,4 kWh/j
const sizing = calculateSystemSize(consumption, 'off-grid', 5.2);

const data = {
  client: { name: 'Kossi Agbodjan', phone: '+229 97 00 00 00', ville: 'Parakou' },
  appliances: [
    { name: 'Téléviseur LED 32"', power: 60, quantity: 2, day: 3, night: 2 },
    { name: 'Réfrigérateur 200 L', power: 150, quantity: 1, day: 12, night: 12 },
  ],
  manualMode: false,
  consumption,
  systemType: 'off-grid',
  sunHours: 5.2,
  cityName: 'Parakou',
  solarSource: 'PVGIS',
  sizing,
  inverter: { brand: 'Felicity', model: 'Onduleur Felicity 5kVA', capacity: 5, maxPower: 4000 },
  batteries: [{ brand: 'Taico', model: 'Batterie Taico 5kWh', capacity: 5, qty: 1 }],
  panelName: 'Panneau Jinko Solar 550W',
};

describe('buildSizingSheetHtml', () => {
  const html = buildSizingSheetHtml(data);

  it('contient client, localisation et type de système', () => {
    expect(html).toContain('Kossi Agbodjan');
    expect(html).toContain('+229 97 00 00 00');
    expect(html).toContain('Parakou');
    expect(html).toContain('Autonome (off-grid)');
  });

  it('détaille chaque charge avec heures jour/nuit séparées et conso journalière', () => {
    expect(html).toContain('☀ Jour (h)');
    expect(html).toContain('☾ Nuit (h)');
    // Téléviseur : 3 h jour et 2 h nuit dans des colonnes distinctes
    expect(html).toContain('<td class="num">3</td><td class="num">2</td><td class="num">600</td>'); // 60 W × 2 × 5 h
    expect(html).toContain('Téléviseur LED 32&quot;');
    expect(html).toContain('Réfrigérateur 200 L');
    expect(html).toContain('<td class="num">12</td><td class="num">12</td><td class="num">3 600</td>'); // 150 × 1 × 24
    expect(html).toContain('5 400 Wh/j'); // total, séparateur espace
    expect(html).toContain('5,40 kWh/j');
  });

  it("mentionne l'apporteur d'affaires quand il est fourni", () => {
    const avec = buildSizingSheetHtml({ ...data, apporteur: { name: 'Aminata Kesso', code: 'BESTA-AMINATA' } });
    expect(avec).toContain('Apporteur d’affaires');
    expect(avec).toContain('Aminata Kesso');
    expect(avec).toContain('BESTA-AMINATA');
    // Sans apporteur, aucune ligne vide ne s'affiche
    expect(html).not.toContain('Apporteur');
  });

  it('nomme les appareils personnalisés laissés sans nom', () => {
    const custom = buildSizingSheetHtml({
      ...data,
      appliances: [
        { name: 'Pompe à eau', power: 750, quantity: 1, day: 2, night: 0, custom: true },
        { name: '  ', power: 300, quantity: 1, day: 1, night: 0, custom: true },
      ],
    });
    expect(custom).toContain('Pompe à eau');
    expect(custom).toContain('Appareil personnalisé');
    // Pic de charge : 60×2 + 150×1 = 270 W (toutes charges simultanées)
    expect(html).toContain('Pic de charge');
    expect(html).toContain('270 W');
  });

  it('affiche les hypothèses réelles de solarSizing.js', () => {
    expect(html).toContain('5,2 h/jour'); // HSP
    expect(html).toContain('PVGIS');
    expect(html).toContain('Rendement des panneaux');
    expect(html).toContain(`${Math.round(SIZING_PARAMS.panelEfficiency * 100)} %`);
    expect(html).toContain(`${Math.round(SIZING_PARAMS.depthOfDischarge * 100)} %`);
    expect(html).toContain(`${SYSTEM_VOLTAGE} V`);
  });

  it('montre les formules appliquées avec les valeurs du calcul', () => {
    // E = 5,40 ÷ 0,75 = 7,20 kWh/j
    expect(html).toContain('7,20 kWh/jour');
    // P = 7,20 ÷ 5,2 → même valeur que le moteur de calcul (séparateur : espace simple)
    const wc = Math.round(sizing.requiredPanelPower).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ');
    expect(html).toContain(`${wc} Wc`);
    // Batterie lithium : 3,2 ÷ 0,95 ÷ 0,90 = 3,74 kWh → Ah sous 48 V
    const kwh = sizing.batteryCapacity.toFixed(2).replace('.', ',');
    expect(html).toContain(`${kwh} kWh`);
    expect(html).toContain('3,74 kWh');
    const ah = Math.round((sizing.batteryCapacity * 1000) / SYSTEM_VOLTAGE);
    expect(html).toContain(`${ah} Ah`);
  });

  it('liste le matériel en désignations techniques, sans marque ni référence', () => {
    // Type + tension / capacité / puissance + quantité — rien d'autre.
    expect(html).toContain('Panneau photovoltaïque 550 Wc');
    expect(html).toContain('Onduleur hybride 5 kVA');
    expect(html).toContain(`Batterie lithium ${SYSTEM_VOLTAGE}V ${Math.round(5000 / SYSTEM_VOLTAGE)}Ah (5 kWh)`);
    expect(html).toContain('Coffret de protection DC/AC');
    // Les marques du catalogue servent au calcul mais n'apparaissent JAMAIS.
    for (const marque of ['Felicity', 'Taico', 'Jinko', 'Growatt', 'Itel', 'Luxsun', 'Must', 'Deye', 'Pylontech']) {
      expect(html).not.toContain(marque);
    }
    expect(html).not.toContain('Marque');
    expect(html).not.toContain('F CFA');
    // Document technique : aucune devise, et mention explicite « ni un devis ni une offre de prix ».
    expect(html).toContain('ne constitue ni un devis ni une offre de prix');
  });

  it('porte la charte BestaSolar', () => {
    expect(html).toContain('#0a2472');
    expect(html).toContain('#f5a623');
    expect(html.toLowerCase()).toContain('énergie lumineuse sans facture');
  });

  it('gère la saisie directe (mode manuel)', () => {
    const manual = buildSizingSheetHtml({ ...data, manualMode: true, appliances: [] });
    expect(manual).toContain('Consommation de jour (saisie directe)');
    expect(manual).toContain('2 200'); // 2,2 kWh → Wh
  });

  it('adapte la section batterie au type de système', () => {
    const onGrid = buildSizingSheetHtml({ ...data, systemType: 'on-grid', sizing: calculateSystemSize(consumption, 'on-grid', 5.2), batteries: [] });
    expect(onGrid).not.toContain('Capacité batterie nécessaire');
    expect(onGrid).toContain('Sans batterie (injection réseau)');
    const hybrid = buildSizingSheetHtml({ ...data, systemType: 'hybrid', sizing: calculateSystemSize(consumption, 'hybrid', 5.2) });
    expect(hybrid).toContain('× 0,80'); // ratio hybride dans la formule
  });
});
