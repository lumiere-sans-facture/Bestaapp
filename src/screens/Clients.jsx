import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Search, Phone, Mail, MapPin, Building2, User, FileText, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { initials } from '../utils/format';
import { devisDuClient } from '../utils/affaires';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';
import Field from '../components/Field';
import EmptyState from '../components/EmptyState';
import ClientIdentityFields, { contactEffectif } from '../components/ClientIdentityFields';
import ClientDetail from './clients/ClientDetail';

// Pas de « valeur estimée » à saisir : la valeur de l'affaire se déduit
// automatiquement des devis créés pour le client.
const EMPTY_FORM = { name: '', contact: '', phone: '', email: '', address: '', notes: '', clientType: 'particulier' };

// Formulaire client partagé entre l'ajout et la modification.
function ClientForm({ form, setForm, onSubmit, submitLabel, submitIcon: SubmitIcon }) {
  return (
    <form onSubmit={onSubmit} className="form-grid">
      <ClientIdentityFields
        idPrefix="clients"
        clientType={form.clientType}
        onTypeChange={(clientType) => setForm({ ...form, clientType })}
        name={form.name}
        onNameChange={(name) => setForm({ ...form, name })}
        contact={form.contact}
        onContactChange={(contact) => setForm({ ...form, contact })}
      />
      <Field label="Téléphone">
        <input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+228 ..." />
      </Field>
      <Field label="Email">
        <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="client@exemple.com" />
      </Field>
      <Field label="Adresse">
        <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Quartier, ville" />
      </Field>
      <Field label="Notes">
        <textarea className="input" rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Détails du besoin…" />
      </Field>
      <button type="submit" className="btn btn-primary btn-block"><SubmitIcon size={18} /> {submitLabel}</button>
    </form>
  );
}

/**
 * Répertoire clients : cartes de tous les clients (pistes) avec recherche,
 * ajout et modification, et fiche plein écran sur /clients/:id. Le suivi
 * commercial détaillé (étapes, kanban) reste dans « Suivi clients » — ici,
 * c'est le carnet d'adresses.
 */
export default function Clients() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const { leadsForUser, devis, stages, lostStage, addLead, updateLead, getPartnerById } = useData();
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const allClients = leadsForUser(user);
  const q = query.trim().toLowerCase();
  const clients = allClients
    .filter((l) => !q || [l.name, l.contact, l.phone, l.email, l.address].some((v) => (v || '').toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  const stageInfo = (lead) => (lead.stage === 'perdu' ? lostStage : stages.find((s) => s.id === lead.stage));
  const clientOuvert = id ? allClients.find((l) => l.id === id) : null;

  // Adresse pointant un client inconnu (supprimé, ou appartenant à un autre
  // compte) : retour au carnet plutôt qu'un écran vide.
  useEffect(() => {
    if (id && !clientOuvert) navigate('/clients', { replace: true });
  }, [id, clientOuvert, navigate]);

  const handleAdd = (e) => {
    e.preventDefault();
    addLead({
      ...form,
      // Un particulier EST son propre contact : pas de second champ à saisir,
      // son nom sert aussi de personne à joindre partout ailleurs dans l'app.
      contact: contactEffectif(form),
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
      email: client.email || '',
      address: client.address || '',
      notes: client.notes || '',
      clientType: client.clientType || 'particulier',
    });
    setEditId(client.id);
  };

  const handleEdit = (e) => {
    e.preventDefault();
    updateLead(editId, { ...form, contact: contactEffectif(form) });
    setEditId(null);
    setForm(EMPTY_FORM);
  };

  return (
    <div className="page">
      <PageHeader
        title={clientOuvert ? clientOuvert.name : 'Clients'}
        subtitle={clientOuvert ? undefined : `Gérez votre base de données clients (${allClients.length})`}
        onBack={clientOuvert ? () => navigate('/clients') : undefined}
        actions={clientOuvert ? undefined : (
          <button className="btn btn-accent" onClick={() => { setForm(EMPTY_FORM); setShowAdd(true); }}>
            <Plus size={18} /> Nouveau client
          </button>
        )}
      />
      <div className="page-content">
        {clientOuvert ? (
          <ClientDetail
            client={clientOuvert}
            devisClient={devisDuClient(clientOuvert.id, devis)
              .slice()
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))}
            stage={stageInfo(clientOuvert)}
            apporteur={clientOuvert.parrainL1 ? getPartnerById(clientOuvert.parrainL1) : null}
            onEdit={() => openEdit(clientOuvert)}
            onNouveauDevis={() => navigate('/devis', { state: { leadId: clientOuvert.id } })}
            onSuivi={() => navigate('/pipeline', { state: { leadId: clientOuvert.id } })}
          />
        ) : (
          <>
            <div className="search-box clients-search">
              <Search size={18} className="search-icon" />
              <input
                className="input search-input"
                aria-label="Rechercher un client"
                placeholder="Rechercher des clients…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {query.trim() !== '' && (
              <div className="filter-status" role="status">
                {clients.length} résultat{clients.length > 1 ? 's' : ''} pour « {query.trim()} »
              </div>
            )}

            <div className="client-grid">
              {clients.map((client) => {
                const estEntreprise = client.clientType === 'entreprise';
                const nbDevis = devisDuClient(client.id, devis).length;
                return (
                  <button key={client.id} className="card client-card" onClick={() => navigate(`/clients/${client.id}`)}>
                    <div className="client-card-head">
                      <span className={`client-card-avatar ${estEntreprise ? 'ent' : ''}`}>{initials(client.name)}</span>
                      <span className="client-card-ident">
                        <span className="client-card-name">{client.name}</span>
                        {estEntreprise && (
                          <span className="flat-badge info client-card-badge"><Building2 size={12} /> Entreprise</span>
                        )}
                      </span>
                    </div>
                    <div className="client-card-lines">
                      {client.phone && <span className="client-card-line"><Phone size={14} /> {client.phone}</span>}
                      {client.email && <span className="client-card-line"><Mail size={14} /> {client.email}</span>}
                      {client.address && <span className="client-card-line"><MapPin size={14} /> {client.address}</span>}
                      {/* Un client sans coordonnée n'affiche rien : la carte
                          garderait une hauteur vide sans ce repli. */}
                      {!client.phone && !client.email && !client.address && (
                        <span className="client-card-line is-empty"><User size={14} /> Aucune coordonnée</span>
                      )}
                    </div>
                    <div className="client-card-foot">
                      <FileText size={14} /> {nbDevis} devis
                    </div>
                  </button>
                );
              })}
            </div>
            {clients.length === 0 && (
              <EmptyState card>
                {q ? 'Aucun client ne correspond à cette recherche.' : 'Aucun client pour le moment — ajoutez votre premier client.'}
              </EmptyState>
            )}
          </>
        )}
      </div>

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
