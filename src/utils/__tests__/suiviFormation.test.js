// Suivi des formations de l'équipe (tableau de bord du gérant).
import { describe, it, expect } from 'vitest';
import { suiviFormation, apprenantsEquipe, SEUIL_REUSSITE_QUIZ, messageEncouragement } from '../suiviFormation';

const lecon = (id, extra = {}) => ({ id, title: `Leçon ${id}`, type: 'texte', ...extra });
const COURS_A = { id: 'A', title: 'Démarrer', modules: [
  { id: 'A1', title: 'M1', lecons: [lecon('a1'), lecon('a2')] },
  { id: 'A2', title: 'M2', lecons: [lecon('a3'), lecon('aq', { type: 'quiz' })] },
] };
const COURS_B = { id: 'B', title: 'Devis', modules: [{ id: 'B1', title: 'M1', lecons: [lecon('b1'), lecon('bq', { type: 'quiz' })] }] };
const COURS_C = { id: 'C', title: 'Revenus', modules: [{ id: 'C1', title: 'M1', lecons: [lecon('c1')] }] };
const MASQUE = { id: 'M', title: 'Brouillon', masque: true, modules: [{ id: 'M1', lecons: [lecon('m1')] }] };
const VIDE = { id: 'V', title: 'Vide', modules: [] };
const FORMATIONS = [COURS_A, COURS_B, COURS_C, MASQUE, VIDE];
const MEMBRES = [
  { id: 'g', name: 'Adam Gérant', role: 'gerant' },
  { id: 'k', name: 'Kossi Agbo', role: 'technicien', phone: '+22890000001' },
  { id: 'f', name: 'Fatou Boko', role: 'technicien' },
  { id: 'i', name: 'Ibrahim Dan', role: 'technicien' },
];
const MAINTENANT = new Date('2026-10-14T12:00:00Z');
const fiche = (userId, leconId, status = 'complete', extra = {}) => ({
  id: `fp-${userId}-${leconId}`, userId, leconId, formationId: leconId[0].toUpperCase(), status, date: '2026-10-10T10:00:00Z', ...extra,
});
const PROGRESSION = [
  // Kossi : tout le cours A (dont le quiz, 3/4 au mieux), le quiz B raté.
  fiche('k', 'a1'), fiche('k', 'a2'), fiche('k', 'a3'),
  fiche('k', 'aq', 'complete', { quiz: { score: 3, total: 4, meilleurScore: 3, tentatives: 2, dernierLe: '2026-10-12T09:00:00Z' } }),
  fiche('k', 'bq', 'vue', { quiz: { score: 1, total: 4, meilleurScore: 1, tentatives: 1, dernierLe: '2026-10-11T09:00:00Z' } }),
  // Fatou : une leçon ouverte il y a longtemps.
  fiche('f', 'a1', 'vue', { date: '2026-08-01T10:00:00Z', vueLe: '2026-08-01T10:00:00Z' }),
  // Le gérant, un ancien membre, une leçon supprimée et un cours masqué : ignorés.
  fiche('g', 'c1'), fiche('ancien', 'c1'), fiche('k', 'supprimee'), fiche('i', 'm1'),
];
const S = suiviFormation({ formations: FORMATIONS, progression: PROGRESSION, membres: MEMBRES, maintenant: MAINTENANT });
const ligne = (id) => S.apprenants.find((l) => l.id === id);

