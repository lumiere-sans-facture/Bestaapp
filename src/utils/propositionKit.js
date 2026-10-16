// Proposition de kit — LA source commune du Simulateur ROI et de l'assistant
// de devis solaire.
//
// Les deux écrans appelaient déjà les fonctions de calcul, mais chacun avec
// ses propres réglages : pour un même besoin, ils ne composaient pas le kit
// de la même façon (modules batterie ajoutés invisibles au Simulateur,
// main-d'œuvre du Togo oubliée). Ils passent désormais tous deux par ce
// module : pour une même consommation, même kit, mêmes panneaux, mêmes
// modules, même total.
//
// Les kits préconfigurés restent le point de départ (le plus petit kit dont la
// batterie couvre le besoin), complétés au besoin en panneaux et en modules
// batterie. Le Simulateur ROI affiche cette proposition sans réglage (un
// devis repris y garde les siens). Dans l'assistant de devis, le vendeur
// l'ajuste ensuite à la main :
//   - les PANNEAUX (+/−) : jamais sous la chaîne minimale de l'onduleur ; au
//     dessus du kit, l'onduleur suit la règle habituelle (parallèle, puis un
//     autre modèle), et une configuration impossible bloque le « + » ;
//   - les MODULES BATTERIE (+/−) : des modules identiques à ceux du kit, d'un
//     à son maximum (utils/extensionBatterie.js). Sous le besoin, c'est permis,
//     avec une alerte « autonomie insuffisante ».
//
// Logique pure, sans React.
import {
  calculateSystemSize, suggestKitsForBattery, buildKitQuotation, phasesDuKit,
  DEFAULT_PEAK_SUN_HOURS, DEFAULT_AUTONOMY_NIGHTS, DEFAULT_MOUNTING_TYPE,
} from './solarSizing';
import { factureVersConsommation } from './factureConso';

/**
 * Consommation à dimensionner, depuis la saisie de l'assistant de devis (le
 * Simulateur ROI s'en sert pour ses appareils, arrondis de la même façon) :
 *   - appareils : puissance × quantité × heures, jour et nuit, arrondis au
 *     centième ; le pic = tout allumé en même temps ;
 *   - facture : montant ÷ prix du kWh, sur 30 jours, réparti selon « Quand
 *     consomme-t-il le plus ? » (utils/factureConso.js) ;
 *   - saisie directe : les kWh tapés.
 * Une facture ou une saisie directe ne disent rien du pic : 0.
 * @returns {{day:number, night:number, total:number, peakLoad:number}}
 */
export const consommationDimensionnement = ({ consoMode = 'appareils', appareils = [], manuel = {}, facture = {} } = {}) => {
  if (consoMode === 'direct') {
    const day = Number(manuel?.day) || 0;
    const night = Number(manuel?.night) || 0;
    return { day, night, total: day + night, peakLoad: 0 };
  }
  if (consoMode === 'facture') {
    const f = factureVersConsommation(facture?.montant, facture?.prixKwh, facture?.repartition);
    return { day: f.day, night: f.night, total: f.day + f.night, peakLoad: 0 };
  }
  const somme = (heures) => (appareils || []).reduce(
    (s, r) => s + (Number(r?.power) || 0) * (Number(r?.quantity) || 0) * (Number(r?.[heures]) || 0), 0,
  ) / 1000;
  const day = Number(somme('day').toFixed(2));
  const night = Number(somme('night').toFixed(2));
  const peakLoad = (appareils || []).reduce((s, r) => s + (Number(r?.power) || 0) * (Number(r?.quantity) || 0), 0);
  return { day, night, total: day + night, peakLoad };
};

/**
 * Réglages manuels encore valables ? Ils ne s'appliquent qu'au kit pour
 * lequel ils ont été faits, et tant que la proposition automatique n'a pas
 * bougé : si le besoin change (un appareil ajouté, une autre ville), on
 * repart du besoin — un « +2 panneaux » d'hier n'a plus de sens.
 */
export const reglagesApplicables = (reglages, kit, auto) => {
  if (!reglages || !kit || !auto || reglages.kitId !== kit.id) return { panneaux: null, modules: null };
  if (reglages.autoPanneaux !== auto.panelsIncluded || reglages.autoModules !== (auto.batterie?.modules ?? null)) {
    return { panneaux: null, modules: null };
  }
  const n = (v) => (v != null && Number(v) >= 1 ? Math.round(Number(v)) : null);
  return { panneaux: n(reglages.panneaux), modules: n(reglages.modules) };
};

