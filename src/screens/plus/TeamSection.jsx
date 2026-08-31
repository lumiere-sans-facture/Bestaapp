import { useEffect, useState } from 'react';
import { ChevronLeft, Search, Phone, Star, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { fetchMyOrg, reunirMonCompteGerant } from '../../lib/remoteSync';
import { codeReunionGerantsValide, normaliserCodeReunionGerants } from '../../utils/managerMerge';
import { useToast } from '../../components/Toast';
import { formatCFA, initials } from '../../utils/format';

export default function TeamSection({ onBack }) {
  const { user, logout } = useAuth();
  const { team, leads, devis, commissions, partners } = useData();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [codeReunion, setCodeReunion] = useState('');
  const [reunionEnCours, setReunionEnCours] = useState(false);

  // Code d'invitation de l'organisation (mode SaaS) : le gérant le partage,
  // le technicien s'inscrit avec depuis l'écran de connexion.
  const [org, setOrg] = useState(null);
  useEffect(() => {
    if (!isSupabaseConfigured || user.role !== 'gerant') return;
    let on = true;
    fetchMyOrg().then((o) => { if (on) setOrg(o); });
    return () => { on = false; };
  }, [user.role]);

  // L'inscription étant une page unique, l'invitation passe par un LIEN :
  // il ouvre la page d'inscription déjà rattachée à l'équipe (?equipe=CODE).
  const lienInvitation = org ? `${window.location.origin}/?equipe=${org.invite_code}` : '';
  const copierCode = async () => {
    try {
      await navigator.clipboard.writeText(lienInvitation);
      toast('Lien d\'invitation copié.');
    } catch {
      toast(`Copie impossible — lien : ${lienInvitation}`, { type: 'error' });
    }
  };

  const lancerReunion = async (event) => {
    event.preventDefault();
    const code = normaliserCodeReunionGerants(codeReunion);
    if (!codeReunionGerantsValide(code)) {
      toast('Saisissez le code de réunion complet à 12 caractères.', { type: 'error' });
      return;
    }
    if (!window.confirm('Réunir ce compte avec l’espace du code saisi ? Vos données opérationnelles seront déplacées, votre rôle Gérant sera conservé et vous devrez vous reconnecter.')) return;
    setReunionEnCours(true);
    try {
      const resultat = await reunirMonCompteGerant(code);
      const nombre = Object.values(resultat.moved || {}).reduce((total, valeur) => total + Number(valeur || 0), 0);
      window.alert(`Comptes réunis dans « ${resultat.organization_name || 'l’espace principal'} ».${nombre ? ` ${nombre} donnée(s) opérationnelle(s) ont été transférée(s).` : ''} Reconnectez-vous pour voir l’espace partagé.`);
      logout();
    } catch (error) {
      toast(error.message || 'La réunion des comptes a échoué.', { type: 'error' });
    } finally {
      setReunionEnCours(false);
    }
  };

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

      {org?.invite_code && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="sheet-section-title"><UserPlus size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Inviter un technicien</div>
          <p className="text-sm text-secondary">
            Partagez ce lien : votre technicien crée son compte en un clic et
            arrive directement dans votre équipe.
          </p>
          <div className="copy-block">
            <span className="copy-block-value">{lienInvitation}</span>
            <button type="button" className="btn btn-sm btn-outline" onClick={copierCode}>Copier</button>
          </div>
        </div>
      )}


      {isSupabaseConfigured && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="sheet-section-title"><UserPlus size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Réunir deux comptes gérants</div>
          <p className="text-sm text-secondary">
            Deux gérants ne partagent leurs données que s’ils appartiennent à la même entreprise.
            Le gérant de l’espace principal vous communique son code de réunion ; saisissez-le ici
            depuis le compte à rattacher.
          </p>
          {org?.manager_join_code && (
            <div className="copy-block" style={{ marginBottom: 10 }}>
              <span className="copy-block-value">Votre code de réunion : {org.manager_join_code}</span>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => navigator.clipboard.writeText(org.manager_join_code).then(() => toast('Code de réunion copié.')).catch(() => toast('Copie impossible.', { type: 'error' }))}>Copier</button>
            </div>
          )}
          <form onSubmit={lancerReunion}>
            <label className="label" htmlFor="manager-merge-code">Code reçu de l’espace principal</label>
            <div className="copy-block">
              <input
                id="manager-merge-code"
                className="input"
                inputMode="text"
                autoComplete="off"
                maxLength={16}
                placeholder="Ex. A1B2C3D4E5F6"
                value={codeReunion}
                onChange={(event) => setCodeReunion(normaliserCodeReunionGerants(event.target.value))}
              />
              <button type="submit" className="btn btn-sm btn-primary" disabled={reunionEnCours || !codeReunionGerantsValide(codeReunion)}>
                {reunionEnCours ? 'Réunion…' : 'Réunir'}
              </button>
            </div>
          </form>
          <p className="field-hint">
            Disponible lorsque l’ancien espace ne contient que ce compte. Les abonnements et paiements ne sont jamais déplacés automatiquement.
          </p>
        </div>
      )}

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
