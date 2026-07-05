import { describe, it, expect } from 'vitest';
import {
  allLecons, isLeconDone, courseProgress, resumeLecon, nextLecon, prevLecon,
  parseMinutes, courseDuration, courseCounts,
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
