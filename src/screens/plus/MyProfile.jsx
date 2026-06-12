import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Camera, Check, Phone, Mail, MapPin, Wallet, Trophy, Star } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { formatCFA, formatDate, initials } from '../../utils/format';
import { fileToResizedDataUrl } from '../../utils/image';
import { ENSOLEILLEMENT } from '../../data/ensoleillement';

export default function MyProfile({ onBack }) {
  const { user } = useAuth();
  const { partners, leads, commissions, ensurePartnerForUser, updatePartner } = useData();
  const fileRef = useRef(null);
  const [form, setForm] = useState(null); // null = lecture
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    ensurePartnerForUser(user);
  }, [user, ensurePartnerForUser]);

  const me = partners.find((p) => p.userId === user.id);
  if (!me) return null;

  const wonLeads = leads.filter((l) => l.assignedTo === user.id && l.stage === 'gagne');
  const wonValue = wonLeads.reduce((s, l) => s + l.estimatedValue, 0);
  const myComs = commissions.filter((c) => c.partnerId === me.id);
  const pending = myComs.filter((c) => c.status === 'en_attente').reduce((s, c) => s + c.amount, 0);
  const paid = myComs.filter((c) => c.status === 'payée').reduce((s, c) => s + c.amount, 0);

  const startEdit = () =>
    setForm({ name: me.name, phone: me.phone || '', email: me.email || '', zone: me.zone || '', momoNumber: me.momoNumber || '' });

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file, 240, 0.8);
      updatePartner(me.id, { photo: dataUrl });
    } catch {
      alert('Impossible de lire cette image.');
    }
    e.target.value = '';
  };

  const handleSave = (e) => {
    e.preventDefault();
    updatePartner(me.id, {
      name: form.name.trim() || me.name,
      phone: form.phone.trim(),
      email: form.email.trim(),
      zone: form.zone,
      momoNumber: form.momoNumber.trim(),
    });
    setForm(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <button className="btn btn-outline btn-sm back-button" onClick={onBack}>
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
        <div className="profile-role">{user.role === 'gerant' ? 'Gérant' : 'Technicien'} · <span className="partner-code-chip">{me.code}</span></div>
        <div className="profile-stats">
          <div><div className="profile-stat-value">{formatCFA(pending)}</div><div className="profile-stat-label">Solde en attente</div></div>
          <div><div className="profile-stat-value">{formatCFA(paid)}</div><div className="profile-stat-label">Commissions payées</div></div>
          <div><div className="profile-stat-value">{wonLeads.length}</div><div className="profile-stat-label">Affaires gagnées</div></div>
        </div>
      </div>

      <div className="card my-partner-section">
        <div className="profile-edit-header">
          <div className="card-title">Mes informations</div>
          {!form && (
            <button className="btn btn-sm btn-outline" onClick={startEdit}>
              {saved ? <><Check size={14} /> Enregistré</> : 'Modifier'}
            </button>
          )}
        </div>
        {form ? (
          <form onSubmit={handleSave}>
            <div className="form-row-2">
              <div className="input-group">
                <label className="input-label">Nom complet</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">Téléphone</label>
                <input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+229 ..." />
              </div>
              <div className="input-group">
                <label className="input-label">Email</label>
                <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="vous@..." />
              </div>
              <div className="input-group">
                <label className="input-label">Zone d'intervention</label>
                <select className="input" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })}>
                  <option value="">— Choisir une ville —</option>
                  {ENSOLEILLEMENT.map((c) => <option key={c.city} value={c.city}>{c.city}</option>)}
                  <option value="Autre">Autre / sous-région</option>
                </select>
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Numéro Mobile Money (réception des commissions)</label>
              <input className="input" type="tel" value={form.momoNumber} onChange={(e) => setForm({ ...form, momoNumber: e.target.value })} placeholder="+229 ..." />
            </div>
            <div className="cart-actions">
              <button type="button" className="btn btn-outline" onClick={() => setForm(null)}>Annuler</button>
              <button type="submit" className="btn btn-primary btn-block"><Check size={16} /> Enregistrer</button>
            </div>
          </form>
        ) : (
          <>
            <div className="sheet-row"><span className="sheet-label"><Phone size={14} /> Téléphone</span><span className="sheet-value">{me.phone || '—'}</span></div>
            <div className="sheet-row"><span className="sheet-label"><Mail size={14} /> Email</span><span className="sheet-value">{me.email || '—'}</span></div>
            <div className="sheet-row"><span className="sheet-label"><MapPin size={14} /> Zone d'intervention</span><span className="sheet-value">{me.zone || '—'}</span></div>
            <div className="sheet-row"><span className="sheet-label"><Wallet size={14} /> Mobile Money</span><span className="sheet-value">{me.momoNumber || '—'}</span></div>
            <div className="sheet-row"><span className="sheet-label">Membre depuis</span><span className="sheet-value">{formatDate(me.registeredAt)}</span></div>
          </>
        )}
      </div>

      <div className="card my-partner-section">
        <div className="card-title">Historique récent</div>
        {myComs.length === 0 && wonLeads.length === 0 && (
          <div className="text-sm text-secondary">Aucune activité pour le moment.</div>
        )}
        {myComs.slice(0, 5).map((c) => (
          <div key={c.id} className="sheet-row">
            <span className="sheet-label"><Wallet size={14} /> Commission niveau {c.level} · {formatDate(c.createdAt)}</span>
            <span className="sheet-value">{formatCFA(c.amount)} <span className={`badge ${c.status === 'payée' ? 'badge-success' : 'badge-warning'}`}>{c.status === 'payée' ? 'Payée' : 'En attente'}</span></span>
          </div>
        ))}
        {wonLeads.slice(0, 3).map((l) => (
          <div key={l.id} className="sheet-row">
            <span className="sheet-label"><Trophy size={14} /> {l.name} · {formatDate(l.wonAt)}</span>
            <span className="sheet-value amount">{formatCFA(l.estimatedValue)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
