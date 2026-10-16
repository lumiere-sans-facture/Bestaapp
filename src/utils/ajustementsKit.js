// Ajustements d'un kit étendu : quand une proposition exige plus de panneaux
// que le kit n'en compte, ce module calcule ce qui doit suivre — chaînes,
// onduleur, câbles et protections, main-d'œuvre — sous forme de lignes
// d'AJUSTEMENT explicites. Le kit d'origine n'est jamais modifié.
//
// Logique pure, sans React. Les règles chiffrées viennent de
// config/extensionKit.js ; les fonctions de dimensionnement de l'onduleur
// (pic, puissance PV, parallèle) sont passées par l'appelant (`outils`), pour
// ne pas créer de dépendance circulaire avec utils/solarSizing.js.
import {
  MAIN_OEUVRE_EXTENSION, CONDITIONS_SITE, SECTIONS_CABLE_PV, COEF_COURANT_CABLE,
  MATERIEL_PAR_CHAINE, MATERIEL_PAR_MPPT, COFFRET_JONCTION, PROTECTION_AC, PANNEAUX_EQUILIBRAGE_MAX,
} from '../config/extensionKit';
import { specPanneau, lireElectrique, configurerChaines, libelleChaines, limitesChaine } from './chainesPv';
import { maxEnParallele } from './inverters';
import { resolveLignePrice } from './kits';
import { prixPublic } from './price';

const kwc = (panneaux, wc) => (panneaux * (Number(wc) || 0)) / 1000;

/** Répartition de N panneaux sur q onduleurs, la plus égale possible. */
const partager = (n, q) => Array.from({ length: q }, (_, i) => Math.floor(n / q) + (i < n % q ? 1 : 0));

/**
 * Main-d'œuvre d'un kit étendu (règle du gérant) :
 *   base + panneaux ajoutés × tarif panneau + kWh de batterie ajoutés × tarif kWh.
 * Les kWh gardent leur précision décimale ; seul le montant final du
 * supplément batterie est arrondi au franc.
 * @returns {{base:number, panneaux:{nombre:number,tarif:number,montant:number},
 *   batterie:{kwh:number,tarif:number,montant:number}, total:number}}
 */
export const mainOeuvreEtendue = (base, panneauxAjoutes, kwhAjoutes, tarifs = MAIN_OEUVRE_EXTENSION) => {
  // Panneaux EN MOINS que le kit : aucune réduction — la main-d'œuvre du
  // kit de base est gardée (règle du gérant).
  const nombre = Math.max(0, Math.floor(Number(panneauxAjoutes) || 0));
  const kwh = Math.max(0, Number(kwhAjoutes) || 0);
  const baseArrondie = Math.round(Number(base) || 0);
  const montantPanneaux = nombre * tarifs.parPanneau;
  const montantBatterie = Math.round(kwh * tarifs.parKwhBatterie);
  return {
    base: baseArrondie,
    panneaux: { nombre, tarif: tarifs.parPanneau, montant: montantPanneaux },
    batterie: { kwh, tarif: tarifs.parKwhBatterie, montant: montantBatterie },
    total: baseArrondie + montantPanneaux + montantBatterie,
  };
};

/**
 * Panneaux en série qu'il faut AU MINIMUM pour démarrer cet onduleur
 * (tension MPPT minimale), 0 si ses caractéristiques sont inconnues.
 */
export const panneauxMinimumOnduleur = (panelW, onduleur, site = CONDITIONS_SITE) => {
  const panneau = specPanneau(panelW);
  const elec = lireElectrique(onduleur);
  if (!panneau || !elec) return 0;
  const { nMin, nMax } = limitesChaine(panneau, elec, site);
  return nMin <= nMax ? nMin : 0;
};

/**
 * Nombre de panneaux POSÉS pour un kit : toujours celui du dimensionnement
 * (règle du gérant), au-dessus comme EN DESSOUS du kit de base. Sous le kit,
 * jamais moins qu'une configuration de chaînes valide sur l'onduleur du kit
 * (tension MPPT minimale) — sinon le nombre valide le plus proche.
 * Sans dimensionnement (`demande` nulle), le kit tel quel.
 */
