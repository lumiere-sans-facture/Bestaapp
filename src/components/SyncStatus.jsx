import { useData } from '../context/DataContext';

const SYNC_LABELS = {
  online: ['sync-online', 'Données partagées en temps réel'],
  connecting: ['sync-connecting', 'Connexion au serveur…'],
  error: ['sync-error', 'Serveur injoignable — données locales'],
  local: ['sync-local', 'Mode local — données sur cet appareil'],
};

export function SyncDot() {
  const { syncStatus } = useData();
  const [cls, label] = SYNC_LABELS[syncStatus] || SYNC_LABELS.local;
  return <span className={`sync-dot ${cls}`} title={label} aria-label={label} />;
}

export function SyncStatusRow() {
  const { syncStatus } = useData();
  const [cls, label] = SYNC_LABELS[syncStatus] || SYNC_LABELS.local;
  return (
    <div className="sync-status-row">
      <span className={`sync-dot ${cls}`} />
      <span>{label}</span>
    </div>
  );
}
