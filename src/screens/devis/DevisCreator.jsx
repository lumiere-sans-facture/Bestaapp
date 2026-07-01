import { useState } from 'react';
import { PanelTop, ShoppingCart } from 'lucide-react';
import ManualWizard from './ManualWizard';
import SolarWizard from './SolarWizard';

/**
 * Flux de création d'un devis, réutilisable partout (écran Devis public ET
 * Espace Pro) : choix du type puis assistant. Même style et même outil de
 * dimensionnement solaire quel que soit le point d'entrée.
 *
 * @param {() => void} onDone            appelé à la création du devis
 * @param {boolean}    startManual       démarre directement sur l'assistant manuel
 * @param {object}     initialManualItems pré-remplissage (ex. panier boutique)
 */
export default function DevisCreator({ onDone, startManual = false, initialManualItems }) {
  const [mode, setMode] = useState(startManual ? 'manual' : 'choose'); // choose | solar | manual

  if (mode === 'solar') return <SolarWizard onDone={onDone} />;
  if (mode === 'manual') return <ManualWizard onDone={onDone} initialItems={initialManualItems} />;

  return (
    <div className="devis-mode-grid">
      <button className="devis-mode-card" onClick={() => setMode('solar')}>
        <div className="devis-mode-icon solar"><PanelTop size={26} /></div>
        <div className="devis-mode-title">Dimensionnement solaire</div>
        <div className="devis-mode-desc">Estimez la consommation du client et générez automatiquement le système (panneaux, onduleur, batteries) et son devis chiffré.</div>
      </button>
      <button className="devis-mode-card" onClick={() => setMode('manual')}>
        <div className="devis-mode-icon"><ShoppingCart size={26} /></div>
        <div className="devis-mode-title">Sélection manuelle</div>
        <div className="devis-mode-desc">Composez le devis en choisissant directement des produits de la boutique et un mode de paiement.</div>
      </button>
    </div>
  );
}
