import { useState } from 'react';
import { Users, DollarSign, User, LogOut, ChevronRight, ChevronLeft, Phone, Plus as PlusIcon, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData, COMMISSION_RATES } from '../context/DataContext';
import { formatCFA, formatDate } from '../utils/format';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';
import PartnersSection from './plus/PartnersSection';

export default function Plus() {
  const { user, logout } = useAuth();
  const {
    partners, commissions, leads,
    getPartnerById, getLeadById,
    payCommission, addCommission,
  } = useData();
  const [activeTab, setActiveTab] = useState('menu');
  const [comFilter, setComFilter] = useState('all');
  const [showAddCommission, setShowAddCommission] = useState(false);
  const [newCommission, setNewCommission] = useState({ partnerId: '', leadId: '', level: 1, amount: '' });

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
        {filteredCommissions.length === 0 && <div className="empty-state card">Aucune commission dans ce filtre.</div>}
      </div>
    </>
  );

  const renderProfile = () => (
    <>
      <BackButton />
      <div className="profile-card card">
        <div className="profile-avatar">{user.avatar}</div>
        <div className="profile-name">{user.name}</div>
        <div className="profile-role">{user.role === 'gerant' ? 'Gérant' : 'Technicien'}</div>
        <div className="profile-phone"><Phone size={14} /> {user.phone}</div>
        <div className="profile-stats">
          <div><div className="profile-stat-value">{userWonLeads.length}</div><div className="profile-stat-label">Affaires gagnées</div></div>
          <div><div className="profile-stat-value">{formatCFA(userWonValue)}</div><div className="profile-stat-label">Total gagné</div></div>
        </div>
      </div>
    </>
  );

  const renderMenu = () => (
    <div className="plus-grid">
      <div className="profile-card card">
        <div className="profile-avatar">{user.avatar}</div>
        <div className="profile-name">{user.name}</div>
        <div className="profile-role">{user.role === 'gerant' ? 'Gérant' : 'Technicien'}</div>
      </div>
      <div className="plus-card card">
        {user.role === 'gerant' && (
          <>
            <button className="menu-item" onClick={() => setActiveTab('partners')}>
              <div className="menu-item-icon success"><Users size={18} /></div>
              <div className="menu-item-info">
                <div className="menu-item-title">Partenaires</div>
                <div className="menu-item-subtitle">{partners.length} partenaires · réseau 2 niveaux</div>
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
          </>
        )}
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
        {activeTab === 'profile' && renderProfile()}
      </div>

      {/* Commission manuelle */}
      <Sheet open={showAddCommission} onClose={() => setShowAddCommission(false)} title="Commission manuelle">
        <form onSubmit={handleAddCommission} className="form-grid">
          <div className="input-group">
            <label className="input-label">Partenaire *</label>
            <select
              className="input" required value={newCommission.partnerId}
              onChange={(e) => setNewCommission({ ...newCommission, partnerId: e.target.value })}
            >
              <option value="" disabled>Choisir un partenaire…</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Affaire liée (optionnel)</label>
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
          </div>
          <div className="input-group">
            <label className="input-label">Niveau</label>
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
          </div>
          <div className="input-group">
            <label className="input-label">Montant (F CFA) *</label>
            <input
              className="input" type="number" min="1" required
              value={newCommission.amount}
              onChange={(e) => setNewCommission({ ...newCommission, amount: e.target.value })}
              placeholder="0"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block"><PlusIcon size={18} /> Créer la commission</button>
        </form>
      </Sheet>
    </div>
  );
}
