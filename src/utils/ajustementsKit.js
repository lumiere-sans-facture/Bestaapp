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
  MATERIEL_PAR_CHAINE, MATERIEL_PAR_MPPT, COFFRET_JONCTION, PROTECTION_AC,
} from '../config/extensionKit';
import { specPanneau, lireElectrique, configurerChaines, libelleChaines } from './chainesPv';
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
  const nombre = Math.max(0, Math.floor(Number(panneauxAjoutes) || 0));
  const kwh = Math.max(0, Number(kwhAjoutes) || 0);
  const montantPanneaux = nombre * tarifs.parPanneau;
  const montantBatterie = Math.round(kwh * tarifs.parKwhBatterie);
  return {
    base: Math.round(Number(base) || 0),
    panneaux: { nombre, tarif: tarifs.parPanneau, montant: montantPanneaux },
    batterie: { kwh, tarif: tarifs.parKwhBatterie, montant: montantBatterie },
    total: Math.round(Number(base) || 0) + montantPanneaux + montantBatterie,
  };
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
 * Prix et désignation d'un élément à ajouter : la ligne équivalente du kit
 * fait foi (même fournisseur, même tarif) ; à défaut un produit boutique au
 * prix public (règle de marge : utils/price.js) ; sinon le prix par défaut.
 */
const tarifer = ({ re, designation, prixDefaut }, lignesKit, products) => {
  const duKit = re && lignesKit.find((l) => re.test(l.designation || ''));
  if (duKit) return { designation: duKit.designation, pu: resolveLignePrice(duKit, products), source: 'kit' };
  const produit = re && (products || []).find((p) => re.test(p.name || ''));
  if (produit) {
    return {
      designation: produit.name, pu: prixPublic(produit.basePrice), productId: produit.id,
      cout: Number(produit.basePrice) || 0, source: 'boutique',
    };
  }
  return { designation, pu: prixDefaut, source: 'règle' };
};

/**
 * Évalue `quantite` exemplaires d'un onduleur pour `panneaux` panneaux :
 * pic de consommation, puissance PV par appareil, chaînes de chacun.
 */
