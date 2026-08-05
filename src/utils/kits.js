// Kits solaires : logique pure de saisie et de validation.
// Les kits ne sont plus figés dans le code — ils vivent dans l'état, se
// modifient depuis « Mes kits » et se répliquent comme le reste. Ce module
// porte tout ce qui se teste sans React : normalisation d'un brouillon de
// formulaire, total, contrôle de validité.

export const UNITES_KIT = ['pcs', 'm', 'ml', 'kg', 'forfait'];

/** Une ligne vierge de composition (matériel par défaut, pas prestation). */
export const nouvelleLigneKit = () => ({ designation: '', qty: 1, unit: 'pcs', pu: 0, labor: false });

/** Un kit vierge, prêt pour le formulaire de création. */
export const nouveauKit = () => ({
  id: crypto.randomUUID(),
  name: '',
  battery: '', panels: '', panelW: '', inverter: '',
  lines: [nouvelleLigneKit()],
});

const nombre = (v, defaut = 0) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : defaut;
};

/**
 * Transforme un brouillon de formulaire (champs texte) en kit exploitable :
 * nombres coercés, lignes vides écartées, quantité au minimum 1. Les champs
 * non gérés par le formulaire (`batteryModules`, servant à la fiche technique)
 * sont conservés tels quels — les perdre appauvrirait le document imprimé.
 */
export const normaliserKit = (brouillon) => ({
  ...brouillon,
  name: (brouillon.name || '').trim(),
  battery: nombre(brouillon.battery),
  panels: Math.round(nombre(brouillon.panels)),
  panelW: Math.round(nombre(brouillon.panelW)),
  inverter: nombre(brouillon.inverter),
  lines: (brouillon.lines || [])
    .filter((l) => (l.designation || '').trim() !== '')
    .map((l) => ({
      designation: l.designation.trim(),
      qty: Math.max(1, Math.round(nombre(l.qty, 1)) || 1),
      unit: UNITES_KIT.includes(l.unit) ? l.unit : 'pcs',
      pu: Math.round(nombre(l.pu)),
      labor: !!l.labor,
    })),
});

/** Prix tout compris du kit (matériel + prestations), sans TVA. */
export const kitTotal = (kit) =>
  (kit?.lines || []).reduce((somme, l) => somme + nombre(l.qty, 0) * nombre(l.pu, 0), 0);

/**
 * Un kit est publiable s'il a un nom et au moins une ligne chiffrée : sans
 * cela il apparaîtrait dans l'assistant à 0 F, prêt à partir en devis.
 */
export const kitEstValide = (kit) => {
  const k = normaliserKit(kit);
  return k.name !== '' && k.lines.length > 0 && kitTotal(k) > 0;
};

/** Libellé technique court, affiché sous le nom dans les listes. */
export const resumeKit = (kit) => [
  kit.battery ? `${kit.battery} kWh` : null,
  kit.panels ? `${kit.panels} × ${kit.panelW || '?'} Wc` : null,
  kit.inverter ? `onduleur ${kit.inverter} kVA` : null,
].filter(Boolean).join(' · ');

/** Copie d'un kit, nouvel identifiant et nom suffixé — base d'une variante. */
export const dupliquerKit = (kit) => ({
  ...kit,
  id: crypto.randomUUID(),
  name: `${kit.name} (copie)`,
  lines: (kit.lines || []).map((l) => ({ ...l })),
});
