// Agent devis (prototype) : exécution des OUTILS demandés par Claude.
//
// Les calculs sont ceux de l'assistant de devis — dimensionnement, kits
// suggérés, chiffrage exact (main-d'œuvre, coefficient Togo, ajustements) —
// avec les kits, onduleurs et produits de l'ENTREPRISE, passés par l'écran.
// Rien n'est estimé ici : l'agent ne fait que la conversation.
//
// Logique pure : les données de référence (catalogue d'appareils,
// ensoleillement) sont injectées par l'appelant, comme les kits.
import {
  calculateSystemSize, suggestKitsForBattery, buildKitQuotation, designationOnduleur,
  DEFAULT_PEAK_SUN_HOURS, DEFAULT_AUTONOMY_NIGHTS, MOUNTING_TYPES, DEFAULT_MOUNTING_TYPE, SYSTEM_TYPES,
} from './solarSizing';
import { coefficientMainOeuvre } from './mainOeuvre';

const sansAccents = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const nombre = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const arrondi = (v, d = 2) => Number((Number(v) || 0).toFixed(d));

/** Heures de pic solaire de la ville (référentiel), sinon la valeur prudente par défaut. */
export const ensoleillementDe = (ville, referentiel = []) => {
  const cle = sansAccents(ville);
  const trouve = cle && referentiel.find((e) => sansAccents(e.city) === cle);
  return trouve ? { psh: trouve.psh, source: trouve.city } : { psh: DEFAULT_PEAK_SUN_HOURS, source: null };
};

/** Consommation et pic à partir des appareils (même calcul que l'assistant). */
export const consommationDe = (appareils = [], jourKwh = 0, nuitKwh = 0) => {
  const liste = (appareils || []).map((a) => ({
    nom: String(a.nom || 'Appareil').slice(0, 80),
    power: nombre(a.puissance_w),
    quantity: Math.max(1, Math.round(nombre(a.quantite) || 1)),
    day: Math.min(12, nombre(a.heures_jour)),
    night: Math.min(12, nombre(a.heures_nuit)),
  })).filter((a) => a.power > 0);
  if (liste.length) {
    const day = liste.reduce((s, r) => s + r.power * r.quantity * r.day, 0) / 1000;
    const night = liste.reduce((s, r) => s + r.power * r.quantity * r.night, 0) / 1000;
    const pic = liste.reduce((s, r) => s + r.power * r.quantity, 0);
    return { consumption: { day: arrondi(day), night: arrondi(night) }, peakLoad: pic, lignes: liste };
  }
  return { consumption: { day: nombre(jourKwh), night: nombre(nuitKwh) }, peakLoad: 0, lignes: [] };
};

/**
 * Proposition complète pour une demande (entrée de l'outil calculer_proposition) :
 * besoin dimensionné, kits suggérés et leur devis exact.
 * @returns {{erreur?: string, besoin?: object, options?: Array, demande?: object}}
 */
