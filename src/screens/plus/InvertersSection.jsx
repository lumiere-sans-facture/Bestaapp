import { useState } from 'react';
import { ChevronLeft, Plus, Pencil, Copy, Trash2, Check, Cpu, RotateCcw } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { INVERTER_MODELS } from '../../data/inverters';
import { formatCFA } from '../../utils/format';
import { nouvelOnduleur, onduleurEstValide, resumeOnduleur } from '../../utils/inverters';
import Sheet from '../../components/Sheet';
import ConfirmSheet from '../../components/ConfirmSheet';
import Field from '../../components/Field';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../components/Toast';

/**
 * « Onduleurs » — les modèles que l'assistant de devis peut proposer à la
 * place de celui prévu dans un kit, quand ce dernier ne prend pas assez de
 * panneaux pour le besoin calculé (puissance PV max insuffisante). La
 * puissance PV max est la donnée qui rend cette suggestion possible — sans
 * elle un onduleur ne peut jamais être suggéré.
 */
export default function InvertersSection({ onBack }) {
  const { inverters, addInverter, updateInverter, deleteInverter, duplicateInverter, restoreInverters } = useData();
  const [edition, setEdition] = useState(null); // { onduleur, estNouveau }
  const [aSupprimer, setASupprimer] = useState(null);
  const toast = useToast();

  const liste = inverters || [];
  const manquants = INVERTER_MODELS.filter((o) => !liste.some((i) => i.id === o.id));

  const ouvrirNouveau = () => setEdition({ onduleur: nouvelOnduleur(), estNouveau: true });
  const ouvrirEdition = (onduleur) => setEdition({ onduleur: { ...onduleur }, estNouveau: false });
  const majOnduleur = (patch) => setEdition((e) => ({ ...e, onduleur: { ...e.onduleur, ...patch } }));

  const enregistrer = (e) => {
    e.preventDefault();
    const { onduleur, estNouveau } = edition;
    if (!onduleurEstValide(onduleur)) {
      toast('Il faut un modèle, une capacité, un prix et une puissance PV max.', { type: 'error' });
      return;
    }
    if (estNouveau) addInverter(onduleur); else updateInverter(onduleur.id, onduleur);
    setEdition(null);
    toast(estNouveau ? 'Onduleur ajouté.' : 'Onduleur enregistré.');
  };

  return (
    <>
      <div className="partners-toolbar">
        <button className="btn btn-outline btn-sm back-button back-to-plus" onClick={onBack}>
          <ChevronLeft size={16} /> Retour
        </button>
        <button className="btn btn-accent btn-sm" onClick={ouvrirNouveau}>
          <Plus size={16} /> Nouvel onduleur
        </button>
      </div>
      <div className="section-title">Onduleurs ({liste.length})</div>
      <p className="text-sm text-secondary" style={{ marginBottom: 12 }}>
        Si l'onduleur prévu dans un kit ne prend pas assez de panneaux pour le
        besoin calculé du client, l'assistant de devis le remplace automatiquement
        par le plus petit onduleur ci-dessous qui convient — jamais un plus faible.
      </p>

      {/* Rattrapage : ne réapparaît que si un onduleur d'origine a été supprimé. */}
      {manquants.length > 0 && (
        <div className="callout" role="note">
          <div className="callout-title">
            <RotateCcw size={13} /> {manquants.length} onduleur{manquants.length > 1 ? 's' : ''} d'origine absent{manquants.length > 1 ? 's' : ''}
          </div>
          <div className="text-sm text-secondary">
            {manquants.map((o) => o.model).join(', ')} — les remettre n'écrase aucun onduleur existant.
          </div>
          <button className="btn btn-sm btn-outline" style={{ marginTop: 10 }}
            onClick={() => { restoreInverters(INVERTER_MODELS); toast('Onduleurs d’origine remis.'); }}>
            <RotateCcw size={14} /> Remettre les onduleurs d'origine
          </button>
        </div>
      )}

      {liste.length === 0 && (
        <EmptyState card>
          Aucun onduleur configuré. Sans puissance PV max renseignée, l'assistant
          ne peut jamais suggérer d'alternative à celui d'un kit — créez-en un ou
          remettez les onduleurs d'origine.
        </EmptyState>
      )}

      <div className="kits-list">
        {liste.map((o) => (
          <div key={o.id} className="card kit-card">
            <div className="kit-card-head">
              <div className="kit-card-ident">
                <div className="kit-card-name"><Cpu size={15} /> {o.brand ? `${o.brand} ${o.model}` : o.model}</div>
                <div className="kit-card-meta">{resumeOnduleur(o) || 'Caractéristiques à renseigner'}</div>
              </div>
              <div className="kit-card-price">{formatCFA(o.price)}</div>
            </div>
            <div className="kit-card-foot">
              <span className="kit-card-lines">Puissance PV max {o.maxPvPower ? `${o.maxPvPower} Wc` : '— à renseigner'}</span>
              <div className="kit-card-actions">
                <button className="btn btn-sm btn-outline" onClick={() => ouvrirEdition(o)}>
                  <Pencil size={14} /> Modifier
                </button>
                <button className="btn btn-sm btn-outline" onClick={() => duplicateInverter(o.id)} aria-label={`Dupliquer ${o.model}`}>
                  <Copy size={14} />
                </button>
                <button className="btn btn-sm btn-lost" onClick={() => setASupprimer(o)} aria-label={`Supprimer ${o.model}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Sheet
        open={!!edition}
        onClose={() => setEdition(null)}
        title={edition?.estNouveau ? 'Nouvel onduleur' : 'Modifier l’onduleur'}
        subtitle={edition ? formatCFA(edition.onduleur.price) : undefined}
      >
        {edition && (
          <form onSubmit={enregistrer}>
            <div className="form-row-2">
              <Field label="Marque">
                <input className="input" value={edition.onduleur.brand}
                  onChange={(e) => majOnduleur({ brand: e.target.value })} placeholder="Ex : Growatt" />
              </Field>
              <Field label="Modèle *">
                <input className="input" required value={edition.onduleur.model}
                  onChange={(e) => majOnduleur({ model: e.target.value })} placeholder="Ex : SPF 5000TL" />
              </Field>
              <Field label="Capacité (kVA) *">
                <input className="input" type="number" min="0" step="0.5" required value={edition.onduleur.capacity}
                  onChange={(e) => majOnduleur({ capacity: e.target.value })} />
              </Field>
              <Field label="Rendement (%)">
                <input className="input" type="number" min="0" max="100" value={edition.onduleur.efficiency}
                  onChange={(e) => majOnduleur({ efficiency: e.target.value })} />
              </Field>
              <Field label="Puissance PV max (Wc) *">
                <input className="input" type="number" min="0" required value={edition.onduleur.maxPvPower}
                  onChange={(e) => majOnduleur({ maxPvPower: e.target.value })} />
              </Field>
              <Field label="Prix (F CFA) *">
                <input className="input" type="number" min="0" required value={edition.onduleur.price}
                  onChange={(e) => majOnduleur({ price: e.target.value })} />
              </Field>
            </div>
            <div className="field-hint" style={{ marginBottom: 14 }}>
              La puissance PV max (« Max. PV Input Power » sur la fiche technique du
              fabricant) est ce qui permet à l'assistant de vérifier qu'un onduleur
              encaisse les panneaux calculés — pas sa capacité kVA, qui est la
              puissance de SORTIE.
            </div>

            <button type="submit" className="btn btn-primary btn-block">
              <Check size={18} /> {edition.estNouveau ? 'Ajouter l’onduleur' : 'Enregistrer'}
            </button>
          </form>
        )}
      </Sheet>

      <ConfirmSheet
        open={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        onConfirm={() => { deleteInverter(aSupprimer.id); toast('Onduleur supprimé.'); }}
        title="Supprimer l’onduleur"
        message={aSupprimer
          ? `Supprimer « ${aSupprimer.model} » ? Il ne sera plus proposé en alternative dans l'assistant de devis. Les devis déjà émis ne changent pas.`
          : ''}
        confirmLabel="Supprimer"
        danger
      />
    </>
  );
}
