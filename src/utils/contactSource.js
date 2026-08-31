// Origine d'un contact : par quel canal ce client est arrivé.
//
// Le gérant y lit ce qui rapporte réellement — le terrain, WhatsApp, le
// bouche-à-oreille ou le site — et le partenaire s'en souvient six mois plus
// tard, quand il rappelle. La liste vit ici, une seule fois, parce que deux
// écrans la proposent (Clients et Suivi).

export const SOURCES_CONTACT = [
  { id: 'terrain', libelle: 'Terrain' },
  { id: 'whatsapp', libelle: 'WhatsApp' },
  { id: 'parrainage', libelle: 'Parrainage' },
  { id: 'site', libelle: 'Site web' },
];

/** Libellé affichable, ou chaîne vide quand l'origine n'est pas renseignée. */
export const libelleSource = (id) =>
  SOURCES_CONTACT.find((s) => s.id === id)?.libelle || '';

/** Une origine inconnue n'est pas une erreur : elle ne s'affiche simplement pas. */
export const sourceValide = (id) => SOURCES_CONTACT.some((s) => s.id === id);
