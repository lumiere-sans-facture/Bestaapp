// Kits à batterie EXTENSIBLE par modules.
//
// Règle posée par le gérant : on ne saute pas au kit suivant dès que le
// besoin dépasse un kit — on lui ajoute des modules de batterie :
//   - kit 60 kWh  : modules de 12 kWh jusqu'à 120 kWh, puis le 128 kWh ;
//   - kit 128 kWh : modules de 16 kWh jusqu'à 200 kWh (192 kWh au plus, en
//     modules entiers), puis le 208 kWh.
//   - kit 208 kWh : modules de 16 kWh jusqu'à 256 kWh (16 modules, le
//     maximum du boîtier B-PRO).
// Un seul boîtier de contrôle dans tous les cas : le GB-W gère 10 modules,
// le B-PRO 16 (confirmé par le gérant).
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
  // Besoin au-delà même de l'extension (aucun kit plus grand) : le kit est
  // porté à son maximum — mieux vaut le plus proche que rien.
  const capacite = capacitePourBesoin(kit, besoin)
    ?? (Number(besoin) > base ? capaciteMaxKit(kit) : base);
  const i = (lignes || []).findIndex((l) => LIGNE_MODULES.test(l?.designation || ''));
  if (!e || i === -1 || capacite == null || capacite <= base) {
    return { lignes, capacite: base, modules: i === -1 ? null : lignes[i].qty };
  }
  const modules = Math.round(capacite / e.moduleKwh);
  if (modules <= lignes[i].qty) return { lignes, capacite: base, modules: lignes[i].qty };
  const suite = lignes.map((l, j) => (j === i ? { ...l, qty: modules } : l));
  return { lignes: suite, capacite, modules };
};

// ---- Modules batterie réglables (+/−), pour TOUS les kits ----
//
// Le stockage suit le besoin comme les panneaux : on part du kit proposé, on
// ajoute ou retire des modules IDENTIQUES à ceux de sa ligne batterie (même
// tension, même BMS : toujours compatibles avec l'onduleur du kit), un à un,
// dans la limite du nombre de modules que l'installation accepte :
//   - kit haute tension : celle de son boîtier de contrôle (extensionBatterie) ;
//   - autres kits : le réglage « Modules max » du kit dans « Mes kits »,
//     4 par défaut (décision du gérant).
// Le minimum est d'un module. Descendre sous le besoin reste possible : c'est
// l'écran qui alerte (« autonomie insuffisante »), sans bloquer le devis.

/** Nombre de modules en parallèle accepté par défaut (kits 12, 24 et 48 V). */
export const MODULES_MAX_DEFAUT = 4;

/** kWh d'un module lus sur sa désignation : « Batterie lithium 48V (16kwh) » → 16. */
const kwhDeLaLigne = (designation = '') => {
  const m = /(\d+(?:[.,]\d+)?)\s*kwh/i.exec(String(designation));
  return m ? Number(m[1].replace(',', '.')) : 0;
};

/** Nombre maximal de modules du kit (voir la règle ci-dessus). */
export const modulesMaxKit = (kit) => {
  const e = lireExtension(kit);
  if (e) return Math.floor(e.maxKwh / e.moduleKwh);
  const n = Math.round(Number(kit?.modulesMax));
  return n >= 1 ? n : MODULES_MAX_DEFAUT;
};

/**
 * Les modules batterie d'un kit : `{ index, base, moduleKwh, min, max }`, ou
 * `null` si le kit n'a pas de ligne « Batterie… » (rien à régler).
 * La taille d'un module : celle de l'extension (kit haute tension), sinon
 * celle écrite sur la ligne, sinon la capacité du kit divisée par sa quantité.
 */
export const modulesDuKit = (kit, lignes = kit?.lines) => {
  const i = (lignes || []).findIndex((l) => LIGNE_MODULES.test(l?.designation || ''));
  if (i === -1) return null;
  const base = Math.max(1, Math.round(Number(lignes[i].qty) || 1));
  const e = lireExtension(kit);
  const moduleKwh = e?.moduleKwh || kwhDeLaLigne(lignes[i].designation) || capaciteDeBase(kit) / base;
  if (!(moduleKwh > 0)) return null;
  return { index: i, base, moduleKwh, min: 1, max: Math.max(base, modulesMaxKit(kit)) };
};

/** Capacité posée avec `n` modules : celle du kit, plus ou moins l'écart en modules. */
export const capaciteAvecModules = (kit, n, m = modulesDuKit(kit)) =>
  (m ? Math.round((capaciteDeBase(kit) + (n - m.base) * m.moduleKwh) * 100) / 100 : capaciteDeBase(kit));

/**
 * Modules posés AUTOMATIQUEMENT pour ce besoin : ceux du kit (point de
 * départ, jamais réduit d'office), plus ce qu'il faut pour couvrir le besoin,
 * dans la limite du maximum.
 */
export const modulesPourBesoin = (kit, besoin = 0, m = modulesDuKit(kit)) => {
  if (!m) return null;
  const manque = (Number(besoin) || 0) - capaciteDeBase(kit);
  const ajout = manque > 1e-9 ? Math.ceil(manque / m.moduleKwh - 1e-9) : 0;
  return Math.min(m.max, m.base + ajout);
};

/**
 * Lignes du kit avec le nombre de modules retenu : celui choisi à la main
 * (`modulesChoisis`, borné entre 1 et le maximum), sinon celui du besoin.
 * @returns {{lignes:Array, capacite:number, modules:number|null, auto:number|null,
 *   base:number|null, min:number, max:number|null, moduleKwh:number|null}}
 */
export const poserBatterie = (kit, lignes = kit?.lines, besoin = 0, modulesChoisis = null) => {
  const m = modulesDuKit(kit, lignes);
  if (!m) {
    return { lignes, capacite: capaciteDeBase(kit), modules: null, auto: null, base: null, min: 1, max: null, moduleKwh: null };
  }
  const auto = modulesPourBesoin(kit, besoin, m);
  const choisi = Math.round(Number(modulesChoisis));
  const modules = modulesChoisis != null && choisi >= 1 ? Math.min(m.max, Math.max(m.min, choisi)) : auto;
  const suite = modules === m.base ? lignes : lignes.map((l, j) => (j === m.index ? { ...l, qty: modules } : l));
  return {
    lignes: suite, capacite: capaciteAvecModules(kit, modules, m), modules, auto,
    base: m.base, min: m.min, max: m.max, moduleKwh: m.moduleKwh,
  };
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
