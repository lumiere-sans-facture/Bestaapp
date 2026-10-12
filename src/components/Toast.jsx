import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

const ToastContext = createContext(() => {});

/**
 * Confirmations éphémères dans le design de l'app (remplace window.alert).
 *
 *   const toast = useToast();
 *   toast('Sauvegarde restaurée.');
 *   toast('Impossible de lire cette image.', { type: 'error' });
 *   toast('Devis téléchargé.', { action: { libelle: 'Ouvrir', onClick: ouvrir } });
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const retirer = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  // `action` : un bouton dans la notification (laissée plus longtemps à
  // l'écran, le temps de le toucher).
  const toast = useCallback((message, { type = 'success', duration, action = null } = {}) => {
    idRef.current += 1;
    const id = idRef.current;
    setToasts((list) => [...list, { id, message, type, action }]);
    setTimeout(() => retirer(id), duration ?? (action ? 8000 : 3500));
  }, [retirer]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            <span className="toast-message">{t.message}</span>
            {t.action && (
              <button type="button" className="toast-action" onClick={() => { retirer(t.id); t.action.onClick(); }}>
                {t.action.libelle}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
