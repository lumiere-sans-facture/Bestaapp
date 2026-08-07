import { describe, it, expect } from 'vitest';
import {
  allLecons, isLeconDone, courseProgress, resumeLecon, nextLecon, prevLecon,
  parseMinutes, courseDuration, courseCounts,
  parseTimecode, formatTimecode, parseChaptersText, chaptersToText,
  coursVisible, coursVerrouille,
} from '../formation';

const course = {
  id: 'c1',
  title: 'Cours test',
  modules: [
    { id: 'm1', title: 'Module A', lecons: [
      { id: 'l1', title: 'Leçon 1', duration: '10 min' },
      { id: 'l2', title: 'Leçon 2', duration: '20 min' },
    ]},
    { id: 'm2', title: 'Module B', lecons: [
      { id: 'l3', title: 'Leçon 3', duration: '40 min' },
    ]},
  ],
};
const doneRows = (ids, userId = 'u1') =>
  ids.map((leconId) => ({ id: `fp-${userId}-${leconId}`, userId, formationId: 'c1', leconId, status: 'complete' }));

describe('allLecons', () => {
  it('aplati dans l’ordre pédagogique avec le contexte du module', () => {
    const flat = allLecons(course);
    expect(flat.map((l) => l.id)).toEqual(['l1', 'l2', 'l3']);
    expect(flat[2].moduleTitle).toBe('Module B');
  });
  it('tolère un cours vide', () => {
    expect(allLecons({ modules: [] })).toEqual([]);
    expect(allLecons(null)).toEqual([]);
  });
});

describe('progression', () => {
  it('compte les leçons faites du bon utilisateur', () => {
    const progress = [...doneRows(['l1']), ...doneRows(['l2', 'l3'], 'u2')];
    expect(isLeconDone(progress, 'u1', 'l1')).toBe(true);
    expect(isLeconDone(progress, 'u1', 'l2')).toBe(false);
    expect(courseProgress(course, progress, 'u1')).toEqual({ done: 1, total: 3, pct: 33 });
    expect(courseProgress(course, progress, 'u2')).toEqual({ done: 2, total: 3, pct: 67 });
  });
  it('reprend à la première leçon non terminée', () => {
    expect(resumeLecon(course, doneRows(['l1']), 'u1').id).toBe('l2');
    expect(resumeLecon(course, doneRows(['l1', 'l2', 'l3']), 'u1').id).toBe('l1'); // cours fini → début
    expect(resumeLecon(course, [], 'u1').id).toBe('l1');
  });
});

describe('navigation', () => {
  it('suivant / précédent traversent les modules', () => {
    expect(nextLecon(course, 'l2').id).toBe('l3');
    expect(nextLecon(course, 'l3')).toBeNull();
    expect(prevLecon(course, 'l3').id).toBe('l2');
    expect(prevLecon(course, 'l1')).toBeNull();
  });
});

describe('durées', () => {
  it('parse les formats usuels', () => {
    expect(parseMinutes('12 min')).toBe(12);
    expect(parseMinutes('1 h 05')).toBe(65);
    expect(parseMinutes('2h')).toBe(120);
    expect(parseMinutes('')).toBe(0);
  });
  it('totalise la durée d’un cours', () => {
    expect(courseDuration(course)).toBe('1 h 10');
    expect(courseDuration({ modules: [{ id: 'm', lecons: [{ id: 'l', duration: '25 min' }] }] })).toBe('25 min');
  });
  it('compte modules et leçons', () => {
    expect(courseCounts(course)).toEqual({ modules: 2, lecons: 3 });
  });
});

describe('sommaire minuté des vidéos', () => {
  it('parse les timecodes mm:ss et h:mm:ss', () => {
    expect(parseTimecode('00:43')).toBe(43);
    expect(parseTimecode('01:32')).toBe(92);
    expect(parseTimecode('1:02:05')).toBe(3725);
    expect(parseTimecode('abc')).toBeNaN();
  });
  it('formate les secondes en timecode', () => {
    expect(formatTimecode(43)).toBe('00:43');
    expect(formatTimecode(92)).toBe('01:32');
    expect(formatTimecode(3725)).toBe('1:02:05');
  });
  it('parse le texte du formulaire en chapitres triés (lignes invalides ignorées)', () => {
    const txt = '01:32 Récupérer ses emails\nblabla sans timecode\n00:00 Vérifications\n00:43 Déménagement du site ?';
    expect(parseChaptersText(txt)).toEqual([
      { t: 0, label: 'Vérifications' },
      { t: 43, label: 'Déménagement du site ?' },
      { t: 92, label: 'Récupérer ses emails' },
    ]);
  });
  it('fait l’aller-retour chapitres ⇄ texte', () => {
    const chapters = [{ t: 0, label: 'Intro' }, { t: 151, label: 'Suite' }];
    expect(parseChaptersText(chaptersToText(chapters))).toEqual(chapters);
  });
});

describe('garde-fous d’accès aux cours (masqué / réservé Pro)', () => {
  it('un cours sans réglage reste visible et ouvert à tous (existant inchangé)', () => {
    expect(coursVisible({ id: 'c1' })).toBe(true);
    expect(coursVerrouille({ id: 'c1' })).toBe(false);
    expect(coursVerrouille({ id: 'c1' }, { proActif: false })).toBe(false);
  });

  it('un cours masqué disparaît pour les membres, pas pour son gestionnaire', () => {
    const brouillon = { id: 'c1', masque: true };
    expect(coursVisible(brouillon)).toBe(false);
    expect(coursVisible(brouillon, true)).toBe(true);
  });

  it('un cours Pro se verrouille sans abonnement actif', () => {
    const pro = { id: 'c1', acces: 'pro' };
    expect(coursVerrouille(pro, { proActif: false })).toBe(true);
    expect(coursVerrouille(pro, { proActif: true })).toBe(false);
  });

  it('le gestionnaire du cours n’est jamais verrouillé, même sans abonnement', () => {
    const pro = { id: 'c1', acces: 'pro' };
    expect(coursVerrouille(pro, { proActif: false, gere: true })).toBe(false);
  });

  it('accès « tous » explicite : jamais verrouillé', () => {
    expect(coursVerrouille({ id: 'c1', acces: 'tous' }, { proActif: false })).toBe(false);
  });
});
