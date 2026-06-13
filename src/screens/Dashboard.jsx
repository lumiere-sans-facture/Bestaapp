import { useState } from 'react';
import { TrendingUp, Users, Target, Package, Wrench, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatCFA } from '../utils/format';
import { computeMonthlyStats } from '../utils/stats';
import PageHeader from '../components/PageHeader';
import ProDashboard from './ProDashboard';

const SPACE_KEY = 'bestasolar_dashboard_space';

export default function Dashboard() {
  const { user } = useAuth();
  const { products, stages, leadsForUser, leads, getCompanyForUser } = useData();

  // L'espace « Mon Entreprise » concerne les techniciens (le gérant gère les
  // abonnements, il n'a pas d'espace pro personnel). Le sélecteur est visible
  // même sans abonnement : l'espace Pro affiche alors une invitation à s'abonner.
  const canSeePro = user.role !== 'gerant';
  const [space, setSpace] = useState(() => localStorage.getItem(SPACE_KEY) || 'tech');
  const showPro = canSeePro && space === 'pro';
  const switchSpace = (next) => {
    setSpace(next);
    localStorage.setItem(SPACE_KEY, next);
  };

  const myLeads = leadsForUser(user);
  const pipelineValue = myLeads.filter((l) => l.stage !== 'gagne').reduce((sum, l) => sum + l.estimatedValue, 0);
  const wonLeads = myLeads.filter((l) => l.stage === 'gagne');
  const winRate = myLeads.length > 0 ? Math.round((wonLeads.length / myLeads.length) * 100) : 0;
  const outOfStock = products.filter((p) => p.stock === 0).length;
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
  // Courbes vivantes : calculées depuis le suivi réel des clients
  const monthlyData = computeMonthlyStats(myLeads);
  const maxLeads = Math.max(1, ...monthlyData.map((m) => m.leads), ...monthlyData.map((m) => m.won));
  const sixMonthRevenue = monthlyData.reduce((sum, m) => sum + m.revenue, 0);
  const dateStr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const alerts = [];
  if (outOfStock > 0) alerts.push({ id: 1, message: `${outOfStock} produit(s) en rupture de stock`, priority: 'high' });
  if (lowStock > 0) alerts.push({ id: 2, message: `${lowStock} produit(s) avec stock faible`, priority: 'medium' });

  const proName = getCompanyForUser(user.id)?.nomEntreprise;

  return (
    <div className="page">
      <PageHeader
        title={showPro ? (proName || 'Mon Entreprise') : `Bonjour, ${user.name.split(' ')[0]}`}
        subtitle={showPro ? 'Espace Pro — tableau de bord business' : dateStr}
      />
      <div className="page-content">
        {canSeePro && (
          <div className="categories-scroll space-switcher">
            <button className={`category-chip ${!showPro ? 'active' : ''}`} onClick={() => switchSpace('tech')}>
              <Wrench size={14} /> Technicien
            </button>
            <button className={`category-chip ${showPro ? 'active' : ''}`} onClick={() => switchSpace('pro')}>
              <Crown size={14} /> Mon Entreprise
            </button>
          </div>
        )}

        {showPro ? <ProDashboard /> : (
        <>
        <div className="kpi-grid">
          <div className="kpi-card highlight">
            <div className="kpi-icon"><TrendingUp size={20} /></div>
            <div className="kpi-value">{formatCFA(pipelineValue)}</div>
            <div className="kpi-label">Affaires en cours</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon"><Users size={20} /></div>
            <div className="kpi-value">{myLeads.length}</div>
            <div className="kpi-label">Pistes</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon"><Target size={20} /></div>
            <div className="kpi-value">{winRate}%</div>
            <div className="kpi-label">Taux de conversion</div>
          </div>
          {user.role === 'gerant' && (
            <div className="kpi-card">
              <div className="kpi-icon"><Package size={20} /></div>
              <div className="kpi-value">{lowStock + outOfStock}</div>
              <div className="kpi-label">Alertes stock</div>
            </div>
          )}
        </div>

        <div className="dashboard-grid">
          <div className="card chart-card">
            <div className="card-title">Évolution mensuelle — 6 derniers mois</div>
            <div className="bar-chart">
              {monthlyData.map((month) => (
                <div key={month.month} className="bar-group" title={`${month.month} : ${month.leads} piste(s) · ${month.won} gagnée(s) · CA ${formatCFA(month.revenue)}`}>
                  <div className="bar-wrapper">
                    <div className="bar bar-leads" style={{ height: `${(month.leads / maxLeads) * 100}%` }} />
                    <div className="bar bar-won" style={{ height: `${(month.won / maxLeads) * 100}%` }} />
                  </div>
                  <div className="bar-label">{month.month}</div>
                  <div className="bar-sublabel">{month.leads > 0 || month.won > 0 ? `${month.leads}/${month.won}` : '—'}</div>
                </div>
              ))}
            </div>
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-dot legend-leads" /> Pistes créées</span>
              <span className="legend-item"><span className="legend-dot legend-won" /> Gagnées</span>
              <span className="legend-item legend-revenue">CA gagné 6 mois : <strong>{formatCFA(sixMonthRevenue)}</strong></span>
            </div>
          </div>

          <div className="dashboard-side">
            {alerts.length > 0 && (
              <div>
                <div className="section-title">Alertes</div>
                <div className="alerts-list">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="alert-item">
                      <div className={`alert-icon ${alert.priority}`}><Package size={16} /></div>
                      <div className="alert-message">{alert.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {user.role === 'gerant' && (
              <div>
                <div className="section-title">Entonnoir des ventes</div>
                <div className="card funnel-card">
                  {stages.map((stage) => {
                    const stageLeads = leads.filter((l) => l.stage === stage.id);
                    const value = stageLeads.reduce((sum, l) => sum + l.estimatedValue, 0);
                    const maxCount = Math.max(1, ...stages.map((s) => leads.filter((l) => l.stage === s.id).length));
                    return (
                      <div key={stage.id} className="funnel-row">
                        <div className="funnel-header">
                          <span className="funnel-label">{stage.label}</span>
                          <span className="funnel-value">{stageLeads.length} · {formatCFA(value)}</span>
                        </div>
                        <div className="funnel-track">
                          <div
                            className="funnel-bar"
                            style={{ width: `${(stageLeads.length / maxCount) * 100}%`, background: stage.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
