import { useState } from 'react';
import { Phone, MapPin, Plus, Clock, Trophy, ThumbsDown, RotateCcw, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatCFA, formatDate } from '../utils/format';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';

const STALE_DAYS = 5;

const daysSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

// Étapes ouvertes uniquement : « Gagné » est une issue, pas une colonne
const isOpen = (lead) => lead.stage !== 'gagne' && lead.stage !== 'perdu';

export default function Pipeline() {
  const { user } = useAuth();
  const {
    stages, lostStage, team,
    leadsForUser, getPartnerById, getUserById,
    updateLeadStage, addLead, addLeadNote,
  } = useData();

  const openStages = stages.filter((s) => s.id !== 'gagne');

  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [draggedLeadId, setDraggedLeadId] = useState(null);
  const [dragOverZone, setDragOverZone] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [newLead, setNewLead] = useState({ name: '', contact: '', phone: '', address: '', estimatedValue: '', notes: '' });

  const allMyLeads = leadsForUser(user);
  const myLeads = ownerFilter === 'all' ? allMyLeads : allMyLeads.filter((l) => l.assignedTo === ownerFilter);
  const selectedLead = allMyLeads.find((l) => l.id === selectedLeadId);

  const openValue = myLeads.filter(isOpen).reduce((sum, l) => sum + l.estimatedValue, 0);
  const wonLeads = myLeads.filter((l) => l.stage === 'gagne');
  const lostCount = myLeads.filter((l) => l.stage === 'perdu').length;
  const wonValue = wonLeads.reduce((sum, l) => sum + l.estimatedValue, 0);

  const handleDrop = (stageId) => {
    if (draggedLeadId) updateLeadStage(draggedLeadId, stageId);
    setDraggedLeadId(null);
    setDragOverZone(null);
  };

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

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    addLeadNote(selectedLead.id, noteText.trim(), user.id);
    setNoteText('');
  };

  return (
    <div className="page">
      <PageHeader
        title="Pipeline"
        actions={
          <>
            {user.role === 'gerant' && (
              <select className="input select-filter" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} aria-label="Filtrer par commercial">
                <option value="all">Toute l'équipe</option>
                {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            <button className="btn btn-accent" onClick={() => setShowAddForm(true)}>
              <Plus size={18} /> Nouvelle piste
            </button>
          </>
        }
      >
        <div className="pipeline-stats">
          <div className="pipeline-stat"><strong>{formatCFA(openValue)}</strong> en cours</div>
          <div className="pipeline-stat"><strong>{formatCFA(wonValue)}</strong> gagné</div>
          {lostCount > 0 && <div className="pipeline-stat"><strong>{lostCount}</strong> perdu(s)</div>}
        </div>
      </PageHeader>

      <div className="page-content page-content-flush">
        <div className="kanban-container">
          {openStages.map((stage) => {
            const stageLeads = myLeads.filter((l) => l.stage === stage.id);
            const stageValue = stageLeads.reduce((sum, l) => sum + l.estimatedValue, 0);
            return (
              <div
                key={stage.id}
                className={`kanban-column ${dragOverZone === stage.id ? 'drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverZone(stage.id); }}
                onDragLeave={() => setDragOverZone((z) => (z === stage.id ? null : z))}
                onDrop={() => handleDrop(stage.id)}
              >
                <div className="kanban-column-header" style={{ borderTopColor: stage.color }}>
                  <div className="kanban-column-title">
                    <span>{stage.label}</span>
                    <span className="kanban-column-count">{stageLeads.length}</span>
                  </div>
                  <div className="kanban-column-summary">{formatCFA(stageValue)} · {stageLeads.length} affaire{stageLeads.length > 1 ? 's' : ''}</div>
                </div>
                <div className="kanban-column-body">
                  {stageLeads.map((lead) => {
                    const stale = daysSince(lead.lastActivity) > STALE_DAYS;
                    const owner = getUserById(lead.assignedTo);
                    return (
                      <div
                        key={lead.id}
                        className={`kanban-card ${draggedLeadId === lead.id ? 'dragging' : ''}`}
                        draggable
                        onDragStart={() => setDraggedLeadId(lead.id)}
                        onDragEnd={() => { setDraggedLeadId(null); setDragOverZone(null); }}
                        onClick={() => setSelectedLeadId(lead.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setSelectedLeadId(lead.id)}
                      >
                        <div className="kanban-card-title">{lead.name}</div>
                        <div className="kanban-card-contact">{lead.contact}</div>
                        <div className="kanban-card-footer">
                          <span className="kanban-card-value">{formatCFA(lead.estimatedValue)}</span>
                          <span className="kanban-card-icons">
                            {stale && (
                              <span className="stale-indicator" title={`Inactive depuis ${daysSince(lead.lastActivity)} jours`}>
                                <Clock size={13} />
                              </span>
                            )}
                            {user.role === 'gerant' && owner && (
                              <span className="assignee-avatar" title={owner.name}>{owner.avatar}</span>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {stageLeads.length === 0 && <div className="kanban-empty">Déposez une carte ici</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Zones de dépôt Gagné / Perdu visibles pendant le glissement */}
      {draggedLeadId && (
        <div className="drag-zones">
          <div
            className={`drag-zone drag-zone-lost ${dragOverZone === 'perdu' ? 'active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOverZone('perdu'); }}
            onDragLeave={() => setDragOverZone((z) => (z === 'perdu' ? null : z))}
            onDrop={() => handleDrop('perdu')}
          >
            <ThumbsDown size={20} /> PERDU
          </div>
          <div
            className={`drag-zone drag-zone-won ${dragOverZone === 'gagne' ? 'active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOverZone('gagne'); }}
            onDragLeave={() => setDragOverZone((z) => (z === 'gagne' ? null : z))}
            onDrop={() => handleDrop('gagne')}
          >
            <Trophy size={20} /> GAGNÉ
          </div>
        </div>
      )}

      {/* Fiche affaire */}
      <Sheet
        open={!!selectedLead}
        onClose={() => setSelectedLeadId(null)}
        title={selectedLead?.name}
        subtitle={selectedLead && `${selectedLead.contact} · ${formatCFA(selectedLead.estimatedValue)}`}
      >
        {selectedLead && (
          <>
            {isOpen(selectedLead) ? (
              <>
                <div className="stage-stepper">
                  {openStages.map((stage, i) => {
                    const currentIndex = openStages.findIndex((s) => s.id === selectedLead.stage);
                    return (
                      <button
                        key={stage.id}
                        className={`stage-step ${i <= currentIndex ? 'reached' : ''} ${selectedLead.stage === stage.id ? 'current' : ''}`}
                        onClick={() => updateLeadStage(selectedLead.id, stage.id)}
                        title={stage.label}
                      >
                        {stage.label}
                      </button>
                    );
                  })}
                </div>
                <div className="outcome-actions">
                  <button className="btn btn-won" onClick={() => updateLeadStage(selectedLead.id, 'gagne')}>
                    <Trophy size={16} /> Gagné
                  </button>
                  <button className="btn btn-lost" onClick={() => updateLeadStage(selectedLead.id, 'perdu')}>
                    <ThumbsDown size={16} /> Perdu
                  </button>
                </div>
              </>
            ) : (
              <div className={`outcome-banner ${selectedLead.stage === 'gagne' ? 'won' : 'lost'}`}>
                <span className="outcome-banner-label">
                  {selectedLead.stage === 'gagne' ? <><Trophy size={16} /> Affaire gagnée le {formatDate(selectedLead.wonAt)}</> : <><ThumbsDown size={16} /> Affaire perdue le {formatDate(selectedLead.lostAt)}</>}
                </span>
                <button className="btn btn-sm btn-outline" onClick={() => updateLeadStage(selectedLead.id, 'negociation')}>
                  <RotateCcw size={14} /> Rouvrir
                </button>
              </div>
            )}

            <div className="sheet-section">
              <div className="sheet-section-title">Contact</div>
              <div className="sheet-row">
                <span className="sheet-label"><Phone size={14} /> Téléphone</span>
                <a className="sheet-value sheet-link" href={`tel:${selectedLead.phone.replace(/\s/g, '')}`}>{selectedLead.phone}</a>
              </div>
              <div className="sheet-row"><span className="sheet-label"><MapPin size={14} /> Adresse</span><span className="sheet-value">{selectedLead.address}</span></div>
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

            <div className="sheet-section">
              <div className="sheet-section-title">Notes et activités</div>
              <form className="note-form" onSubmit={handleAddNote}>
                <input
                  className="input"
                  placeholder="Ajouter une note…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
                <button type="submit" className="btn btn-primary note-submit" disabled={!noteText.trim()} aria-label="Enregistrer la note">
                  <Send size={16} />
                </button>
              </form>
              <div className="activity-timeline">
                {(selectedLead.activities || []).map((act) => (
                  <div key={act.id} className="activity-item">
                    <div className="activity-dot" />
                    <div className="activity-content">
                      <div className="activity-text">{act.text}</div>
                      <div className="activity-meta">
                        {getUserById(act.by)?.name.split(' ')[0] || '—'} · {new Date(act.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </div>
                    </div>
                  </div>
                ))}
                {selectedLead.notes && (
                  <div className="activity-item">
                    <div className="activity-dot" />
                    <div className="activity-content">
                      <div className="activity-text">{selectedLead.notes}</div>
                      <div className="activity-meta">Note initiale · {formatDate(selectedLead.createdAt)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
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
