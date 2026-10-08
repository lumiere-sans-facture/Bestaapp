// Kits reçus du serveur sans leurs champs de référence : la copie partagée
// remplace la copie locale, et une copie enregistrée avant la règle des
// modules ajoutés faisait perdre au kit 60 kWh son extension.
import { describe, it, expect } from 'vitest';
import { completerKits } from '../../context/dataState';
import { suggestKitsForBattery } from '../solarSizing';
import { SOLAR_KITS } from '../../data/kits';
import { fusionnerCollection, idsModifies, memeContenu } from '../fileSync';

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

describe('kits recomplétés : jamais « en attente d’envoi »', () => {
  // Reproduit la réception (context/useRemoteSync.js) : la copie reçue est
  // recomplétée PUIS sert de référence « déjà sur le serveur ».
  it('un compte qui reçoit une copie ancienne n’a rien à renvoyer', () => {
    const recus = completerKits(copieAncienne);
    const locaux = completerKits(copieAncienne); // l'appareil les a déjà complétés au chargement
    const fusion = fusionnerCollection(locaux, recus, new Set(), new Set());
    expect(fusion).toBe(recus);
    expect(idsModifies(recus, fusion)).toEqual([]);
  });

  it('les éléments déjà bloqués « en attente » se libèrent à la réception suivante', () => {
    const recus = completerKits(copieAncienne);
    const locaux = recus.map((k) => ({ ...k })); // mêmes contenus, autres objets
    const bloques = new Set(locaux.map((k) => k.id)); // file d'une session précédente
    const fusion = fusionnerCollection(locaux, recus, new Set(), bloques);
    expect(fusion).toBe(recus);
    expect(idsModifies(recus, fusion)).toEqual([]);
  });

  it('une vraie modification locale reste en attente', () => {
    // Kits de l'entreprise elle-même (pas une copie partagée par BestaSolar).
    const recus = completerKits(copieAncienne.map(({ partage, ...k }) => k)); // eslint-disable-line no-unused-vars
    const locaux = recus.map((k, i) => (i === 0 ? { ...k, name: 'Kit renommé ici' } : k));
    const fusion = fusionnerCollection(locaux, recus, new Set(), new Set([recus[0].id]));
    expect(fusion[0].name).toBe('Kit renommé ici');
    expect(idsModifies(recus, fusion)).toEqual([recus[0].id]);
  });
});

describe('memeContenu', () => {
  it('égal champ pour champ, quel que soit l’ordre des clés', () => {
    expect(memeContenu({ a: 1, b: { c: 2, d: [1, 2] } }, { b: { d: [1, 2], c: 2 }, a: 1 })).toBe(true);
    expect(memeContenu({ a: 1 }, { a: 2 })).toBe(false);
    expect(memeContenu({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
  });
});
