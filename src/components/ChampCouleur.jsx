import { useEffect, useState } from 'react';
import { normaliserCodeCouleur } from '../utils/couleurDocument';

/**
 * Couleur choisie au nuancier OU tapée en code (« #E30613 », « E30613 »,
 * « #E31 », « rgb(227, 6, 19) ») : le code s'applique dès qu'il est complet.
 * Un code incomplet n'efface rien ; quitté tel quel, le champ reprend la
 * couleur en place et le dit.
 * @param {object} p
 * @param {string} p.valeur      couleur actuelle, `#rrggbb`
 * @param {(hex: string) => void} p.onChange
 * @param {string} p.libelle     nom de la couleur (lecteurs d'écran)
 * @param {string} [p.id]        posé par <Field> : le libellé vise le code
 */
export default function ChampCouleur({ valeur, onChange, libelle, id }) {
  const [saisie, setSaisie] = useState((valeur || '').toUpperCase());
  const [invalide, setInvalide] = useState(false);

  // Couleur changée ailleurs (nuancier, détection depuis le logo, « Annuler »).
  useEffect(() => {
    if (normaliserCodeCouleur(saisie) !== valeur) setSaisie((valeur || '').toUpperCase());
  }, [valeur]); // eslint-disable-line react-hooks/exhaustive-deps

  const taper = (texte) => {
    setSaisie(texte);
    const hex = normaliserCodeCouleur(texte);
    if (hex) { setInvalide(false); if (hex !== valeur) onChange(hex); }
  };
  const quitter = () => {
    if (normaliserCodeCouleur(saisie)) { setSaisie(normaliserCodeCouleur(saisie).toUpperCase()); return; }
    setInvalide(true);
    setSaisie((valeur || '').toUpperCase());
  };

  return (
    <>
      <div className="color-input-row">
        <input className="input pro-color-input" type="color" value={valeur} onChange={(e) => { setInvalide(false); onChange(e.target.value); }}
          aria-label={`${libelle} — nuancier`} />
        <input id={id} className="input color-code-input" type="text" value={saisie} onChange={(e) => taper(e.target.value)} onBlur={quitter}
          placeholder="#1B3A8F" maxLength={20} spellCheck={false} autoCapitalize="characters" autoComplete="off"
          aria-label={`${libelle} — code couleur`} aria-invalid={invalide || undefined} />
      </div>
      {invalide && <div className="field-error">Code non reconnu : tapez 6 caractères (0-9, A-F), par exemple #E30613.</div>}
    </>
  );
}
