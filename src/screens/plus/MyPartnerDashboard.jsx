import { useEffect, useState } from 'react';
import { ChevronLeft, Check, Copy, MessageCircle, Network, Users, Save, UserPlus, Crown, Wallet } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData, COMMISSION_RATES } from '../../context/DataContext';
import { formatCFA, formatDate, formatTaux } from '../../utils/format';
import { partnerLink, REF_TTL_DAYS } from '../../utils/referral';
import { isSupabaseConfigured } from '../../lib/supabase';
import { fetchMyReferredOrgs } from '../../lib/remoteSync';
import StageBadge from '../../components/StageBadge';
import { useToast } from '../../components/Toast';

const REFERRAL_TYPE_LABELS = { clic: 'Clic sur le lien', piste: 'Nouvelle piste', devis: 'Devis créé', inscription: 'Inscription via mon lien' };

export default function MyPartnerDashboard({ onBack }) {
  const { user } = useAuth();
  const {
    partners, leads, commissions, referrals, stages, lostStage, devis,
    ensurePartnerForUser, updatePartner, getPartnerById, getLeadById,
  } = useData();
  const [copied, setCopied] = useState(false);
  const [momo, setMomo] = useState(null); // null = non édité
  const toast = useToast();

  // Crée le profil partenaire de l'utilisateur s'il n'existe pas encore
  useEffect(() => {
    ensurePartnerForUser(user);
  }, [user, ensurePartnerForUser]);

  // Filleuls INSCRITS sur la plateforme via mon lien (autres entreprises) :
  // lecture serveur — la RLS d'isolation ne les montre pas dans l'état local.
  const [referredOrgs, setReferredOrgs] = useState([]);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    fetchMyReferredOrgs().then((rows) => setReferredOrgs(rows || [])).catch(() => {});
  }, []);

  const me = partners.find((p) => p.userId === user.id);
  if (!me) return null;

  const mesInscrits = referredOrgs.filter((r) => (r.partner_code || '').toUpperCase() === me.code);

  const l1Leads = leads.filter((l) => l.parrainL1 === me.id);
  const l2Leads = leads.filter((l) => l.parrainL2 === me.id);
  const wonLeads = l1Leads.filter((l) => l.stage === 'gagne');
  const myComs = commissions.filter((c) => c.partnerId === me.id);
  const paid = myComs.filter((c) => c.status === 'payée').reduce((s, c) => s + c.amount, 0);
  const pending = myComs.filter((c) => c.status === 'en_attente').reduce((s, c) => s + c.amount, 0);
  // Les commissions à encaisser d'abord, puis de la plus récente à la plus ancienne.
  const historiqueComs = [...myComs].sort(
    (a, b) => (a.status === 'en_attente' ? -1 : 1) - (b.status === 'en_attente' ? -1 : 1)
      || new Date(b.createdAt) - new Date(a.createdAt)
  );
  const numeroDevis = (c) => (c.devisId ? (devis || []).find((d) => d.id === c.devisId)?.devisNumber : null);
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
      toast(`Copie impossible — lien : ${partnerLink(me.code)}`, { type: 'error' });
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
      <button className="btn btn-outline btn-sm back-button back-to-plus" onClick={onBack}>
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

      {/* KPI (mêmes tuiles .stat-pill que les tableaux de bord) */}
      <div className="stat-strip my-partner-kpis">
        <div className="stat-pill is-warning">
          <span className="stat-pill-num">{formatCFA(pending)}</span>
          <span className="stat-pill-label">Commissions en attente</span>
        </div>
        <div className="stat-pill is-success">
          <span className="stat-pill-num">{formatCFA(paid)}</span>
          <span className="stat-pill-label">Commissions payées</span>
        </div>
        <div className="stat-pill is-primary">
          <span className="stat-pill-num">{wonLeads.length}/{l1Leads.length}</span>
          <span className="stat-pill-label">Affaires gagnées / apportées</span>
        </div>
        <div className="stat-pill is-info">
          <span className="stat-pill-num">{clicks}</span>
          <span className="stat-pill-label">Clics sur mon lien</span>
        </div>
      </div>

      {/* Historique détaillé des commissions : tout ce qui touche à l'argent
          vit ici, dans l'espace partenaire — le profil n'en parle plus. */}
      <div className="card my-partner-section">
        <div className="card-title"><Wallet size={15} /> Historique de mes commissions ({myComs.length})</div>
        {myComs.length ? historiqueComs.map((c) => (
          <div key={c.id} className="sheet-row">
            <span className="sheet-label">
              <Wallet size={14} /> {getLeadById(c.leadId)?.name || 'Commission manuelle'}
              <span className="text-secondary">
                {' · '}Niveau {c.level} ({formatTaux(COMMISSION_RATES[c.level])})
                {numeroDevis(c) ? ` · ${numeroDevis(c)}` : ''}
                {' · '}{c.status === 'payée' ? `payée le ${formatDate(c.paidAt)}` : `créée le ${formatDate(c.createdAt)}`}
              </span>
            </span>
            <span className="sheet-value">
              {formatCFA(c.amount)}{' '}
              <span className={`badge ${c.status === 'payée' ? 'badge-success' : 'badge-warning'}`}>
                {c.status === 'payée' ? 'Payée' : 'En attente'}
              </span>
            </span>
          </div>
        )) : (
          <div className="text-sm text-secondary">
            Aucune commission pour le moment. Chaque affaire que vous apportez et
            qui est déclarée gagnée vous en crée une automatiquement.
          </div>
        )}
      </div>

      {/* Filleuls inscrits sur la plateforme via mon lien (mode SaaS) */}
      {isSupabaseConfigured && (
        <div className="card my-partner-section">
          <div className="card-title"><UserPlus size={15} /> Mes filleuls inscrits ({mesInscrits.length})</div>
          {mesInscrits.length ? mesInscrits.map((r) => (
            <div key={r.org_id} className="sheet-row">
              <span className="sheet-label">
                {r.member_name || r.org_name}
                <span className="text-secondary"> · inscrit le {formatDate(r.inscrit_le)}</span>
              </span>
              <span className="sheet-value">
                {r.pro_actif
                  ? <span className="badge badge-success"><Crown size={11} style={{ verticalAlign: -1 }} /> Abonné Pro</span>
                  : <span className="badge badge-muted">Gratuit</span>}
              </span>
            </div>
          )) : (
            <div className="text-sm text-secondary">
              Personne ne s'est encore inscrit avec votre lien. Chaque filleul abonné à
              Devis Pro vous rapporte une commission à chacun de ses paiements.
            </div>
          )}
        </div>
      )}

      {/* Mes affaires */}
      <div className="card my-partner-section">
        <div className="card-title">Mes affaires apportées — niveau 1 ({formatTaux(COMMISSION_RATES[1])})</div>
        {l1Leads.length ? l1Leads.map((l) => (
          <div key={l.id} className="sheet-row">
            <span className="sheet-label">{l.name}</span>
            <span className="sheet-value">
              <StageBadge stage={stageInfo(l)} />
              {' '}{formatCFA(l.estimatedValue)}
            </span>
          </div>
        )) : <div className="text-sm text-secondary">Aucune affaire pour le moment — partagez votre lien !</div>}
        {l2Leads.length > 0 && (
          <>
            <div className="card-title my-partner-subtitle">Affaires de mes filleuls — niveau 2 ({formatTaux(COMMISSION_RATES[2])})</div>
            {l2Leads.map((l) => (
              <div key={l.id} className="sheet-row">
                <span className="sheet-label">{l.name} <span className="text-secondary">via {getPartnerById(l.parrainL1)?.name}</span></span>
                <span className="sheet-value">
                  <StageBadge stage={stageInfo(l)} />
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
              {REFERRAL_TYPE_LABELS[r.type] || r.type}
              {r.leadId && getLeadById(r.leadId) ? ` — ${getLeadById(r.leadId).name}` : r.filleulName ? ` — ${r.filleulName}` : ''}
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
          <span className="sheet-value">
            {(() => {
              const noms = [...filleuls.map((f) => f.name), ...mesInscrits.map((r) => r.member_name || r.org_name)];
              return noms.length ? noms.join(', ') : 'Aucun';
            })()}
          </span>
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
