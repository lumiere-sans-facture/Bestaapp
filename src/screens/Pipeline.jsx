import { useState } from 'react';
import { User, Phone, MapPin } from 'lucide-react';
import { leads, stages, formatCFA, getPartnerById, getUserById } from '../data/mockData';

export default function Pipeline({ user }) {
  const [selectedLead, setSelectedLead] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const filteredLeads = user.role === 'gerant' ? leads : leads.filter(l => l.assignedTo === user.id);
  const pipelineValue = filteredLeads.filter(l => l.stage !== 'gagne').reduce((sum, l) => sum + l.estimatedValue, 0);
  const wonValue = filteredLeads.filter(l => l.stage === 'gagne').reduce((sum, l) => sum + l.estimatedValue, 0);

  const openLead = (lead) => { setSelectedLead(lead); setIsSheetOpen(true); };
  const closeSheet = () => { setIsSheetOpen(false); setTimeout(() => setSelectedLead(null), 300); };

  return (
    <>
      <div className="pipeline-header">
        <h1 className="screen-title">Pipeline</h1>
        <div className="pipeline-stats">
          <div className="pipeline-stat"><strong>{formatCFA(pipelineValue)}</strong> en cours</div>
          <div className="pipeline-stat"><strong>{formatCFA(wonValue)}</strong> gagné</div>
        </div>
      </div>
      <div className="kanban-container">
        {stages.map(stage => {
          const stageLeads = filteredLeads.filter(l => l.stage === stage.id);
          return (
            <div key={stage.id} className="kanban-column">
              <div className="kanban-column-header">
                <span style={{ color: stage.color }}>{stage.label}</span>
                <span className="kanban-column-count">{stageLeads.length}</span>
              </div>
              {stageLeads.map(lead => (
                <div key={lead.id} className={`kanban-card stage-${lead.stage}`} onClick={() => openLead(lead)}>
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
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {(isSheetOpen || selectedLead) && (
        <>
          <div className={`bottom-sheet-overlay ${isSheetOpen ? 'active' : ''}`} onClick={closeSheet} />
          <div className={`bottom-sheet ${isSheetOpen ? 'active' : ''}`}>
            <div className="bottom-sheet-handle" />
            {selectedLead && (
              <>
                <div className="sheet-header">
                  <div className="sheet-title">{selectedLead.name}</div>
                  <div className="sheet-subtitle">{selectedLead.contact}</div>
                </div>
                <div className="sheet-body">
                  <div className="sheet-section">
                    <div className="sheet-section-title">Contact</div>
                    <div className="sheet-row"><span className="sheet-label"><Phone size={14} /> Téléphone</span><span className="sheet-value">{selectedLead.phone}</span></div>
                    <div className="sheet-row"><span className="sheet-label"><MapPin size={14} /> Adresse</span><span className="sheet-value">{selectedLead.address}</span></div>
                  </div>
                  <div className="sheet-section">
                    <div className="sheet-section-title">Affaire</div>
                    <div className="sheet-row"><span className="sheet-label">Étape</span><span className="sheet-value" style={{ color: stages.find(s => s.id === selectedLead.stage)?.color }}>{stages.find(s => s.id === selectedLead.stage)?.label}</span></div>
                    <div className="sheet-row"><span className="sheet-label">Valeur estimée</span><span className="sheet-value amount">{formatCFA(selectedLead.estimatedValue)}</span></div>
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
                                <div className="referral-level-commission">Commission: {formatCFA(Math.round(selectedLead.estimatedValue * 0.03))}</div>
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
                              <div className="referral-level-commission">Commission: {formatCFA(Math.round(selectedLead.estimatedValue * 0.015))}</div>
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
                </div>
                <div className="sheet-actions">
                  <button className="btn btn-primary btn-block" onClick={closeSheet}>Fermer</button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
