import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Phone, MapPin, User, Building2, MessageCircle, FolderKanban, FileText, ChevronRight, UserCheck, Pencil, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatCFA, formatDate } from '../utils/format';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';
import Field from '../components/Field';
import EmptyState from '../components/EmptyState';
import StageBadge from '../components/StageBadge';

// Pas de « valeur estimée » à saisir : la valeur de l'affaire se déduit
// automatiquement des devis créés pour le client.
const EMPTY_FORM = { name: '', contact: '', phone: '', address: '', notes: '', clientType: 'particulier' };

// Formulaire client partagé entre l'ajout et la modification.
function ClientForm({ form, setForm, onSubmit, submitLabel, submitIcon: SubmitIcon }) {
  return (
    <form onSubmit={onSubmit} className="form-grid">
      <Field label="Entreprise / Client *">
        <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex : Hôtel du Parc" />
      </Field>
      <Field label="Personne de contact *">
        <input className="input" required value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="Ex : M. Kossi Agboka" />
      </Field>
      <Field label="Téléphone">
        <input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+229 ..." />
      </Field>
      <Field label="Adresse">
        <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Quartier, ville" />
      </Field>
      <div className="input-group">
        <span className="input-label" id="clients-clienttype-label">Type de client</span>
        <div className="client-type-toggle" role="group" aria-labelledby="clients-clienttype-label">
          <button
            type="button"
            className={`client-type-btn ${form.clientType === 'particulier' ? 'active' : ''}`}
            aria-pressed={form.clientType === 'particulier'}
            onClick={() => setForm({ ...form, clientType: 'particulier' })}
          >
            <User size={16} /> Particulier
          </button>
          <button
            type="button"
            className={`client-type-btn ${form.clientType === 'entreprise' ? 'active' : ''}`}
            aria-pressed={form.clientType === 'entreprise'}
            onClick={() => setForm({ ...form, clientType: 'entreprise' })}
          >
            <Building2 size={16} /> Entreprise
          </button>
        </div>
      </div>
      <Field label="Notes">
        <textarea className="input" rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Détails du besoin…" />
      </Field>
      <button type="submit" className="btn btn-primary btn-block"><SubmitIcon size={18} /> {submitLabel}</button>
    </form>
  );
}

/**
 * Répertoire clients : liste alphabétique de tous les clients (pistes) avec
 * recherche, ajout et modification. Le suivi commercial détaillé (étapes,
 * kanban) reste dans « Suivi clients » — ici, c'est le carnet d'adresses.
 */
