/**
 * Académie BestaSolar : les trois formations livrées avec l'application.
 *
 * Ce que ces tests protègent :
 *  - la structure (ids uniques, types connus) : la progression des apprenants
 *    s'accroche aux ids, et le script SQL de dotation les réutilise ;
 *  - le plan pédagogique de chaque leçon (objectif, exemple, erreurs du
 *    terrain, « À retenir » de 3 points au plus) ;
 *  - les quiz : 3 à 5 questions jouables par quiz, un quiz par module, des
 *    bonnes réponses réparties (une réponse toujours en « A » se devine) ;
 *  - les schémas cités existent, et s'affichent ;
 *  - la formation 3 ne promet aucun gain chiffré.
 */
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { FORMATIONS_ACADEMIE } from '../../data/formationsAcademie';
import { formations as seedFormations } from '../../data/seed';
import {
  allLecons, courseProgress, courseDuration, parseMinutes, questionValide, schemasCites, blocsLecon,
} from '../../utils/formation';
import SchemaFormation, { NOMS_SCHEMAS } from '../formation/SchemaFormation';
import QuizLecon from '../formation/QuizLecon';

const TYPES_LECON = new Set(['video', 'texte', 'pdf', 'quiz']);
const textes = (c) => allLecons(c).filter((l) => l.type === 'texte');
const quizz = (c) => allLecons(c).filter((l) => l.type === 'quiz');
const [DEMARRER, DEVIS, REVENUS] = FORMATIONS_ACADEMIE;

describe('Académie : structure des formations', () => {
  it('les trois formations sont au catalogue, à côté des cours existants', () => {
    expect(FORMATIONS_ACADEMIE.map((c) => c.id)).toEqual(['academie-demarrer', 'academie-devis', 'academie-revenus']);
    const ids = seedFormations.map((c) => c.id);
    for (const c of FORMATIONS_ACADEMIE) expect(ids).toContain(c.id);
    // Aucune régression : l'ancien cours d'accueil est conservé.
    expect(ids).toContain('f1');
    expect(seedFormations.find((c) => c.id === 'f1').title).toBe('Bien démarrer avec BestaSolar Pro');
  });

  it('chaque id (cours, module, leçon, question) est unique dans tout le catalogue', () => {
    const vus = new Set();
    const doublons = [];
    const noter = (id) => { if (vus.has(id)) doublons.push(id); vus.add(id); };
    for (const c of seedFormations) {
      noter(c.id);
      for (const m of c.modules || []) {
        noter(m.id);
        for (const l of m.lecons || []) {
          noter(l.id);
          for (const q of l.questions || []) noter(q.id);
        }
      }
    }
    expect(doublons).toEqual([]);
  });

  it('chaque formation a un titre, un auteur, une couverture 16:9 embarquée et des leçons typées', () => {
    for (const c of FORMATIONS_ACADEMIE) {
      expect(c.title).toBeTruthy();
      expect(c.author).toBe('Académie BestaSolar');
      // Couverture SVG en data URL : rien à télécharger, affichage hors ligne.
      expect(c.cover).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
      expect(decodeURIComponent(c.cover)).toContain('viewBox="0 0 1600 900"');
      for (const l of allLecons(c)) {
        expect(TYPES_LECON.has(l.type)).toBe(true);
        expect(parseMinutes(l.duration)).toBeGreaterThan(0);
      }
    }
  });

  it('les durées annoncées tiennent : ~45 min, puis ~1 h et ~1 h', () => {
    const minutes = (c) => allLecons(c).reduce((s, l) => s + parseMinutes(l.duration), 0);
    expect(minutes(DEMARRER)).toBeGreaterThanOrEqual(40);
    expect(minutes(DEMARRER)).toBeLessThanOrEqual(50);
    for (const c of [DEVIS, REVENUS]) {
      expect(minutes(c)).toBeGreaterThanOrEqual(50);
      expect(minutes(c)).toBeLessThanOrEqual(70);
    }
    expect(courseDuration(DEMARRER)).toBe('47 min');
  });

  it('pas de module « crédit » (retiré du plan)', () => {
    for (const c of FORMATIONS_ACADEMIE) {
      for (const m of c.modules) expect(m.title.toLowerCase()).not.toMatch(/crédit|credit/);
    }
  });
});

describe('Académie : plan de chaque leçon', () => {
  it('objectif en une phrase, exemple local, erreurs du terrain, « À retenir » de 3 points au plus', () => {
    for (const c of FORMATIONS_ACADEMIE) {
      for (const l of textes(c)) {
        expect(l.description, l.id).toMatch(/^Objectif : [^.]+\.$/);
        expect(l.content, l.id).toMatch(/\n\nExemple — /);
        expect(l.content, l.id).toMatch(/\n\nErreurs fréquentes sur le terrain :\n- /);
        // L'écran titre déjà l'encadré « À retenir / Actions » : pas de redite.
        expect(l.actionTitle, l.id).toBe('L’essentiel');
        const points = l.actionContent.split('\n');
        expect(points.length, l.id).toBeGreaterThan(0);
        expect(points.length, l.id).toBeLessThanOrEqual(3);
        for (const p of points) expect(p, l.id).toMatch(/^- \S/);
      }
    }
  });

  it('des paragraphes courts, lisibles sur téléphone', () => {
    for (const c of FORMATIONS_ACADEMIE) {
      for (const l of textes(c)) {
        for (const b of blocsLecon(l.content)) {
          // ~3 à 4 lignes d'écran de téléphone : 380 caractères au plus.
          if (b.type === 'texte') expect(b.paragraphe.length, `${l.id} : ${b.paragraphe.slice(0, 40)}`).toBeLessThanOrEqual(380);
        }
      }
    }
  });

  it('montants en F CFA et prénoms de la région dans les exemples', () => {
    const tout = FORMATIONS_ACADEMIE.flatMap((c) => textes(c).map((l) => l.content)).join('\n');
    expect(tout).toMatch(/\d F\b/);
    for (const ville of ['Cotonou', 'Lomé', 'Parakou']) expect(tout).toContain(ville);
  });
});

