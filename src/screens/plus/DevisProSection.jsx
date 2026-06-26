import { useRef, useState } from 'react';
import { ChevronLeft, Crown, Check, FileText, Receipt, Building2, CreditCard, Download, Plus, Trash2, Camera, AlertTriangle, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { formatCFA, formatDate } from '../../utils/format';
import { fileToResizedDataUrl } from '../../utils/image';
import { SUBSCRIPTION_PRICE, effectiveStatus, isSubscriptionActive, daysLeft, needsRenewalAlert } from '../../utils/subscription';
import { computeFactureTotals, FACTURE_STATUT_LABEL } from '../../utils/facture';
import Sheet from '../../components/Sheet';
import Field from '../../components/Field';

const MODELES = [
  { id: 'classique', label: 'Classique', desc: 'Logo à gauche, tableau sobre' },
  { id: 'moderne', label: 'Moderne', desc: 'Bandeau couleur en en-tête' },
  { id: 'compact', label: 'Compact', desc: 'Dense, optimisé une page' },
];

const EMPTY_COMPANY = {
  nomEntreprise: '', logo: '', telephone: '', email: '', adresse: '',
  ifu: '', rccm: '', couleurPrimaire: '#0a2472', couleurSecondaire: '#f5a623',
  slogan: '', modeleDefaut: 'classique', facturePrefix: 'FAC', assujettieVAT: false,
};

const EMPTY_LIGNE = { designation: '', qty: 1, pu: '' };

export default function DevisProSection({ onBack }) {
  const { user } = useAuth();
  const {
    devis, products, factures, subscriptionPayments,
    getSubscriptionForUser, getCompanyForUser, getLeadById,
    requestSubscription, saveCompany, addFacture, updateFacture, deleteFacture, markDevisPro,
  } = useData();

  const sub = getSubscriptionForUser(user.id);
  const status = effectiveStatus(sub);
  const active = isSubscriptionActive(sub);
  const company = getCompanyForUser(user.id);

  const [tab, setTab] = useState('documents'); // documents | entreprise | abonnement
  const [subForm, setSubForm] = useState({ methode: 'momo', phone: user.phone || '', reference: '' });
  const [subSent, setSubSent] = useState(false);
  const [companyForm, setCompanyForm] = useState(null); // null = pas en édition
  const [factureOpen, setFactureOpen] = useState(false);
  const [factureForm, setFactureForm] = useState({ clientName: '', clientPhone: '', clientVille: '', tvaActive: false, statut: 'emise', modele: '', lignes: [{ ...EMPTY_LIGNE }] });
  const logoInputRef = useRef(null);

  const myDevis = devis.filter((d) => d.createdBy === user.id);
  const myFactures = (factures || []).filter((f) => f.userId === user.id);
  const myPayments = (subscriptionPayments || []).filter((p) => p.userId === user.id);
  const modeleDefaut = company?.modeleDefaut || 'classique';

  const exportDevisPro = async (d, modele) => {
    const { generateProPdf, devisToLignes } = await import('../../utils/proDocPdf');
    const lead = getLeadById(d.leadId);
    markDevisPro(d.id, { modele, companySnapshot: company });
    generateProPdf({
      kind: 'devis',
      company,
      modele,
      doc: {
        numero: d.devisNumber,
        date: d.createdAt,
        client: { name: lead?.contact || lead?.name || 'Client', phone: lead?.phone, ville: lead?.address },
        lignes: devisToLignes(d, products),
        totalHT: d.type === 'solar' ? d.quotation?.subtotalHT : d.subtotal,
        tvaActive: d.type === 'solar',
        tva: d.type === 'solar' ? d.quotation?.tva : 0,
        totalTTC: d.total,
        validiteJours: 30,
      },
    });
  };

  const exportFacture = async (f, modele) => {
    const { generateProPdf } = await import('../../utils/proDocPdf');
    generateProPdf({
      kind: 'facture',
      company: f.companySnapshot || company,
      modele: modele || f.modele || modeleDefaut,
      doc: {
        numero: f.numero,
        date: f.createdAt,
        client: { name: f.clientName, phone: f.clientPhone, ville: f.clientVille },
        lignes: f.lignes,
        totalHT: f.totalHT,
        tvaActive: f.tvaActive,
        tva: f.tva,
        totalTTC: f.totalTTC,
        statut: f.statut,
      },
    });
  };

  const submitFacture = (e) => {
    e.preventDefault();
    const lignes = factureForm.lignes
      .filter((l) => l.designation.trim() && Number(l.pu) > 0)
      .map((l) => ({ designation: l.designation.trim(), qty: Math.max(1, Number(l.qty) || 1), pu: Number(l.pu) }));
    if (!lignes.length) return;
    const totals = computeFactureTotals(lignes, factureForm.tvaActive);
    addFacture({
      userId: user.id,
      clientName: factureForm.clientName.trim(),
      clientPhone: factureForm.clientPhone.trim(),
      clientVille: factureForm.clientVille.trim(),
      lignes,
      ...totals,
      tvaActive: factureForm.tvaActive,
      statut: factureForm.statut,
      modele: factureForm.modele || modeleDefaut,
    });
    setFactureOpen(false);
    setFactureForm({ clientName: '', clientPhone: '', clientVille: '', tvaActive: company?.assujettieVAT || false, statut: 'emise', modele: '', lignes: [{ ...EMPTY_LIGNE }] });
  };

  const convertDevis = (d) => {
    const lead = getLeadById(d.leadId);
    import('../../utils/proDocPdf').then(({ devisToLignes }) => {
      const lignes = devisToLignes(d, products);
      const tvaActive = company?.assujettieVAT || false;
      const totals = computeFactureTotals(lignes, tvaActive);
      addFacture({
        userId: user.id,
        clientName: lead?.contact || lead?.name || 'Client',
        clientPhone: lead?.phone || '',
        clientVille: lead?.address || '',
        lignes,
        ...totals,
        tvaActive,
        statut: 'emise',
        modele: modeleDefaut,
        devisId: d.id,
      });
      setTab('documents');
    });
  };

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file, 360, 0.85);
      setCompanyForm((f) => ({ ...f, logo: dataUrl }));
    } catch {
      alert("Impossible de lire cette image.");
    }
    e.target.value = '';
  };

  const saveCompanyForm = (e) => {
    e.preventDefault();
    saveCompany(user.id, companyForm);
    setCompanyForm(null);
  };

  // ============ Écran d'accroche (non abonné) ============
  if (!active) {
    return (
      <>
        <button className="btn btn-outline btn-sm back-button" onClick={onBack}>
          <ChevronLeft size={16} /> Retour
        </button>
        <div className="pro-paywall card">
          <div className="pro-paywall-icon"><Crown size={30} /></div>
          <h2 className="pro-paywall-title">Passez à Devis Pro</h2>
          <p className="pro-paywall-price"><strong>{formatCFA(SUBSCRIPTION_PRICE)}</strong> / mois</p>
          <ul className="pro-benefits">
            <li><Check size={15} /> Devis personnalisés à <strong>votre entreprise</strong> (logo, couleurs, coordonnées)</li>
            <li><Check size={15} /> Génération de <strong>factures</strong> numérotées automatiquement</li>
            <li><Check size={15} /> <strong>3 modèles</strong> de mise en page professionnels</li>
            <li><Check size={15} /> Conversion devis → facture en un clic</li>
            <li><Check size={15} /> Dimensionnement solaire BestaSolar inclus</li>
          </ul>

          {status === 'en_attente_paiement' || subSent ? (
            <div className="pro-pending">
              <Clock size={18} />
              <div>
                <strong>Paiement en attente de validation</strong>
                <div className="text-sm text-secondary">Votre abonnement sera activé dès que le gérant aura confirmé la réception de votre paiement Mobile Money.</div>
              </div>
            </div>
          ) : (
            <form className="pro-subscribe-form" onSubmit={(e) => { e.preventDefault(); requestSubscription(user.id, subForm); setSubSent(true); }}>
              <div className="form-row-2">
                <div className="input-group">
                  <label className="input-label">Opérateur</label>
                  <select className="input" value={subForm.methode} onChange={(e) => setSubForm({ ...subForm, methode: e.target.value })}>
                    <option value="momo">MTN MoMo</option>
                    <option value="moov">Moov Money</option>
                  </select>
                </div>
                <Field label="Votre numéro">
                  <input className="input" type="tel" required value={subForm.phone} onChange={(e) => setSubForm({ ...subForm, phone: e.target.value })} placeholder="+229 ..." />
                </Field>
              </div>
              <Field label="Référence de la transaction (optionnel)">
                <input className="input" value={subForm.reference} onChange={(e) => setSubForm({ ...subForm, reference: e.target.value })} placeholder="Ex : ID du transfert MoMo" />
                <div className="field-hint">Envoyez {formatCFA(SUBSCRIPTION_PRICE)} au +229 016 173 2956, puis validez ce formulaire.</div>
              </Field>
              <button type="submit" className="btn btn-accent btn-block btn-lg">
                <Crown size={18} /> S'abonner — {formatCFA(SUBSCRIPTION_PRICE)}/mois
              </button>
            </form>
          )}
          {status === 'expire' && sub?.dateFin && (
            <div className="field-hint pro-expired-note">Votre abonnement a expiré le {formatDate(sub.dateFin)}. Renouvelez pour retrouver vos documents Pro.</div>
          )}
        </div>
      </>
    );
  }

  // ============ Abonné actif ============
  return (
    <>
      <div className="partners-toolbar">
        <button className="btn btn-outline btn-sm back-button" onClick={onBack}>
          <ChevronLeft size={16} /> Retour
        </button>
        <span className="badge badge-gold"><Crown size={13} /> Devis Pro actif</span>
      </div>
      <div className="section-title">Devis Pro</div>

      {needsRenewalAlert(sub) && (
        <div className="pro-alert">
          <AlertTriangle size={17} />
          <span>Votre abonnement expire dans <strong>{daysLeft(sub)} jour(s)</strong> ({formatDate(sub.dateFin)}). Pensez à renouveler.</span>
          <button className="btn btn-sm btn-accent" onClick={() => setTab('abonnement')}>Renouveler</button>
        </div>
      )}

      <div className="categories-scroll pro-tabs">
        {[['documents', 'Mes documents'], ['entreprise', 'Mon entreprise'], ['abonnement', 'Mon abonnement']].map(([id, label]) => (
          <button key={id} className={`category-chip ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {/* ---- Mes documents ---- */}
      {tab === 'documents' && (
        <>
          {!company?.nomEntreprise && (
            <div className="pro-alert">
              <Building2 size={17} />
              <span>Configurez d'abord <strong>votre entreprise</strong> (nom, logo, couleurs) pour personnaliser vos documents.</span>
              <button className="btn btn-sm btn-primary" onClick={() => setTab('entreprise')}>Configurer</button>
            </div>
          )}
          <div className="pro-actions-row">
            <button className="btn btn-accent" onClick={() => { setFactureOpen(true); setFactureForm((f) => ({ ...f, tvaActive: company?.assujettieVAT || false })); }} disabled={!company?.nomEntreprise}>
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
                  <button className="btn btn-sm btn-primary" onClick={() => exportFacture(f)} aria-label="Télécharger le PDF"><Download size={13} /></button>
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
            {myDevis.length ? myDevis.map((d) => (
              <div key={d.id} className="sheet-row">
                <span className="sheet-label">
                  {d.devisNumber} — {getLeadById(d.leadId)?.name || 'Client'}
                  <span className="text-secondary"> · {formatCFA(d.total)}</span>
                  {d.pro && <span className="badge badge-gold">Pro</span>}
                </span>
                <span className="sheet-value pro-doc-actions">
                  <button className="btn btn-sm btn-primary" onClick={() => exportDevisPro(d, modeleDefaut)} disabled={!company?.nomEntreprise}>
                    <Download size={13} /> PDF Pro
                  </button>
                  <button className="btn btn-sm btn-outline" onClick={() => convertDevis(d)}>
                    <Receipt size={13} /> → Facture
                  </button>
                </span>
              </div>
            )) : <div className="text-sm text-secondary">Créez d'abord un devis (onglet Devis) : il apparaîtra ici pour sa version Pro.</div>}
          </div>
        </>
      )}

      {/* ---- Mon entreprise ---- */}
      {tab === 'entreprise' && (
        <div className="card my-partner-section">
          <div className="card-title"><Building2 size={15} /> Identité de mon entreprise</div>
          {(() => {
            const f = companyForm || { ...EMPTY_COMPANY, ...company };
            const preview = f;
            return (
              <form onSubmit={saveCompanyForm}>
                {/* Aperçu en direct */}
                <div className="pro-preview" style={{ borderColor: preview.couleurPrimaire }}>
                  <div className="pro-preview-band" style={{ background: preview.couleurPrimaire }}>
                    {preview.logo
                      ? <img src={preview.logo} alt="" className="pro-preview-logo" />
                      : <span className="pro-preview-logo pro-preview-initials" style={{ background: preview.couleurSecondaire }}>
                          {(preview.nomEntreprise || 'ME').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                        </span>}
                    <div>
                      <div className="pro-preview-name">{preview.nomEntreprise || 'Mon Entreprise'}</div>
                      <div className="pro-preview-slogan">{preview.slogan || 'Votre slogan ici'}</div>
                    </div>
                    <span className="pro-preview-doc" style={{ color: preview.couleurSecondaire }}>DEVIS</span>
                  </div>
                  <div className="pro-preview-line" style={{ background: preview.couleurSecondaire }} />
                  <div className="pro-preview-meta">{[preview.telephone, preview.email, preview.adresse].filter(Boolean).join('  ·  ') || 'Téléphone · Email · Adresse'}</div>
                </div>

                <div className="pro-logo-row">
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => logoInputRef.current?.click()}>
                    <Camera size={14} /> {f.logo ? 'Changer le logo' : 'Ajouter mon logo'}
                  </button>
                  <input ref={logoInputRef} type="file" accept="image/*" className="photo-input" onChange={handleLogo} />
                </div>

                <Field label="Nom de l'entreprise *">
                  <input className="input" required value={f.nomEntreprise} onChange={(e) => setCompanyForm({ ...f, nomEntreprise: e.target.value })} placeholder="Ex : Fatou Solaire Services" />
                </Field>
                <Field label="Slogan">
                  <input className="input" value={f.slogan} onChange={(e) => setCompanyForm({ ...f, slogan: e.target.value })} placeholder="Ex : L'énergie à votre porte" />
                </Field>
                <div className="form-row-2">
                  <Field label="Téléphone">
                    <input className="input" type="tel" value={f.telephone} onChange={(e) => setCompanyForm({ ...f, telephone: e.target.value })} placeholder="+229 ..." />
                  </Field>
                  <Field label="Email">
                    <input className="input" type="email" value={f.email} onChange={(e) => setCompanyForm({ ...f, email: e.target.value })} />
                  </Field>
                </div>
                <Field label="Adresse">
                  <input className="input" value={f.adresse} onChange={(e) => setCompanyForm({ ...f, adresse: e.target.value })} placeholder="Quartier, ville" />
                </Field>
                <div className="form-row-2">
                  <Field label="IFU (optionnel)">
                    <input className="input" value={f.ifu} onChange={(e) => setCompanyForm({ ...f, ifu: e.target.value })} />
                  </Field>
                  <Field label="RCCM (optionnel)">
                    <input className="input" value={f.rccm} onChange={(e) => setCompanyForm({ ...f, rccm: e.target.value })} />
                  </Field>
                </div>
                <div className="form-row-2">
                  <div className="input-group">
                    <label className="input-label">Couleur principale</label>
                    <input className="input pro-color-input" type="color" value={f.couleurPrimaire} onChange={(e) => setCompanyForm({ ...f, couleurPrimaire: e.target.value })} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Couleur secondaire</label>
                    <input className="input pro-color-input" type="color" value={f.couleurSecondaire} onChange={(e) => setCompanyForm({ ...f, couleurSecondaire: e.target.value })} />
                  </div>
                </div>
                <div className="form-row-2">
                  <Field label="Modèle par défaut">
                    <select className="input" value={f.modeleDefaut} onChange={(e) => setCompanyForm({ ...f, modeleDefaut: e.target.value })}>
                      {MODELES.map((m) => <option key={m.id} value={m.id}>{m.label} — {m.desc}</option>)}
                    </select>
                  </Field>
                  <Field label="Préfixe des factures">
                    <input className="input" value={f.facturePrefix} onChange={(e) => setCompanyForm({ ...f, facturePrefix: e.target.value.toUpperCase().slice(0, 6) })} />
                  </Field>
                </div>
                <label className="pro-tva-toggle">
                  <input type="checkbox" checked={!!f.assujettieVAT} onChange={(e) => setCompanyForm({ ...f, assujettieVAT: e.target.checked })} />
                  Entreprise assujettie à la TVA <span className="text-secondary">(active la TVA 18 % par défaut sur les nouvelles factures)</span>
                </label>
                <button type="submit" className="btn btn-primary btn-block"><Check size={17} /> Enregistrer mon entreprise</button>
              </form>
            );
          })()}
        </div>
      )}

      {/* ---- Mon abonnement ---- */}
      {tab === 'abonnement' && (
        <div className="card my-partner-section">
          <div className="card-title"><CreditCard size={15} /> Mon abonnement Devis Pro</div>
          <div className="sheet-row"><span className="sheet-label">Statut</span><span className="sheet-value"><span className="badge badge-success">Actif</span></span></div>
          <div className="sheet-row"><span className="sheet-label">Expire le</span><span className="sheet-value">{formatDate(sub.dateFin)} ({daysLeft(sub)} jour(s) restants)</span></div>
          <div className="sheet-row"><span className="sheet-label">Montant</span><span className="sheet-value">{formatCFA(sub.montant)} / mois</span></div>
          {subSent || status === 'en_attente_paiement' ? (
            <div className="pro-pending"><Clock size={17} /><div><strong>Renouvellement en attente de validation</strong></div></div>
          ) : (
            <button className="btn btn-accent btn-block" onClick={() => { requestSubscription(user.id, subForm); setSubSent(true); }}>
              <Crown size={16} /> Renouveler maintenant (+30 jours) — {formatCFA(SUBSCRIPTION_PRICE)}
            </button>
          )}
          <div className="card-title my-partner-subtitle">Historique des paiements</div>
          {myPayments.length ? myPayments.map((p) => (
            <div key={p.id} className="sheet-row">
              <span className="sheet-label">{formatDate(p.date)} · {p.methode === 'momo' ? 'MTN MoMo' : 'Moov Money'}{p.referenceTransaction ? ` · ${p.referenceTransaction}` : ''}</span>
              <span className="sheet-value">
                {formatCFA(p.montant)}{' '}
                <span className={`badge ${p.statut === 'confirme' ? 'badge-success' : p.statut === 'initie' ? 'badge-warning' : 'badge-muted'}`}>
                  {{ confirme: 'Confirmé', initie: 'En attente', rejete: 'Rejeté' }[p.statut]}
                </span>
              </span>
            </div>
          )) : <div className="text-sm text-secondary">Aucun paiement enregistré.</div>}
        </div>
      )}

      {/* ---- Nouvelle facture ---- */}
      <Sheet open={factureOpen} onClose={() => setFactureOpen(false)} title="Nouvelle facture">
        <form onSubmit={submitFacture}>
          <Field label="Client *">
            <input className="input" required value={factureForm.clientName} onChange={(e) => setFactureForm({ ...factureForm, clientName: e.target.value })} placeholder="Nom du client" />
          </Field>
          <div className="form-row-2">
            <Field label="Téléphone">
              <input className="input" type="tel" value={factureForm.clientPhone} onChange={(e) => setFactureForm({ ...factureForm, clientPhone: e.target.value })} />
            </Field>
            <Field label="Ville">
              <input className="input" value={factureForm.clientVille} onChange={(e) => setFactureForm({ ...factureForm, clientVille: e.target.value })} />
            </Field>
          </div>

          <label className="input-label">Lignes de la facture *</label>
          {factureForm.lignes.map((l, i) => (
            <div key={i} className="facture-ligne">
              <input className="input" placeholder="Désignation" value={l.designation}
                onChange={(e) => setFactureForm({ ...factureForm, lignes: factureForm.lignes.map((x, j) => j === i ? { ...x, designation: e.target.value } : x) })} />
              <input className="input facture-qty" type="number" min="1" placeholder="Qté" value={l.qty}
                onChange={(e) => setFactureForm({ ...factureForm, lignes: factureForm.lignes.map((x, j) => j === i ? { ...x, qty: e.target.value } : x) })} />
              <input className="input facture-pu" type="number" min="0" placeholder="P.U." value={l.pu}
                onChange={(e) => setFactureForm({ ...factureForm, lignes: factureForm.lignes.map((x, j) => j === i ? { ...x, pu: e.target.value } : x) })} />
              {factureForm.lignes.length > 1 && (
                <button type="button" className="cart-row-remove" onClick={() => setFactureForm({ ...factureForm, lignes: factureForm.lignes.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-outline facture-add-ligne" onClick={() => setFactureForm({ ...factureForm, lignes: [...factureForm.lignes, { ...EMPTY_LIGNE }] })}>
            <Plus size={14} /> Ajouter une ligne
          </button>

          <label className="pro-tva-toggle">
            <input type="checkbox" checked={factureForm.tvaActive} onChange={(e) => setFactureForm({ ...factureForm, tvaActive: e.target.checked })} />
            Appliquer la TVA 18 % <span className="text-secondary">(exonérée par défaut sur le solaire au Bénin)</span>
          </label>

          <div className="form-row-2">
            <Field label="Statut">
              <select className="input" value={factureForm.statut} onChange={(e) => setFactureForm({ ...factureForm, statut: e.target.value })}>
                <option value="brouillon">Brouillon</option>
                <option value="emise">Émise</option>
                <option value="payee">Payée</option>
              </select>
            </Field>
            <Field label="Modèle">
              <select className="input" value={factureForm.modele || modeleDefaut} onChange={(e) => setFactureForm({ ...factureForm, modele: e.target.value })}>
                {MODELES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="devis-summary">
            {(() => {
              const t = computeFactureTotals(
                factureForm.lignes.map((l) => ({ pu: Number(l.pu) || 0, qty: Number(l.qty) || 0 })),
                factureForm.tvaActive
              );
              return (
                <>
                  <div className="devis-summary-row"><span>Total HT</span><span>{formatCFA(t.totalHT)}</span></div>
                  <div className="devis-summary-row"><span>TVA</span><span>{factureForm.tvaActive ? formatCFA(t.tva) : 'Exonérée'}</span></div>
                  <div className="devis-summary-row total"><span>Total TTC</span><span>{formatCFA(t.totalTTC)}</span></div>
                </>
              );
            })()}
          </div>
          <button type="submit" className="btn btn-primary btn-block"><Check size={17} /> Créer la facture</button>
        </form>
      </Sheet>
    </>
  );
}
