import { useMemo, useState } from 'react';
import { Plus, User, Phone, Mail, MapPin, Check, Pencil, Send, FileText, Receipt, UserPlus } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { formatCFA, formatDate } from '../../../utils/format';
import {
  resteAPayer, montantPaye, isEnRetard, statutEffectif,
  STATUT_EFFECTIF_LABEL, STATUT_EFFECTIF_BADGE, relanceMessage, whatsappLink,
} from '../../../utils/paiement';
import Sheet from '../../../components/Sheet';
import Field from '../../../components/Field';
import ClientIdentityFields, { contactEffectif } from '../../../components/ClientIdentityFields';
import DangerZone from '../../../components/DangerZone';
import { useToast } from '../../../components/Toast';

const EMPTY = { name: '', contact: '', phone: '', email: '', ville: '', type: 'particulier' };

const norm = (s) => (s || '').trim().toLowerCase();

/** Onglet « Clients » : carnet du technicien + fiche client (historique, solde, relance). */
export default function ClientsTab({ company }) {
  const { user } = useAuth();
  const { proClientsForUser, devis, factures, addProClient, updateProClient, deleteProClient, addRelance, leadsForUser } = useData();
  const toast = useToast();

  const myClients = proClientsForUser(user.id);
  // Passerelle avec le carnet public : les clients du pipeline importables
  // dans le carnet Pro (pas de ressaisie en changeant de mode).
  const importables = useMemo(() => {
    const deja = new Set(myClients.map((c) => norm(c.name)));
    return leadsForUser(user).filter((l) => !deja.has(norm(l.name)));
  }, [myClients, leadsForUser, user]);
  const [importOpen, setImportOpen] = useState(false);
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
    setForm({ name: c.name, contact: c.contact || '', phone: c.phone || '', email: c.email || '', ville: c.ville || '', type: c.type || 'particulier' });
    setViewId(null);
    setEditingId(c.id);
  };
  const close = () => setEditingId(null);

  const submit = (e) => {
    e.preventDefault();
    const data = { name: form.name.trim(), contact: contactEffectif(form).trim(), phone: form.phone.trim(), email: form.email.trim(), ville: form.ville.trim(), type: form.type };
    if (!data.name) return;
    if (editingId === 'new') addProClient({ userId: user.id, ...data });
    else updateProClient(editingId, data);
    close();
  };

  // Relance : cible la facture impayée la plus ancienne (retards d'abord).
  // La cible est calculée en amont pour que le bouton NOMME la facture visée
  // (le client reçoit un message sur une facture, pas sur tout le solde).
  const factureARelancer = (fs) => fs
    .filter((f) => f.statut !== 'brouillon' && resteAPayer(f) > 0)
    .sort((a, b) => (isEnRetard(b) - isEnRetard(a)) || (new Date(a.createdAt) - new Date(b.createdAt)))[0];
  const relancer = (client, cible) => {
    if (!cible) return;
    window.open(whatsappLink(client.phone, relanceMessage(cible, company)), '_blank', 'noopener');
    addRelance(cible.id, 'whatsapp');
    toast(`Relance envoyée pour ${cible.numero} (${formatCFA(resteAPayer(cible))}).`);
  };

  // Import d'un client du carnet public (pipeline) vers le carnet Pro.
  const importerLead = (l) => {
    addProClient({
      userId: user.id,
      name: l.name,
      contact: l.contact || '',
      phone: l.phone || '',
      email: l.email || '',
      ville: l.address || '',
      type: l.clientType === 'entreprise' ? 'entreprise' : 'particulier',
    });
    toast(`${l.name} ajouté à votre carnet Pro.`);
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
        {importables.length > 0 && (
          <button className="btn btn-outline" onClick={() => setImportOpen(true)}>
            <UserPlus size={16} /> Importer depuis mes clients
          </button>
        )}
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
                    {/* La nature du client vit dans le sous-titre ; l'état de
                        recouvrement, à droite — une colonne = une information. */}
                    {b?.retard && <span className="flat-badge danger">En retard</span>}
                    <span className="flat-row-date">
                      {c.type === 'entreprise' ? 'Entreprise' : 'Particulier'}
                      {c.ville ? ` · ${c.ville}` : ''}
                      {b?.nbFactures ? ` · ${b.nbFactures} facture${b.nbFactures > 1 ? 's' : ''}` : ` · client depuis le ${formatDate(c.createdAt)}`}
                    </span>
                  </div>
                </div>
                {b?.reste > 0 ? (
                  <div className="flat-row-amount">{formatCFA(b.reste)}<span className="flat-amount-unit">reste dû</span></div>
                ) : b?.facture > 0 ? (
                  <div className="flat-row-amount"><span className="flat-badge success">Soldé</span></div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : <div className="empty-state card">Aucun client. Ajoutez-en un pour l'utiliser dans vos devis et factures.</div>}

      {/* Fiche client : identité, bilan, historique des documents */}
      <Sheet open={!!viewed} onClose={() => setViewId(null)} title={viewed?.name || ''}>
        {viewed && (
          <div className="doc-actions-list">
            <div className="sheet-section">
              <div className="sheet-section-title">Contact</div>
              <div className="sheet-row"><span className="sheet-label">Type</span><span className="sheet-value">{viewed.type === 'entreprise' ? 'Entreprise' : 'Particulier'}</span></div>
              {/* Un particulier est son propre contact : la ligne n'apparaît que pour une entreprise. */}
              {viewed.type === 'entreprise' && viewed.contact && (
                <div className="sheet-row"><span className="sheet-label"><User size={14} /> Contact</span><span className="sheet-value">{viewed.contact}</span></div>
              )}
              {viewed.phone && (
                <div className="sheet-row">
                  <span className="sheet-label"><Phone size={14} /> Téléphone</span>
                  <a className="sheet-value sheet-link" href={`tel:${viewed.phone.replace(/\s/g, '')}`}>{viewed.phone}</a>
                </div>
              )}
              {viewed.email && (
                <div className="sheet-row">
                  <span className="sheet-label"><Mail size={14} /> Email</span>
                  <a className="sheet-value sheet-link" href={`mailto:${viewed.email}`}>{viewed.email}</a>
                </div>
              )}
              {viewed.ville && <div className="sheet-row"><span className="sheet-label"><MapPin size={14} /> Ville</span><span className="sheet-value">{viewed.ville}</span></div>}
              <div className="sheet-row"><span className="sheet-label">Client depuis</span><span className="sheet-value">{formatDate(viewed.createdAt)}</span></div>
              {viewed.google_contact_sync_status && (
                <div className="sheet-row"><span className="sheet-label">Google Contacts</span><span className="sheet-value">{{ pending: 'En attente', synced: 'Synchronisé', already_exists: 'Synchronisé (contact existant)', failed: 'Échec — nouvelle tentative prévue' }[viewed.google_contact_sync_status] || viewed.google_contact_sync_status}</span></div>
              )}
            </div>

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
                <div className="client-bilan-label">Reste à payer</div>
              </div>
            </div>

            {(viewedDocs.factures.length > 0 || viewedDocs.devis.length > 0) && (
              <>
                <div className="sheet-section-title">Historique ({viewedDocs.devis.length} devis · {viewedDocs.factures.length} facture(s))</div>
                <div className="client-history">
                  {/* Factures et devis fusionnés, du plus récent au plus ancien. */}
                  {[
                    ...viewedDocs.factures.map((f) => ({ kind: 'facture', doc: f })),
                    ...viewedDocs.devis.map((d) => ({ kind: 'devis', doc: d })),
                  ]
                    .sort((a, b) => new Date(b.doc.createdAt) - new Date(a.doc.createdAt))
                    .map(({ kind, doc }) => {
                      if (kind === 'facture') {
                        const eff = statutEffectif(doc);
                        return (
                          <div key={doc.id} className="client-history-row">
                            <Receipt size={15} />
                            <span className="client-history-title">{doc.numero}</span>
                            <span className={`flat-badge ${STATUT_EFFECTIF_BADGE[eff]}`}>{STATUT_EFFECTIF_LABEL[eff]}</span>
                            <span className="client-history-amount">{formatCFA(doc.totalTTC)}</span>
                          </div>
                        );
                      }
                      return (
                        <div key={doc.id} className="client-history-row">
                          <FileText size={15} />
                          <span className="client-history-title">{doc.devisNumber}</span>
                          <span className={`flat-badge ${doc.statut === 'brouillon' ? 'muted' : ''}`}>{doc.statut === 'brouillon' ? 'Brouillon' : 'Finalisé'}</span>
                          <span className="client-history-amount">{formatCFA(doc.total)}</span>
                        </div>
                      );
                    })}
                </div>
              </>
            )}

            {viewedBilan?.reste > 0 && viewed.phone && (() => {
              const cible = factureARelancer(viewedDocs.factures);
              return cible ? (
                <button className="btn btn-won btn-block" onClick={() => relancer(viewed, cible)}>
                  <Send size={16} /> Relancer {cible.numero} · {formatCFA(resteAPayer(cible))}
                </button>
              ) : null;
            })()}
            <button className="btn btn-outline btn-block" onClick={() => openEdit(viewed)}>
              <Pencil size={16} /> Modifier le client
            </button>
          </div>
        )}
      </Sheet>

      {/* Formulaire création / édition */}
      <Sheet open={editingId !== null} onClose={close} title={editingId === 'new' ? 'Nouveau client' : 'Modifier le client'}>
        <form onSubmit={submit}>
          {/* Identité adaptée au type : une entreprise a un nom ET une
              personne de contact — le champ manquait ici, seule la raison
              sociale était demandée. Composant partagé avec le carnet public. */}
          <ClientIdentityFields
            idPrefix="proclient"
            clientType={form.type}
            onTypeChange={(type) => setForm({ ...form, type })}
            name={form.name}
            onNameChange={(name) => setForm({ ...form, name })}
            contact={form.contact}
            onContactChange={(contact) => setForm({ ...form, contact })}
          />
          <div className="form-row-2">
            <Field label={<><Phone size={13} /> Téléphone</>}>
              <input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+228 ..." />
            </Field>
            <Field label={<><MapPin size={13} /> Ville</>}>
              <input className="input" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} />
            </Field>
          </div>
          <Field label={<><Mail size={13} /> Email</>}>
            <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="client@exemple.com" />
          </Field>
          <button type="submit" className="btn btn-primary btn-block"><Check size={17} /> {editingId === 'new' ? 'Ajouter le client' : 'Enregistrer'}</button>
          {editingId !== 'new' && (
            <DangerZone
              label="Supprimer le client"
              message={`« ${form.name} » sera retiré de votre carnet Pro. Ses devis et factures existants sont conservés.`}
              onConfirm={() => { deleteProClient(editingId); close(); }}
            />
          )}
        </form>
      </Sheet>

      {/* Import depuis le carnet public (pipeline) */}
      <Sheet open={importOpen} onClose={() => setImportOpen(false)} title="Importer depuis mes clients"
        subtitle="Clients de votre suivi commercial absents du carnet Pro">
        {importables.length ? (
          <div className="lead-select">
            {importables.map((l) => (
              <button key={l.id} type="button" className="lead-select-item" onClick={() => importerLead(l)}>
                <div className="lead-select-name">{l.name}</div>
                <div className="lead-select-value">
                  {l.clientType === 'entreprise' ? 'Entreprise' : 'Particulier'}
                  {l.phone ? ` · ${l.phone}` : ''}{l.address ? ` · ${l.address}` : ''}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-secondary">Tous vos clients du suivi commercial sont déjà dans le carnet Pro.</p>
        )}
      </Sheet>
    </>
  );
}
