// Fiche témoin pour la vérification visuelle en navigateur (hors tests) :
//   npx vite-node src/utils/sizingSheet/preview.mjs /chemin/fiche.html [--pro]
// Sans option : identité BestaSolar. Avec --pro : identité d'une entreprise
// abonnée (logo, couleurs et coordonnées à elle) — les deux mises en page
// doivent tenir sur trois pages exactement.
import { writeFileSync } from 'node:fs';
import { buildSizingSheetHtml } from './index';
import { calculateSystemSize } from '../solarSizing';

// Logo de démonstration (SVG en data-URI) aux couleurs de l'abonné témoin.
const logoDemo = `data:image/svg+xml;base64,${Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="32" viewBox="0 0 260 32">
     <circle cx="16" cy="16" r="13" fill="#e65100"/>
     <circle cx="16" cy="16" r="7" fill="#fff"/>
     <text x="40" y="22" font-family="sans-serif" font-size="17" font-weight="700" fill="#1b5e20">SOLEIL DU GOLFE</text>
   </svg>`,
).toString('base64')}`;

const abonne = {
  nomEntreprise: 'Soleil du Golfe',
  slogan: 'L’énergie qui ne s’arrête jamais',
  logo: logoDemo,
  telephone: '+228 90 11 22 33',
  email: 'contact@soleildugolfe.tg',
  adresse: 'Lomé, Nyékonakpoè',
  rccm: 'TG-LOM-2024-B-1234',
  ifu: '1000987654321',
  couleurPrimaire: '#1b5e20',
  couleurSecondaire: '#e65100',
};

const consumption = { day: 8.8, night: 8.8 }; // 17,6 kWh/j (climatiseur 3 CV)
const appareils = [
  { name: 'Climatiseur 3 CV', power: 2200, quantity: 1, day: 3, night: 4 },
  { name: 'Réfrigérateur 300 L', power: 180, quantity: 1, day: 12, night: 12 },
  { name: 'Téléviseur LED 43"', power: 80, quantity: 2, day: 4, night: 3 },
  { name: 'Éclairage LED', power: 10, quantity: 12, day: 1, night: 5 },
];
const peakLoad = appareils.reduce((s, a) => s + a.power * a.quantity, 0);
const onduleurs = [
  { id: 'o3', brand: 'HZ', model: 'Hybride 3kVA', capacity: 3, maxPvPower: 3900, price: 160000 },
  { id: 'o6', brand: 'Deye', model: 'Hybride 6kVA', capacity: 6, maxPvPower: 7800, price: 390000 },
  { id: 'o8', brand: 'Deye', model: 'Hybride 8kVA', capacity: 8, maxPvPower: 10400, price: 620000 },
];
const sizing = calculateSystemSize(consumption, 'off-grid', 4.3, undefined, undefined, { peakLoad, inverters: onduleurs });
const html = buildSizingSheetHtml({
  ...(process.argv.includes('--pro') ? { company: abonne } : {}),
  client: { name: 'Felix Sossa', phone: '+228 94 22 33 44', ville: 'Lomé' },
  apporteur: { name: 'Aminata Kesso', code: 'AMINATA' },
  appliances: appareils,
  manualMode: false,
  consumption,
  systemType: 'off-grid',
  sunHours: 4.3,
  cityName: 'Lomé',
  solarSource: 'NASA/PVGIS',
  sizing,
  inverter: { capacity: sizing.inverter.capacity, maxPvPower: sizing.inverter.maxPvPower },
  batteries: sizing.batteries.map((b) => ({ capacity: b.capacity, qty: b.quantity })),
  panelName: 'Panneau photovoltaïque 620W',
  investissement: 2300000,
});
writeFileSync(process.argv[2] || '/tmp/fiche.html', html);
console.log('ok', html.length);
