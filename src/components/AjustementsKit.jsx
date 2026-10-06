import { Wrench, AlertTriangle } from 'lucide-react';
import { formatCFA } from '../utils/format';

const kwc = (v) => `${(Number(v) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kWc`;
const panneaux = (n) => `${n} panneau${n > 1 ? 'x' : ''}`;

const STATUT_ONDULEUR = {
  conserve: 'conservé',
  remplace: 'remplacé',
  double: 'doublé (en parallèle)',
  'non-verifie': 'conservé — non vérifié',
  impossible: 'aucun ne convient',
};

/**
 * Section « Ajustements du kit » : ce que l'extension d'un kit ajoute au devis
 * (panneaux, chaînes, onduleur, matériel, main-d'œuvre) et ce que cela coûte.
 * Lecture seule ; le calcul vient de utils/ajustementsKit.js via le devis.
 */
export default function AjustementsKit({ ajustements, kitName }) {
  if (!ajustements?.actif) return null;
  const { panneaux: p, batterie, chaines, onduleur, materiel = [], mainOeuvre, impact, alertes = [] } = ajustements;
  const kwh = (v) => `${(Number(v) || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kWh`;
  const ancien = onduleur?.ancien;
  const nouveau = onduleur?.nouveau;

  return (
    <div className="bom ajustements-kit" aria-label="Ajustements du kit">
      <div className="bom-title"><Wrench size={12} style={{ verticalAlign: -1 }} /> Ajustements du kit</div>

      <div className="bom-row">
        <div className="bom-name">Kit de base{kitName ? ` — ${kitName}` : ''}</div>
        <div className="bom-price">{panneaux(p.base)} · {kwc(p.kwcBase)}</div>
      </div>
      <div className="bom-row">
        <div className="bom-name">
          Proposition <span className="bom-qty">({p.demande} demandés, {p.retires > 0 ? `−${p.retires} en moins` : `+${p.ajoutes} ajoutés`})</span>
        </div>
        <div className="bom-price">{panneaux(p.final)} · {kwc(p.kwcFinal)}</div>
      </div>

      {batterie?.ajoutes > 0 && (
        <div className="bom-row">
          <div className="bom-name">Batterie <span className="bom-qty">(+{kwh(batterie.ajoutes)} en modules)</span></div>
          <div className="bom-price">{kwh(batterie.base)} → {kwh(batterie.finale)}</div>
        </div>
      )}

      <div className="bom-row">
        <div className="bom-name">Chaînes solaires</div>
        <div className="bom-price ajustements-texte">
          {chaines
            ? <>{chaines.base?.libelle ? `${chaines.base.libelle} → ` : ''}{chaines.final.map((f) => f.libelle).join(' / ') || '—'}</>
            : p.ajoutes === 0 && !p.retires ? 'inchangées (aucun panneau ajouté)' : 'non vérifiées'}
        </div>
      </div>

      {onduleur && (
        <div className="bom-row">
          <div className="bom-name">
            Onduleur {STATUT_ONDULEUR[onduleur.statut] || ''}
            {onduleur.raisons?.length > 0 && onduleur.statut !== 'non-verifie' && (
              <div className="field-hint" style={{ margin: '2px 0 0' }}>Raison : {onduleur.raisons.join(' ; ')}</div>
            )}
          </div>
          <div className="bom-price ajustements-texte">
            {nouveau
              ? <>{ancien?.designation} → {onduleur.quantite > 1 ? `${onduleur.quantite} × ` : ''}{[nouveau.brand, nouveau.model].filter(Boolean).join(' ')}</>
              : ancien?.designation}
          </div>
        </div>
      )}

      {materiel.length > 0 && (
        <>
          <div className="bom-title">Matériel ajouté (câbles, connecteurs, protections)</div>
          {materiel.map((m, i) => (
            <div key={i} className="bom-row">
              <div className="bom-name">
                {m.designation.replace(/ — extension$/, '')} <span className="bom-qty">× {m.qty}{m.unit === 'm' ? ' m' : ''}</span>
                {m.motif && <div className="field-hint" style={{ margin: '2px 0 0' }}>{m.motif}</div>}
              </div>
              <div className="bom-price">{formatCFA(m.qty * m.pu)}</div>
            </div>
          ))}
        </>
      )}

      {mainOeuvre && (
        <>
          <div className="bom-title">Main-d’œuvre</div>
          <div className="bom-row"><div className="bom-name">Main-d’œuvre initiale du kit</div><div className="bom-price">{formatCFA(mainOeuvre.base)}</div></div>
          {mainOeuvre.panneaux.montant !== 0 && <div className="bom-row">
            <div className="bom-name">
              {mainOeuvre.panneaux.montant > 0 ? 'Supplément panneaux' : 'Panneaux en moins'}{' '}
              <span className="bom-qty">({Math.abs(mainOeuvre.panneaux.nombre)} × {formatCFA(mainOeuvre.panneaux.tarif)})</span>
            </div>
            <div className="bom-price">{formatCFA(mainOeuvre.panneaux.montant)}</div>
          </div>}
          {mainOeuvre.batterie.montant > 0 && <div className="bom-row">
            <div className="bom-name">Supplément batterie <span className="bom-qty">({kwh(mainOeuvre.batterie.kwh)} × {formatCFA(mainOeuvre.batterie.tarif)})</span></div>
            <div className="bom-price">{formatCFA(mainOeuvre.batterie.montant)}</div>
          </div>}
          {mainOeuvre.coef > 1 && (
            <div className="bom-row"><div className="bom-name">Chantier au Togo <span className="bom-qty">(× {mainOeuvre.coef})</span></div><div className="bom-price">{formatCFA(mainOeuvre.totalFinal - mainOeuvre.total)}</div></div>
          )}
          <div className="bom-row ajustements-total"><div className="bom-name">Main-d’œuvre finale</div><div className="bom-price">{formatCFA(mainOeuvre.totalFinal ?? mainOeuvre.total)}</div></div>
        </>
      )}

      {impact && (
        <>
          <div className="bom-title">Impact sur le prix</div>
          {impact.postes.map((p, i) => (
            <div key={i} className="bom-row"><div className="bom-name">{p.libelle}</div><div className="bom-price">{p.montant > 0 ? '+' : ''}{formatCFA(p.montant)}</div></div>
          ))}
          <div className="bom-row ajustements-total">
            <div className="bom-name">Kit de base {formatCFA(impact.totalBase)} → proposition</div>
            <div className="bom-price">{formatCFA(impact.total)} <span className="bom-qty">({impact.ecart >= 0 ? '+' : '−'}{formatCFA(Math.abs(impact.ecart))})</span></div>
          </div>
        </>
      )}

      {alertes.map((a, i) => (
        <div key={i} className="field-hint ajustements-alerte" role="status">
          <AlertTriangle size={13} style={{ verticalAlign: -2 }} /> {a}
        </div>
      ))}
    </div>
  );
}
