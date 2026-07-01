import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FileText, Plus, Sun, ShoppingCart, Download, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useCart } from '../context/CartContext';
import { formatCFA, formatDate } from '../utils/format';
import PageHeader from '../components/PageHeader';
import DevisCreator from './devis/DevisCreator';

const SORT_OPTIONS = [
  { id: 'recent', label: 'Plus récents' },
  { id: 'ancien', label: 'Plus anciens' },
  { id: 'montant-desc', label: 'Montant décroissant' },
  { id: 'montant-asc', label: 'Montant croissant' },
];

export default function Devis() {
  const { user } = useAuth();
  const { devis, getLeadById, getPartnerById, products } = useData();

  // jsPDF est chargé à la demande pour ne pas alourdir le chargement initial
  const downloadPdf = async (d) => {
    const { generateDevisPdf } = await import('../utils/devisPdf');
    generateDevisPdf(d, getLeadById(d.leadId), d.partnerId ? getPartnerById(d.partnerId) : null, products);
  };
  // Arrivée depuis le panier de la boutique : assistant manuel pré-rempli
  const location = useLocation();
  const fromCart = Boolean(location.state?.fromCart);
  const { items: cartItems, clearCart } = useCart();

  // 'list' | 'create'  (le choix du type + les assistants vivent dans DevisCreator)
  const [view, setView] = useState(fromCart ? 'create' : 'list');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all | solar | manual
  const [sortBy, setSortBy] = useState('recent');

  // Les devis créés dans l'Espace Pro (type 'pro') restent cantonnés au mode Pro.
  const myDevis = (user.role === 'gerant' ? devis : devis.filter((d) => d.createdBy === user.id))
    .filter((d) => d.type !== 'pro');

  // Recherche (client, numéro, partenaire/code) + filtre type + tri
  const visibleDevis = myDevis
    .filter((d) => typeFilter === 'all' || (typeFilter === 'solar' ? d.type === 'solar' : d.type !== 'solar'))
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
                {[['all', 'Tous'], ['solar', 'Solaires'], ['manual', 'Manuels']].map(([id, label]) => (
                  <button key={id} className={`category-chip ${typeFilter === id ? 'active' : ''}`} onClick={() => setTypeFilter(id)}>{label}</button>
                ))}
              </div>
              <select className="input sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Trier les devis">
                {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            {visibleDevis.length === 0 && <div className="empty-state card">Aucun devis ne correspond à votre recherche.</div>}
            <div className="devis-list">
              {visibleDevis.map((d) => {
                const lead = getLeadById(d.leadId);
                const isSolar = d.type === 'solar';
                return (
                  <div key={d.id} className="card devis-card">
                    <div className="devis-card-header">
                      <div>
                        <div className="devis-card-lead">{lead?.name || 'Client supprimé'}</div>
                        <div className="text-sm text-secondary">
                          {d.devisNumber ? `${d.devisNumber} · ` : ''}{formatDate(d.createdAt)} · {isSolar ? 'Devis solaire' : 'Comptant'}
                        </div>
                        {d.partnerId && (
                          <div className="devis-partner-tag">
                            Partenaire : {getPartnerById(d.partnerId)?.name}
                            {(d.partnerCode || getPartnerById(d.partnerId)?.code) && (
                              <span className="partner-code-chip">{d.partnerCode || getPartnerById(d.partnerId)?.code}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="devis-card-total">{formatCFA(d.total)}</div>
                    </div>
                    <div className="devis-card-meta">
                      {isSolar ? (
                        <span className="devis-type-tag solar"><Sun size={13} /> {d.sizing?.numberOfPanels ?? '—'} panneaux · {(d.sizing?.panelCapacity ?? 0).toFixed(1)} kWc</span>
                      ) : (
                        <span className="devis-type-tag"><ShoppingCart size={13} /> {(d.items || []).reduce((s, it) => s + it.qty, 0)} article(s)</span>
                      )}
                      <span className="devis-card-actions">
                        <button className="btn btn-sm btn-primary" onClick={() => downloadPdf(d)}>
                          <Download size={14} /> PDF
                        </button>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            </>
          )}
        </div>
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
          onDone={() => { if (fromCart) clearCart(); backToList(); }}
        />
      </div>
    </div>
  );
}
