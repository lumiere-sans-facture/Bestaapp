import { MapPin, CalendarDays, BatteryCharging, Percent, Ruler, AlertTriangle } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { siteComplet } from '../../data/irradiation';
import { formatCFA } from '../../utils/format';
import { batteryOptionsFromCatalog } from '../../utils/solarSizing';
import { DEFAUTS, MOIS, fmt, irradiationDeDimensionnement } from '../../utils/dimensionnementV2';

/** Valeurs par défaut des paramètres projet du dimensionnement v2. */
export const PARAMETRES_DEFAUT = {
  siteId: null,
  strategieIrradiation: 'mois-defavorable',
  baseAutonomie: 'nuit',
  coefficientSimultaneite: DEFAUTS.coefficientSimultaneite,
  joursAutonomie: 1,
  distances: { pvOnduleurM: 20, batterieOnduleurM: 3, onduleurTableauM: 10 },
};

/** Capacité brute (kWh) pour une base d'autonomie donnée — aperçu de coût. */
const capaciteBrute = (kwh, jours = 1) =>
  (kwh * jours) / (DEFAUTS.dod * DEFAUTS.rendementBatterieDecharge);

/**
 * Paramètres de projet du dimensionnement : site d'irradiation, stratégie,
 * base d'autonomie (avec impact coût en temps réel), coefficient de
 * simultanéité et distances de câblage.
 *
 * @param {object} valeurs   PARAMETRES_DEFAUT enrichi
 * @param {(v:object) => void} onChange
 * @param {{day:number,night:number}} consommation  kWh/jour (aperçu de coût)
 */