export const calculerProposition = (entree, ctx) => {
  const { kits = [], inverters = [], products = [], ensoleillement = [] } = ctx || {};
  const { consumption, peakLoad, lignes } = consommationDe(entree?.appareils, entree?.conso_jour_kwh, entree?.conso_nuit_kwh);
  if (consumption.day + consumption.night <= 0) {
    return { erreur: 'Consommation nulle : il faut au moins un appareil avec sa puissance, ou une consommation en kWh.' };
  }
  const systemType = SYSTEM_TYPES.some((t) => t.id === entree?.type_systeme) ? entree.type_systeme : 'off-grid';
  const support = MOUNTING_TYPES.some((m) => m.id === entree?.support) ? entree.support : DEFAULT_MOUNTING_TYPE;
  const soleil = ensoleillementDe(entree?.ville, ensoleillement);
  const sizing = calculateSystemSize(consumption, systemType, soleil.psh, undefined, DEFAULT_AUTONOMY_NIGHTS, { peakLoad, inverters });
  const coef = coefficientMainOeuvre({ ville: entree?.ville || '', telephone: entree?.telephone || '' });
  const suggeres = suggestKitsForBattery(kits, sizing.batteryCapacity);
  const options = suggeres.map((kit) => {
    const q = buildKitQuotation(kit, support, true, sizing, inverters, products, coef);
    const inv = q.inverterSuggested;
    return {
      kit_id: kit.id,
      nom: kit.name,
      total_fcfa: Math.round(q.total),
      batterie_kwh: q.batteryCapacity ?? kit.battery,
      panneaux: q.panelsIncluded,
      panneau_wc: kit.panelW,
      onduleur: inv ? `${inv.quantite > 1 ? `${inv.quantite} × ` : ''}${designationOnduleur(inv)}` : `${kit.inverter} kVA (celui du kit)`,
      configuration_impossible: !!q.configurationImpossible,
      onduleur_insuffisant: !!q.inverterInsuffisant,
      // Pic des appareils au-delà de la sortie de l'onduleur (W), sinon null.
      pic_non_couvert_w: q.picNonCouvert ? q.picNonCouvert.picW : null,
      ajustements: q.ajustements
        ? [
            q.ajustements.panneaux?.ajoutes ? `+${q.ajustements.panneaux.ajoutes} panneaux` : null,
            q.ajustements.panneaux?.retires ? `${q.ajustements.panneaux.retires} panneaux de moins que le kit (ajustés au besoin)` : null,
            q.ajustements.batterie?.ajoutes ? `batterie étendue à ${q.ajustements.batterie.finale} kWh` : null,
            q.ajustements.chaines?.libelle ? `chaînes : ${q.ajustements.chaines.libelle}` : null,
          ].filter(Boolean).join(' · ')
        : 'kit posé tel quel',
    };
  });
  return {
    demande: { ...entree, type_systeme: systemType, support },
    besoin: {
      conso_jour_kwh: consumption.day,
      conso_nuit_kwh: consumption.night,
      pic_w: peakLoad,
      panneaux_calcules: sizing.numberOfPanels,
      puissance_pv_kwc: arrondi(sizing.installedPvPower / 1000),
      batterie_kwh: arrondi(sizing.batteryCapacity, 1),
      ensoleillement_h: soleil.psh,
      ensoleillement_source: soleil.source || 'valeur prudente par défaut (ville hors référentiel)',
      chantier_au_togo: coef > 1,
      appareils: lignes.map((l) => `${l.quantity} × ${l.nom} (${l.power} W)`),
    },
    options,
  };
};

/**
 * Devis complet, prêt à enregistrer, pour le kit choisi : le MÊME objet que
 * l'assistant de devis enregistre (quotation, sizing, consommation).
 */
export const devisDepuisProposition = (demande, kitId, ctx) => {
  const { kits = [], inverters = [], products = [], ensoleillement = [] } = ctx || {};
  const kit = kits.find((k) => k.id === kitId);
  if (!kit) return null;
  const { consumption, peakLoad } = consommationDe(demande?.appareils, demande?.conso_jour_kwh, demande?.conso_nuit_kwh);
  const soleil = ensoleillementDe(demande?.ville, ensoleillement);
  const systemType = demande?.type_systeme || 'off-grid';
  const sizing = calculateSystemSize(consumption, systemType, soleil.psh, undefined, DEFAULT_AUTONOMY_NIGHTS, { peakLoad, inverters });
  const coef = coefficientMainOeuvre({ ville: demande?.ville || '', telephone: demande?.telephone || '' });
  const quotation = buildKitQuotation(kit, demande?.support || DEFAULT_MOUNTING_TYPE, true, sizing, inverters, products, coef);
  const panneaux = quotation.panelsIncluded || kit.panels;
  const inv = quotation.inverterSuggested;
  return {
    type: 'solar',
    consumption,
    sizing: {
      numberOfPanels: panneaux,
      panelCapacity: (panneaux * kit.panelW) / 1000,
      inverter: inv
        ? { model: `Onduleur hybride ${inv.capacity}kVA ${inv.brand} ${inv.model}`, capacity: inv.capacity }
        : { model: `Onduleur hybride ${kit.inverter} kVA`, capacity: kit.inverter },
      batteries: [],
      batteryCapacity: quotation.batteryCapacity ?? kit.battery,
      estimatedProduction: Math.round((panneaux * kit.panelW * soleil.psh * 365) / 1000),
      systemType,
      peakSunHours: soleil.psh,
      city: demande?.ville || null,
      kit: kit.name,
    },
    kit: { id: kit.id, name: kit.name },
    quotation,
    total: quotation.total,
    configurationImpossible: !!quotation.configurationImpossible,
  };
};

