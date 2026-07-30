import { useMemo, useState } from 'react';
import { Receipt, FileText, Download, Plus, Trash2, Building2, ShoppingCart, PanelTop, ChevronLeft, Search, CheckCircle, Pencil, Wallet, Send } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { formatCFA, formatDate, formatNombre as nf } from '../../../utils/format';
import { computeFactureTotals } from '../../../utils/facture';
import {
  statutEffectif, STATUT_EFFECTIF_LABEL, STATUT_EFFECTIF_BADGE,
  resteAPayer, montantPaye, isEnRetard, joursRetard, joursAvantEcheance,
  relanceMessage, whatsappLink,
} from '../../../utils/paiement';
import { exportDevisProPdf, exportFacturePdf } from './proPdf';
import { MODELES } from './constants';
import FactureSheet from './FactureSheet';
import PaiementSheet from './PaiementSheet';
import ProDevisBuilder from './ProDevisBuilder';
import ProSolarWizard from './ProSolarWizard';
import Sheet from '../../../components/Sheet';
import DevisEditSheet from '../../devis/DevisEditSheet';


const nextStatut = (s) => (s === 'brouillon' ? 'emise' : 'payee');
const nextStatutLabel = (s) => (s === 'brouillon' ? 'Marquer émise' : 'Marquer payée');

const SORTS = [['recent', 'Plus récents'], ['ancien', 'Plus anciens'], ['montant', 'Montant décroissant']];
const FACTURE_FILTERS = [['all', 'Tous'], ['emise', 'Émises'], ['retard', 'En retard'], ['partiel', 'Partiel'], ['payee', 'Payées'], ['brouillon', 'Brouillons']];
const DEVIS_FILTERS = [['all', 'Tous'], ['brouillon', 'Brouillons'], ['tofacture', 'À facturer'], ['factured', 'Facturés']];

/** Écran « Devis & Factures » : bascule Devis/Factures, recherche + filtres + tri,
 *  cartes cliquables ouvrant un menu d'actions. */