/** Plafond de sécurité du bouton « + panneau » quand rien d'autre ne l'arrête. */
const PANNEAUX_MAX_FACTEUR = 4;

/**
 * Proposition complète pour un besoin.
 *
 * @param {object} e
 * @param {{day:number, night:number}} e.consumption  kWh par jour
 * @param {number} e.peakLoad        pic de charge (W), 0 si inconnu
 * @param {string} e.systemType      'off-grid' | 'hybrid' | 'on-grid'
 * @param {number} e.sunHours        heures de pic solaire
 * @param {number} e.autonomyNights  nuits couvertes par la batterie
 * @param {Array}  e.kits, e.inverters, e.products
 * @param {string|null} e.kitId      variante retenue (sinon la 1re suggérée)
 * @param {string} e.mountingType, {boolean} e.includeMounting
 * @param {1|3|null} e.phases        réseau ; null = celui de l'onduleur du kit
 * @param {number} e.coefMainOeuvre  2 au Togo, 1 sinon (utils/mainOeuvre.js)
 * @param {object|null} e.reglages   réglages +/− (voir reglagesApplicables)
 */
export const proposerKit = ({
  consumption, peakLoad = 0,
  systemType = 'off-grid', sunHours = DEFAULT_PEAK_SUN_HOURS, autonomyNights = DEFAULT_AUTONOMY_NIGHTS,
  kits = [], inverters = [], products = [],
  kitId = null, mountingType = DEFAULT_MOUNTING_TYPE, includeMounting = true, phases = null,
  coefMainOeuvre = 1, reglages = null,
} = {}) => {
  const day = Number(consumption?.day) || 0;
  const night = Number(consumption?.night) || 0;
  if (day + night <= 0) return null;
  const sizing = calculateSystemSize(
    { day, night }, systemType, Number(sunHours) || DEFAULT_PEAK_SUN_HOURS, undefined, autonomyNights,
    { peakLoad, inverters },
  );
  const suggeres = suggestKitsForBattery(kits, sizing.batteryCapacity);
  // La liste vient de « Mes kits » : elle peut être vide, ou la variante
  // retenue avoir été supprimée entre-temps.
  const kit = suggeres.find((k) => k.id === kitId) || suggeres[0] || kits[0] || null;
  if (!kit) return { sizing, suggeres, kit: null };

  const reseau = phases === 3 || phases === 1 ? phases : phasesDuKit(kit, inverters);
  const devis = (choix = {}) => buildKitQuotation(
    kit, mountingType, includeMounting, sizing, inverters, products, coefMainOeuvre,
    { phases: reseau, ...choix },
  );
  const auto = devis();
  const choix = reglagesApplicables(reglages, kit, auto);
  const manuel = choix.panneaux != null || choix.modules != null;
  const quotation = manuel ? devis(choix) : auto;

  // ---- Panneaux : bornes des boutons +/− ----
  const poses = quotation.panelsIncluded;
  const plafond = Math.max(kit.panels || 0, auto.panelsIncluded) * PANNEAUX_MAX_FACTEUR;
  let plus = null;
  if (poses < plafond) {
    // Le « + » va au nombre câblable suivant : un panneau de plus peut ne
    // pas se répartir en chaînes égales quand deux de plus le permettent
    // (panneaux d'équilibrage, voir utils/ajustementsKit.js).
    const essai = devis({ ...choix, panneaux: poses + 1 });
    if (essai.panelsIncluded > poses && !essai.configurationImpossible && !essai.inverterInsuffisant) plus = essai.panelsIncluded;
  }
  // Sous le kit, toutes les longueurs de chaîne ne démarrent pas l'onduleur :
  // le « − » saute au nombre valide inférieur le plus proche.
  let moins = null;
  for (let n = poses - 1; n >= Math.max(1, quotation.panneauxMin); n -= 1) {
    if (devis({ ...choix, panneaux: n }).panelsIncluded < poses) { moins = n; break; }
  }

  // ---- Batterie ----
  const capacite = quotation.batteryCapacity;
  const besoinBatterie = sizing.batteryCapacity;
  const b = quotation.batterie || {};
  const nuitsSizing = Number(sizing.autonomyNights) || DEFAULT_AUTONOMY_NIGHTS;
  // Nuits réellement couvertes : la capacité posée rapportée au besoin
  // d'une nuit (rendement et profondeur de décharge compris).
  const autonomieNuits = besoinBatterie > 0 ? Math.round((capacite / besoinBatterie) * nuitsSizing * 10) / 10 : null;

  const alertes = [];
  if (besoinBatterie > 0 && capacite + 1e-9 < besoinBatterie) {
    alertes.push({
      type: 'autonomie',
      texte: `Autonomie insuffisante : ${fmt(capacite)} kWh de batterie pour ${fmt(besoinBatterie)} kWh conseillés — environ ${fmt(autonomieNuits)} nuit${autonomieNuits >= 2 ? 's' : ''} au lieu de ${fmt(nuitsSizing)}.`,
    });
  }
  const panneauxBesoin = sizing.requiredPanelPower && kit.panelW ? Math.ceil(sizing.requiredPanelPower / kit.panelW) : null;
  if (panneauxBesoin && poses < panneauxBesoin) {
    alertes.push({
      type: 'production',
      texte: `Production insuffisante : ${poses} panneaux pour ${panneauxBesoin} nécessaires — la batterie ne se rechargera pas entièrement les jours ordinaires.`,
    });
  }

  return {
    sizing,
    suggeres,
    kit,
    phases: reseau,
    quotation,
    total: quotation.total,
    manuel,
    panneaux: {
      poses, auto: auto.panelsIncluded, besoin: panneauxBesoin, min: quotation.panneauxMin,
      plus, moins, panelW: Number(kit.panelW) || 0,
      kwc: Math.round(poses * (Number(kit.panelW) || 0)) / 1000,
    },
    batterie: {
      modules: b.modules ?? null, auto: b.auto ?? null, base: b.base ?? null,
      min: b.min ?? 1, max: b.max ?? null, moduleKwh: b.moduleKwh ?? null,
      plus: b.modules != null && b.modules < b.max ? b.modules + 1 : null,
      moins: b.modules != null && b.modules > b.min ? b.modules - 1 : null,
      capacite, besoin: besoinBatterie, autonomieNuits,
    },
    // Réglages à enregistrer avec l'étude (ou null si tout est automatique) :
    // ils portent la proposition automatique de référence, pour ne pas
    // s'appliquer à un autre besoin.
    reglages: manuel ? {
      kitId: kit.id, autoPanneaux: auto.panelsIncluded, autoModules: auto.batterie?.modules ?? null,
      panneaux: choix.panneaux, modules: choix.modules,
    } : null,
    alertes,
  };
};

