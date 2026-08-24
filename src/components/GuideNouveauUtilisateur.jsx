import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { doitAfficherGuide, terminerGuideUtilisateur } from '../utils/onboarding';

const ETAPES = [
  {
    cible: 'suivi',
    titre: 'Suivez vos clients',
    texte: 'Retrouvez ici chaque prospect et faites avancer son dossier jusqu’à la vente.',
  },
  {
    cible: 'devis',
    titre: 'Créez vos devis',
    texte: 'Dimensionnez une installation, préparez votre proposition et retrouvez vos devis.',
  },
  {
    cible: 'formation',
    titre: 'Continuez à vous former',
    texteDesktop: 'Ouvrez ici les formations, leurs modules et votre progression.',
    texteMobile: 'Les formations se trouvent dans Plus : ouvrez cet onglet, puis choisissez Formation.',
  },
];

const cibleVisible = (nom) =>
  [...document.querySelectorAll(`[data-guide="${nom}"]`)].find((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  });

const positionCarte = (rect) => {
  const largeurFenetre = window.innerWidth;
  const hauteurFenetre = window.innerHeight;
  const width = Math.min(330, largeurFenetre - 32);

  if (!rect) return { left: 16, bottom: 96, width, placement: 'bottom' };

  if (largeurFenetre < 900) {
    return {
      left: Math.max(16, Math.min(largeurFenetre - width - 16, rect.left + rect.width / 2 - width / 2)),
      bottom: Math.max(86, hauteurFenetre - rect.top + 14),
      width,
      placement: 'bottom',
    };
  }

  return {
    left: Math.min(largeurFenetre - width - 20, rect.right + 18),
    top: Math.max(20, Math.min(hauteurFenetre - 230, rect.top + rect.height / 2 - 92)),
    width,
    placement: 'left',
  };
};

export default function GuideNouveauUtilisateur() {
  const { user } = useAuth();
  const [ouvert, setOuvert] = useState(() => doitAfficherGuide(user?.id));
  const [etape, setEtape] = useState(0);
  const [cadre, setCadre] = useState(null);
  const [carte, setCarte] = useState(null);

  useEffect(() => {
    setEtape(0);
    setOuvert(doitAfficherGuide(user?.id));
  }, [user?.id]);

  const fermer = useCallback(() => {
    terminerGuideUtilisateur(user?.id);
    setOuvert(false);
  }, [user?.id]);

  useEffect(() => {
    if (!ouvert) return undefined;
    const cible = cibleVisible(ETAPES[etape].cible);
    cible?.scrollIntoView({ block: 'center', inline: 'nearest' });

    let frame;
    const actualiser = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const element = cibleVisible(ETAPES[etape].cible);
        const rect = element?.getBoundingClientRect() || null;
        setCadre(rect ? {
          top: rect.top - 5,
          left: rect.left - 5,
          width: rect.width + 10,
          height: rect.height + 10,
        } : null);
        setCarte(positionCarte(rect));
      });
    };

    const apresDefilement = window.setTimeout(actualiser, 180);
    actualiser();
    window.addEventListener('resize', actualiser);
    window.addEventListener('scroll', actualiser, true);
    return () => {
      window.clearTimeout(apresDefilement);
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', actualiser);
      window.removeEventListener('scroll', actualiser, true);
    };
  }, [etape, ouvert]);

  useEffect(() => {
    if (!ouvert) return undefined;
    const echap = (event) => {
      if (event.key === 'Escape') fermer();
    };
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [fermer, ouvert]);

  if (!ouvert || !user || !carte) return null;

  const courante = ETAPES[etape];
  const derniere = etape === ETAPES.length - 1;
  const mobile = window.innerWidth < 900;
  const texte = mobile && courante.texteMobile
    ? courante.texteMobile
    : courante.texteDesktop || courante.texte;
  const { placement, ...styleCarte } = carte;

  return (
    <>
      <div className="guide-nouveau-bloqueur" aria-hidden="true" />
      {cadre && <div className="guide-nouveau-cible" style={cadre} aria-hidden="true" />}
      <section
        className="guide-nouveau-carte"
        style={styleCarte}
        data-placement={placement}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-nouveau-titre"
        aria-describedby="guide-nouveau-texte"
      >
        <button type="button" className="guide-nouveau-fermer" onClick={fermer} aria-label="Passer le guide">
          <X size={18} />
        </button>
        <div className="guide-nouveau-compteur">Découverte · {etape + 1}/{ETAPES.length}</div>
        <h2 id="guide-nouveau-titre">{courante.titre}</h2>
        <p id="guide-nouveau-texte">{texte}</p>
        <div className="guide-nouveau-pied">
          <div className="guide-nouveau-points" aria-hidden="true">
            {ETAPES.map((item, index) => (
              <span key={item.cible} className={index === etape ? 'actif' : ''} />
            ))}
          </div>
          <div className="guide-nouveau-actions">
            <button type="button" className="guide-nouveau-passer" onClick={fermer}>Passer</button>
            <button
              type="button"
              className="btn btn-primary guide-nouveau-suivant"
              onClick={() => derniere ? fermer() : setEtape((index) => index + 1)}
            >
              {derniere ? <><Check size={16} /> Terminer</> : <>Suivant <ArrowRight size={16} /></>}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
