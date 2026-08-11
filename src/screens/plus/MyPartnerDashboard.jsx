import { useEffect, useState } from 'react';
import { ChevronLeft, Check, CheckCircle, Copy, MessageCircle, MousePointerClick, Network, Users, Save, UserPlus, Crown, Wallet, Trophy, FileText, Share2, Banknote, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData, COMMISSION_RATES } from '../../context/DataContext';
import { formatCFA, formatDate, formatTaux } from '../../utils/format';
import { partnerLink, REF_TTL_DAYS } from '../../utils/referral';
import { isSupabaseConfigured } from '../../lib/supabase';
import { fetchMyReferredOrgs } from '../../lib/remoteSync';
import StageBadge from '../../components/StageBadge';
import Accordion from '../../components/Accordion';
import Sheet from '../../components/Sheet';
import Field from '../../components/Field';
import {
  RETRAIT_MIN, MODES_RETRAIT, STATUTS_RETRAIT, ETATS_COMMISSION,
  commissionsMobilisables, soldeMobilisable, montantDemande, erreurDemande, demandeEnCours,
  commissionsEngagees, etatCommission,
} from '../../utils/payouts';
import { useToast } from '../../components/Toast';

const REFERRAL_TYPE_LABELS = {
  clic: 'Clic sur le lien', piste: 'Nouvelle piste', devis: 'Devis créé',
  inscription: 'Inscription via mon lien',
  affaire: 'Affaire gagnée par un filleul',
};

