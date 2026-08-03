import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Phone, MapPin, Plus, Clock, Trophy, ThumbsDown, RotateCcw, Send, User, Building2, Check, X, Hourglass, MoreVertical, ArrowRightLeft, FileText, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { fetchAdminPublicPipeline, fetchPendingProgressions, decideProgression, setProgression } from '../lib/remoteSync';
import { formatCFA, formatDate } from '../utils/format';
import { daysSince } from '../utils/date';
import { buildAffaires } from '../utils/affaires';
import { peutValiderProgression } from '../utils/roles';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';
import Field from '../components/Field';

const STALE_DAYS = 5;

// Étapes ouvertes uniquement : « Gagné » est une issue, pas une colonne
const isOpen = (aff) => aff.stage !== 'gagne' && aff.stage !== 'perdu';

export default function Pipeline() {
  const { user } = useAuth();
  const {
    stages, lostStage, team, commissions, devis,
    leadsForUser, getPartnerById, getUserById,
    updateLeadStage, requestStageChange, approveStageChange, rejectStageChange,
    updateDevisStage, requestDevisStageChange, approveDevisStageChange, rejectDevisStageChange,
    addLead, addLeadNote,
  } = useData();

  // Commission du client : réelle dès qu'une existe (par piste ou par devis),
  // sinon estimation au taux du niveau.
  const renderCommissionInfo = (aff, partnerId, level, rate) => {
    const commission = commissions.find((c) =>
      c.partnerId === partnerId && c.level === level
      && (aff.kind === 'devis'
        ? c.devisId === aff.devis.id            // la commission de CE devis
        : !c.devisId && c.leadId === aff.lead.id));
    if (commission) {
      return (
        <>
          Commission : {formatCFA(commission.amount)}{' '}
          <span className={`badge ${commission.status === 'payée' ? 'badge-success' : 'badge-warning'}`}>
            {commission.status === 'payée' ? 'Payée' : 'En attente'}
          </span>
        </>
      );
    }
    if (!aff.value) return <>Commission : calculée sur le devis du client</>;
    return <>Commission estimée : {formatCFA(Math.round(aff.value * rate))}</>;
  };

  const allMyLeads = leadsForUser(user);
  const openStages = stages.filter((s) => s.id !== 'gagne');
  const stageLabel = (id) => [...stages, lostStage].find((st) => st.id === id)?.label || id;

  // Le commercial DEMANDE le changement d'étape ; le gérant VALIDE. Seuls le
  // gérant de l'entreprise et l'admin plateforme appliquent directement : la
  // progression commerciale se suit à deux, y compris pour un inscrit seul
  // dans son espace. Une carte = un DEVIS, ou la piste tant qu'il n'y a aucun
  // devis.
  const peutValider = peutValiderProgression(user);
  // BestaSolar supervise les affaires des AUTRES comptes : elles vivent dans
  // leur organisation, donc chaque décision passe par le serveur (RPC).
  const isAdminPlateforme = isSupabaseConfigured && !!user.is_platform_admin;
  const refExterne = (aff) => (aff.kind === 'devis'
    ? { orgId: aff.devis.orgId, kind: 'devis', id: aff.devis.id }
    : { orgId: aff.lead.orgId, kind: 'lead', id: aff.lead.id });

  const moveAffaire = (aff, stageId) => {
    if (!aff || aff.stage === stageId) return;
    if (aff.externe) {
      if (!isAdminPlateforme) return;
      setProgression({ ...refExterne(aff), stage: stageId })
        .catch((e) => console.error('Progression impossible :', e.message))
        .finally(() => setRafraichir((n) => n + 1));
      return;
    }
    if (aff.kind === 'devis') {
      if (peutValider) updateDevisStage(aff.devis.id, stageId);
      else requestDevisStageChange(aff.devis.id, stageId, user.id);
    } else if (peutValider) {
      updateLeadStage(aff.lead.id, stageId, user.id);
    } else {
      requestStageChange(aff.lead.id, stageId, user.id);
    }
  };
  const approuver = (aff) => (aff.externe ? trancher(refExterne(aff), true)
    : aff.kind === 'devis'
      ? approveDevisStageChange(aff.devis.id, user.id)
      : approveStageChange(aff.lead.id, user.id));
  const refuser = (aff) => (aff.externe ? trancher(refExterne(aff), false)
    : aff.kind === 'devis'
      ? rejectDevisStageChange(aff.devis.id, user.id)
      : rejectStageChange(aff.lead.id, user.id));

  // « Suivi commercial » depuis la fiche client : ouvre directement sa carte
  // (sentinelle client:<id> résolue sur la liste des cartes).
  const location = useLocation();
  const [selectedKey, setSelectedKey] = useState(location.state?.leadId ? `client:${location.state.leadId}` : null);
  // Déplacement sans glisser : indispensable au doigt (le drag HTML5 n'émet
  // aucun événement tactile sur Android/iOS).
  const [stagePickerKey, setStagePickerKey] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [draggedKey, setDraggedKey] = useState(null);
  const [dragOverZone, setDragOverZone] = useState(null);
  const [noteText, setNoteText] = useState('');
  // Pas de « valeur estimée » à saisir : elle se déduit des devis du client.
  const [newLead, setNewLead] = useState({ name: '', contact: '', phone: '', address: '', notes: '', clientType: 'particulier' });

  // Vue plateforme (gérant BestaSolar) : les affaires de TOUS les comptes
  // remontent dans le kanban, et BestaSolar peut les faire avancer — c'est le
  // même suivi, partagé. (Même principe que la remontée des devis publics.)
  const [pipelineExterne, setPipelineExterne] = useState({ leads: [], devis: [] });
  // Demandes de progression venues des AUTRES organisations : tout commercial
  // de la plateforme propose, BestaSolar tranche.
  const [demandesPlateforme, setDemandesPlateforme] = useState([]);
  const [rafraichir, setRafraichir] = useState(0);
  useEffect(() => {
    if (!isAdminPlateforme) return;
    fetchAdminPublicPipeline()
      .then((data) => setPipelineExterne(data || { leads: [], devis: [] }))
      .catch(() => {});
    fetchPendingProgressions()
      .then((d) => setDemandesPlateforme(d || []))
      .catch(() => {});
  }, [isAdminPlateforme, rafraichir]);

  const trancher = async (d, approuver) => {
    try {
      await decideProgression({ orgId: d.orgId, kind: d.kind, id: d.id, approuver });
    } catch (e) {
      console.error('Décision impossible :', e.message);
    }
    setRafraichir((n) => n + 1);
  };

  const myLeads = ownerFilter === 'all' ? allMyLeads : allMyLeads.filter((l) => l.assignedTo === ownerFilter);
  // Filet de sécurité : jamais MES clients parmi les affaires « externes »
  // (sinon ils apparaîtraient en double et passeraient en lecture seule).
  const monOrg = user.org?.id || user.org_id || null;
  const mesLeadIds = new Set(allMyLeads.map((l) => l.id));
  const affairesExternes = ownerFilter === 'all'
    ? buildAffaires(
        pipelineExterne.leads.filter((l) => l.orgId !== monOrg && !mesLeadIds.has(l.id)),
        pipelineExterne.devis
      ).map((a) => ({ ...a, key: `ext-${a.key}`, externe: true }))
    : [];
  const affaires = [...buildAffaires(myLeads, devis), ...affairesExternes];
  // Résolution des clés sur TOUTES les affaires (filtre « par commercial »
  // compris) : une carte ouverte depuis un autre écran doit rester trouvable.
  const toutesAffaires = [...buildAffaires(allMyLeads, devis), ...affairesExternes];
  const findAff = (key) => toutesAffaires.find((a) => a.key === key)
    || (key?.startsWith('client:') ? toutesAffaires.find((a) => a.lead.id === key.slice(7)) : null);
  const selectedAff = findAff(selectedKey);
  // Les autres cartes du même client (ses autres devis), pour naviguer entre elles.
  const autresAffairesDuClient = selectedAff
    ? toutesAffaires.filter((a) => a.lead.id === selectedAff.lead.id && a.key !== selectedAff.key)
    : [];
  const pickerAff = findAff(stagePickerKey);
  // Demandes en attente de l'équipe — jamais filtrées par commercial : le
  // gérant ne doit pouvoir en rater aucune. Les affaires des autres comptes
  // se valident chez leur auteur.
  const enAttente = toutesAffaires.filter((a) => !a.externe && (a.kind === 'devis' ? a.devis.pendingStage : a.lead.pendingStage));
  const demandeDe = (a) => (a.kind === 'devis' ? a.devis.pendingStage : a.lead.pendingStage);
  // Sommes de MON équipe (les affaires des autres comptes sont comptées à part,
  // sinon les chiffres du gérant seraient gonflés par l'activité de la plateforme).
  const miennes = affaires.filter((a) => !a.externe);
  const openValue = miennes.filter(isOpen).reduce((sum, a) => sum + a.value, 0);
  const wonValue = miennes.filter((a) => a.stage === 'gagne').reduce((sum, a) => sum + a.value, 0);
  const lostCount = miennes.filter((a) => a.stage === 'perdu').length;
  const valeurExterne = affairesExternes.filter(isOpen).reduce((sum, a) => sum + a.value, 0);

  const handleDrop = (stageId) => {
    if (draggedKey) moveAffaire(findAff(draggedKey), stageId);
    setDraggedKey(null);
    setDragOverZone(null);
  };

  const handleAddLead = (e) => {
    e.preventDefault();
    addLead({
      ...newLead,
      estimatedValue: 0, // déduite automatiquement des devis du client
      assignedTo: user.id,
      parrainL1: null, // attribution automatique (lien d'affiliation) gérée par le store
    });
    setNewLead({ name: '', contact: '', phone: '', address: '', notes: '', clientType: 'particulier' });
    setShowAddForm(false);
  };

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    addLeadNote(selectedAff.lead.id, noteText.trim(), user.id);
    setNoteText('');
  };

  return (
    <div className="page">
      <PageHeader
        title="Suivi clients"
        actions={
          <button className="btn btn-accent" onClick={() => setShowAddForm(true)}>
            <Plus size={18} /> Nouvelle piste
          </button>
        }
      >
        <div className="pipeline-stats">
          <div className="pipeline-stat"><strong>{formatCFA(openValue)}</strong> en cours</div>
          <div className="pipeline-stat"><strong>{formatCFA(wonValue)}</strong> gagné</div>
          {lostCount > 0 && <div className="pipeline-stat"><strong>{lostCount}</strong> perdu(s)</div>}
          {/* Vue plateforme : ce que pèsent les affaires des AUTRES comptes,
              isolé pour ne pas gonfler les chiffres de sa propre équipe. */}
          {affairesExternes.length > 0 && (
            <div className="pipeline-stat">
              <strong>{formatCFA(valeurExterne)}</strong> autres comptes ({affairesExternes.length})
            </div>
          )}
        </div>
        {user.role === 'gerant' && (
          <div className="pipeline-filter-row">
            <select className="input select-filter" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} aria-label="Filtrer par commercial">
              <option value="all">Toute l'équipe</option>
              {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
      </PageHeader>

      <div className="page-content page-content-flush">
        {peutValider && (enAttente.length + demandesPlateforme.length) > 0 && (
          <div className="validation-bar">
            <div className="validation-bar-title">
              <Hourglass size={15} /> {(enAttente.length + demandesPlateforme.length) > 1
                ? `${enAttente.length + demandesPlateforme.length} progressions à valider`
                : '1 progression à valider'}
            </div>
            {/* Demandes des autres comptes de la plateforme */}
            {demandesPlateforme.map((d) => (
              <div key={`${d.orgId}-${d.kind}-${d.id}`} className="validation-row">
                <div className="validation-info">
                  <span className="validation-lead">
                    {d.clientName || 'Client'}{d.devisNumber ? ` · ${d.devisNumber}` : ''}
                  </span>
                  <span className="validation-move">
                    {stageLabel(d.stageActuel)} → <strong>{stageLabel(d.stageDemande)}</strong>
                  </span>
                  <span className="validation-by">
                    par {d.demandeurNom || '—'}{d.orgName ? ` · ${d.orgName}` : ''}
                    {d.demandeLe ? ` · ${formatDate(d.demandeLe)}` : ''}
                  </span>
                </div>
                <div className="validation-actions">
                  <button className="btn btn-sm btn-won" onClick={() => trancher(d, true)}><Check size={14} /> Valider</button>
                  <button className="btn btn-sm btn-lost" onClick={() => trancher(d, false)}><X size={14} /> Refuser</button>
                </div>
              </div>
            ))}
            {enAttente.map((a) => {
              const d = demandeDe(a);
              return (
                <div key={a.key} className="validation-row">
                  <div className="validation-info" role="button" tabIndex={0}
                    onClick={() => setSelectedKey(a.key)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedKey(a.key)}>
                    <span className="validation-lead">
                      {a.lead.name}
                      {a.kind === 'devis' && a.devis.devisNumber ? ` · ${a.devis.devisNumber}` : ''}
                    </span>
                    <span className="validation-move">
                      {stageLabel(a.stage)} → <strong>{stageLabel(d.stage)}</strong>
                    </span>
                    <span className="validation-by">
                      par {getUserById(d.requestedBy)?.name || '—'} · {formatDate(d.requestedAt)}
                    </span>
                  </div>
                  <div className="validation-actions">
                    <button className="btn btn-sm btn-won" onClick={() => approuver(a)}><Check size={14} /> Valider</button>
                    <button className="btn btn-sm btn-lost" onClick={() => refuser(a)}><X size={14} /> Refuser</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="kanban-container">
          {openStages.map((stage) => {
            const stageAffaires = affaires.filter((a) => a.stage === stage.id);
            const stageValue = stageAffaires.reduce((sum, a) => sum + a.value, 0);
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
                    <span className="kanban-column-count">{stageAffaires.length}</span>
                  </div>
                  <div className="kanban-column-summary">{formatCFA(stageValue)} · {stageAffaires.length} affaire{stageAffaires.length > 1 ? 's' : ''}</div>
                </div>
                <div className="kanban-column-body">
                  {stageAffaires.map((aff) => {
                    const lead = aff.lead;
                    const stale = daysSince(lead.lastActivity) > STALE_DAYS;
                    const owner = getUserById(lead.assignedTo);
                    return (
                      <div
                        key={aff.key}
                        className={`kanban-card ${draggedKey === aff.key ? 'dragging' : ''}`}
                        draggable={!aff.externe || isAdminPlateforme}
                        onDragStart={() => (!aff.externe || isAdminPlateforme) && setDraggedKey(aff.key)}
                        onDragEnd={() => { setDraggedKey(null); setDragOverZone(null); }}
                        onClick={() => setSelectedKey(aff.key)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setSelectedKey(aff.key)}
                      >
                        <div className="kanban-card-head">
                          <div className="kanban-card-title">{lead.name}</div>
                          {(!aff.externe || isAdminPlateforme) && (
                            <button
                              className="kanban-card-move"
                              aria-label={`Déplacer ${lead.name}${aff.kind === 'devis' && aff.devis.devisNumber ? ` (${aff.devis.devisNumber})` : ''} vers une autre étape`}
                              onClick={(e) => { e.stopPropagation(); setStagePickerKey(aff.key); }}
                            >
                              <MoreVertical size={16} />
                            </button>
                          )}
                        </div>
                        <div className="kanban-card-contact">
                          {aff.kind === 'devis' ? (
                            <><FileText size={11} style={{ verticalAlign: -1 }} /> {aff.devis.devisNumber || 'Devis'}
                              {aff.devis.statut === 'brouillon' && ' · brouillon'}</>
                          ) : lead.contact}
                          {aff.externe && <> · par {lead.authorName || lead.orgName}</>}
                        </div>
                        {demandeDe(aff) && (
                          <div className="pending-chip" title="En attente de validation">
                            <Hourglass size={11} /> → {stageLabel(demandeDe(aff).stage)}
                          </div>
                        )}
                        <div className="kanban-card-footer">
                          <span className={`kanban-card-value${aff.value > 0 ? '' : ' none'}`}>
                            {aff.value > 0 ? formatCFA(aff.value) : 'Devis à créer'}
                          </span>
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
                  {stageAffaires.length === 0 && <div className="kanban-empty">Déposez une carte ici</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Zones de dépôt Gagné / Perdu visibles pendant le glissement */}
      {draggedKey && (
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
        open={!!selectedAff}
        onClose={() => setSelectedKey(null)}
        title={selectedAff?.lead.name}
        subtitle={selectedAff && [
          selectedAff.kind === 'devis' ? (selectedAff.devis.devisNumber || 'Devis') : selectedAff.lead.contact,
          selectedAff.value > 0 ? formatCFA(selectedAff.value) : null,
        ].filter(Boolean).join(' · ')}
      >
        {selectedAff && (
          <>
            {selectedAff.externe && (
              <div className="callout" role="note">
                <div className="callout-title">
                  <Eye size={13} /> Affaire suivie par {selectedAff.lead.authorName || '—'}
                  {selectedAff.lead.orgName && selectedAff.lead.orgName !== selectedAff.lead.authorName ? ` (${selectedAff.lead.orgName})` : ''}
                  {isAdminPlateforme
                    ? ' — vous suivez sa progression avec lui : vos décisions s’appliquent chez lui.'
                    : ' — consultation seule, elle se déplace chez son auteur.'}
                </div>
              </div>
            )}
            {demandeDe(selectedAff) && (!selectedAff.externe || isAdminPlateforme) && (
              <div className="pending-banner">
                <span className="pending-banner-text">
                  <Hourglass size={15} /> Passage à « <strong>{stageLabel(demandeDe(selectedAff).stage)}</strong> » demandé
                  par {getUserById(demandeDe(selectedAff).requestedBy)?.name || selectedAff.lead.authorName || '—'} — en attente de validation.
                </span>
                {peutValider && (
                  <span className="pending-banner-actions">
                    <button className="btn btn-sm btn-won" onClick={() => approuver(selectedAff)}><Check size={14} /> Valider</button>
                    <button className="btn btn-sm btn-lost" onClick={() => refuser(selectedAff)}><X size={14} /> Refuser</button>
                  </span>
                )}
              </div>
            )}
            {selectedAff.externe && !isAdminPlateforme ? (
              /* Affaire d'un autre compte : on VOIT l'avancement (barre en
                 lecture seule), sans pouvoir agir. L'admin plateforme, lui,
                 la fait avancer comme les siennes (branche suivante). */
              isOpen(selectedAff) ? (
                <div className="stage-stepper is-readonly">
                  {openStages.map((stage, i) => {
                    const currentIndex = openStages.findIndex((s) => s.id === selectedAff.stage);
                    return (
                      <span
                        key={stage.id}
                        className={`stage-step ${i <= currentIndex ? 'reached' : ''} ${selectedAff.stage === stage.id ? 'current' : ''}`}
                        title={stage.label}
                      >
                        {stage.label}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className={`outcome-banner ${selectedAff.stage === 'gagne' ? 'won' : 'lost'}`}>
                  <span className="outcome-banner-label">
                    {selectedAff.stage === 'gagne'
                      ? <><Trophy size={16} /> Affaire gagnée</>
                      : <><ThumbsDown size={16} /> Affaire perdue</>}
                  </span>
                </div>
              )
            ) : isOpen(selectedAff) ? (
              <>
                <div className="stage-stepper">
                  {openStages.map((stage, i) => {
                    const currentIndex = openStages.findIndex((s) => s.id === selectedAff.stage);
                    return (
                      <button
                        key={stage.id}
                        className={`stage-step ${i <= currentIndex ? 'reached' : ''} ${selectedAff.stage === stage.id ? 'current' : ''}`}
                        onClick={() => moveAffaire(selectedAff, stage.id)}
                        title={stage.label}
                      >
                        {stage.label}
                      </button>
                    );
                  })}
                </div>
                <button className="btn btn-outline btn-block stage-move-btn" onClick={() => setStagePickerKey(selectedAff.key)}>
                  <ArrowRightLeft size={16} /> Déplacer vers…
                </button>
                <div className="outcome-actions">
                  <button className="btn btn-won" onClick={() => moveAffaire(selectedAff, 'gagne')}>
                    <Trophy size={16} /> Gagné
                  </button>
                  <button className="btn btn-lost" onClick={() => moveAffaire(selectedAff, 'perdu')}>
                    <ThumbsDown size={16} /> Perdu
                  </button>
                </div>
              </>
            ) : (
              <div className={`outcome-banner ${selectedAff.stage === 'gagne' ? 'won' : 'lost'}`}>
                <span className="outcome-banner-label">
                  {selectedAff.stage === 'gagne'
                    ? <><Trophy size={16} /> Affaire gagnée le {formatDate(selectedAff.kind === 'devis' ? selectedAff.devis.wonAt : selectedAff.lead.wonAt)}</>
                    : <><ThumbsDown size={16} /> Affaire perdue le {formatDate(selectedAff.kind === 'devis' ? selectedAff.devis.lostAt : selectedAff.lead.lostAt)}</>}
                </span>
                <button className="btn btn-sm btn-outline" onClick={() => moveAffaire(selectedAff, 'negociation')}>
                  <RotateCcw size={14} /> Rouvrir
                </button>
              </div>
            )}

            <div className="sheet-section">
              <div className="sheet-section-title">Contact</div>
              <div className="sheet-row">
                <span className="sheet-label"><Phone size={14} /> Téléphone</span>
                <a className="sheet-value sheet-link" href={`tel:${selectedAff.lead.phone.replace(/\s/g, '')}`}>{selectedAff.lead.phone}</a>
              </div>
              <div className="sheet-row"><span className="sheet-label"><MapPin size={14} /> Adresse</span><span className="sheet-value">{selectedAff.lead.address}</span></div>
              <div className="sheet-row">
                <span className="sheet-label">{selectedAff.lead.clientType === 'entreprise' ? <Building2 size={14} /> : <User size={14} />} Type de client</span>
                <span className="sheet-value">{selectedAff.lead.clientType === 'entreprise' ? 'Entreprise' : 'Particulier'}</span>
              </div>
              {user.role === 'gerant' && !selectedAff.externe && (
                <div className="sheet-row"><span className="sheet-label">Assignée à</span><span className="sheet-value">{getUserById(selectedAff.lead.assignedTo)?.name}</span></div>
              )}
              {selectedAff.externe && (
                <div className="sheet-row"><span className="sheet-label">Suivie par</span><span className="sheet-value">{selectedAff.lead.authorName || '—'}{selectedAff.lead.orgName && selectedAff.lead.orgName !== selectedAff.lead.authorName ? ` · ${selectedAff.lead.orgName}` : ''}</span></div>
              )}
            </div>

            {/* Les AUTRES affaires du même client : chacune a sa propre carte
                dans le kanban, avec son étape et son issue. */}
            {autresAffairesDuClient.length > 0 && (
              <div className="sheet-section">
                <div className="sheet-section-title">
                  <FileText size={14} /> Autres affaires de ce client ({autresAffairesDuClient.length})
                </div>
                {autresAffairesDuClient.map((a) => (
                  <button key={a.key} type="button" className="sheet-row sheet-row-btn"
                    onClick={() => setSelectedKey(a.key)}>
                    <span className="sheet-label">
                      {a.kind === 'devis' ? (a.devis.devisNumber || 'Devis') : 'Prospection'}
                      {a.kind === 'devis' && a.devis.statut === 'brouillon' && (
                        <span className="text-secondary"> · brouillon</span>
                      )}
                    </span>
                    <span className="sheet-value">
                      {a.value > 0 ? `${formatCFA(a.value)} ` : ''}
                      <span className={`badge ${a.stage === 'gagne' ? 'badge-success' : a.stage === 'perdu' ? 'badge-muted' : 'badge-warning'}`}>
                        {stageLabel(a.stage)}
                      </span>
                    </span>
                  </button>
                ))}
                <div className="field-hint">
                  Chaque devis se suit séparément dans le tableau et génère sa propre
                  commission une fois gagné.
                </div>
              </div>
            )}

            {!selectedAff.externe && (selectedAff.lead.parrainL1 || selectedAff.lead.parrainL2) && (
              <div className="sheet-section">
                <div className="sheet-section-title">Chaîne de parrainage</div>
                <div className="referral-chain">
                  {selectedAff.lead.parrainL1 && (
                    <>
                      <div className="referral-level referral-level-1">
                        <div className="referral-level-icon">L1</div>
                        <div className="referral-level-info">
                          <div className="referral-level-name">{getPartnerById(selectedAff.lead.parrainL1)?.name}</div>
                          <div className="referral-level-commission">{renderCommissionInfo(selectedAff, selectedAff.lead.parrainL1, 1, 0.03)}</div>
                        </div>
                      </div>
                      {selectedAff.lead.parrainL2 && <div className="referral-connector" />}
                    </>
                  )}
                  {selectedAff.lead.parrainL2 && (
                    <div className="referral-level referral-level-2">
                      <div className="referral-level-icon">L2</div>
                      <div className="referral-level-info">
                        <div className="referral-level-name">{getPartnerById(selectedAff.lead.parrainL2)?.name}</div>
                        <div className="referral-level-commission">{renderCommissionInfo(selectedAff, selectedAff.lead.parrainL2, 2, 0.015)}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="sheet-section">
              <div className="sheet-section-title">Notes et activités</div>
              {!selectedAff.externe && (
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
              )}
              <div className="activity-timeline">
                {(selectedAff.lead.activities || []).map((act) => (
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
                {selectedAff.lead.notes && (
                  <div className="activity-item">
                    <div className="activity-dot" />
                    <div className="activity-content">
                      <div className="activity-text">{selectedAff.lead.notes}</div>
                      <div className="activity-meta">Note initiale · {formatDate(selectedAff.lead.createdAt)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </Sheet>

      {/* Sélecteur d'étape : le déplacement sans glisser, au doigt comme au clavier */}
      <Sheet
        open={!!pickerAff}
        onClose={() => setStagePickerKey(null)}
        title="Déplacer vers…"
        subtitle={pickerAff && `${pickerAff.lead.name}${pickerAff.kind === 'devis' && pickerAff.devis.devisNumber ? ` · ${pickerAff.devis.devisNumber}` : ''} · actuellement « ${stageLabel(pickerAff.stage)} »`}
      >
        {pickerAff && (
          <div className="stage-picker">
            {openStages.filter((s) => s.id !== pickerAff.stage).map((s) => (
              <button
                key={s.id}
                className="stage-picker-btn"
                onClick={() => { moveAffaire(pickerAff, s.id); setStagePickerKey(null); }}
              >
                <span className="stage-picker-dot" style={{ background: s.color }} />
                {s.label}
              </button>
            ))}
            <button className="stage-picker-btn won" onClick={() => { moveAffaire(pickerAff, 'gagne'); setStagePickerKey(null); }}>
              <Trophy size={16} /> Gagné
            </button>
            <button className="stage-picker-btn lost" onClick={() => { moveAffaire(pickerAff, 'perdu'); setStagePickerKey(null); }}>
              <ThumbsDown size={16} /> Perdu
            </button>
            {!peutValider && <p className="field-hint">Le changement d'étape sera soumis à la validation du gérant.</p>}
          </div>
        )}
      </Sheet>

      {/* Formulaire nouvelle piste */}
      <Sheet open={showAddForm} onClose={() => setShowAddForm(false)} title="Nouvelle piste">
        <form onSubmit={handleAddLead} className="form-grid">
          <Field label="Entreprise / Client *">
            <input className="input" required value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} placeholder="Ex : Hôtel du Parc" />
          </Field>
          <Field label="Personne de contact *">
            <input className="input" required value={newLead.contact} onChange={(e) => setNewLead({ ...newLead, contact: e.target.value })} placeholder="Ex : M. Kossi Agboka" />
          </Field>
          <Field label="Téléphone">
            <input className="input" type="tel" value={newLead.phone} onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })} placeholder="+229 ..." />
          </Field>
          <Field label="Adresse">
            <input className="input" value={newLead.address} onChange={(e) => setNewLead({ ...newLead, address: e.target.value })} placeholder="Quartier, ville" />
          </Field>
          <div className="input-group">
            <span className="input-label" id="pipeline-clienttype-label">Type de client</span>
            <div className="client-type-toggle" role="group" aria-labelledby="pipeline-clienttype-label">
              <button
                type="button"
                className={`client-type-btn ${newLead.clientType === 'particulier' ? 'active' : ''}`}
                aria-pressed={newLead.clientType === 'particulier'}
                onClick={() => setNewLead({ ...newLead, clientType: 'particulier' })}
              >
                <User size={16} /> Particulier
              </button>
              <button
                type="button"
                className={`client-type-btn ${newLead.clientType === 'entreprise' ? 'active' : ''}`}
                aria-pressed={newLead.clientType === 'entreprise'}
                onClick={() => setNewLead({ ...newLead, clientType: 'entreprise' })}
              >
                <Building2 size={16} /> Entreprise
              </button>
            </div>
          </div>
          <Field label="Notes">
            <textarea className="input" rows="3" value={newLead.notes} onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })} placeholder="Détails du besoin…" />
          </Field>
          <button type="submit" className="btn btn-primary btn-block"><Plus size={18} /> Créer la piste</button>
        </form>
      </Sheet>
    </div>
  );
}
