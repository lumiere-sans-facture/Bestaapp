// Données de la fiche de dimensionnement — logique pure.
//
// La fiche se produisait seulement DANS l'assistant, à partir de son état du
// moment. Elle doit aussi se produire depuis la liste des devis, des jours
// plus tard : l'étude rangée sur le devis (utils/dimensionnement.js) y suffit,
// les résultats se recalculent. Un seul assemblage pour les deux chemins :
// une fiche ne peut pas dire autre chose selon l'endroit d'où on l'a demandée.
import { calculateSystemSize, DEFAULT_PEAK_SUN_HOURS } from '../solarSizing';
import { factureVersConsommation } from '../factureConso';
import { restaurerDimensionnement, dimensionnementRejouable } from '../dimensionnement';
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
 * Données de la fiche (contrat de buildSizingSheetHtml / construireFichePdf).
 * Seules les grandeurs techniques du calcul sont transmises : les marques du
 * catalogue interne (onduleur, batteries) n'apparaissent jamais.
 */
export function donneesFiche({
  lead = null, apporteur = null, rows = [], consoMode = 'appareils', consumption, systemType,
  sunHours, location = null, solarSource = null, sizing, investissement = null, provisionOnduleur = null,
}) {
  return {
    client: { name: lead?.contact || lead?.name || '', phone: lead?.phone || '', ville: lead?.address || '' },
    apporteur: apporteur ? { name: apporteur.name, code: apporteur.code } : null,
    appliances: rows,
    manualMode: consoMode !== 'appareils', // la fiche technique n'a pas de liste d'appareils
    consumption,
    systemType,
    sunHours,
    cityName: location?.name || lead?.address || null,
    cityCountry: location?.country || '',
    solarSource,
    sizing,
    inverter: { capacity: sizing.inverter.capacity, maxPvPower: sizing.inverter.maxPvPower || null, quantite: sizing.inverterQuantite },
    batteries: sizing.batteries.map((b) => ({ capacity: b.capacity, qty: b.quantity })),
    panelName: `Panneau photovoltaïque ${sizing.panelWc}W`,
    // Rentabilité (page 3) : l'investissement estimé = total du devis.
    investissement: investissement || null,
    // ... et la provision de remplacement = le prix de L'ONDULEUR DE CE
    // DEVIS. Sans elle, toutes les fiches provisionnaient les mêmes
    // 320 000 F, qu'on ait posé un 3 kVA ou un 12 kVA.
    rentabilite: provisionOnduleur != null ? { provisionOnduleur } : {},
  };
}

/**
 * Fiche d'un devis solaire ENREGISTRÉ, reconstituée depuis l'étude qu'il
 * porte. null si le devis n'a pas d'étude (devis manuel, ancien devis) ou si
 * elle ne donne aucune consommation.
 * @param {object} devis
 * @param {{lead?: object, partner?: object, inverters?: Array}} contexte
 */
export function donneesFicheDepuisDevis(devis, { lead = null, partner = null, inverters = [] } = {}) {
  if (!dimensionnementRejouable(devis)) return null;
  const etude = restaurerDimensionnement(devis);
  const rows = etude.appareils || [];
  // La consommation retenue au devis prime : c'est elle que le client a lue.
  const stockee = devis.consumption;
  const consumption = stockee && (Number(stockee.day) || Number(stockee.night))
    ? { day: Number(stockee.day) || 0, night: Number(stockee.night) || 0 }
    : consommationEtude({ consoMode: etude.consoMode, rows, manual: etude.manuel, facture: etude.facture });
  if (consumption.day + consumption.night <= 0) return null;
  const sunHours = Number(etude.sunHours) || DEFAULT_PEAK_SUN_HOURS;
  const sizing = calculateSystemSize(consumption, etude.systemType, sunHours, undefined, etude.autonomyNights, {
    peakLoad: picDeCharge(rows), inverters,
  });
  const code = devis.partnerCode || partner?.code;
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
    provisionOnduleur: provisionOnduleurDuDevis(devis.quotation?.components),
  });
}
