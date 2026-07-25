import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, DollarSign, User, LogOut, ChevronRight, ChevronLeft, Phone, Plus as PlusIcon, CheckCircle, Share2, GraduationCap, Crown, Clock, Check, Download, Upload, DatabaseBackup } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData, COMMISSION_RATES } from '../context/DataContext';
import { useMode } from '../context/ModeContext';
import { formatCFA, formatDate } from '../utils/format';
import { SUBSCRIPTION_PRICE, effectiveStatus } from '../utils/subscription';
import { downloadBackup, readBackupFile } from '../utils/backup';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';
import Field from '../components/Field';
import EmptyState from '../components/EmptyState';
import PartnersSection from './plus/PartnersSection';
import MyPartnerDashboard from './plus/MyPartnerDashboard';
import OrdersSection from './plus/OrdersSection';
import MyProfile from './plus/MyProfile';
import TeamSection from './plus/TeamSection';
import FormationSection from './plus/FormationSection';
import SubscriptionsAdmin from './plus/SubscriptionsAdmin';
import { SyncStatusRow } from '../components/SyncStatus';

export default function Plus() {
  const { user, logout } = useAuth();
  const { setMode, proActive } = useMode();
  const data = useData();
  const {
    partners, commissions, leads, orders,
    getPartnerById, getLeadById,
    payCommission, addCommission,
    getSubscriptionForUser, requestSubscription, importData,
  } = data;

  const sub = getSubscriptionForUser(user.id);
  const subStatus = effectiveStatus(sub);

  // L'onglet actif est piloté par l'URL (/plus, /plus/partners…) pour que les
  // sous-sections soient accessibles directement depuis la barre latérale.
  const KNOWN_TABS = ['menu', 'partners', 'commissions', 'orders', 'team', 'formation', 'subsadmin', 'mypartner', 'profile', 'backup'];
  const { section } = useParams();
  const navigate = useNavigate();
  const activeTab = KNOWN_TABS.includes(section) ? section : 'menu';
  const setActiveTab = (x) => navigate(x === 'menu' ? '/plus' : `/plus/${x}`);
  const [comFilter, setComFilter] = useState('all');
  const [showAddCommission, setShowAddCommission] = useState(false);
  const [newCommission, setNewCommission] = useState({ partnerId: '', leadId: '', level: 1, amount: '' });
  const [subSheetOpen, setSubSheetOpen] = useState(false);
  const [subForm, setSubForm] = useState({ methode: 'momo', phone: user.phone || '', reference: '' });
  const [subSent, setSubSent] = useState(false);
  const fileRef = useRef(null);

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const backup = await readBackupFile(file);
      if (window.confirm('Importer cette sauvegarde remplacera les données actuelles. Continuer ?')) {
        importData(backup);
        window.alert('Sauvegarde restaurée avec succès.');
      }
    } catch (err) {
      window.alert(err.message || 'Import impossible.');
    }
  };

  const handleProClick = () => {
    if (proActive) {
      setMode('pro');
    } else {
      setSubSheetOpen(true);
    }
  };

  // /plus/gopro (bouton « Passer en mode Pro » de la barre latérale) :
  // abonné → bascule directe, sinon → ouverture du formulaire d'abonnement.
  // L'URL reste /plus/gopro tant que la fiche est ouverte (une redirection
  // immédiate remonterait l'écran et refermerait la fiche) ; le retour à
  // /plus se fait à la fermeture.
  useEffect(() => {
    if (section !== 'gopro') return;
    if (proActive) setMode('pro');
    else setSubSheetOpen(true);
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeSubSheet = () => {
    setSubSheetOpen(false);
    setSubSent(false);
    if (section === 'gopro') navigate('/plus', { replace: true });
  };

  const handleSubSubmit = (e) => {
    e.preventDefault();
    requestSubscription(user.id, subForm);
    setSubSent(true);
  };

  const userWonLeads = leads.filter((l) => l.assignedTo === user.id && l.stage === 'gagne');
  const userWonValue = userWonLeads.reduce((sum, l) => sum + l.estimatedValue, 0);
  const pendingCommissions = commissions.filter((c) => c.status === 'en_attente');
  const pendingTotal = pendingCommissions.reduce((sum, c) => sum + c.amount, 0);
  const paidTotal = commissions.filter((c) => c.status === 'payée').reduce((sum, c) => sum + c.amount, 0);

  const handlePay = (commission) => {
    const partner = getPartnerById(commission.partnerId);
    if (window.confirm(`Confirmer le paiement de ${formatCFA(commission.amount)} à ${partner?.name} ?`)) {
      payCommission(commission.id);
    }
  };

  const handleAddCommission = (e) => {
    e.preventDefault();
    addCommission({
      partnerId: newCommission.partnerId,
      leadId: newCommission.leadId || null,
      level: Number(newCommission.level),
      amount: Number(newCommission.amount) || 0,
    });
    setNewCommission({ partnerId: '', leadId: '', level: 1, amount: '' });
    setShowAddCommission(false);
  };

  // Pré-remplit le montant selon l'affaire et le taux du niveau choisi
  const suggestAmount = (leadId, level) => {
    const lead = getLeadById(leadId);
    return lead ? Math.round(lead.estimatedValue * COMMISSION_RATES[level]) : '';
  };

  const BackButton = () => (
    <button className="btn btn-outline btn-sm back-button" onClick={() => setActiveTab('menu')}>
      <ChevronLeft size={16} /> Retour
    </button>
  );

  const renderPartners = () => <PartnersSection onBack={() => setActiveTab('menu')} />;

  const filteredCommissions = commissions
    .filter((c) => comFilter === 'all' || c.status === comFilter)
    .sort((a, b) => (a.status === 'en_attente' ? -1 : 1) - (b.status === 'en_attente' ? -1 : 1) || new Date(b.createdAt) - new Date(a.createdAt));

  const renderCommissions = () => (
    <>
      <div className="commissions-toolbar">
        <BackButton />
        <button className="btn btn-accent btn-sm" onClick={() => setShowAddCommission(true)}>
          <PlusIcon size={16} /> Commission manuelle
        </button>
      </div>
      <div className="commission-totals">
        <div className="commission-total-card pending">
          <div className="commission-total-value">{formatCFA(pendingTotal)}</div>
          <div className="commission-total-label">{pendingCommissions.length} en attente</div>
        </div>
        <div className="commission-total-card paid">
          <div className="commission-total-value">{formatCFA(paidTotal)}</div>
          <div className="commission-total-label">Total payé</div>
        </div>
      </div>
      <div className="categories-scroll">
        {[['all', 'Toutes'], ['en_attente', 'En attente'], ['payée', 'Payées']].map(([id, label]) => (
          <button key={id} className={`category-chip ${comFilter === id ? 'active' : ''}`} onClick={() => setComFilter(id)}>{label}</button>
        ))}
      </div>
      <div className="commissions-list">
        {filteredCommissions.map((commission) => (
          <div key={commission.id} className="card commission-card">
            <div className="commission-header">
              <div>
                <div className="commission-lead">{getLeadById(commission.leadId)?.name || 'Commission manuelle'}</div>
                <div className="text-sm text-secondary">
                  {getPartnerById(commission.partnerId)?.name} — Niveau {commission.level}
                </div>
              </div>
              <div className="commission-amount">{formatCFA(commission.amount)}</div>
            </div>
            <div className="commission-meta">
              <span>{commission.status === 'payée' ? `Payée le ${formatDate(commission.paidAt)}` : `Créée le ${formatDate(commission.createdAt)}`}</span>
              {commission.status === 'payée' ? (
                <span className="badge badge-success">Payée</span>
              ) : (
                <button className="btn btn-won btn-sm" onClick={() => handlePay(commission)}>
                  <CheckCircle size={15} /> Marquer payée
                </button>
              )}
            </div>
          </div>
        ))}
        {filteredCommissions.length === 0 && <EmptyState card>Aucune commission dans ce filtre.</EmptyState>}
      </div>
    </>
  );

  const renderProfile = () => <MyProfile onBack={() => setActiveTab('menu')} />;

  const renderBackup = () => (
    <>
      <BackButton />
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">Sauvegarde des données</div>
        <p className="text-sm text-secondary">
          Exportez régulièrement toutes vos données (clients, devis, factures, partenaires, commissions…)
          dans un fichier. Vous pourrez les restaurer en cas de perte ou de changement d'appareil.
        </p>
        <button className="btn btn-primary btn-block" onClick={() => downloadBackup(data)}>
          <Download size={17} /> Exporter (télécharger)
        </button>
        <input
          ref={fileRef} type="file" accept="application/json,.json"
          onChange={handleImportFile} style={{ display: 'none' }}
          aria-label="Fichier de sauvegarde à importer"
        />
        <button className="btn btn-outline btn-block" style={{ marginTop: 10 }} onClick={() => fileRef.current?.click()}>
          <Upload size={17} /> Importer (restaurer)
        </button>
        <p className="field-hint">L'import remplace les données actuelles — exportez d'abord par sécurité.</p>
      </div>
    </>
  );

  // Entrée de menu générique (icône, titre, sous-titre, action).
  const MenuItem = ({ icon: Icon, tone = '', title, subtitle, onClick }) => (
    <button className="menu-item" onClick={onClick}>
      <div className={`menu-item-icon ${tone}`}><Icon size={18} /></div>
      <div className="menu-item-info">
        <div className="menu-item-title">{title}</div>
        <div className="menu-item-subtitle">{subtitle}</div>
      </div>
      <ChevronRight size={18} className="menu-item-arrow" />
    </button>
  );

  const renderMenu = () => (
    <div className="plus-grid">
      {/* Accès Pro mis en avant (le profil vit dans « Mon profil ») */}
      <button className="pro-cta card" onClick={handleProClick}>
          <div className="pro-cta-icon"><Crown size={24} /></div>
          <div className="pro-cta-info">
            <div className="pro-cta-title">Passer en mode Pro</div>
            <div className="pro-cta-subtitle">
              {proActive
                ? 'Ouvrir mon espace entreprise : devis, factures, encaissements et clients.'
                : `Devis & factures à votre identité, suivi des paiements — ${formatCFA(SUBSCRIPTION_PRICE)}/mois.`}
            </div>
          </div>
          <ChevronRight size={20} className="pro-cta-arrow" />
        </button>
      <div className="sync-inline"><SyncStatusRow /></div>

      {/* Sections thématiques */}
      <div className="plus-sections">
        {user.role === 'gerant' && (
          <div className="plus-section">
            <div className="plus-section-label">Gestion</div>
            <div className="plus-card card">
              <MenuItem icon={Users} title="Équipe" subtitle="Profils des techniciens et performances" onClick={() => setActiveTab('team')} />
              <MenuItem icon={Users} tone="success" title="Partenaires" subtitle={`${partners.length} partenaires · réseau 2 niveaux`} onClick={() => setActiveTab('partners')} />
              <MenuItem icon={DollarSign} title="Commandes en ligne" subtitle={`${(orders || []).filter((o) => o.status === 'initie').length} à confirmer`} onClick={() => setActiveTab('orders')} />
              <MenuItem icon={DollarSign} tone="warning" title="Commissions" subtitle={pendingCommissions.length > 0 ? `${formatCFA(pendingTotal)} en attente` : 'Tout est payé'} onClick={() => setActiveTab('commissions')} />
              <MenuItem icon={Crown} tone="warning" title="Abonnements Devis Pro" subtitle="Abonnés, paiements à valider, MRR" onClick={() => setActiveTab('subsadmin')} />
            </div>
          </div>
        )}

        <div className="plus-section">
          <div className="plus-section-label">Apprendre & gagner</div>
          <div className="plus-card card">
            <MenuItem icon={GraduationCap} tone="success" title="Formation" subtitle="Cours en ligne : modules, leçons et progression" onClick={() => setActiveTab('formation')} />
            <MenuItem icon={Share2} title="Mon espace partenaire" subtitle="Mon code, mon lien, mes commissions" onClick={() => setActiveTab('mypartner')} />
          </div>
        </div>

        <div className="plus-section">
          <div className="plus-section-label">Compte</div>
          <div className="plus-card card">
            <MenuItem icon={User} title="Mon profil" subtitle="Voir vos informations" onClick={() => setActiveTab('profile')} />
            {user.role === 'gerant' && (
              <MenuItem icon={DatabaseBackup} title="Sauvegarde des données" subtitle="Exporter / restaurer toutes les données" onClick={() => setActiveTab('backup')} />
            )}
            <MenuItem icon={LogOut} tone="danger" title="Déconnexion" subtitle="Quitter l'application" onClick={logout} />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="page">
      <PageHeader title="Plus" />
      {/* La formation s'étale en large (catalogue + école) ; le reste garde la colonne étroite. */}
      <div className={`page-content ${activeTab === 'formation' ? 'page-content-wide' : 'page-content-narrow'}`}>
        {activeTab === 'menu' && renderMenu()}
        {activeTab === 'partners' && renderPartners()}
        {activeTab === 'commissions' && renderCommissions()}
        {activeTab === 'orders' && <OrdersSection onBack={() => setActiveTab('menu')} />}
        {activeTab === 'team' && <TeamSection onBack={() => setActiveTab('menu')} />}
        {activeTab === 'formation' && <FormationSection onBack={() => setActiveTab('menu')} />}
        {activeTab === 'subsadmin' && <SubscriptionsAdmin onBack={() => setActiveTab('menu')} />}
        {activeTab === 'mypartner' && <MyPartnerDashboard onBack={() => setActiveTab('menu')} />}
        {activeTab === 'profile' && renderProfile()}
        {activeTab === 'backup' && renderBackup()}
      </div>

      {/* Commission manuelle */}
      <Sheet open={showAddCommission} onClose={() => setShowAddCommission(false)} title="Commission manuelle">
        <form onSubmit={handleAddCommission} className="form-grid">
          <Field label="Partenaire *">
            <select
              className="input" required value={newCommission.partnerId}
              onChange={(e) => setNewCommission({ ...newCommission, partnerId: e.target.value })}
            >
              <option value="" disabled>Choisir un partenaire…</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Affaire liée (optionnel)">
            <select
              className="input" value={newCommission.leadId}
              onChange={(e) => {
                const leadId = e.target.value;
                setNewCommission((c) => ({ ...c, leadId, amount: suggestAmount(leadId, c.level) || c.amount }));
              }}
            >
              <option value="">Aucune</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.name} — {formatCFA(l.estimatedValue)}</option>)}
            </select>
          </Field>
          <Field label="Niveau">
            <select
              className="input" value={newCommission.level}
              onChange={(e) => {
                const level = Number(e.target.value);
                setNewCommission((c) => ({ ...c, level, amount: suggestAmount(c.leadId, level) || c.amount }));
              }}
            >
              <option value={1}>Niveau 1 (3%)</option>
              <option value={2}>Niveau 2 (1,5%)</option>
            </select>
          </Field>
          <Field label="Montant (F CFA) *">
            <input
              className="input" type="number" min="1" required
              value={newCommission.amount}
              onChange={(e) => setNewCommission({ ...newCommission, amount: e.target.value })}
              placeholder="0"
            />
          </Field>
          <button type="submit" className="btn btn-primary btn-block"><PlusIcon size={18} /> Créer la commission</button>
        </form>
      </Sheet>

      {/* Abonnement Devis Pro */}
      <Sheet open={subSheetOpen} onClose={closeSubSheet} title="Passer en mode Pro">
        <div className="pro-paywall-icon" style={{ textAlign: 'center', marginBottom: 8 }}><Crown size={28} /></div>
        <p className="pro-paywall-price" style={{ textAlign: 'center', marginBottom: 16 }}>
          <strong>{formatCFA(SUBSCRIPTION_PRICE)}</strong> / mois
        </p>
        <ul className="pro-benefits" style={{ marginBottom: 20 }}>
          <li><Check size={15} /> Devis personnalisés à <strong>votre entreprise</strong></li>
          <li><Check size={15} /> Génération de <strong>factures</strong> numérotées</li>
          <li><Check size={15} /> <strong>3 modèles</strong> de mise en page professionnels</li>
          <li><Check size={15} /> Conversion devis → facture en un clic</li>
        </ul>

        {subSent || subStatus === 'en_attente_paiement' ? (
          <div className="pro-pending">
            <Clock size={18} />
            <div>
              <strong>Paiement en attente de validation</strong>
              <div className="text-sm text-secondary">
                Votre abonnement sera activé dès que le gérant aura confirmé la réception de votre paiement.
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubSubmit}>
            <div className="form-row-2">
              <Field label="Opérateur">
                <select className="input" value={subForm.methode} onChange={(e) => setSubForm({ ...subForm, methode: e.target.value })}>
                  <option value="momo">MTN MoMo</option>
                  <option value="moov">Moov Money</option>
                </select>
              </Field>
              <Field label="Votre numéro">
                <input className="input" type="tel" required value={subForm.phone} onChange={(e) => setSubForm({ ...subForm, phone: e.target.value })} placeholder="+229 ..." />
              </Field>
            </div>
            <Field label="Référence de la transaction (optionnel)">
              <input className="input" value={subForm.reference} onChange={(e) => setSubForm({ ...subForm, reference: e.target.value })} placeholder="Ex : ID du transfert MoMo" />
              <div className="field-hint">Envoyez {formatCFA(SUBSCRIPTION_PRICE)} au +229 016 173 2956, puis validez.</div>
            </Field>
            <button type="submit" className="btn btn-accent btn-block btn-lg">
              <Crown size={18} /> S'abonner — {formatCFA(SUBSCRIPTION_PRICE)}/mois
            </button>
          </form>
        )}
      </Sheet>
    </div>
  );
}
