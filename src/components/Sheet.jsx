import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

/**
 * Panneau de détail adaptatif : feuille montante sur mobile,
 * fenêtre centrée sur grand écran.
 */
export default function Sheet({ open, onClose, title, subtitle, children, footer }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      const t = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(t);
    }
    setVisible(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className={`sheet-overlay ${visible ? 'active' : ''}`} onClick={onClose} />
      <div className={`sheet ${visible ? 'active' : ''}`} role="dialog" aria-modal="true">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div>
            {title && <div className="sheet-title">{title}</div>}
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
