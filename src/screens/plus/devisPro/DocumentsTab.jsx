import { useMemo, useState } from 'react';
import { Receipt, FileText, Download, Plus, Trash2, Building2, ShoppingCart, PanelTop, ChevronLeft, Search, CheckCircle } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { formatCFA, formatDate } from '../../../utils/format';
import { computeFactureTotals, FACTURE_STATUT_LABEL } from '../../../utils/facture';
import { exportDevisProPdf, exportFacturePdf } from './proPdf';
import FactureSheet from './FactureSheet';
import ProDevisBuilder from './ProDevisBuilder';
import ProSolarWizard from './ProSolarWizard';
import Sheet from '../../../components/Sheet';

const badgeClass = (s) => (s === 'payee' ? 'badge-success' : s === 'emise' ? 'badge-warning' : 'badge-muted');
const nextStatut = (s) => (s === 'brouillon' ? 'emise' : 'payee');
const nextStatutLabel = (s) => (s === 'brouillon' ? 'Marquer émise' : 'Marquer payée');

const SORTS = [['recent', 'Plus récents'], ['ancien', 'Plus anciens'], ['montant', 'Montant décroissant']];
const FACTURE_FILTERS = [['all', 'Tous'], ['emise', 'Émises'], ['payee', 'Payées'], ['brouillon', 'Brouillons']];
const DEVIS_FILTERS = [['all', 'Tous'], ['brouillon', 'Brouillons'], ['tofacture', 'À facturer'], ['factured', 'Facturés']];

/** Écran « Devis & Factures » : bascule Devis/Factures, recherche + filtres + tri,
 *  cartes cliquables ouvrant un menu d'actions. */
