// Mémoire du dimensionnement solaire — logique pure.
//
// Le devis gardait le RÉSULTAT (panneaux, onduleur, batteries) mais pas ce
// qui l'avait produit : la liste des appareils, les heures d'usage, le mode de
// saisie, l'ensoleillement retenu. Revenir sur une étude était donc impossible
// — il fallait tout ressaisir de mémoire pour changer un seul climatiseur, et
// le devis d'origine ne pouvait plus être expliqué au client.
//
// Ce module fait la navette entre l'état de l'assistant et un objet rangé sur
// le devis. Il est pur : aucun React, aucun accès au stockage. Sa vraie valeur
// est la RESTAURATION — elle doit rendre un état complet même à partir d'un
// devis ancien, incomplet ou abîmé, sinon l'écran plante à l'ouverture.

import {
  DEFAULT_PEAK_SUN_HOURS, DEFAULT_AUTONOMY_NIGHTS, DEFAULT_MOUNTING_TYPE, SYSTEM_TYPES, MOUNTING_TYPES,
} from './solarSizing';
import { PRIX_KWH_RESEAU, DEFAULT_REPARTITION, REPARTITIONS } from './factureConso';

/**
 * Version du format. Elle n'est pas décorative : le jour où un champ change de
 * sens, c'est elle qui permettra de convertir sans mal interpréter l'ancien.
 */
export const VERSION_DIMENSIONNEMENT = 1;

const MODES_CONSO = ['appareils', 'manuel', 'facture'];

const nombre = (v, defaut) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : defaut);
const parmi = (v, valeurs, defaut) => (valeurs.includes(v) ? v : defaut);

/**
 * Un appareil, nettoyé : jamais de champ inattendu recopié dans le devis.
 *
 * `rowId` est conservé, et ce n'est pas un détail : c'est LUI que l'assistant
 * utilise pour modifier ou retirer une ligne. Sans lui, une étude rouverte
 * s'affiche mais ne se modifie plus — les lignes deviennent inertes.
 */
const appareilPropre = (a, index = 0) => ({
  rowId: Number(a?.rowId) > 0 ? Number(a.rowId) : index + 1,
  id: a?.id ?? null,
  name: String(a?.name ?? ''),
  power: Number(a?.power) || 0,
  quantity: Number(a?.quantity) || 1,
  day: Number(a?.day) || 0,
  night: Number(a?.night) || 0,
});

/**
 * Premier identifiant de ligne libre. L'assistant doit y caler son compteur à
 * la réouverture : sans cela, un appareil ajouté après coup reprendrait le
 * `rowId` d'une ligne existante et les deux se modifieraient ensemble.
 */
export const prochainRowId = (appareils = []) =>
  appareils.reduce((max, a) => Math.max(max, Number(a?.rowId) || 0), 0) + 1;

/**
 * Photographie de l'étude, telle qu'elle sera rangée sur le devis.
 * Seules les SAISIES sont conservées : les résultats se recalculent, et deux
 * copies d'un même calcul finissent toujours par diverger.
 */
export function capturerDimensionnement(etat = {}) {
  return {
    version: VERSION_DIMENSIONNEMENT,
    consoMode: parmi(etat.consoMode, MODES_CONSO, 'appareils'),
    appareils: Array.isArray(etat.rows) ? etat.rows.map((a, i) => appareilPropre(a, i)) : [],
    manuel: {
      day: String(etat.manual?.day ?? ''),
      night: String(etat.manual?.night ?? ''),
    },
    facture: {
      montant: String(etat.facture?.montant ?? ''),
      prixKwh: nombre(etat.facture?.prixKwh, PRIX_KWH_RESEAU),
      repartition: parmi(etat.facture?.repartition, REPARTITIONS.map((r) => r.id), DEFAULT_REPARTITION),
    },
    systemType: parmi(etat.systemType, SYSTEM_TYPES.map((t) => t.id), 'off-grid'),
    autonomyNights: nombre(etat.autonomyNights, DEFAULT_AUTONOMY_NIGHTS),
    mountingType: parmi(etat.mountingType, MOUNTING_TYPES.map((m) => m.id), DEFAULT_MOUNTING_TYPE),
    includeMounting: etat.includeMounting !== false,
    sunHours: nombre(etat.sunHours, DEFAULT_PEAK_SUN_HOURS),
    // La localisation sert à réafficher d'où vient l'ensoleillement, sans
    // relancer un appel réseau à la réouverture : l'étude doit se rouvrir
    // hors ligne, comme tout le reste de l'application.
    location: etat.location ? { name: String(etat.location.name || ''), lat: etat.location.lat ?? null, lon: etat.location.lon ?? null } : null,
    solarSource: etat.solar?.source ? String(etat.solar.source) : null,
  };
}

/**
 * État de l'assistant reconstitué depuis un devis.
 *
 * Tolérant par construction : un devis d'avant cette fonctionnalité, ou dont
 * le champ a été tronqué par une synchronisation, rend un état par défaut
 * utilisable plutôt qu'un écran vide.
 */
export function restaurerDimensionnement(devis) {
  const d = devis?.dimensionnement;
  const base = capturerDimensionnement({});
  if (!d || typeof d !== 'object') return { ...base, restaure: false };
  return {
    ...capturerDimensionnement({
      consoMode: d.consoMode,
      rows: d.appareils,
      manual: d.manuel,
      facture: d.facture,
      systemType: d.systemType,
      autonomyNights: d.autonomyNights,
      mountingType: d.mountingType,
      includeMounting: d.includeMounting,
      sunHours: d.sunHours,
      location: d.location,
      solar: d.solarSource ? { source: d.solarSource } : null,
    }),
    restaure: true,
  };
}

/** Une étude est-elle rejouable depuis ce devis ? */
export const dimensionnementRejouable = (devis) =>
  devis?.type === 'solar' && !!devis?.dimensionnement && typeof devis.dimensionnement === 'object';

/**
 * Résumé d'une étude en une ligne, pour l'écran des devis.
 * @returns {string} ex. « 4 appareils · 17,6 kWh/j · autonome »
 */
export function resumeDimensionnement(devis) {
  if (!dimensionnementRejouable(devis)) return '';
  const d = devis.dimensionnement;
  const conso = Number(devis.consumption?.day || 0) + Number(devis.consumption?.night || 0);
  const parties = [];
  if (d.consoMode === 'appareils') {
    const n = d.appareils?.length || 0;
    parties.push(`${n} appareil${n > 1 ? 's' : ''}`);
  } else {
    parties.push(d.consoMode === 'facture' ? 'depuis la facture' : 'saisie directe');
  }
  if (conso > 0) parties.push(`${conso.toFixed(1).replace('.', ',')} kWh/j`);
  const type = SYSTEM_TYPES.find((t) => t.id === d.systemType);
  if (type) parties.push(type.label.toLowerCase());
  return parties.join(' · ');
}
