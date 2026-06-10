import { useState } from 'react';
import { Users, DollarSign, User, LogOut, ChevronRight, ChevronLeft, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatCFA, formatDate, initials } from '../utils/format';
import PageHeader from '../components/PageHeader';

export default function Plus() {
  const { user, logout } = useAuth();
  const { partners, commissions, leads, getPartnerById, getLeadById } = useData();
  const [activeTab, setActiveTab] = useState('menu');

  const userWonLeads = leads.filter((l) => l.assignedTo === user.id && l.stage === 'gagne');
  const userWonValue = userWonLeads.reduce((sum, l) => sum + l.estimatedValue, 0);
  const pendingCommissions = commissions.filter((c) => c.status === 'en_attente').length;

  const BackButton = () => (
    <button className="btn btn-outline btn-sm back-button" onClick={() => setActiveTab('menu')}>
      <ChevronLeft size={16} /> Retour
    </button>
  );

  const renderPartners = () => (
    <>
      <BackButton />
      <div className="section-title">Partenaires ({partners.length})</div>
      <div className="partners-list">
        {partners.map((partner) => {
          const partnerLeads = leads.filter((l) => l.parrainL1 === partner.id);
          const wonLeads = partnerLeads.filter((l) => l.stage === 'gagne');
          const totalCommission = commissions
            .filter((c) => c.partnerId === partner.id && c.status === 'payée')
            .reduce((sum, c) => sum + c.amount, 0);
          return (
            <div key={partner.id} className="card partner-card">
              <div className="partner-header">
                <div className="partner-avatar">{initials(partner.name)}</div>
                <div className="partner-info">
                  <div className="partner-name">{partner.name}</div>
                  <div className="partner-type"><Phone size={12} /> {partner.phone}</div>
                </div>
                <span className={`badge ${partner.status === 'actif' ? 'badge-success' : 'badge-muted'}`}>
                  {partner.status === 'actif' ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <div className="partner-stats">
                <div className="partner-stat"><div className="partner-stat-value">{partnerLeads.length}</div><div className="partner-stat-label">Pistes</div></div>
                <div className="partner-stat"><div className="partner-stat-value">{wonLeads.length}</div><div className="partner-stat-label">Gagnées</div></div>
                <div className="partner-stat"><div className="partner-stat-value">{formatCFA(totalCommission)}</div><div className="partner-stat-label">Commissions</div></div>
                <div className="partner-stat"><div className="partner-stat-value">{formatDate(partner.registeredAt)}</div><div className="partner-stat-label">Inscrit le</div></div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  const renderCommissions = () => (
    <>
      <BackButton />
      <div className="section-title">Registre des commissions</div>
      <div className="commissions-list">
        {commissions.map((commission) => (
          <div key={commission.id} className="card commission-card">
            <div className="commission-header">
              <div>
                <div className="commission-lead">{getLeadById(commission.leadId)?.name}</div>
                <div className="text-sm text-secondary">
                  {getPartnerById(commission.partnerId)?.name} — Niveau {commission.level}
                </div>
              </div>
              <div className="commission-amount">{formatCFA(commission.amount)}</div>
            </div>
            <div className="commission-meta">
              <span>{formatDate(commission.createdAt)}</span>
              <span className={`badge ${commission.status === 'payée' ? 'badge-success' : 'badge-warning'}`}>
                {commission.status === 'payée' ? 'Payée' : 'En attente'}
              </span>
            </div>
          </div>
        ))}
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
                <div className="menu-item-subtitle">{partners.length} parrains</div>
              </div>
              <ChevronRight size={18} className="menu-item-arrow" />
            </button>
            <button className="menu-item" onClick={() => setActiveTab('commissions')}>
              <div className="menu-item-icon warning"><DollarSign size={18} /></div>
              <div className="menu-item-info">
                <div className="menu-item-title">Commissions</div>
                <div className="menu-item-subtitle">{pendingCommissions} en attente</div>
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
    </div>
  );
}
