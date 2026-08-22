import { useState } from 'react';
import { useData } from '../context/DataContext';

const SYNC_LABELS = {
  online: ['sync-online', 'Données partagées en temps réel'],
  connecting: ['sync-connecting', 'Connexion au serveur…'],
  // Coupure réseau ordinaire : le travail continue et repartira tout seul.
  // Distinguée du refus serveur, qui, lui, demande une intervention — les
  // confondre rendait le voyant rouge permanent sur le terrain, donc ignoré.
  offline: ['sync-offline', 'Hors ligne — le travail est enregistré ici'],
  error: ['sync-error', 'Serveur injoignable — données locales'],
  local: ['sync-local', 'Mode local — données sur cet appareil'],
};

/** « 3 éléments en attente d'envoi », au singulier près. */
const texteAttente = (n) => `${n} élément${n > 1 ? 's' : ''} en attente d’envoi`;

export function SyncDot() {
  const { syncStatus, syncError, enAttente } = useData();
  const [cls, label] = SYNC_LABELS[syncStatus] || SYNC_LABELS.local;
  // Le motif exact est porté par l'infobulle : « Serveur injoignable » seul
  // n'a jamais permis de diagnostiquer quoi que ce soit.
  const lignes = [label];
  if (enAttente > 0) lignes.push(texteAttente(enAttente));
  if (syncError) lignes.push(syncError);
  return <span className={`sync-dot ${cls}`} title={lignes.join('\n')} aria-label={label} />;
}

export function SyncStatusRow() {
  const { syncStatus, syncError, enAttente, synchroniserMaintenant } = useData();
  const [cls, label] = SYNC_LABELS[syncStatus] || SYNC_LABELS.local;
  // Le motif de l'échec doit pouvoir être TRANSMIS (support, dépannage) :
  // sur mobile comme sur PC, le recopier à la main est illusoire.
  const [copie, setCopie] = useState(false);
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(syncError);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch { /* presse-papiers refusé : le texte reste sélectionnable à l'écran */ }
  };
  // Le bouton n'a de sens qu'avec un serveur configuré : en mode local, il n'y
  // a rien à joindre et rien n'attend jamais.
  const relancable = syncStatus !== 'local';
  return (
    <div className="sync-status-row">
      <div className="sync-status-line">
        <span className={`sync-dot ${cls}`} />
        <span>{label}</span>
      </div>
      {/* Ce qui reste à envoyer : sans ce compte, « hors ligne » ne dit pas
          si le travail de la journée est parti ou non. */}
      {enAttente > 0 && (
        <div className="sync-status-attente">
          <span>{texteAttente(enAttente)}</span>
          {relancable && (
            <button type="button" className="btn btn-sm btn-outline sync-status-copy" onClick={synchroniserMaintenant}>
              Synchroniser maintenant
            </button>
          )}
        </div>
      )}
      {/* Détail lisible sans ouvrir la console du navigateur — réservé aux
          vrais refus. Une coupure réseau n'a pas de motif à rapporter : y
          afficher « Failed to fetch » et un bouton « Copier » donnait à
          l'ordinaire du terrain l'allure d'une panne à signaler. */}
      {syncError && syncStatus !== 'offline' && (
        <div className="sync-status-detail">
          <span className="sync-status-detail-text">{syncError}</span>
          <button type="button" className="btn btn-sm btn-outline sync-status-copy" onClick={copier}>
            {copie ? 'Copié' : 'Copier le détail'}
          </button>
        </div>
      )}
    </div>
  );
}