/**
 * Exécute un outil demandé par l'agent.
 * @param {string} nom
 * @param {object} entree  arguments fournis par Claude
 * @param {object} ctx     { kits, inverters, products, appareils, ensoleillement, derniereDemande }
 * @returns {{contenu: string, demande?: object, proposition?: object, erreur?: boolean}}
 *   `contenu` est renvoyé à Claude (JSON) ; `demande` et `proposition`
 *   servent à l'écran (dernier calcul, carte « Créer le devis »).
 */
export const executerOutil = (nom, entree, ctx = {}) => {
  const json = (o) => JSON.stringify(o);
  if (nom === 'chercher_appareils') {
    const mots = sansAccents(entree?.requete).split(/\s+/).filter((m) => m.length >= 3);
    const synonymes = { frigo: 'refrigerateur', clim: 'climatiseur', tele: 'television', tv: 'television', ventilo: 'ventilateur' };
    const cles = mots.map((m) => synonymes[m] || m);
    const trouves = (ctx.appareils || [])
      .filter((a) => cles.some((c) => sansAccents(a.name).includes(c)))
      .slice(0, 8)
      .map((a) => ({ nom: a.name, puissance_w: a.power, heures_jour: a.day, heures_nuit: a.night }));
    return { contenu: json(trouves.length ? { appareils: trouves } : { appareils: [], note: 'Aucun appareil correspondant : demander la puissance au client.' }) };
  }
  if (nom === 'calculer_proposition') {
    const r = calculerProposition(entree, ctx);
    if (r.erreur) return { contenu: json({ erreur: r.erreur }), erreur: true };
    if (!r.options.length) {
      return { contenu: json({ besoin: r.besoin, options: [], note: 'Aucun kit configuré : proposer un rappel par un conseiller.' }), demande: r.demande };
    }
    return { contenu: json({ besoin: r.besoin, options: r.options }), demande: r.demande };
  }
  if (nom === 'preparer_devis') {
    const demande = ctx.derniereDemande;
    if (!demande) return { contenu: json({ erreur: 'Appeler d’abord calculer_proposition.' }), erreur: true };
    const nomClient = String(entree?.client_nom || '').trim();
    const tel = String(entree?.client_telephone || '').trim();
    if (!nomClient || tel.replace(/\D/g, '').length < 8) {
      return { contenu: json({ erreur: 'Il faut le nom du client et un numéro de téléphone complet.' }), erreur: true };
    }
    const devis = devisDepuisProposition({ ...demande, telephone: tel || demande.telephone }, entree?.kit_id, ctx);
    if (!devis) return { contenu: json({ erreur: 'Kit inconnu : choisir un kit_id parmi les options calculées.' }), erreur: true };
    if (devis.configurationImpossible) {
      return { contenu: json({ erreur: 'Configuration impossible pour ce kit : proposer un rappel par un conseiller.' }), erreur: true };
    }
    return {
      contenu: json({ ok: true, total_fcfa: Math.round(devis.total), statut: 'en attente de relecture par l’équipe BESTA SOLAR' }),
      proposition: {
        client: { nom: nomClient.slice(0, 120), telephone: tel.slice(0, 30), ville: String(entree?.client_ville || demande.ville || '').slice(0, 80) },
        demande: { ...demande, telephone: tel },
        kitId: entree.kit_id,
        devis,
      },
    };
  }
  return { contenu: json({ erreur: `Outil inconnu : ${String(nom).slice(0, 40)}` }), erreur: true };
};