export default function DocumentsTab({ company, modeleDefaut, onGoTo }) {
  const { user } = useAuth();
  const { devis, products, factures, getLeadById, addFacture, updateFacture, deleteFacture, markDevisPro, updateDevis, deleteDevis } = useData();

  const [tab, setTab] = useState('factures'); // devis | factures
  const [view, setView] = useState('list'); // list | create
  const [createMode, setCreateMode] = useState('choose'); // choose | solar | manual
  const [factureOpen, setFactureOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [actions, setActions] = useState(null); // { kind:'facture'|'devis', doc }

  const myDevis = useMemo(() => devis.filter((d) => d.createdBy === user.id), [devis, user.id]);
  const myFactures = useMemo(() => (factures || []).filter((f) => f.userId === user.id), [factures, user.id]);
  const factureByDevis = useMemo(() => new Map(myFactures.filter((f) => f.devisId).map((f) => [f.devisId, f])), [myFactures]);
  const devisById = useMemo(() => new Map(myDevis.map((d) => [d.id, d])), [myDevis]);

  const aEncaisser = myFactures.filter((f) => f.statut === 'emise').reduce((s, f) => s + f.totalTTC, 0);
  const encaisse = myFactures.filter((f) => f.statut === 'payee').reduce((s, f) => s + f.totalTTC, 0);

  const clientOf = (d) => d.clientName || getLeadById(d.leadId)?.name || 'Client';
  const switchTab = (t) => { setTab(t); setStatusFilter('all'); setSearch(''); };
  const closeCreate = () => { setView('list'); setCreateMode('choose'); };

  const createFacture = (data) => { addFacture({ userId: user.id, ...data }); setFactureOpen(false); };

  const convertDevis = (d) => {
    const existing = factureByDevis.get(d.id);
    if (existing && !window.confirm(`Ce devis a déjà été converti en facture (${existing.numero}). Créer une nouvelle facture quand même ?`)) return;
    import('../../../utils/proDocPdf').then(({ devisToLignes }) => {
      const lead = getLeadById(d.leadId);
      const lignes = devisToLignes(d, products);
      const tvaActive = d.type === 'pro' ? !!d.tvaActive : (company?.assujettieVAT || false);
      const totals = computeFactureTotals(lignes, tvaActive);
      addFacture({
        userId: user.id,
        clientName: d.clientName || lead?.contact || lead?.name || 'Client',
        clientPhone: d.clientPhone || lead?.phone || '',
        clientVille: d.clientVille || lead?.address || '',
        lignes, ...totals, tvaActive, statut: 'emise', modele: modeleDefaut, devisId: d.id,
      });
    });
  };

  const runAction = (fn) => { fn(); setActions(null); };

  // --- Filtre + tri ---
  const q = search.trim().toLowerCase();
  const sortDocs = (arr, amountKey) => [...arr].sort((a, b) => {
    if (sortBy === 'montant') return (b[amountKey] || 0) - (a[amountKey] || 0);
    const diff = new Date(b.createdAt) - new Date(a.createdAt);
    return sortBy === 'ancien' ? -diff : diff;
  });
  const visibleFactures = sortDocs(
    myFactures
      .filter((f) => statusFilter === 'all' || f.statut === statusFilter)
      .filter((f) => !q || [f.numero, f.clientName].some((v) => v && v.toLowerCase().includes(q))),
    'totalTTC'
  );
  const visibleDevis = sortDocs(
    myDevis
      .filter((d) => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'brouillon') return d.statut === 'brouillon';
        if (statusFilter === 'factured') return factureByDevis.has(d.id);
        return d.statut !== 'brouillon' && !factureByDevis.has(d.id); // à facturer
      })
      .filter((d) => !q || [d.devisNumber, clientOf(d)].some((v) => v && v.toLowerCase().includes(q))),
    'total'
  );

  const cardKey = (e, fn) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };

  // ============ Création de devis ============
  if (view === 'create') {
    return (
      <>
        <button className="btn btn-outline btn-sm back-button" onClick={createMode === 'choose' ? closeCreate : () => setCreateMode('choose')}>
          <ChevronLeft size={16} /> {createMode === 'choose' ? 'Retour aux documents' : 'Changer de type'}
        </button>
        <div className="section-title">Nouveau devis</div>
        {createMode === 'choose' && (
          <div className="devis-mode-grid">
            <button className="devis-mode-card featured" onClick={() => setCreateMode('solar')}>
              <span className="devis-mode-badge">Recommandé</span>
              <div className="devis-mode-icon solar"><PanelTop size={26} /></div>
              <div className="devis-mode-title">Dimensionnement solaire</div>
              <div className="devis-mode-desc">Estimez la consommation, géolocalisez le client pour l'ensoleillement, puis choisissez la marque d'onduleur et les batteries — jusqu'au devis chiffré.</div>
            </button>
            <button className="devis-mode-card" onClick={() => setCreateMode('manual')}>
              <div className="devis-mode-icon"><ShoppingCart size={26} /></div>
              <div className="devis-mode-title">Sélection manuelle</div>
              <div className="devis-mode-desc">Composez le devis produit par produit depuis le catalogue (prix modifiables) et ajoutez des produits personnalisés.</div>
            </button>
          </div>
        )}
        {createMode === 'solar' && <ProSolarWizard onDone={closeCreate} />}
        {createMode === 'manual' && <ProDevisBuilder onDone={closeCreate} />}
      </>
    );
  }

  // ============ Liste ============
  const newLabel = tab === 'devis' ? 'Nouveau devis' : 'Nouvelle facture';
  const onNew = () => {
    if (tab === 'devis') { setCreateMode('choose'); setView('create'); }
    else setFactureOpen(true);
  };
  const filters = tab === 'devis' ? DEVIS_FILTERS : FACTURE_FILTERS;

  return (
    <>
      {!company?.nomEntreprise && (
        <div className="pro-alert">
          <Building2 size={17} />
          <span>Configurez d'abord <strong>votre entreprise</strong> pour personnaliser vos documents.</span>
          <button className="btn btn-sm btn-primary" onClick={() => onGoTo('entreprise')}>Configurer</button>
        </div>
      )}

      {/* Résumé encaissement */}
      <div className="doc-summary">
        <div className="doc-summary-card due">
          <div className="doc-summary-value">{formatCFA(aEncaisser)}</div>
          <div className="doc-summary-label">À encaisser (émises)</div>
        </div>
        <div className="doc-summary-card paid">
          <div className="doc-summary-value">{formatCFA(encaisse)}</div>
          <div className="doc-summary-label">Encaissé (payées)</div>
        </div>
      </div>

      {/* Bascule Devis / Factures */}
      <div className="client-type-toggle" role="group" aria-label="Type de document">
        <button type="button" className={`client-type-btn ${tab === 'devis' ? 'active' : ''}`} onClick={() => switchTab('devis')}>
          <FileText size={16} /> Devis ({myDevis.length})
        </button>
        <button type="button" className={`client-type-btn ${tab === 'factures' ? 'active' : ''}`} onClick={() => switchTab('factures')}>
          <Receipt size={16} /> Factures ({myFactures.length})
        </button>
      </div>

      {/* Barre d'outils */}
      <div className="doc-toolbar">
        <div className="list-toolbar">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input className="input search-input" placeholder="Client, numéro…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-accent" onClick={onNew} disabled={tab === 'factures' && !company?.nomEntreprise}>
            <Plus size={16} /> {newLabel}
          </button>
        </div>
        <div className="list-toolbar">
          <div className="categories-scroll">
            {filters.map(([id, label]) => (
              <button key={id} className={`category-chip ${statusFilter === id ? 'active' : ''}`} onClick={() => setStatusFilter(id)}>{label}</button>
            ))}
          </div>
          <select className="input sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Trier">
            {SORTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
      </div>

      {/* Liste des factures */}
      {tab === 'factures' && (
        visibleFactures.length ? (
          <div className="doc-list">
            {visibleFactures.map((f) => {
              const src = f.devisId && devisById.get(f.devisId);
              return (
                <div key={f.id} className="card doc-card" role="button" tabIndex={0}
                  onClick={() => setActions({ kind: 'facture', doc: f })}
                  onKeyDown={(e) => cardKey(e, () => setActions({ kind: 'facture', doc: f }))}>
                  <div className="doc-card-info">
                    <div className="doc-card-title">{f.clientName}</div>
                    <div className="doc-card-meta">{f.numero} · {formatDate(f.createdAt)}{src ? ` · depuis ${src.devisNumber}` : ''}</div>
                  </div>
                  <div className="doc-card-end">
                    <div className="doc-card-amount">{formatCFA(f.totalTTC)}</div>
                    <span className={`badge ${badgeClass(f.statut)}`}>{FACTURE_STATUT_LABEL[f.statut]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state card">
            <Receipt size={34} strokeWidth={1.5} />
            <p>{myFactures.length ? 'Aucune facture pour ce filtre.' : 'Aucune facture. Créez-en une ou convertissez un devis.'}</p>
            {!myFactures.length && <button className="btn btn-primary" onClick={onNew} disabled={!company?.nomEntreprise}><Plus size={16} /> Nouvelle facture</button>}
          </div>
        )
      )}

      {/* Liste des devis */}
      {tab === 'devis' && (
        visibleDevis.length ? (
          <div className="doc-list">
            {visibleDevis.map((d) => {
              const facture = factureByDevis.get(d.id);
              return (
                <div key={d.id} className="card doc-card" role="button" tabIndex={0}
                  onClick={() => setActions({ kind: 'devis', doc: d })}
                  onKeyDown={(e) => cardKey(e, () => setActions({ kind: 'devis', doc: d }))}>
                  <div className="doc-card-info">
                    <div className="doc-card-title">{clientOf(d)}</div>
                    <div className="doc-card-meta">{d.devisNumber} · {formatDate(d.createdAt)}</div>
                  </div>
                  <div className="doc-card-end">
                    <div className="doc-card-amount">{formatCFA(d.total)}</div>
                    {d.statut === 'brouillon'
                      ? <span className="badge badge-muted">Brouillon</span>
                      : facture
                        ? <span className="badge badge-success">Facturé</span>
                        : <span className="badge badge-warning">À facturer</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state card">
            <FileText size={34} strokeWidth={1.5} />
            <p>{myDevis.length ? 'Aucun devis pour ce filtre.' : 'Aucun devis. Créez votre premier devis.'}</p>
            {!myDevis.length && <button className="btn btn-primary" onClick={onNew}><Plus size={16} /> Nouveau devis</button>}
          </div>
        )
      )}

      {/* Menu d'actions (facture ou devis) */}
      <Sheet open={!!actions} onClose={() => setActions(null)} title={actions ? (actions.kind === 'facture' ? actions.doc.numero : actions.doc.devisNumber) : ''}>
        {actions?.kind === 'facture' && (
          <div className="doc-actions-list">
            <div className="sheet-row"><span className="sheet-label">Client</span><span className="sheet-value">{actions.doc.clientName}</span></div>
            <div className="sheet-row"><span className="sheet-label">Statut</span><span className="sheet-value"><span className={`badge ${badgeClass(actions.doc.statut)}`}>{FACTURE_STATUT_LABEL[actions.doc.statut]}</span></span></div>
            <div className="sheet-row"><span className="sheet-label">Total TTC</span><span className="sheet-value amount">{formatCFA(actions.doc.totalTTC)}</span></div>
            <button className="btn btn-primary btn-block" onClick={() => runAction(() => exportFacturePdf(actions.doc, undefined, { company, modeleDefaut }))}>
              <Download size={16} /> Télécharger le PDF
            </button>
            {actions.doc.statut !== 'payee' && (
              <button className="btn btn-won btn-block" onClick={() => runAction(() => updateFacture(actions.doc.id, { statut: nextStatut(actions.doc.statut) }))}>
                <CheckCircle size={16} /> {nextStatutLabel(actions.doc.statut)}
              </button>
            )}
            {actions.doc.statut === 'brouillon' && (
              <button className="btn btn-lost btn-block" onClick={() => { if (window.confirm('Supprimer ce brouillon ?')) runAction(() => deleteFacture(actions.doc.id)); }}>
                <Trash2 size={16} /> Supprimer le brouillon
              </button>
            )}
          </div>
        )}
        {actions?.kind === 'devis' && (
          <div className="doc-actions-list">
            <div className="sheet-row"><span className="sheet-label">Client</span><span className="sheet-value">{clientOf(actions.doc)}</span></div>
            <div className="sheet-row"><span className="sheet-label">Total</span><span className="sheet-value amount">{formatCFA(actions.doc.total)}</span></div>
            {factureByDevis.get(actions.doc.id) && (
              <div className="sheet-row"><span className="sheet-label">Facturé</span><span className="sheet-value">{factureByDevis.get(actions.doc.id).numero}</span></div>
            )}
            <button className="btn btn-primary btn-block" disabled={!company?.nomEntreprise} onClick={() => runAction(() => exportDevisProPdf(actions.doc, modeleDefaut, { company, lead: getLeadById(actions.doc.leadId), products, markDevisPro }))}>
              <Download size={16} /> Télécharger le PDF Pro
            </button>
            <button className="btn btn-outline btn-block" onClick={() => runAction(() => convertDevis(actions.doc))}>
              <Receipt size={16} /> Convertir en facture
            </button>
            {actions.doc.statut === 'brouillon' && (
              <>
                <button className="btn btn-won btn-block" onClick={() => runAction(() => updateDevis(actions.doc.id, { statut: 'finalise' }))}>
                  <CheckCircle size={16} /> Finaliser le devis
                </button>
                <button className="btn btn-lost btn-block" onClick={() => { if (window.confirm('Supprimer ce brouillon ?')) runAction(() => deleteDevis(actions.doc.id)); }}>
                  <Trash2 size={16} /> Supprimer le brouillon
                </button>
              </>
            )}
          </div>
        )}
      </Sheet>

      <FactureSheet
        open={factureOpen}
        onClose={() => setFactureOpen(false)}
        defaultTvaActive={company?.assujettieVAT || false}
        modeleDefaut={modeleDefaut}
        onSubmit={createFacture}
      />
    </>
  );
}