export const panneauxPourKit = (kit, demande, onduleurKit = null, site = CONDITIONS_SITE) => {
  const base = Number(kit?.panels) || 0;
  const d = Math.ceil(Number(demande) || 0);
  if (d <= 0 || d >= base) return d > 0 ? d : base;
  const panneau = specPanneau(kit?.panelW);
  const elec = lireElectrique(onduleurKit);
  if (!panneau || !elec) return Math.max(1, d);
  for (let n = Math.max(1, d); n < base; n += 1) {
    if (configurerChaines(n, panneau, elec, { site }).ok) return n;
  }
  return base;
};

const fmtKwh = (v) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

/** Section de câble PV (mm²) adaptée au courant d'une chaîne. */
export const sectionCablePv = (panneau) => {
  const courant = (panneau?.isc || 0) * COEF_COURANT_CABLE;
  return SECTIONS_CABLE_PV.find((s) => s.courantMax >= courant) || SECTIONS_CABLE_PV[SECTIONS_CABLE_PV.length - 1];
};

/** Section lue dans une désignation (« Câble PV 1x6mm² » → 6). */
const sectionDe = (designation = '') => {
  const m = /\d\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*mm/i.exec(designation);
  return m ? Number(m[1].replace(',', '.')) : 0;
};

/** Calibre de disjoncteur AC pour la sortie de cet onduleur. */
export const protectionAc = (onduleur, phases = 1) => {
  const p = (Number(onduleur?.capacity) || 0) * 1000;
  const courant = phases === 3
    ? p / (PROTECTION_AC.tensionTri * Math.sqrt(3))
    : p / PROTECTION_AC.tensionMono;
  const requis = courant * PROTECTION_AC.coefCourant;
  const calibres = PROTECTION_AC.calibres;
  return calibres.find((c) => c.a >= requis) || calibres[calibres.length - 1];
};

/**
 * Une ligne du kit (ou un produit boutique) est-elle l'équivalent de cette
 * règle ? Elle doit correspondre à `re`, sans tomber sous `exclure` — un
 * coffret « + Ensemble fusible » n'est pas un fusible, un « Lot de petites
 * fournitures (moulure…) » n'est pas une gaine — et n'être jamais un coffret
 * DC : son prix, facturé à chaque chaîne, multipliait le devis.
 */
const equivalent = (regle, texte = '') => !!regle.re && regle.re.test(texte)
  && !(regle.exclure && regle.exclure.test(texte)) && !COFFRET_JONCTION.re.test(texte);

/**
 * Prix et désignation d'un élément à ajouter : la ligne équivalente du kit
 * fait foi (même fournisseur, même tarif) ; à défaut un produit boutique au
 * prix public (règle de marge : utils/price.js) ; sinon le prix par défaut.
 */
const tarifer = (regle, lignesKit, products) => {
  const { re, designation, prixDefaut } = regle;
  const duKit = re && lignesKit.find((l) => equivalent(regle, l.designation));
  if (duKit) return { designation: duKit.designation, pu: resolveLignePrice(duKit, products), source: 'kit' };
  const produit = re && (products || []).find((p) => equivalent(regle, p.name));
  if (produit) {
    return {
      designation: produit.name, pu: prixPublic(produit.basePrice), productId: produit.id,
      cout: Number(produit.basePrice) || 0, source: 'boutique',
    };
  }
  return { designation, pu: prixDefaut, source: 'règle' };
};

/** « Deye Onduleur PCS 125 kW », ou sa puissance faute de nom. */
const nomOnduleur = (o) => [o?.brand, o?.model].filter(Boolean).join(' ') || `Onduleur ${o?.capacity ?? '?'} kVA`;

/**
 * Évalue `quantite` exemplaires d'un onduleur pour `panneaux` panneaux :
 * pic de consommation, puissance PV par appareil, chaînes de chacun.
 */
