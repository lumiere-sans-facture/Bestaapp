import { useState } from 'react';
import { ChevronLeft, Phone, Plus, Pencil, Check, Wallet, Users, Network } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { formatCFA, formatDate, initials } from '../../utils/format';
import Sheet from '../../components/Sheet';

const EMPTY_FORM = { name: '', phone: '', sponsorId: '', status: 'actif' };

export default function PartnersSection({ onBack }) {
  const {
    partners, leads, commissions, stages, lostStage,
    addPartner, updatePartner, payAllCommissionsForPartner, getPartnerById,
  } = useData();
  const [selectedId, setSelectedId] = useState(null);
  // null = fermé, 'new' = création, sinon id en édition
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const selected = partners.find((p) => p.id === selectedId);

  const statsFor = (partner) => {
    const l1Leads = leads.filter((l) => l.parrainL1 === partner.id);
    const l2Leads = leads.filter((l) => l.parrainL2 === partner.id);
    const won = l1Leads.filter((l) => l.stage === 'gagne').length;
    const myComs = commissions.filter((c) => c.partnerId === partner.id);
    const paid = myComs.filter((c) => c.status === 'payée').reduce((s, c) => s + c.amount, 0);
    const pending = myComs.filter((c) => c.status === 'en_attente').reduce((s, c) => s + c.amount, 0);
    const filleuls = partners.filter((p) => p.sponsorId === partner.id);
    return { l1Leads, l2Leads, won, paid, pending, filleuls };
  };

  const stageInfo = (lead) =>
    lead.stage === 'perdu' ? lostStage : stages.find((s) => s.id === lead.stage);

  const openNew = () => { setForm(EMPTY_FORM); setEditing('new'); };
  const openEdit = (partner) => {
    setForm({ name: partner.name, phone: partner.phone, sponsorId: partner.sponsorId || '', status: partner.status });
    setEditing(partner.id);
  };

  const handleSave = (e) => {
    e.preventDefault();
    const data = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      sponsorId: form.sponsorId || null,
      status: form.status,
    };
    if (editing === 'new') addPartner(data);
    else updatePartner(editing, data);
    setEditing(null);
  };

  const handlePayAll = (partner, amount) => {
    if (window.confirm(`Payer toutes les commissions en attente de ${partner.name} (${formatCFA(amount)}) ?`)) {
      payAllCommissionsForPartner(partner.id);
    }
  };

  // Parrains proposés dans le formulaire : tout le monde sauf soi-même
  // et ses propres filleuls (évite les boucles de parrainage).
  const sponsorOptions = partners.filter(
    (p) => p.id !== editing && p.sponsorId !== editing
  );

  return (
    <>
      <div className="partners-toolbar">
        <button className="btn btn-outline btn-sm back-button" onClick={onBack}>
          <ChevronLeft size={16} /> Retour
        </button>
        <button className="btn btn-accent btn-sm" onClick={openNew}>
          <Plus size={16} /> Ajouter un partenaire
        </button>
      </div>
      <div className="section-title">Réseau partenaires ({partners.length})</div>
      <div className="partners-list">
        {partners.map((partner) => {
          const st = statsFor(partner);
          const sponsor = partner.sponsorId ? getPartnerById(partner.sponsorId) : null;
          return (
            <button key={partner.id} className="card partner-card partner-card-clickable" onClick={() => setSelectedId(partner.id)}>
              <div className="partner-header">
                <div className="partner-avatar">{initials(partner.name)}</div>
                <div className="partner-info">
                  <div className="partner-name">{partner.name}</div>
                  <div className="partner-type">
                    {sponsor ? <><Network size={12} /> Filleul de {sponsor.name}</> : <><Users size={12} /> Tête de réseau</>}
                  </div>
                </div>
                <span className={`badge ${partner.status === 'actif' ? 'badge-success' : 'badge-muted'}`}>
                  {partner.status === 'actif' ? 'Actif' : 'Inactif'}
                </span>
              </div>
              <div className="partner-stats">
                <div className="partner-stat"><div className="partner-stat-value">{st.l1Leads.length}</div><div className="partner-stat-label">Affaires N1</div></div>
                <div className="partner-stat"><div className="partner-stat-value">{st.l2Leads.length}</div><div className="partner-stat-label">Affaires N2</div></div>
                <div className="partner-stat"><div className="partner-stat-value">{st.filleuls.length}</div><div className="partner-stat-label">Filleuls</div></div>
                <div className={`partner-stat ${st.pending > 0 ? 'pending' : ''}`}><div className="partner-stat-value">{formatCFA(st.pending)}</div><div className="partner-stat-label">En attente</div></div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Fiche partenaire */}
      <Sheet
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={selected?.name}
        subtitle={selected && (selected.status === 'actif' ? 'Partenaire actif' : 'Partenaire inactif')}
      >
        {selected && (() => {
          const st = statsFor(selected);
          const sponsor = selected.sponsorId ? getPartnerById(selected.sponsorId) : null;
          return (
            <>
              <div className="partner-detail-actions">
                <button className="btn btn-sm btn-outline" onClick={() => openEdit(selected)}>
                  <Pencil size={14} /> Modifier
                </button>
                {st.pending > 0 && (
                  <button className="btn btn-sm btn-won" onClick={() => handlePayAll(selected, st.pending)}>
                    <Wallet size={14} /> Payer {formatCFA(st.pending)}
                  </button>
                )}
              </div>

              <div className="sheet-section">
                <div className="sheet-section-title">Informations</div>
                <div className="sheet-row">
                  <span className="sheet-label"><Phone size={14} /> Téléphone</span>
                  <a className="sheet-value sheet-link" href={`tel:${selected.phone.replace(/\s/g, '')}`}>{selected.phone}</a>
                </div>
                <div className="sheet-row"><span className="sheet-label">Inscrit le</span><span className="sheet-value">{formatDate(selected.registeredAt)}</span></div>
                <div className="sheet-row"><span className="sheet-label">Commissions payées</span><span className="sheet-value">{formatCFA(st.paid)}</span></div>
                <div className="sheet-row"><span className="sheet-label">Commissions en attente</span><span className="sheet-value amount">{formatCFA(st.pending)}</span></div>
              </div>

              <div className="sheet-section">
                <div className="sheet-section-title">Réseau</div>
                <div className="sheet-row">
                  <span className="sheet-label">Parrain (touche le niveau 2)</span>
                  <span className="sheet-value">{sponsor ? sponsor.name : '— Tête de réseau'}</span>
                </div>
                {st.filleuls.length > 0 ? (
                  st.filleuls.map((f) => (
                    <div key={f.id} className="sheet-row">
                      <span className="sheet-label"><Network size={14} /> Filleul</span>
                      <span className="sheet-value">{f.name}</span>
                    </div>
                  ))
                ) : (
                  <div className="sheet-row"><span className="sheet-label">Filleuls</span><span className="sheet-value">Aucun</span></div>
                )}
              </div>

              <div className="sheet-section">
                <div className="sheet-section-title">Affaires apportées — niveau 1 (3 %)</div>
                {st.l1Leads.length ? st.l1Leads.map((l) => (
                  <div key={l.id} className="sheet-row">
                    <span className="sheet-label">{l.name}</span>
                    <span className="sheet-value">
                      <span className="badge" style={{ background: `${stageInfo(l)?.color}22`, color: stageInfo(l)?.color }}>{stageInfo(l)?.label}</span>
                      {' '}{formatCFA(l.estimatedValue)}
                    </span>
                  </div>
                )) : <div className="sheet-row"><span className="sheet-label">Aucune affaire apportée</span></div>}
              </div>

              <div className="sheet-section">
                <div className="sheet-section-title">Affaires de ses filleuls — niveau 2 (1,5 %)</div>
                {st.l2Leads.length ? st.l2Leads.map((l) => (
                  <div key={l.id} className="sheet-row">
                    <span className="sheet-label">{l.name} <span className="text-secondary">via {getPartnerById(l.parrainL1)?.name}</span></span>
                    <span className="sheet-value">
                      <span className="badge" style={{ background: `${stageInfo(l)?.color}22`, color: stageInfo(l)?.color }}>{stageInfo(l)?.label}</span>
                      {' '}{formatCFA(l.estimatedValue)}
                    </span>
                  </div>
                )) : <div className="sheet-row"><span className="sheet-label">Aucune affaire de filleul</span></div>}
              </div>
            </>
          );
        })()}
      </Sheet>

      {/* Formulaire partenaire */}
      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nouveau partenaire' : 'Modifier le partenaire'}
      >
        <form onSubmit={handleSave}>
          <div className="input-group">
            <label className="input-label">Nom complet *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex : Mamadou Balogun" />
          </div>
          <div className="input-group">
            <label className="input-label">Téléphone *</label>
            <input className="input" type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+229 ..." />
          </div>
          <div className="input-group">
            <label className="input-label">Parrain (recruteur)</label>
            <select className="input" value={form.sponsorId} onChange={(e) => setForm({ ...form, sponsorId: e.target.value })}>
              <option value="">Aucun — tête de réseau</option>
              {sponsorOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="field-hint">Le parrain touche 1,5 % (niveau 2) sur chaque affaire gagnée apportée par ce partenaire.</div>
          </div>
          <div className="input-group">
            <label className="input-label">Statut</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="actif">Actif</option>
              <option value="inactif">Inactif</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary btn-block">
            <Check size={18} /> {editing === 'new' ? 'Ajouter le partenaire' : 'Enregistrer'}
          </button>
        </form>
      </Sheet>
    </>
  );
}
