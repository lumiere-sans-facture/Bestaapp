// Kits solaires : logique pure de saisie et de validation.
// Les kits ne sont plus figés dans le code — ils vivent dans l'état, se
// modifient depuis « Mes kits » et se répliquent comme le reste. Ce module
// porte tout ce qui se teste sans React : normalisation d'un brouillon de
// formulaire, total, contrôle de validité.
import { prixPublic } from './price';

export const UNITES_KIT = ['pcs', 'm', 'ml', 'kg', 'forfait'];

/** Une ligne vierge de composition (matériel par défaut, pas prestation). */
export const nouvelleLigneKit = () => ({ designation: '', qty: 1, unit: 'pcs', pu: 0, labor: false, productId: null });

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
      // Produit boutique lié (optionnel) : quand présent, son prix public
      // PRIME sur `pu` (voir resolveLignePrice) — `pu` reste un repli si le
      // produit est supprimé du catalogue entre-temps.
      productId: l.productId || null,
    })),
});

/**
 * Prix d'une ligne de kit : si elle est liée à un produit boutique
 * (productId), son prix PUBLIC ACTUEL prime — la ligne suit alors
 * automatiquement les changements de prix faits depuis la Boutique. Sinon
 * (ligne libre, ou produit supprimé du catalogue), le prix figé `pu` sert.
 */
export const resolveLignePrice = (ligne, products = []) => {
  if (ligne.productId) {
    const produit = products.find((p) => p.id === ligne.productId);
    if (produit) return prixPublic(produit.basePrice);
  }
  return nombre(ligne.pu, 0);
};

/** Prix tout compris du kit (matériel + prestations), sans TVA. */
export const kitTotal = (kit, products = []) =>
  (kit?.lines || []).reduce((somme, l) => somme + nombre(l.qty, 0) * resolveLignePrice(l, products), 0);

/**
 * Un kit est publiable s'il a un nom et au moins une ligne chiffrée : sans
 * cela il apparaîtrait dans l'assistant à 0 F, prêt à partir en devis.
 */
export const kitEstValide = (kit, products = []) => {
  const k = normaliserKit(kit);
  return k.name !== '' && k.lines.length > 0 && kitTotal(k, products) > 0;
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
