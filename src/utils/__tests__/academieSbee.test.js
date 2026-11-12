// Exemples SBEE de l'Académie : leurs chiffres sont ceux que l'application
// calcule. Le stagiaire refait l'exercice dans l'assistant et doit retrouver
// exactement ce que dit la leçon — si le prix du kWh ou le calcul change, ce
// test signale la leçon à mettre à jour.
// Et le script supabase/academie-sbee-145.sql, qui met à jour les cours déjà
// en base, doit amener l'ancienne version exactement à celle de l'application.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FORMATIONS_ACADEMIE } from '../../data/formationsAcademie';
import { tarifPays } from '../../data/tarifsUemoa';
import { SOLAR_KITS } from '../../data/kits';
import { factureVersConsommation, JOURS_PAR_MOIS } from '../factureConso';
import { calculateSystemSize, suggestKitsForBattery, DEFAULT_PEAK_SUN_HOURS, DEFAULT_AUTONOMY_NIGHTS } from '../solarSizing';
import { KWH_PAR_LITRE_GAZOLE } from '../roi';

const TEXTE = JSON.stringify(FORMATIONS_ACADEMIE);
const FACTURE = 25000;
const virgule = (n, d = 1) => n.toFixed(d).replace('.', ',');

describe('Académie : exemples de facture SBEE', () => {
  const prix = tarifPays('bj').prixKwh;
  const conso = (repartition) => factureVersConsommation(FACTURE, prix, repartition);
  const batterie = (repartition) => {
    const c = conso(repartition);
    return calculateSystemSize({ day: c.day, night: c.night }, 'off-grid', DEFAULT_PEAK_SUN_HOURS, undefined, DEFAULT_AUTONOMY_NIGHTS, { peakLoad: 0 }).batteryCapacity;
  };
  const kwhMois = Math.round(FACTURE / prix);
  const kwhJour = virgule(FACTURE / prix / JOURS_PAR_MOIS);

  it('au prix SBEE du simulateur (145 F)', () => {
    expect(prix).toBe(145);
    expect(TEXTE).toContain(`25 000 F par mois à ${prix} F le kWh : environ ${kwhMois} kWh par mois, soit ${kwhJour} kWh par jour`);
    expect(TEXTE).toContain(`25 000 ÷ ${prix} ≈ ${kwhMois} kWh par mois`);
    expect(TEXTE).toContain(`prix du kWh ${prix} F`);
    expect(TEXTE).toContain(`contre ${prix} F au réseau`);
    expect(TEXTE).not.toMatch(/115 F le kWh|÷ 115|kWh 115 F|contre 115 F/);
  });

  it('batterie conseillée : celle de l’assistant, en « Équilibré » et « Surtout le soir »', () => {
    const [eq, soir] = [virgule(batterie('equilibre')), virgule(batterie('soir'))];
    expect([eq, soir]).toEqual(['3,8', '5,3']);
    expect(TEXTE).toContain(`« Équilibré » donne une batterie conseillée d’environ ${eq} kWh ; « surtout le soir », d’environ ${soir} kWh`);
    expect(TEXTE).toContain(`En « Équilibré », une batterie conseillée d’environ ${eq} kWh ; en « Surtout le soir », d’environ ${soir} kWh`);
  });

  it('kits suggérés avec les kits livrés par défaut', () => {
    const nom = (repartition) => suggestKitsForBattery(SOLAR_KITS, batterie(repartition))[0].name.split(' — ')[0];
    expect(TEXTE).toContain(`le ${nom('equilibre')} en « Équilibré », le ${nom('soir')} en « Surtout le soir »`);
  });

  it('quiz : la bonne réponse est le calcul, les leurres n’en sont pas', () => {
    const quiz = FORMATIONS_ACADEMIE.flatMap((c) => c.modules).flatMap((m) => m.lecons)
      .flatMap((l) => l.questions || []);
    const parMois = quiz.find((q) => q.question.startsWith(`Facture de 25 000 F à ${prix} F le kWh : combien de kWh par mois`));
    const parJour = quiz.find((q) => q.question.startsWith(`Facture SBEE de 25 000 F à ${prix} F le kWh : consommation par jour`));
    expect(parMois.choix[parMois.bonne]).toBe(`${kwhMois} kWh`);
    expect(parJour.choix[parJour.bonne]).toBe(`${kwhJour} kWh`);
    expect(new Set(parMois.choix).size).toBe(3);
    expect(new Set(parJour.choix).size).toBe(3);
  });

  it('le kWh du groupe (250 F) n’est plus présenté comme « plus du double » du réseau SBEE', () => {
    expect(750 / KWH_PAR_LITRE_GAZOLE).toBe(250);
    expect(250 / prix).toBeLessThan(2);
    expect(TEXTE).not.toContain('plus du double du réseau');
  });
});

describe('supabase/academie-sbee-145.sql', () => {
  const SQL = readFileSync(new URL('../../../supabase/academie-sbee-145.sql', import.meta.url), 'utf8');
  const paires = [...SQL.matchAll(/\$ancien\$(.*?)\$ancien\$,\s*\$nouveau\$(.*?)\$nouveau\$/gs)]
    .map((m) => [m[1], m[2]]);
  const appliquer = (texte, sens) => paires.reduce((t, [a, n]) => (sens > 0 ? t.split(a).join(n) : t.split(n).join(a)), texte);

  it('chaque remplacement est un texte entier de l’Académie (sa nouvelle version)', () => {
    expect(paires.length).toBe(15);
    for (const [ancien, nouveau] of paires) {
      expect(typeof JSON.parse(ancien)).toBe('string');
      expect(TEXTE).toContain(nouveau);
      expect(TEXTE).not.toContain(ancien);
    }
  });

  it('amène l’ancienne version exactement à celle de l’application, et se rejoue sans effet', () => {
    const ancienne = appliquer(TEXTE, -1);
    expect(ancienne).not.toBe(TEXTE);
    expect(ancienne).toMatch(/÷ 115 ≈ 217 kWh/);
    expect(() => JSON.parse(ancienne)).not.toThrow();
    expect(appliquer(ancienne, +1)).toBe(TEXTE);
    expect(appliquer(TEXTE, +1)).toBe(TEXTE);
  });

  it('ne touche que les cours de l’organisation interne, sans rien effacer', () => {
    expect(SQL).toMatch(/where org_id = v_org and id in \('academie-demarrer', 'academie-devis'\)/);
    expect(SQL).toMatch(/where kind = 'interne'\) <> 1 then\s+raise exception/);
    expect(SQL).not.toMatch(/\bdelete\s+from\b|\bdrop\s+|\binsert\s+into\b|\btruncate\b/i);
  });
});
