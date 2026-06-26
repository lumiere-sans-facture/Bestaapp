import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';

// Sélecteur des éléments focusables (pour le piège à focus).
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Panneau de détail adaptatif : feuille montante sur mobile,
 * fenêtre centrée sur grand écran.
 *
 * Accessibilité : modale (role=dialog, aria-modal), libellée par son titre,
 * fermeture au clavier (Échap), focus piégé à l'intérieur et restauré à
 * l'élément déclencheur à la fermeture.
 */
export default function Sheet({ open, onClose, title, subtitle, children, footer }) {
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef(null);
  const previouslyFocused = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (open) {
      const t = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(t);
    }
    setVisible(false);
  }, [open]);

  // Verrou de défilement + clavier (Échap, piège à focus) + gestion du focus.
  useEffect(() => {
    if (!open) return;
    // Mémorise l'élément déclencheur pour y restaurer le focus à la fermeture.
    previouslyFocused.current = document.activeElement;
    const node = sheetRef.current;
    // Place le focus dans la modale (le conteneur, qui annonce le titre).
    node?.focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      // Piège à focus : Tab/Shift+Tab boucle à l'intérieur de la modale.
      const items = node.querySelectorAll(FOCUSABLE);
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      // Restaure le focus là où l'utilisateur l'avait (si l'élément existe encore).
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className={`sheet-overlay ${visible ? 'active' : ''}`} onClick={onClose} />
      <div
        ref={sheetRef}
        className={`sheet ${visible ? 'active' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div>
            {title && <div className="sheet-title" id={titleId}>{title}</div>}
            {subtitle && <div className="sheet-subtitle">{subtitle}</div>}
          </div>
          <button className="sheet-close" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </>
  );
}
