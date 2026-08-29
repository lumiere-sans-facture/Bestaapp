import { useState } from 'react';
import { Bell, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ageInDays } from '../utils/date';
import { devisSansSuite } from '../utils/affaires';
import { buildAlertFeed, SEV_LABEL } from '../utils/alerts';
import Sheet from './Sheet';

/**
 * Cloche de notifications, visible sur tous les écrans (insérée dans
 * PageHeader) : reprend le même flux d'alertes que le tableau de bord
 * (utils/alerts.js#buildAlertFeed), pour que l'utilisateur le voie sans
 * devoir naviguer jusqu'au dashboard.
 */
export default function NotificationBell() {
  const { user } = useAuth();
  const { leadsForUser, devis, commissions, getSubscriptionForUser } = useData();
  const [open, setOpen] = useState(false);

  const myLeads = leadsForUser(user);
  const openLeads = myLeads.filter((l) => l.stage !== 'gagne' && l.stage !== 'perdu');
  const staleLeads = openLeads.filter((l) => ageInDays(l.lastActivity) > 7);
  const myDevis = user.role === 'gerant' ? (devis || []) : (devis || []).filter((d) => d.createdBy === user.id);
  const sansSuite = devisSansSuite(myDevis, myLeads);
  const pendingComm = (commissions || []).filter((c) => c.status === 'en_attente');
  const sub = getSubscriptionForUser(user.id);

  const feed = buildAlertFeed({ user, staleLeads, sansSuite, sub, pendingComm });

  return (
    <>
      <button
        type="button"
        className="notif-bell"
        onClick={() => setOpen(true)}
        aria-label={feed.length ? `Notifications (${feed.length} à traiter)` : 'Notifications'}
      >
        <Bell size={20} />
        {feed.length > 0 && <span className="notif-badge">{feed.length > 9 ? '9+' : feed.length}</span>}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Notifications">
        {feed.length ? (
          <div className="alert-feed">
            {feed.map((a) => {
              const Row = a.to ? Link : 'div';
              const rowProps = a.to
                ? { to: a.to, state: a.state, onClick: () => setOpen(false), style: { textDecoration: 'none', color: 'inherit' } }
                : {};
              return (
                <Row key={a.id} className="alert-feed-row" {...rowProps}>
                  <span className={`alert-badge sev-${a.sev}`}>{SEV_LABEL[a.sev]}</span>
                  <div className="alert-feed-text">
                    <div className="alert-feed-title">{a.label}</div>
                    <div className="alert-feed-entity">{a.entity}</div>
                  </div>
                </Row>
              );
            })}
          </div>
        ) : (
          <div className="alert-empty">
            <CheckCircle2 size={26} />
            <span>Tout est à jour</span>
          </div>
        )}
      </Sheet>
    </>
  );
}
