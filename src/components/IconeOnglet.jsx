// Icône d'un onglet de la barre mobile. L'onglet central (« Devis ») porte un
// « + » sur une pastille pleine : l'action principale de l'app, au milieu,
// sous le pouce. Partagé avec LoadingShell : la barre affichée pendant le
// chargement est exactement la vraie.
export default function IconeOnglet({ item }) {
  const Icone = item.iconeOnglet || item.icon;
  if (!item.central) return <Icone size={22} strokeWidth={2} />;
  return (
    <span className="tab-pastille" aria-hidden="true">
      <Icone size={24} strokeWidth={2.5} />
    </span>
  );
}