export default function MyPartnerDashboard({ onBack }) {
  const { user } = useAuth();
  const {
    partners, leads, commissions, referrals, stages, lostStage, devis, payoutRequests,
    ensurePartnerForUser, updatePartner, getPartnerById, getLeadById,
    requestPayout, cancelPayout,
  } = useData();
  // Demande de paiement : fiche ouverte, commissions cochées, coordonnées.
  const [retraitOuvert, setRetraitOuvert] = useState(false);
  const [choisies, setChoisies] = useState([]);
  const [formRetrait, setFormRetrait] = useState({ methode: 'momo', telephone: '', note: '' });
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
  // Une commission engagée dans une demande quitte « en attente » : elle
  // n'attend plus un versement mais une décision. La confondre avec le reste
  // laisserait croire qu'on peut la redemander.
  const engagees = commissionsEngagees(payoutRequests || []);
  const etatDe = (c) => etatCommission(c, engagees);
  const paid = myComs.filter((c) => etatDe(c) === 'payee').reduce((s, c) => s + c.amount, 0);
  const pending = myComs.filter((c) => etatDe(c) === 'attente').reduce((s, c) => s + c.amount, 0);
  const demandees = myComs.filter((c) => etatDe(c) === 'demandee').reduce((s, c) => s + c.amount, 0);
  // À encaisser d'abord, puis les demandées, puis les réglées.
  const ORDRE_ETAT = { attente: 0, demandee: 1, payee: 2 };
  const historiqueComs = [...myComs].sort(
    (a, b) => ORDRE_ETAT[etatDe(a)] - ORDRE_ETAT[etatDe(b)]
      || new Date(b.createdAt) - new Date(a.createdAt)
  );
  const numeroDevis = (c) => (c.devisId ? (devis || []).find((d) => d.id === c.devisId)?.devisNumber : null);
  // Mes affaires gagnées : ce sont elles qui déclenchent les commissions, elles
  // se lisent donc ici et non sur le profil. Celles que j'ai apportées comme
  // celles que je suis, sans doublon.
  const mesGagnees = leads
    .filter((l) => (l.assignedTo === user.id || l.parrainL1 === me.id) && l.stage === 'gagne')
    .sort((a, b) => new Date(b.wonAt || 0) - new Date(a.wonAt || 0));
  const totalGagne = mesGagnees.reduce((s, l) => s + (l.estimatedValue || 0), 0);
  const mesDevis = (devis || []).filter((d) => d.partnerId === me.id);
  const myReferrals = (referrals || []).filter((r) => r.partnerCode === me.code);
  const clicks = myReferrals.filter((r) => r.type === 'clic').length;
  const conversions = myReferrals.filter((r) => r.type !== 'clic');
  const sponsor = me.sponsorId ? getPartnerById(me.sponsorId) : null;
  const filleuls = partners.filter((p) => p.sponsorId === me.id);
  const stageInfo = (lead) => (lead.stage === 'perdu' ? lostStage : stages.find((s) => s.id === lead.stage));

  // ---- Demande de paiement des commissions ----
  const demandes = (payoutRequests || []).filter((d) => d.partnerId === me.id);
  const enCours = demandeEnCours(payoutRequests || [], me.id);
  const mobilisables = commissionsMobilisables(commissions, me.id, payoutRequests || []);
  const solde = soldeMobilisable(commissions, me.id, payoutRequests || []);
  const montantChoisi = montantDemande(commissions, choisies);

  const ouvrirRetrait = () => {
    // Tout est coché d'emblée : le cas courant est « versez-moi tout ce que
    // vous me devez ». Décocher sert à ne demander qu'une partie.
    setChoisies(mobilisables.map((c) => c.id));
    setFormRetrait({ methode: 'momo', telephone: me.momoNumber || me.phone || '', note: '' });
    setRetraitOuvert(true);
  };

  const envoyerRetrait = (e) => {
    e.preventDefault();
    const erreur = erreurDemande({
      commissionIds: choisies, montant: montantChoisi,
      telephone: formRetrait.telephone, dejaEnCours: !!enCours,
    });
    if (erreur) { toast(erreur, { type: 'error' }); return; }
    requestPayout({ partnerId: me.id, commissionIds: choisies, ...formRetrait, requestedBy: user.id });
    // Le numéro saisi devient celui du profil : la prochaine demande le reprend.
    if (formRetrait.methode === 'momo' && formRetrait.telephone !== me.momoNumber) {
      updatePartner(me.id, { momoNumber: formRetrait.telephone.trim() });
    }
    setRetraitOuvert(false);
    toast('Demande envoyée. Le gérant la validera depuis son espace.');
  };

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

      {/* KPI : icône, montant, libellé. Les tuiles .stat-pill des tableaux de
          bord logent leur valeur dans une pastille ronde de 42 px — un montant
          en F CFA y passe à la ligne. D'où cette variante en colonne, et le
          montant à encaisser mis en avant : c'est ce qu'on vient voir. */}
      <div className="partner-kpis">
        <div className="kpi-card is-highlight">
          <span className="kpi-icon"><Wallet size={18} /></span>
          <span className="kpi-value">{formatCFA(pending)}</span>
          <span className="kpi-label">À réclamer</span>
        </div>
        {demandees > 0 && (
          <div className="kpi-card is-primary">
            <span className="kpi-icon"><Banknote size={18} /></span>
            <span className="kpi-value">{formatCFA(demandees)}</span>
            <span className="kpi-label">Demandées, en attente de validation</span>
          </div>
        )}
        <div className="kpi-card is-success">
          <span className="kpi-icon"><CheckCircle size={18} /></span>
          <span className="kpi-value">{formatCFA(paid)}</span>
          <span className="kpi-label">Commissions payées</span>
        </div>
        <div className="kpi-card is-primary">
          <span className="kpi-icon"><Trophy size={18} /></span>
          <span className="kpi-value">{wonLeads.length}/{l1Leads.length}</span>
          <span className="kpi-label">Affaires gagnées / apportées</span>
        </div>
        <div className="kpi-card is-info">
          <span className="kpi-icon"><MousePointerClick size={18} /></span>
          <span className="kpi-value">{clicks}</span>
          <span className="kpi-label">Clics sur mon lien</span>
        </div>
      </div>

      {/* DEMANDER SON PAIEMENT — l'action principale de l'espace partenaire.
          Elle vit juste sous les montants qu'elle concerne. */}
      <div className="retrait-bar">
        {enCours ? (
          <>
            <span className="retrait-bar-text">
              <Banknote size={16} /> Demande de <strong>{formatCFA(enCours.amount)}</strong> envoyée
              le {formatDate(enCours.requestedAt)} — en attente de validation.
            </span>
            <button className="btn btn-sm btn-outline" onClick={() => { cancelPayout(enCours.id); toast('Demande retirée.'); }}>
              <X size={14} /> Retirer
            </button>
          </>
        ) : (
          <>
            <span className="retrait-bar-text">
              <Banknote size={16} /> {solde > 0
                ? <>Vous pouvez demander le règlement de <strong>{formatCFA(solde)}</strong>.</>
                : <>Aucune commission à faire régler pour le moment.</>}
            </span>
            <button className="btn btn-sm btn-primary" onClick={ouvrirRetrait} disabled={solde < RETRAIT_MIN}>
              <Banknote size={15} /> Demander un paiement
            </button>
          </>
        )}
      </div>
      {!enCours && solde > 0 && solde < RETRAIT_MIN && (
        <div className="field-hint retrait-min-note">
          Minimum {formatCFA(RETRAIT_MIN)} par demande — cumulez encore quelques commissions.
        </div>
      )}

      {/* Le détail vit dans des sections repliables : la page tient sur un
          écran, chaque en-tête annonce son compte et son montant, et on
          n'ouvre que ce qu'on vient chercher. */}

      <Accordion icon={Wallet} title="Historique de mes commissions" count={myComs.length}
        resume={pending > 0 ? `${formatCFA(pending)} à réclamer` : (demandees > 0 ? `${formatCFA(demandees)} demandés` : null)}>
        {myComs.length ? historiqueComs.map((c) => (
          <div key={c.id} className="sheet-row">
            <span className="sheet-label">
              {/* Une commission de niveau 2 porte sur le client d'un FILLEUL :
                  sa piste vit dans une autre organisation, d'où le nom copié
                  sur la commission. */}
              {/* Même pastille que l'écran Commissions : le niveau se lit à la
                  couleur, sans jamais emprunter l'ambre et le vert de l'état. */}
              <span className={`chip-level n${c.level}`}>
                N{c.level} · {formatTaux(COMMISSION_RATES[c.level])}
              </span>{' '}
              {getLeadById(c.leadId)?.name || c.leadName || 'Commission manuelle'}
              <span className="text-secondary">
                {numeroDevis(c) ? ` · ${numeroDevis(c)}` : ''}
                {' · '}{c.status === 'payée' ? `payée le ${formatDate(c.paidAt)}` : `créée le ${formatDate(c.createdAt)}`}
              </span>
            </span>
            <span className="sheet-value">
              {formatCFA(c.amount)}{' '}
              {/* Statut en neutre : l'ambre et le vert appartiennent au NIVEAU
                  (pastille de gauche). Les commissions dues passent de toute
                  façon en tête de liste, et le total « à venir » est annoncé
                  sur l'en-tête de la section. */}
              <span className="badge badge-muted">{ETATS_COMMISSION[etatDe(c)]}</span>
            </span>
          </div>
        )) : (
          <div className="text-sm text-secondary">
            Aucune commission pour le moment. Chaque affaire que vous apportez et
            qui est déclarée gagnée vous en crée une automatiquement.
          </div>
        )}
      </Accordion>

      <Accordion icon={Banknote} title="Mes demandes de paiement" count={demandes.length}
        resume={enCours ? `${formatCFA(enCours.amount)} en attente` : null}>
        {demandes.length ? demandes.map((d) => (
          <div key={d.id} className="sheet-row">
            <span className="sheet-label">
              {formatCFA(d.amount)}
              <span className="text-secondary">
                {' · '}{(d.commissionIds || []).length} commission{(d.commissionIds || []).length > 1 ? 's' : ''}
                {' · '}{MODES_RETRAIT[d.methode] || d.methode}
                {' · '}demandé le {formatDate(d.requestedAt)}
                {d.status === 'paye' && d.payRef ? ` · réf. ${d.payRef}` : ''}
                {d.status === 'refuse' && d.motif ? ` · motif : ${d.motif}` : ''}
              </span>
            </span>
            <span className="sheet-value">
              <span className="badge badge-muted">{STATUTS_RETRAIT[d.status] || d.status}</span>
            </span>
          </div>
        )) : (
          <div className="text-sm text-secondary">
            Aucune demande. Quand vos commissions atteignent {formatCFA(RETRAIT_MIN)},
            demandez leur règlement — le gérant reçoit la demande et la valide.
          </div>
        )}
      </Accordion>

      <Accordion icon={Trophy} title="Mes affaires gagnées" count={mesGagnees.length}
        resume={totalGagne > 0 ? formatCFA(totalGagne) : null}>
        {mesGagnees.length ? mesGagnees.map((l) => (
          <div key={l.id} className="sheet-row">
            <span className="sheet-label">
              {l.name}
              <span className="text-secondary"> · gagnée le {formatDate(l.wonAt)}</span>
            </span>
            <span className="sheet-value amount">{formatCFA(l.estimatedValue)}</span>
          </div>
        )) : (
          <div className="text-sm text-secondary">
            Aucune affaire gagnée pour le moment — chacune vous crée une commission.
          </div>
        )}
      </Accordion>

      <Accordion icon={Users} title="Mes affaires apportées" count={l1Leads.length + l2Leads.length}
        resume={`niveau 1 · ${formatTaux(COMMISSION_RATES[1])}`}>
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
      </Accordion>

      <Accordion icon={FileText} title="Mes devis" count={mesDevis.length}>
        {mesDevis.length ? mesDevis.map((d) => (
          <div key={d.id} className="sheet-row">
            <span className="sheet-label">
              {d.devisNumber} — {getLeadById(d.leadId)?.name || 'Client'}
              <span className="text-secondary"> · {formatDate(d.createdAt)}</span>
            </span>
            <span className="sheet-value amount">{formatCFA(d.total)}</span>
          </div>
        )) : (
          <div className="text-sm text-secondary">Aucun devis rattaché pour le moment.</div>
        )}
      </Accordion>

      {/* Filleuls inscrits sur la plateforme via mon lien (mode SaaS) */}
      {isSupabaseConfigured && (
        <Accordion icon={UserPlus} title="Mes filleuls inscrits" count={mesInscrits.length}>
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
        </Accordion>
      )}

      <Accordion icon={Share2} title="Historique de mes parrainages" count={conversions.length}>
        {conversions.length ? conversions.map((r) => (
          <div key={r.id} className="sheet-row">
            <span className="sheet-label">
              {REFERRAL_TYPE_LABELS[r.type] || r.type}
              {/* Une affaire de filleul vit hors de mon organisation : son nom
                  est copié sur la trace, la piste étant introuvable ici. */}
              {getLeadById(r.leadId)?.name ? ` — ${getLeadById(r.leadId).name}`
                : r.leadName ? ` — ${r.leadName}${r.filleulName ? ` (via ${r.filleulName})` : ''}`
                : r.filleulName ? ` — ${r.filleulName}` : ''}
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
      </Accordion>

      {/* Réseau + paiement */}
      <Accordion icon={Network} title="Mon réseau et mon paiement"
        resume={me.momoNumber ? me.momoNumber : 'Mobile Money à renseigner'}>
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
              placeholder="+228 ..."
              value={momo === null ? me.momoNumber || '' : momo}
              onChange={(e) => setMomo(e.target.value)}
            />
            <button className="btn btn-primary" onClick={saveMomo} disabled={momo === null}>
              <Save size={16} /> Enregistrer
            </button>
          </div>
        </div>
      </Accordion>

      {/* Fiche de demande : on choisit CE QU'ON FAIT RÉGLER, pas un montant en
          l'air — chaque franc demandé se rattache à une affaire précise. */}
      <Sheet
        open={retraitOuvert}
        onClose={() => setRetraitOuvert(false)}
        title="Demander un paiement"
        subtitle={`${formatCFA(montantChoisi)} sur ${formatCFA(solde)} disponibles`}
      >
        <form onSubmit={envoyerRetrait}>
          <div className="sheet-section-title">Commissions à faire régler</div>
          <div className="retrait-choix">
            {mobilisables.map((c) => {
              const cochee = choisies.includes(c.id);
              return (
                <label key={c.id} className={`retrait-ligne ${cochee ? 'is-on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={cochee}
                    onChange={(e) => setChoisies((ids) => (e.target.checked
                      ? [...ids, c.id]
                      : ids.filter((x) => x !== c.id)))}
                  />
                  <span className="retrait-ligne-info">
                    <span className={`chip-level n${c.level}`}>N{c.level}</span>
                    {' '}{getLeadById(c.leadId)?.name || c.leadName || 'Commission manuelle'}
                    <span className="text-secondary"> · {formatDate(c.createdAt)}</span>
                  </span>
                  <span className="retrait-ligne-montant">{formatCFA(c.amount)}</span>
                </label>
              );
            })}
          </div>
          <div className="retrait-total">
            <span>Total demandé</span>
            <strong>{formatCFA(montantChoisi)}</strong>
          </div>

          <Field label="Mode de réception">
            <select className="input" value={formRetrait.methode}
              onChange={(e) => setFormRetrait({ ...formRetrait, methode: e.target.value })}>
              {Object.entries(MODES_RETRAIT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label={formRetrait.methode === 'momo' ? 'Numéro Mobile Money *' : 'Coordonnées de règlement *'}>
            <input className="input" value={formRetrait.telephone} required
              onChange={(e) => setFormRetrait({ ...formRetrait, telephone: e.target.value })}
              placeholder="+228 ..." />
          </Field>
          <Field label="Message (facultatif)">
            <input className="input" value={formRetrait.note}
              onChange={(e) => setFormRetrait({ ...formRetrait, note: e.target.value })}
              placeholder="Ex : à régler avant vendredi" />
          </Field>
          <button type="submit" className="btn btn-primary btn-block"
            disabled={montantChoisi < RETRAIT_MIN}>
            <CheckCircle size={18} /> Envoyer la demande{montantChoisi > 0 ? ` — ${formatCFA(montantChoisi)}` : ''}
          </button>
        </form>
      </Sheet>
    </>
  );
}
