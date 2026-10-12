// Composition retenue d'un kit, telle que la lisent le client et ses
// documents (devis, factures) : le matériel final, sans le détail des
// ajustements.
//
// Un kit étendu reçoit du matériel en plus (utils/ajustementsKit.js) sous
// forme de lignes « … — extension » : utiles au vendeur pour comprendre ce
// qui a changé, elles n'ont rien à faire sur le document du client. Ici,
// chaque ligne d'extension rejoint la ligne du kit de même désignation et de
// même prix (quantités additionnées) ; sans pareille, elle garde sa place,
// sous son nom sans « — extension ». Le total ne change jamais.

const SUFFIXE_EXTENSION = /\s+—\s+extension$/i;

/** Désignation sans la marque d'ajustement « — extension ». */
export const designationRetenue = (designation) => String(designation ?? '').replace(SUFFIXE_EXTENSION, '');

/**
 * Lignes { designation, qty, pu, … } ramenées à la composition retenue.
 * Seules les lignes d'extension fusionnent : deux lignes identiques saisies
 * à la main restent deux lignes.
 */
export function compositionRetenue(lignes = []) {
  const sorties = [];
  const parCle = new Map();
  const cle = (designation, pu) => `${designation.trim().toLowerCase()}|${Number(pu) || 0}`;
  const extensions = [];
  (lignes || []).forEach((l) => {
    if (SUFFIXE_EXTENSION.test(String(l?.designation ?? ''))) { extensions.push(l); return; }
    const k = cle(String(l?.designation ?? ''), l?.pu);
    if (!parCle.has(k)) parCle.set(k, sorties.length);
    sorties.push({ ...l });
  });
  extensions.forEach((l) => {
    const designation = designationRetenue(l.designation);
    const i = parCle.get(cle(designation, l.pu));
    if (i !== undefined) {
      sorties[i] = { ...sorties[i], qty: (Number(sorties[i].qty) || 0) + (Number(l.qty) || 0) };
    } else {
      parCle.set(cle(designation, l.pu), sorties.length);
      sorties.push({ ...l, designation });
    }
  });
  return sorties;
}