describe('apprenants', () => {
  it('l’équipe sans le gérant', () => {
    expect(apprenantsEquipe(MEMBRES).map((m) => m.id)).toEqual(['k', 'f', 'i']);
    expect(S.apprenants.map((l) => l.id)).toEqual(['k', 'f', 'i']);
  });

  it('leçons, modules et cours terminés ; cours masqués, vides ou leçons supprimées ignorés', () => {
    const k = ligne('k');
    expect(k.totalLecons).toBe(7);
    expect(k.leconsTerminees).toBe(4);
    expect(k.leconsOuvertes).toBe(5);
    expect(k.pct).toBe(57);
    expect(k.modulesTermines).toBe(2);
    expect(k.modulesCommences).toBe(3);
    expect(k.coursTermines).toBe(1);
    expect(k.coursCommences.map((c) => [c.id, c.pct])).toEqual([['A', 100], ['B', 0]]);
  });

  it('un module n’est terminé que si TOUTES ses leçons le sont', () => {
    const f = ligne('f');
    expect(f.modulesCommences).toBe(1);
    expect(f.modulesTermines).toBe(0);
    expect(f.commence).toBe(true);
  });

  it('quiz : meilleure tentative, réussi à partir de 70 %', () => {
    const k = ligne('k');
    expect(SEUIL_REUSSITE_QUIZ).toBe(0.7);
    expect(k.quiz.map((q) => [q.leconId, q.pct, q.reussi, q.tentatives])).toEqual([['aq', 75, true, 2], ['bq', 25, false, 1]]);
    expect(k.quizReussis).toBe(1);
    expect(k.scoreMoyenQuiz).toBe(50);
  });

  it('activité : récente (30 jours) ou non ; jamais commencé', () => {
    expect(ligne('k').actifRecent).toBe(true);
    expect(ligne('k').derniereActivite).toBe('2026-10-12T09:00:00Z');
    expect(ligne('f').actifRecent).toBe(false);
    expect(ligne('i')).toMatchObject({ commence: false, actifRecent: false, derniereActivite: null, pct: 0 });
  });
});

describe('équipe', () => {
  it('qui a commencé, qui n’a pas commencé', () => {
    expect(S.equipe).toMatchObject({
      total: 3, ontCommence: 2, pctCommence: 67, pasCommence: 1, pctPasCommence: 33,
      actifsRecents: 1, ontTermineUnCours: 1, modulesTermines: 2, leconsTerminees: 4,
    });
  });

  it('équipe vide : pas de division par zéro', () => {
    const vide = suiviFormation({ formations: FORMATIONS, progression: [], membres: [] });
    expect(vide.equipe).toMatchObject({ total: 0, pctCommence: 0, pctPasCommence: 0 });
    expect(vide.quiz).toMatchObject({ realises: 0, scoreMoyen: null, pctReussite: 0 });
  });
});

describe('quiz de l’équipe', () => {
  it('réalisés, réussis, score moyen ; le plus difficile en tête', () => {
    expect(S.quiz).toMatchObject({ realises: 2, tentatives: 3, reussis: 1, pctReussite: 50, scoreMoyen: 50, apprenants: 1 });
    expect(S.quiz.parQuiz.map((q) => [q.leconId, q.scoreMoyen])).toEqual([['bq', 25], ['aq', 75]]);
  });
});

describe('cours regardés beaucoup, ou peu', () => {
  it('classés par nombre d’apprenants', () => {
    expect(S.cours.map((c) => [c.id, c.apprenants, c.termines])).toEqual([['A', 2, 1], ['B', 1, 0], ['C', 0, 0]]);
    expect(S.cours[0]).toMatchObject({ pctEquipe: 67, leconsOuvertes: 5, leconsTerminees: 4 });
  });

  it('plus suivis (au moins un apprenant) et moins suivis (personne en tête), sans doublon', () => {
    expect(S.plusSuivis.map((c) => c.id)).toEqual(['A', 'B']);
    expect(S.moinsSuivis.map((c) => c.id)).toEqual(['C']);
  });
});

describe('message d’encouragement', () => {
  it('jamais commencé : invitation, prénom seul', () => {
    const m = messageEncouragement(ligne('i'), 'Démarrer');
    expect(m).toMatch(/^Bonjour Ibrahim,/);
    expect(m).toMatch(/commencez par « Démarrer »/);
    expect(m).not.toMatch(/Dan/);
  });
  it('en cours : bravo et cours à continuer', () => {
    expect(messageEncouragement(ligne('k'))).toMatch(/4 leçons terminées.*Continuez « Devis » : vous en êtes à 0 %/);
  });
});
