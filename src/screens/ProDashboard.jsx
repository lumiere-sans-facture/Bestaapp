import { Building2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatCFA, formatDate } from '../utils/format';
import { computeMonthlyRevenue } from '../utils/stats';
import { effectiveStatus, daysLeft } from '../utils/subscription';
import { isSameMonth, ageInDays } from '../utils/date';
import { SEV_LABEL, SEV_ORDER } from '../utils/alerts';
import { FACTURE_STATUT_BADGE } from '../utils/facture';
import PageHeader from '../components/PageHeader';
import Ring from '../components/Ring';

const STATUT_META = [
  { id: 'brouillon', label: 'Brouillons', color: 'var(--text-muted)' },
  { id: 'emise', label: 'Émises', color: 'var(--accent)' },
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
  const ageDays = (iso) => ageInDays(iso, now);
  const isThisMonth = (iso) => isSameMonth(iso, now);

  const company = getCompanyForUser(user.id);
  const myFactures = (factures || []).filter((f) => f.userId === user.id);

  // ---- Comptages par statut ----
  const brouillons = myFactures.filter((f) => f.statut === 'brouillon');
  const emises = myFactures.filter((f) => f.statut === 'emise');
  const payees = myFactures.filter((f) => f.statut === 'payee');
  const facturesThisMonth = myFactures.filter((f) => isThisMonth(f.createdAt));
  const payeesThisMonth = payees.filter((f) => isThisMonth(f.createdAt));

  // ---- Montants ----
  const caEncaisseMois = payeesThisMonth.reduce((s, f) => s + (f.totalTTC || 0), 0);
  const impayeesTotal = emises.reduce((s, f) => s + (f.totalTTC || 0), 0);
  const clientsCount = new Set(
    myFactures.map((f) => (f.clientName || '').trim().toLowerCase()).filter(Boolean)
  ).size;
  const convertis = myFactures.filter((f) => f.devisId).length;

  // ---- Taux & score ----
  const closedTotal = emises.length + payees.length;
  const tauxEncaissement = closedTotal ? Math.round((payees.length / closedTotal) * 100) : 0;
  const tauxConversion = myFactures.length ? Math.round((convertis / myFactures.length) * 100) : 0;
  const partTVA = myFactures.length
    ? Math.round((myFactures.filter((f) => f.tvaActive).length / myFactures.length) * 100)
    : 0;
  const sante = Math.round((tauxEncaissement + tauxConversion + partTVA) / 3);

  // ---- Séries ----
  const monthlyRevenue = computeMonthlyRevenue(myFactures);
  const maxRevenue = Math.max(1, ...monthlyRevenue.map((m) => m.revenue));
  const sixMonthRevenue = monthlyRevenue.reduce((sum, m) => sum + m.revenue, 0);
  const maxStatut = Math.max(1, brouillons.length, emises.length, payees.length);

  // ---- Abonnement ----
  const sub = getSubscriptionForUser(user.id);
  const subStatus = sub ? effectiveStatus(sub) : null;
  const subDays = sub ? daysLeft(sub) : null;

  // ---- Bandeau de statistiques (comptages) ----
  const stats = [
    { key: 'mois', value: facturesThisMonth.length, label: 'Factures · ce mois', tone: 'info' },
    { key: 'payees', value: payeesThisMonth.length, label: 'Payées · ce mois', tone: 'success' },
    { key: 'impayees', value: emises.length, label: 'Impayées', tone: 'warning' },
    { key: 'brouillons', value: brouillons.length, label: 'Brouillons', tone: 'accent' },
    { key: 'clients', value: clientsCount, label: 'Clients facturés', tone: 'primary' },
    { key: 'convertis', value: convertis, label: 'Devis convertis', tone: 'success' },
  ];

  // ---- Feed d'alertes (trié par sévérité) ----
  const feed = [];
  if (!company?.nomEntreprise)
    feed.push({ id: 'company', sev: 'critique', label: 'Entreprise non configurée', entity: 'Plus → Devis Pro → Mon entreprise' });
  emises
    .slice()
    .sort((a, b) => ageDays(b.createdAt) - ageDays(a.createdAt))
    .slice(0, 4)
    .forEach((f) => {
      const age = ageDays(f.createdAt);
      const label = Number.isFinite(age) ? `Impayée depuis ${Math.round(age)} j` : 'Facture impayée';
      feed.push({ id: `imp-${f.id}`, sev: 'alerte', label, entity: `${f.numero || '—'} · ${formatCFA(f.totalTTC)}` });
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
                <div key={m.month} className="bar-group" title={`${m.month} : ${formatCFA(m.revenue)} · ${m.count} facture(s)`}>
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
              <span className="legend-item"><span className="stat-dot" style={{ background: 'var(--accent)' }} /> {emises.length} en attente</span>
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
            {STATUT_META.map((st) => {
              const count = myFactures.filter((f) => f.statut === st.id).length;
              return (
                <div key={st.id} className="stage-ring-card">
                  <Ring value={(count / maxStatut) * 100} color={st.color} size={72} stroke={7}>
                    <span className="stage-ring-count">{count}</span>
                  </Ring>
                  <div className="stage-ring-label">{st.label}</div>
                </div>
              );
            })}
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
                const [badgeClass, badgeLabel] = FACTURE_STATUT_BADGE[f.statut] || FACTURE_STATUT_BADGE.brouillon;
                return (
                  <div key={f.id} className="alert-feed-row">
                    <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
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
