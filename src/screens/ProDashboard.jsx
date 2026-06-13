import { Wallet, AlertCircle, Users, FileCheck, Building2, Receipt } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatCFA, formatDate } from '../utils/format';
import { computeMonthlyRevenue } from '../utils/stats';
import PageHeader from '../components/PageHeader';

const STATUT_BADGE = {
  payee: ['badge-success', 'Payée'],
  emise: ['badge-warning', 'Émise'],
  brouillon: ['badge-muted', 'Brouillon'],
};

const isThisMonth = (iso) => {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

/**
 * Corps du tableau de bord « Mon Entreprise » (espace Pro).
 * Rendu à l'intérieur de l'écran Dashboard, sous le sélecteur d'espace.
 * Suppose un abonnement actif (le sélecteur n'apparaît que dans ce cas).
 */
export default function ProDashboard() {
  const { user } = useAuth();
  const { factures, getCompanyForUser } = useData();

  const company = getCompanyForUser(user.id);
  const myFactures = (factures || []).filter((f) => f.userId === user.id);

  const caEncaisseMois = myFactures
    .filter((f) => f.statut === 'payee' && isThisMonth(f.createdAt))
    .reduce((sum, f) => sum + (f.totalTTC || 0), 0);
  const impayees = myFactures.filter((f) => f.statut === 'emise');
  const impayeesTotal = impayees.reduce((sum, f) => sum + (f.totalTTC || 0), 0);
  const clientsCount = new Set(
    myFactures.map((f) => (f.clientName || '').trim().toLowerCase()).filter(Boolean)
  ).size;
  const convertis = myFactures.filter((f) => f.devisId).length;

  const monthlyRevenue = computeMonthlyRevenue(myFactures);
  const maxRevenue = Math.max(1, ...monthlyRevenue.map((m) => m.revenue));
  const sixMonthRevenue = monthlyRevenue.reduce((sum, m) => sum + m.revenue, 0);

  const recentFactures = myFactures.slice(0, 6);

  return (
    <div className="page">
      <PageHeader
        title={company?.nomEntreprise || 'Mon Entreprise'}
        subtitle="Espace Pro — tableau de bord"
      />
      <div className="page-content">
      {!company?.nomEntreprise && (
        <div className="pro-alert">
          <Building2 size={17} />
          <span>Configurez d'abord <strong>votre entreprise</strong> (Plus → Devis Pro → Mon entreprise) pour personnaliser vos documents.</span>
        </div>
      )}

      <div className="kpi-grid">
        <div className="kpi-card highlight">
          <div className="kpi-icon"><Wallet size={20} /></div>
          <div className="kpi-value">{formatCFA(caEncaisseMois)}</div>
          <div className="kpi-label">CA encaissé ce mois</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon"><AlertCircle size={20} /></div>
          <div className="kpi-value">{formatCFA(impayeesTotal)}</div>
          <div className="kpi-label">{impayees.length} facture(s) impayée(s)</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon"><Users size={20} /></div>
          <div className="kpi-value">{clientsCount}</div>
          <div className="kpi-label">Clients facturés</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon"><FileCheck size={20} /></div>
          <div className="kpi-value">{convertis}</div>
          <div className="kpi-label">Devis convertis</div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card chart-card">
          <div className="card-title">Chiffre d'affaires encaissé — 6 derniers mois</div>
          <div className="bar-chart">
            {monthlyRevenue.map((month) => (
              <div key={month.month} className="bar-group" title={`${month.month} : ${formatCFA(month.revenue)} · ${month.count} facture(s)`}>
                <div className="bar-wrapper">
                  <div className="bar bar-won" style={{ height: `${(month.revenue / maxRevenue) * 100}%` }} />
                </div>
                <div className="bar-label">{month.month}</div>
                <div className="bar-sublabel">{month.count > 0 ? month.count : '—'}</div>
              </div>
            ))}
          </div>
          <div className="chart-legend">
            <span className="legend-item legend-revenue">CA encaissé 6 mois : <strong>{formatCFA(sixMonthRevenue)}</strong></span>
          </div>
        </div>

        <div className="dashboard-side">
          <div className="section-title">Factures récentes</div>
          <div className="card my-partner-section">
            {recentFactures.length ? recentFactures.map((f) => {
              const [badgeClass, badgeLabel] = STATUT_BADGE[f.statut] || STATUT_BADGE.brouillon;
              return (
                <div key={f.id} className="sheet-row">
                  <span className="sheet-label">
                    {f.numero} — {f.clientName}
                    <span className="text-secondary"> · {formatDate(f.createdAt)}</span>
                    {' '}<span className={`badge ${badgeClass}`}>{badgeLabel}</span>
                  </span>
                  <span className="sheet-value">{formatCFA(f.totalTTC)}</span>
                </div>
              );
            }) : (
              <div className="text-sm text-secondary">
                <Receipt size={15} /> Aucune facture pour l'instant. Créez-en une depuis Plus → Devis Pro.
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
