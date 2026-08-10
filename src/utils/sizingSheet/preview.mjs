// Fiche témoin pour la vérification visuelle en navigateur (hors tests) :
//   npx vite-node src/utils/sizingSheet/preview.mjs /chemin/fiche.html
import { writeFileSync } from 'node:fs';
import { buildSizingSheetHtml } from './index';
import { calculateSystemSize } from '../solarSizing';

const consumption = { day: 8.8, night: 8.8 }; // 17,6 kWh/j (climatiseur 3 CV)
const sizing = calculateSystemSize(consumption, 'off-grid', 4.3);
const html = buildSizingSheetHtml({
  client: { name: 'Felix Sossa', phone: '+228 94 22 33 44', ville: 'Lomé' },
  apporteur: { name: 'Aminata Kesso', code: 'BESTA-AMINATA' },
  appliances: [
    { name: 'Climatiseur 3 CV', power: 2200, quantity: 1, day: 3, night: 4 },
    { name: 'Réfrigérateur 300 L', power: 180, quantity: 1, day: 12, night: 12 },
    { name: 'Téléviseur LED 43"', power: 80, quantity: 2, day: 4, night: 3 },
    { name: 'Éclairage LED', power: 10, quantity: 12, day: 1, night: 5 },
  ],
  manualMode: false,
  consumption,
  systemType: 'off-grid',
  sunHours: 4.3,
  cityName: 'Lomé',
  solarSource: 'NASA/PVGIS',
  sizing,
  inverter: { capacity: 8, maxPower: 8000 },
  batteries: sizing.batteries.map((b) => ({ capacity: b.capacity, qty: b.quantity })),
  panelName: 'Panneau photovoltaïque 620W',
  investissement: 2300000,
});
writeFileSync(process.argv[2] || '/tmp/fiche.html', html);
console.log('ok', html.length);
