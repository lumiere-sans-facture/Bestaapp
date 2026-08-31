import { Phone, MapPin, Network, RefreshCw, User, Compass } from 'lucide-react';
import { initials } from '../../utils/format';
import EmptyState from '../../components/EmptyState';
import { libelleSource } from '../../utils/contactSource';

/**
 * Clients du réseau : les clients saisis par les partenaires qui ont ouvert
 * leur propre espace via un lien d'affiliation. Ils appartiennent à leur
 * entreprise — d'où la LECTURE SEULE : on les voit, on ne les modifie pas, et
 * ils ne rejoignent pas le carnet local.
 */
export default function ClientsReseau({ clients, enCours, erreur, onRecharger, recherche = '' }) {
  const q = recherche.trim().toLowerCase();
  const visibles = q
    ? clients.filter((c) => [c.nom, c.contact, c.telephone, c.telephone_2, c.partner_code, c.org_name]
      .some((v) => (v || '').toLowerCase().includes(q)))
    : clients;

  if (!erreur && !clients.length) return null;

  return (
    <>
      <div className="section-title" style={{ marginTop: 22 }}>
        <Network size={15} style={{ verticalAlign: -2, marginRight: 6 }} />
        Clients du réseau ({visibles.length})
        <button
          type="button"
          className="btn btn-sm btn-outline"
          style={{ float: 'right' }}
          onClick={onRecharger}
          disabled={enCours}
        >
          <RefreshCw size={14} /> {enCours ? 'Chargement…' : 'Actualiser'}
        </button>
      </div>
      <p className="text-sm text-secondary" style={{ marginBottom: 10 }}>
        Enregistrés par vos partenaires depuis leur propre espace. Consultation
        seule : leur fiche reste chez eux.
      </p>

      {erreur && <EmptyState card>{erreur}</EmptyState>}

      <div className="client-grid">
        {visibles.map((client) => (
          <div key={client.lead_id} className="card client-card">
            <div className="client-card-head">
              <span className="client-card-avatar">{initials(client.nom || '?')}</span>
              <span className="client-card-ident">
                <span className="client-card-name">{client.nom || 'Sans nom'}</span>
                {client.partner_code && (
                  <span className="partner-code-chip">{client.partner_code}</span>
                )}
              </span>
            </div>
            <div className="client-card-lines">
              {client.contact && <span className="client-card-line"><User size={14} /> {client.contact}</span>}
              {client.telephone && <span className="client-card-line"><Phone size={14} /> {client.telephone}</span>}
              {client.telephone_2 && <span className="client-card-line"><Phone size={14} /> {client.telephone_2}</span>}
              {libelleSource(client.origine) && (
                <span className="client-card-line"><Compass size={14} /> {libelleSource(client.origine)}</span>
              )}
              {client.adresse && <span className="client-card-line"><MapPin size={14} /> {client.adresse}</span>}
              {!client.contact && !client.telephone && !client.adresse && (
                <span className="client-card-line is-empty"><User size={14} /> Aucune coordonnée</span>
              )}
            </div>
            <div className="client-card-foot">
              <Network size={14} /> {client.org_name || 'Partenaire'}
            </div>
          </div>
        ))}
      </div>

      {!erreur && visibles.length === 0 && (
        <EmptyState card>Aucun client du réseau ne correspond à cette recherche.</EmptyState>
      )}
    </>
  );
}
