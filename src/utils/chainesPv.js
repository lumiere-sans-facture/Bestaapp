// Chaînes solaires : combien de panneaux en série, combien de chaînes, sur
// quelles entrées MPPT — dans les limites électriques de l'onduleur.
//
// Logique pure, sans React. Les hypothèses (températures du site, panneaux
// de référence) viennent de config/extensionKit.js.
//
// Une chaîne de n panneaux en série doit :
//   - à FROID, garder sa tension à vide sous la tension DC max de l'onduleur
//     (n × Voc(Tmin) ≤ vocMax) — au-delà, l'onduleur est détruit ;
//   - à CHAUD, rester dans la plage MPPT (n × Vmp(Tcellule max) ≥ mpptMin),
//     et à froid ne pas la dépasser (n × Vmp(Tmin) ≤ mpptMax) ;
// et plusieurs chaînes sur une même entrée MPPT (en parallèle) doivent :
//   - être de MÊME longueur ;
//   - ne pas dépasser le courant de court-circuit admis par l'entrée
//     (k × Isc ≤ iscMaxMppt), à défaut son courant max (k × Imp ≤ iMaxMppt).
import { CONDITIONS_SITE, PANNEAUX_REFERENCE, TOLERANCE_CHAINES } from '../config/extensionKit';

const nombre = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Caractéristiques électriques du panneau de cette puissance, ou null. */
export const specPanneau = (panelW, references = PANNEAUX_REFERENCE) => {
  const ref = references?.[Math.round(Number(panelW) || 0)];
  return ref ? { wc: Math.round(Number(panelW)), ...ref } : null;
};

/**
 * Caractéristiques électriques d'un onduleur (champ `electrique`), ou null
 * si l'ESSENTIEL manque : la tension DC max (limite de sécurité, jamais
 * dépassée) et le nombre de MPPT. Le reste est facultatif :
 *   - plage MPPT inconnue → max = tension DC max, min = 0 (démarrage à chaud
 *     non vérifiable, signalé) ;
 *   - chaînes par MPPT inconnues → 1 ;
 *   - courants inconnus → pas de limite de courant vérifiable.
 */
export const lireElectrique = (onduleur) => {
  const e = onduleur?.electrique;
  if (!e) return null;
  const spec = {
    vocMax: nombre(e.vocMax),
    mpptMin: nombre(e.mpptMin),
    mpptMax: nombre(e.mpptMax),
    nbMppt: Math.floor(nombre(e.nbMppt)),
    chainesParMppt: Math.floor(nombre(e.chainesParMppt)) || 1,
    iMaxMppt: nombre(e.iMaxMppt),
    iscMaxMppt: nombre(e.iscMaxMppt),
    phases: Number(e.phases) === 3 ? 3 : 1,
  };
  if (!spec.vocMax || !spec.nbMppt) return null;
  spec.plageMppt = spec.mpptMin > 0 && spec.mpptMax > 0;
  if (!spec.mpptMax || spec.mpptMax > spec.vocMax) spec.mpptMax = spec.vocMax;
  return spec;
};

/** Tension corrigée en température : V × (1 + coef% × (T − 25)). */
const corriger = (v, coefPct, t) => v * (1 + (coefPct / 100) * (t - 25));

/**
 * Longueurs de chaîne admissibles pour ce panneau sur cet onduleur.
 * @returns {{nMin:number, nMax:number, vocFroid:number, vmpChaud:number, vmpFroid:number}}
 */
export const limitesChaine = (panneau, elec, site = CONDITIONS_SITE) => {
  const vocFroid = corriger(panneau.voc, panneau.coefVoc, site.temperatureMin);
  const vmpFroid = corriger(panneau.vmp, panneau.coefVmp, site.temperatureMin);
  const vmpChaud = corriger(panneau.vmp, panneau.coefVmp, site.temperatureCelluleMax);
  return {
    nMin: Math.max(1, Math.ceil((elec.mpptMin || 0) / vmpChaud)),
    nMax: Math.min(Math.floor(elec.vocMax / vocFroid), Math.floor(elec.mpptMax / vmpFroid)),
    vocFroid, vmpChaud, vmpFroid,
  };
};

