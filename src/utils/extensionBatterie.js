// Kits à batterie EXTENSIBLE par modules.
//
// Règle posée par le gérant : on ne saute pas au kit suivant dès que le
// besoin dépasse un kit — on lui ajoute des modules de batterie :
//   - kit 60 kWh  : modules de 12 kWh jusqu'à 120 kWh, puis le 128 kWh ;
//   - kit 128 kWh : modules de 16 kWh jusqu'à 200 kWh (192 kWh au plus, en
//     modules entiers), puis le 208 kWh.
//
// Un kit extensible porte `extensionBatterie: { moduleKwh, maxKwh }`. Seule la
// ligne des modules batterie change de quantité : le reste de la composition
// (onduleur, boîtier de contrôle, câblage) est celui du kit.
//
// Logique pure, sans React.

const LIGNE_MODULES = /^\s*batterie/i;

const lireExtension = (kit) => {
  const e = kit?.extensionBatterie;
  const moduleKwh = Number(e?.moduleKwh) || 0;
  const maxKwh = Number(e?.maxKwh) || 0;
  return moduleKwh > 0 && maxKwh > 0 ? { moduleKwh, maxKwh } : null;
};

/** Capacité de base du kit (kWh), en nombre. */
export const capaciteDeBase = (kit) => Number(kit?.battery) || 0;

/** Capacité la plus haute que le kit peut atteindre (modules ajoutés compris). */
export const capaciteMaxKit = (kit) => {
  const e = lireExtension(kit);
  return Math.max(capaciteDeBase(kit), e ? Math.floor(e.maxKwh / e.moduleKwh) * e.moduleKwh : 0);
};

/**
 * Capacité que le kit installe pour ce besoin : sa capacité de base si elle
 * suffit, sinon le nombre de modules juste suffisant (dans la limite de son
 * extension). `null` si même étendu le kit ne couvre pas le besoin.
 */
export const capacitePourBesoin = (kit, besoin = 0) => {
  const base = capaciteDeBase(kit);
  const need = Number(besoin) || 0;
  if (need <= base) return base;
  const e = lireExtension(kit);
  if (!e) return null;
  const capacite = Math.ceil(need / e.moduleKwh) * e.moduleKwh;
  return capacite <= e.maxKwh ? capacite : null;
};

/**
 * Lignes du kit avec les modules batterie ajoutés pour couvrir le besoin.
 * Renvoie `{ lignes, capacite, modules }` ; sans extension utile, les lignes
 * d'origine et la capacité de base.
 */
export const etendreBatterie = (kit, lignes, besoin = 0) => {
  const base = capaciteDeBase(kit);
  const e = lireExtension(kit);
  const capacite = capacitePourBesoin(kit, besoin);
  const i = (lignes || []).findIndex((l) => LIGNE_MODULES.test(l?.designation || ''));
  if (!e || i === -1 || capacite == null || capacite <= base) {
    return { lignes, capacite: base, modules: i === -1 ? null : lignes[i].qty };
  }
  const modules = Math.round(capacite / e.moduleKwh);
  if (modules <= lignes[i].qty) return { lignes, capacite: base, modules: lignes[i].qty };
  const suite = lignes.map((l, j) => (j === i ? { ...l, qty: modules } : l));
  return { lignes: suite, capacite, modules };
};

/**
 * Migration : un kit officiel enregistré avant l'existence de l'extension la
 * reçoit depuis la référence de même identifiant. Un kit qui porte déjà le
 * champ n'est pas touché. Renvoie la liste d'origine si rien ne change.
 */
export const completerExtensions = (liste = [], reference = []) => {
  if (!Array.isArray(liste)) return liste;
  const parId = new Map((reference || []).filter((r) => r.extensionBatterie).map((r) => [r.id, r.extensionBatterie]));
  let change = false;
  const suite = liste.map((item) => {
    if (!item || Object.prototype.hasOwnProperty.call(item, 'extensionBatterie')) return item;
    const ext = parId.get(item.id);
    if (!ext) return item;
    change = true;
    return { ...item, extensionBatterie: { ...ext } };
  });
  return change ? suite : liste;
};
