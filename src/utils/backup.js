// Sauvegarde / restauration des données métier. Permet d'exporter toutes les
// collections dans un fichier JSON et de les réimporter (disaster recovery,
// changement d'appareil). Indépendant du backend : marche en local comme en sync.
import { SYNCED_COLLECTIONS } from '../lib/remoteSync';

const COUNTERS = ['devisCounter', 'orderCounter'];
const BACKUP_KEYS = [...SYNCED_COLLECTIONS, ...COUNTERS];
export const BACKUP_MARKER = 'bestasolar-pro';

/** Construit l'objet de sauvegarde à partir de l'état courant. */
export const buildBackup = (state, exportedAt) => ({
  app: BACKUP_MARKER,
  version: state.version,
  exportedAt,
  data: Object.fromEntries(BACKUP_KEYS.map((k) => [k, state[k]])),
});

/** Vrai si l'objet a la forme d'une sauvegarde BestaSolar valide. */
export const isValidBackup = (obj) =>
  !!obj &&
  obj.app === BACKUP_MARKER &&
  !!obj.data &&
  SYNCED_COLLECTIONS.every((k) => obj.data[k] === undefined || Array.isArray(obj.data[k]));

/** Extrait de la sauvegarde uniquement les clés connues (collections + compteurs). */
export const extractState = (backup) => {
  const out = {};
  for (const k of BACKUP_KEYS) if (backup?.data?.[k] !== undefined) out[k] = backup.data[k];
  return out;
};

// ---- Ponts navigateur (non purs : I/O fichier) ----

/** Déclenche le téléchargement d'un fichier JSON de sauvegarde. */
export const downloadBackup = (state, now = new Date()) => {
  const backup = buildBackup(state, now.toISOString());
  const stamp = now.toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bestasolar-sauvegarde-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

/** Lit un fichier de sauvegarde et résout l'objet validé (rejette sinon). */
export const readBackupFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!isValidBackup(obj)) return reject(new Error('Fichier de sauvegarde invalide ou non reconnu.'));
        resolve(obj);
      } catch {
        reject(new Error('Fichier illisible (JSON invalide).'));
      }
    };
    reader.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    reader.readAsText(file);
  });
