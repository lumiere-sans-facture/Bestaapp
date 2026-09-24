import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// android/app/build.gradle déduit le versionCode du Play Store de cette
// version : MAJEURE × 10000 + MINEURE × 100 + CORRECTIF. Une version hors
// format, ou une mineure / un correctif ≥ 100, donnerait un numéro qui
// n'augmente pas — et le Play Store refuserait l'envoi.
const version = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')).version;

describe('version de l’app (package.json)', () => {
  it('est au format X.Y.Z, mineure et correctif sous 100', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    const [, mineure, correctif] = version.split('.').map(Number);
    expect(mineure).toBeLessThan(100);
    expect(correctif).toBeLessThan(100);
  });
});
