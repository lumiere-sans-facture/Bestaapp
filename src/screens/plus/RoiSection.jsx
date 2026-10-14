import { useMemo, useState } from 'react';
import { Lightbulb, Banknote, Package, Sun, CalendarCheck, Sprout, Plus as PlusIcon, X } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { formatCFA, formatCFACourt } from '../../utils/format';
import { TARIFS_UEMOA, PAYS_DEFAUT, tarifPays, operateurPays } from '../../data/tarifsUemoa';
import { applianceCategories, appliances } from '../../data/appliances';
import { DEFAULT_PEAK_SUN_HOURS, SYSTEM_TYPES } from '../../utils/solarSizing';
import { dimensionnementRejouable, restaurerDimensionnement, resumeDimensionnement } from '../../utils/dimensionnement';
import { proposerKit, consommationDimensionnement } from '../../utils/propositionKit';
import { coefficientMainOeuvre } from '../../utils/mainOeuvre';
import { REPARTITIONS, DEFAULT_REPARTITION, JOURS_PAR_MOIS, partJourDe } from '../../utils/factureConso';
import {
  simulerRoi, consommationDepuisFacture,
  DUREE_SYSTEME_ANS, DUREES_SYSTEME, HAUSSE_TARIF_DEFAUT,
  DEGRADATION_ANNUELLE, KWH_PAR_LITRE_GAZOLE, CO2_PAR_LITRE_GAZOLE, CO2_PAR_KWH_RESEAU,
} from '../../utils/roi';

// Client de départ : un petit commerce de Lomé, l'essentiel de ce que l'équipe
// rencontre en visite. Il donne un écran déjà chiffré à l'ouverture, plutôt
// qu'un formulaire vide qu'il faut remplir avant de comprendre à quoi il sert.
const DEPART = [
  { rowId: 1, ...appliances.find((a) => a.id === 'ledlamp'), quantity: 8 },
  { rowId: 2, ...appliances.find((a) => a.id === 'fridge'), quantity: 1 },
  { rowId: 3, ...appliances.find((a) => a.id === 'tv32'), quantity: 1 },
  { rowId: 4, ...appliances.find((a) => a.id === 'standfan'), quantity: 2 },
];

const PRIX_CARBURANT = 750;   // F CFA le litre de gazole (Togo)
const COUPURES_PAR_JOUR = 6;  // heures de coupure quotidiennes, valeur de terrain
const FACTURE_MENSUELLE = 60000; // F CFA — facture CEET d'un petit commerce

const dec = (n, d = 1) => Number(n || 0).toFixed(d).replace('.', ',');
// Capacité batterie : 72, 5,12 — sans zéros inutiles.
const kwh = (n) => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const ans = (n) => `${String(n).replace('.', ',')} an${n >= 2 ? 's' : ''}`;

/** Curseur avec sa valeur à droite. */
function Curseur({ label, value, onChange, min, max, step = 1, suffixe }) {
  return (
    <div className="roi-champ">
      <div className="roi-champ-tete">
        <label className="roi-champ-label">{label}</label>
        <div className="roi-champ-valeur">
          <span>{Number.isInteger(value) ? value.toLocaleString('fr-FR') : dec(value)}</span>
          <span className="roi-champ-suffixe">{suffixe}</span>
        </div>
      </div>
      <input
        type="range" className="roi-curseur"
        min={min} max={max} step={step}
        value={Math.min(max, Math.max(min, value))}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </div>
  );
}

function Ligne({ label, montant, detail, fort = false, negatif = false }) {
  return (
    <div className={`roi-ligne ${fort ? 'is-forte' : ''}`}>
      <span className="roi-ligne-label">
        {label}
        {detail && <span className="roi-ligne-detail">{detail}</span>}
      </span>
      <span className={`roi-ligne-montant ${negatif ? 'is-negatif' : ''}`}>
        {negatif ? '−' : ''}{formatCFA(Math.abs(montant))}
      </span>
    </div>
  );
}

