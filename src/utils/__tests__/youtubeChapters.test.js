// Sommaire minuté récupéré depuis la description d'une vidéo YouTube.
// Le risque n'est pas de rater un chapitre : c'est d'en INVENTER. Une
// description contient toutes sortes de minutages qui ne sont pas un plan.
import { describe, it, expect } from 'vitest';
import {
  youtubeVideoId, chapitresDeDescription, dureeDepuisIso, dureeDepuisSecondes,
} from '../youtubeChapters';

describe('youtubeVideoId', () => {
  it('reconnaît les formes de lien courantes', () => {
    const id = 'dQw4w9WgXcQ';
    for (const url of [
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtube.com/watch?v=${id}&t=42s`,
      `https://www.youtube.com/watch?list=PL1&v=${id}`,
      `https://youtu.be/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/live/${id}`,
    ]) {
      expect(youtubeVideoId(url)).toBe(id);
    }
  });

  it('ignore ce qui n’est pas YouTube', () => {
    expect(youtubeVideoId('https://vimeo.com/123456')).toBeNull();
    expect(youtubeVideoId('https://exemple.tg/cours.mp4')).toBeNull();
    expect(youtubeVideoId('')).toBeNull();
    expect(youtubeVideoId(null)).toBeNull();
  });
});

describe('chapitresDeDescription', () => {
  it('extrait un sommaire classique', () => {
    const desc = [
      'Dans cette vidéo, on installe un kit solaire.',
      '',
      '0:00 Introduction',
      '1:32 Poser les panneaux',
      '12:05 Raccorder l’onduleur',
      '1:02:30 Mise en service',
    ].join('\n');
    expect(chapitresDeDescription(desc)).toEqual([
      { t: 0, label: 'Introduction' },
      { t: 92, label: 'Poser les panneaux' },
      { t: 725, label: 'Raccorder l’onduleur' },
      { t: 3750, label: 'Mise en service' },
    ]);
  });

  it('tolère puces, tirets et parenthèses', () => {
    const desc = '• (00:00) - Introduction\n- 02:10 — Les batteries\n* 05:00 : Le câblage';
    expect(chapitresDeDescription(desc).map((c) => c.label))
      .toEqual(['Introduction', 'Les batteries', 'Le câblage']);
  });

  it('accepte la forme inverse « Titre — 0:00 »', () => {
    const desc = 'Introduction — 0:00\nLes batteries — 2:10';
    expect(chapitresDeDescription(desc)).toEqual([
      { t: 0, label: 'Introduction' },
      { t: 130, label: 'Les batteries' },
    ]);
  });

  it('n’invente RIEN à partir d’un simple renvoi', () => {
    // Un seul minutage isolé : c'est une référence, pas un plan.
    expect(chapitresDeDescription('Voir la démonstration à 4:32 pour le détail.')).toEqual([]);
  });

  it('refuse une liste désordonnée (ce n’est pas un sommaire)', () => {
    expect(chapitresDeDescription('5:00 Fin\n1:00 Début')).toEqual([]);
  });

  it('ignore les minutages sans libellé et les lignes ordinaires', () => {
    expect(chapitresDeDescription('12:30\n45:00\nAbonnez-vous !')).toEqual([]);
  });

  it('ne garde qu’une ligne par minutage', () => {
    const c = chapitresDeDescription('0:00 Intro\n0:00 Doublon\n1:00 Suite');
    expect(c).toEqual([{ t: 0, label: 'Intro' }, { t: 60, label: 'Suite' }]);
  });

  it('gère une description vide ou absente', () => {
    expect(chapitresDeDescription('')).toEqual([]);
    expect(chapitresDeDescription(null)).toEqual([]);
    expect(chapitresDeDescription(undefined)).toEqual([]);
  });
});

describe('durées', () => {
  it('convertit la durée ISO de l’API YouTube', () => {
    expect(dureeDepuisIso('PT8M30S')).toBe('9 min');   // 30 s → arrondi supérieur
    expect(dureeDepuisIso('PT8M29S')).toBe('8 min');
    expect(dureeDepuisIso('PT1H5M')).toBe('1 h 05');
    expect(dureeDepuisIso('PT2H')).toBe('2 h');
    expect(dureeDepuisIso('PT45S')).toBe('1 min');
    expect(dureeDepuisIso('n’importe quoi')).toBe('');
  });

  it('convertit une durée en secondes', () => {
    expect(dureeDepuisSecondes(720)).toBe('12 min');
    expect(dureeDepuisSecondes(0)).toBe('');
  });
});
