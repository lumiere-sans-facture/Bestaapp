// Kits pompage : logique pure de saisie et de validation — même esprit que
// utils/inverters.js. Normalisation d'un brouillon de formulaire, contrôle de
// validité, résumé pour les cartes, rien qui dépende de React.

/** Un kit pompage vierge, prêt pour le formulaire de création. */
export const nouveauPompeKit = () => ({
  id: crypto.randomUUID(),
  name: '', hp: '', powerW: '', maxHmt: '', maxDebit: '',
  panels: '', panelW: 550, price: '', usage: '',
});

const nombre = (v, defaut = 0) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : defaut;
};

/** Transforme un brouillon de formulaire (champs texte) en kit exploitable. */
export const normaliserPompeKit = (brouillon) => ({
  ...brouillon,
  name: (brouillon.name || '').trim(),
  usage: (brouillon.usage || '').trim(),
  hp: nombre(brouillon.hp),
  powerW: Math.round(nombre(brouillon.powerW)),
  maxHmt: nombre(brouillon.maxHmt),
  maxDebit: nombre(brouillon.maxDebit),
  panels: Math.round(nombre(brouillon.panels)),
  panelW: Math.round(nombre(brouillon.panelW)),
  price: Math.round(nombre(brouillon.price)),
});

/**
 * Un kit est publiable s'il a un nom, un prix, une HMT max et un débit max —
 * sans ces deux derniers, l'assistant ne peut JAMAIS le suggérer (aucun
 * moyen de savoir s'il couvre le besoin en eau du client).
 */
export const pompeKitEstValide = (k) => {
  const n = normaliserPompeKit(k);
  return Boolean(n.name) && n.price > 0 && n.maxHmt > 0 && n.maxDebit > 0;
};

/** Résumé technique d'une carte kit : « 1 HP · 60 m HMT · 3 m³/h · 3 × 550 Wc ». */
export const resumePompeKit = (k) =>
  [
    k.hp ? `${String(k.hp).replace('.', ',')} HP` : '',
    k.maxHmt ? `${k.maxHmt} m HMT` : '',
    k.maxDebit ? `${String(k.maxDebit).replace('.', ',')} m³/h` : '',
    k.panels ? `${k.panels} × ${k.panelW || '?'} Wc` : '',
  ].filter(Boolean).join(' · ');

/** Copie d'un kit, identifiant neuf — les devis émis gardent leur référence. */
export const dupliquerPompeKit = (source) => ({
  ...source,
  id: crypto.randomUUID(),
  name: `${source.name} (copie)`,
});