/** Économies cumulées face au prix de l'installation. SVG fait main. */
function Projection({ lignes, investissement, retourAns }) {
  const max = Math.max(investissement, lignes[lignes.length - 1]?.cumul || 0, 1);
  const L = 100; const H = 100;
  const x = (annee) => ((annee - 1) / Math.max(1, lignes.length - 1)) * L;
  const y = (v) => H - (v / max) * H;
  const courbe = lignes.map((l) => `${x(l.annee).toFixed(2)},${y(l.cumul).toFixed(2)}`).join(' ');
  const xSeuil = retourAns != null ? (retourAns / Math.max(1, lignes.length - 1)) * L : null;
  return (
    <div className="roi-projection">
      <svg viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="none" className="roi-svg" role="img"
           aria-label={`Économies cumulées sur ${lignes.length} ans face au prix de l'installation`}>
        <polygon points={`0,${H} ${courbe} ${L},${H}`} className="roi-aire" />
        <polyline points={courbe} className="roi-courbe" />
        {/* Sous cette ligne, le client n'a pas encore récupéré sa mise. */}
        <line x1="0" y1={y(investissement)} x2={L} y2={y(investissement)} className="roi-ligne-invest" />
        {xSeuil != null && <line x1={xSeuil} y1="0" x2={xSeuil} y2={H} className="roi-ligne-seuil" />}
      </svg>
      <div className="roi-axe">
        <span>An 1</span>
        {retourAns != null && <span className="roi-axe-seuil">Remboursé · {ans(retourAns)}</span>}
        <span>An {lignes.length}</span>
      </div>
      <div className="chart-legend">
        <span className="legend-item"><span className="legend-dot roi-dot-cumul" /> Économies cumulées</span>
        <span className="legend-item"><span className="legend-dot roi-dot-invest" /> Prix de l’installation</span>
      </div>
    </div>
  );
}

