import { useMemo, useState } from 'react';
import { Zap, Fuel, PiggyBank, TrendingUp, Timer, Leaf, Info } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { formatCFA, formatCFACourt } from '../../utils/format';
import { PRIX_KWH_RESEAU } from '../../utils/factureConso';
import {
  simulerRoi, consommationGroupe,
  DUREE_SYSTEME_ANS, TAUX_COUVERTURE_DEFAUT, MAINTENANCE_ANNUELLE,
  HAUSSE_TARIF_DEFAUT, DEGRADATION_ANNUELLE, CO2_PAR_LITRE_GAZOLE, CO2_PAR_KWH_RESEAU,
} from '../../utils/roi';

// Situation de départ : un client type de Lomé — facture CEET moyenne et un
// groupe électrogène de 5 kVA, la configuration la plus courante chez les
// commerces que visite l'équipe.
const DEPART = {
  tarifKwh: PRIX_KWH_RESEAU,
  haussePct: HAUSSE_TARIF_DEFAUT * 100,
  factureMensuelle: 60000,
  groupeActif: true,
  heuresCoupureJour: 6,
  puissanceKva: 5,
  prixCarburant: 750,
  consommationLh: consommationGroupe(5),
  investissement: 4000000,
  couverturePct: TAUX_COUVERTURE_DEFAUT * 100,
};

const pct = (n) => `${Math.round(n)} %`;
const ans = (n) => `${String(n).replace('.', ',')} an${n >= 2 ? 's' : ''}`;
// Litres, heures, tonnes : virgule décimale, comme partout ailleurs dans l'app.
const dec = (n, d = 1) => n.toFixed(d).replace('.', ',');

/** Curseur avec sa valeur affichée à droite, éventuellement saisissable. */
function Curseur({ label, value, onChange, min, max, step = 1, suffixe, saisissable = false }) {
  return (
    <div className="roi-champ">
      <div className="roi-champ-tete">
        <label className="roi-champ-label">{label}</label>
        <div className="roi-champ-valeur">
          {saisissable ? (
            <input
              type="number"
              className="roi-champ-input"
              value={value}
              min={min}
              max={max}
              step={step}
              onChange={(e) => onChange(Number(e.target.value))}
              aria-label={label}
            />
          ) : (
            <span>{typeof value === 'number' && !Number.isInteger(value) ? dec(value) : value.toLocaleString('fr-FR')}</span>
          )}
          <span className="roi-champ-suffixe">{suffixe}</span>
        </div>
      </div>
      <input
        type="range"
        className="roi-curseur"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </div>
  );
}

/**
 * Projection : économies cumulées face à l'investissement. Graphique fait main
 * en SVG (pas de librairie de charts dans le projet). Le point de croisement
 * est le seul chiffre que le client retient — il est marqué.
 */
function Projection({ lignes, investissement, retourAns }) {
  const max = Math.max(investissement, lignes[lignes.length - 1]?.cumul || 0, 1);
  const L = 100; // repère en pourcentage : le SVG s'étire à la largeur du bloc
  const H = 100;
  const x = (annee) => ((annee - 1) / Math.max(1, lignes.length - 1)) * L;
  const y = (valeur) => H - (valeur / max) * H;
  const courbe = lignes.map((l) => `${x(l.annee).toFixed(2)},${y(l.cumul).toFixed(2)}`).join(' ');
  const aire = `0,${H} ${courbe} ${L},${H}`;
  const yInvest = y(investissement);
  const xSeuil = retourAns != null ? (retourAns / Math.max(1, lignes.length - 1)) * L : null;

  return (
    <div className="roi-projection">
      <svg viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="none" className="roi-svg" role="img"
           aria-label={`Économies cumulées sur ${lignes.length} ans, comparées à l'investissement`}>
        <polygon points={aire} className="roi-aire" />
        <polyline points={courbe} className="roi-courbe" />
        {/* Ligne de l'investissement : tant que la courbe est en dessous, le
            client n'a pas encore récupéré sa mise. */}
        <line x1="0" y1={yInvest} x2={L} y2={yInvest} className="roi-ligne-invest" />
        {xSeuil != null && <line x1={xSeuil} y1="0" x2={xSeuil} y2={H} className="roi-ligne-seuil" />}
      </svg>
      <div className="roi-axe">
        <span>An 1</span>
        {retourAns != null && <span className="roi-axe-seuil">Remboursé · {ans(retourAns)}</span>}
        <span>An {lignes.length}</span>
      </div>
      <div className="chart-legend">
        <span className="legend-item"><span className="legend-dot roi-dot-cumul" /> Économies cumulées</span>
        <span className="legend-item"><span className="legend-dot roi-dot-invest" /> Investissement</span>
      </div>
    </div>
  );
}

