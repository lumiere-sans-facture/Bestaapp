import { useData } from '../context/DataContext';

const SYNC_LABELS = {
  online: ['sync-online', 'Données partagées en temps réel'],
  connecting: ['sync-connecting', 'Connexion au serveur…'],
  error: ['sync-error', 'Serveur injoignable — données locales'],
  local: ['sync-local', 'Mode local — données sur cet appareil'],
};

export function SyncDot() {
  const { syncStatus, syncError } = useData();
  const [cls, label] = SYNC_LABELS[syncStatus] || SYNC_LABELS.local;
  // Le motif exact est porté par l'infobulle : « Serveur injoignable » seul
  // n'a jamais permis de diagnostiquer quoi que ce soit.
  const titre = syncError ? `${label}\n${syncError}` : label;
  return <span className={`sync-dot ${cls}`} title={titre} aria-label={label} />;
}

export function SyncStatusRow() {
  const { syncStatus, syncError } = useData();
  const [cls, label] = SYNC_LABELS[syncStatus] || SYNC_LABELS.local;
  return (
    <div className="sync-status-row">
      <div className="sync-status-line">
        <span className={`sync-dot ${cls}`} />
        <span>{label}</span>
      </div>
      {/* Détail lisible sans ouvrir la console du navigateur. */}
      {syncError && <div className="sync-status-detail">{syncError}</div>}
    </div>
  );
}
