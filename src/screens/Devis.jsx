import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FileText, Plus, Download, Search, Check, Trash2, Pencil } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useCart } from '../context/CartContext';
import {formatCFA, formatDate, formatNombre as nf } from '../utils/format';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';
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
  const { devis, getLeadById, getPartnerById, products, updateDevis, deleteDevis } = useData();

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
  const [typeFilter, setTypeFilter] = useState('all'); // all | brouillon | solar | manual
  const [sortBy, setSortBy] = useState('recent');
  const [editDevis, setEditDevis] = useState(null);
  const [actions, setActions] = useState(null);
  const runAction = (fn) => { fn(); setActions(null); };
  const rowKey = (e, fn) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };

  // Les devis créés dans l'Espace Pro (type 'pro') restent cantonnés au mode Pro.
  const myDevis = (user.role === 'gerant' ? devis : devis.filter((d) => d.createdBy === user.id))
    .filter((d) => d.type !== 'pro');

  // Recherche (client, numéro, partenaire/code) + filtre type + tri
  const visibleDevis = myDevis
    .filter((d) => typeFilter === 'all'
      || (typeFilter === 'brouillon' ? d.statut === 'brouillon'
        : typeFilter === 'solar' ? d.type === 'solar' : d.type !== 'solar'))
    .filter((d) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const lead = getLeadById(d.leadId);
      const partner = d.partnerId ? getPartnerById(d.partnerId) : null;
      return [d.devisNumber, lead?.name, lead?.contact, partner?.name, d.partnerCode || partner?.code]
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
                {[['all', 'Tous'], ['brouillon', 'Brouillons'], ['solar', 'Solaires'], ['manual', 'Manuels']].map(([id, label]) => (
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
                const lead = getLeadById(d.leadId);
                const [bcls, blabel] = d.statut === 'brouillon' ? ['muted', 'Brouillon'] : ['', 'Finalisé'];
                return (
                  <div key={d.id} className="flat-row" role="button" tabIndex={0}
                    onClick={() => setActions(d)} onKeyDown={(e) => rowKey(e, () => setActions(d))}>
                    <div className="flat-row-main">
                      <div className="flat-row-title">{d.devisNumber ? `${d.devisNumber} - ` : ''}{lead?.name || 'Client supprimé'}</div>
                      <div className="flat-row-sub">
                        <span className={`flat-badge ${bcls}`}>{blabel}</span>
                        <span className="flat-row-date">{formatDate(d.createdAt)} · {d.type === 'solar' ? 'Solaire' : 'Comptant'}</span>
                      </div>
                    </div>
                    <div className="flat-row-amount">{nf(d.total)}<span className="flat-amount-unit">F CFA</span></div>
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
              <div className="sheet-row"><span className="sheet-label">Client</span><span className="sheet-value">{getLeadById(actions.leadId)?.name || 'Client'}</span></div>
              <div className="sheet-row"><span className="sheet-label">Total</span><span className="sheet-value amount">{formatCFA(actions.total)}</span></div>
              {actions.partnerId && (
                <div className="sheet-row"><span className="sheet-label">Partenaire</span><span className="sheet-value">{getPartnerById(actions.partnerId)?.name}{(actions.partnerCode || getPartnerById(actions.partnerId)?.code) ? ` · ${actions.partnerCode || getPartnerById(actions.partnerId)?.code}` : ''}</span></div>
              )}
              <button className="btn btn-primary btn-block" onClick={() => runAction(() => ouvrirDocument(actions))}><Download size={16} /> Devis imprimable (PDF)</button>
              <button className="btn btn-outline btn-block" onClick={() => { setEditDevis(actions); setActions(null); }}><Pencil size={16} /> Éditer</button>
              {actions.statut === 'brouillon' && (
                <>
                  <button className="btn btn-won btn-block" onClick={() => runAction(() => updateDevis(actions.id, { statut: 'finalise' }))}><Check size={16} /> Finaliser</button>
                  <button className="btn btn-lost btn-block" onClick={() => { if (window.confirm('Supprimer ce brouillon ?')) runAction(() => deleteDevis(actions.id)); }}><Trash2 size={16} /> Supprimer le brouillon</button>
                </>
              )}
            </div>
          )}
        </Sheet>
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
