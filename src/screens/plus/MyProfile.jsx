import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Camera, Check, Phone, Mail, MapPin, Star, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import StageBadge from '../../components/StageBadge';
import { formatCFA, formatNombre, formatDate, initials } from '../../utils/format';
import { fileToResizedDataUrl } from '../../utils/image';
import { ENSOLEILLEMENT } from '../../data/ensoleillement';
import Field from '../../components/Field';
import { useToast } from '../../components/Toast';
import { isSupabaseConfigured } from '../../lib/supabase';
import { updateMyProfile } from '../../lib/remoteSync';

// Le profil ne parle QUE de la personne et de son travail en cours.
// Rien de ce qui mène à une commission n'y figure — montants, Mobile Money,
// affaires gagnées, historique des versements : tout vit dans « Mon espace
// partenaire », d'un seul tenant.
export default function MyProfile({ onBack }) {
  const { user } = useAuth();
  const { partners, leads, devis, stages, lostStage, ensurePartnerForUser, updatePartner } = useData();
  const fileRef = useRef(null);
  const [form, setForm] = useState(null); // null = lecture
  const toast = useToast();

  useEffect(() => {
    ensurePartnerForUser(user);
  }, [user, ensurePartnerForUser]);

  const me = partners.find((p) => p.userId === user.id);
  if (!me) return null;

  // Mes affaires encore ouvertes, de la plus récemment active à la plus ancienne.
  const mesClients = leads
    .filter((l) => l.assignedTo === user.id && l.stage !== 'gagne' && l.stage !== 'perdu')
    .sort((a, b) => new Date(b.lastActivity || 0) - new Date(a.lastActivity || 0));
  const mesDevis = (devis || []).filter((d) => d.createdBy === user.id);
  const stageInfo = (l) => (l.stage === 'perdu' ? lostStage : stages.find((st) => st.id === l.stage));

  const startEdit = () =>
    setForm({ name: me.name, phone: me.phone || '', email: me.email || '', zone: me.zone || '' });

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file, 240, 0.8);
      updatePartner(me.id, { photo: dataUrl });
    } catch {
      toast('Impossible de lire cette image.', { type: 'error' });
    }
    e.target.value = '';
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const nom = form.name.trim() || me.name;
    updatePartner(me.id, {
      name: nom,
      phone: form.phone.trim(),
      email: form.email.trim(),
      zone: form.zone,
    });
    setForm(null);
    // L'annuaire de l'équipe vit dans `profiles` (serveur) : sans cet appel,
    // les collègues continueraient de voir l'ancien nom.
    if (isSupabaseConfigured) {
      try {
        await updateMyProfile({ name: nom, phone: form.phone.trim() });
      } catch {
        toast('Coordonnées enregistrées ici, mais pas encore partagées à l’équipe.', { type: 'error' });
        return;
      }
    }
    toast('Modifications enregistrées.');
  };

  return (
    <>
      <button className="btn btn-outline btn-sm back-button back-to-plus" onClick={onBack}>
        <ChevronLeft size={16} /> Retour
      </button>

      <div className="profile-card card">
        <button className="profile-photo-btn" onClick={() => fileRef.current?.click()} aria-label="Changer ma photo">
          {me.photo ? (
            <img src={me.photo} alt={me.name} className="profile-photo" />
          ) : (
            <div className="profile-avatar">{initials(me.name)}</div>
          )}
          <span className="profile-photo-badge"><Camera size={14} /></span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="photo-input" onChange={handlePhoto} />
        <div className="profile-name">
          {me.name}
          {me.tier === 'or' && <span className="tier-badge"><Star size={12} /> OR</span>}
        </div>
        <div className="profile-role">{user.role === 'gerant' ? 'Gérant' : 'Utilisateur'} · <span className="partner-code-chip">{me.code}</span></div>
        {/* Le travail en cours, rien d'autre : issues des affaires et
            montants se lisent dans « Mon espace partenaire ». */}
        <div className="profile-stats">
          <div><div className="profile-stat-value">{formatNombre(mesClients.length)}</div><div className="profile-stat-label">Clients en cours</div></div>
          <div><div className="profile-stat-value">{formatNombre(mesDevis.length)}</div><div className="profile-stat-label">Devis créés</div></div>
        </div>
      </div>

      <div className="card my-partner-section">
        <div className="profile-edit-header">
          <div className="card-title">Mes informations</div>
          {!form && (
            <button className="btn btn-sm btn-outline" onClick={startEdit}>Modifier</button>
          )}
        </div>
        {form ? (
          <form onSubmit={handleSave}>
            <div className="form-row-2">
              <Field label="Nom complet">
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Téléphone">
                <input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+229 ..." />
              </Field>
              <Field label="Email">
                <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="vous@..." />
              </Field>
              <Field label="Zone d'intervention">
                <select className="input" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })}>
                  <option value="">— Choisir une ville —</option>
                  {ENSOLEILLEMENT.map((c) => <option key={c.city} value={c.city}>{c.city}</option>)}
                  <option value="Autre">Autre / sous-région</option>
                </select>
              </Field>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary btn-block"><Check size={16} /> Enregistrer</button>
              <button type="button" className="btn btn-outline" onClick={() => setForm(null)}>Annuler</button>
            </div>
          </form>
        ) : (
          <>
            <div className="sheet-row"><span className="sheet-label"><Phone size={14} /> Téléphone</span><span className="sheet-value">{me.phone || '—'}</span></div>
            <div className="sheet-row"><span className="sheet-label"><Mail size={14} /> Email</span><span className="sheet-value">{me.email || '—'}</span></div>
            <div className="sheet-row"><span className="sheet-label"><MapPin size={14} /> Zone d'intervention</span><span className="sheet-value">{me.zone || '—'}</span></div>
            <div className="sheet-row"><span className="sheet-label">Membre depuis</span><span className="sheet-value">{formatDate(me.registeredAt)}</span></div>
            {/* Entreprise de rattachement. Déterminante : catalogue, clients et
                cours de formation sont isolés par entreprise. Deux comptes ne
                partagent leurs données que sous le MÊME identifiant — un simple
                homonyme (deux « BestaSolar ») reste étanche. Sans cette ligne,
                rien dans l'app ne permettait de le constater. */}
            {user.org && (
              <>
                <div className="sheet-row">
                  <span className="sheet-label"><Building2 size={14} /> Entreprise</span>
                  <span className="sheet-value">{user.org.name}</span>
                </div>
                <div className="field-hint profile-org-id">Identifiant : {user.org.id}</div>
              </>
            )}
          </>
        )}
      </div>

      {/* Progression de MES clients : le commercial suit l'avancement de ses
          affaires sans ouvrir le kanban — y compris quand c'est le gérant qui
          les a fait progresser, ou quand sa demande attend une validation. */}
      <div className="card my-partner-section">
        <div className="card-title">Mes clients en cours ({mesClients.length})</div>
        {mesClients.length ? mesClients.map((l) => (
          <div key={l.id} className="sheet-row">
            <span className="sheet-label">{l.name}</span>
            <span className="sheet-value">
              <StageBadge stage={stageInfo(l)} />
              {l.estimatedValue > 0 && ` ${formatCFA(l.estimatedValue)}`}
            </span>
          </div>
        )) : <div className="text-sm text-secondary">Aucun client en cours pour le moment.</div>}
      </div>
    </>
  );
}
