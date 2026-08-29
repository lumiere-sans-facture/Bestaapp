import { ChevronLeft } from 'lucide-react';
import NotificationBell from './NotificationBell';

export default function PageHeader({ title, subtitle, children, actions, onBack }) {
  return (
    <header className="page-header">
      <div className="page-header-inner">
        {onBack && (
          <button className="page-back-icon" onClick={onBack} aria-label="Retour">
            <ChevronLeft size={22} />
          </button>
        )}
        <div className="page-header-text">
          <h1 className="page-title">{title}</h1>
          {subtitle && <div className="page-subtitle">{subtitle}</div>}
          {children}
        </div>
        <div className="page-header-actions">
          {actions}
          {/* Sur grand écran, la cloche vit au coin de la barre latérale : ici
              elle ferait doublon, une même alerte à deux endroits de l'écran.
              Sur mobile il n'y a pas de barre latérale — elle reste donc. */}
          <span className="page-header-bell"><NotificationBell /></span>
        </div>
      </div>
    </header>
  );
}