export default function Clients() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { leadsForUser, stages, lostStage, addLead, updateLead, getPartnerById } = useData();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const allClients = leadsForUser(user);
  const q = query.trim().toLowerCase();
  const clients = allClients
    .filter((l) => !q || [l.name, l.contact, l.phone, l.address].some((v) => (v || '').toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  const stageInfo = (lead) => (lead.stage === 'perdu' ? lostStage : stages.find((s) => s.id === lead.stage));
  const selectedClient = selected ? allClients.find((l) => l.id === selected) : null;
  const apporteur = selectedClient?.parrainL1 ? getPartnerById(selectedClient.parrainL1) : null;

  const handleAdd = (e) => {
    e.preventDefault();
    addLead({
      ...form,
      estimatedValue: 0, // déduite automatiquement des devis du client
      assignedTo: user.id,
      parrainL1: null, // attribution automatique (lien d'affiliation) gérée par le store
    });
    setForm(EMPTY_FORM);
    setShowAdd(false);
  };

  const openEdit = (client) => {
    setForm({
      name: client.name || '',
      contact: client.contact || '',
      phone: client.phone || '',
      address: client.address || '',
      notes: client.notes || '',
      clientType: client.clientType || 'particulier',
    });
    setEditId(client.id);
  };

  const handleEdit = (e) => {
    e.preventDefault();
    updateLead(editId, form);
    setEditId(null);
    setForm(EMPTY_FORM);
  };

  return (
    <div className="page">
      <PageHeader
        title="Clients"
        subtitle={`${allClients.length} client${allClients.length > 1 ? 's' : ''} dans votre carnet`}
        actions={
          <button className="btn btn-accent" onClick={() => { setForm(EMPTY_FORM); setShowAdd(true); }}>
            <Plus size={18} /> Nouveau client
          </button>
        }
      />
      <div className="page-content">
        <div className="search-box clients-search">
          <Search size={18} className="search-icon" />
          <input
            className="input search-input"
            aria-label="Rechercher un client"
            placeholder="Rechercher un client, un contact, un téléphone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {query.trim() !== '' && (
          <div className="filter-status" role="status">
            {clients.length} résultat{clients.length > 1 ? 's' : ''} pour « {query.trim()} »
          </div>
        )}
        <div className="clients-list">
          {clients.map((client) => {
            const st = stageInfo(client);
            return (
              <button key={client.id} className="card client-list-row" onClick={() => setSelected(client.id)}>
                <div className={`client-list-avatar ${client.clientType === 'entreprise' ? 'ent' : ''}`}>
                  {client.clientType === 'entreprise' ? <Building2 size={18} /> : <User size={18} />}
                </div>
                <div className="client-list-info">
                  <div className="client-list-name">{client.name}</div>
                  <div className="client-list-sub">
                    {client.contact}{client.phone ? ` · ${client.phone}` : ''}
                  </div>
                </div>
                <div className="client-list-side">
                  {st && <StageBadge stage={st} />}
                  <ChevronRight size={18} className="client-list-arrow" />
                </div>
              </button>
            );
          })}
          {clients.length === 0 && (
            <EmptyState card>
              {q ? 'Aucun client ne correspond à cette recherche.' : 'Aucun client pour le moment — ajoutez votre premier client.'}
            </EmptyState>
          )}
        </div>
      </div>

      {/* Fiche client */}
      <Sheet open={!!selectedClient} onClose={() => setSelected(null)} title={selectedClient?.name || ''}>
        {selectedClient && (
          <>
            <div className="sheet-section">
              <div className="sheet-section-title">Contact</div>
              <div className="sheet-row"><span className="sheet-label"><User size={14} /> Contact</span><span className="sheet-value">{selectedClient.contact}</span></div>
              {selectedClient.phone && (
                <div className="sheet-row">
                  <span className="sheet-label"><Phone size={14} /> Téléphone</span>
                  <a className="sheet-value sheet-link" href={`tel:${selectedClient.phone.replace(/\s/g, '')}`}>{selectedClient.phone}</a>
                </div>
              )}
              {selectedClient.address && (
                <div className="sheet-row"><span className="sheet-label"><MapPin size={14} /> Adresse</span><span className="sheet-value">{selectedClient.address}</span></div>
              )}
              <div className="sheet-row">
                <span className="sheet-label">{selectedClient.clientType === 'entreprise' ? <Building2 size={14} /> : <User size={14} />} Type</span>
                <span className="sheet-value">{selectedClient.clientType === 'entreprise' ? 'Entreprise' : 'Particulier'}</span>
              </div>
            </div>

            <div className="sheet-section">
              <div className="sheet-section-title">Suivi commercial</div>
              <div className="sheet-row">
                <span className="sheet-label"><FolderKanban size={14} /> Étape</span>
                <span className="sheet-value">
                  {(() => { const st = stageInfo(selectedClient); return st ? <StageBadge stage={st} /> : '—'; })()}
                </span>
              </div>
              {selectedClient.estimatedValue > 0 && (
                <div className="sheet-row"><span className="sheet-label">Valeur de l'affaire</span><span className="sheet-value amount">{formatCFA(selectedClient.estimatedValue)}</span></div>
              )}
              {apporteur && (
                <div className="sheet-row">
                  <span className="sheet-label"><UserCheck size={14} /> Apporteur</span>
                  <span className="sheet-value">{apporteur.name} <span className="partner-code-chip">{apporteur.code}</span></span>
                </div>
              )}
              <div className="sheet-row"><span className="sheet-label">Ajouté le</span><span className="sheet-value">{formatDate(selectedClient.createdAt)}</span></div>
            </div>
            {selectedClient.notes && <p className="text-sm text-secondary client-sheet-notes">{selectedClient.notes}</p>}

            <div className="client-sheet-actions">
              <button className="btn btn-primary" onClick={() => navigate('/devis', { state: { leadId: selectedClient.id } })}>
                <FileText size={16} /> Créer un devis
              </button>
              <button className="btn btn-outline" onClick={() => { openEdit(selectedClient); setSelected(null); }}>
                <Pencil size={16} /> Modifier
              </button>
              {selectedClient.phone && (
                <a className="btn btn-whatsapp" href={`https://wa.me/${selectedClient.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                  <MessageCircle size={16} /> WhatsApp
                </a>
              )}
              {/* Le client est transmis au kanban via l'état de navigation
                  (fiche à ouvrir à l'arrivée — branchement côté Pipeline à venir). */}
              <button className="btn btn-outline" onClick={() => navigate('/pipeline', { state: { leadId: selectedClient.id } })}>
                <FolderKanban size={16} /> Suivi commercial
              </button>
            </div>
          </>
        )}
      </Sheet>

      {/* Formulaire nouveau client */}
      <Sheet open={showAdd} onClose={() => setShowAdd(false)} title="Nouveau client">
        <ClientForm form={form} setForm={setForm} onSubmit={handleAdd} submitLabel="Ajouter le client" submitIcon={Plus} />
      </Sheet>

      {/* Formulaire modification client */}
      <Sheet open={!!editId} onClose={() => setEditId(null)} title="Modifier le client">
        <ClientForm form={form} setForm={setForm} onSubmit={handleEdit} submitLabel="Enregistrer les modifications" submitIcon={Save} />
      </Sheet>
    </div>
  );
}
