import { useId } from 'react';
import { TVA_PCT } from '../config/company';

/**
 * Réglage TVA unifié : un segmented à deux états nommés, un seul libellé dans
 * toute l'app. Remplace la case à cocher de 17 px et ses trois formulations.
 */
export default function TvaToggle({ value, onChange }) {
  const id = useId();
  return (
    <div className="input-group">
      <span className="input-label" id={id}>TVA</span>
      <div className="segmented" role="group" aria-labelledby={id}>
        <button type="button" className={`segmented-btn ${!value ? 'active' : ''}`} aria-pressed={!value} onClick={() => onChange(false)}>
          Exonérée
        </button>
        <button type="button" className={`segmented-btn ${value ? 'active' : ''}`} aria-pressed={!!value} onClick={() => onChange(true)}>
          TVA {TVA_PCT} %
        </button>
      </div>
      <div className="field-hint">Le solaire est exonéré de TVA par défaut au Togo.</div>
    </div>
  );
}
