// Données de la fiche de dimensionnement — logique pure.
//
// La fiche se produisait seulement DANS l'assistant, à partir de son état du
// moment. Elle doit aussi se produire depuis la liste des devis, des jours
// plus tard : l'étude rangée sur le devis (utils/dimensionnement.js) y suffit,
// les résultats se recalculent. Un seul assemblage pour les deux chemins :
// une fiche ne peut pas dire autre chose selon l'endroit d'où on l'a demandée.
import { calculateSystemSize, DEFAULT_PEAK_SUN_HOURS, PANEL_SPEC, parsePanelWc, designationOnduleur } from '../solarSizing';
import { factureVersConsommation } from '../factureConso';
import { restaurerDimensionnement, dimensionnementRejouable, dimensionnementProRejouable } from '../dimensionnement';
import { provisionOnduleurDuDevis } from './compute';

/** Consommation jour/nuit (kWh) de l'étude, selon son mode de saisie. */
export function consommationEtude({ consoMode, rows = [], manual = {}, facture = {} }) {
  if (consoMode === 'direct') return { day: Number(manual.day) || 0, night: Number(manual.night) || 0 };
  if (consoMode === 'facture') {
    const f = factureVersConsommation(facture.montant, facture.prixKwh, facture.repartition);
    return { day: f.day, night: f.night };
  }
  const day = rows.reduce((s, r) => s + r.power * r.quantity * r.day, 0) / 1000;
  const night = rows.reduce((s, r) => s + r.power * r.quantity * r.night, 0) / 1000;
  return { day: Number(day.toFixed(2)), night: Number(night.toFixed(2)) };
}

/** Pic de charge : tous les appareils branchés en même temps (W). */
export const picDeCharge = (rows = []) => rows.reduce((s, r) => s + r.power * r.quantity, 0);

/**
 * Matériel de la fiche : celui que le CALCUL prescrit (calibre d'onduleur,
 * parc batterie), jamais celui d'un kit. La fiche présente le dimensionnement ;
 * le kit, lui, n'apparaît que sur le devis.
 */
export const materielCalcule = (sizing) => ({
  inverter: sizing.inverter
    ? { capacity: sizing.inverter.capacity, maxPvPower: sizing.inverter.maxPvPower || null, quantite: sizing.inverterQuantite }
    : null,
  batteries: (sizing.batteries || []).map((b) => ({ capacity: b.capacity, qty: b.quantity })),
});

/**
 * Matériel retenu à l'étape Matériel de l'assistant Pro, hors kit : un CHOIX
 * de l'installateur dans son dimensionnement. Rangé sur le devis
 * (`materielFiche`), il permet à la fiche demandée plus tard depuis la liste
 * de dire la même chose que celle de l'assistant. Seules les grandeurs utiles
 * à la fiche sont gardées.
 */
export const materielChoisi = (inverter, batteries = []) => ({
  inverter: inverter
    ? { capacity: Number(inverter.capacity) || 0, maxPvPower: inverter.maxPvPower || null, quantite: Number(inverter.quantite) || 1 }
    : null,
  batteries: (batteries || [])
    .filter((b) => Number(b.qty) > 0)
    .map((b) => ({ capacity: Number(b.capacity) || 0, qty: Number(b.qty) || 0 })),
});

/**
 * Ce avec quoi l'assistant Pro dimensionne : le panneau du catalogue (le
 * nombre de panneaux se calcule sur SA puissance) et les onduleurs de « Mes
 * onduleurs ». L'assistant et la liste des devis passent par ici : sinon la
 * fiche d'un même devis changerait selon l'endroit d'où on la demande.
 */
export function contexteCalculPro({ products = [], onduleurs = [] } = {}) {
  const panneau = (products || []).find((p) => p.category === 'panneaux');
  const panelName = panneau?.name || `Panneau ${PANEL_SPEC.brand} ${PANEL_SPEC.model} ${PANEL_SPEC.power}W ${PANEL_SPEC.type}`;
  return {
    panelName,
    panelWc: parsePanelWc(panelName) || PANEL_SPEC.power,
    inverterOptions: (onduleurs || [])
      .filter((o) => Number(o.capacity) > 0)
      .map((o) => ({ ...o, brand: o.brand || 'Autre', model: designationOnduleur(o), price: Number(o.price) || 0 }))
      .sort((a, b) => a.capacity - b.capacity),
  };
}

/**
 * Paramètres de rentabilité de la fiche Pro (page 3). Les champs saisis dans
 * l'assistant (`renta`, textes ; vide = défaut) priment ; à défaut, le total
 * du devis et le prix de son onduleur.
 * @returns {{investissement: number|null, rentabilite: object}}
 */
export function parametresRentabilite(renta = {}, { investissement = null, provisionOnduleur = null } = {}) {
  const r = renta || {};
  const saisi = (v) => v !== undefined && v !== null && v !== '';
  return {
    investissement: Number(r.investissement) > 0 ? Number(r.investissement) : (investissement || null),
    rentabilite: {
      ...(Number(r.tarifElec) > 0 ? { tarifElec: Number(r.tarifElec) } : {}),
      ...(Number(r.tauxUtilisation) > 0 ? { tauxUtilisation: Number(r.tauxUtilisation) } : {}),
      ...(saisi(r.maintenanceAnnuelle) && Number(r.maintenanceAnnuelle) >= 0 ? { maintenanceAnnuelle: Number(r.maintenanceAnnuelle) } : {}),
      ...(saisi(r.provisionOnduleur) && Number(r.provisionOnduleur) >= 0
        ? { provisionOnduleur: Number(r.provisionOnduleur) }
        : (provisionOnduleur != null ? { provisionOnduleur } : {})),
    },
  };
}

