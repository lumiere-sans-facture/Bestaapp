import { useState } from 'react';
import { ChevronLeft, Search, Phone, Star } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { formatCFA, initials } from '../../utils/format';

export default function TeamSection({ onBack }) {
  const { team, leads, devis, commissions, partners } = useData();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const members = team
    .filter((u) => roleFilter === 'all' || u.role === roleFilter)
    .filter((u) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      const partner = partners.find((p) => p.userId === u.id);
      return [u.name, u.phone, u.email, partner?.code, partner?.zone].some((v) => v && v.toLowerCase().includes(q));
    });

  return (
    <>
      <button className="btn btn-outline btn-sm back-button back-to-plus" onClick={onBack}>
        <ChevronLeft size={16} /> Retour
      </button>
      <div className="section-title">Équipe ({team.length})</div>

      <div className="search-box partners-search">
        <Search size={18} className="search-icon" />
        <input
          className="input search-input"
          aria-label="Rechercher un membre de l'équipe"
          placeholder="Nom, téléphone, code, zone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="categories-scroll">
        {[['all', 'Tous'], ['gerant', 'Gérants'], ['technicien', 'Techniciens']].map(([id, label]) => (
          <button key={id} className={`category-chip ${roleFilter === id ? 'active' : ''}`} aria-pressed={roleFilter === id} onClick={() => setRoleFilter(id)}>{label}</button>
        ))}
      </div>

      {(search.trim() !== '' || roleFilter !== 'all') && (
        <div className="filter-status" role="status">
          {members.length} membre{members.length > 1 ? 's' : ''} affiché{members.length > 1 ? 's' : ''} sur {team.length}
        </div>
      )}
      <div className="partners-list">
        {members.map((u) => {
          const partner = partners.find((p) => p.userId === u.id);
          const myLeads = leads.filter((l) => l.assignedTo === u.id);
          const won = myLeads.filter((l) => l.stage === 'gagne');
          const wonValue = won.reduce((s, l) => s + l.estimatedValue, 0);
          const myDevis = devis.filter((d) => d.createdBy === u.id);
          const pending = partner
            ? commissions.filter((c) => c.partnerId === partner.id && c.status === 'en_attente').reduce((s, c) => s + c.amount, 0)
            : 0;
          return (
            <div key={u.id} className="card partner-card">
              <div className="partner-header">
                {partner?.photo ? (
                  <img src={partner.photo} alt={u.name} className="partner-avatar partner-avatar-photo" />
                ) : (
                  <div className="partner-avatar">{initials(u.name)}</div>
                )}
                <div className="partner-info">
                  <div className="partner-name">
                    {partner?.name || u.name}
                    {partner?.code && <span className="partner-code-chip">{partner.code}</span>}
                    {partner?.tier === 'or' && <span className="tier-badge"><Star size={11} /> OR</span>}
                  </div>
                  <div className="partner-type">
                    <Phone size={12} /> {partner?.phone || u.phone}{partner?.zone ? ` · ${partner.zone}` : ''}
                  </div>
                </div>
                {/* Rôles = information, pas états : info pour gérant, neutre pour technicien */}
                <span className={`badge ${u.role === 'gerant' ? 'badge-info' : 'badge-muted'}`}>
                  {u.role === 'gerant' ? 'Gérant' : 'Technicien'}
                </span>
              </div>
              <div className="partner-stats">
                <div className="partner-stat"><div className="partner-stat-value">{myLeads.length}</div><div className="partner-stat-label">Clients suivis</div></div>
                <div className="partner-stat"><div className="partner-stat-value">{formatCFA(wonValue)}</div><div className="partner-stat-label">Gagnés ({won.length})</div></div>
                <div className="partner-stat"><div className="partner-stat-value">{myDevis.length}</div><div className="partner-stat-label">Devis créés</div></div>
                <div className={`partner-stat ${pending > 0 ? 'pending' : ''}`}><div className="partner-stat-value">{formatCFA(pending)}</div><div className="partner-stat-label">Comm. en attente</div></div>
              </div>
            </div>
          );
        })}
        {members.length === 0 && <div className="empty-state card">Aucun membre ne correspond.</div>}
      </div>
    </>
  );
}
