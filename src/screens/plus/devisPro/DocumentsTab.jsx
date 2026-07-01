import { useState } from 'react';
import { Receipt, FileText, Download, Plus, Trash2, Building2, PanelTop, ChevronLeft, ShoppingCart } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { formatCFA, formatDate } from '../../../utils/format';
import { computeFactureTotals, FACTURE_STATUT_LABEL } from '../../../utils/facture';
import { exportDevisProPdf, exportFacturePdf } from './proPdf';
import FactureSheet from './FactureSheet';
import ProDevisBuilder from './ProDevisBuilder';
import SolarWizard from '../../devis/SolarWizard';

/** Onglet « Mes documents » : factures (création/statut/PDF) et devis convertibles. */
export default function DocumentsTab({ company, modeleDefaut, onGoTo }) {
  const { user } = useAuth();
  const { devis, products, factures, getLeadById, addFacture, updateFacture, deleteFacture, markDevisPro } = useData();
  const [factureOpen, setFactureOpen] = useState(false);
  const [view, setView] = useState('docs'); // docs | create (création de devis)
  const [createMode, setCreateMode] = useState('choose'); // choose | solar | manual

  const myDevis = devis.filter((d) => d.createdBy === user.id);
  const myFactures = (factures || []).filter((f) => f.userId === user.id);
  // Devis déjà transformés en facture (pour l'indicateur + la garde anti-doublon).
  const factureByDevis = new Map(myFactures.filter((f) => f.devisId).map((f) => [f.devisId, f]));

  const createFacture = (data) => {
    addFacture({ userId: user.id, ...data });
    setFactureOpen(false);
  };

  const convertDevis = (d) => {
    const existing = factureByDevis.get(d.id);
    if (existing && !window.confirm(`Ce devis a déjà été converti en facture (${existing.numero}). Créer une nouvelle facture quand même ?`)) return;
    import('../../../utils/proDocPdf').then(({ devisToLignes }) => {
      const lead = getLeadById(d.leadId);
      const lignes = devisToLignes(d, products);
      // Devis Pro : client figé sur le devis ; devis public : client = piste liée.
      const clientName = d.clientName || lead?.contact || lead?.name || 'Client';
      const tvaActive = d.type === 'pro' ? !!d.tvaActive : (company?.assujettieVAT || false);
      const totals = computeFactureTotals(lignes, tvaActive);
      addFacture({
        userId: user.id,
        clientName,
        clientPhone: d.clientPhone || lead?.phone || '',
        clientVille: d.clientVille || lead?.address || '',
        lignes,
        ...totals,
        tvaActive,
        statut: 'emise',
        modele: modeleDefaut,
        devisId: d.id,
      });
    });
  };

  // Création d'un devis en mode Pro : choix entre le dimensionnement solaire
  // (assistant automatique) et la sélection manuelle (builder Pro éditable).
  const closeCreate = () => { setView('docs'); setCreateMode('choose'); };
  if (view === 'create') {
    return (
      <>
        <button className="btn btn-outline btn-sm back-button" onClick={createMode === 'choose' ? closeCreate : () => setCreateMode('choose')}>
          <ChevronLeft size={16} /> {createMode === 'choose' ? 'Retour aux documents' : 'Changer de type'}
        </button>
        <div className="section-title">Nouveau devis</div>
        {createMode === 'choose' && (
          <div className="devis-mode-grid">
            <button className="devis-mode-card" onClick={() => setCreateMode('solar')}>
              <div className="devis-mode-icon solar"><PanelTop size={26} /></div>
              <div className="devis-mode-title">Dimensionnement solaire</div>
              <div className="devis-mode-desc">Estimez la consommation du client et générez automatiquement le système (panneaux, onduleur, batteries) et son devis chiffré.</div>
            </button>
            <button className="devis-mode-card" onClick={() => setCreateMode('manual')}>
              <div className="devis-mode-icon"><ShoppingCart size={26} /></div>
              <div className="devis-mode-title">Sélection manuelle</div>
              <div className="devis-mode-desc">Composez le devis produit par produit depuis le catalogue (prix modifiables) et ajoutez des produits personnalisés.</div>
            </button>
          </div>
        )}
        {createMode === 'solar' && <SolarWizard onDone={closeCreate} />}
        {createMode === 'manual' && <ProDevisBuilder onDone={closeCreate} />}
      </>
    );
  }

  return (
    <>
      {!company?.nomEntreprise && (
        <div className="pro-alert">
          <Building2 size={17} />
          <span>Configurez d'abord <strong>votre entreprise</strong> (nom, logo, couleurs) pour personnaliser vos documents.</span>
          <button className="btn btn-sm btn-primary" onClick={() => onGoTo('entreprise')}>Configurer</button>
        </div>
      )}
      <div className="pro-actions-row">
        <button className="btn btn-accent" onClick={() => { setCreateMode('choose'); setView('create'); }}>
          <PanelTop size={16} /> Nouveau devis
        </button>
        <button className="btn btn-primary" onClick={() => setFactureOpen(true)} disabled={!company?.nomEntreprise}>
          <Plus size={16} /> Nouvelle facture
        </button>
      </div>

      <div className="card my-partner-section">
        <div className="card-title"><Receipt size={15} /> Mes factures ({myFactures.length})</div>
        {myFactures.length ? myFactures.map((f) => (
          <div key={f.id} className="sheet-row">
            <span className="sheet-label">
              {f.numero} — {f.clientName}
              <span className="text-secondary"> · {formatDate(f.createdAt)}</span>
              {' '}<span className={`badge ${f.statut === 'payee' ? 'badge-success' : f.statut === 'emise' ? 'badge-warning' : 'badge-muted'}`}>
                {FACTURE_STATUT_LABEL[f.statut]}
              </span>
            </span>
            <span className="sheet-value pro-doc-actions">
              {formatCFA(f.totalTTC)}
              <button className="btn btn-sm btn-primary" onClick={() => exportFacturePdf(f, undefined, { company, modeleDefaut })} aria-label="Télécharger le PDF"><Download size={13} /></button>
              {f.statut !== 'payee' && (
                <button className="btn btn-sm btn-won" onClick={() => updateFacture(f.id, { statut: f.statut === 'brouillon' ? 'emise' : 'payee' })}>
                  {f.statut === 'brouillon' ? 'Émettre' : 'Payée'}
                </button>
              )}
              {f.statut === 'brouillon' && (
                <button className="cart-row-remove" onClick={() => window.confirm('Supprimer ce brouillon ?') && deleteFacture(f.id)} aria-label="Supprimer"><Trash2 size={14} /></button>
              )}
            </span>
          </div>
        )) : <div className="text-sm text-secondary">Aucune facture. Créez-en une ou convertissez un devis ci-dessous.</div>}
      </div>

      <div className="card my-partner-section">
        <div className="card-title"><FileText size={15} /> Mes devis — version Pro ({myDevis.length})</div>
        {myDevis.length ? myDevis.map((d) => {
          const facture = factureByDevis.get(d.id);
          return (
            <div key={d.id} className="sheet-row">
              <span className="sheet-label">
                {d.devisNumber} — {d.clientName || getLeadById(d.leadId)?.name || 'Client'}
                <span className="text-secondary"> · {formatCFA(d.total)}</span>
                {d.pro && <span className="badge badge-gold">Pro</span>}
                {facture && <span className="badge badge-success">Facturé · {facture.numero}</span>}
              </span>
              <span className="sheet-value pro-doc-actions">
                <button className="btn btn-sm btn-primary" onClick={() => exportDevisProPdf(d, modeleDefaut, { company, lead: getLeadById(d.leadId), products, markDevisPro })} disabled={!company?.nomEntreprise}>
                  <Download size={13} /> PDF Pro
                </button>
                <button className="btn btn-sm btn-outline" onClick={() => convertDevis(d)}>
                  <Receipt size={13} /> → Facture
                </button>
              </span>
            </div>
          );
        }) : <div className="text-sm text-secondary">Créez d'abord un devis (onglet Devis) : il apparaîtra ici pour sa version Pro.</div>}
      </div>

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