/** Les champs de rentabilité réellement saisis — ce qu'un devis Pro range (`rentaFiche`). */
export const rentaSaisie = (renta = {}) => Object.fromEntries(
  Object.entries(renta || {}).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== ''),
);

/**
 * Données de la fiche (contrat de buildSizingSheetHtml / construireFichePdf).
 * Seules les grandeurs techniques du calcul sont transmises : les marques du
 * catalogue interne (onduleur, batteries) n'apparaissent jamais.
 */
export function donneesFiche({
  lead = null, apporteur = null, rows = [], consoMode = 'appareils', consumption, systemType,
  sunHours, location = null, solarSource = null, sizing, investissement = null, provisionOnduleur = null,
  // Espace Pro : client du carnet, identité de l'abonné, panneau du catalogue,
  // matériel choisi hors kit, rentabilité saisie.
  client = null, company = null, panelName = null, materiel = null, rentabilite = null,
}) {
  return {
    ...(company ? { company } : {}),
    client: client
      ? { name: client.name || '', phone: client.phone || '', ville: client.ville || '' }
      : { name: lead?.contact || lead?.name || '', phone: lead?.phone || '', ville: lead?.address || '' },
    apporteur: apporteur ? { name: apporteur.name, code: apporteur.code } : null,
    appliances: rows,
    manualMode: consoMode !== 'appareils', // la fiche technique n'a pas de liste d'appareils
    consumption,
    systemType,
    sunHours,
    cityName: location?.name || client?.ville || lead?.address || null,
    cityCountry: location?.country || '',
    solarSource,
    sizing,
    // Le matériel du calcul, sauf choix explicite de l'installateur (hors kit).
    ...(materiel || materielCalcule(sizing)),
    panelName: panelName || `Panneau photovoltaïque ${sizing.panelWc}W`,
    // Rentabilité (page 3) : l'investissement estimé = total du devis.
    investissement: investissement || null,
    // ... et la provision de remplacement = le prix de L'ONDULEUR DE CE
    // DEVIS. Sans elle, toutes les fiches provisionnaient les mêmes
    // 320 000 F, qu'on ait posé un 3 kVA ou un 12 kVA.
    rentabilite: rentabilite || (provisionOnduleur != null ? { provisionOnduleur } : {}),
  };
}

/**
 * Fiche d'un devis ENREGISTRÉ — devis solaire public ou devis Pro issu de
 * l'assistant —, reconstituée depuis l'étude qu'il porte. null si le devis
 * n'a pas d'étude (devis manuel, ancien devis) ou si elle ne donne aucune
 * consommation.
 * @param {object} devis
 * @param {{lead?: object, partner?: object, inverters?: Array, products?: Array, company?: object}} contexte
 *   `inverters` : onduleurs configurés ; `products` et `company` : espace Pro.
 */
export function donneesFicheDepuisDevis(devis, { lead = null, partner = null, inverters = [], products = [], company = null } = {}) {
  const pro = devis?.type === 'pro';
  if (!(pro ? dimensionnementProRejouable(devis) : dimensionnementRejouable(devis))) return null;
  const etude = restaurerDimensionnement(devis);
  const rows = etude.appareils || [];
  // La consommation retenue au devis prime : c'est elle que le client a lue.
  const stockee = devis.consumption;
  const consumption = stockee && (Number(stockee.day) || Number(stockee.night))
    ? { day: Number(stockee.day) || 0, night: Number(stockee.night) || 0 }
    : consommationEtude({ consoMode: etude.consoMode, rows, manual: etude.manuel, facture: etude.facture });
  if (consumption.day + consumption.night <= 0) return null;
  const sunHours = Number(etude.sunHours) || DEFAULT_PEAK_SUN_HOURS;
  // Même calcul que l'assistant qui a produit le devis.
  const calculPro = pro ? contexteCalculPro({ products, onduleurs: inverters }) : null;
  const sizing = calculateSystemSize(consumption, etude.systemType, sunHours, calculPro?.panelWc, etude.autonomyNights, calculPro
    ? { peakLoad: picDeCharge(rows), inverters: calculPro.inverterOptions, configures: inverters || [] }
    : { peakLoad: picDeCharge(rows), inverters });
  const code = devis.partnerCode || partner?.code;
  const provisionOnduleur = provisionOnduleurDuDevis(pro ? devis.lignes : devis.quotation?.components);
  return donneesFiche({
    lead,
    apporteur: partner ? { name: partner.name, code } : null,
    rows,
    consoMode: etude.consoMode,
    consumption,
    systemType: etude.systemType,
    sunHours,
    location: etude.location,
    solarSource: etude.solarSource,
    sizing,
    investissement: devis.total,
    provisionOnduleur,
    ...(pro ? {
      client: { name: devis.clientName, phone: devis.clientPhone, ville: devis.clientVille },
      company,
      panelName: calculPro.panelName,
      // Proposition par kit : le matériel du calcul (le kit est sur le devis).
      // Hors kit : celui choisi dans l'assistant ; un devis antérieur à ce
      // rangement retombe sur le calcul.
      materiel: devis.kitId ? null : (devis.materielFiche || null),
      ...parametresRentabilite(devis.rentaFiche, { investissement: devis.total, provisionOnduleur }),
    } : {}),
  });
}
