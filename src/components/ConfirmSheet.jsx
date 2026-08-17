import Sheet from './Sheet';

/**
 * Confirmation dans le design de l'app (remplace window.confirm) : mêmes
 * garanties que Sheet (focus, Échap, overlay), action destructive marquée.
 *
 *   <ConfirmSheet
 *     open={!!aSupprimer}
 *     title="Supprimer ce produit"
 *     message="Le produit sera retiré du catalogue."
 *     confirmLabel="Supprimer"
 *     danger
 *     onConfirm={() => remove(aSupprimer)}
 *     onClose={() => setASupprimer(null)}
 *   />
 */
export default function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title = 'Confirmer',
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  danger = false,
}) {
  return (
    <Sheet
      open={!!open}
      onClose={onClose}
      title={title}
      footer={
        <div className="form-actions" style={{ marginTop: 0 }}>
          <button
            className={`btn btn-block ${danger ? 'btn-lost' : 'btn-primary'}`}
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
          <button className="btn btn-outline" onClick={onClose}>
            {cancelLabel}
          </button>
        </div>
      }
    >
      {message && <p className="text-sm">{message}</p>}
    </Sheet>
  );
}
