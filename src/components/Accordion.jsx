import { ChevronDown } from 'lucide-react';

/**
 * Section repliable, bâtie sur `<details>/<summary>` natifs : le clavier,
 * le focus et les lecteurs d'écran sont gérés par le navigateur, sans état
 * React ni gestionnaire de touches à maintenir.
 *
 * Le compteur reste visible replié — c'est lui qui dit s'il vaut la peine
 * d'ouvrir. Une section vide affiche « 0 » plutôt que de disparaître : sinon
 * l'utilisateur croirait la fonctionnalité absente.
 *
 * @param {object} p
 * @param {import('lucide-react').LucideIcon} [p.icon]
 * @param {string} p.title      libellé de la section
 * @param {number} [p.count]    nombre d'éléments, affiché en pastille
 * @param {string} [p.resume]   information clé lisible sans ouvrir (un montant…)
 * @param {boolean} [p.defaultOpen]
 */
export default function Accordion({ icon: Icon, title, count, resume, defaultOpen = false, children }) {
  return (
    <details className="card accordion" open={defaultOpen}>
      <summary className="accordion-head">
        <span className="accordion-title">
          {Icon && <Icon size={15} className="accordion-icon" />}
          {title}
          {count !== undefined && <span className="accordion-count">{count}</span>}
        </span>
        {resume && <span className="accordion-resume">{resume}</span>}
        <ChevronDown size={18} className="accordion-chevron" aria-hidden="true" />
      </summary>
      <div className="accordion-body">{children}</div>
    </details>
  );
}