const evaluer = ({ modele, quantite, panneaux, panneau, wc, equilibreSeulement, outils, site }) => {
  const elec = lireElectrique(modele);
  const raisons = [];
  if (quantite > maxEnParallele(modele)) return { ok: false, raisons: ['mise en parallèle non autorisée'] };
  // Tension max et MPPT non renseignés : chaînes incalculables, modèle
  // écarté — on ne propose pas une configuration qu'on ne peut vérifier.
  if (!elec) return { ok: false, raisons: ['caractéristiques électriques non renseignées'] };
  // Contrôle du pic facultatif : pour un kit, seul l'accueil des panneaux
  // décide de l'onduleur (règle du gérant, voir utils/solarSizing.js).
  const pic = outils.controlePic ? outils.controlePic(modele, quantite) : { ok: true };
  if (!pic.ok) raisons.push(pic.raison);
  const parts = partager(panneaux, quantite);
  if (equilibreSeulement && parts.some((p) => p !== parts[0])) {
    raisons.push(`${panneaux} panneaux ne se partagent pas également entre ${quantite} onduleurs`);
  }
  const limitePv = outils.limitePv(modele);
  const configs = parts.map((n) => configurerChaines(n, panneau, elec, { site, equilibreSeulement }));
  parts.forEach((n, i) => {
    if (limitePv && n * wc > limitePv) {
      raisons.push(`${(n * wc).toLocaleString('fr-FR')} Wc dépassent la puissance PV admise (${limitePv.toLocaleString('fr-FR')} Wc)`);
    }
    if (!configs[i].ok) raisons.push(...configs[i].raisons);
  });
  return { ok: raisons.length === 0, raisons: [...new Set(raisons)], configs, elec, parts };
};

/**
 * Ordre d'essai des onduleurs d'un kit (règle du gérant) : l'onduleur du kit
 * seul d'abord ; ensuite, toutes les autres solutions — le même en
 * parallèle, les autres modèles (`autres`, triés du plus petit au plus
 * grand) seuls ou en parallèle — de la MOINS CHÈRE à la plus chère (prix ×
 * nombre d'appareils).
 * @returns {Array<{modele:object, quantite:number}>}
 */
export const ordreEscalade = (onduleurKit, autres = []) => {
  const etapes = [];
  if (onduleurKit) {
    for (let q = 2; q <= maxEnParallele(onduleurKit); q += 1) etapes.push({ modele: onduleurKit, quantite: q });
  }
  const plafond = Math.max(1, ...autres.map(maxEnParallele));
  for (let q = 1; q <= plafond; q += 1) {
    for (const modele of autres) if (maxEnParallele(modele) >= q) etapes.push({ modele, quantite: q });
  }
  // LE PRIX D'ABORD (règle du gérant) : une fois l'onduleur du kit seul
  // écarté, la solution la moins chère passe devant — un 16 kW à lui seul
  // plutôt que deux 12 kW s'il coûte moins. Prix inconnu : après les prix
  // connus. À coût égal, l'ordre ci-dessus (celui du kit, puis le moins
  // d'appareils, puis le plus petit) départage — le tri est stable.
  const cout = (e) => (Number(e.modele.price) > 0 ? Number(e.modele.price) * e.quantite : Infinity);
  etapes.sort((a, b) => (cout(a) === cout(b) ? 0 : cout(a) - cout(b)));
  return onduleurKit ? [{ modele: onduleurKit, quantite: 1 }, ...etapes] : etapes;
};

/**
 * Ajustements d'un kit pour une proposition.
 *
 * @param {object} p
 * @param {object} p.kit               kit de base (jamais modifié)
 * @param {Array}  p.lignesKit         lignes du kit (batterie étendue comprise)
 * @param {number} p.panneauxDemandes  panneaux exigés par la proposition
 * @param {object|null} p.onduleurKit  spec configurée de l'onduleur du kit
 *   (ou celle qui le remplace d'office, triphasé demandé)
 * @param {object|null} [p.onduleurOrigine]  onduleur PROPRE au kit, quand
 *   `onduleurKit` lui a été substitué (triphasé) ; par défaut, le même
 * @param {Array}  p.candidats         onduleurs de même tension batterie
 * @param {object} p.outils            { controlePic(modele, q) → {ok, raison},
 *   limitePv(modele) → Wc, puissanceSortie(modele) → W }
 * @param {Array}  p.products          catalogue boutique (prix des ajouts)
 * @param {number} [p.equilibrageMax]  panneaux qu'on peut poser en plus pour
 *   que les chaînes se câblent (PANNEAUX_EQUILIBRAGE_MAX par défaut)
 * @returns {object} synthèse des ajustements (voir le retour ci-dessous)
 */
