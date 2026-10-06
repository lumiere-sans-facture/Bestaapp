// Kits reçus du serveur sans leurs champs de référence : la copie partagée
// remplace la copie locale, et une copie enregistrée avant la règle des
// modules ajoutés faisait perdre au kit 60 kWh son extension.
import { describe, it, expect } from 'vitest';
import { completerKits } from '../../context/dataState';
import { suggestKitsForBattery } from '../solarSizing';
import { SOLAR_KITS } from '../../data/kits';

// Copie « ancienne » : les mêmes kits, sans extensionBatterie ni tension.
const copieAncienne = SOLAR_KITS.map(({ extensionBatterie, tension, ...k }) => ({ ...k, partage: true })); // eslint-disable-line no-unused-vars
const noms = (kits, besoin) => suggestKitsForBattery(kits, besoin).map((k) => k.id);

describe('kits reçus du serveur', () => {
  it('sans complément, le 128 kWh serait proposé pour 80 kWh (le défaut constaté)', () => {
    expect(noms(copieAncienne, 80)).toEqual(['kit-128kwh-deye-hv']);
  });

  it('recomplétés : le 60 kWh étendu jusqu’à 120 kWh, le 128 kWh au-delà seulement', () => {
    const kits = completerKits(copieAncienne);
    expect(noms(kits, 80)).toEqual(['kit-60kwh-deye-hv']);
    expect(noms(kits, 120)).toEqual(['kit-60kwh-deye-hv']);
    expect(noms(kits, 121)).toEqual(['kit-128kwh-deye-hv']);
    // La tension batterie revient aussi (kits basse tension).
    expect(kits.find((k) => k.id === 'kit-20kwh').tension).toBe(48);
  });

  it('une valeur présente n’est jamais écrasée, et rien ne change si tout est là', () => {
    const modifie = SOLAR_KITS.map((k) => (k.id === 'kit-60kwh-deye-hv' ? { ...k, extensionBatterie: { moduleKwh: 12, maxKwh: 96 } } : k));
    expect(completerKits(modifie).find((k) => k.id === 'kit-60kwh-deye-hv').extensionBatterie.maxKwh).toBe(96);
    expect(completerKits(SOLAR_KITS)).toBe(SOLAR_KITS);
  });
});
