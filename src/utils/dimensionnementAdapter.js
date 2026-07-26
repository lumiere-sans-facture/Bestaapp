// Adaptateur entre l'état des assistants de devis et le moteur v2.
// Rôle unique : assembler les entrées de dimensionner() depuis le catalogue
// produits, le kit retenu et les paramètres de projet. Aucune règle métier
// nouvelle ici — le calcul reste dans dimensionnementV2.js.

import { dimensionner } from './dimensionnementV2';
import { panneauPourMoteur, onduleurPourMoteur, batteriePourMoteur } from './materielSpecs';
import { parseKwh } from './solarSizing';

/** Panneau du catalogue correspondant à une puissance crête (Wc) donnée. */
const trouverPanneau = (products = [], puissanceWc) => {
  const panneaux = products.filter((p) => p.category === 'panneaux');
  if (!panneaux.length) return null;
  const avecWc = panneaux
    .map((p) => ({ p, wc: panneauPourMoteur(p).puissanceWc }))
    .filter((x) => x.wc);
  if (!avecWc.length) return panneaux[0];
  if (!puissanceWc) return avecWc[0].p;
  return avecWc.sort((a, b) => Math.abs(a.wc - puissanceWc) - Math.abs(b.wc - puissanceWc))[0].p;
};

/** Batterie du catalogue la plus proche d'une capacité de module (kWh). */
const trouverBatterie = (products = [], capaciteKwh) => {
  const bats = products.filter((p) => p.category === 'batteries');
  if (!bats.length) return null;
  if (!capaciteKwh) return bats[0];
  return bats
    .map((p) => ({ p, kwh: parseKwh(p.name) || 0 }))
    .sort((a, b) => Math.abs(a.kwh - capaciteKwh) - Math.abs(b.kwh - capaciteKwh))[0].p;
};

/**
 * Construit les entrées du moteur v2.
 *
 * @param {object} o
 * @param {Array}  o.charges        lignes de charges du wizard
 * @param {object} o.params         paramètres de projet (ParametresProjet)
 * @param {object} o.site           site d'irradiation retenu
 * @param {Array}  o.products       catalogue (specs matériel)
 * @param {number} [o.hsp]          ensoleillement de repli (heures de pic)
 * @param {number} [o.tensionSysteme]
 * @param {object} [o.kit]          kit préconfiguré imposé : { panels, panelW, battery, batteryModules, name }
 * @param {object} [o.consommationDirecte] saisie directe : { jourKwh, nuitKwh, puissanceSimultanee }
 */
export function construireEntrees({
  charges = [], params = {}, site = null, products = [], hsp = null,
  tensionSysteme = 48, kit = null, consommationDirecte = null,
}) {
  // Saisie directe : deux charges de synthèse portant les énergies saisies, et
  // la pointe simultanée fournie par l'utilisateur (coefficient neutralisé —
  // la valeur saisie EST la pointe).
  let equipements = charges;
  let coefficientSimultaneite = params.coefficientSimultaneite;
  let puissanceSimultaneeImposee = null;
  if (consommationDirecte) {
    const pointe = Number(consommationDirecte.puissanceSimultanee) || 0;
    const jour = Number(consommationDirecte.jourKwh) || 0;
    const nuit = Number(consommationDirecte.nuitKwh) || 0;
    equipements = [
      ...(jour > 0 ? [{
        nom: 'Consommation de jour (saisie directe)',
        puissanceW: pointe || jour * 1000, quantite: 1,
        heuresJour: pointe ? (jour * 1000) / pointe : 1, heuresNuit: 0,
      }] : []),
      ...(nuit > 0 ? [{
        nom: 'Consommation de nuit (saisie directe)',
        puissanceW: pointe || nuit * 1000, quantite: 1,
        heuresJour: 0, heuresNuit: pointe ? (nuit * 1000) / pointe : 1,
      }] : []),
    ];
    // La pointe saisie fait foi : le coefficient de simultanéité ne s'applique pas.
    puissanceSimultaneeImposee = pointe || null;
    coefficientSimultaneite = 1;
  }

  const panneauWc = kit?.panelW || null;
  const panneauProduit = trouverPanneau(products, panneauWc);
  const panneau = { ...panneauPourMoteur(panneauProduit || {}) };
  // Le kit impose la puissance crête du module retenu.
  if (panneauWc) panneau.puissanceWc = panneauWc;

  // Modules batterie du kit (un ou plusieurs blocs) → capacité unitaire.
  const moduleKwh = kit
    ? (kit.batteryModules?.[0]?.capacity ?? (kit.battery || null))
    : null;
  const batterieProduit = trouverBatterie(products, moduleKwh);
  const batterie = { ...batteriePourMoteur(batterieProduit || {}) };
  if (moduleKwh) batterie.capaciteKwh = moduleKwh;

  return {
    equipements,
    site: site || {},
    strategieIrradiation: params.strategieIrradiation,
    baseAutonomie: params.baseAutonomie,
    coefficientSimultaneite,
    puissanceSimultaneeImposee,
    joursAutonomie: params.joursAutonomie,
    tensionSysteme,
    hsp,
    distances: params.distances,
    materiel: {
      panneau,
      batterie,
      catalogueOnduleurs: products.filter((p) => p.category === 'onduleurs').map(onduleurPourMoteur),
      // Kit préconfiguré : le nombre de panneaux est imposé, et l'écart avec le
      // minimum calculé est justifié sur la fiche.
      nbPanneauxImpose: kit?.panels ?? null,
      kitNom: kit?.name ?? null,
    },
  };
}

/** Raccourci : construit les entrées puis dimensionne. */
export const dimensionnerDepuisWizard = (options) => dimensionner(construireEntrees(options));

/**
 * Version de moteur d'un dimensionnement enregistré. Les enregistrements
 * antérieurs (sans marqueur) sont de la v1 : ils restent affichés avec
 * l'ancienne logique, en lecture seule.
 */
export const moteurVersionDe = (sizing) => sizing?.moteurVersion || 'v1';

/** Un dimensionnement enregistré relève-t-il de l'ancienne méthodologie ? */
export const estAncienneMethodologie = (sizing) => moteurVersionDe(sizing) === 'v1';
