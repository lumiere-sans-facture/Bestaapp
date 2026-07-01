import { useState } from 'react';
import { Users, Plus, Trash2, Pencil, User, Building2, Phone, MapPin, Check } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import Sheet from '../../../components/Sheet';
import Field from '../../../components/Field';

const EMPTY = { name: '', phone: '', ville: '', type: 'particulier' };

/** Onglet « Clients » : carnet d'adresses propre au technicien abonné. */
export default function ClientsTab() {
  const { user } = useAuth();
  const { proClientsForUser, addProClient, updateProClient, deleteProClient } = useData();

  const myClients = proClientsForUser(user.id);
  const [editingId, setEditingId] = useState(null); // null = fermé, 'new' = création, sinon id
  const [form, setForm] = useState(EMPTY);

  const openNew = () => { setForm(EMPTY); setEditingId('new'); };
  const openEdit = (c) => { setForm({ name: c.name, phone: c.phone || '', ville: c.ville || '', type: c.type || 'particulier' }); setEditingId(c.id); };
  const close = () => setEditingId(null);

  const submit = (e) => {
    e.preventDefault();
    const data = { name: form.name.trim(), phone: form.phone.trim(), ville: form.ville.trim(), type: form.type };
    if (!data.name) return;
    if (editingId === 'new') addProClient({ userId: user.id, ...data });
    else updateProClient(editingId, data);
    close();
  };

  return (
    <>
      <div className="pro-actions-row">
        <button className="btn btn-accent" onClick={openNew}>
          <Plus size={16} /> Nouveau client
        </button>
      </div>

      <div className="card my-partner-section">
        <div className="card-title"><Users size={15} /> Mes clients ({myClients.length})</div>
        {myClients.length ? myClients.map((c) => (
          <div key={c.id} className="sheet-row">
            <span className="sheet-label">
              {c.type === 'entreprise' ? <Building2 size={14} /> : <User size={14} />}{' '}
              <strong>{c.name}</strong>
              {c.phone && <span className="text-secondary"> · {c.phone}</span>}
              {c.ville && <span className="text-secondary"> · {c.ville}</span>}
            </span>
            <span className="sheet-value pro-doc-actions">
              <button className="btn btn-sm btn-outline" onClick={() => openEdit(c)} aria-label="Modifier"><Pencil size={13} /></button>
              <button className="cart-row-remove" onClick={() => window.confirm(`Supprimer le client « ${c.name} » ?`) && deleteProClient(c.id)} aria-label="Supprimer"><Trash2 size={14} /></button>
            </span>
          </div>
        )) : <div className="text-sm text-secondary">Aucun client. Ajoutez-en un pour l'utiliser dans vos devis et factures.</div>}
      </div>

      <Sheet open={editingId !== null} onClose={close} title={editingId === 'new' ? 'Nouveau client' : 'Modifier le client'}>
        <form onSubmit={submit}>
          <Field label="Nom du client *">
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nom / raison sociale" />
          </Field>
          <div className="client-type-toggle" role="group" aria-label="Type de client">
            <button type="button" className={`client-type-btn ${form.type === 'particulier' ? 'active' : ''}`} onClick={() => setForm({ ...form, type: 'particulier' })}>
              <User size={16} /> Particulier
            </button>
            <button type="button" className={`client-type-btn ${form.type === 'entreprise' ? 'active' : ''}`} onClick={() => setForm({ ...form, type: 'entreprise' })}>
              <Building2 size={16} /> Entreprise
            </button>
          </div>
          <div className="form-row-2">
            <Field label={<><Phone size={13} /> Téléphone</>}>
              <input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+229 ..." />
            </Field>
            <Field label={<><MapPin size={13} /> Ville</>}>
              <input className="input" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
            </Field>
          </div>
          <button type="submit" className="btn btn-primary btn-block"><Check size={17} /> {editingId === 'new' ? 'Ajouter le client' : 'Enregistrer'}</button>
        </form>
      </Sheet>
    </>
  );
}
