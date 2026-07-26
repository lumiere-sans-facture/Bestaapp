import { useState } from 'react';
import { Plus, Trash2, Sun, Moon, Zap, Gauge, Rocket } from 'lucide-react';
import {
  applianceCategories, getApplianceById, CUSTOM_APPLIANCE_ID, newCustomAppliance,
} from '../../data/appliances';
import { bilanConsommation, fmt } from '../../utils/dimensionnementV2';

let rowSeq = 0;

/** Ligne de charge neuve à partir du catalogue ou d'un appareil personnalisé. */
export const nouvelleLigne = (applianceId) => {
  const tpl = applianceId === CUSTOM_APPLIANCE_ID ? newCustomAppliance() : getApplianceById(applianceId);
  if (!tpl) return null;
  return {
    rowId: ++rowSeq,
    nom: tpl.name,
    puissanceW: tpl.power,
    quantite: 1,
    heuresJour: tpl.day,
    heuresNuit: tpl.night,
    // Frigos, congélateurs, pompes et climatiseurs ont un appel au démarrage.
    demarrage: Boolean(tpl.demarrage),
    custom: Boolean(tpl.custom),
  };
};

/**
 * Tableau de saisie des charges — moteur v2.
 * Capture par équipement : puissance unitaire, quantité, heures d'usage en
 * JOURNÉE et heures d'usage la NUIT séparément, et le caractère
 * « démarrage moteur / compresseur » (appel au démarrage).
 *
 * @param {Array}  lignes                 charges saisies
 * @param {(l:Array) => void} onChange    remplace la liste
 * @param {number} coefficientSimultaneite pour l'affichage des totaux
 */
export default function ChargesTable({ lignes, onChange, coefficientSimultaneite }) {
  const [pickerId, setPickerId] = useState('');

  const ajouter = () => {
    const ligne = nouvelleLigne(pickerId);
    if (!ligne) return;
    onChange([...lignes, ligne]);
    setPickerId('');
  };
  const modifier = (rowId, champ, valeur) =>
    onChange(lignes.map((l) => (l.rowId === rowId ? { ...l, [champ]: valeur } : l)));
  const supprimer = (rowId) => onChange(lignes.filter((l) => l.rowId !== rowId));

  const bilan = bilanConsommation(lignes, { coefficientSimultaneite });

  return (
    <>
      <div className="appliance-picker">
        <select className="input" value={pickerId} onChange={(e) => setPickerId(e.target.value)} aria-label="Choisir un appareil">
          <option value="">Ajouter un appareil…</option>
          <option value={CUSTOM_APPLIANCE_ID}>➕ Autre appareil (non listé)…</option>
          {applianceCategories.map((cat) => (
            <optgroup key={cat.label} label={cat.label}>
              {cat.items.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.power} W)</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button className="btn btn-primary" onClick={ajouter} disabled={!pickerId}>
          <Plus size={16} /> Ajouter
        </button>
      </div>

      {lignes.length > 0 ? (
        <div className="appliance-list">
          {bilan.parEquipement.map((e, i) => {
            const l = lignes[i];
            return (
              <div key={l.rowId} className={`appliance-row ${l.demarrage ? 'moteur' : ''}`}>
                <div className="appliance-row-main">
                  {l.custom ? (
                    <input
                      className="input appliance-name-input"
                      value={l.nom}
                      onChange={(ev) => modifier(l.rowId, 'nom', ev.target.value)}
                      placeholder="Nom de l'appareil (ex : Pompe à eau)"
                      aria-label="Nom de l'appareil"
                    />
                  ) : (
                    <div className="appliance-name">{l.nom}</div>
                  )}
                  <button className="appliance-delete" onClick={() => supprimer(l.rowId)} aria-label="Supprimer">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="appliance-fields">
                  <label className="appliance-field">
                    <span>Qté</span>
                    <input type="number" min="1" value={l.quantite}
                      onChange={(ev) => modifier(l.rowId, 'quantite', Math.max(1, Number(ev.target.value)))} />
                  </label>
                  <label className="appliance-field">
                    <span>Puiss. (W)</span>
                    <input type="number" min="0" value={l.puissanceW}
                      onChange={(ev) => modifier(l.rowId, 'puissanceW', Number(ev.target.value))} />
                  </label>
                  <label className="appliance-field">
                    <span><Sun size={12} /> h jour</span>
                    <input type="number" min="0" max="24" step="0.5" value={l.heuresJour}
                      onChange={(ev) => modifier(l.rowId, 'heuresJour', Number(ev.target.value))} />
                  </label>
                  <label className="appliance-field">
                    <span><Moon size={12} /> h nuit</span>
                    <input type="number" min="0" max="24" step="0.5" value={l.heuresNuit}
                      onChange={(ev) => modifier(l.rowId, 'heuresNuit', Number(ev.target.value))} />
                  </label>
                </div>
                <label className="appliance-moteur">
                  <input type="checkbox" checked={Boolean(l.demarrage)}
                    onChange={(ev) => modifier(l.rowId, 'demarrage', ev.target.checked)} />
                  <Rocket size={13} />
                  <span>Démarrage moteur / compresseur (frigo, congélateur, pompe, climatiseur)</span>
                </label>
                <div className="appliance-row-consumption">
                  <span><Sun size={12} /> {fmt.num(e.whJour)} Wh</span>
                  <span><Moon size={12} /> {fmt.num(e.whNuit)} Wh</span>
                  {l.repartitionAVerifier && <span className="appliance-warn">répartition jour/nuit à revoir</span>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">Ajoutez les appareils du client pour estimer ses besoins.</div>
      )}

      <div className="consumption-summary">
        <div className="consumption-stat day">
          <Sun size={16} />
          <div><div className="consumption-value">{fmt.num(bilan.jourKwh, 2)}</div><div className="consumption-label">Jour kWh</div></div>
        </div>
        <div className="consumption-stat night">
          <Moon size={16} />
          <div><div className="consumption-value">{fmt.num(bilan.nuitKwh, 2)}</div><div className="consumption-label">Nuit kWh</div></div>
        </div>
        <div className="consumption-stat peak">
          <Gauge size={16} />
          <div><div className="consumption-value">{fmt.num(bilan.puissanceSimultanee)}</div><div className="consumption-label">Pointe simultanée (W)</div></div>
        </div>
        {bilan.nbMoteurs > 0 && (
          <div className="consumption-stat surge">
            <Rocket size={16} />
            <div><div className="consumption-value">{fmt.num(bilan.puissanceAppelDemarrage)}</div><div className="consumption-label">Appel démarrage (W)</div></div>
          </div>
        )}
        <div className="consumption-stat total">
          <Zap size={16} />
          <div><div className="consumption-value">{fmt.num(bilan.totalKwh, 2)}</div><div className="consumption-label">Total / jour</div></div>
        </div>
      </div>
    </>
  );
}