/**
 * Nombre de chaînes en parallèle qu'une entrée MPPT admet, courant compris.
 * Le courant de court-circuit fait foi quand il est connu (limite de
 * sécurité) ; sinon le courant max d'entrée.
 */
export const chainesMaxParMppt = (panneau, elec) => {
  let parCourant = Infinity;
  if (elec.iscMaxMppt) parCourant = Math.floor(elec.iscMaxMppt / panneau.isc);
  else if (elec.iMaxMppt) parCourant = Math.floor(elec.iMaxMppt / panneau.imp);
  return Math.max(0, Math.min(elec.chainesParMppt || 1, parCourant));
};

/**
 * Répartit des chaînes (leurs longueurs) sur les entrées MPPT : une entrée ne
 * reçoit que des chaînes de même longueur, au plus `kMax`, et les chaînes
 * sont étalées sur le plus d'entrées possible (une par entrée tant qu'il y en
 * a de libres). `null` si c'est impossible.
 */
const repartir = (longueurs, nbMppt, kMax) => {
  const groupes = new Map();
  for (const n of longueurs) groupes.set(n, (groupes.get(n) || 0) + 1);
  const liste = [...groupes.entries()].sort((a, b) => b[0] - a[0]);
  const minimum = (nb) => Math.ceil(nb / kMax);
  const mppt = [];
  for (let g = 0; g < liste.length; g += 1) {
    const [n, nb] = liste[g];
    const reserve = liste.slice(g + 1).reduce((s, [, k]) => s + minimum(k), 0);
    const entrees = Math.min(nb, nbMppt - mppt.length - reserve);
    if (entrees < minimum(nb)) return null;
    for (let i = 0; i < entrees; i += 1) {
      mppt.push(Array(Math.floor(nb / entrees) + (i < nb % entrees ? 1 : 0)).fill(n));
    }
  }
  return mppt;
};

/**
 * Configuration des chaînes pour `nbPanneaux` panneaux sur UN onduleur.
 * Le nombre de chaînes reste près du MINIMUM possible (`sMin`, chaînes égales
 * ou de n et n+1 panneaux) : des chaînes ÉQUILIBRÉES (toutes de même
 * longueur) sont préférées tant qu'elles n'en comptent pas plus de
 * sMin + `tolerance`. Sinon — et si `equilibreSeulement` est faux — des
 * chaînes de n et n+1 panneaux au nombre minimal, chacune sur des entrées
 * MPPT distinctes (jamais deux longueurs sur la même entrée).
 *
 * @returns {{ok:boolean, equilibre:boolean, chaines:number[], mppt:number[][],
 *   nMin:number, nMax:number, vocChaine:number, raisons:string[], alertes:string[]}}
 */
