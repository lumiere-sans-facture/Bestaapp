import { useState } from 'react';
import { ChevronLeft, Plus, Pencil, Copy, Trash2, Check, Droplets, RotateCcw } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { POMPE_KITS } from '../../data/pompeKits';
import { formatCFA } from '../../utils/format';
import { nouveauPompeKit, pompeKitEstValide, resumePompeKit } from '../../utils/pompeKitEdition';
import Sheet from '../../components/Sheet';
import ConfirmSheet from '../../components/ConfirmSheet';
import Field from '../../components/Field';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../components/Toast';

/**
 * « Kits pompage » — les kits que l'assistant Pompe solaire peut suggérer.
 * La HMT max et le débit max sont les deux données qui rendent la suggestion
 * possible : l'assistant choisit le kit le MOINS CHER qui couvre les deux.
 */
export default function PompeKitsSection({ onBack }) {
  const { pompeKits, addPompeKit, updatePompeKit, deletePompeKit, duplicatePompeKit, restorePompeKits } = useData();
  const [edition, setEdition] = useState(null); // { kit, estNouveau }
  const [aSupprimer, setASupprimer] = useState(null);
  const toast = useToast();

  const liste = pompeKits || [];
  const manquants = POMPE_KITS.filter((k) => !liste.some((x) => x.id === k.id));

  const ouvrirNouveau = () => setEdition({ kit: nouveauPompeKit(), estNouveau: true });
  const ouvrirEdition = (kit) => setEdition({ kit: { ...kit }, estNouveau: false });
  const majKit = (patch) => setEdition((e) => ({ ...e, kit: { ...e.kit, ...patch } }));

  const enregistrer = (e) => {
    e.preventDefault();
    const { kit, estNouveau } = edition;
    if (!pompeKitEstValide(kit)) {
      toast('Il faut un nom, un prix, une HMT max et un débit max.', { type: 'error' });
      return;
    }
    if (estNouveau) addPompeKit(kit); else updatePompeKit(kit.id, kit);
    setEdition(null);
    toast(estNouveau ? 'Kit pompage ajouté.' : 'Kit pompage enregistré.');
  };

  return (
    <>
      <div className="partners-toolbar">
        <button className="btn btn-outline btn-sm back-button back-to-plus" onClick={onBack}>
          <ChevronLeft size={16} /> Retour
        </button>
        <button className="btn btn-accent btn-sm" onClick={ouvrirNouveau}>
          <Plus size={16} /> Nouveau kit
        </button>
      </div>
      <div className="section-title">Kits pompage ({liste.length})</div>
      <p className="text-sm text-secondary" style={{ marginBottom: 12 }}>
        L'assistant « Pompe solaire » suggère le kit le moins cher qui couvre à la
        fois la HMT (profondeur + réservoir) et le débit requis par le besoin en
        eau du client — jamais un kit sous-dimensionné.
      </p>

      {/* Rattrapage : ne réapparaît que si un kit d'origine a été supprimé. */}
      {manquants.length > 0 && (
        <div className="callout" role="note">
          <div className="callout-title">
            <RotateCcw size={13} /> {manquants.length} kit{manquants.length > 1 ? 's' : ''} d'origine absent{manquants.length > 1 ? 's' : ''}
          </div>
          <div className="text-sm text-secondary">
            {manquants.map((k) => k.name).join(', ')} — les remettre n'écrase aucun kit existant.
          </div>
          <button className="btn btn-sm btn-outline" style={{ marginTop: 10 }}
            onClick={() => { restorePompeKits(POMPE_KITS); toast('Kits d’origine remis.'); }}>
            <RotateCcw size={14} /> Remettre les kits d'origine
          </button>
        </div>
      )}

      {liste.length === 0 && (
        <EmptyState card>
          Aucun kit pompage configuré. Sans HMT max et débit max renseignés,
          l'assistant Pompe solaire ne peut rien suggérer — créez un kit ou
          remettez les kits d'origine.
        </EmptyState>
      )}

      <div className="kits-list">
        {liste.map((k) => (
          <div key={k.id} className="card kit-card">
            <div className="kit-card-head">
              <div className="kit-card-ident">
                <div className="kit-card-name"><Droplets size={15} /> {k.name}</div>
                <div className="kit-card-meta">{resumePompeKit(k) || 'Caractéristiques à renseigner'}</div>
              </div>
              <div className="kit-card-price">{formatCFA(k.price)}</div>
            </div>
            <div className="kit-card-foot">
              <span className="kit-card-lines">{k.usage || 'Usage à préciser'}</span>
              <div className="kit-card-actions">
                <button className="btn btn-sm btn-outline" onClick={() => ouvrirEdition(k)}>
                  <Pencil size={14} /> Modifier
                </button>
                <button className="btn btn-sm btn-outline" onClick={() => duplicatePompeKit(k.id)} aria-label={`Dupliquer ${k.name}`}>
                  <Copy size={14} />
                </button>
                <button className="btn btn-sm btn-lost" onClick={() => setASupprimer(k)} aria-label={`Supprimer ${k.name}`}>
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
        title={edition?.estNouveau ? 'Nouveau kit pompage' : 'Modifier le kit pompage'}
        subtitle={edition ? formatCFA(edition.kit.price) : undefined}
      >
        {edition && (
          <form onSubmit={enregistrer}>
            <Field label="Nom du kit *">
              <input className="input" required value={edition.kit.name}
                onChange={(e) => majKit({ name: e.target.value })} placeholder="Ex : Kit pompage 1 HP (750 W)" />
            </Field>
            <div className="form-row-2">
              <Field label="Puissance pompe (HP)">
                <input className="input" type="number" min="0" step="0.5" value={edition.kit.hp}
                  onChange={(e) => majKit({ hp: e.target.value })} placeholder="Ex : 1" />
              </Field>
              <Field label="Puissance (W)">
                <input className="input" type="number" min="0" value={edition.kit.powerW}
                  onChange={(e) => majKit({ powerW: e.target.value })} placeholder="Ex : 750" />
              </Field>
              <Field label="HMT max (m) *">
                <input className="input" type="number" min="0" required value={edition.kit.maxHmt}
                  onChange={(e) => majKit({ maxHmt: e.target.value })} placeholder="Ex : 60" />
              </Field>
              <Field label="Débit max (m³/h) *">
                <input className="input" type="number" min="0" step="0.1" required value={edition.kit.maxDebit}
                  onChange={(e) => majKit({ maxDebit: e.target.value })} placeholder="Ex : 3" />
              </Field>
              <Field label="Nombre de panneaux">
                <input className="input" type="number" min="0" value={edition.kit.panels}
                  onChange={(e) => majKit({ panels: e.target.value })} />
              </Field>
              <Field label="Puissance panneau (Wc)">
                <input className="input" type="number" min="0" value={edition.kit.panelW}
                  onChange={(e) => majKit({ panelW: e.target.value })} />
              </Field>
            </div>
            <Field label="Prix (F CFA) *">
              <input className="input" type="number" min="0" required value={edition.kit.price}
                onChange={(e) => majKit({ price: e.target.value })} />
            </Field>
            <Field label="Usage conseillé">
              <input className="input" value={edition.kit.usage}
                onChange={(e) => majKit({ usage: e.target.value })} placeholder="Ex : Forage domestique, château d'eau familial" />
            </Field>
            <div className="field-hint" style={{ marginBottom: 14 }}>
              La HMT max et le débit max se lisent sur la fiche technique de la
              pompe (courbe débit/hauteur). C'est sur ces deux valeurs que
              l'assistant décide si le kit couvre le besoin du client.
            </div>

            <button type="submit" className="btn btn-primary btn-block">
              <Check size={18} /> {edition.estNouveau ? 'Ajouter le kit' : 'Enregistrer'}
            </button>
          </form>
        )}
      </Sheet>

      <ConfirmSheet
        open={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        onConfirm={() => { deletePompeKit(aSupprimer.id); toast('Kit pompage supprimé.'); }}
        title="Supprimer le kit pompage"
        message={aSupprimer
          ? `Supprimer « ${aSupprimer.name} » ? Il ne sera plus suggéré par l'assistant Pompe solaire. Les devis déjà émis ne changent pas.`
          : ''}
        confirmLabel="Supprimer"
        danger
      />
    </>
  );
}