export default function DocumentsTab({ company, modeleDefaut, onGoTo }) {
  const { user } = useAuth();
  const { devis, products, factures, getLeadById, addFacture, updateFacture, deleteFacture, addPaiement, addRelance, markDevisPro, updateDevis, deleteDevis } = useData();

  const [tab, setTab] = useState('devis'); // devis | factures — ouvre sur les devis
  const [view, setView] = useState('list'); // list | create
  const [createMode, setCreateMode] = useState('choose'); // choose | solar | manual
  const [factureOpen, setFactureOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [actions, setActions] = useState(null); // { kind:'facture'|'devis', doc }
  // Modèle retenu pour le document qu'on s'apprête à ouvrir (défaut : réglage entreprise).
  const [modeleChoisi, setModeleChoisi] = useState(null);
  const modeleActif = modeleChoisi || modeleDefaut;
  const [editDevis, setEditDevis] = useState(null);
  const [factureEdit, setFactureEdit] = useState(null);
  const [payFacture, setPayFacture] = useState(null); // facture en cours d'encaissement

  const myDevis = useMemo(() => devis.filter((d) => d.createdBy === user.id), [devis, user.id]);
  const myFactures = useMemo(() => (factures || []).filter((f) => f.userId === user.id), [factures, user.id]);
  const factureByDevis = useMemo(() => new Map(myFactures.filter((f) => f.devisId).map((f) => [f.devisId, f])), [myFactures]);
  const devisById = useMemo(() => new Map(myDevis.map((d) => [d.id, d])), [myDevis]);

  // Reste réellement dû (émise/partiel, hors brouillons & soldées) et cumul encaissé.
  const impayees = myFactures.filter((f) => f.statut !== 'brouillon' && resteAPayer(f) > 0);
  const aEncaisser = impayees.reduce((s, f) => s + resteAPayer(f), 0);
  const encaisse = myFactures.reduce((s, f) => s + montantPaye(f), 0);
  const enRetardList = myFactures.filter((f) => isEnRetard(f));
  const montantRetard = enRetardList.reduce((s, f) => s + resteAPayer(f), 0);

  const clientOf = (d) => d.clientName || getLeadById(d.leadId)?.name || 'Client';

  // Choix du modèle de document, propre à l'espace Pro (le public n'a que Studio).
  const SelecteurModele = () => (
    <div className="input-group">
      <span className="input-label" id="doc-modele-label">Modèle de document</span>
      <div className="client-type-toggle" role="group" aria-labelledby="doc-modele-label">
        {MODELES.map((m) => (
          <button
            key={m.id} type="button"
            className={`client-type-btn ${modeleActif === m.id ? 'active' : ''}`}
            aria-pressed={modeleActif === m.id}
            onClick={() => setModeleChoisi(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
  const switchTab = (t) => { setTab(t); setStatusFilter('all'); setSearch(''); };
  const closeCreate = () => { setView('list'); setCreateMode('choose'); };

  const submitFacture = (data) => {
    if (factureEdit) updateFacture(factureEdit.id, data);
    else addFacture({ userId: user.id, ...data });
    setFactureOpen(false);
    setFactureEdit(null);
  };

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
        clientId: d.clientId,
        clientName: d.clientName || lead?.contact || lead?.name || 'Client',
        clientPhone: d.clientPhone || lead?.phone || '',
        clientVille: d.clientVille || lead?.address || '',
        lignes, ...totals, tvaActive, statut: 'emise', modele: modeleDefaut, devisId: d.id,
      });
    });
  };

  // Marquer payée = solder la facture (statut + montant intégralement encaissé).
  const marquerPayee = (f) => updateFacture(f.id, { statut: 'payee', montantPaye: f.totalTTC });

  // Relance WhatsApp : ouvre un message pré-rempli et trace la relance.
  const relancer = (f) => {
    const url = whatsappLink(f.clientPhone, relanceMessage(f, company));
    window.open(url, '_blank', 'noopener');
    addRelance(f.id, 'whatsapp');
  };

  const submitPaiement = (data) => {
    if (payFacture) addPaiement(payFacture.id, data);
    setPayFacture(null);
    setActions(null);
  };

  const runAction = (fn) => { fn(); setActions(null); setModeleChoisi(null); };

  // --- Filtre + tri ---
  const q = search.trim().toLowerCase();
  const sortDocs = (arr, amountKey) => [...arr].sort((a, b) => {
    if (sortBy === 'montant') return (b[amountKey] || 0) - (a[amountKey] || 0);
    const diff = new Date(b.createdAt) - new Date(a.createdAt);
    return sortBy === 'ancien' ? -diff : diff;
  });
  const visibleFactures = sortDocs(
    myFactures
      .filter((f) => statusFilter === 'all' || statutEffectif(f) === statusFilter)
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

  // Facture « live » (relit l'état à jour après encaissement/relance depuis le snapshot d'ouverture).
  const actionFacture = actions?.kind === 'facture' ? (myFactures.find((x) => x.id === actions.doc.id) || actions.doc) : null;
  const payFactureLive = payFacture ? (myFactures.find((x) => x.id === payFacture.id) || payFacture) : null;

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
          <div className="doc-summary-label">Reste à encaisser</div>
        </div>
        <div className={`doc-summary-card late${montantRetard > 0 ? '' : ' is-empty'}`}
          role={montantRetard > 0 ? 'button' : undefined} tabIndex={montantRetard > 0 ? 0 : undefined}
          onClick={montantRetard > 0 ? () => { switchTab('factures'); setStatusFilter('retard'); } : undefined}
          onKeyDown={montantRetard > 0 ? (e) => cardKey(e, () => { switchTab('factures'); setStatusFilter('retard'); }) : undefined}>
          <div className="doc-summary-value">{formatCFA(montantRetard)}</div>
          <div className="doc-summary-label">En retard{enRetardList.length ? ` (${enRetardList.length})` : ''}</div>
        </div>
        <div className="doc-summary-card paid">
          <div className="doc-summary-value">{formatCFA(encaisse)}</div>
          <div className="doc-summary-label">Encaissé</div>
        </div>
      </div>

      {/* Bascule Devis / Factures */}
      <div className="client-type-toggle" role="group" aria-label="Type de document">
        <button type="button" aria-pressed={tab === 'devis'} className={`client-type-btn ${tab === 'devis' ? 'active' : ''}`} onClick={() => switchTab('devis')}>
          <FileText size={16} /> Devis ({myDevis.length})
        </button>
        <button type="button" aria-pressed={tab === 'factures'} className={`client-type-btn ${tab === 'factures' ? 'active' : ''}`} onClick={() => switchTab('factures')}>
          <Receipt size={16} /> Factures ({myFactures.length})
        </button>
      </div>

      {/* Barre d'outils */}
      <div className="doc-toolbar">
        <div className="list-toolbar">
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input className="input search-input" aria-label="Rechercher un document" placeholder="Client, numéro…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-accent" onClick={onNew} disabled={tab === 'factures' && !company?.nomEntreprise}>
            <Plus size={16} /> {newLabel}
          </button>
        </div>
        <div className="list-toolbar">
          <div className="categories-scroll">
            {filters.map(([id, label]) => (
              <button key={id} className={`category-chip ${statusFilter === id ? 'active' : ''}`} aria-pressed={statusFilter === id} onClick={() => setStatusFilter(id)}>{label}</button>
            ))}
          </div>
          <select className="input sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Trier">
            {SORTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
      </div>

      {/* Liste des factures */}
      {(search.trim() !== '' || statusFilter !== 'all') && (
        <div className="filter-status" role="status">
          {(tab === 'factures' ? visibleFactures : visibleDevis).length} document{(tab === 'factures' ? visibleFactures : visibleDevis).length > 1 ? 's' : ''} affiché{(tab === 'factures' ? visibleFactures : visibleDevis).length > 1 ? 's' : ''} sur {(tab === 'factures' ? myFactures : myDevis).length}
        </div>
      )}

      {tab === 'factures' && (
        visibleFactures.length ? (
          <div className="flat-list">
            {visibleFactures.map((f) => {
              const src = f.devisId && devisById.get(f.devisId);
              const eff = statutEffectif(f);
              const reste = resteAPayer(f);
              const note = eff === 'retard' ? `Retard ${joursRetard(f)} j · reste ${nf(reste)} F`
                : eff === 'partiel' ? `Reste ${nf(reste)} F`
                : '';
              return (
                <div key={f.id} className="flat-row" role="button" tabIndex={0}
                  onClick={() => setActions({ kind: 'facture', doc: f })}
                  onKeyDown={(e) => cardKey(e, () => setActions({ kind: 'facture', doc: f }))}>
                  <div className="flat-row-main">
                    <div className="flat-row-title">{f.numero} - {f.clientName}</div>
                    <div className="flat-row-sub">
                      <span className={`flat-badge ${STATUT_EFFECTIF_BADGE[eff]}`}>{STATUT_EFFECTIF_LABEL[eff]}</span>
                      <span className="flat-row-date">{note || formatDate(f.createdAt)}{src ? ` · ${src.devisNumber}` : ''}</span>
                    </div>
                  </div>
                  <div className="flat-row-amount">{nf(f.totalTTC)}<span className="flat-amount-unit">F CFA</span></div>
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
          <div className="flat-list">
            {visibleDevis.map((d) => {
              const facture = factureByDevis.get(d.id);
              const [bcls, blabel] = d.statut === 'brouillon'
                ? ['muted', 'Brouillon']
                : facture ? ['success', 'Facturé'] : ['', 'Finalisé'];
              return (
                <div key={d.id} className="flat-row" role="button" tabIndex={0}
                  onClick={() => setActions({ kind: 'devis', doc: d })}
                  onKeyDown={(e) => cardKey(e, () => setActions({ kind: 'devis', doc: d }))}>
                  <div className="flat-row-main">
                    <div className="flat-row-title">{d.devisNumber} - {clientOf(d)}</div>
                    <div className="flat-row-sub">
                      <span className={`flat-badge ${bcls}`}>{blabel}</span>
                      <span className="flat-row-date">{formatDate(d.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flat-row-amount">{nf(d.total)}<span className="flat-amount-unit">F CFA</span></div>
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
        {actionFacture && (() => {
          const eff = statutEffectif(actionFacture);
          const reste = resteAPayer(actionFacture);
          const paye = montantPaye(actionFacture);
          const jae = joursAvantEcheance(actionFacture);
          return (
          <div className="doc-actions-list">
            <div className="sheet-row"><span className="sheet-label">Client</span><span className="sheet-value">{actionFacture.clientName}</span></div>
            <div className="sheet-row"><span className="sheet-label">Statut</span><span className="sheet-value"><span className={`badge badge-${STATUT_EFFECTIF_BADGE[eff]}`}>{STATUT_EFFECTIF_LABEL[eff]}</span></span></div>
            <div className="sheet-row"><span className="sheet-label">Total TTC</span><span className="sheet-value amount">{formatCFA(actionFacture.totalTTC)}</span></div>
            {paye > 0 && actionFacture.statut !== 'payee' && (
              <div className="sheet-row"><span className="sheet-label">Encaissé</span><span className="sheet-value">{formatCFA(paye)}</span></div>
            )}
            {reste > 0 && actionFacture.statut !== 'brouillon' && (
              <div className="sheet-row"><span className="sheet-label">Reste à payer</span><span className="sheet-value amount">{formatCFA(reste)}</span></div>
            )}
            {actionFacture.echeance && actionFacture.statut !== 'brouillon' && actionFacture.statut !== 'payee' && (
              <div className="sheet-row">
                <span className="sheet-label">Échéance</span>
                <span className={`sheet-value${eff === 'retard' ? ' text-danger' : ''}`}>
                  {formatDate(actionFacture.echeance)}
                  {eff === 'retard' ? ` · retard ${joursRetard(actionFacture)} j` : jae != null && jae >= 0 ? ` · dans ${jae} j` : ''}
                </span>
              </div>
            )}
            {actionFacture.derniereRelance && (
              <div className="sheet-row"><span className="sheet-label">Dernière relance</span><span className="sheet-value">{formatDate(actionFacture.derniereRelance)}</span></div>
            )}
            <SelecteurModele />
            <button className="btn btn-primary btn-block" onClick={() => runAction(() => exportFacturePdf(actionFacture, modeleActif, { company, modeleDefaut }))}>
              <Download size={16} /> Facture imprimable (PDF)
            </button>
            {actionFacture.statut !== 'payee' && reste > 0 && (
              <button className="btn btn-won btn-block" onClick={() => { setPayFacture(actionFacture); setActions(null); }}>
                <Wallet size={16} /> Enregistrer un encaissement
              </button>
            )}
            {reste > 0 && actionFacture.statut !== 'brouillon' && actionFacture.clientPhone && (
              <button className="btn btn-outline btn-block" onClick={() => runAction(() => relancer(actionFacture))}>
                <Send size={16} /> Relancer par WhatsApp
              </button>
            )}
            <button className="btn btn-outline btn-block" onClick={() => { setFactureEdit(actionFacture); setActions(null); }}>
              <Pencil size={16} /> Modifier la facture
            </button>
            {actionFacture.statut !== 'payee' && (
              <button className="btn btn-outline btn-block" onClick={() => runAction(() => (actionFacture.statut === 'brouillon' ? updateFacture(actionFacture.id, { statut: nextStatut(actionFacture.statut) }) : marquerPayee(actionFacture)))}>
                <CheckCircle size={16} /> {nextStatutLabel(actionFacture.statut)}
              </button>
            )}
            {actionFacture.statut === 'brouillon' && (
              <button className="btn btn-lost btn-block" onClick={() => { if (window.confirm('Supprimer ce brouillon ?')) runAction(() => deleteFacture(actionFacture.id)); }}>
                <Trash2 size={16} /> Supprimer le brouillon
              </button>
            )}
          </div>
          );
        })()}
        {actions?.kind === 'devis' && (
          <div className="doc-actions-list">
            <div className="sheet-row"><span className="sheet-label">Client</span><span className="sheet-value">{clientOf(actions.doc)}</span></div>
            <div className="sheet-row"><span className="sheet-label">Total TTC</span><span className="sheet-value amount">{formatCFA(actions.doc.total)}</span></div>
            {factureByDevis.get(actions.doc.id) && (
              <div className="sheet-row"><span className="sheet-label">Facturé</span><span className="sheet-value">{factureByDevis.get(actions.doc.id).numero}</span></div>
            )}
            <SelecteurModele />
            <button className="btn btn-primary btn-block" disabled={!company?.nomEntreprise} onClick={() => runAction(() => exportDevisProPdf(actions.doc, modeleActif, { company, lead: getLeadById(actions.doc.leadId), products, markDevisPro }))}>
              <Download size={16} /> Devis imprimable (PDF)
            </button>
            <button className="btn btn-outline btn-block" onClick={() => { setEditDevis(actions.doc); setActions(null); }}>
              <Pencil size={16} /> Modifier le devis
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
        open={factureOpen || !!factureEdit}
        onClose={() => { setFactureOpen(false); setFactureEdit(null); }}
        defaultTvaActive={company?.assujettieVAT || false}
        modeleDefaut={modeleDefaut}
        initial={factureEdit}
        onSubmit={submitFacture}
      />

      <PaiementSheet open={!!payFacture} onClose={() => setPayFacture(null)} facture={payFactureLive} onSubmit={submitPaiement} />

      <DevisEditSheet open={!!editDevis} onClose={() => setEditDevis(null)} devis={editDevis} editableClient withTva />
    </>
  );
}
