import { useId } from 'react';
import { TVA_RATE } from '../config/company';
import { tvaPct } from '../data/pays';

/**
 * Réglage TVA unifié : un segmented à deux états nommés, un seul libellé dans
 * toute l'app. Remplace la case à cocher de 17 px et ses trois formulations.
 */
export default function TvaToggle({ value, onChange, taux = TVA_RATE, indication = 'Le solaire est exonéré de TVA par défaut au Togo.' }) {
  const id = useId();
  return (
    <div className="input-group">
      <span className="input-label" id={id}>TVA</span>
      <div className="segmented" role="group" aria-labelledby={id}>
        <button type="button" className={`segmented-btn ${!value ? 'active' : ''}`} aria-pressed={!value} onClick={() => onChange(false)}>
          Exonérée
        </button>
        <button type="button" className={`segmented-btn ${value ? 'active' : ''}`} aria-pressed={!!value} onClick={() => onChange(true)}>
          TVA {tvaPct(taux)} %
        </button>
      </div>
      {indication && <div className="field-hint">{indication}</div>}
    </div>
  );
}
