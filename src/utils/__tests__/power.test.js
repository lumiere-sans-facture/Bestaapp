import { describe, it, expect } from 'vitest';
import { extractPowerWatts } from '../power';

describe('extractPowerWatts', () => {
  it('convertit les kVA en watts', () => {
    expect(extractPowerWatts('Onduleur 5kVA')).toBe(5000);
  });
  it('convertit les kW et kWh', () => {
    expect(extractPowerWatts('Système 3.5 kW')).toBe(3500);
    expect(extractPowerWatts('Batterie 5kWh')).toBe(5000);
  });
  it('garde les watts tels quels (W et Wc)', () => {
    expect(extractPowerWatts('Panneau 550W')).toBe(550);
    expect(extractPowerWatts('Panneau 550Wc')).toBe(550);
  });
  it('accepte la virgule décimale', () => {
    expect(extractPowerWatts('Onduleur 2,5 kVA')).toBe(2500);
  });
  it('renvoie null sans puissance', () => {
    expect(extractPowerWatts('Câble solaire 6mm')).toBeNull();
    expect(extractPowerWatts('')).toBeNull();
  });
});
