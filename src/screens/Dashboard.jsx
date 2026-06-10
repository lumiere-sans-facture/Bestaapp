import { TrendingUp, Users, DollarSign, Package, Clock } from 'lucide-react';
import { leads, products, monthlyData, formatCFA, stages } from '../data/mockData';

export default function Dashboard({ user }) {
  const filteredLeads = user.role === 'gerant' ? leads : leads.filter(l => l.assignedTo === user.id);
  const pipelineValue = filteredLeads.filter(l => l.stage !== 'gagne').reduce((sum, l) => sum + l.estimatedValue, 0);
  const wonLeads = filteredLeads.filter(l => l.stage === 'gagne');
  const winRate = filteredLeads.length > 0 ? Math.round((wonLeads.length / filteredLeads.length) * 100) : 0;
  const lowStock = products.filter(p => p.stock <= 5).length;
  const maxLeads = Math.max(...monthlyData.map(m => m.leads));
  const today = new Date();
  const dateStr = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  const alerts = [];
  if (products.filter(p => p.stock === 0).length > 0) alerts.push({ id: 1, type: 'stock', message: `${products.filter(p => p.stock === 0).length} produit(s) en rupture de stock`, priority: 'high' });
  if (lowStock > 0) alerts.push({ id: 2, type: 'stock', message: `${lowStock} produit(s) avec stock faible`, priority: 'medium' });

  return (
    <>
      <div className="dashboard-header">
        <div className="dashboard-welcome">Bonjour, {user.name.split(' ')[0]}</div>
        <div className="dashboard-date">{dateStr}</div>
      </div>
      <div className="kpi-grid">
        <div className="kpi-card highlight"><div className="kpi-icon"><TrendingUp size={20} /></div><div className="kpi-value">{formatCFA(pipelineValue)}</div><div className="kpi-label">Pipeline</div></div>
        <div className="kpi-card"><div className="kpi-icon"><Users size={20} /></div><div className="kpi-value">{filteredLeads.length}</div><div className="kpi-label">Pistes</div></div>
        <div className="kpi-card"><div className="kpi-icon"><DollarSign size={20} /></div><div className="kpi-value">{winRate}%</div><div className="kpi-label">Taux conversion</div></div>
        {user.role === 'gerant' && <div className="kpi-card"><div className="kpi-icon"><Package size={20} /></div><div className="kpi-value">{lowStock}</div><div className="kpi-label">Stocks faibles</div></div>}
      </div>
      <div className="chart-container">
        <div className="chart-title">Évolution mensuelle</div>
        <div className="bar-chart">
          {monthlyData.map((month, i) => (
            <div key={i} className="bar-group">
              <div className="bar-wrapper">
                <div className="bar bar-leads" style={{ height: `${(month.leads / maxLeads) * 100}%` }} />
                <div className="bar bar-won" style={{ height: `${(month.won / maxLeads) * 100}%` }} />
              </div>
              <div className="bar-label">{month.month}</div>
            </div>
          ))}
        </div>
      </div>
      {alerts.length > 0 && (
        <div>
          <div className="section-title">Alertes</div>
          <div className="alerts-list">
            {alerts.map(alert => (
              <div key={alert.id} className="alert-item">
                <div className={`alert-icon ${alert.priority}`}><Package size={16} /></div>
                <div className="alert-message">{alert.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {user.role === 'gerant' && (
        <div className="mt-4">
          <div className="section-title">Résumé par étape</div>
          <div className="kpi-card">
            {stages.map(stage => {
              const count = leads.filter(l => l.stage === stage.id).length;
              const value = leads.filter(l => l.stage === stage.id).reduce((sum, l) => sum + l.estimatedValue, 0);
              return <div key={stage.id} className="sheet-row"><span className="sheet-label" style={{ color: stage.color }}>{stage.label}</span><span className="sheet-value">{count} ({formatCFA(value)})</span></div>;
            })}
          </div>
        </div>
      )}
    </>
  );
}
