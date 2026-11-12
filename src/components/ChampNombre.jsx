import { useState } from 'react';
import { nombreSaisi } from '../utils/saisieNombre';

/**
 * Champ numérique qu'on peut vider pour retaper un autre nombre.
 *
 * Le parent garde un NOMBRE ; le champ, lui, affiche ce qui est tapé. Une
 * saisie vide ou incomplète ne remonte rien : la valeur précédente reste en
 * vigueur (les totaux ne sautent pas à zéro), et le champ la réaffiche quand
 * on le quitte sans avoir tapé de nombre. Avant, la conversion à chaque frappe
 * remettait aussitôt « 1 » ou « 0 » dans le champ vidé.
 *
 * @param {number|string} value
 * @param {(n: number) => void} onChange  reçoit un nombre, jamais du texte
 * @param {number} [min] @param {number} [max] @param {boolean} [arrondi]  voir utils/saisieNombre.js
 * Les autres propriétés (className, step, aria-label…) vont à l'<input>.
 */
export default function ChampNombre({ value, onChange, min, max, arrondi = false, onBlur, ...props }) {
  const [saisie, setSaisie] = useState(null); // null = pas en cours de frappe : on affiche `value`
  return (
    <input
      type="number"
      inputMode={arrondi || props.step === '1' ? 'numeric' : 'decimal'}
      {...props}
      min={min}
      max={max}
      value={saisie ?? (value ?? '')}
      onChange={(e) => {
        setSaisie(e.target.value);
        const n = nombreSaisi(e.target.value, { min, max, arrondi });
        if (n !== null) onChange(n);
      }}
      onBlur={(e) => {
        setSaisie(null);
        onBlur?.(e);
      }}
    />
  );
}