describe('Académie : quiz', () => {
  it('chaque module a son quiz, de 3 à 5 questions jouables', () => {
    for (const c of FORMATIONS_ACADEMIE) {
      for (const m of c.modules) {
        const qs = m.lecons.filter((l) => l.type === 'quiz');
        expect(qs.length, m.id).toBeGreaterThanOrEqual(1);
        for (const q of qs) {
          expect(q.questions.length, q.id).toBeGreaterThanOrEqual(3);
          expect(q.questions.length, q.id).toBeLessThanOrEqual(5);
          for (const question of q.questions) expect(questionValide(question), question.id).toBe(true);
        }
      }
    }
  });

  it('chaque formation se termine par un quiz final', () => {
    for (const c of FORMATIONS_ACADEMIE) {
      const lecons = allLecons(c);
      const derniere = lecons[lecons.length - 1];
      expect(derniere.type).toBe('quiz');
      expect(derniere.title).toMatch(/^Quiz final/);
    }
  });

  it('les bonnes réponses ne sont pas toujours à la même place', () => {
    for (const c of FORMATIONS_ACADEMIE) {
      const places = new Map();
      for (const l of quizz(c)) {
        for (const q of l.questions) places.set(q.bonne, (places.get(q.bonne) || 0) + 1);
      }
      const total = [...places.values()].reduce((a, b) => a + b, 0);
      // A, B et C servent toutes ; aucune ne porte plus de la moitié des réponses.
      expect([0, 1, 2].every((i) => places.get(i) > 0), c.id).toBe(true);
      expect(Math.max(...places.values()) / total, c.id).toBeLessThanOrEqual(0.5);
    }
  });

  it('un quiz s’affiche, et ne se vérifie qu’une fois toutes les réponses données', () => {
    const quiz = quizz(DEMARRER)[0];
    const html = renderToString(<QuizLecon questions={quiz.questions} />);
    for (const q of quiz.questions) expect(html).toContain(q.question);
    expect(html).toContain(`Répondez à toutes les questions (0/${quiz.questions.length})`);
    expect(html).toMatch(/<button[^>]*quiz-verifier[^>]*disabled/);
  });
});

describe('Académie : schémas', () => {
  it('chaque schéma cité existe, et chaque schéma livré est utilisé', () => {
    const cites = FORMATIONS_ACADEMIE.flatMap((c) => textes(c).flatMap((l) => schemasCites(l.content)));
    for (const nom of cites) expect(NOMS_SCHEMAS).toContain(nom);
    expect([...new Set(cites)].sort()).toEqual([...NOMS_SCHEMAS].sort());
  });

  it('chaque schéma se dessine en SVG responsive, avec sa légende', () => {
    for (const nom of NOMS_SCHEMAS) {
      const html = renderToString(<SchemaFormation nom={nom} />);
      expect(html, nom).toMatch(/^<figure class="schema-formation">/);
      expect(html, nom).toMatch(/<svg[^>]*viewBox="0 0 360 \d+"/);
      // Aucune dimension fixe : la figure suit la largeur de l'écran.
      expect(html, nom).not.toMatch(/<svg[^>]*\swidth="\d/);
      expect(html, nom).toContain('<figcaption>');
    }
    expect(renderToString(<SchemaFormation nom="inconnu" />)).toBe('');
  });
});

describe('Académie : progression', () => {
  it('chaque leçon terminée fait avancer le cours, jusqu’à 100 %', () => {
    const lecons = allLecons(REVENUS);
    const progres = [];
    expect(courseProgress(REVENUS, progres, 'u2').pct).toBe(0);
    lecons.forEach((l, i) => {
      progres.push({ id: `fp-u2-${l.id}`, userId: 'u2', formationId: REVENUS.id, leconId: l.id, status: 'complete' });
      expect(courseProgress(REVENUS, progres, 'u2').done).toBe(i + 1);
    });
    expect(courseProgress(REVENUS, progres, 'u2').pct).toBe(100);
    // La progression d'un autre utilisateur ne compte pas.
    expect(courseProgress(REVENUS, progres, 'u3').pct).toBe(0);
  });
});

describe('Formation 3 : aucune promesse de gain', () => {
  const texteDe = (c) => JSON.stringify(c.modules);

  it('dit clairement que rien n’est garanti', () => {
    expect(texteDe(REVENUS)).toMatch(/Aucune n’est garantie/);
    expect(texteDe(REVENUS)).toMatch(/c’est un objectif, pas une promesse/);
  });

  it('aucune tournure qui promet un gain chiffré', () => {
    const t = texteDe(REVENUS).toLowerCase();
    expect(t).not.toMatch(/vous (gagnerez|toucherez|encaisserez)/);
    expect(t).not.toMatch(/(gain|revenu|bénéfice)s? garanti/);
    expect(t).not.toMatch(/garanti(e|s|t)? (de |d’)?(\d|un revenu|un gain|des gains)/);
    expect(t).not.toMatch(/par mois assurés?|revenu assuré/);
  });
});
