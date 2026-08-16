import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FileText, Plus, Download, Search, Check, Trash2, Pencil, BadgeCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useCart } from '../context/CartContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { fetchAdminPublicDevis } from '../lib/remoteSync';
import { formatCFA, formatDate } from '../utils/format';
import { etatDevis, ETAT_DEVIS_LABEL, joursAvantExpiration, dateExpiration } from '../utils/affaires';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';
import ConfirmSheet from '../components/ConfirmSheet';
import DevisCreator from './devis/DevisCreator';
import DevisEditSheet from './devis/DevisEditSheet';



const SORT_OPTIONS = [
  { id: 'recent', label: 'Plus récents' },
  { id: 'ancien', label: 'Plus anciens' },
  { id: 'montant-desc', label: 'Montant décroissant' },
  { id: 'montant-asc', label: 'Montant croissant' },
];

export default function Devis() {
  const { user } = useAuth();
  const { devis, getLeadById, getPartnerById, products, updateDevis, deleteDevis, updateDevisStage } = useData();

  // Document imprimable (HTML autonome, export PDF par Ctrl+P). L'espace
  // public n'utilise qu'un seul modèle : Studio.
  const ouvrirDocument = async (d) => {
    const [{ openDoc }, { donneesDeDevis }] = await Promise.all([
      import('../utils/docTemplates'),
      import('../utils/docTemplates/shared'),
    ]);
    const { COMPANY } = await import('../config/company');
    openDoc({
      kind: 'devis',
      model: 'studio',
      data: donneesDeDevis({
        devis: d,
        company: COMPANY,
        lead: getLeadById(d.leadId),
        partner: d.partnerId ? getPartnerById(d.partnerId) : null,
        products,
      }),
    });
  };
  // Arrivée depuis le panier de la boutique : assistant manuel pré-rempli.
  // Arrivée depuis une fiche client : création directe, client présélectionné.
  const location = useLocation();
  const fromCart = Boolean(location.state?.fromCart);
  const initialLeadId = location.state?.leadId || null;
  const { items: cartItems, clearCart } = useCart();

  // 'list' | 'create'  (le choix du type + les assistants vivent dans DevisCreator)
  const [view, setView] = useState(fromCart || initialLeadId ? 'create' : 'list');
  const [search, setSearch] = useState('');
  // all | brouillon | en-cours | converti | expire | solar | manual
  const [typeFilter, setTypeFilter] = useState('all');
  const [confirmVente, setConfirmVente] = useState(null);
  const [sortBy, setSortBy] = useState('recent');
  const [editDevis, setEditDevis] = useState(null);
  const [actions, setActions] = useState(null);
  // Brouillon en attente de confirmation de suppression (remplace window.confirm).
  const [confirmDelete, setConfirmDelete] = useState(null);
  const runAction = (fn) => { fn(); setActions(null); };
  const rowKey = (e, fn) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };

  // Vue plateforme (gérant BestaSolar) : les devis publics créés par TOUS les
  // comptes remontent ici en lecture seule — la boutique et le solaire sont
  // l'activité commerciale de BestaSolar. Les devis de l'espace Pro payant
  // restent privés (jamais remontés par la RPC).
  const isAdminPlateforme = isSupabaseConfigured && !!user.is_platform_admin;
  const [devisExternes, setDevisExternes] = useState([]);
  useEffect(() => {
    if (!isAdminPlateforme) return;
    fetchAdminPublicDevis()
      .then((rows) => setDevisExternes((rows || []).map((d) => ({ ...d, _externe: true }))))
      .catch(() => {});
  }, [isAdminPlateforme]);

  // Les devis créés dans l'Espace Pro (type 'pro') restent cantonnés au mode Pro.
  const mesDevis = (user.role === 'gerant' ? devis : devis.filter((d) => d.createdBy === user.id))
    .filter((d) => d.type !== 'pro');
  // Filet de sécurité : jamais MES devis parmi les « externes » (doublons +
  // lecture seule), même si le serveur n'a pas encore le dernier correctif.
  const monOrg = user.org?.id || user.org_id || null;
  const mesDevisIds = new Set(devis.map((d) => d.id));
  const myDevis = [
    ...mesDevis,
    ...devisExternes.filter((d) => d.orgId !== monOrg && !mesDevisIds.has(d.id)),
  ];

  // Recherche (client, numéro, partenaire/code) + filtre type + tri
  const visibleDevis = myDevis
    .filter((d) => {
      if (typeFilter === 'all') return true;
      if (typeFilter === 'solar') return d.type === 'solar';
      if (typeFilter === 'manual') return d.type !== 'solar';
      // Les autres puces filtrent sur l'ÉTAT commercial, qui se déduit de la
      // validité du devis — voir utils/affaires.js.
      return etatDevis(d, d._externe ? null : getLeadById(d.leadId)) === typeFilter;
    })
    .filter((d) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const lead = d._externe ? null : getLeadById(d.leadId);
      const partner = d.partnerId ? getPartnerById(d.partnerId) : null;
      return [d.devisNumber, lead?.name, lead?.contact, d.clientName, d.authorName, d.orgName, partner?.name, d.partnerCode || partner?.code]
        .some((v) => v && v.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (sortBy === 'montant-desc') return b.total - a.total;
      if (sortBy === 'montant-asc') return a.total - b.total;
      const diff = new Date(b.createdAt) - new Date(a.createdAt);
      return sortBy === 'ancien' ? -diff : diff;
    });

  const backToList = () => setView('list');

  // ---- Liste des devis ----
  if (view === 'list') {
    return (
      <div className="page">
        <PageHeader
          title="Devis"
          subtitle={`${myDevis.length} devis créé(s)`}
          actions={
            <>
              <div className="search-box">
                <Search size={18} className="search-icon" />
                <input
                  className="input search-input"
                  aria-label="Rechercher un devis"
                  placeholder="Client, numéro, partenaire…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button className="btn btn-accent" onClick={() => setView('create')}>
                <Plus size={18} /> Nouveau devis
              </button>
            </>
          }
        />
        <div className="page-content">
          {myDevis.length === 0 ? (
            <div className="empty-state card">
              <FileText size={40} strokeWidth={1.5} />
              <p>Aucun devis pour le moment.</p>
              <button className="btn btn-primary" onClick={() => setView('create')}>
                <Plus size={18} /> Créer un devis
              </button>
            </div>
          ) : (
            <>
            <div className="list-toolbar">
              <div className="categories-scroll">
                {[['all', 'Tous'], ['en-cours', 'En cours'], ['converti', 'Convertis'], ['expire', 'Expirés'], ['brouillon', 'Brouillons'], ['solar', 'Solaires'], ['manual', 'Manuels']].map(([id, label]) => (
                  <button key={id} className={`category-chip ${typeFilter === id ? 'active' : ''}`} aria-pressed={typeFilter === id} onClick={() => setTypeFilter(id)}>{label}</button>
                ))}
              </div>
              <select className="input sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Trier les devis">
                {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            {(search.trim() !== '' || typeFilter !== 'all') && (
              <div className="filter-status" role="status">
                {visibleDevis.length} devis affiché{visibleDevis.length > 1 ? 's' : ''} sur {myDevis.length}
              </div>
            )}
            {visibleDevis.length === 0 && <div className="empty-state card">Aucun devis ne correspond à votre recherche.</div>}
            <div className="flat-list">
              {visibleDevis.map((d) => {
                const lead = d._externe ? null : getLeadById(d.leadId);
                const etat = etatDevis(d, lead);
                const restants = joursAvantExpiration(d);
                const bcls = { brouillon: 'muted', converti: 'success', expire: 'danger', perdu: 'muted' }[etat] || '';
                return (
                  <div key={`${d.orgId || ''}-${d.id}`} className="flat-row" role="button" tabIndex={0}
                    onClick={() => setActions(d)} onKeyDown={(e) => rowKey(e, () => setActions(d))}>
                    <div className="flat-row-main">
                      <div className="flat-row-title">{d.devisNumber ? `${d.devisNumber} - ` : ''}{lead?.name || d.clientName || 'Client supprimé'}</div>
                      <div className="flat-row-sub">
                        <span className={`flat-badge ${bcls}`}>{ETAT_DEVIS_LABEL[etat]}</span>
                        {/* Le compte à rebours n'apparaît qu'à l'approche : affiché
                            en permanence, il deviendrait du décor qu'on ne lit plus. */}
                        {etat === 'en-cours' && restants != null && restants <= 7 && (
                          <span className="flat-badge warning">{restants === 0 ? 'Expire aujourd’hui' : `Expire dans ${restants} j`}</span>
                        )}
                        <span className="flat-row-date">
                          {formatDate(d.createdAt)} · {d.type === 'solar' ? (d.sousType === 'pompage' ? 'Pompage solaire' : 'Solaire') : 'Comptant'}
                          {d._externe && ` · par ${d.authorName || d.orgName}`}
                        </span>
                      </div>
                    </div>
                    <div className="flat-row-amount">{formatCFA(d.total)}</div>
                  </div>
                );
              })}
            </div>
            </>
          )}
        </div>
        <DevisEditSheet open={!!editDevis} onClose={() => setEditDevis(null)} devis={editDevis} />
        <Sheet open={!!actions} onClose={() => setActions(null)} title={actions?.devisNumber || 'Devis'}>
          {actions && (
            <div className="doc-actions-list">
              <div className="sheet-row"><span className="sheet-label">Client</span><span className="sheet-value">{(actions._externe ? actions.clientName : getLeadById(actions.leadId)?.name) || 'Client'}</span></div>
              <div className="sheet-row"><span className="sheet-label">Total</span><span className="sheet-value amount">{formatCFA(actions.total)}</span></div>
              {actions._externe && (
                <div className="sheet-row"><span className="sheet-label">Créé par</span><span className="sheet-value">{actions.authorName || '—'}{actions.orgName && actions.orgName !== actions.authorName ? ` · ${actions.orgName}` : ''}</span></div>
              )}
              {actions.partnerId && !actions._externe && (
                <div className="sheet-row"><span className="sheet-label">Partenaire</span><span className="sheet-value">{getPartnerById(actions.partnerId)?.name}{(actions.partnerCode || getPartnerById(actions.partnerId)?.code) ? ` · ${actions.partnerCode || getPartnerById(actions.partnerId)?.code}` : ''}</span></div>
              )}
              {/* Validité : imprimée sur le document, elle engage le prix. On la
                  montre ici pour que la décision de relancer ou de convertir se
                  prenne sans rouvrir le PDF. */}
              {actions.statut !== 'brouillon' && dateExpiration(actions) && (
                <div className="sheet-row">
                  <span className="sheet-label">
                    {etatDevis(actions, actions._externe ? null : getLeadById(actions.leadId)) === 'converti' ? 'Vendu' : 'Valable jusqu’au'}
                  </span>
                  <span className="sheet-value">
                    {etatDevis(actions, actions._externe ? null : getLeadById(actions.leadId)) === 'converti'
                      ? `${formatDate(actions.wonAt)} · ${formatCFA(actions.montantVente ?? actions.total)}`
                      : formatDate(dateExpiration(actions))}
                  </span>
                </div>
              )}
              <button className="btn btn-primary btn-block" onClick={() => runAction(() => ouvrirDocument(actions))}><Download size={16} /> Devis imprimable (PDF)</button>
              {/* Un devis d'un autre compte se consulte : il s'édite chez son auteur. */}
              {!actions._externe && (
                <>
                  <button className="btn btn-outline btn-block" onClick={() => { setEditDevis(actions); setActions(null); }}><Pencil size={16} /> Éditer</button>
                  {actions.statut === 'brouillon' && (
                    <>
                      <button className="btn btn-won btn-block" onClick={() => runAction(() => updateDevis(actions.id, { statut: 'finalise' }))}><Check size={16} /> Finaliser</button>
                      <button className="btn btn-lost btn-block" onClick={() => setConfirmDelete(actions.id)}><Trash2 size={16} /> Supprimer le brouillon</button>
                    </>
                  )}
                  {/* « Convertir en vente » : le maillon central du cahier des
                      charges — c'est ce geste qui rattache la vente au bon
                      apporteur et déclenche sa commission. Réservé au gérant,
                      comme toute validation qui engage de l'argent. Un devis
                      expiré reste convertible : le client peut revenir, et
                      c'est au gérant d'en décider, pas au calendrier. */}
                  {user.role === 'gerant' && actions.statut !== 'brouillon'
                    && !['converti', 'perdu'].includes(etatDevis(actions, getLeadById(actions.leadId))) && (
                    <button className="btn btn-won btn-block" onClick={() => setConfirmVente(actions)}>
                      <BadgeCheck size={16} /> Convertir en vente
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </Sheet>
        <ConfirmSheet
          open={!!confirmVente}
          onClose={() => setConfirmVente(null)}
          onConfirm={() => { updateDevisStage(confirmVente.id, 'gagne'); setConfirmVente(null); setActions(null); }}
          title="Convertir ce devis en vente"
          message={confirmVente
            ? `L'affaire passe en « Gagné » et la commission de l'apporteur est générée sur ${formatCFA(confirmVente.total)}. Ce montant est figé : éditer le devis ensuite ne le changera plus.`
            : ''}
          confirmLabel="Convertir en vente"
        />
        <ConfirmSheet
          open={!!confirmDelete}
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => { deleteDevis(confirmDelete); setActions(null); }}
          title="Supprimer ce brouillon"
          message="Le brouillon sera définitivement supprimé."
          confirmLabel="Supprimer"
          danger
        />
      </div>
    );
  }

  // ---- Création (choix du type + assistants, mutualisés via DevisCreator) ----
  return (
    <div className="page">
      <PageHeader
        title="Nouveau devis"
        actions={<button className="btn btn-outline-light" onClick={backToList}>Annuler</button>}
      />
      <div className="page-content">
        <DevisCreator
          startManual={fromCart}
          initialManualItems={fromCart ? cartItems : undefined}
          initialLeadId={initialLeadId}
          onDone={() => { if (fromCart) clearCart(); backToList(); }}
        />
      </div>
    </div>
  );
}
