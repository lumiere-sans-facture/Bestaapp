import { Building2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatCFA, formatDate } from '../utils/format';
import { computeMonthlyRevenue } from '../utils/stats';
import { effectiveStatus, daysLeft } from '../utils/subscription';
import { isSameMonth } from '../utils/date';
import { SEV_LABEL, SEV_ORDER } from '../utils/alerts';
import {
  paiementEntries, resteAPayer, montantPaye, isEnRetard, joursRetard, joursAvantEcheance,
  statutEffectif, STATUT_EFFECTIF_LABEL, STATUT_EFFECTIF_BADGE,
} from '../utils/paiement';
import PageHeader from '../components/PageHeader';
import Ring from '../components/Ring';

// Statuts effectifs (dérivés paiements + échéance) présentés sur les anneaux.
const STATUT_META = [
  { id: 'brouillon', label: 'Brouillons', color: 'var(--text-muted)' },
  { id: 'emise', label: 'Émises', color: 'var(--accent)' },
  { id: 'partiel', label: 'Partielles', color: 'var(--primary-light)' },
  { id: 'retard', label: 'En retard', color: 'var(--error)' },
  { id: 'payee', label: 'Payées', color: 'var(--success)' },
];

/**
 * Tableau de bord « Mon Entreprise » (espace Pro) — style aligné sur le
 * tableau de bord public (bandeau de stats, feed d'alertes, anneaux SVG,
 * barres de score). Suppose un abonnement actif.
 */
