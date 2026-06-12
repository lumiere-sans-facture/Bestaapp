import { useState } from 'react';
import { FileText, Plus, Sun, ShoppingCart, PanelTop, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatCFA, formatDate } from '../utils/format';
import PageHeader from '../components/PageHeader';
import ManualWizard from './devis/ManualWizard';
import SolarWizard from './devis/SolarWizard';

export default function Devis() {
  const { user } = useAuth();
  const { devis, getLeadById, getPartnerById, products } = useData();

  // jsPDF est chargé à la demande pour ne pas alourdir le chargement initial
  const downloadPdf = async (d) => {
    const { generateDevisPdf } = await import('../utils/devisPdf');
    generateDevisPdf(d, getLeadById(d.leadId), d.partnerId ? getPartnerById(d.partnerId) : null, products);
  };
  // 'list' | 'choose' | 'solar' | 'manual'
  const [view, setView] = useState('list');

  const myDevis = user.role === 'gerant' ? devis : devis.filter((d) => d.createdBy === user.id);

  const backToList = () => setView('list');

  // ---- Liste des devis ----
  if (view === 'list') {
    return (
      <div className="page">
        <PageHeader
          title="Devis"
          subtitle={`${myDevis.length} devis créé(s)`}
          actions={
            <button className="btn btn-accent" onClick={() => setView('choose')}>
              <Plus size={18} /> Nouveau devis
            </button>
          }
        />
        <div className="page-content">
          {myDevis.length === 0 ? (
            <div className="empty-state card">
              <FileText size={40} strokeWidth={1.5} />
              <p>Aucun devis pour le moment.</p>
              <button className="btn btn-primary" onClick={() => setView('choose')}>
                <Plus size={18} /> Créer un devis
              </button>
            </div>
          ) : (
            <div className="devis-list">
              {myDevis.map((d) => {
                const lead = getLeadById(d.leadId);
                const isSolar = d.type === 'solar';
                return (
                  <div key={d.id} className="card devis-card">
                    <div className="devis-card-header">
                      <div>
                        <div className="devis-card-lead">{lead?.name || 'Client supprimé'}</div>
                        <div className="text-sm text-secondary">
                          {d.devisNumber ? `${d.devisNumber} · ` : ''}{formatDate(d.createdAt)} · {isSolar ? 'Devis solaire' : 'Comptant'}
                        </div>
                        {d.partnerId && (
                          <div className="devis-partner-tag">
                            Partenaire : {getPartnerById(d.partnerId)?.name}
                            {(d.partnerCode || getPartnerById(d.partnerId)?.code) && (
                              <span className="partner-code-chip">{d.partnerCode || getPartnerById(d.partnerId)?.code}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="devis-card-total">{formatCFA(d.total)}</div>
                    </div>
                    <div className="devis-card-meta">
                      {isSolar ? (
                        <span className="devis-type-tag solar"><Sun size={13} /> {d.sizing.numberOfPanels} panneaux · {d.sizing.panelCapacity.toFixed(1)} kWc</span>
                      ) : (
                        <span className="devis-type-tag"><ShoppingCart size={13} /> {d.items.reduce((s, it) => s + it.qty, 0)} article(s)</span>
                      )}
                      <span className="devis-card-actions">
                        <button className="btn btn-sm btn-primary" onClick={() => downloadPdf(d)}>
                          <Download size={14} /> PDF
                        </button>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- Choix du type de devis ----
  if (view === 'choose') {
    return (
      <div className="page">
        <PageHeader
          title="Nouveau devis"
          actions={<button className="btn btn-outline-light" onClick={backToList}>Annuler</button>}
        />
        <div className="page-content">
          <div className="devis-mode-grid">
            <button className="devis-mode-card" onClick={() => setView('solar')}>
              <div className="devis-mode-icon solar"><PanelTop size={26} /></div>
              <div className="devis-mode-title">Dimensionnement solaire</div>
              <div className="devis-mode-desc">Estimez la consommation du client et générez automatiquement le système (panneaux, onduleur, batteries) et son devis chiffré.</div>
            </button>
            <button className="devis-mode-card" onClick={() => setView('manual')}>
              <div className="devis-mode-icon"><ShoppingCart size={26} /></div>
              <div className="devis-mode-title">Sélection manuelle</div>
              <div className="devis-mode-desc">Composez le devis en choisissant directement des produits de la boutique et un mode de paiement.</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Assistants ----
  return (
    <div className="page">
      <PageHeader
        title={view === 'solar' ? 'Devis solaire' : 'Nouveau devis'}
        actions={<button className="btn btn-outline-light" onClick={backToList}>Annuler</button>}
      />
      <div className="page-content">
        {view === 'solar' ? <SolarWizard onDone={backToList} /> : <ManualWizard onDone={backToList} />}
      </div>
    </div>
  );
}