const fmt = (v) => Number(v || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 });

/**
 * Réglages après un appui sur +/− : `quoi` = 'panneaux' | 'modules', `valeur`
 * = le nouveau nombre (proposition.panneaux.plus, .moins, …). Les autres
 * réglages manuels sont gardés.
 */
export const reglerProposition = (proposition, quoi, valeur) => {
  if (!proposition?.kit || valeur == null) return proposition?.reglages || null;
  const actuels = proposition.reglages || {
    kitId: proposition.kit.id,
    autoPanneaux: proposition.panneaux.auto,
    autoModules: proposition.batterie.auto,
    panneaux: null,
    modules: null,
  };
  return { ...actuels, [quoi]: valeur };
};

/**
 * Proposition depuis une ÉTUDE au format de utils/dimensionnement.js
 * (capturerDimensionnement) — le format que le Simulateur transmet au devis,
 * et celui que l'assistant enregistre. Les deux écrans passent par ici : même
 * étude, même proposition, au franc près.
 * @param {object} etude
 * @param {{kits:Array, inverters:Array, products:Array, coefMainOeuvre:number}} contexte
 */
export const propositionDepuisEtude = (etude, { kits = [], inverters = [], products = [], coefMainOeuvre = 1 } = {}) => {
  if (!etude) return null;
  const conso = consommationDimensionnement({
    consoMode: etude.consoMode, appareils: etude.appareils, manuel: etude.manuel, facture: etude.facture,
  });
  return proposerKit({
    consumption: conso,
    peakLoad: conso.peakLoad,
    systemType: etude.systemType,
    sunHours: etude.sunHours,
    autonomyNights: etude.autonomyNights,
    kits, inverters, products,
    kitId: etude.kitId,
    mountingType: etude.mountingType,
    includeMounting: etude.includeMounting !== false,
    phases: etude.phases === 3 || etude.phases === 1 ? etude.phases : null,
    coefMainOeuvre,
    reglages: etude.reglages,
  });
};
