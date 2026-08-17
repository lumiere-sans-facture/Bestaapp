// Domaine « Kits pompage » : les kits que l'assistant Pompe solaire peut
// suggérer selon le besoin en eau. Dotés au départ depuis data/pompeKits,
// puis appartiennent à l'entreprise (prix, HMT max, débit…).
import { normaliserPompeKit, dupliquerPompeKit } from '../../utils/pompeKitEdition';

export function createPompeKitActions(setState) {
  return {
    addPompeKit: (kit) =>
      setState((s) => ({
        ...s,
        pompeKits: [{ ...normaliserPompeKit(kit), id: crypto.randomUUID() }, ...(s.pompeKits || [])],
      })),

    updatePompeKit: (kitId, kit) =>
      setState((s) => ({
        ...s,
        // L'identifiant ne bouge jamais : les devis déjà émis peuvent y faire référence.
        pompeKits: (s.pompeKits || []).map((k) =>
          k.id === kitId ? { ...normaliserPompeKit({ ...k, ...kit }), id: kitId } : k
        ),
      })),

    deletePompeKit: (kitId) =>
      setState((s) => ({ ...s, pompeKits: (s.pompeKits || []).filter((k) => k.id !== kitId) })),

    duplicatePompeKit: (kitId) =>
      setState((s) => {
        const source = (s.pompeKits || []).find((k) => k.id === kitId);
        if (!source) return s;
        const copie = dupliquerPompeKit(source);
        const i = s.pompeKits.findIndex((k) => k.id === kitId);
        return { ...s, pompeKits: [...s.pompeKits.slice(0, i + 1), copie, ...s.pompeKits.slice(i + 1)] };
      }),

    // Remet les kits d'origine ABSENTS de la liste. Ceux modifiés sont
    // laissés tels quels : un rattrapage n'écrase jamais un réglage manuel.
    restorePompeKits: (officiels) =>
      setState((s) => {
        const connus = new Set((s.pompeKits || []).map((k) => k.id));
        const manquants = officiels.filter((k) => !connus.has(k.id));
        return manquants.length ? { ...s, pompeKits: [...(s.pompeKits || []), ...manquants] } : s;
      }),
  };
}
