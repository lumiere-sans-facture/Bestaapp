import { useMemo, useState } from 'react';
import { Plus, Trash2, User, Building2, Phone, MapPin, Check, Pencil, Send, FileText, Receipt } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { formatCFA, formatDate } from '../../../utils/format';
import {
  resteAPayer, montantPaye, isEnRetard, statutEffectif,
  STATUT_EFFECTIF_LABEL, STATUT_EFFECTIF_BADGE, relanceMessage, whatsappLink,
} from '../../../utils/paiement';
import Sheet from '../../../components/Sheet';
import Field from '../../../components/Field';

const EMPTY = { name: '', phone: '', ville: '', type: 'particulier' };
const nf = (v) => Math.round(v || 0).toLocaleString('fr-FR');
const norm = (s) => (s || '').trim().toLowerCase();

/** Onglet « Clients » : carnet du technicien + fiche client (historique, solde, relance). */
export default function ClientsTab({ company }) {
  const { user } = useAuth();
  const { proClientsForUser, devis, factures, addProClient, updateProClient, deleteProClient, addRelance } = useData();

  const myClients = proClientsForUser(user.id);
  const myDevis = useMemo(() => (devis || []).filter((d) => d.createdBy === user.id), [devis, user.id]);
  const myFactures = useMemo(() => (factures || []).filter((f) => f.userId === user.id), [factures, user.id]);

  const [viewId, setViewId] = useState(null); // fiche client ouverte
  const [editingId, setEditingId] = useState(null); // null = fermé, 'new' = création, sinon id
  const [form, setForm] = useState(EMPTY);

  // Documents d'un client : rattachés par clientId, ou par nom pour l'historique
  // antérieur au carnet (factures créées avant le lien clientId).
  const docsOf = (client) => {
    const matches = (doc) => doc.clientId === client.id || (!doc.clientId && norm(doc.clientName) === norm(client.name));
    return {
      devis: myDevis.filter(matches),
      factures: myFactures.filter(matches),
    };
  };

  // Agrégats par client pour la liste (total facturé hors brouillons).
  const bilanByClient = useMemo(() => {
    const m = new Map();
    myClients.forEach((c) => {
      const { factures: fs, devis: ds } = docsOf(c);
      const emises = fs.filter((f) => f.statut !== 'brouillon');
      m.set(c.id, {
        facture: emises.reduce((s, f) => s + (f.totalTTC || 0), 0),
        encaisse: emises.reduce((s, f) => s + montantPaye(f), 0),
        reste: emises.reduce((s, f) => s + resteAPayer(f), 0),
        retard: emises.some((f) => isEnRetard(f)),
        nbDevis: ds.length,
        nbFactures: fs.length,
      });
    });
    return m;
    // docsOf dépend de myDevis/myFactures, couverts par les dépendances.
  }, [myClients, myDevis, myFactures]); // eslint-disable-line react-hooks/exhaustive-deps

  const openNew = () => { setForm(EMPTY); setEditingId('new'); };
  const openEdit = (c) => {
    setForm({ name: c.name, phone: c.phone || '', ville: c.ville || '', type: c.type || 'particulier' });
    setViewId(null);
    setEditingId(c.id);
  };
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

  // Relance : cible la facture impayée la plus ancienne (retards d'abord).
  const relancer = (client, fs) => {
    const dues = fs.filter((f) => f.statut !== 'brouillon' && resteAPayer(f) > 0)
      .sort((a, b) => (isEnRetard(b) - isEnRetard(a)) || (new Date(a.createdAt) - new Date(b.createdAt)));
    const cible = dues[0];
    if (!cible) return;
    window.open(whatsappLink(client.phone, relanceMessage(cible, company)), '_blank', 'noopener');
    addRelance(cible.id, 'whatsapp');
  };

  const rowKey = (e, fn) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };

  const viewed = viewId ? myClients.find((c) => c.id === viewId) : null;
  const viewedDocs = viewed ? docsOf(viewed) : null;
  const viewedBilan = viewed ? bilanByClient.get(viewed.id) : null;

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
            const b = bilanByClient.get(c.id);
            return (
              <div key={c.id} className="flat-row" role="button" tabIndex={0}
                onClick={() => setViewId(c.id)} onKeyDown={(e) => rowKey(e, () => setViewId(c.id))}>
                <div className="flat-row-main">
                  <div className="flat-row-title">{c.name}</div>
                  <div className="flat-row-sub">
                    {b?.retard ? (
                      <span className="flat-badge danger">En retard</span>
                    ) : b?.reste > 0 ? (
                      <span className="flat-badge warning">Doit {nf(b.reste)} F</span>
                    ) : (
                      <span className={`flat-badge ${c.type === 'entreprise' ? '' : 'muted'}`}>{c.type === 'entreprise' ? 'Entreprise' : 'Particulier'}</span>
                    )}
                    <span className="flat-row-date">{c.phone || c.ville || formatDate(c.createdAt)}</span>
                  </div>
                </div>
                {b?.facture > 0 && <div className="flat-row-amount">{nf(b.facture)}<span className="flat-amount-unit">F CFA</span></div>}
              </div>
            );
          })}
        </div>
      ) : <div className="empty-state card">Aucun client. Ajoutez-en un pour l'utiliser dans vos devis et factures.</div>}

      {/* Fiche client : identité, bilan, historique des documents */}
      <Sheet open={!!viewed} onClose={() => setViewId(null)} title={viewed?.name || ''}>
        {viewed && (
          <div className="doc-actions-list">
            <div className="sheet-row"><span className="sheet-label">Type</span><span className="sheet-value">{viewed.type === 'entreprise' ? 'Entreprise' : 'Particulier'}</span></div>
            {viewed.phone && <div className="sheet-row"><span className="sheet-label">Téléphone</span><span className="sheet-value">{viewed.phone}</span></div>}
            {viewed.ville && <div className="sheet-row"><span className="sheet-label">Ville</span><span className="sheet-value">{viewed.ville}</span></div>}
            <div className="sheet-row"><span className="sheet-label">Client depuis</span><span className="sheet-value">{formatDate(viewed.createdAt)}</span></div>

            <div className="client-bilan">
              <div className="client-bilan-item">
                <div className="client-bilan-value">{formatCFA(viewedBilan?.facture || 0)}</div>
                <div className="client-bilan-label">Facturé</div>
              </div>
              <div className="client-bilan-item ok">
                <div className="client-bilan-value">{formatCFA(viewedBilan?.encaisse || 0)}</div>
                <div className="client-bilan-label">Encaissé</div>
              </div>
              <div className={`client-bilan-item ${viewedBilan?.retard ? 'ko' : ''}`}>
                <div className="client-bilan-value">{formatCFA(viewedBilan?.reste || 0)}</div>
                <div className="client-bilan-label">Reste dû</div>
              </div>
            </div>

            {(viewedDocs.factures.length > 0 || viewedDocs.devis.length > 0) && (
              <>
                <div className="input-label">Historique ({viewedDocs.devis.length} devis · {viewedDocs.factures.length} facture(s))</div>
                <div className="client-history">
                  {viewedDocs.factures.map((f) => {
                    const eff = statutEffectif(f);
                    return (
                      <div key={f.id} className="client-history-row">
                        <Receipt size={15} />
                        <span className="client-history-title">{f.numero}</span>
                        <span className={`flat-badge ${STATUT_EFFECTIF_BADGE[eff]}`}>{STATUT_EFFECTIF_LABEL[eff]}</span>
                        <span className="client-history-amount">{nf(f.totalTTC)} F</span>
                      </div>
                    );
                  })}
                  {viewedDocs.devis.map((d) => (
                    <div key={d.id} className="client-history-row">
                      <FileText size={15} />
                      <span className="client-history-title">{d.devisNumber}</span>
                      <span className={`flat-badge ${d.statut === 'brouillon' ? 'muted' : ''}`}>{d.statut === 'brouillon' ? 'Brouillon' : 'Devis'}</span>
                      <span className="client-history-amount">{nf(d.total)} F</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {viewedBilan?.reste > 0 && viewed.phone && (
              <button className="btn btn-won btn-block" onClick={() => relancer(viewed, viewedDocs.factures)}>
                <Send size={16} /> Relancer par WhatsApp ({formatCFA(viewedBilan.reste)})
              </button>
            )}
            <button className="btn btn-outline btn-block" onClick={() => openEdit(viewed)}>
              <Pencil size={16} /> Modifier le client
            </button>
          </div>
        )}
      </Sheet>

      {/* Formulaire création / édition */}
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
