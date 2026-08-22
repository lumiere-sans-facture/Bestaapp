import SkeletonPageContent from './SkeletonPageContent';

/**
 * Écran affiché pendant la résolution de la session (AuthContext.isLoading) —
 * avant même de savoir si un compte est connecté, donc sans navigation ni
 * données réelles disponibles. Reprend la forme de l'app (barre latérale,
 * en-tête bleu, barre d'onglets) plutôt qu'un plein écran « Chargement… » :
 * la structure reste visible tout de suite, seul le contenu se dessine en
 * squelette animé — l'utilisateur ne perd jamais ses repères au rafraîchissement.
 */
export default function LoadingShell() {
  return (
    <div className="app-shell" role="status" aria-live="polite">
      <span className="sr-only">Chargement…</span>
      <aside className="sidebar" aria-hidden="true">
        <div className="sidebar-brand">
          <span className="skeleton skeleton-inverse" style={{ width: 150, height: 30 }} />
        </div>
        <nav className="sidebar-nav">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="sidebar-link">
              <span className="skeleton skeleton-inverse" style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0 }} />
              <span className="skeleton skeleton-inverse" style={{ width: '65%', height: 13 }} />
            </div>
          ))}
        </nav>
      </aside>

      <main className="app-main">
        <header className="page-header">
          <div className="page-header-inner">
            <div className="page-header-text">
              <span className="skeleton skeleton-inverse" style={{ width: 180, height: 22 }} />
            </div>
          </div>
        </header>
        <SkeletonPageContent />
      </main>

      <nav className="tab-bar" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="tab-item">
            <span className="skeleton" style={{ width: 22, height: 22, borderRadius: 6 }} />
          </div>
        ))}
      </nav>
    </div>
  );
}
