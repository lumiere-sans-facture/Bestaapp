import { describe, it, expect } from 'vitest';
import { toEmbed } from '../video';

describe('toEmbed — YouTube', () => {
  it('convertit watch, youtu.be et shorts en lecteur nocookie', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      'https://youtu.be/jNQXAC9IVRw',
      'https://www.youtube.com/shorts/jNQXAC9IVRw',
    ]) {
      expect(toEmbed(url).src).toContain('youtube-nocookie.com/embed/jNQXAC9IVRw');
    }
  });
  it('ajoute le point de départ (sommaire minuté)', () => {
    expect(toEmbed('https://youtu.be/jNQXAC9IVRw', 150).src).toContain('start=150');
    expect(toEmbed('https://youtu.be/jNQXAC9IVRw', 0).src).not.toContain('start=');
  });
  it("une chaîne (@bestasolar) n'est pas une vidéo", () => {
    expect(toEmbed('https://www.youtube.com/@bestasolar')).toBeNull();
  });
});

describe('toEmbed — Vimeo', () => {
  it('vidéo publique — lecteur nu (ni titre, ni auteur, ni badge)', () => {
    const src = toEmbed('https://vimeo.com/76979871').src;
    expect(src).toContain('player.vimeo.com/video/76979871?autoplay=1&playsinline=1');
    for (const p of ['title=0', 'byline=0', 'portrait=0', 'badge=0', 'dnt=1']) expect(src).toContain(p);
  });
  it('vidéo non répertoriée : transmet le code de confidentialité (h=)', () => {
    expect(toEmbed('https://vimeo.com/76979871/9abc8def01').src).toContain('&h=9abc8def01');
    expect(toEmbed('https://player.vimeo.com/video/76979871?h=9abc8def01').src).toContain('&h=9abc8def01');
  });
  it('lien « manage » du dashboard Vimeo', () => {
    expect(toEmbed('https://vimeo.com/manage/videos/76979871').src).toContain('/video/76979871?');
  });
  it('point de départ en #t=', () => {
    expect(toEmbed('https://vimeo.com/76979871', 92).src).toContain('#t=92s');
  });
});

describe('toEmbed — fichiers et invalides', () => {
  it('mp4 direct avec point de départ', () => {
    expect(toEmbed('https://cdn.example.com/cours.mp4', 30)).toEqual({ kind: 'video', src: 'https://cdn.example.com/cours.mp4', start: 30 });
  });
  it('URL invalide → null', () => {
    expect(toEmbed('pas une url')).toBeNull();
    expect(toEmbed('https://www.bestasolar.com')).toBeNull();
  });
});
