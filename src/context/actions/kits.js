// Domaine « Mes kits » : les compositions solaires proposées par l'assistant
// de devis. Elles sont dotées au départ depuis la liste officielle (data/kits)
// puis appartiennent à l'entreprise : prix, matériel et intitulés se modifient
// ici, sans passer par une mise à jour de l'application.
import { normaliserKit, dupliquerKit } from '../../utils/kits';

export function createKitActions(setState) {
  return {
    addKit: (kit) =>
      setState((s) => ({
        ...s,
        kits: [{ ...normaliserKit(kit), id: crypto.randomUUID() }, ...(s.kits || [])],
      })),

    updateKit: (kitId, kit) =>
      setState((s) => ({
        ...s,
        // L'identifiant ne bouge jamais : les devis déjà émis y font référence.
        kits: (s.kits || []).map((k) => (k.id === kitId ? { ...normaliserKit({ ...k, ...kit }), id: kitId } : k)),
      })),

    deleteKit: (kitId) =>
      setState((s) => ({ ...s, kits: (s.kits || []).filter((k) => k.id !== kitId) })),

    // Point de départ d'une variante : la composition est recopiée, pas partagée.
    duplicateKit: (kitId) =>
      setState((s) => {
        const source = (s.kits || []).find((k) => k.id === kitId);
        if (!source) return s;
        const copie = dupliquerKit(source);
        const i = s.kits.findIndex((k) => k.id === kitId);
        return { ...s, kits: [...s.kits.slice(0, i + 1), copie, ...s.kits.slice(i + 1)] };
      }),

    // Remet les kits d'origine ABSENTS de la liste (ceux dont l'identifiant a
    // disparu). Les kits modifiés sont laissés tels quels : un rattrapage ne
    // doit jamais écraser un prix ajusté à la main.
    restoreKits: (officiels) =>
      setState((s) => {
        const connus = new Set((s.kits || []).map((k) => k.id));
        const manquants = officiels.filter((k) => !connus.has(k.id));
        return manquants.length ? { ...s, kits: [...(s.kits || []), ...manquants] } : s;
      }),
  };
}
