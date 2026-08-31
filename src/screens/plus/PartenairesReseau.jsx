import { Network, Phone, Mail, RefreshCw, Crown, Smartphone } from 'lucide-react';
import { initials, formatDate } from '../../utils/format';
import EmptyState from '../../components/EmptyState';

/**
 * Partenaires du réseau : ceux qui se sont inscrits par un lien d'affiliation
 * et travaillent donc dans leur PROPRE entreprise. Leur fiche vit chez eux —
 * d'où la lecture seule. Le gérant y trouve ce qui lui manquait : leur code
 * et leurs coordonnées.
 */
export default function PartenairesReseau({ partenaires, enCours, erreur, onRecharger, recherche = '' }) {
  const q = recherche.trim().toLowerCase();
  const visibles = q
    ? partenaires.filter((p) => [p.nom, p.code, p.telephone, p.momo, p.org_name]
      .some((v) => (v || '').toLowerCase().includes(q)))
    : partenaires;

  if (!erreur && !partenaires.length) return null;

  return (
    <>
      <div className="section-title" style={{ marginTop: 22 }}>
        <Network size={15} style={{ verticalAlign: -2, marginRight: 6 }} />
        Partenaires du réseau ({visibles.length})
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
        Inscrits par votre lien d’affiliation, chacun dans sa propre entreprise,
        sur toute la profondeur de votre réseau. Consultation seule : leur fiche
        reste chez eux.
      </p>

      {erreur && <EmptyState card>{erreur}</EmptyState>}

      <div className="partners-list">
        {visibles.map((partenaire) => (
          <div key={partenaire.partner_id} className="card partner-card">
            <div className="partner-header">
              <div className="partner-avatar">{initials(partenaire.nom || '?')}</div>
              <div className="partner-info">
                <div className="partner-name">
                  {partenaire.nom || 'Sans nom'}
                  {partenaire.code && <span className="partner-code-chip">{partenaire.code}</span>}
                </div>
                <div className="partner-type">
                  <Network size={12} /> {partenaire.org_name || 'Entreprise partenaire'}
                  {partenaire.niveau > 1 ? ` · niveau ${partenaire.niveau}` : ' · filleul direct'}
                  {partenaire.inscrit_le ? ` · inscrit le ${formatDate(partenaire.inscrit_le)}` : ''}
                </div>
              </div>
              {partenaire.pro_actif && (
                <span className="badge badge-success"><Crown size={11} /> Pro</span>
              )}
            </div>
            <div className="client-card-lines">
              {partenaire.telephone && <span className="client-card-line"><Phone size={14} /> {partenaire.telephone}</span>}
              {partenaire.momo && partenaire.momo !== partenaire.telephone && (
                <span className="client-card-line"><Smartphone size={14} /> {partenaire.momo} (Mobile Money)</span>
              )}
              {partenaire.email && <span className="client-card-line"><Mail size={14} /> {partenaire.email}</span>}
              {!partenaire.telephone && !partenaire.email && (
                <span className="client-card-line is-empty"><Phone size={14} /> Aucune coordonnée</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {!erreur && visibles.length === 0 && (
        <EmptyState card>Aucun partenaire du réseau ne correspond à cette recherche.</EmptyState>
      )}
    </>
  );
}
