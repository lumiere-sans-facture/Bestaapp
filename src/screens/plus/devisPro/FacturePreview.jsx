import { formatCFA } from '../../../utils/format';
import { normalizeModele } from './constants';

const SAMPLE = [
  { d: 'Panneau 550W monocristallin', q: 6, pu: 95000 },
  { d: 'Onduleur hybride 5 kVA', q: 1, pu: 320000 },
  { d: 'Batterie lithium 5 kWh', q: 2, pu: 480000 },
];

/**
 * Aperçu HTML en direct d'une facture, reflétant le modèle (couleur / sobre),
 * les couleurs, le logo et les coordonnées de l'entreprise. Purement visuel :
 * données d'exemple, pas de génération PDF.
 */
export default function FacturePreview({ company = {}, modele }) {
  // « Classique » est le modèle noir et blanc ; Studio et Vague sont colorés.
  const bw = normalizeModele(modele || company.modeleDefaut) === 'classique';
  const primary = bw ? '#212529' : (company.couleurPrimaire || '#0a2472');
  const secondary = bw ? '#5a606a' : (company.couleurSecondaire || '#f5a623');
  const name = company.nomEntreprise || 'Mon Entreprise';
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const coord = [company.telephone, company.email, company.adresse].filter(Boolean).join('  ·  ') || 'Téléphone · Email · Adresse';
  const totalHT = SAMPLE.reduce((s, l) => s + l.pu * l.q, 0);

  const logo = company.logo
    ? <img src={company.logo} alt="" className="fp-logo" />
    : <span className="fp-logo fp-logo-initials" style={{ background: bw ? primary : secondary }}>{initials}</span>;

  return (
    <div className="fp-sheet" aria-label="Aperçu de la facture">
      {/* En-tête */}
      {bw ? (
        <div className="fp-head-sobre" style={{ borderColor: primary }}>
          <div className="fp-head-left">
            {logo}
            <div>
              <div className="fp-name" style={{ color: '#1a1a2e' }}>{name}</div>
              <div className="fp-slogan">{company.slogan || 'Votre slogan'}</div>
            </div>
          </div>
          <div className="fp-title" style={{ color: '#1a1a2e' }}>FACTURE</div>
        </div>
      ) : (
        <div className="fp-band" style={{ background: primary }}>
          <div className="fp-head-left">
            {logo}
            <div>
              <div className="fp-name">{name}</div>
              <div className="fp-slogan">{company.slogan || 'Votre slogan'}</div>
            </div>
          </div>
          <div className="fp-title" style={{ color: secondary }}>FACTURE</div>
        </div>
      )}
      <div className="fp-coord">{coord}</div>

      {/* Client + méta */}
      <div className="fp-row-between">
        <div>
          <div className="fp-label">FACTURÉ À</div>
          <div className="fp-client">Client exemple</div>
          <div className="fp-muted">Cotonou</div>
        </div>
        <div className="fp-meta">
          <div><span className="fp-muted">Numéro</span> <strong>FAC-2026-001</strong></div>
          <div><span className="fp-muted">Statut</span> <strong>Émise</strong></div>
        </div>
      </div>

      {/* Tableau */}
      <div className="fp-table">
        <div className="fp-thead" style={{ background: primary }}>
          <span className="fp-c-des">Désignation</span><span className="fp-c-qte">Qté</span><span className="fp-c-mnt">Montant</span>
        </div>
        {SAMPLE.map((l, i) => (
          <div key={i} className="fp-trow" style={!bw && i % 2 ? { background: '#f8f9fc' } : undefined}>
            <span className="fp-c-des">{l.d}</span>
            <span className="fp-c-qte">{l.q}</span>
            <span className="fp-c-mnt">{formatCFA(l.pu * l.q)}</span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="fp-total" style={{ background: primary }}>
        <span>TOTAL À PAYER</span><span>{formatCFA(totalHT)}</span>
      </div>

      <div className="fp-footer">Merci de votre confiance</div>
      <div className="fp-bar" style={{ background: secondary }} />
    </div>
  );
}