/** Une ligne de la décomposition du coût actuel. */
function Ligne({ label, montant, fort = false, negatif = false }) {
  return (
    <div className={`roi-ligne ${fort ? 'is-forte' : ''}`}>
      <span className="roi-ligne-label">{label}</span>
      <span className={`roi-ligne-montant ${negatif ? 'is-negatif' : ''}`}>
        {negatif ? '−' : ''}{formatCFA(Math.abs(montant))}
      </span>
    </div>
  );
}

export default function RoiSection() {
  const { devis } = useData();
  const [f, setF] = useState(DEPART);
  const maj = (patch) => setF((p) => ({ ...p, ...patch }));

  // Devis déjà émis : reprendre son montant évite de ressaisir un chiffre que
  // l'app connaît — et le simulateur porte alors sur l'offre réelle du client.
  const devisRecents = useMemo(
    () => (devis || []).filter((d) => Number(d.total) > 0).slice(0, 12),
    [devis]
  );

  const sim = useMemo(() => simulerRoi({
    investissement: f.investissement,
    factureMensuelle: f.factureMensuelle,
    tarifKwh: f.tarifKwh,
    hausse: f.haussePct / 100,
    groupeActif: f.groupeActif,
    heuresCoupureJour: f.heuresCoupureJour,
    prixCarburant: f.prixCarburant,
    consommationLh: f.consommationLh,
    tauxCouverture: f.couverturePct / 100,
  }), [f]);

  return (
    <div className="roi-grid">
      {/* ---- Colonne des hypothèses ---- */}
      <div className="roi-colonne">
        <div className="card">
          <div className="sheet-section-title"><Zap size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Fournisseur d’énergie</div>
          <Curseur label="Tarif réseau" value={f.tarifKwh} onChange={(v) => maj({ tarifKwh: v })} min={50} max={250} suffixe="F/kWh" />
          <Curseur label="Hausse tarifaire annuelle" value={f.haussePct} onChange={(v) => maj({ haussePct: v })} min={0} max={15} step={0.5} suffixe="%/an" />
        </div>

        <div className="card">
          <div className="sheet-section-title"><Fuel size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Situation actuelle du client</div>
          <Curseur label="Facture mensuelle" value={f.factureMensuelle} onChange={(v) => maj({ factureMensuelle: v })} min={0} max={2000000} step={5000} suffixe="F" saisissable />
          <label className="checkbox-row roi-bascule">
            <input type="checkbox" checked={f.groupeActif} onChange={(e) => maj({ groupeActif: e.target.checked })} />
            <span>Groupe électrogène existant</span>
          </label>
          {f.groupeActif && (
            <>
              <Curseur label="Heures de coupure / jour" value={f.heuresCoupureJour} onChange={(v) => maj({ heuresCoupureJour: v })} min={0} max={24} step={0.5} suffixe="h" />
              <Curseur
                label="Puissance du groupe"
                value={f.puissanceKva}
                // Changer la puissance recale la consommation : personne ne
                // connaît les litres/heure de son groupe, tout le monde connaît
                // ses kVA. La valeur reste modifiable juste en dessous.
                onChange={(v) => maj({ puissanceKva: v, consommationLh: consommationGroupe(v) })}
                min={1} max={100} suffixe="kVA"
              />
              <Curseur label="Consommation du groupe" value={f.consommationLh} onChange={(v) => maj({ consommationLh: v })} min={0.2} max={30} step={0.1} suffixe="L/h" />
              <Curseur label="Prix du carburant" value={f.prixCarburant} onChange={(v) => maj({ prixCarburant: v })} min={300} max={1500} step={25} suffixe="F/L" />
            </>
          )}
        </div>

        <div className="card">
          <div className="sheet-section-title"><PiggyBank size={13} style={{ verticalAlign: -2, marginRight: 5 }} />L’installation proposée</div>
          <Curseur label="Montant de l’installation" value={f.investissement} onChange={(v) => maj({ investissement: v })} min={0} max={50000000} step={50000} suffixe="F" saisissable />
          {devisRecents.length > 0 && (
            <div className="input-group">
              <label className="input-label" htmlFor="roi-devis">Reprendre le montant d’un devis</label>
              <select
                id="roi-devis"
                className="input"
                value=""
                onChange={(e) => {
                  const d = devisRecents.find((x) => x.id === e.target.value);
                  if (d) maj({ investissement: Math.round(Number(d.total)) });
                }}
              >
                <option value="">Saisie manuelle</option>
                {devisRecents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.devisNumber || 'Devis'} — {formatCFA(d.total)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Curseur label="Taux de couverture solaire" value={f.couverturePct} onChange={(v) => maj({ couverturePct: v })} min={10} max={100} step={5} suffixe="%" />
        </div>
      </div>

      {/* ---- Colonne des résultats ---- */}
      <div className="roi-colonne">
        <div className="partner-kpis roi-kpis">
          <div className="kpi-card is-highlight">
            <div className="kpi-icon"><PiggyBank size={17} /></div>
            <div className="kpi-value">{formatCFACourt(sim.economieAn1)}</div>
            <div className="kpi-label">Économie nette an 1 · {pct(f.couverturePct)} de couverture</div>
          </div>
          <div className="kpi-card is-primary">
            <div className="kpi-icon"><Timer size={17} /></div>
            <div className="kpi-value">{sim.retourAns != null ? ans(sim.retourAns) : '—'}</div>
            <div className="kpi-label">
              {sim.retourAns != null
                ? 'Retour sur investissement'
                : `Non remboursé en ${DUREE_SYSTEME_ANS} ans`}
            </div>
          </div>
          <div className="kpi-card is-success">
            <div className="kpi-icon"><TrendingUp size={17} /></div>
            <div className="kpi-value">{formatCFACourt(sim.gainDuree)}</div>
            <div className="kpi-label">
              Gain sur {DUREE_SYSTEME_ANS} ans{sim.roiPct != null ? ` · ${sim.roiPct.toLocaleString('fr-FR')} % de ROI` : ''}
            </div>
          </div>
          <div className="kpi-card is-info">
            <div className="kpi-icon"><Leaf size={17} /></div>
            <div className="kpi-value">{dec(sim.co2DureeT)} t</div>
            <div className="kpi-label">CO₂ évité · {sim.co2AnKg.toLocaleString('fr-FR')} kg/an</div>
          </div>
        </div>

        <div className="card roi-bloc">
          <div className="sheet-section-title">Coût réel actuel — décomposition</div>
          {/* Le carburant du groupe se paie au litre, jamais à l'année : c'est
              en l'additionnant sur douze mois que le client voit ce qu'il
              dépense vraiment. */}
          <Ligne label="Facture réseau annuelle" montant={sim.cout.reseau} />
          {f.groupeActif && (
            <Ligne
              label={`Carburant du groupe · ${sim.cout.litresAn.toLocaleString('fr-FR')} L/an`}
              montant={sim.cout.carburant}
            />
          )}
          <Ligne label="Coût réel total / an" montant={sim.cout.total} fort />
          <Ligne label="Entretien de l’installation" montant={sim.maintenance} negatif />
          <Ligne label="Économie nette an 1" montant={sim.economieAn1} fort />
        </div>

        <div className="card roi-bloc">
          <div className="sheet-section-title">Projection sur {DUREE_SYSTEME_ANS} ans</div>
          <Projection lignes={sim.projection} investissement={f.investissement} retourAns={sim.retourAns} />
        </div>

        {/* Un chiffre qu'on ne peut pas justifier devant le client ne vaut
            rien : les hypothèses sont écrites, pas cachées dans le code. */}
        <div className="card roi-hypotheses">
          <div className="sheet-section-title"><Info size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Hypothèses de calcul</div>
          <ul>
            <li>Le solaire couvre {pct(f.couverturePct)} du besoin — le reste continue d’être payé au réseau ou au groupe.</li>
            <li>L’énergie renchérit de {dec(f.haussePct)} %/an ; l’entretien suit la même hausse.</li>
            <li>Les panneaux perdent {dec(DEGRADATION_ANNUELLE * 100, 1)} % de rendement par an (garantie constructeur : 25 ans).</li>
            <li>Entretien de l’installation : {formatCFA(MAINTENANCE_ANNUELLE)} par an.</li>
            <li>CO₂ : {dec(CO2_PAR_LITRE_GAZOLE, 2)} kg par litre de gazole, {dec(CO2_PAR_KWH_RESEAU, 2)} kg par kWh réseau — ordres de grandeur, pas une mesure.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
