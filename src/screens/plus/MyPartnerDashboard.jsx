import { useEffect, useState } from 'react';
import { ChevronLeft, Check, Copy, MessageCircle, MousePointerClick, Network, Users, Trophy, Wallet, Save } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { formatCFA, formatDate } from '../../utils/format';
import { partnerLink, REF_TTL_DAYS } from '../../utils/referral';

const REFERRAL_TYPE_LABELS = { clic: 'Clic sur le lien', piste: 'Nouvelle piste', devis: 'Devis créé' };

export default function MyPartnerDashboard({ onBack }) {
  const { user } = useAuth();
  const {
    partners, leads, commissions, referrals, stages, lostStage, devis,
    ensurePartnerForUser, updatePartner, getPartnerById, getLeadById,
  } = useData();
  const [copied, setCopied] = useState(false);
  const [momo, setMomo] = useState(null); // null = non édité

  // Crée le profil partenaire de l'utilisateur s'il n'existe pas encore
  useEffect(() => {
    ensurePartnerForUser(user);
  }, [user, ensurePartnerForUser]);

  const me = partners.find((p) => p.userId === user.id);
  if (!me) return null;

  const l1Leads = leads.filter((l) => l.parrainL1 === me.id);
  const l2Leads = leads.filter((l) => l.parrainL2 === me.id);
  const wonLeads = l1Leads.filter((l) => l.stage === 'gagne');
  const myComs = commissions.filter((c) => c.partnerId === me.id);
  const paid = myComs.filter((c) => c.status === 'payée').reduce((s, c) => s + c.amount, 0);
  const pending = myComs.filter((c) => c.status === 'en_attente').reduce((s, c) => s + c.amount, 0);
  const myReferrals = (referrals || []).filter((r) => r.partnerCode === me.code);
  const clicks = myReferrals.filter((r) => r.type === 'clic').length;
  const conversions = myReferrals.filter((r) => r.type !== 'clic');
  const sponsor = me.sponsorId ? getPartnerById(me.sponsorId) : null;
  const filleuls = partners.filter((p) => p.sponsorId === me.id);
  const stageInfo = (lead) => (lead.stage === 'perdu' ? lostStage : stages.find((s) => s.id === lead.stage));

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(partnerLink(me.code));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copiez le lien :', partnerLink(me.code));
    }
  };

  const shareWhatsApp = () => {
    const text = `Bonjour ! Découvrez les solutions solaires BestaSolar (lumière sans facture ☀️). Demandez votre devis ici : ${partnerLink(me.code)} — Code partenaire : ${me.code}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const saveMomo = () => {
    updatePartner(me.id, { momoNumber: (momo || '').trim() });
    setMomo(null);
  };

  return (
    <>
      <button className="btn btn-outline btn-sm back-button" onClick={onBack}>
        <ChevronLeft size={16} /> Retour
      </button>
      <div className="section-title">Mon espace partenaire</div>

      {/* Code + lien */}
      <div className="card">
        <div className="affiliate-box my-affiliate-box">
          <div className="affiliate-code">{me.code}</div>
          <div className="affiliate-link">{partnerLink(me.code)}</div>
          <div className="affiliate-actions">
            <button className="btn btn-sm btn-outline" onClick={copyLink}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copié !' : 'Copier le lien'}
            </button>
            <button className="btn btn-sm btn-whatsapp" onClick={shareWhatsApp}>
              <MessageCircle size={14} /> Partager WhatsApp
            </button>
          </div>
          <div className="field-hint">Partagez ce lien : toute demande qui en découle vous est attribuée pendant {REF_TTL_DAYS} jours.</div>
        </div>
      </div>

      {/* KPI */}
      <div className="kpi-grid my-partner-kpis">
        <div className="kpi-card highlight">
          <div className="kpi-icon"><Wallet size={20} /></div>
          <div className="kpi-value">{formatCFA(pending)}</div>
          <div className="kpi-label">Commissions en attente</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon"><Check size={20} /></div>
          <div className="kpi-value">{formatCFA(paid)}</div>
          <div className="kpi-label">Commissions payées</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon"><Trophy size={20} /></div>
          <div className="kpi-value">{wonLeads.length}/{l1Leads.length}</div>
          <div className="kpi-label">Affaires gagnées / apportées</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon"><MousePointerClick size={20} /></div>
          <div className="kpi-value">{clicks}</div>
          <div className="kpi-label">Clics sur mon lien</div>
        </div>
      </div>

      {/* Mes affaires */}
      <div className="card my-partner-section">
        <div className="card-title">Mes affaires apportées — niveau 1 (3 %)</div>
        {l1Leads.length ? l1Leads.map((l) => (
          <div key={l.id} className="sheet-row">
            <span className="sheet-label">{l.name}</span>
            <span className="sheet-value">
              <span className="badge" style={{ background: `${stageInfo(l)?.color}22`, color: stageInfo(l)?.color }}>{stageInfo(l)?.label}</span>
              {' '}{formatCFA(l.estimatedValue)}
            </span>
          </div>
        )) : <div className="text-sm text-secondary">Aucune affaire pour le moment — partagez votre lien !</div>}
        {l2Leads.length > 0 && (
          <>
            <div className="card-title my-partner-subtitle">Affaires de mes filleuls — niveau 2 (1,5 %)</div>
            {l2Leads.map((l) => (
              <div key={l.id} className="sheet-row">
                <span className="sheet-label">{l.name} <span className="text-secondary">via {getPartnerById(l.parrainL1)?.name}</span></span>
                <span className="sheet-value">
                  <span className="badge" style={{ background: `${stageInfo(l)?.color}22`, color: stageInfo(l)?.color }}>{stageInfo(l)?.label}</span>
                  {' '}{formatCFA(l.estimatedValue)}
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Mes devis */}
      <div className="card my-partner-section">
        <div className="card-title">Mes devis ({(devis || []).filter((d) => d.partnerId === me.id).length})</div>
        {(devis || []).filter((d) => d.partnerId === me.id).length ? (
          (devis || []).filter((d) => d.partnerId === me.id).map((d) => (
            <div key={d.id} className="sheet-row">
              <span className="sheet-label">
                {d.devisNumber} — {getLeadById(d.leadId)?.name || 'Client'}
                <span className="text-secondary"> · {formatDate(d.createdAt)}</span>
              </span>
              <span className="sheet-value amount">{formatCFA(d.total)}</span>
            </div>
          ))
        ) : (
          <div className="text-sm text-secondary">Aucun devis rattaché pour le moment.</div>
        )}
      </div>

      {/* Historique des conversions */}
      <div className="card my-partner-section">
        <div className="card-title">Historique de mes parrainages</div>
        {conversions.length ? conversions.map((r) => (
          <div key={r.id} className="sheet-row">
            <span className="sheet-label">
              {REFERRAL_TYPE_LABELS[r.type]}{r.leadId && getLeadById(r.leadId) ? ` — ${getLeadById(r.leadId).name}` : ''}
              <span className="text-secondary"> · {formatDate(r.createdAt)}</span>
            </span>
            <span className="sheet-value">
              {r.amount ? `${formatCFA(r.amount)} ` : ''}
              <span className={`badge ${r.status === 'validé' ? 'badge-success' : r.status === 'en_attente' ? 'badge-warning' : 'badge-muted'}`}>
                {r.status === 'en_attente' ? 'En attente de validation' : r.status}
              </span>
            </span>
          </div>
        )) : <div className="text-sm text-secondary">Aucune conversion enregistrée pour le moment.</div>}
      </div>

      {/* Réseau + paiement */}
      <div className="card my-partner-section">
        <div className="card-title">Mon réseau et mon paiement</div>
        <div className="sheet-row">
          <span className="sheet-label"><Network size={14} /> Mon parrain</span>
          <span className="sheet-value">{sponsor ? sponsor.name : '— Tête de réseau'}</span>
        </div>
        <div className="sheet-row">
          <span className="sheet-label"><Users size={14} /> Mes filleuls</span>
          <span className="sheet-value">{filleuls.length ? filleuls.map((f) => f.name).join(', ') : 'Aucun'}</span>
        </div>
        <div className="momo-row">
          <label className="input-label" htmlFor="mpd-momo">Numéro Mobile Money (réception des commissions)</label>
          <div className="momo-input-row">
            <input
              id="mpd-momo"
              className="input"
              type="tel"
              placeholder="+229 ..."
              value={momo === null ? me.momoNumber || '' : momo}
              onChange={(e) => setMomo(e.target.value)}
            />
            <button className="btn btn-primary" onClick={saveMomo} disabled={momo === null}>
              <Save size={16} /> Enregistrer
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
