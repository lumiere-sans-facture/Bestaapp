import { useState } from 'react';
import { User, Phone, MapPin, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatCFA } from '../utils/format';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';

export default function Pipeline() {
  const { user } = useAuth();
  const { stages, leadsForUser, getPartnerById, getUserById, updateLeadStage, addLead, team } = useData();
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', contact: '', phone: '', address: '', estimatedValue: '', notes: '' });

  const myLeads = leadsForUser(user);
  const selectedLead = myLeads.find((l) => l.id === selectedLeadId);
  const pipelineValue = myLeads.filter((l) => l.stage !== 'gagne').reduce((sum, l) => sum + l.estimatedValue, 0);
  const wonValue = myLeads.filter((l) => l.stage === 'gagne').reduce((sum, l) => sum + l.estimatedValue, 0);

  const handleAddLead = (e) => {
    e.preventDefault();
    addLead({
      ...newLead,
      estimatedValue: Number(newLead.estimatedValue) || 0,
      assignedTo: user.id,
      parrainL1: null,
      parrainL2: null,
    });
    setNewLead({ name: '', contact: '', phone: '', address: '', estimatedValue: '', notes: '' });
    setShowAddForm(false);
  };

  return (
    <div className="page">
      <PageHeader
        title="Pipeline"
        actions={
          <button className="btn btn-accent" onClick={() => setShowAddForm(true)}>
            <Plus size={18} /> Nouvelle piste
          </button>
        }
      >
        <div className="pipeline-stats">
          <div className="pipeline-stat"><strong>{formatCFA(pipelineValue)}</strong> en cours</div>
          <div className="pipeline-stat"><strong>{formatCFA(wonValue)}</strong> gagné</div>
        </div>
      </PageHeader>

      <div className="page-content page-content-flush">
        <div className="kanban-container">
          {stages.map((stage) => {
            const stageLeads = myLeads.filter((l) => l.stage === stage.id);
            return (
              <div key={stage.id} className="kanban-column">
                <div className="kanban-column-header">
                  <span style={{ color: stage.color }}>{stage.label}</span>
                  <span className="kanban-column-count">{stageLeads.length}</span>
                </div>
                <div className="kanban-column-body">
                  {stageLeads.map((lead) => (
                    <button key={lead.id} className={`kanban-card stage-${lead.stage}`} onClick={() => setSelectedLeadId(lead.id)}>
                      <div className="kanban-card-header">
                        <div className="kanban-card-title">{lead.name}</div>
                        <div className="kanban-card-value">{formatCFA(lead.estimatedValue)}</div>
                      </div>
                      <div className="kanban-card-meta">
                        <div className="kanban-card-contact"><User size={12} /><span>{lead.contact}</span></div>
                        {user.role === 'gerant' && (
                          <div className="kanban-card-assignee">
                            <span className="assignee-avatar">{getUserById(lead.assignedTo)?.avatar || '??'}</span>
                            <span>{getUserById(lead.assignedTo)?.name.split(' ')[0]}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                  {stageLeads.length === 0 && <div className="kanban-empty">Aucune piste</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Détail d'une piste */}
      <Sheet
        open={!!selectedLead}
        onClose={() => setSelectedLeadId(null)}
        title={selectedLead?.name}
        subtitle={selectedLead?.contact}
      >
        {selectedLead && (
          <>
            <div className="sheet-section">
              <div className="sheet-section-title">Étape</div>
              <div className="stage-selector">
                {stages.map((stage) => (
                  <button
                    key={stage.id}
                    className={`stage-chip ${selectedLead.stage === stage.id ? 'active' : ''}`}
                    style={selectedLead.stage === stage.id ? { background: stage.color, borderColor: stage.color } : { color: stage.color }}
                    onClick={() => updateLeadStage(selectedLead.id, stage.id)}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="sheet-section">
              <div className="sheet-section-title">Contact</div>
              <div className="sheet-row"><span className="sheet-label"><Phone size={14} /> Téléphone</span><span className="sheet-value">{selectedLead.phone}</span></div>
              <div className="sheet-row"><span className="sheet-label"><MapPin size={14} /> Adresse</span><span className="sheet-value">{selectedLead.address}</span></div>
            </div>
            <div className="sheet-section">
              <div className="sheet-section-title">Affaire</div>
              <div className="sheet-row"><span className="sheet-label">Valeur estimée</span><span className="sheet-value amount">{formatCFA(selectedLead.estimatedValue)}</span></div>
              {user.role === 'gerant' && (
                <div className="sheet-row"><span className="sheet-label">Assignée à</span><span className="sheet-value">{getUserById(selectedLead.assignedTo)?.name}</span></div>
              )}
            </div>
            {(selectedLead.parrainL1 || selectedLead.parrainL2) && (
              <div className="sheet-section">
                <div className="sheet-section-title">Chaîne de parrainage</div>
                <div className="referral-chain">
                  {selectedLead.parrainL1 && (
                    <>
                      <div className="referral-level referral-level-1">
                        <div className="referral-level-icon">L1</div>
                        <div className="referral-level-info">
                          <div className="referral-level-name">{getPartnerById(selectedLead.parrainL1)?.name}</div>
                          <div className="referral-level-commission">Commission : {formatCFA(Math.round(selectedLead.estimatedValue * 0.03))}</div>
                        </div>
                      </div>
                      {selectedLead.parrainL2 && <div className="referral-connector" />}
                    </>
                  )}
                  {selectedLead.parrainL2 && (
                    <div className="referral-level referral-level-2">
                      <div className="referral-level-icon">L2</div>
                      <div className="referral-level-info">
                        <div className="referral-level-name">{getPartnerById(selectedLead.parrainL2)?.name}</div>
                        <div className="referral-level-commission">Commission : {formatCFA(Math.round(selectedLead.estimatedValue * 0.015))}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {selectedLead.notes && (
              <div className="sheet-section">
                <div className="sheet-section-title">Notes</div>
                <div className="text-sm text-secondary">{selectedLead.notes}</div>
              </div>
            )}
          </>
        )}
      </Sheet>

      {/* Formulaire nouvelle piste */}
      <Sheet open={showAddForm} onClose={() => setShowAddForm(false)} title="Nouvelle piste">
        <form onSubmit={handleAddLead} className="form-grid">
          <div className="input-group">
            <label className="input-label">Entreprise / Client *</label>
            <input className="input" required value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} placeholder="Ex : Hôtel du Parc" />
          </div>
          <div className="input-group">
            <label className="input-label">Personne de contact *</label>
            <input className="input" required value={newLead.contact} onChange={(e) => setNewLead({ ...newLead, contact: e.target.value })} placeholder="Ex : M. Kossi Agboka" />
          </div>
          <div className="input-group">
            <label className="input-label">Téléphone</label>
            <input className="input" type="tel" value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} placeholder="+229 ..." />
          </div>
          <div className="input-group">
            <label className="input-label">Adresse</label>
            <input className="input" value={newLead.address} onChange={(e) => setNewLead({ ...newLead, address: e.target.value })} placeholder="Quartier, ville" />
          </div>
          <div className="input-group">
            <label className="input-label">Valeur estimée (F CFA)</label>
            <input className="input" type="number" min="0" value={newLead.estimatedValue} onChange={(e) => setNewLead({ ...newLead, estimatedValue: e.target.value })} placeholder="0" />
          </div>
          <div className="input-group">
            <label className="input-label">Notes</label>
            <textarea className="input" rows="3" value={newLead.notes} onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })} placeholder="Détails du besoin…" />
          </div>
          <button type="submit" className="btn btn-primary btn-block"><Plus size={18} /> Créer la piste</button>
        </form>
      </Sheet>
    </div>
  );
}
