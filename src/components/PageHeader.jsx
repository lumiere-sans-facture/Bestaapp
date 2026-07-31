import { ChevronLeft } from 'lucide-react';

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
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
    </header>
  );
}