export const configurerChaines = (nbPanneaux, panneau, elec, { site = CONDITIONS_SITE, equilibreSeulement = false, tolerance = TOLERANCE_CHAINES } = {}) => {
  const N = Math.max(0, Math.floor(Number(nbPanneaux) || 0));
  const lim = limitesChaine(panneau, elec, site);
  const kMax = chainesMaxParMppt(panneau, elec);
  const capacite = elec.nbMppt * kMax;
  const echec = (raisons) => ({
    ok: false, equilibre: false, chaines: [], mppt: [], nMin: lim.nMin, nMax: lim.nMax, vocChaine: 0, raisons, alertes: [],
  });
  const reussite = (chaines, mppt, equilibre) => {
    const alertes = [];
    // Courant de fonctionnement au-delà de l'entrée : pas dangereux (l'onduleur
    // écrête), mais de la production perdue — le dire.
    if (elec.plageMppt === false) {
      alertes.push('plage MPPT de l’onduleur non renseignée : tension de démarrage à chaud non vérifiée');
    }
    if (elec.iMaxMppt && mppt.some((g) => g.length * panneau.imp > elec.iMaxMppt)) {
      alertes.push(`courant de fonctionnement au-delà de ${elec.iMaxMppt} A sur une entrée MPPT : légère perte de production (écrêtage)`);
    }
    return {
      ok: true, equilibre, chaines, mppt, nMin: lim.nMin, nMax: lim.nMax,
      vocChaine: Math.max(...chaines) * lim.vocFroid, raisons: [], alertes,
    };
  };

  if (N === 0) return { ...reussite([], [], true), vocChaine: 0 };
  if (lim.nMin > lim.nMax) {
    return echec([`plage MPPT incompatible avec ce panneau (${lim.nMin} panneaux minimum pour démarrer, ${lim.nMax} au plus sous ${elec.vocMax} V)`]);
  }
  if (kMax < 1) {
    return echec([`une seule chaîne dépasse déjà le courant admis par une entrée MPPT (${elec.iscMaxMppt || elec.iMaxMppt} A)`]);
  }
  if (N < lim.nMin) {
    return echec([`${N} panneau(x) ne suffisent pas à atteindre la tension de démarrage MPPT (${lim.nMin} au minimum en série)`]);
  }
  if (N > capacite * lim.nMax) {
    return echec([`au plus ${capacite} chaîne(s) de ${lim.nMax} panneaux, soit ${capacite * lim.nMax} panneaux (tension DC max ${elec.vocMax} V, ${elec.nbMppt} MPPT)`]);
  }

  // s chaînes de n et n+1 panneaux (toutes de n si le compte tombe juste),
  // chaque longueur sur ses propres entrées : la configuration, ou null.
  const essayer = (s) => {
    const n = Math.floor(N / s);
    const r = N % s;
    if (n < lim.nMin || (r > 0 ? n + 1 : n) > lim.nMax) return null;
    const longueurs = [...Array(r).fill(n + 1), ...Array(s - r).fill(n)];
    const mppt = repartir(longueurs, elec.nbMppt, kMax);
    return mppt ? { longueurs, mppt, equilibre: r === 0 } : null;
  };

  // 1. Le plus petit nombre de chaînes possible.
  let sMin = 0;
  let auMinimum = null;
  for (let s = 1; s <= capacite && !auMinimum; s += 1) {
    auMinimum = essayer(s);
    if (auMinimum) sMin = s;
  }
  if (!auMinimum) {
    return echec([`aucune répartition sûre de ${N} panneaux sur ${elec.nbMppt} MPPT (${lim.nMin} à ${lim.nMax} panneaux par chaîne)`]);
  }
  // 2. Chaînes égales, à condition de ne pas multiplier les chaînes : au
  //    plus `tolerance` de plus que le minimum.
  const plafond = Math.min(capacite, sMin + Math.max(0, Math.floor(Number(tolerance) || 0)));
  for (let s = sMin; s <= plafond; s += 1) {
    const c = s === sMin ? auMinimum : essayer(s);
    if (c?.equilibre) return reussite(c.longueurs, c.mppt, true);
  }
  if (equilibreSeulement) {
    return echec([`${N} panneaux ne se répartissent pas en chaînes égales de ${lim.nMin} à ${lim.nMax} panneaux sur ${elec.nbMppt} MPPT sans multiplier les chaînes (${plafond} au plus)`]);
  }
  // 3. Sinon, n et n+1 panneaux au nombre minimal de chaînes.
  return reussite(auMinimum.longueurs, auMinimum.mppt, auMinimum.equilibre);
};

/** « 2 chaînes de 7 panneaux », « 1 chaîne de 8 + 1 chaîne de 7 ». */
export const libelleChaines = (chaines = []) => {
  if (!chaines.length) return 'aucune chaîne';
  const groupes = new Map();
  for (const n of chaines) groupes.set(n, (groupes.get(n) || 0) + 1);
  return [...groupes.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([n, nb]) => `${nb} chaîne${nb > 1 ? 's' : ''} de ${n} panneau${n > 1 ? 'x' : ''}`)
    .join(' + ');
};
