import { Children, cloneElement, isValidElement, useId } from 'react';

/**
 * Champ de formulaire accessible : associe le libellé au contrôle via
 * `htmlFor`/`id` (cliquer le libellé met le focus sur le champ, et les lecteurs
 * d'écran annoncent le libellé). Le premier enfant est le contrôle (input,
 * select, textarea…) ; il est cloné pour recevoir l'`id` — ses props ne sont
 * jamais modifiées. Les enfants suivants (indices, hints) sont rendus tels quels.
 *
 *   <Field label="Nom du produit *">
 *     <input className="input" required value={…} onChange={…} />
 *   </Field>
 */
export default function Field({ label, htmlFor, className, children }) {
  const autoId = useId();
  const id = htmlFor || autoId;
  const [control, ...rest] = Children.toArray(children);
  return (
    <div className={className ? `input-group ${className}` : 'input-group'}>

      {label && (
        <label className="input-label" htmlFor={id}>{label}</label>
      )}
      {isValidElement(control)
        ? cloneElement(control, { id: control.props.id ?? id })
        : control}
      {rest}
    </div>
  );
}
