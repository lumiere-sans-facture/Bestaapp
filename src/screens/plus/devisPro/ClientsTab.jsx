import { useMemo, useState } from 'react';
import { Plus, Trash2, User, Building2, Phone, MapPin, Check } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { formatDate } from '../../../utils/format';
import Sheet from '../../../components/Sheet';
import Field from '../../../components/Field';

const EMPTY = { name: '', phone: '', ville: '', type: 'particulier' };
const nf = (v) => Math.round(v || 0).toLocaleString('fr-FR');

/** Onglet « Clients » : carnet d'adresses propre au technicien abonné. */
export default function ClientsTab() {
  const { user } = useAuth();
  const { proClientsForUser, devis, addProClient, updateProClient, deleteProClient } = useData();

  const myClients = proClientsForUser(user.id);
  const [editingId, setEditingId] = useState(null); // null = fermé, 'new' = création, sinon id
  const [form, setForm] = useState(EMPTY);

  // Total facturé par client (somme des devis rattachés).
  const totalByClient = useMemo(() => {
    const m = new Map();
    (devis || []).forEach((d) => {
      if (d.clientId) m.set(d.clientId, (m.get(d.clientId) || 0) + (d.total || 0));
    });
    return m;
  }, [devis]);

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

  const removeClient = () => {
    if (window.confirm(`Supprimer le client « ${form.name} » ?`)) { deleteProClient(editingId); close(); }
  };

  const rowKey = (e, fn) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };

  return (
    <>
      <div className="pro-actions-row">
        <button className="btn btn-accent" onClick={openNew}>
          <Plus size={16} /> Nouveau client
        </button>
      </div>
      <div className="section-title">Mes clients ({myClients.length})</div>

      {myClients.length ? (
        <div className="flat-list">
          {myClients.map((c) => {
            const total = totalByClient.get(c.id) || 0;
            return (
              <div key={c.id} className="flat-row" role="button" tabIndex={0}
                onClick={() => openEdit(c)} onKeyDown={(e) => rowKey(e, () => openEdit(c))}>
                <div className="flat-row-main">
                  <div className="flat-row-title">{c.name}</div>
                  <div className="flat-row-sub">
                    <span className={`flat-badge ${c.type === 'entreprise' ? '' : 'muted'}`}>{c.type === 'entreprise' ? 'Entreprise' : 'Particulier'}</span>
                    <span className="flat-row-date">{c.phone || c.ville || formatDate(c.createdAt)}</span>
                  </div>
                </div>
                {total > 0 && <div className="flat-row-amount">{nf(total)}<span className="flat-amount-unit">F CFA</span></div>}
              </div>
            );
          })}
        </div>
      ) : <div className="empty-state card">Aucun client. Ajoutez-en un pour l'utiliser dans vos devis et factures.</div>}

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
          {editingId !== 'new' && (
            <button type="button" className="btn btn-lost btn-block" style={{ marginTop: 10 }} onClick={removeClient}>
              <Trash2 size={16} /> Supprimer le client
            </button>
          )}
        </form>
      </Sheet>
    </>
  );
}
