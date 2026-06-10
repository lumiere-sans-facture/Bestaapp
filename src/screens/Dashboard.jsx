import { TrendingUp, Users, Target, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatCFA } from '../utils/format';
import PageHeader from '../components/PageHeader';

export default function Dashboard() {
  const { user } = useAuth();
  const { products, stages, monthlyData, leadsForUser, leads } = useData();

  const myLeads = leadsForUser(user);
  const pipelineValue = myLeads.filter((l) => l.stage !== 'gagne').reduce((sum, l) => sum + l.estimatedValue, 0);
  const wonLeads = myLeads.filter((l) => l.stage === 'gagne');
  const winRate = myLeads.length > 0 ? Math.round((wonLeads.length / myLeads.length) * 100) : 0;
  const outOfStock = products.filter((p) => p.stock === 0).length;
  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const maxLeads = Math.max(...monthlyData.map((m) => m.leads));
  const dateStr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const alerts = [];
  if (outOfStock > 0) alerts.push({ id: 1, message: `${outOfStock} produit(s) en rupture de stock`, priority: 'high' });
  if (lowStock > 0) alerts.push({ id: 2, message: `${lowStock} produit(s) avec stock faible`, priority: 'medium' });

  return (
    <div className="page">
      <PageHeader title={`Bonjour, ${user.name.split(' ')[0]}`} subtitle={dateStr} />
      <div className="page-content">
        <div className="kpi-grid">
          <div className="kpi-card highlight">
            <div className="kpi-icon"><TrendingUp size={20} /></div>
            <div className="kpi-value">{formatCFA(pipelineValue)}</div>
            <div className="kpi-label">Pipeline en cours</div>
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
            <div className="card-title">Évolution mensuelle</div>
            <div className="bar-chart">
              {monthlyData.map((month) => (
                <div key={month.month} className="bar-group">
                  <div className="bar-wrapper">
                    <div className="bar bar-leads" style={{ height: `${(month.leads / maxLeads) * 100}%` }} title={`${month.leads} pistes`} />
                    <div className="bar bar-won" style={{ height: `${(month.won / maxLeads) * 100}%` }} title={`${month.won} gagnées`} />
                  </div>
                  <div className="bar-label">{month.month}</div>
                </div>
              ))}
            </div>
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-dot legend-leads" /> Pistes</span>
              <span className="legend-item"><span className="legend-dot legend-won" /> Gagnées</span>
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
                <div className="section-title">Entonnoir du pipeline</div>
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
      </div>
    </div>
  );
}
