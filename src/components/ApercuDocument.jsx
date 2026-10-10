import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

// Largeur d'une page A4 des documents (utils/docTemplates : 794 px).
const LARGEUR_PAGE = 794;

/** Le document, ramené à la largeur de l'écran, sans la barre « Imprimer ». */
const documentAjuste = (html, largeur) => {
  const zoom = Math.min(1, Math.max(0.2, (largeur - 16) / LARGEUR_PAGE));
  const style = `<style>html{zoom:${zoom.toFixed(3)}}`
    + 'body{padding:12px 0 !important}'
    + '.print-bar{display:none !important}'
    + '.page{margin:0 auto 12px !important;box-shadow:0 1px 6px rgba(0,0,0,.18)}</style>';
  return String(html || '').replace('</head>', `${style}</head>`);
};

/**
 * Aperçu d'un document (devis, facture) DANS l'application : plein écran,
 * barre « ← Retour » en haut, pages à la largeur de l'écran, actions en bas.
 *
 * Il remplace l'onglet séparé (window.open) qui, dans l'application Android,
 * laissait l'utilisateur sur une page sans retour possible. Le bouton
 * « retour » du téléphone le ferme aussi : une entrée d'historique est
 * ajoutée à l'ouverture, et la navigation arrière la consomme.
 *
 * @param {object} p
 * @param {string|null} p.html   document complet (buildDocHtml) ; null = fermé
 * @param {string} p.titre       « Devis BS-… »
 * @param {Function} p.onFermer
 * @param {(fermer: Function) => import('react').ReactNode} [p.actions]
 *   boutons du pied (Télécharger…) ; reçoit `fermer` pour les actions qui
 *   doivent d'abord refermer l'aperçu.
 */
export default function ApercuDocument({ html, titre, onFermer, actions = null }) {
  const ouvert = !!html;
  const [largeur, setLargeur] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : LARGEUR_PAGE));
  const onFermerRef = useRef(onFermer);
  onFermerRef.current = onFermer;
  const retourRef = useRef(null);

  useEffect(() => {
    if (!ouvert) return undefined;
    const surRedimension = () => setLargeur(window.innerWidth);
    window.addEventListener('resize', surRedimension);
    // Retour du téléphone (ou du navigateur) : ferme l'aperçu, ne quitte pas l'écran.
    if (!window.history.state?.apercuDocument) {
      window.history.pushState({ ...(window.history.state || {}), apercuDocument: true }, '');
    }
    const surRetour = () => onFermerRef.current();
    window.addEventListener('popstate', surRetour);
    // Échap ferme l'aperçu seul, pas la fiche ouverte dessous (capture).
    const surTouche = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fermer(); } };
    window.addEventListener('keydown', surTouche, true);
    const precedent = document.activeElement;
    retourRef.current?.focus();
    return () => {
      window.removeEventListener('resize', surRedimension);
      window.removeEventListener('popstate', surRetour);
      window.removeEventListener('keydown', surTouche, true);
      precedent?.focus?.();
    };
  }, [ouvert]);

  // Fermeture à l'écran : on consomme l'entrée d'historique ajoutée à
  // l'ouverture (le « popstate » qui en résulte appelle onFermer).
  const fermer = () => {
    if (window.history.state?.apercuDocument) window.history.back();
    else onFermerRef.current();
  };

  if (!ouvert) return null;
  return (
    <div className="apercu-doc" role="dialog" aria-modal="true" aria-label={`Aperçu — ${titre}`}>
      <div className="apercu-doc-barre">
        <button ref={retourRef} type="button" className="btn btn-outline btn-sm" onClick={fermer}>
          <ArrowLeft size={16} /> Retour
        </button>
        <div className="apercu-doc-titre">{titre}</div>
      </div>
      {/* Même origine (polices du document), aucun script exécuté. */}
      <iframe className="apercu-doc-cadre" title={`Aperçu — ${titre}`} sandbox="allow-same-origin" srcDoc={documentAjuste(html, largeur)} />
      {actions && <div className="apercu-doc-actions">{actions(fermer)}</div>}
    </div>
  );
}
