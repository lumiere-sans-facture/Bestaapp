/**
 * Squelette générique de contenu de page (bandeau de stats + carte) —
 * utilisé par LoadingShell (session en cours de résolution) et par le
 * `Suspense` de AppLayout (chargement d'un écran) : dans les deux cas,
 * la barre latérale et l'en-tête sont déjà en place, seul le contenu
 * manque encore.
 */
export default function SkeletonPageContent() {
  return (
    <div className="page-content" aria-hidden="true">
      <div className="stat-strip">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="stat-pill">
            <span className="skeleton" style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0 }} />
            <span className="skeleton" style={{ width: '70%', height: 11 }} />
          </div>
        ))}
      </div>
      <div className="card">
        <span className="skeleton" style={{ width: '35%', height: 15, marginBottom: 16 }} />
        <span className="skeleton" style={{ width: '100%', height: 110 }} />
      </div>
    </div>
  );
}
