// Sévérité des alertes des tableaux de bord (libellés affichés + ordre de tri).
// Partagé par le tableau de bord public, le tableau de bord Pro et la cloche
// de notifications (components/NotificationBell.jsx).
import { ageInDays } from './date';
import { formatCFA } from './format';
import { effectiveStatus, daysLeft } from './subscription';

export const SEV_LABEL = { critique: 'CRITIQUE', alerte: 'ALERTE', info: 'INFO' };
export const SEV_ORDER = { critique: 0, alerte: 1, info: 2 };

/**
 * Flux d'alertes commerciales, trié par sévérité. Extrait du tableau de bord
 * pour être partagé avec la cloche de notifications, visible sur tous les
 * écrans — une seule construction du flux, jamais deux qui pourraient diverger.
 *
 * Les listes (`staleLeads`, `sansSuite`, `pendingComm`) sont calculées par
 * l'appelant : cette fonction ne fait que les mettre en forme et les trier,
 * elle ne connaît pas la structure de `leads`/`devis`/`commissions`.
 */
export function buildAlertFeed({ user, staleLeads = [], sansSuite = [], sub = null, pendingComm = [], maintenant = new Date() }) {
  const ageDays = (iso) => ageInDays(iso, maintenant);
  const feed = [];

  sansSuite.slice(0, 3).forEach(({ devis: d, lead, jours }) =>
    feed.push({
      id: `sansSuite-${d.id}`, sev: 'alerte', label: `Devis sans suite depuis ${jours} j`,
      entity: lead?.name || d.devisNumber, to: '/devis', state: { typeFilter: 'sans-suite' },
    }));

  staleLeads.slice(0, 4).forEach((l) => {
    const age = ageDays(l.lastActivity);
    const label = Number.isFinite(age) ? `Sans activité depuis ${Math.round(age)} j` : 'Aucune activité enregistrée';
    feed.push({ id: `stale-${l.id}`, sev: 'alerte', label, entity: l.name, to: '/pipeline' });
  });

  const subStatus = sub ? effectiveStatus(sub) : null;
  const subDays = sub ? daysLeft(sub) : null;
  if (sub && subStatus === 'actif' && subDays != null && subDays <= 7)
    feed.push({ id: 'sub', sev: 'info', label: `Abonnement Devis Pro expire dans ${subDays} j`, entity: 'À renouveler' });

  if (user.role === 'gerant' && pendingComm.length) {
    const total = pendingComm.reduce((s, c) => s + (c.amount || 0), 0);
    feed.push({ id: 'comm', sev: 'info', label: `${pendingComm.length} commission(s) à payer`, entity: formatCFA(total), to: '/plus/commissions' });
  }

  feed.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
  return feed;
}
