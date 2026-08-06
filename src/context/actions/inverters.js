// Domaine « Onduleurs » : les modèles proposés par l'assistant de devis
// solaire pour équiper les kits — et suggérer une alternative quand celui du
// kit ne prend pas assez de panneaux. Dotés au départ depuis data/inverters,
// puis appartiennent à l'entreprise (prix, puissance PV max, marque…).
import { normaliserOnduleur, dupliquerOnduleur } from '../../utils/inverters';

export function createInverterActions(setState) {
  return {
    addInverter: (onduleur) =>
      setState((s) => ({
        ...s,
        inverters: [{ ...normaliserOnduleur(onduleur), id: crypto.randomUUID() }, ...(s.inverters || [])],
      })),

    updateInverter: (inverterId, onduleur) =>
      setState((s) => ({
        ...s,
        // L'identifiant ne bouge jamais : les devis déjà émis peuvent y faire référence.
        inverters: (s.inverters || []).map((o) =>
          o.id === inverterId ? { ...normaliserOnduleur({ ...o, ...onduleur }), id: inverterId } : o
        ),
      })),

    deleteInverter: (inverterId) =>
      setState((s) => ({ ...s, inverters: (s.inverters || []).filter((o) => o.id !== inverterId) })),

    duplicateInverter: (inverterId) =>
      setState((s) => {
        const source = (s.inverters || []).find((o) => o.id === inverterId);
        if (!source) return s;
        const copie = dupliquerOnduleur(source);
        const i = s.inverters.findIndex((o) => o.id === inverterId);
        return { ...s, inverters: [...s.inverters.slice(0, i + 1), copie, ...s.inverters.slice(i + 1)] };
      }),

    // Remet les onduleurs d'origine ABSENTS de la liste. Ceux modifiés sont
    // laissés tels quels : un rattrapage ne doit jamais écraser un prix ou
    // une puissance PV max ajustés à la main.
    restoreInverters: (officiels) =>
      setState((s) => {
        const connus = new Set((s.inverters || []).map((o) => o.id));
        const manquants = officiels.filter((o) => !connus.has(o.id));
        return manquants.length ? { ...s, inverters: [...(s.inverters || []), ...manquants] } : s;
      }),
  };
}
