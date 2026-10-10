// Sévérité des alertes des tableaux de bord (libellés affichés + ordre de tri).
// Partagé par le tableau de bord public, le tableau de bord Pro et la cloche
// de notifications (components/NotificationBell.jsx).
import { ageInDays } from './date';
import { formatCFA } from './format';
import { effectiveStatus, daysLeft } from './subscription';
import { resteAPayer, isEnRetard, joursRetard, joursAvantEcheance } from './paiement';

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

/**
 * Flux d'alertes de l'espace Pro : l'entreprise de l'abonné, SES factures,
 * son abonnement — rien du carnet public (clients, devis, commissions) : les
 * deux espaces sont étanches. Partagé par le tableau de bord Pro et la cloche
 * de notifications en mode Pro ; les liens mènent aux écrans Pro.
 * @param {object} o
 * @param {object|null} o.company   entreprise de l'abonné
 * @param {Array} o.factures        factures DE L'ABONNÉ
 * @param {object|null} o.sub       abonnement
 */
export function buildAlertFeedPro({ company = null, factures = [], sub = null, maintenant = new Date() }) {
  const now = maintenant.getTime();
  const feed = [];
  if (!company?.nomEntreprise)
    feed.push({ id: 'company', sev: 'critique', label: 'Entreprise non configurée', entity: 'Onglet Entreprise → Mon entreprise', to: '/pro/entreprise' });

  const impayees = factures.filter((f) => f.statut !== 'brouillon' && resteAPayer(f) > 0);
  // Factures en retard d'échéance : priorité maximale, du plus ancien retard au plus récent.
  impayees
    .filter((f) => isEnRetard(f, now))
    .sort((a, b) => joursRetard(b, now) - joursRetard(a, now))
    .slice(0, 4)
    .forEach((f) => feed.push({
      id: `ret-${f.id}`, sev: 'critique', label: `En retard de ${joursRetard(f, now)} j`,
      entity: `${f.numero || '—'} · reste ${formatCFA(resteAPayer(f))}`, to: '/pro/documents',
    }));
  // Impayées dans les temps : celles dont l'échéance approche (≤ 7 j).
  impayees
    .filter((f) => !isEnRetard(f, now))
    .map((f) => [f, joursAvantEcheance(f, now)])
    .filter(([, j]) => j != null && j <= 7)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .forEach(([f, j]) => feed.push({
      id: `ech-${f.id}`, sev: 'alerte', label: `Échéance dans ${j} j`,
      entity: `${f.numero || '—'} · reste ${formatCFA(resteAPayer(f))}`, to: '/pro/documents',
    }));

  const subStatus = sub ? effectiveStatus(sub) : null;
  const subDays = sub ? daysLeft(sub) : null;
  if (sub && subStatus === 'actif' && subDays != null && subDays <= 7)
    feed.push({ id: 'sub', sev: 'info', label: `Abonnement Pro expire dans ${subDays} j`, entity: 'À renouveler', to: '/pro/abonnement' });

  const brouillons = factures.filter((f) => f.statut === 'brouillon');
  if (brouillons.length)
    feed.push({ id: 'draft', sev: 'info', label: `${brouillons.length} brouillon(s) à finaliser`, entity: 'Onglet Devis & Factures', to: '/pro/documents' });

  feed.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
  return feed;
}