export default function ParametresProjet({ valeurs, onChange, consommation }) {
  const { irradiationSites, products } = useData();
  const sites = irradiationSites || [];
  const site = sites.find((s) => s.id === valeurs.siteId) || null;
  const set = (patch) => onChange({ ...valeurs, ...patch });
  const setDistance = (cle, v) => set({ distances: { ...valeurs.distances, [cle]: Number(v) || 0 } });

  const irr = site ? irradiationDeDimensionnement(site, valeurs.strategieIrradiation) : null;

  // Impact coût de la base d'autonomie : nombre de modules batterie et prix
  // catalogue (lecture seule — aucune logique de tarification modifiée ici).
  const modules = batteryOptionsFromCatalog(products);
  const moduleRef = modules.length ? modules[Math.floor(modules.length / 2)] : null;
  const chiffrer = (kwh) => {
    const brute = capaciteBrute(kwh, valeurs.joursAutonomie);
    if (!moduleRef) return { brute, nb: null, cout: null };
    const nb = Math.max(1, Math.ceil(brute / moduleRef.capacity));
    return { brute, nb, cout: nb * moduleRef.price };
  };
  const nuit = chiffrer(consommation?.night || 0);
  const journee = chiffrer((consommation?.day || 0) + (consommation?.night || 0));
  const surcout = nuit.cout != null && journee.cout != null ? journee.cout - nuit.cout : null;

  return (
    <div className="params-projet">
      {/* Site d'irradiation */}
      <div className="param-bloc">
        <div className="param-label"><MapPin size={15} /> Site d’irradiation</div>
        <select
          className="input"
          value={valeurs.siteId || ''}
          onChange={(e) => set({ siteId: e.target.value || null })}
          aria-label="Site d’irradiation"
        >
          <option value="">Choisir un site…</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nom}{siteComplet(s) ? '' : ' — productible PVGIS à compléter'}
            </option>
          ))}
        </select>
        {site && !siteComplet(site) && (
          <div className="param-hint warn">
            <AlertTriangle size={13} /> Productible mensuel PVGIS absent pour {site.nom} : le calcul
            basculera sur un ensoleillement moyen, sans garantie en saison des pluies.
          </div>
        )}
        {irr?.complet && (
          <div className="param-hint">
            Mois le plus défavorable : <strong>{irr.moisNom}</strong> à {fmt.productible(irr.productibleMin)}
            {' '}(moyenne annuelle {fmt.productible(irr.productibleMoyen)}).
          </div>
        )}
      </div>

      {/* Stratégie d'irradiation */}
      <div className="param-bloc">
        <div className="param-label"><CalendarDays size={15} /> Stratégie d’irradiation</div>
        <div className="param-choix">
          {[
            ['mois-defavorable', 'Mois défavorable', 'Recommandé : le système couvre les besoins toute l’année.'],
            ['moyenne-annuelle', 'Moyenne annuelle', 'Déficit attendu en saison des pluies.'],
          ].map(([id, label, aide]) => (
            <button
              key={id} type="button"
              className={`param-option ${valeurs.strategieIrradiation === id ? 'selected' : ''}`}
              aria-pressed={valeurs.strategieIrradiation === id}
              onClick={() => set({ strategieIrradiation: id })}
            >
              <span className="param-option-label">{label}</span>
              <span className="param-option-help">{aide}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Base d'autonomie batterie + impact coût */}
      <div className="param-bloc">
        <div className="param-label"><BatteryCharging size={15} /> Base d’autonomie batterie</div>
        <div className="param-choix">
          {[
            ['nuit', 'Nuit seule', 'Offre hybride : la batterie couvre la consommation nocturne.', nuit],
            ['journee-complete', 'Journée complète', 'Site réellement isolé : la batterie couvre 24 h.', journee],
          ].map(([id, label, aide, chiffrage]) => (
            <button
              key={id} type="button"
              className={`param-option ${valeurs.baseAutonomie === id ? 'selected' : ''}`}
              aria-pressed={valeurs.baseAutonomie === id}
              onClick={() => set({ baseAutonomie: id })}
            >
              <span className="param-option-label">{label}</span>
              <span className="param-option-help">{aide}</span>
              <span className="param-option-cout">
                {fmt.kwh(chiffrage.brute)} à installer
                {chiffrage.nb != null && ` · ${chiffrage.nb} module${chiffrage.nb > 1 ? 's' : ''}`}
                {chiffrage.cout != null && ` · ~${formatCFA(chiffrage.cout)}`}
              </span>
            </button>
          ))}
        </div>
        {surcout != null && surcout > 0 && (
          <div className="param-hint">
            Passer en « journée complète » ajoute environ <strong>{formatCFA(surcout)}</strong> de stockage.
          </div>
        )}
        <label className="param-inline">
          <span>Jours d’autonomie</span>
          <input
            className="input" type="number" min="1" max="5" step="1"
            value={valeurs.joursAutonomie}
            onChange={(e) => set({ joursAutonomie: Math.max(1, Number(e.target.value) || 1) })}
          />
        </label>
      </div>

      {/* Coefficient de simultanéité */}
      <div className="param-bloc">
        <div className="param-label"><Percent size={15} /> Coefficient de simultanéité</div>
        <div className="param-slider">
          <input
            type="range" min="0.4" max="1" step="0.05"
            value={valeurs.coefficientSimultaneite}
            onChange={(e) => set({ coefficientSimultaneite: Number(e.target.value) })}
            aria-label="Coefficient de simultanéité"
          />
          <strong>{fmt.pct(valeurs.coefficientSimultaneite, 0)}</strong>
        </div>
        <div className="param-hint">
          Part des charges réellement en service au même instant. Dimensionne la puissance
          de l’onduleur — 100 % signifie que tous les appareils fonctionnent simultanément.
        </div>
      </div>

      {/* Distances de câblage */}
      <div className="param-bloc">
        <div className="param-label"><Ruler size={15} /> Distances de câblage</div>
        <div className="param-distances">
          {[
            ['pvOnduleurM', 'Champ PV → onduleur'],
            ['batterieOnduleurM', 'Batterie → onduleur'],
            ['onduleurTableauM', 'Onduleur → tableau'],
          ].map(([cle, label]) => (
            <label key={cle} className="param-distance">
              <span>{label}</span>
              <input
                className="input" type="number" min="0" step="1"
                value={valeurs.distances?.[cle] ?? ''}
                onChange={(e) => setDistance(cle, e.target.value)}
              />
              <em>m</em>
            </label>
          ))}
        </div>
        <div className="param-hint">
          Longueur simple de chaque liaison : les sections sont calculées sur l’aller-retour
          (UTE C15-712), avec une chute de tension admissible de 3 % côté PV, 1 % côté batterie.
        </div>
      </div>

      {site && !siteComplet(site) && (
        <div className="param-hint">
          Pour renseigner le productible : PVGIS → coordonnées du site → performance PV connectée
          au réseau (1 kWc, pertes 14 %, angles optimisés) → relever E_m de {MOIS[0]} à {MOIS[11]},
          divisé par le nombre de jours du mois.
        </div>
      )}
    </div>
  );
}
