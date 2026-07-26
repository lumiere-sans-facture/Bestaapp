// Domaine irradiation : référentiel des sites (productible mensuel PVGIS),
// base du dimensionnement au mois le plus défavorable.
import { siteComplet } from '../../data/irradiation';

const nb = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Normalise une série mensuelle : 12 nombres, ou null si incomplète. */
export const normaliserProductible = (serie) => {
  if (!Array.isArray(serie) || serie.length !== 12) return null;
  const valeurs = serie.map(nb);
  return valeurs.every((v) => v != null && v > 0) ? valeurs : null;
};

export function createIrradiationActions(setState) {
  return {
    addIrradiationSite: (site) =>
      setState((s) => ({
        ...s,
        irradiationSites: [
          ...(s.irradiationSites || []),
          {
            ...site,
            id: crypto.randomUUID(),
            productibleMensuel: normaliserProductible(site.productibleMensuel),
          },
        ],
      })),

    updateIrradiationSite: (siteId, patch) =>
      setState((s) => ({
        ...s,
        irradiationSites: (s.irradiationSites || []).map((site) =>
          site.id === siteId
            ? {
                ...site,
                ...patch,
                ...(patch.productibleMensuel !== undefined
                  ? { productibleMensuel: normaliserProductible(patch.productibleMensuel) }
                  : {}),
              }
            : site
        ),
      })),

    deleteIrradiationSite: (siteId) =>
      setState((s) => ({
        ...s,
        irradiationSites: (s.irradiationSites || []).filter((site) => site.id !== siteId),
      })),

    /** Caractéristiques électriques d'un produit (fiches constructeur). */
    updateProductSpecs: (productId, specs) =>
      setState((s) => ({
        ...s,
        products: s.products.map((p) =>
          p.id === productId ? { ...p, specs: { ...(p.specs || {}), ...specs } } : p
        ),
      })),
  };
}

export { siteComplet };
