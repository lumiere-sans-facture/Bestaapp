import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import ConfirmSheet from './ConfirmSheet';

/**
 * Pied destructif d'un panneau : le bouton « Supprimer » isolé sous un
 * séparateur, avec sa confirmation intégrée (plus aucun window.confirm).
 *
 *   <DangerZone label="Supprimer le cours" message="Modules et leçons seront perdus." onConfirm={remove} />
 */
export default function DangerZone({ label, message, onConfirm }) {
  const [asking, setAsking] = useState(false);
  return (
    <div className="danger-zone">
      <button type="button" className="btn btn-lost btn-block" onClick={() => setAsking(true)}>
        <Trash2 size={16} /> {label}
      </button>
      <ConfirmSheet
        open={asking}
        onClose={() => setAsking(false)}
        onConfirm={onConfirm}
        title={label}
        message={message}
        confirmLabel={label}
        danger
      />
    </div>
  );
}