export default function ProDashboard() {
  const { user } = useAuth();
  const { factures, getCompanyForUser, getSubscriptionForUser } = useData();

  const now = new Date();
  const isThisMonth = (iso) => isSameMonth(iso, now);

  const company = getCompanyForUser(user.id);
  const myFactures = (factures || []).filter((f) => f.userId === user.id);

  // ---- Comptages par statut effectif (paiements + échéance) ----
  const brouillons = myFactures.filter((f) => f.statut === 'brouillon');
  const payees = myFactures.filter((f) => statutEffectif(f) === 'payee');
  const impayees = myFactures.filter((f) => f.statut !== 'brouillon' && resteAPayer(f) > 0);
  const retards = impayees.filter((f) => isEnRetard(f));
  const facturesThisMonth = myFactures.filter((f) => isThisMonth(f.createdAt));
  const payeesThisMonth = payees.filter((f) => isThisMonth(f.createdAt));

  // ---- Montants (encaissements réels, acomptes compris) ----
  const caEncaisseMois = myFactures
    .flatMap((f) => paiementEntries(f))
    .filter((e) => isThisMonth(e.date))
    .reduce((s, e) => s + e.montant, 0);
  const encaisseTotal = myFactures.reduce((s, f) => s + montantPaye(f), 0);
  const resteTotal = impayees.reduce((s, f) => s + resteAPayer(f), 0);
  const retardTotal = retards.reduce((s, f) => s + resteAPayer(f), 0);
  const factureTotal = myFactures
    .filter((f) => f.statut !== 'brouillon')
    .reduce((s, f) => s + (f.totalTTC || 0), 0);
  const clientsCount = new Set(
    myFactures.map((f) => (f.clientName || '').trim().toLowerCase()).filter(Boolean)
  ).size;
  const convertis = myFactures.filter((f) => f.devisId).length;

  // ---- Taux & score ----
  // Taux d'encaissement en montant : F CFA encaissés / F CFA facturés (hors brouillons).
  // Plafonné à 100 : des paiements sur brouillons ou des données anciennes
  // surpayées feraient sinon afficher « 150 % » dans un anneau plein.
  const tauxEncaissement = factureTotal ? Math.min(100, Math.round((encaisseTotal / factureTotal) * 100)) : 0;
  const tauxConversion = myFactures.length ? Math.round((convertis / myFactures.length) * 100) : 0;
  const partTVA = myFactures.length
    ? Math.round((myFactures.filter((f) => f.tvaActive).length / myFactures.length) * 100)
    : 0;
  const sante = Math.round((tauxEncaissement + tauxConversion + partTVA) / 3);

  // ---- Séries ----
  const monthlyRevenue = computeMonthlyRevenue(myFactures);
  const maxRevenue = Math.max(1, ...monthlyRevenue.map((m) => m.revenue));
  const sixMonthRevenue = monthlyRevenue.reduce((sum, m) => sum + m.revenue, 0);
  const countByStatut = Object.fromEntries(STATUT_META.map((st) => [st.id, 0]));
  myFactures.forEach((f) => { countByStatut[statutEffectif(f)] += 1; });
  const maxStatut = Math.max(1, ...Object.values(countByStatut));

  // ---- Abonnement ----
  const sub = getSubscriptionForUser(user.id);
  const subStatus = sub ? effectiveStatus(sub) : null;
  const subDays = sub ? daysLeft(sub) : null;

  // ---- Bandeau de statistiques (comptages) ----
  const stats = [
    { key: 'mois', value: facturesThisMonth.length, label: 'Factures · ce mois', tone: 'info' },
    { key: 'payees', value: payeesThisMonth.length, label: 'Payées · ce mois', tone: 'success' },
    { key: 'impayees', value: impayees.length, label: 'Impayées', tone: 'warning' },
    { key: 'retards', value: retards.length, label: 'En retard', tone: 'error' },
    { key: 'brouillons', value: brouillons.length, label: 'Brouillons', tone: 'accent' },
    { key: 'clients', value: clientsCount, label: 'Clients facturés', tone: 'primary' },
  ];

  // ---- Feed d'alertes (trié par sévérité) ----
  const feed = [];
  if (!company?.nomEntreprise)
    feed.push({ id: 'company', sev: 'critique', label: 'Entreprise non configurée', entity: 'Plus → Devis Pro → Mon entreprise' });
  // Factures en retard d'échéance : priorité maximale, du plus ancien retard au plus récent.
  retards
    .slice()
    .sort((a, b) => joursRetard(b) - joursRetard(a))
    .slice(0, 4)
    .forEach((f) => {
      feed.push({ id: `ret-${f.id}`, sev: 'critique', label: `En retard de ${joursRetard(f)} j`, entity: `${f.numero || '—'} · reste ${formatCFA(resteAPayer(f))}` });
    });
  // Impayées dans les temps : signale celles dont l'échéance approche (≤ 7 j).
  impayees
    .filter((f) => !isEnRetard(f))
    .map((f) => [f, joursAvantEcheance(f)])
    .filter(([, j]) => j != null && j <= 7)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .forEach(([f, j]) => {
      feed.push({ id: `ech-${f.id}`, sev: 'alerte', label: `Échéance dans ${j} j`, entity: `${f.numero || '—'} · reste ${formatCFA(resteAPayer(f))}` });
    });
  if (sub && subStatus === 'actif' && subDays != null && subDays <= 7)
    feed.push({ id: 'sub', sev: 'info', label: `Abonnement Pro expire dans ${subDays} j`, entity: 'À renouveler' });
  if (brouillons.length)
    feed.push({ id: 'draft', sev: 'info', label: `${brouillons.length} brouillon(s) à finaliser`, entity: 'Devis Pro' });
  feed.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
  const feedTop = feed.slice(0, 6);

  const perfBars = [
    { label: 'Taux d’encaissement', val: tauxEncaissement, color: 'var(--success)' },
    { label: 'Conversion devis', val: tauxConversion, color: 'var(--primary)' },
    { label: 'Factures avec TVA', val: partTVA, color: 'var(--accent)' },
  ];

  const recentFactures = myFactures.slice(0, 6);

  return (
    <div className="page">
      <PageHeader
        title={company?.nomEntreprise || 'Mon Entreprise'}
        subtitle="Espace Pro — tableau de bord"
      />
      <div className="page-content">
        {/* Bandeau de statistiques */}
        <div className="stat-strip">
          {stats.map((s) => (
            <div key={s.key} className={`stat-pill is-${s.tone}`}>
              <span className="stat-pill-num">{s.value}</span>
              <span className="stat-pill-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* CA encaissé + Alertes récentes */}
        <div className="dash-row wide-left">
          <div className="card chart-card">
            <div className="dash-card-head">
              <span className="dash-dot dot-primary" />
              <span className="card-title">Chiffre d'affaires encaissé</span>
              <span className="dash-head-meta">6 derniers mois</span>
            </div>
            <div className="bar-chart bar-chart-lg">
              {monthlyRevenue.map((m) => (
                <div key={m.month} className="bar-group" title={`${m.month} : ${formatCFA(m.revenue)} · ${m.count} encaissement(s)`}>
                  <div className="bar-wrapper">
                    <div className="bar bar-won" style={{ height: `${(m.revenue / maxRevenue) * 100}%` }} />
                  </div>
                  <div className="bar-label">{m.month}</div>
                  <div className="bar-sublabel">{m.count > 0 ? m.count : '—'}</div>
                </div>
              ))}
            </div>
            <div className="chart-legend">
              <span className="legend-item legend-revenue">Encaissé ce mois : <strong>{formatCFA(caEncaisseMois)}</strong></span>
              <span className="legend-item legend-revenue">CA 6 mois : <strong>{formatCFA(sixMonthRevenue)}</strong></span>
              <span className="legend-item legend-revenue">Reste à encaisser : <strong>{formatCFA(resteTotal)}</strong></span>
              {retardTotal > 0 && (
                <span className="legend-item legend-revenue text-danger">dont en retard : <strong>{formatCFA(retardTotal)}</strong></span>
              )}
            </div>
          </div>

          <div className="card">
            <div className="dash-card-head">
              <span className="dash-dot dot-error" />
              <span className="card-title">Alertes récentes</span>
            </div>
            {feedTop.length ? (
              <div className="alert-feed">
                {feedTop.map((a) => (
                  <div key={a.id} className="alert-feed-row">
                    <span className={`alert-badge sev-${a.sev}`}>{SEV_LABEL[a.sev]}</span>
                    <div className="alert-feed-text">
                      <div className="alert-feed-title">{a.label}</div>
                      <div className="alert-feed-entity">{a.entity}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="alert-empty">
                <CheckCircle2 size={26} />
                <span>Tout est à jour</span>
              </div>
            )}
          </div>
        </div>

        {/* Indicateurs clés (anneaux) + Performance (barres) */}
        <div className="dash-row">
          <div className="card">
            <div className="dash-card-head">
              <span className="dash-dot dot-accent" />
              <span className="card-title">Indicateurs clés</span>
            </div>
            <div className="ring-row">
              <div className="ring-item">
                <Ring value={tauxEncaissement} color="var(--success)"><span className="ring-value">{tauxEncaissement}%</span></Ring>
                <div className="ring-label">Taux d'encaissement</div>
              </div>
              <div className="ring-item">
                <Ring value={tauxConversion} color="var(--primary)"><span className="ring-value">{tauxConversion}%</span></Ring>
                <div className="ring-label">Conversion devis</div>
              </div>
            </div>
            <div className="ring-legend">
              <span className="legend-item"><span className="stat-dot" style={{ background: 'var(--success)' }} /> {payees.length} payée(s)</span>
              <span className="legend-item"><span className="stat-dot" style={{ background: 'var(--accent)' }} /> {impayees.length} en attente</span>
              {retards.length > 0 && (
                <span className="legend-item"><span className="stat-dot" style={{ background: 'var(--error)' }} /> {retards.length} en retard</span>
              )}
            </div>
          </div>

          <div className="card">
            <div className="dash-card-head">
              <span className="dash-dot dot-success" />
              <span className="card-title">Santé de facturation</span>
            </div>
            <div className="rating-head">
              <span className="rating-score">{sante}<small>/100</small></span>
              <span className="rating-score-label">Score global</span>
            </div>
            {perfBars.map((b) => (
              <div key={b.label} className="rating-bar-row">
                <span className="rating-bar-label">{b.label}</span>
                <span className="rating-bar-track"><span className="rating-bar-fill" style={{ width: `${b.val}%`, background: b.color }} /></span>
                <span className="rating-bar-val">{b.val}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Factures par statut */}
        <div className="card dash-block">
          <div className="dash-card-head">
            <span className="dash-dot dot-primary" />
            <span className="card-title">Factures par statut</span>
            <span className="dash-head-meta">{myFactures.length} au total</span>
          </div>
          <div className="stage-ring-grid">
            {STATUT_META.map((st) => (
              <div key={st.id} className="stage-ring-card">
                <Ring value={(countByStatut[st.id] / maxStatut) * 100} color={st.color} size={72} stroke={7}>
                  <span className="stage-ring-count">{countByStatut[st.id]}</span>
                </Ring>
                <div className="stage-ring-label">{st.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Factures récentes */}
        <div className="card dash-block">
          <div className="dash-card-head">
            <span className="dash-dot dot-accent" />
            <span className="card-title">Factures récentes</span>
          </div>
          {recentFactures.length ? (
            <div className="alert-feed">
              {recentFactures.map((f) => {
                const eff = statutEffectif(f);
                return (
                  <div key={f.id} className="alert-feed-row">
                    <span className={`badge badge-${STATUT_EFFECTIF_BADGE[eff]}`}>{STATUT_EFFECTIF_LABEL[eff]}</span>
                    <div className="alert-feed-text">
                      <div className="alert-feed-title">{f.numero} — {f.clientName}</div>
                      <div className="alert-feed-entity">{formatDate(f.createdAt)}</div>
                    </div>
                    <span className="sheet-value amount">{formatCFA(f.totalTTC)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="alert-empty">
              <Building2 size={26} />
              <span>Aucune facture — créez-en une depuis Plus → Devis Pro</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
