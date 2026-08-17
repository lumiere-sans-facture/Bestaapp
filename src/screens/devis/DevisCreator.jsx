import { useState } from 'react';
import { PanelTop, ShoppingCart, UserCheck, Droplets } from 'lucide-react';
import { useData } from '../../context/DataContext';
import ManualWizard from './ManualWizard';
import SolarWizard from './SolarWizard';
import PompeWizard from './PompeWizard';

/**
 * Flux de création d'un devis, réutilisable partout (écran Devis public ET
 * Espace Pro) : choix du type puis assistant. Même style et même outil de
 * dimensionnement solaire quel que soit le point d'entrée.
 *
 * @param {() => void} onDone            appelé à la création du devis
 * @param {boolean}    startManual       démarre directement sur l'assistant manuel
 * @param {object}     initialManualItems pré-remplissage (ex. panier boutique)
 * @param {string}     initialLeadId     client présélectionné (ex. fiche client) —
 *                                       l'étape de sélection du client est sautée
 * @param {object}     devisAModifier    étude solaire déjà enregistrée, rouverte
 *                                       pour ajustement (le devis est mis à jour)
 */
export default function DevisCreator({ onDone, startManual = false, initialManualItems, initialLeadId = null, devisAModifier = null }) {
  const { getLeadById } = useData();
  const [mode, setMode] = useState(devisAModifier ? 'solar' : startManual ? 'manual' : 'choose'); // choose | solar | pompe | manual
  const initialLead = initialLeadId ? getLeadById(initialLeadId) : null;

  // Le dimensionnement par facture n'a plus sa carte : c'est un simple
  // mode de saisie de la consommation, proposé DANS l'assistant solaire
  // (appareils / saisie directe / facture) — une entrée de moins à choisir.
  if (mode === 'solar') return <SolarWizard onDone={onDone} initialLeadId={initialLeadId} devisAModifier={devisAModifier} />;
  if (mode === 'pompe') return <PompeWizard onDone={onDone} initialLeadId={initialLeadId} />;
  if (mode === 'manual') return <ManualWizard onDone={onDone} initialItems={initialManualItems} initialLeadId={initialLeadId} />;

  return (
    <>
      {initialLead && (
        <div className="devis-client-note">
          <UserCheck size={17} />
          <span>Devis pour <strong>{initialLead.name}</strong> — le client est déjà sélectionné, choisissez le type de devis.</span>
        </div>
      )}
      <div className="devis-mode-grid">
        <button className="devis-mode-card" onClick={() => setMode('solar')}>
          <div className="devis-mode-icon solar"><PanelTop size={26} /></div>
          <div className="devis-mode-title">Dimensionnement solaire</div>
          <div className="devis-mode-desc">Estimez la consommation du client — liste d'appareils, saisie directe ou facture CEET/SBEE — et générez le système (panneaux, onduleur, batteries) et son devis chiffré.</div>
        </button>
        <button className="devis-mode-card" onClick={() => setMode('pompe')}>
          <div className="devis-mode-icon pompe"><Droplets size={26} /></div>
          <div className="devis-mode-title">Pompe solaire</div>
          <div className="devis-mode-desc">Volume d'eau quotidien, profondeur et réservoir : le kit de pompage adapté est suggéré avec son devis complet.</div>
        </button>
        <button className="devis-mode-card" onClick={() => setMode('manual')}>
          <div className="devis-mode-icon"><ShoppingCart size={26} /></div>
          <div className="devis-mode-title">Sélection manuelle</div>
          <div className="devis-mode-desc">Composez le devis en choisissant directement des produits de la boutique et un mode de paiement.</div>
        </button>
      </div>
    </>
  );
}
