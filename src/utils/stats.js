// Statistiques mensuelles calculées depuis les données réelles de suivi client.
const MONTH_LABELS = ['Jan', 'Fév', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

const sameMonth = (iso, year, month) => {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === year && d.getMonth() === month;
};

/**
 * Évolution sur les N derniers mois (mois courant inclus) :
 * pistes créées, affaires gagnées et chiffre d'affaires gagné par mois.
 */
export const computeMonthlyStats = (leads, months = 6) => {
  const now = new Date();
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const created = leads.filter((l) => sameMonth(l.createdAt, year, month));
    const won = leads.filter((l) => sameMonth(l.wonAt, year, month));
    out.push({
      month: MONTH_LABELS[month],
      leads: created.length,
      won: won.length,
      revenue: won.reduce((sum, l) => sum + (l.estimatedValue || 0), 0),
    });
  }
  return out;
};

/**
 * Chiffre d'affaires Pro sur les N derniers mois (mois courant inclus),
 * calculé depuis les factures encaissées (statut « payee »).
 */
export const computeMonthlyRevenue = (factures, months = 6) => {
  const now = new Date();
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const paid = factures.filter((f) => f.statut === 'payee' && sameMonth(f.createdAt, year, month));
    out.push({
      month: MONTH_LABELS[month],
      revenue: paid.reduce((sum, f) => sum + (f.totalTTC || 0), 0),
      count: paid.length,
    });
  }
  return out;
};
