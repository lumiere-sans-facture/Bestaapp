import { Check } from 'lucide-react';
import { FORMULES, SUBSCRIPTION_PRICE, prixMensuelEquivalent } from '../utils/subscription';
import { formatCFA } from '../utils/format';

/**
 * Choix de la formule d'abonnement Devis Pro.
 *
 * Partagé par les DEUX écrans qui encaissent — la fiche « Passer en mode Pro »
 * (seul point d'entrée d'un non-abonné) et l'onglet « Mon abonnement » du
 * renouvellement. Une seule implémentation, donc jamais deux tarifs
 * différents affichés au même client.
 *
 * Les tarifs viennent du catalogue de `utils/subscription`, celui-là même que
 * le serveur consulte pour décider du montant qu'il exige : ce qui est
 * affiché ici est exactement ce qui sera vérifié.
 */
export default function ChoixFormule({ value, onChange }) {
  return (
    <div className="formules" role="group" aria-label="Formule d'abonnement">
      {FORMULES.map((f) => {
        const parMois = prixMensuelEquivalent(f.id);
        const remise = Math.round(100 - (parMois / SUBSCRIPTION_PRICE) * 100);
        const choisie = value === f.id;
        return (
          <button
            key={f.id}
            type="button"
            className={`formule${choisie ? ' formule-choisie' : ''}`}
            aria-pressed={choisie}
            onClick={() => onChange(f.id)}
          >
            <span className="formule-tete">
              <span className="formule-nom">{f.libelle}</span>
              {remise > 0 && <span className="formule-remise">−{remise} %</span>}
              {choisie && <Check size={15} className="formule-coche" />}
            </span>
            <span className="formule-prix">{formatCFA(f.prix)}<span className="formule-periode"> / {f.periode}</span></span>
            {/* La mensualisation est le seul chiffre qui rende deux durées
                comparables — sans elle, « 45 000 F » paraît simplement cher. */}
            {f.mois > 1 && <span className="formule-detail">soit {formatCFA(parMois)} par mois</span>}
            <span className="formule-detail">{f.jours} jours d’accès</span>
          </button>
        );
      })}
    </div>
  );
}
