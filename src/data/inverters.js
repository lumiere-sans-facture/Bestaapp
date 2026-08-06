// Onduleurs proposés par l'assistant de devis solaire (composition des kits).
// Comme les kits (data/kits.js), cette liste n'est qu'une DOTATION DE DÉPART :
// une fois chargée dans l'état, elle appartient à l'entreprise, qui la
// modifie depuis « Plus › Onduleurs ».
//
// Repris des onduleurs RÉELLEMENT utilisés dans les kits officiels
// (data/kits.js) — ceux effectivement posés sur le terrain, pas une gamme
// générique. Prix identiques aux lignes « Onduleur … » des kits.
//
// maxPvPower (Wc) : puissance PV maximale que l'onduleur peut recevoir en
// entrée — PAS sa puissance de sortie (capacity, en kVA). C'est ce chiffre
// qui sert à vérifier qu'un onduleur encaisse le nombre de panneaux calculé,
// et à en suggérer un plus grand sinon.
//
// ⚠️ maxPvPower est ESTIMÉ (capacité kVA × 1,3, une marge de survolt réseau
// usuelle pour un onduleur hybride) — PAS un chiffre de fiche technique
// vérifié. Corrigez-le depuis « Plus › Onduleurs » avec la vraie valeur
// « Max. PV Input Power » de chaque modèle avant de vous y fier.
export const INVERTER_MODELS = [
  { id: 'hz-3kva', brand: 'HZ', model: 'Onduleur hybride 3kVA', capacity: 3, maxPvPower: 3900, price: 160000, efficiency: 95 },
  { id: 'itel-3kva', brand: 'Itel', model: 'Onduleur hybride 3kVA', capacity: 3, maxPvPower: 3900, price: 190000, efficiency: 95 },
  { id: 'hz-6kva', brand: 'HZ', model: 'Onduleur hybride 6kVA', capacity: 6, maxPvPower: 7800, price: 250000, efficiency: 95 },
  { id: 'deye-6kva', brand: 'Deye', model: 'Onduleur hybride 6kVA', capacity: 6, maxPvPower: 7800, price: 390000, efficiency: 96 },
];
