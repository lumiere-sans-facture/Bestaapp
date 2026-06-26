/**
 * État vide réutilisable : rendu cohérent quand une liste n'a aucun élément.
 * Conserve la classe `.empty-state` existante (rendu identique pour le cas
 * texte seul). Un icône optionnel et la variante `card` (encadré) sont gérés.
 *
 *   <EmptyState card>Aucun devis ne correspond à votre recherche.</EmptyState>
 *   <EmptyState icon={Receipt} card>Aucune commande pour l'instant.</EmptyState>
 */
export default function EmptyState({ icon: Icon, card = false, children }) {
  return (
    <div className={`empty-state${card ? ' card' : ''}`}>
      {Icon && <Icon size={28} className="empty-state-icon" aria-hidden="true" />}
      {children}
    </div>
  );
}
