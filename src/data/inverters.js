// Onduleurs proposés par l'assistant de devis solaire (composition des kits).
// Comme les kits (data/kits.js), cette liste n'est qu'une DOTATION DE DÉPART :
// une fois chargée dans l'état, elle appartient à l'entreprise, qui la
// modifie depuis « Plus › Onduleurs ».
//
// maxPvPower (Wc) : puissance PV maximale que l'onduleur peut recevoir en
// entrée — PAS sa puissance de sortie (capacity, en kVA). C'est ce chiffre
// qui sert à vérifier qu'un onduleur encaisse le nombre de panneaux calculé,
// et à en suggérer un plus grand sinon.
//
// ⚠️ Les valeurs ci-dessous sont ESTIMÉES (capacité kVA × 1,3, une marge de
// survolt réseau usuelle pour un onduleur hybride) — PAS des chiffres de
// fiche technique vérifiés. Corrigez-les depuis « Plus › Onduleurs » avec les
// vraies valeurs « Max. PV Input Power » de chaque modèle avant de vous y fier.
export const INVERTER_MODELS = [
  { id: 'growatt-1k', brand: 'Growatt', model: 'SPF 1000TL', capacity: 1, maxPvPower: 1300, price: 180000, efficiency: 95 },
  { id: 'growatt-2k', brand: 'Growatt', model: 'SPF 2000TL', capacity: 2, maxPvPower: 2600, price: 280000, efficiency: 95 },
  { id: 'growatt-3k', brand: 'Growatt', model: 'SPF 3000TL', capacity: 3, maxPvPower: 3900, price: 380000, efficiency: 95 },
  { id: 'growatt-5k', brand: 'Growatt', model: 'SPF 5000TL', capacity: 5, maxPvPower: 6500, price: 580000, efficiency: 96 },
  { id: 'growatt-8k', brand: 'Growatt', model: 'SPF 8000TL', capacity: 8, maxPvPower: 10400, price: 980000, efficiency: 96 },
  { id: 'growatt-10k', brand: 'Growatt', model: 'SPF 10000TL', capacity: 10, maxPvPower: 13000, price: 1300000, efficiency: 96 },
];
