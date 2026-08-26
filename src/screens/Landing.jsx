// Page publique d'accueil — ce que voit un visiteur qui n'est pas connecté.
// Elle ne lit aucune donnée : ni contexte, ni localStorage, ni Supabase. C'est
// une vitrine, elle doit s'afficher partout, y compris hors ligne.
import { useEffect } from 'react';
import LandingEntete from './landing/LandingEntete';
import LandingHero from './landing/LandingHero';
import LandingChiffres from './landing/LandingChiffres';
import LandingConseiller from './landing/LandingConseiller';
import LandingAvantages from './landing/LandingAvantages';
import LandingEtapes from './landing/LandingEtapes';
import LandingTarifs from './landing/LandingTarifs';
import LandingCarriere from './landing/LandingCarriere';
import LandingTemoignages from './landing/LandingTemoignages';
import LandingFaq from './landing/LandingFaq';
import LandingAppel from './landing/LandingAppel';
import LandingPied from './landing/LandingPied';

/**
 * Apparition des blocs au défilement.
 *
 * Le masquage est posé EN JAVASCRIPT, jamais en CSS : une règle
 * `opacity: 0` par défaut rendrait la page blanche pour un visiteur sans
 * script — et pour les robots d'indexation. Ici, sans script, tout reste
 * visible ; le script ne fait qu'ajouter le mouvement.
 */
function useApparitionAuDefilement() {
  useEffect(() => {
    const blocs = Array.from(document.querySelectorAll('[data-reveal]'));
    if (!blocs.length || !('IntersectionObserver' in window)) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    blocs.forEach((el, n) => {
      const retard = (n % 4) * 70;
      el.style.opacity = '0';
      el.style.transform = 'translateY(18px)';
      el.style.transition = `opacity .55s ease ${retard}ms, transform .55s ease ${retard}ms`;
    });

    const observateur = new IntersectionObserver((entrees) => {
      entrees.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.style.opacity = '1';
        e.target.style.transform = 'none';
        observateur.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    blocs.forEach((el) => observateur.observe(el));
    return () => observateur.disconnect();
  }, []);
}

export default function Landing() {
  useApparitionAuDefilement();

  return (
    <div className="landing">
      <LandingEntete />
      <LandingHero />
      <LandingChiffres />
      <LandingConseiller />
      <LandingAvantages />
      <LandingEtapes />
      <LandingTarifs />
      <LandingCarriere />
      <LandingTemoignages />
      <LandingFaq />
      <LandingAppel />
      <LandingPied />
    </div>
  );
}
