import { useRef, useState } from 'react';
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

  const [activeTab, setActiveTab] = useState('menu');
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

  const renderMenu = () => (
    <div className="plus-grid">
      <div className="profile-card card">
        <div className="profile-avatar">{user.avatar}</div>
        <div className="profile-name">{user.name}</div>
        <div className="profile-role">{user.role === 'gerant' ? 'Gérant' : 'Technicien'}</div>
        <SyncStatusRow />
      </div>
      <div className="plus-card card">
        <button className="menu-item menu-item-pro" onClick={handleProClick}>
          <div className="menu-item-icon warning"><Crown size={18} /></div>
          <div className="menu-item-info">
            <div className="menu-item-title">Passer en mode Pro</div>
            <div className="menu-item-subtitle">
              {proActive ? 'Ouvrir mon espace entreprise (devis & factures)' : `Devis & factures pro — ${formatCFA(SUBSCRIPTION_PRICE)}/mois`}
            </div>
          </div>
          <ChevronRight size={18} className="menu-item-arrow" />
        </button>
        {user.role === 'gerant' && (
          <>
            <button className="menu-item" onClick={() => setActiveTab('team')}>
              <div className="menu-item-icon"><Users size={18} /></div>
              <div className="menu-item-info">
                <div className="menu-item-title">Équipe</div>
                <div className="menu-item-subtitle">Profils des techniciens et performances</div>
              </div>
              <ChevronRight size={18} className="menu-item-arrow" />
            </button>
            <button className="menu-item" onClick={() => setActiveTab('partners')}>
              <div className="menu-item-icon success"><Users size={18} /></div>
              <div className="menu-item-info">
                <div className="menu-item-title">Partenaires</div>
                <div className="menu-item-subtitle">{partners.length} partenaires · réseau 2 niveaux</div>
              </div>
              <ChevronRight size={18} className="menu-item-arrow" />
            </button>
            <button className="menu-item" onClick={() => setActiveTab('orders')}>
              <div className="menu-item-icon"><DollarSign size={18} /></div>
              <div className="menu-item-info">
                <div className="menu-item-title">Commandes en ligne</div>
                <div className="menu-item-subtitle">{(orders || []).filter((o) => o.status === 'initie').length} à confirmer</div>
              </div>
              <ChevronRight size={18} className="menu-item-arrow" />
            </button>
            <button className="menu-item" onClick={() => setActiveTab('commissions')}>
              <div className="menu-item-icon warning"><DollarSign size={18} /></div>
              <div className="menu-item-info">
                <div className="menu-item-title">Commissions</div>
                <div className="menu-item-subtitle">
                  {pendingCommissions.length > 0 ? `${formatCFA(pendingTotal)} en attente` : 'Tout est payé'}
                </div>
              </div>
              <ChevronRight size={18} className="menu-item-arrow" />
            </button>
            <button className="menu-item" onClick={() => setActiveTab('subsadmin')}>
              <div className="menu-item-icon warning"><Crown size={18} /></div>
              <div className="menu-item-info">
                <div className="menu-item-title">Abonnements Devis Pro</div>
                <div className="menu-item-subtitle">Abonnés, paiements à valider, MRR</div>
              </div>
              <ChevronRight size={18} className="menu-item-arrow" />
            </button>
            <button className="menu-item" onClick={() => setActiveTab('backup')}>
              <div className="menu-item-icon"><DatabaseBackup size={18} /></div>
              <div className="menu-item-info">
                <div className="menu-item-title">Sauvegarde des données</div>
                <div className="menu-item-subtitle">Exporter / restaurer toutes les données</div>
              </div>
              <ChevronRight size={18} className="menu-item-arrow" />
            </button>
          </>
        )}
        <button className="menu-item" onClick={() => setActiveTab('formation')}>
          <div className="menu-item-icon success"><GraduationCap size={18} /></div>
          <div className="menu-item-info">
            <div className="menu-item-title">Formation</div>
            <div className="menu-item-subtitle">Modules vidéo et documents techniques</div>
          </div>
          <ChevronRight size={18} className="menu-item-arrow" />
        </button>
        <button className="menu-item" onClick={() => setActiveTab('mypartner')}>
          <div className="menu-item-icon"><Share2 size={18} /></div>
          <div className="menu-item-info">
            <div className="menu-item-title">Mon espace partenaire</div>
            <div className="menu-item-subtitle">Mon code, mon lien, mes commissions</div>
          </div>
          <ChevronRight size={18} className="menu-item-arrow" />
        </button>
        <button className="menu-item" onClick={() => setActiveTab('profile')}>
          <div className="menu-item-icon"><User size={18} /></div>
          <div className="menu-item-info">
            <div className="menu-item-title">Mon profil</div>
            <div className="menu-item-subtitle">Voir vos informations</div>
          </div>
          <ChevronRight size={18} className="menu-item-arrow" />
        </button>
        <button className="menu-item" onClick={logout}>
          <div className="menu-item-icon danger"><LogOut size={18} /></div>
          <div className="menu-item-info">
            <div className="menu-item-title">Déconnexion</div>
            <div className="menu-item-subtitle">Quitter l'application</div>
          </div>
          <ChevronRight size={18} className="menu-item-arrow" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="page">
      <PageHeader title="Plus" />
      <div className="page-content page-content-narrow">
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
      <Sheet open={subSheetOpen} onClose={() => { setSubSheetOpen(false); setSubSent(false); }} title="Passer en mode Pro">
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
