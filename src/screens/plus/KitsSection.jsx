import { useState } from 'react';
import { ChevronLeft, Plus, Pencil, Copy, Trash2, Check, Package, RotateCcw, Wrench } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { SOLAR_KITS } from '../../data/kits';
import { formatCFA } from '../../utils/format';
import { nouveauKit, nouvelleLigneKit, kitTotal, kitEstValide, resumeKit, UNITES_KIT } from '../../utils/kits';
import Sheet from '../../components/Sheet';
import ConfirmSheet from '../../components/ConfirmSheet';
import Field from '../../components/Field';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../components/Toast';

/**
 * « Mes kits » — les compositions solaires que propose l'assistant de devis.
 * Elles étaient figées dans le code : les modifier demandait une mise à jour de
 * l'application. Elles vivent maintenant dans les données de l'entreprise, qui
 * en garde la main — prix, matériel, intitulés.
 */
export default function KitsSection({ onBack }) {
  const { kits, addKit, updateKit, deleteKit, duplicateKit, restoreKits } = useData();
  const [edition, setEdition] = useState(null); // { kit, estNouveau }
  const [aSupprimer, setASupprimer] = useState(null);
  const toast = useToast();

  const liste = kits || [];
  const manquants = SOLAR_KITS.filter((o) => !liste.some((k) => k.id === o.id));

  const ouvrirNouveau = () => setEdition({ kit: nouveauKit(), estNouveau: true });
  const ouvrirEdition = (kit) => setEdition({ kit: { ...kit, lines: (kit.lines || []).map((l) => ({ ...l })) }, estNouveau: false });

  const majKit = (patch) => setEdition((e) => ({ ...e, kit: { ...e.kit, ...patch } }));
  const majLigne = (i, patch) =>
    setEdition((e) => ({ ...e, kit: { ...e.kit, lines: e.kit.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) } }));
  const ajouterLigne = () =>
    setEdition((e) => ({ ...e, kit: { ...e.kit, lines: [...e.kit.lines, nouvelleLigneKit()] } }));
  const retirerLigne = (i) =>
    setEdition((e) => ({ ...e, kit: { ...e.kit, lines: e.kit.lines.filter((_, j) => j !== i) } }));

  const enregistrer = (e) => {
    e.preventDefault();
    const { kit, estNouveau } = edition;
    if (!kitEstValide(kit)) {
      toast('Il faut un nom et au moins une ligne chiffrée.', { type: 'error' });
      return;
    }
    if (estNouveau) addKit(kit); else updateKit(kit.id, kit);
    setEdition(null);
    toast(estNouveau ? 'Kit ajouté.' : 'Kit enregistré.');
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
      <div className="section-title">Mes kits ({liste.length})</div>
      <p className="text-sm text-secondary" style={{ marginBottom: 12 }}>
        Ce sont ces kits — et eux seuls — que propose l'assistant de devis solaire.
        Modifier un prix ici change immédiatement les devis à venir.
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
            onClick={() => { restoreKits(SOLAR_KITS); toast('Kits d’origine remis.'); }}>
            <RotateCcw size={14} /> Remettre les kits d'origine
          </button>
        </div>
      )}

      {liste.length === 0 && (
        <EmptyState card>
          Aucun kit. Sans kit, l'assistant de devis solaire ne peut rien chiffrer —
          créez-en un ou remettez les kits d'origine.
        </EmptyState>
      )}

      <div className="kits-list">
        {liste.map((kit) => (
          <div key={kit.id} className="card kit-card">
            <div className="kit-card-head">
              <div className="kit-card-ident">
                <div className="kit-card-name"><Package size={15} /> {kit.name}</div>
                <div className="kit-card-meta">{resumeKit(kit) || 'Caractéristiques à renseigner'}</div>
              </div>
              <div className="kit-card-price">{formatCFA(kitTotal(kit))}</div>
            </div>
            <div className="kit-card-foot">
              <span className="kit-card-lines">
                {(kit.lines || []).length} ligne{(kit.lines || []).length > 1 ? 's' : ''}
                {(kit.lines || []).some((l) => l.labor) && <> · <Wrench size={11} /> main d'œuvre incluse</>}
              </span>
              <div className="kit-card-actions">
                <button className="btn btn-sm btn-outline" onClick={() => ouvrirEdition(kit)}>
                  <Pencil size={14} /> Modifier
                </button>
                <button className="btn btn-sm btn-outline" onClick={() => duplicateKit(kit.id)} aria-label={`Dupliquer ${kit.name}`}>
                  <Copy size={14} />
                </button>
                <button className="btn btn-sm btn-lost" onClick={() => setASupprimer(kit)} aria-label={`Supprimer ${kit.name}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Composition d'un kit */}
      <Sheet
        open={!!edition}
        onClose={() => setEdition(null)}
        title={edition?.estNouveau ? 'Nouveau kit' : 'Modifier le kit'}
        subtitle={edition ? formatCFA(kitTotal(edition.kit)) : undefined}
      >
        {edition && (
          <form onSubmit={enregistrer}>
            <Field label="Nom du kit *">
              <input className="input" required value={edition.kit.name}
                onChange={(e) => majKit({ name: e.target.value })} placeholder="Ex : Kit 5 kWh" />
            </Field>
            {/* Caractéristiques techniques : elles servent à SUGGÉRER le kit
                selon la consommation du client, et alimentent le devis. */}
            <div className="form-row-2">
              <Field label="Batterie (kWh)">
                <input className="input" type="number" min="0" step="0.5" value={edition.kit.battery}
                  onChange={(e) => majKit({ battery: e.target.value })} />
              </Field>
              <Field label="Onduleur (kVA)">
                <input className="input" type="number" min="0" step="0.5" value={edition.kit.inverter}
                  onChange={(e) => majKit({ inverter: e.target.value })} />
              </Field>
              <Field label="Nombre de panneaux">
                <input className="input" type="number" min="0" value={edition.kit.panels}
                  onChange={(e) => majKit({ panels: e.target.value })} />
              </Field>
              <Field label="Puissance par panneau (Wc)">
                <input className="input" type="number" min="0" value={edition.kit.panelW}
                  onChange={(e) => majKit({ panelW: e.target.value })} />
              </Field>
            </div>
            <div className="field-hint" style={{ marginBottom: 14 }}>
              La capacité batterie sert à proposer automatiquement le bon kit selon
              la consommation calculée du client.
            </div>

            <div className="sheet-section-title">Composition</div>
            {edition.kit.lines.map((l, i) => (
              <div key={i} className="doc-line">
                <div className="doc-line-designation">
                  <input className="input" placeholder="Désignation" aria-label="Désignation"
                    value={l.designation} onChange={(e) => majLigne(i, { designation: e.target.value })} />
                </div>
                {edition.kit.lines.length > 1 && (
                  <button type="button" className="cart-row-remove doc-line-remove"
                    aria-label="Supprimer la ligne" onClick={() => retirerLigne(i)}>
                    <Trash2 size={14} />
                  </button>
                )}
                <div className="doc-line-fields">
                  <label className="doc-line-field">
                    Quantité
                    <input className="input" type="number" min="1" value={l.qty}
                      onChange={(e) => majLigne(i, { qty: e.target.value })} />
                  </label>
                  <label className="doc-line-field">
                    Unité
                    <select className="input" value={l.unit} onChange={(e) => majLigne(i, { unit: e.target.value })}>
                      {UNITES_KIT.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </label>
                  <label className="doc-line-field is-wide">
                    Prix unitaire (F CFA)
                    <input className="input" type="number" min="0" value={l.pu}
                      onChange={(e) => majLigne(i, { pu: e.target.value })} />
                  </label>
                </div>
                {/* Le devis sépare équipements et prestations : c'est cette
                    case qui range la ligne du bon côté. */}
                <label className="kit-line-labor">
                  <input type="checkbox" checked={!!l.labor}
                    onChange={(e) => majLigne(i, { labor: e.target.checked })} />
                  <span>Prestation (main d'œuvre), pas du matériel</span>
                </label>
                {Number(l.pu) > 0 && (
                  <div className="doc-line-subtotal">
                    Sous-total : {formatCFA(Math.max(1, Number(l.qty) || 1) * Number(l.pu))}
                  </div>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-sm btn-outline facture-add-ligne" onClick={ajouterLigne}>
              <Plus size={14} /> Ajouter une ligne
            </button>

            <div className="kit-form-total">
              <span>Total du kit</span>
              <strong>{formatCFA(kitTotal(edition.kit))}</strong>
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
        onConfirm={() => { deleteKit(aSupprimer.id); toast('Kit supprimé.'); }}
        title="Supprimer le kit"
        message={aSupprimer
          ? `Supprimer « ${aSupprimer.name} » ? Il ne sera plus proposé dans l'assistant de devis. Les devis déjà émis ne changent pas.`
          : ''}
        confirmLabel="Supprimer"
        danger
      />
    </>
  );
}