export default function RoiSection() {
  const { devis, kits, inverters, products } = useData();
  // Deux façons d'estimer la consommation, comme dans l'assistant de devis :
  // par les appareils, ou par la facture quand le client ne sait pas dire ce
  // qu'il fait tourner mais sait très bien ce qu'il paie. La facture d'abord
  // (décision du gérant) : c'est le chiffre que le client a en main.
  const [mode, setMode] = useState('facture');
  const [rows, setRows] = useState(DEPART);
  const [facture, setFacture] = useState(FACTURE_MENSUELLE);
  // « Quand consomme-t-il le plus ? » — la même question, et la même
  // conversion, que l'assistant de devis (utils/factureConso.js).
  const [repartition, setRepartition] = useState(DEFAULT_REPARTITION);
  const [pays, setPays] = useState(PAYS_DEFAUT);
  const [duree, setDuree] = useState(DUREE_SYSTEME_ANS);
  const [coupures, setCoupures] = useState(COUPURES_PAR_JOUR);
  const [groupeActif, setGroupeActif] = useState(true);
  const [tarif, setTarif] = useState(tarifPays(PAYS_DEFAUT).prixKwh);
  const [carburant, setCarburant] = useState(PRIX_CARBURANT);
  // Prix retenu pour l'installation : celui du kit, sauf si un devis est repris.
  const [prixDevis, setPrixDevis] = useState(null);
  // Devis repris : son kit (variante retenue) et ses réglages de panneaux et
  // de modules, pour retrouver exactement sa composition.
  const [kitRepris, setKitRepris] = useState(null);

  // Changer de pays recale le prix du kWh sur celui de son opérateur ; le
  // curseur reste libre ensuite (les tranches varient d'un abonné à l'autre).
  const choisirPays = (id) => {
    setPays(id);
    const t = tarifPays(id);
    if (t) setTarif(t.prixKwh);
  };

  const ajouter = (id) => {
    const modele = appliances.find((a) => a.id === id);
    if (!modele) return;
    setRows((r) => {
      // Déjà dans la liste : on incrémente plutôt que d'empiler un doublon.
      const existant = r.find((x) => x.id === id);
      if (existant) return r.map((x) => (x === existant ? { ...x, quantity: x.quantity + 1 } : x));
      return [...r, { rowId: Math.max(0, ...r.map((x) => x.rowId)) + 1, ...modele, quantity: 1 }];
    });
  };
  const quantite = (rowId, q) =>
    setRows((r) => r.map((x) => (x.rowId === rowId ? { ...x, quantity: Math.max(1, q) } : x)));
  const retirer = (rowId) => setRows((r) => r.filter((x) => x.rowId !== rowId));

  // Devis solaires dont l'étude est rejouable : reprendre l'un d'eux remplit
  // la liste d'appareils ET le prix — le commercial a souvent déjà tout saisi.
  const etudes = useMemo(
    () => (devis || []).filter((d) => dimensionnementRejouable(d) && Number(d.total) > 0).slice(0, 12),
    [devis]
  );
  const reprendreEtude = (id) => {
    const d = etudes.find((x) => x.id === id);
    if (!d) return;
    const etude = restaurerDimensionnement(d);
    if (etude.appareils?.length) setRows(etude.appareils.map((a, i) => ({ ...a, rowId: a.rowId || i + 1 })));
    setKitRepris({ kitId: etude.kitId || null, reglages: etude.reglages || null });
    setPrixDevis(Math.round(Number(d.total)));
  };

  // Coût de la facture : douze factures par an (le chiffre que le client a
  // sous les yeux), réparties jour/nuit comme il l'a dit.
  const consoFacture = useMemo(
    () => consommationDepuisFacture(facture, tarif, partJourDe(repartition)),
    [facture, tarif, repartition]
  );
  // Mémorisée : recréer l'objet à chaque rendu relancerait le calcul du kit et
  // la simulation entière sans qu'aucune saisie ait bougé.
  const consoRetenue = useMemo(
    () => (mode === 'facture' && consoFacture.total > 0 ? consoFacture : null),
    [mode, consoFacture]
  );

  // Le kit que l'assistant de devis de l'app proposerait pour cette
  // consommation, composé par la MÊME fonction (utils/propositionKit.js) :
  // le kit suggéré, ses panneaux complétés au besoin, ses modules batterie
  // ajoutés au besoin (60 kWh porté à 72 kWh…), son onduleur, et la
  // main-d'œuvre du pays (doublée au Togo) — donc la même composition et le
  // même prix que le dimensionnement du devis.
  const coefMainOeuvre = coefficientMainOeuvre({ pays });
  const kit = useMemo(() => {
    // La consommation convertie comme dans l'assistant : appareils arrondis
    // au centième, facture sur des mois de 30 jours répartie selon « Quand
    // consomme-t-il le plus ? ». Une facture ne dit rien du pic de charge :
    // l'onduleur se cale alors sur la seule puissance photovoltaïque.
    const conso = consoRetenue
      ? consommationDimensionnement({ consoMode: 'facture', facture: { montant: facture, prixKwh: tarif, repartition } })
      : consommationDimensionnement({ consoMode: 'appareils', appareils: rows });
    // Système autonome — le même choix par défaut que l'assistant de devis
    // (`utils/dimensionnement.js`), et l'hypothèse qui a du sens ici : le
    // client vient pour cesser de dépendre du réseau et du groupe.
    const proposition = proposerKit({
      consumption: conso,
      peakLoad: conso.peakLoad,
      systemType: SYSTEM_TYPES[0].id,
      sunHours: DEFAULT_PEAK_SUN_HOURS,
      kits: kits || [],
      inverters: inverters || [],
      products: products || [],
      coefMainOeuvre,
      kitId: kitRepris?.kitId,
      reglages: kitRepris?.reglages,
    });
    return proposition?.kit ? proposition : null;
  }, [rows, consoRetenue, facture, tarif, repartition, kits, inverters, products, coefMainOeuvre, kitRepris]);

  const investissement = prixDevis ?? kit?.total ?? 0;

  const sim = useMemo(() => simulerRoi({
    appareils: rows,
    conso: consoRetenue,
    investissement,
    heuresCoupureJour: coupures,
    tarifKwh: tarif,
    prixCarburant: carburant,
    groupeActif,
    duree,
    // Les panneaux du kit proposé fixent l'entretien annuel.
    nbPanneaux: kit?.panneaux.poses || 0,
  }), [rows, consoRetenue, investissement, coupures, tarif, carburant, groupeActif, duree, kit?.panneaux.poses]);

  return (
    <div className="roi-grid">
      {/* ---------- Colonne des saisies ---------- */}
      <div className="roi-colonne">
        <div className="card">
          <div className="sheet-section-title"><Lightbulb size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Consommation du client</div>
          {/* Deux entrées possibles, comme dans l'assistant de devis : le client
              sait dire ce qu'il fait tourner, ou seulement ce qu'il paie. */}
          <div className="roi-modes" role="group" aria-label="Estimer la consommation">
            <button type="button" className={`roi-mode ${mode === 'appareils' ? 'is-actif' : ''}`}
                    onClick={() => setMode('appareils')}>D’après ses appareils</button>
            <button type="button" className={`roi-mode ${mode === 'facture' ? 'is-actif' : ''}`}
                    onClick={() => setMode('facture')}>D’après sa facture</button>
          </div>

          {mode === 'facture' ? (
            <>
              <p className="roi-aide">La facture divisée par le prix du kWh donne la consommation — le même calcul que l’assistant de devis.</p>
              <Curseur label="Facture d’électricité" value={facture} onChange={setFacture} min={0} max={2000000} step={5000} suffixe="F/mois" />
              <div className="chip-selector">
                <span className="chip-selector-label"><Sun size={13} /> Quand consomme-t-il le plus ?</span>
                <div className="categories-scroll is-wrap" style={{ marginBottom: 0 }}>
                  {REPARTITIONS.map((r) => (
                    <button key={r.id} type="button" className={`category-chip ${repartition === r.id ? 'active' : ''}`}
                      aria-pressed={repartition === r.id} onClick={() => setRepartition(r.id)}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="roi-note">
                {formatCFA(facture)} par mois à {formatCFA(tarif)} le kWh, soit
                {' '}{dec(consoFacture.kwhMois, 0)} kWh par mois, dont {Math.round((1 - partJourDe(repartition)) * 100)} % la nuit :
                c’est la part de nuit qui dimensionne la batterie.
              </p>
            </>
          ) : (
            <>
              <p className="roi-aide">Le même catalogue que l’assistant de devis : c’est lui qui donne la consommation.</p>

              {etudes.length > 0 && (
                <div className="input-group">
                  <label className="input-label" htmlFor="roi-etude">Reprendre l’étude d’un devis</label>
                  <select id="roi-etude" className="input" value="" onChange={(e) => reprendreEtude(e.target.value)}>
                    <option value="">Saisir les appareils ici</option>
                    {etudes.map((d) => (
                      <option key={d.id} value={d.id}>{d.devisNumber || 'Devis'} — {resumeDimensionnement(d)}</option>
                    ))}
                  </select>
                </div>
              )}

          <div className="roi-appareils">
            {rows.map((r) => (
              <div key={r.rowId} className="roi-appareil">
                <span className="roi-appareil-nom">{r.name}</span>
                <span className="roi-appareil-spec">{r.power} W · {r.day + r.night} h/j</span>
                <input
                  type="number" className="roi-appareil-qte" min="1" value={r.quantity}
                  onChange={(e) => quantite(r.rowId, Number(e.target.value))}
                  aria-label={`Quantité — ${r.name}`}
                />
                <button type="button" className="roi-appareil-retirer" onClick={() => retirer(r.rowId)}
                        aria-label={`Retirer ${r.name}`}><X size={15} /></button>
              </div>
            ))}
            {rows.length === 0 && <p className="roi-vide">Ajoutez au moins un appareil pour lancer le calcul.</p>}
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="roi-ajout"><PlusIcon size={12} /> Ajouter un appareil</label>
            <select id="roi-ajout" className="input" value="" onChange={(e) => ajouter(e.target.value)}>
              <option value="">Choisir dans le catalogue…</option>
              {applianceCategories.map((c) => (
                <optgroup key={c.label} label={c.label}>
                  {c.items.map((a) => <option key={a.id} value={a.id}>{a.name} — {a.power} W</option>)}
                </optgroup>
              ))}
            </select>
          </div>

            </>
          )}

          {/* Le total, mis en avant : c'est lui qui commande le kit ET le coût. */}
          <div className="roi-total">
            <div className="roi-total-valeur">{dec(sim.conso.total, 2)} kWh / jour</div>
            <div className="roi-total-detail">
              {dec(sim.conso.jour, 2)} kWh en journée · {dec(sim.conso.nuit, 2)} kWh la nuit
            </div>
          </div>
        </div>

        <div className="card">
          <div className="sheet-section-title"><Banknote size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Réseau et coupures</div>
          <Curseur label="Coupures de courant" value={coupures} onChange={setCoupures} min={0} max={24} step={0.5} suffixe="h/jour" />
          <div className="input-group">
            <label className="input-label" htmlFor="roi-pays">Pays du client</label>
            <select id="roi-pays" className="input" value={pays} onChange={(e) => choisirPays(e.target.value)}>
              {TARIFS_UEMOA.map((t) => (
                <option key={t.id} value={t.id}>{t.pays} — {t.operateur}</option>
              ))}
            </select>
          </div>
          <Curseur label={`Prix du kWh (${operateurPays(pays)})`} value={tarif} onChange={setTarif} min={50} max={250} suffixe="F" />
          {tarifPays(pays) && tarif !== tarifPays(pays).prixKwh && (
            <p className="roi-note">
              Tarif ajusté à la main — le tarif indicatif {operateurPays(pays)} est de {formatCFA(tarifPays(pays).prixKwh)}.{' '}
              <button type="button" className="roi-lien" onClick={() => choisirPays(pays)}>Le rétablir</button>
            </p>
          )}
          <label className="checkbox-row roi-bascule">
            <input type="checkbox" checked={groupeActif} onChange={(e) => setGroupeActif(e.target.checked)} />
            <span>Le client a un groupe électrogène</span>
          </label>
          {groupeActif && (
            <Curseur label="Prix du litre de gazole" value={carburant} onChange={setCarburant} min={300} max={1500} step={25} suffixe="F" />
          )}
        </div>

        <div className="card">
          <div className="sheet-section-title"><Package size={13} style={{ verticalAlign: -2, marginRight: 5 }} />L’installation</div>
          {kit ? (
            <>
              <p className="roi-aide">Le kit que votre assistant de devis propose pour cette consommation, au prix de votre catalogue.</p>
              <div className="roi-kit">
                <div className="roi-kit-nom">{kit.kit.name}</div>
                {/* La composition réellement chiffrée, décrite comme dans
                    l'assistant de devis : modules et panneaux ajoutés au
                    besoin, onduleur de remplacement s'il y a lieu. */}
                <div className="roi-kit-spec">
                  {kwh(kit.batterie.capacite)} kWh de batterie
                  {kit.batterie.capacite > Number(kit.kit.battery) && ` (étendue depuis ${kwh(kit.kit.battery)})`}
                  {kit.batterie.capacite < Number(kit.kit.battery) && ` (réduite depuis ${kwh(kit.kit.battery)})`}
                  {' '}· {kit.panneaux.poses} panneaux de {kit.kit.panelW} Wc
                  {kit.panneaux.poses > kit.kit.panels && ` (complétés depuis ${kit.kit.panels})`}
                  {kit.panneaux.poses < kit.kit.panels && ` (ajustés au besoin, au lieu de ${kit.kit.panels})`}
                  {' '}· onduleur {kit.quotation.inverterSuggested
                    ? `${kit.quotation.inverterSuggested.quantite > 1 ? `${kit.quotation.inverterSuggested.quantite} × ` : ''}${kit.quotation.inverterSuggested.capacity} kVA`
                    : `${kit.kit.inverter} kVA`}
                </div>
              </div>
              <Ligne label="Prix de l’installation" detail="pose comprise" montant={investissement} fort />

              {/* Sur quelle durée raisonner : 25 ans, c'est la garantie de
                  production des panneaux ; un client prudent préfère souvent
                  la durée de vie des batteries ou de l'onduleur. */}
              <div className="roi-durees" role="group" aria-label="Durée de vie retenue">
                <span className="roi-durees-label">Durée de vie retenue</span>
                <div className="roi-durees-choix">
                  {DUREES_SYSTEME.map((d) => (
                    <button
                      key={d} type="button"
                      className={`roi-duree ${duree === d ? 'is-actif' : ''}`}
                      onClick={() => setDuree(d)}
                      aria-pressed={duree === d}
                    >{d} ans</button>
                  ))}
                </div>
              </div>
              {prixDevis != null && (
                <p className="roi-note">
                  Montant repris du devis, au lieu du prix du kit ({formatCFA(kit.total)}).{' '}
                  <button type="button" className="roi-lien" onClick={() => setPrixDevis(null)}>Revenir au prix du kit</button>
                </p>
              )}
            </>
          ) : (
            <p className="roi-vide">Ajoutez des appareils : le kit se choisit tout seul d’après leur consommation.</p>
          )}
        </div>
      </div>

      {/* ---------- Colonne des résultats ---------- */}
      <div className="roi-colonne">
        <div className="partner-kpis roi-kpis">
          <div className="kpi-card is-highlight">
            <div className="kpi-icon"><CalendarCheck size={17} /></div>
            <div className="kpi-value">{sim.retourAns != null ? ans(sim.retourAns) : '—'}</div>
            <div className="kpi-label">
              {sim.retourAns != null ? 'Installation remboursée' : `Non remboursée en ${duree} ans`}
            </div>
          </div>
          <div className="kpi-card is-primary">
            <div className="kpi-icon"><Banknote size={17} /></div>
            <div className="kpi-value">{formatCFACourt(sim.economieAn1)}</div>
            <div className="kpi-label">Économisé la 1re année, entretien déduit</div>
          </div>
          <div className="kpi-card is-success">
            <div className="kpi-icon"><Sun size={17} /></div>
            <div className="kpi-value">{formatCFACourt(sim.gainDuree)}</div>
            <div className="kpi-label">
              Gagné sur {duree} ans{sim.roiPct != null ? `, soit ${sim.roiPct.toLocaleString('fr-FR')} % du prix payé` : ''}
            </div>
          </div>
          <div className="kpi-card is-info">
            <div className="kpi-icon"><Sprout size={17} /></div>
            <div className="kpi-value">{dec(sim.co2DureeT)} t</div>
            <div className="kpi-label">CO₂ évité · {sim.co2AnKg.toLocaleString('fr-FR')} kg/an</div>
          </div>
        </div>

        <div className="card roi-bloc">
          <div className="sheet-section-title">Ce que ces kWh coûtent aujourd’hui</div>
          {/* Le même kWh, deux prix : pendant une coupure, ce sont les mêmes
              appareils qui tournent, mais c'est le gazole qui les alimente. */}
          <div className="roi-comparaison">
            <div className="roi-comparaison-cote">
              <div className="roi-comparaison-prix">{formatCFA(sim.cout.prixKwhReseau)}</div>
              <div className="roi-comparaison-label">le kWh au réseau</div>
            </div>
            <div className="roi-comparaison-vs">contre</div>
            <div className="roi-comparaison-cote is-cher">
              <div className="roi-comparaison-prix">{groupeActif ? formatCFA(sim.cout.prixKwhGroupe) : '—'}</div>
              <div className="roi-comparaison-label">le kWh au groupe</div>
            </div>
          </div>

          <Ligne label={`Réseau ${operateurPays(pays)}`} detail={`${sim.cout.kwhReseauAn.toLocaleString('fr-FR')} kWh/an`} montant={sim.cout.reseau} />
          {groupeActif && (
            <Ligne label="Groupe électrogène"
                   detail={`${sim.cout.kwhGroupeAn.toLocaleString('fr-FR')} kWh/an, soit ${sim.cout.litresAn.toLocaleString('fr-FR')} L de gazole`}
                   montant={sim.cout.groupe} />
          )}
          <Ligne label="Total payé chaque année" montant={sim.cout.total} fort />
          <Ligne label="Entretien de l’installation" montant={sim.maintenance} negatif />
          <Ligne label="Économie nette la 1re année" montant={sim.economieAn1} fort />
        </div>

        <div className="card roi-bloc">
          <div className="sheet-section-title">Projection sur {duree} ans</div>
          <Projection lignes={sim.projection} investissement={investissement} retourAns={sim.retourAns} />
        </div>

        {/* Ce qui n'est pas saisi mais entre quand même dans le calcul : écrit,
            jamais enfoui dans le code. Un chiffre qu'on ne peut pas justifier
            devant le client ne vaut rien. */}
        <details className="card roi-hypotheses">
          <summary>Ce que le calcul suppose</summary>
          <ul>
            <li>Un groupe électrogène tire environ {KWH_PAR_LITRE_GAZOLE} kWh d’un litre de gazole — c’est ce qui convertit les kWh en litres.</li>
            <li>Les coupures sont réparties sur la journée : {dec(coupures)} h sur 24, soit {Math.round((coupures / 24) * 100)} % des kWh produits par le groupe.</li>
            <li>Le kit étant dimensionné pour ces appareils, il les alimente : l’économie, c’est tout ce qui est payé aujourd’hui pour les faire tourner.</li>
            <li>L’énergie renchérit de {dec(HAUSSE_TARIF_DEFAUT * 100)} %/an ; l’entretien ({formatCFA(sim.maintenance)}/an) suit la même hausse.</li>
            <li>Les panneaux perdent {dec(DEGRADATION_ANNUELLE * 100)} % de rendement par an (garantie constructeur : {DUREE_SYSTEME_ANS} ans).</li>
            <li>Estimation par facture : comme dans l’assistant de devis, la facture est convertie sur des mois de {JOURS_PAR_MOIS} jours et répartie selon « Quand consomme-t-il le plus ? » ({REPARTITIONS.find((r) => r.id === repartition)?.label.toLowerCase()}) — la part de nuit dimensionne la batterie. Le coût annuel, lui, reprend exactement douze factures. Le mode « appareils » garde les heures réelles de chacun.</li>
            <li>Les prix du kWh proposés par pays sont des ordres de grandeur de la tranche domestique, pas des tarifs officiels : c’est la facture du client qui fait foi.</li>
            <li>La projection porte sur {duree} ans — au-delà, l’installation continue d’économiser, mais ce n’est plus compté ici.</li>
            <li>CO₂ : {dec(CO2_PAR_LITRE_GAZOLE, 2)} kg par litre de gazole, {dec(CO2_PAR_KWH_RESEAU, 2)} kg par kWh réseau — ordres de grandeur, pas une mesure.</li>
          </ul>
        </details>
      </div>
    </div>
  );
}
