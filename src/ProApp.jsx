import { useMode } from './context/ModeContext';
import PageHeader from './components/PageHeader';
import DevisProSection from './screens/plus/DevisProSection';

// Espace Pro — coquille dédiée rendue EXCLUSIVEMENT lorsque mode === 'pro'.
// Aucune route ni composant de l'app publique (tableau de bord, suivi clients,
// devis publics…) n'est monté ici : zéro fuite de données entre les deux vues.
// Le bouton « Retour » de DevisProSection ramène au mode public.
export default function ProApp() {
  const { setMode } = useMode();

  return (
    <div className="page">
      <PageHeader title="Espace Pro" />
      <div className="page-content page-content-narrow">
        <DevisProSection onBack={() => setMode('public')} />
      </div>
    </div>
  );
}