const evaluer = ({ modele, quantite, panneaux, panneau, wc, equilibreSeulement, outils, site }) => {
  const elec = lireElectrique(modele);
  const raisons = [];
  if (!elec) return { ok: false, raisons: ['caractéristiques électriques non renseignées'] };
  if (quantite > maxEnParallele(modele)) return { ok: false, raisons: ['mise en parallèle non autorisée'] };
  const pic = outils.controlePic(modele, quantite);
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
 * Ajustements d'un kit pour une proposition.
 *
 * @param {object} p
 * @param {object} p.kit               kit de base (jamais modifié)
 * @param {Array}  p.lignesKit         lignes du kit (batterie étendue comprise)
 * @param {number} p.panneauxDemandes  panneaux exigés par la proposition
 * @param {object|null} p.onduleurKit  spec configurée de l'onduleur du kit
 * @param {Array}  p.candidats         onduleurs de même tension batterie
 * @param {object} p.outils            { controlePic(modele, q) → {ok, raison},
 *   limitePv(modele) → Wc, puissanceSortie(modele) → W }
 * @param {Array}  p.products          catalogue boutique (prix des ajouts)
 * @returns {object} synthèse des ajustements (voir le retour ci-dessous)
 */
export const ajusterKit = ({
  kit, lignesKit = kit?.lines || [], panneauxDemandes = 0, onduleurKit = null, candidats = [],
  batterieFinale = null,
  outils, products = [], tarifs = MAIN_OEUVRE_EXTENSION, site = CONDITIONS_SITE,
}) => {
  // Batterie : capacité du kit et capacité posée (modules ajoutés compris,
  // voir utils/extensionBatterie.js).
  const kwhBase = Number(kit?.battery) || 0;
  const kwhFinal = Math.max(kwhBase, Number(batterieFinale) || kwhBase);
  const batterie = { base: kwhBase, finale: kwhFinal, ajoutes: kwhFinal - kwhBase };
  const base = Number(kit?.panels) || 0;
  const wc = Number(kit?.panelW) || 0;
  const demande = Math.max(0, Math.ceil(Number(panneauxDemandes) || 0));
  const final = Math.max(base, demande);
  const ajoutes = final - base;
  const cas = demande < base ? 'inferieur' : demande === base ? 'egal' : 'superieur';
  const panneaux = {
    base, demande, final, ajoutes, wc, cas,
    kwcBase: kwc(base, wc), kwcFinal: kwc(final, wc), kwcAjoutes: kwc(ajoutes, wc),
  };
  if (ajoutes === 0 && batterie.ajoutes === 0) {
    return { actif: false, panneaux, batterie, verification: null, onduleur: null, chaines: null, lignes: [], mainOeuvre: null, alertes: [] };
  }

  const baseMo = lignesKit.filter((l) => l.labor).reduce((s, l) => s + (Number(l.qty) || 0) * resolveLignePrice(l, products), 0);
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

  // Batterie seule étendue, aucun panneau ajouté : chaînes et onduleur ne
  // bougent pas — seule la main-d'œuvre suit.
  if (ajoutes === 0) {
    return { actif: true, panneaux, batterie, verification: null, onduleur: null, chaines: null, lignes: lignesMo, mainOeuvre, alertes: [] };
  }

  const panneau = specPanneau(wc);
  const elecKit = lireElectrique(onduleurKit);
  const ancien = onduleurKit
    ? { id: onduleurKit.id, designation: [onduleurKit.brand, onduleurKit.model].filter(Boolean).join(' '), capacity: onduleurKit.capacity }
    : { id: null, designation: `Onduleur du kit (${kit.inverter} kVA)`, capacity: kit.inverter };

  // Sans caractéristiques électriques (panneau ou onduleur du kit), les
  // chaînes ne peuvent pas être calculées : on le DIT, sans rien supposer.
  if (!panneau || !onduleurKit || !elecKit) {
    const manque = !panneau
      ? `panneau de ${wc} Wc absent des références électriques`
      : 'caractéristiques électriques de l’onduleur du kit non renseignées (Plus › Onduleurs)';
    return {
      actif: true, panneaux, batterie, verification: 'non-verifie',
      onduleur: { statut: 'non-verifie', ancien, nouveau: null, quantite: 1, raisons: [manque] },
      chaines: null, lignes: lignesMo, mainOeuvre,
      alertes: [`Chaînes non vérifiées : ${manque}. Câbles et protections des chaînes ajoutées à prévoir sur place.`],
    };
  }

  // Chaînes du kit de base, sur son propre onduleur.
  const cfgBase = configurerChaines(base, panneau, elecKit, { site });
  const chainesBase = cfgBase.ok ? cfgBase.chaines.length : 1;
  const mpptBase = cfgBase.ok ? cfgBase.mppt.length : 1;

  // Escalade (règle du gérant) : chaînes ÉQUILIBRÉES d'abord — l'onduleur du
  // kit, puis un autre du catalogue, puis le même doublé (parallèle) ; en
  // dernier recours seulement, des chaînes inégales sur entrées distinctes.
  const autres = [...candidats]
    .filter((o) => o !== onduleurKit && o.id !== onduleurKit.id)
    .sort((a, b) => outils.puissanceSortie(a) - outils.puissanceSortie(b));
  const modeles = [onduleurKit, ...autres];
  const plafond = Math.max(1, ...modeles.map(maxEnParallele));
  const contexte = { panneaux: final, panneau, wc, outils, site };
  const evalKit = evaluer({ ...contexte, modele: onduleurKit, quantite: 1, equilibreSeulement: true });
  let retenu = null;
  for (const equilibreSeulement of [true, false]) {
    for (let quantite = 1; quantite <= plafond && !retenu; quantite += 1) {
      for (const modele of modeles) {
        const r = evaluer({ ...contexte, modele, quantite, equilibreSeulement });
        if (r.ok) { retenu = { modele, quantite, ...r }; break; }
      }
    }
    if (retenu) break;
  }

  if (!retenu) {
    return {
      actif: true, panneaux, batterie, verification: 'impossible',
      onduleur: { statut: 'impossible', ancien, nouveau: null, quantite: 1, raisons: evalKit.raisons },
      chaines: { base: cfgBase.ok ? cfgBase : null, final: [], libelle: '—' },
      lignes: lignesMo, mainOeuvre,
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
  for (const regle of MATERIEL_PAR_CHAINE) {
    if (regle.cle === 'cable-pv') {
      const requise = sectionCablePv(panneau);
      const duKit = lignesKit.find((l) => regle.re.test(l.designation || ''));
      // La section du kit est gardée si elle suffit (jamais réduite) ;
      // sinon, câble à la section calculée.
      const regleCable = duKit && sectionDe(duKit.designation) >= requise.section
        ? { re: regle.re }
        : { re: null, designation: `Câble PV 1x${requise.section}mm²`, prixDefaut: requise.prixDefaut };
      // Câble jumelé (« 2x10mm² ») : un seul câble fait l'aller et le retour.
      const jumele = regleCable.re && /\b2\s*[x×*]/i.test(duKit?.designation || '');
      ajouter({ ...regleCable, unit: regle.unit }, (regle.quantite / (jumele ? 2 : 1)) * chainesAjoutees, motifChaines);
    } else {
      ajouter(regle, regle.quantite * chainesAjoutees, motifChaines);
    }
  }
  const motifMppt = `${mpptAjoutes} entrée${mpptAjoutes > 1 ? 's' : ''} MPPT ajoutée${mpptAjoutes > 1 ? 's' : ''}`;
  for (const regle of MATERIEL_PAR_MPPT) ajouter(regle, regle.quantite * mpptAjoutes, motifMppt);

  // Coffret de jonction : seulement si le coffret DC du kit est dépassé.
  const coffret = lignesKit.find((l) => COFFRET_JONCTION.re.test(l.designation || ''));
  const entrees = Number(/(\d+)\s*entr/i.exec(coffret?.designation || '')?.[1]) || COFFRET_JONCTION.entreesParDefaut;
  if (chainesFinal > entrees && chainesAjoutees > 0) {
    ajouter({ ...COFFRET_JONCTION, re: null }, 1, `${chainesFinal} chaînes pour un coffret de ${entrees} entrées`);
  }

  // Protections AC : une par onduleur remplacé ou ajouté, au calibre du modèle.
  const nbAc = statut === 'remplace' ? retenu.quantite : statut === 'double' ? retenu.quantite - 1 : 0;
  if (nbAc > 0) {
    const cal = protectionAc(retenu.modele, retenu.elec.phases);
    ajouter(
      { re: null, designation: `Disjoncteur AC ${cal.a} A${retenu.elec.phases === 3 ? ' tétrapolaire' : ''}`, prixDefaut: cal.prix, unit: 'pcs' },
      nbAc,
      `sortie de l'onduleur ${retenu.modele.capacity} kVA`,
    );
  }

  // Raison technique du remplacement, en clair.
  const raisons = statut === 'conserve' ? [] : evalKit.raisons;
  const alertes = configs.flatMap((c) => c.alertes);
  if (!configs.every((c) => c.equilibre)) {
    alertes.push('Chaînes de longueurs différentes, chacune sur sa propre entrée MPPT : aucune configuration équilibrée possible.');
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
    alertes,
  };
};
