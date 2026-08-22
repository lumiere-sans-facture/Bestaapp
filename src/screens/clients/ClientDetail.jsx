import { useState } from 'react';
import { Phone, Mail, MapPin, Building2, User, Pencil, MessageCircle, FileText, FolderKanban, UserCheck, FolderOpen, Clock, Wallet, CalendarDays, Plus } from 'lucide-react';
import { formatCFA, formatDate, initials } from '../../utils/format';
import { computeMonthlyDevis } from '../../utils/stats';
import { etatDevis, ETAT_DEVIS_LABEL } from '../../utils/affaires';
import StageBadge from '../../components/StageBadge';
import EmptyState from '../../components/EmptyState';

const ONGLETS = [
  ['resume', 'Résumé'],
  ['devis', 'Devis'],
  ['contact', 'Contact'],
  ['notes', 'Notes'],
];

/**
 * Fiche client plein écran : en-tête d'identité, onglets et synthèse de
 * l'activité. Remplace l'ancienne feuille (Sheet), trop étroite pour porter
 * l'historique des devis d'un client.
 *
 * Ne calcule rien lui-même : les devis du client et son étape lui sont
 * fournis, la série mensuelle vient de utils/stats.js#computeMonthlyDevis.
 */
export default function ClientDetail({ client, devisClient, stage, apporteur, onEdit, onNouveauDevis, onSuivi }) {
  const [onglet, setOnglet] = useState('resume');

  const estEntreprise = client.clientType === 'entreprise';
  // « En cours » = ni vendu, ni perdu, ni expiré (voir utils/affaires.js).
  const devisEnCours = devisClient.filter((d) => etatDevis(d, client) === 'en-cours');
  const serie = computeMonthlyDevis(devisClient);
  const maxSerie = Math.max(1, ...serie.map((m) => m.devis));
  const telNettoye = (client.phone || '').replace(/\D/g, '');

  const stats = [
    { key: 'total', icon: FolderOpen, label: 'Devis au total', value: devisClient.length },
    { key: 'actifs', icon: Clock, label: 'Devis en cours', value: devisEnCours.length },
    { key: 'valeur', icon: Wallet, label: 'Valeur de l’affaire', value: client.estimatedValue > 0 ? formatCFA(client.estimatedValue) : '—' },
    { key: 'depuis', icon: CalendarDays, label: 'Client depuis', value: formatDate(client.createdAt) },
  ];

  const ligneContact = [client.email, client.phone, client.address].filter(Boolean);

  return (
    <>
      {/* Pas de bouton « Retour » ici : l'en-tête de page porte déjà sa flèche
          (voir PageHeader#onBack dans screens/Clients.jsx). */}
      <div className="card client-detail-head">
        <div className={`client-detail-avatar ${estEntreprise ? 'ent' : ''}`}>{initials(client.name)}</div>
        <div className="client-detail-ident">
          <div className="client-detail-name-row">
            <h2 className="client-detail-name">{client.name}</h2>
            <span className={`flat-badge ${estEntreprise ? 'info' : ''}`}>
              {estEntreprise ? <Building2 size={12} /> : <User size={12} />} {estEntreprise ? 'Entreprise' : 'Particulier'}
            </span>
            {stage && <StageBadge stage={stage} />}
          </div>
          {ligneContact.length > 0 && (
            <div className="client-detail-meta">
              {client.email && <span><Mail size={13} /> {client.email}</span>}
              {client.phone && <span><Phone size={13} /> {client.phone}</span>}
              {client.address && <span><MapPin size={13} /> {client.address}</span>}
            </div>
          )}
        </div>
        <button className="btn btn-outline btn-sm client-detail-edit" onClick={onEdit}>
          <Pencil size={15} /> Modifier
        </button>
      </div>

      <div className="categories-scroll client-detail-tabs" role="tablist" aria-label="Sections de la fiche client">
        {ONGLETS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={onglet === id}
            className={`category-chip ${onglet === id ? 'active' : ''}`}
            onClick={() => setOnglet(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {onglet === 'resume' && (
        <>
          <div className="client-stat-grid">
            {stats.map((s) => (
              <div key={s.key} className="card client-stat">
                <div className="client-stat-icon"><s.icon size={17} /></div>
                <div className="client-stat-label">{s.label}</div>
                <div className="client-stat-value">{s.value}</div>
              </div>
            ))}
          </div>

          <div className="dash-row">
            <div className="card">
              <div className="dash-card-head">
                <span className="dash-dot dot-primary" />
                <span className="card-title">Activité</span>
                <span className="dash-head-meta">6 derniers mois</span>
              </div>
              {/* Barres horizontales : un client a peu de devis, une colonne
                  par mois serait presque toujours vide et illisible. */}
              <div className="client-activity">
                {serie.map((m) => (
                  <div key={m.month} className="client-activity-row">
                    <span className="client-activity-month">{m.month}</span>
                    <span className="client-activity-track">
                      <span className="client-activity-fill" style={{ width: `${(m.devis / maxSerie) * 100}%` }} />
                    </span>
                    <span className="client-activity-val">{m.devis}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="dash-card-head">
                <span className="dash-dot dot-accent" />
                <span className="card-title">Devis récents</span>
                <button className="btn btn-sm btn-outline dash-head-action" onClick={onNouveauDevis}>
                  <Plus size={15} /> Nouveau
                </button>
              </div>
              {devisClient.length ? (
                <div className="alert-feed">
                  {devisClient.slice(0, 4).map((d) => (
                    <div key={d.id} className="alert-feed-row">
                      <div className="alert-feed-text">
                        <div className="alert-feed-title">{d.devisNumber || 'Devis'}</div>
                        <div className="alert-feed-entity">{formatDate(d.createdAt)}</div>
                      </div>
                      <span className="sheet-value amount">{formatCFA(d.total)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState>Aucun devis pour ce client.</EmptyState>
              )}
            </div>
          </div>
        </>
      )}

      {onglet === 'devis' && (
        <div className="card">
          <div className="card-title">Devis ({devisClient.length})</div>
          {devisClient.length ? (
            <div className="flat-list client-detail-devis">
              {devisClient.map((d) => {
                const etat = etatDevis(d, client);
                const bcls = { brouillon: 'muted', converti: 'success', expire: 'danger', perdu: 'muted' }[etat] || '';
                return (
                  <div key={d.id} className="flat-row">
                    <div className="flat-row-main">
                      <div className="flat-row-title">{d.devisNumber || 'Devis'}</div>
                      <div className="flat-row-sub">
                        <span className={`flat-badge ${bcls}`}>{ETAT_DEVIS_LABEL[etat]}</span>
                        <span className="flat-row-date">{formatDate(d.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flat-row-amount">{formatCFA(d.total)}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState>Aucun devis pour ce client.</EmptyState>
          )}
        </div>
      )}

      {onglet === 'contact' && (
        <div className="card">
          <div className="card-title">Coordonnées</div>
          {/* Pour un particulier, le contact EST le client déjà nommé dans
              l'en-tête : répéter son nom ici n'apprend rien. */}
          {estEntreprise && client.contact && (
            <div className="sheet-row"><span className="sheet-label"><User size={14} /> Contact</span><span className="sheet-value">{client.contact}</span></div>
          )}
          {client.phone && (
            <div className="sheet-row">
              <span className="sheet-label"><Phone size={14} /> Téléphone</span>
              <a className="sheet-value sheet-link" href={`tel:${client.phone.replace(/\s/g, '')}`}>{client.phone}</a>
            </div>
          )}
          {client.email && (
            <div className="sheet-row">
              <span className="sheet-label"><Mail size={14} /> Email</span>
              <a className="sheet-value sheet-link" href={`mailto:${client.email}`}>{client.email}</a>
            </div>
          )}
          {client.address && (
            <div className="sheet-row"><span className="sheet-label"><MapPin size={14} /> Adresse</span><span className="sheet-value">{client.address}</span></div>
          )}
          {apporteur && (
            <div className="sheet-row">
              <span className="sheet-label"><UserCheck size={14} /> Apporteur</span>
              <span className="sheet-value">{apporteur.name} <span className="partner-code-chip">{apporteur.code}</span></span>
            </div>
          )}
          <div className="client-sheet-actions">
            <button className="btn btn-primary" onClick={onNouveauDevis}><FileText size={16} /> Créer un devis</button>
            {telNettoye && (
              <a className="btn btn-whatsapp" href={`https://wa.me/${telNettoye}`} target="_blank" rel="noreferrer">
                <MessageCircle size={16} /> WhatsApp
              </a>
            )}
            <button className="btn btn-outline" onClick={onSuivi}><FolderKanban size={16} /> Suivi commercial</button>
          </div>
        </div>
      )}

      {onglet === 'notes' && (
        <div className="card">
          <div className="card-title">Notes</div>
          {client.notes
            ? <p className="text-sm text-secondary client-detail-notes">{client.notes}</p>
            : <EmptyState>Aucune note pour ce client.</EmptyState>}
          <button className="btn btn-outline btn-block" onClick={onEdit}><Pencil size={16} /> Modifier les notes</button>
        </div>
      )}
    </>
  );
}