export const ajusterKit = ({
  kit, lignesKit = kit?.lines || [], panneauxDemandes = 0, panneauxRetenus = null, onduleurKit = null, onduleurOrigine, candidats = [],
  batterieFinale = null,
  outils, products = [], tarifs = MAIN_OEUVRE_EXTENSION, site = CONDITIONS_SITE,
  equilibrageMax = PANNEAUX_EQUILIBRAGE_MAX, equilibrage = null,
}) => {
  // Batterie : capacité du kit et capacité posée (modules ajoutés compris,
  // voir utils/extensionBatterie.js).
  // Modules retirés à la main (bouton −) : la capacité descend sous celle du
  // kit — sans réduire la main-d'œuvre, comme pour les panneaux en moins.
  const kwhBase = Number(kit?.battery) || 0;
  const kwhFinal = batterieFinale != null && Number(batterieFinale) > 0 ? Number(batterieFinale) : kwhBase;
  const arrondi = (v) => Math.round(v * 100) / 100;
  const batterie = {
    base: kwhBase, finale: kwhFinal,
    ajoutes: arrondi(Math.max(0, kwhFinal - kwhBase)), retires: arrondi(Math.max(0, kwhBase - kwhFinal)),
  };
  const base = Number(kit?.panels) || 0;
  const wc = Number(kit?.panelW) || 0;
  const demande = Math.max(0, Math.ceil(Number(panneauxDemandes) || 0));
  // Panneaux posés : ceux retenus par l'appelant (voir panneauxPourKit),
  // sinon au moins ceux du kit.
  const final = panneauxRetenus != null ? Math.max(0, Math.round(Number(panneauxRetenus) || 0)) : Math.max(base, demande);
  const ajoutes = Math.max(0, final - base);
  const retires = Math.max(0, base - final);
  const cas = demande < base ? 'inferieur' : demande === base ? 'egal' : 'superieur';
  const panneaux = {
    base, demande, final, ajoutes, retires, wc, cas,
    kwcBase: kwc(base, wc), kwcFinal: kwc(final, wc), kwcAjoutes: kwc(ajoutes, wc), kwcRetires: kwc(retires, wc),
  };
  if (ajoutes === 0 && retires === 0 && batterie.ajoutes === 0 && batterie.retires === 0) {
    return { actif: false, panneaux, batterie, verification: null, onduleur: null, chaines: null, lignes: [], mainOeuvre: null, alertes: [], diagnostic: [] };
  }

  const baseMo = lignesKit.filter((l) => l.labor).reduce((s, l) => s + (Number(l.qty) || 0) * resolveLignePrice(l, products), 0);
  // Main-d'œuvre (règle du gérant) : celle du kit, plus les suppléments
  // des panneaux et kWh de batterie AJOUTÉS ; jamais réduite quand le
  // dimensionnement pose moins de panneaux que le kit.
  const mainOeuvre = mainOeuvreEtendue(baseMo, ajoutes, batterie.ajoutes, tarifs);
  const lignesMo = [
    {
      designation: `Main d'œuvre — supplément ${ajoutes} panneau${ajoutes > 1 ? 'x' : ''} ajouté${ajoutes > 1 ? 's' : ''}`,
      qty: ajoutes, unit: 'pcs', pu: tarifs.parPanneau, labor: true, ajustement: 'main-oeuvre',
    },
    {
      designation: `Main d'œuvre — supplément batterie (+${fmtKwh(batterie.ajoutes)} kWh)`,
      qty: 1, unit: 'forfait', pu: mainOeuvre.batterie.montant, labor: true, ajustement: 'main-oeuvre',
    },
  ].filter((l) => l.pu > 0 && l.qty > 0);

  // Aucun panneau ajouté (batterie seule étendue, ou panneaux EN MOINS) :
  // l'onduleur du kit reste ; seules les chaînes (recalculées sur lui) et la
  // main-d'œuvre suivent.
  if (ajoutes === 0) {
    let chaines = null;
    const panneauRef = retires > 0 ? specPanneau(wc) : null;
    const elec = retires > 0 ? lireElectrique(onduleurKit) : null;
    if (panneauRef && elec) {
      const cfgB = configurerChaines(base, panneauRef, elec, { site });
      const cfgF = configurerChaines(final, panneauRef, elec, { site });
      if (cfgF.ok) {
        chaines = {
          base: cfgB.ok ? { chaines: cfgB.chaines, mppt: cfgB.mppt, libelle: libelleChaines(cfgB.chaines) } : null,
          final: [{ panneaux: final, chaines: cfgF.chaines, mppt: cfgF.mppt, libelle: libelleChaines(cfgF.chaines), vocChaine: Math.round(cfgF.vocChaine) }],
          libelle: libelleChaines(cfgF.chaines),
          ajoutees: 0,
          mpptAjoutes: 0,
        };
      }
    }
    return { actif: true, panneaux, batterie, verification: null, onduleur: null, chaines, lignes: lignesMo, mainOeuvre, alertes: [], diagnostic: [] };
  }

  const panneau = specPanneau(wc);
  const elecKit = lireElectrique(onduleurKit);
  const ancien = onduleurKit
    ? { id: onduleurKit.id, designation: [onduleurKit.brand, onduleurKit.model].filter(Boolean).join(' '), capacity: onduleurKit.capacity }
    : { id: null, designation: `Onduleur du kit (${kit.inverter} kVA)`, capacity: kit.inverter };

  // Sans caractéristiques électriques (panneau ou onduleur du kit), les
  // chaînes ne peuvent pas être calculées : on le DIT, sans rien supposer.
  if (!panneau || !onduleurKit || !elecKit) {
    // Aucun onduleur de « Mes onduleurs » ne correspond à celui du kit (même
    // puissance, même tension) : c'est cela qu'il faut dire, pas « des
    // caractéristiques non renseignées » d'un onduleur introuvable.
    const manque = !panneau
      ? `panneau de ${wc} Wc absent des références électriques`
      : !onduleurKit
        ? `aucun onduleur de « Mes onduleurs » ne correspond à celui du kit (${kit.inverter} kVA, même tension batterie)`
        : 'caractéristiques électriques de l’onduleur du kit non renseignées (Plus › Onduleurs)';
    return {
      actif: true, panneaux, batterie, verification: 'non-verifie',
      onduleur: { statut: 'non-verifie', ancien, nouveau: null, quantite: 1, raisons: [manque] },
      chaines: null, lignes: lignesMo, mainOeuvre,
      diagnostic: [{ modele: ancien.designation, quantite: 1, raisons: [manque] }],
      alertes: [`Chaînes non vérifiées : ${manque}. Câbles et protections des chaînes ajoutées à prévoir sur place.`],
    };
  }

  // Chaînes du kit de base, sur son PROPRE onduleur : c'est pour lui que le
  // kit a été composé (câbles, connecteurs). Un onduleur substitué d'office
  // (triphasé) peut, lui, exiger plus de panneaux que le kit n'en a.
  const origine = onduleurOrigine === undefined ? onduleurKit : onduleurOrigine;
  const substitue = origine !== onduleurKit;
  const elecOrigine = substitue ? lireElectrique(origine) : elecKit;
  const cfgBase = configurerChaines(base, panneau, elecOrigine || elecKit, { site });
  // Les caractéristiques saisies pour l'onduleur du kit ne permettent même
  // pas le kit de BASE (« chaînes par MPPT » vide → 1 chaîne par entrée, par
  // exemple) : c'est une incohérence de saisie, pas une impossibilité. Pas
  // d'escalade, pas de remplacement, pas de matériel de chaînes calculé sur
  // des données fausses — le devis reste possible, et l'écran dit quoi
  // corriger.
  if (!cfgBase.ok && !substitue) {
    const raison = cfgBase.raisons[0] || 'aucune répartition des chaînes possible';
    return {
      actif: true, panneaux, batterie, verification: 'incoherent',
      onduleur: { statut: 'non-verifie', ancien, nouveau: null, quantite: 1, raisons: [raison] },
      chaines: null, lignes: lignesMo, mainOeuvre,
      incoherence: { onduleur: ancien.designation, panneaux: base, raison },
      diagnostic: [{ modele: ancien.designation, quantite: 1, raisons: [`kit de base (${base} panneaux) : ${raison}`] }],
      alertes: [`Les caractéristiques saisies pour ${ancien.designation} ne permettent pas le kit de base (${base} panneaux) : ${raison}. Vérifiez nombre de MPPT, chaînes par MPPT et tension DC max dans Plus › Onduleurs.`],
    };
  }
  // Onduleur substitué sur lequel le kit de base ne tient pas (ou onduleur
  // d'origine sans caractéristiques) : une chaîne, une entrée de référence.
  const chainesBase = cfgBase.ok ? cfgBase.chaines.length : 1;
  const mpptBase = cfgBase.ok ? cfgBase.mppt.length : 1;

  // Escalade (règle du gérant) : tant que l'onduleur du kit prend les
  // panneaux, on le GARDE. Sinon, le même en parallèle (×2, ×3… jusqu'au
  // maximum réglé) ; un autre modèle du catalogue seulement après — seul
  // d'abord, du plus petit au plus grand, puis en parallèle. À chaque étape,
  // chaînes ÉQUILIBRÉES d'abord, sinon chaînes inégales chacune sur sa
  // propre entrée MPPT : garder l'onduleur du kit prime sur l'égalité des
  // chaînes.
  const autres = [...candidats]
    .filter((o) => o !== onduleurKit && o.id !== onduleurKit.id)
    .sort((a, b) => outils.puissanceSortie(a) - outils.puissanceSortie(b));
  const escalade = ordreEscalade(onduleurKit, autres);
  const contexte = { panneaux: final, panneau, wc, outils, site };
  const evalKit = evaluer({ ...contexte, modele: onduleurKit, quantite: 1, equilibreSeulement: true });
  let retenu = null;
  // Chaque étape essayée, et pourquoi elle a échoué (la raison de l'essai le
  // plus permissif, chaînes inégales admises) : l'écran l'affiche sous
  // « Pourquoi ? ».
  const diagnostic = [];
  // Panneaux en plus admis pour équilibrer les chaînes (voir
  // PANNEAUX_EQUILIBRAGE_MAX) : à chaque étape, le nombre exact d'abord.
  const marge = Math.max(0, Math.floor(Number(equilibrageMax) || 0));
  for (const { modele, quantite } of escalade) {
    let echec = null;
    for (let k = 0; k <= marge && !retenu; k += 1) {
      for (const equilibreSeulement of [true, false]) {
        const r = evaluer({ ...contexte, panneaux: final + k, modele, quantite, equilibreSeulement });
        if (r.ok) { retenu = { modele, quantite, ...r, enPlus: k, echecExact: echec }; break; }
        if (k === 0) echec = r;
      }
    }
    diagnostic.push({
      id: modele.id ?? null, modele: nomOnduleur(modele), quantite, max: maxEnParallele(modele),
      retenu: !!retenu, raisons: retenu ? [] : (echec?.raisons || []).slice(0, 1),
    });
    if (retenu) break;
  }

  // Retenu au prix de quelques panneaux en plus : le calcul est refait sur
  // ce nombre (chaînes, matériel, main-d'œuvre), et l'écran dit pourquoi.
  if (retenu?.enPlus > 0) {
    return ajusterKit({
      kit, lignesKit, panneauxDemandes, panneauxRetenus: final + retenu.enPlus, onduleurKit, onduleurOrigine, candidats,
      batterieFinale, outils, products, tarifs, site, equilibrageMax: 0,
      equilibrage: {
        demandes: final, poses: final + retenu.enPlus, onduleur: nomOnduleur(retenu.modele),
        quantite: retenu.quantite,
        // Ce qui l'impose, en clair : entrées, chaînes par entrée, longueur max.
        raison: `${retenu.elec.nbMppt} entrée${retenu.elec.nbMppt > 1 ? 's' : ''} MPPT`
          + `${retenu.elec.chainesParMppt > 1 ? ` de ${retenu.elec.chainesParMppt} chaînes de même longueur` : ''}`
          + `, ${retenu.configs[0].nMax} panneaux au plus par chaîne`,
      },
    });
  }

  if (!retenu) {
    return {
      actif: true, panneaux, batterie, verification: 'impossible',
      onduleur: { statut: 'impossible', ancien, nouveau: null, quantite: 1, raisons: evalKit.raisons },
      chaines: { base: cfgBase.ok ? cfgBase : null, final: [], libelle: '—' },
      lignes: lignesMo, mainOeuvre, diagnostic,
      alertes: [`Configuration impossible : aucun onduleur du catalogue, même en parallèle, n'accepte ${final} panneaux de ${wc} Wc dans ses limites électriques.`],
    };
  }

  const conserve = retenu.modele === onduleurKit && retenu.quantite === 1;
  const statut = conserve ? 'conserve' : retenu.modele === onduleurKit ? 'double' : 'remplace';
  const configs = retenu.configs;
  const chainesFinal = configs.reduce((s, c) => s + c.chaines.length, 0);
  const mpptFinal = configs.reduce((s, c) => s + c.mppt.length, 0);
  const chainesAjoutees = Math.max(0, chainesFinal - chainesBase);
  const mpptAjoutes = Math.max(0, mpptFinal - mpptBase);

  // ---- Matériel ajouté ----
  const lignes = [];
  const ajouter = (regle, quantite, motif) => {
    if (quantite <= 0) return;
    const t = tarifer(regle, lignesKit, products);
    lignes.push({
      designation: `${t.designation} — extension`, qty: quantite, unit: regle.unit || 'pcs', pu: t.pu,
      productId: t.productId || null, cout: t.cout != null ? t.cout * quantite : null, source: t.source,
      ajustement: 'materiel', motif,
    });
  };
  const motifChaines = `${chainesAjoutees} chaîne${chainesAjoutees > 1 ? 's' : ''} ajoutée${chainesAjoutees > 1 ? 's' : ''}`;
  // Coffret DC du kit : son nombre d'entrées, et s'il porte déjà les fusibles.
  const coffret = lignesKit.find((l) => COFFRET_JONCTION.re.test(l.designation || ''));
  const entrees = Number(/(\d+)\s*entr/i.exec(coffret?.designation || '')?.[1]) || COFFRET_JONCTION.entreesParDefaut;
  const auDelaDuCoffret = (chaines) => Math.max(0, chaines - entrees);
  const fusiblesDansCoffret = !!coffret && COFFRET_JONCTION.fusiblesIntegres.test(coffret.designation);
  for (const regle of MATERIEL_PAR_CHAINE) {
    if (regle.cle === 'cable-pv') {
      const requise = sectionCablePv(panneau);
      const duKit = lignesKit.find((l) => equivalent(regle, l.designation));
      // La section du kit est gardée si elle suffit (jamais réduite) ;
      // sinon, câble à la section calculée.
      const regleCable = duKit && sectionDe(duKit.designation) >= requise.section
        ? { re: regle.re, exclure: regle.exclure }
        : { re: null, designation: `Câble PV 1x${requise.section}mm²`, prixDefaut: requise.prixDefaut };
      // Câble jumelé (« 2x10mm² ») : un seul câble fait l'aller et le retour.
      const jumele = regleCable.re && /\b2\s*[x×*]/i.test(duKit?.designation || '');
      ajouter({ ...regleCable, unit: regle.unit }, (regle.quantite / (jumele ? 2 : 1)) * chainesAjoutees, motifChaines);
    } else if (regle.cle === 'fusible' && fusiblesDansCoffret) {
      // Le coffret DC du kit porte déjà les fusibles de ses entrées : seules
      // les chaînes AU-DELÀ en reçoivent, moins celles du kit de base déjà
      // au-delà (comptées dans le kit tel qu'il est vendu).
      const sansFusible = Math.max(0, auDelaDuCoffret(chainesFinal) - auDelaDuCoffret(chainesBase));
      ajouter(regle, regle.quantite * sansFusible,
        `${sansFusible} chaîne${sansFusible > 1 ? 's' : ''} au-delà des ${entrees} entrées du coffret DC`);
    } else {
      ajouter(regle, regle.quantite * chainesAjoutees, motifChaines);
    }
  }
  const motifMppt = `${mpptAjoutes} entrée${mpptAjoutes > 1 ? 's' : ''} MPPT ajoutée${mpptAjoutes > 1 ? 's' : ''}`;
  for (const regle of MATERIEL_PAR_MPPT) ajouter(regle, regle.quantite * mpptAjoutes, motifMppt);

  // Coffrets de jonction : seulement si le coffret DC du kit est dépassé,
  // un par tranche de `entreesParCoffret` chaînes en trop.
  if (chainesFinal > entrees && chainesAjoutees > 0) {
    const nbCoffrets = Math.ceil(auDelaDuCoffret(chainesFinal) / COFFRET_JONCTION.entreesParCoffret);
    ajouter({ ...COFFRET_JONCTION, re: null }, nbCoffrets, `${chainesFinal} chaînes pour un coffret de ${entrees} entrées`);
  }

  // Protections AC : une par onduleur remplacé ou ajouté, au calibre du modèle.
  const nbAc = statut === 'remplace' ? retenu.quantite : statut === 'double' ? retenu.quantite - 1 : 0;
  if (nbAc > 0) {
    const phasesRetenu = retenu.elec.phases;
    const cal = protectionAc(retenu.modele, phasesRetenu);
    ajouter(
      { re: null, designation: `Disjoncteur AC ${cal.a} A${phasesRetenu === 3 ? ' tétrapolaire' : ''}`, prixDefaut: cal.prix, unit: 'pcs' },
      nbAc,
      `sortie de l'onduleur ${retenu.modele.capacity} kVA`,
    );
  }

  // Raison technique du remplacement, en clair.
  const raisons = statut === 'conserve' ? [] : evalKit.raisons;
  const alertes = configs.flatMap((c) => c.alertes);
  if (equilibrage) {
    const n = equilibrage.poses - equilibrage.demandes;
    alertes.unshift(`${n} panneau${n > 1 ? 'x' : ''} ajouté${n > 1 ? 's' : ''} pour câbler les chaînes : ${equilibrage.demandes} panneaux ne se répartissent pas sur ${equilibrage.quantite > 1 ? `${equilibrage.quantite} × ` : ''}${equilibrage.onduleur} (${equilibrage.raison}) ; ${equilibrage.poses} oui.`);
  }
  if (!configs.every((c) => c.equilibre)) {
    alertes.push('Chaînes de longueurs différentes, chacune sur sa propre entrée MPPT : aucun découpage en chaînes égales ne tient sans multiplier les chaînes.');
  }

  return {
    actif: true, panneaux, batterie, verification: 'verifie',
    onduleur: {
      statut, ancien, raisons,
      nouveau: statut === 'conserve' ? null : {
        id: retenu.modele.id, brand: retenu.modele.brand, model: retenu.modele.model,
        capacity: retenu.modele.capacity, price: retenu.modele.price,
      },
      quantite: retenu.quantite,
    },
    chaines: {
      base: cfgBase.ok ? { chaines: cfgBase.chaines, mppt: cfgBase.mppt, libelle: libelleChaines(cfgBase.chaines) } : null,
      final: configs.map((c, i) => ({ panneaux: retenu.parts[i], chaines: c.chaines, mppt: c.mppt, libelle: libelleChaines(c.chaines), vocChaine: Math.round(c.vocChaine) })),
      libelle: configs.map((c) => libelleChaines(c.chaines)).join(' / '),
      ajoutees: chainesAjoutees,
      mpptAjoutes,
    },
    lignes: [...lignes, ...lignesMo],
    mainOeuvre,
    diagnostic,
    equilibrage,
    alertes,
  };
};
