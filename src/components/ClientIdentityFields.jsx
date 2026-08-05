import { User, Building2 } from 'lucide-react';
import Field from './Field';

/**
 * Identité d'un client, adaptée à son type — dupliquée à l'identique dans
 * les formulaires « Nouveau client » (Clients) et « Nouvelle piste »
 * (Pipeline) avant cette extraction.
 *
 * Un particulier N'A PAS de « personne de contact » distincte de lui-même :
 * lui demander les deux revenait à poser deux fois la même question. Une
 * seule ligne « Nom complet » suffit. Une entreprise, elle, a un nom propre
 * ET un interlocuteur — les deux champs restent alors nécessaires.
 *
 * Le type se choisit EN PREMIER : c'est lui qui décide du libellé affiché
 * juste en dessous, pas l'inverse.
 */
export default function ClientIdentityFields({
  idPrefix, clientType, onTypeChange, name, onNameChange, contact, onContactChange,
}) {
  const estEntreprise = clientType === 'entreprise';
  return (
    <>
      <div className="input-group">
        <span className="input-label" id={`${idPrefix}-clienttype-label`}>Type de client</span>
        <div className="client-type-toggle" role="group" aria-labelledby={`${idPrefix}-clienttype-label`}>
          <button
            type="button"
            className={`client-type-btn ${!estEntreprise ? 'active' : ''}`}
            aria-pressed={!estEntreprise}
            onClick={() => onTypeChange('particulier')}
          >
            <User size={16} /> Particulier
          </button>
          <button
            type="button"
            className={`client-type-btn ${estEntreprise ? 'active' : ''}`}
            aria-pressed={estEntreprise}
            onClick={() => onTypeChange('entreprise')}
          >
            <Building2 size={16} /> Entreprise
          </button>
        </div>
      </div>

      {estEntreprise ? (
        <>
          <Field label="Nom de l'entreprise *">
            <input className="input" required value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Ex : Hôtel du Parc" />
          </Field>
          <Field label="Personne de contact *">
            <input className="input" required value={contact} onChange={(e) => onContactChange(e.target.value)} placeholder="Ex : M. Kossi Agboka" />
          </Field>
        </>
      ) : (
        <Field label="Nom complet *">
          <input className="input" required value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Ex : Kossi Agboka" />
        </Field>
      )}
    </>
  );
}

/** Le contact d'un particulier, c'est lui-même : à appeler juste avant
 *  l'enregistrement, jamais dans l'état du formulaire (sinon il faudrait
 *  re-synchroniser à chaque frappe sur le nom). */
export const contactEffectif = (form) => (form.clientType === 'entreprise' ? form.contact : form.name);
