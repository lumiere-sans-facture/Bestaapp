import { CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatCFA } from '../utils/format';
import { computeMonthlyStats } from '../utils/stats';
import { effectiveStatus, daysLeft } from '../utils/subscription';
import PageHeader from '../components/PageHeader';

// Anneau de progression (donut SVG) — réutilisé pour les indicateurs et les étapes.
function Ring({ value, color, size = 104, stroke = 11, children }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value || 0));
  const offset = circ - (pct / 100) * circ;
  const mid = size / 2;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={mid} cy={mid} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle
          className="ring-arc"
          cx={mid} cy={mid} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform={`rotate(-90 ${mid} ${mid})`}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

const SEV_LABEL = { critique: 'CRITIQUE', alerte: 'ALERTE', info: 'INFO' };
const SEV_ORDER = { critique: 0, alerte: 1, info: 2 };

export default function Dashboard() {
  const { user } = useAuth();
  const {
    products, stages, leadsForUser, devis, partners, commissions,
    productCategories, getSubscriptionForUser,
  } = useData();

  const now = new Date();
  const DAY = 86400000;
  const sameMonth = (iso) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };
  const ageDays = (iso) => (iso ? (now - new Date(iso)) / DAY : Infinity);

  // ---- Pistes (selon le rôle) ----
  const myLeads = leadsForUser(user);
  const isOpen = (l) => l.stage !== 'gagne' && l.stage !== 'perdu';
  const openLeads = myLeads.filter(isOpen);
  const wonLeads = myLeads.filter((l) => l.stage === 'gagne');
  const winRate = myLeads.length ? Math.round((wonLeads.length / myLeads.length) * 100) : 0;
  const newThisWeek = myLeads.filter((l) => ageDays(l.createdAt) <= 7).length;
  const staleLeads = openLeads.filter((l) => ageDays(l.lastActivity) > 7);
  const followRate = openLeads.length
    ? Math.round(((openLeads.length - staleLeads.length) / openLeads.length) * 100)
    : 100;
  const wonThisMonth = myLeads.filter((l) => sameMonth(l.wonAt)).length;
  const advancedRate = openLeads.length
    ? Math.round((openLeads.filter((l) => ['visite', 'proposition', 'negociation'].includes(l.stage)).length / openLeads.length) * 100)
    : 0;
  const pipelineValue = openLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);
  const activityScore = Math.round((winRate + followRate + advancedRate) / 3);

  // ---- Devis ----
  const myDevis = user.role === 'gerant' ? (devis || []) : (devis || []).filter((d) => d.createdBy === user.id);
  const devisThisMonth = myDevis.filter((d) => sameMonth(d.createdAt)).length;

  // ---- Stock ----
  const outOfStock = products.filter((p) => p.stock === 0).length;
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const stockHealth = products.length
    ? Math.round((products.filter((p) => p.stock > 5).length / products.length) * 100)
    : 0;

  // ---- Réseau / abonnement ----
  const pendingComm = (commissions || []).filter((c) => c.status === 'en_attente');
  const pendingCommTotal = pendingComm.reduce((s, c) => s + (c.amount || 0), 0);
  const sub = getSubscriptionForUser(user.id);
  const subStatus = sub ? effectiveStatus(sub) : null;
  const subDays = sub ? daysLeft(sub) : null;

  // ---- Séries ----
  const monthlyData = computeMonthlyStats(myLeads);
  const maxBar = Math.max(1, ...monthlyData.map((m) => Math.max(m.leads, m.won)));
  const sixMonthRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);
  const maxStage = Math.max(1, ...stages.map((s) => myLeads.filter((l) => l.stage === s.id).length));
  const catData = (productCategories || []).map((c) => ({ ...c, count: products.filter((p) => p.category === c.id).length }));
  const maxCat = Math.max(1, ...catData.map((c) => c.count));

  // ---- Bandeau de statistiques ----
  const stats = [
    { key: 'actives', value: openLeads.length, label: 'Pistes actives', tone: 'info' },
    { key: 'new', value: newThisWeek, label: 'Nouvelles · 7j', tone: 'accent' },
    { key: 'stale', value: staleLeads.length, label: 'À relancer', tone: 'warning' },
    { key: 'won', value: wonThisMonth, label: 'Gagnées · ce mois', tone: 'success' },
    { key: 'devis', value: devisThisMonth, label: 'Devis · ce mois', tone: 'primary' },
    { key: 'stock', value: lowStock + outOfStock, label: 'Alertes stock', tone: 'error' },
  ];

  // ---- Feed d'alertes (trié par sévérité) ----
  const feed = [];
  products.filter((p) => p.stock === 0).slice(0, 3).forEach((p) =>
    feed.push({ id: `oos-${p.id}`, sev: 'critique', label: 'Rupture de stock', entity: p.name }));
  products.filter((p) => p.stock > 0 && p.stock <= 5).slice(0, 3).forEach((p) =>
    feed.push({ id: `low-${p.id}`, sev: 'alerte', label: `Stock faible — ${p.stock} restant(s)`, entity: p.name }));
  staleLeads.slice(0, 4).forEach((l) => {
    const age = ageDays(l.lastActivity);
    const label = Number.isFinite(age) ? `Sans activité depuis ${Math.round(age)} j` : 'Aucune activité enregistrée';
    feed.push({ id: `stale-${l.id}`, sev: 'alerte', label, entity: l.name });
  });
  if (sub && subStatus === 'actif' && subDays != null && subDays <= 7)
    feed.push({ id: 'sub', sev: 'info', label: `Abonnement Devis Pro expire dans ${subDays} j`, entity: 'À renouveler' });
  if (user.role === 'gerant' && pendingComm.length)
    feed.push({ id: 'comm', sev: 'info', label: `${pendingComm.length} commission(s) à payer`, entity: formatCFA(pendingCommTotal) });
  feed.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
  const feedTop = feed.slice(0, 6);

  const perfBars = [
    { label: 'Taux de closing', val: winRate, color: 'var(--primary)' },
    { label: 'Suivi des pistes', val: followRate, color: 'var(--success)' },
    { label: 'Pipeline avancé', val: advancedRate, color: 'var(--accent)' },
  ];

  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="page">
      <PageHeader title={`Bonjour, ${user.name.split(' ')[0]}`} subtitle={dateStr} />
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

        {/* Activité commerciale + Alertes récentes */}
        <div className="dash-row wide-left">
          <div className="card chart-card">
            <div className="dash-card-head">
              <span className="dash-dot dot-primary" />
              <span className="card-title">Activité commerciale</span>
              <span className="dash-head-meta">6 derniers mois</span>
            </div>
            <div className="bar-chart bar-chart-lg">
              {monthlyData.map((m) => (
                <div key={m.month} className="bar-group" title={`${m.month} : ${m.leads} piste(s) · ${m.won} gagnée(s) · CA ${formatCFA(m.revenue)}`}>
                  <div className="bar-wrapper">
                    <div className="bar bar-leads" style={{ height: `${(m.leads / maxBar) * 100}%` }} />
                    <div className="bar bar-won" style={{ height: `${(m.won / maxBar) * 100}%` }} />
                  </div>
                  <div className="bar-label">{m.month}</div>
                </div>
              ))}
            </div>
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-dot legend-leads" /> Pistes créées</span>
              <span className="legend-item"><span className="legend-dot legend-won" /> Gagnées</span>
              <span className="legend-item legend-revenue">CA gagné : <strong>{formatCFA(sixMonthRevenue)}</strong></span>
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
                <Ring value={winRate} color="var(--primary)"><span className="ring-value">{winRate}%</span></Ring>
                <div className="ring-label">Taux de conversion</div>
              </div>
              <div className="ring-item">
                <Ring value={stockHealth} color="var(--success)"><span className="ring-value">{stockHealth}%</span></Ring>
                <div className="ring-label">Stock disponible</div>
              </div>
            </div>
            <div className="ring-legend">
              <span className="legend-item"><span className="stat-dot" style={{ background: 'var(--success)' }} /> {products.length - outOfStock} en stock</span>
              <span className="legend-item"><span className="stat-dot" style={{ background: 'var(--error)' }} /> {outOfStock} rupture(s)</span>
            </div>
          </div>

          <div className="card">
            <div className="dash-card-head">
              <span className="dash-dot dot-success" />
              <span className="card-title">Performance</span>
            </div>
            <div className="rating-head">
              <span className="rating-score">{activityScore}<small>/100</small></span>
              <span className="rating-score-label">Score d'activité</span>
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

        {/* Pistes par étape */}
        <div className="card dash-block">
          <div className="dash-card-head">
            <span className="dash-dot dot-primary" />
            <span className="card-title">Pistes par étape</span>
            <span className="dash-head-meta">{formatCFA(pipelineValue)} en cours</span>
          </div>
          <div className="stage-ring-grid">
            {stages.map((s) => {
              const count = myLeads.filter((l) => l.stage === s.id).length;
              return (
                <div key={s.id} className="stage-ring-card">
                  <Ring value={(count / maxStage) * 100} color={s.color} size={72} stroke={7}>
                    <span className="stage-ring-count">{count}</span>
                  </Ring>
                  <div className="stage-ring-label">{s.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Catalogue par catégorie (gérant) */}
        {user.role === 'gerant' && (
          <div className="card chart-card dash-block">
            <div className="dash-card-head">
              <span className="dash-dot dot-accent" />
              <span className="card-title">Catalogue par catégorie</span>
              <span className="dash-head-meta">{products.length} références</span>
            </div>
            <div className="bar-chart bar-chart-lg">
              {catData.map((c) => (
                <div key={c.id} className="bar-group" title={`${c.label} : ${c.count} référence(s)`}>
                  <div className="bar-wrapper">
                    <div className="bar bar-cat" style={{ height: `${(c.count / maxCat) * 100}%` }} />
                  </div>
                  <div className="bar-label">{c.label}</div>
                  <div className="bar-sublabel">{c.count}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
