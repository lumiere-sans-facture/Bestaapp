import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, Plus, Trash2, Sun, Moon, Zap, Gauge, Calculator, PanelTop, Cpu, Battery, MapPin, Search, Package, FileText, Banknote } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { formatCFA } from '../../utils/format';
import { applianceCategories, getApplianceById, CUSTOM_APPLIANCE_ID, newCustomAppliance } from '../../data/appliances';
import { factureVersConsommation, REPARTITIONS } from '../../utils/factureConso';
import { calculateSystemSize, buildKitQuotation, suggestKitsForBattery, designationOnduleur, SYSTEM_TYPES, DEFAULT_PEAK_SUN_HOURS, AUTONOMY_OPTIONS, MOUNTING_TYPES } from '../../utils/solarSizing';
import { geocodeCity, reverseGeocode, fetchSolarData } from '../../lib/solarData';
import { resolveAutoPartner } from '../../utils/referral';
import PartnerField from './PartnerField';
import LeadPicker from './LeadPicker';
import Field from '../../components/Field';
import EmptyState from '../../components/EmptyState';
import { TVA_PCT } from '../../config/company';
import { signalerErreur } from '../../lib/rapportErreur';
import { capturerDimensionnement, restaurerDimensionnement, prochainRowId } from '../../utils/dimensionnement';

let rowSeq = 0;

// Noms des étapes, affichés sous les pastilles de progression.
const STEP_NAMES = ['Client', 'Consommation', 'Type de système', 'Résultat'];

/**
 * @param {object|null} devisAModifier  étude déjà enregistrée, rouverte pour
 *   être ajustée. Le devis est alors MIS À JOUR, jamais dupliqué : le numéro,
 *   l'apporteur et la commission déjà calculée restent attachés au même
 *   document.
 */
export default function SolarWizard({ onDone, initialLeadId = null, devisAModifier = null }) {
  // Lu une seule fois : rejouer la restauration à chaque rendu écraserait ce
  // que le technicien est en train de modifier.
  const [reprise] = useState(() => {
    const r = restaurerDimensionnement(devisAModifier);
    // Le compteur de lignes est global au module : le recaler au-dessus des
    // lignes restaurées évite qu'un appareil ajouté ensuite reprenne le
    // `rowId` d'une ligne existante — les deux se modifieraient ensemble.
    rowSeq = Math.max(rowSeq, prochainRowId(r.appareils) - 1);
    return r;
  });
  const { user } = useAuth();
  // Les kits viennent de l'état : ils se modifient dans « Mes kits », l'assistant
  // reflète immédiatement les prix du gérant sans mise à jour de l'application.
  const { addDevis, updateDevis, leadsForUser, partners, ensurePartnerForUser, kits, inverters, products } = useData();
  const SOLAR_KITS = useMemo(() => kits || [], [kits]);
  const INVERTERS = useMemo(() => inverters || [], [inverters]);
  // Client déjà choisi (fiche client) : l'étape de sélection est sautée.
  const [step, setStep] = useState(initialLeadId || devisAModifier ? 2 : 1);
  const [selectedLeadId, setSelectedLeadId] = useState(devisAModifier?.leadId || initialLeadId);
  const [partnerId, setPartnerId] = useState('');

  // Chaque devis a impérativement un apporteur : le profil partenaire du
  // créateur sert de repli quand la piste n'en a pas — on le crée d'office.
  useEffect(() => {
    ensurePartnerForUser(user);
  }, [user, ensurePartnerForUser]);

  // L'apporteur suit le client sélectionné : parrain de la piste, sinon
  // lien d'affiliation actif, sinon profil partenaire du créateur.
  useEffect(() => {
    if (!selectedLeadId) return;
    const lead = leadsForUser(user).find((l) => l.id === selectedLeadId);
    setPartnerId(lead ? resolveAutoPartner(lead, partners, user.id)?.id || '' : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeadId, partners]);
  const [rows, setRows] = useState(reprise.appareils); // appareils sélectionnés
  // Production de la fiche PDF : quelques secondes sur un téléphone d'entrée
  // de gamme. Sans cet état, on appuie deux fois et deux onglets s'ouvrent.
  const [ficheEnCours, setFicheEnCours] = useState(false);
  const [pickerId, setPickerId] = useState('');
  // Trois façons d'estimer la consommation : liste d'appareils (défaut),
  // saisie directe des kWh, ou FACTURE d'électricité mensuelle en F CFA (CEET
  // au Togo, SBEE au Bénin) — pour le client qui ne connaît pas ses appareils
  // mais sait ce qu'il paie.
  const [consoMode, setConsoMode] = useState(reprise.consoMode);
  const manualMode = consoMode !== 'appareils'; // la fiche technique n'a pas de liste d'appareils
  const [manual, setManual] = useState(reprise.manuel);
  const [facture, setFacture] = useState(reprise.facture);
  // Off-grid par défaut : cas majoritaire sur le terrain.
  const [systemType, setSystemType] = useState(reprise.systemType);
  // Autonomie batterie : nombre de nuits sans soleil couvertes (1 par défaut).
  const [autonomyNights, setAutonomyNights] = useState(reprise.autonomyNights);
  // Type de support des panneaux : tôle par défaut (cas le plus courant).
  const [mountingType, setMountingType] = useState(reprise.mountingType);
  // Inclure ou non la structure de montage au devis (client qui a déjà le sien).
  const [includeMounting, setIncludeMounting] = useState(reprise.includeMounting);
  // Parmi les variantes de même capacité suggérée, le premier kit est sélectionné
  // par défaut ; le technicien peut ensuite retenir l’autre composition.
  const [selectedSuggestedKitId, setSelectedSuggestedKitId] = useState(null);
  // Ensoleillement : récupéré en ligne (PVGIS / NASA POWER) via géolocalisation
  // ou recherche de ville ; repli en saisie manuelle des heures de pic.
  const [sunHours, setSunHours] = useState(reprise.sunHours);
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState(reprise.location); // { name, lat, lon }
  const [solar, setSolar] = useState(reprise.solarSource ? { source: reprise.solarSource } : null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  const loadSolar = async (loc) => {
    setLocation(loc);
    setSolar(null);
    const s = await fetchSolarData(loc.lat, loc.lon);
    setSolar(s);
    setSunHours(s.peakSunHours);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setGeoError('');
    setGeoLoading(true);
    try {
      await loadSolar(await geocodeCity(query.trim()));
    } catch (err) {
      setGeoError(err.message || 'Données indisponibles — saisie manuelle possible.');
    } finally {
      setGeoLoading(false);
    }
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) { setGeoError('Géolocalisation indisponible sur cet appareil.'); return; }
    setGeoError('');
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        // Ville identifiée par géocodage inverse — repli « Ma position » hors-ligne.
        let name = 'Ma position';
        try { name = (await reverseGeocode(lat, lon)) || name; } catch { /* repli */ }
        try { await loadSolar({ name, lat, lon }); }
        catch (err) { setGeoError(err.message || 'Données solaires indisponibles.'); }
        finally { setGeoLoading(false); }
      },
      () => { setGeoError('Accès à la position refusé.'); setGeoLoading(false); },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  // Toute la liste des clients est proposée (un client gagné peut recommander).
  const myLeads = leadsForUser(user);
  const selectedLead = myLeads.find((l) => l.id === selectedLeadId);

  // Appareil du catalogue, ou appareil personnalisé (tout est saisi à la main).
  const addAppliance = () => {
    const tpl = pickerId === CUSTOM_APPLIANCE_ID ? newCustomAppliance() : getApplianceById(pickerId);
    if (!tpl) return;
    // En TÊTE de liste : le sélecteur est en haut de l'écran, la nouvelle
    // ligne apparaît donc juste en dessous, prête à être ajustée — sans avoir
    // à faire défiler jusqu'au bas d'une longue liste d'appareils.
    setRows((prev) => [{ rowId: ++rowSeq, ...tpl, quantity: 1 }, ...prev]);
    setPickerId('');
  };

  const updateRow = (rowId, field, value) =>
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, [field]: value } : r)));

  const removeRow = (rowId) => setRows((prev) => prev.filter((r) => r.rowId !== rowId));

  // Consommation jour/nuit en kWh — selon le mode de saisie choisi.
  const factureConso = useMemo(
    () => factureVersConsommation(facture.montant, facture.prixKwh, facture.repartition),
    [facture]
  );
  const consumption = useMemo(() => {
    if (consoMode === 'direct') return { day: Number(manual.day) || 0, night: Number(manual.night) || 0 };
    if (consoMode === 'facture') return { day: factureConso.day, night: factureConso.night };
    const day = rows.reduce((sum, r) => sum + r.power * r.quantity * r.day, 0) / 1000;
    const night = rows.reduce((sum, r) => sum + r.power * r.quantity * r.night, 0) / 1000;
    return { day: Number(day.toFixed(2)), night: Number(night.toFixed(2)) };
  }, [rows, consoMode, manual, factureConso]);

  const totalConsumption = consumption.day + consumption.night;
  // Pic de charge : toutes les charges branchées en même temps (dimensionne l'onduleur).
  const peakLoad = useMemo(() => rows.reduce((s, r) => s + r.power * r.quantity, 0), [rows]);

  const sizing = useMemo(
    () => (totalConsumption > 0
      ? calculateSystemSize(consumption, systemType, Number(sunHours) || DEFAULT_PEAK_SUN_HOURS, undefined, autonomyNights, { peakLoad, inverters: INVERTERS })
      : null),
    [consumption, systemType, sunHours, totalConsumption, autonomyNights, peakLoad, INVERTERS]
  );

  // Kits suggérés : la plus petite capacité qui couvre le besoin est retenue
  // (jamais moins). Quand plusieurs variantes ont cette même capacité, elles
  // sont toutes affichées afin de laisser le technicien choisir la composition.
  const suggestedKits = useMemo(
    () => (sizing ? suggestKitsForBattery(SOLAR_KITS, sizing.batteryCapacity) : []),
    [sizing, SOLAR_KITS]
  );
  // La liste est modifiable depuis « Mes kits » : elle peut être vide, ou le
  // kit retenu avoir été supprimé entre-temps. Tout est optionnel à partir d'ici.
  const effectiveKitId = (suggestedKits.some((k) => k.id === selectedSuggestedKitId)
    ? selectedSuggestedKitId
    : suggestedKits[0]?.id) || SOLAR_KITS[0]?.id || null;
  const selectedKit = SOLAR_KITS.find((k) => k.id === effectiveKitId) || SOLAR_KITS[0] || null;
  // Le devis est toujours basé sur un kit préconfiguré : pas de dimensionnement
  // « calculé » proposé. La consommation sert uniquement à suggérer le bon kit
  // — dont le nombre de panneaux est ensuite complété si le besoin réel en
  // exige plus (le kit est choisi sur sa batterie, pas sur ses panneaux).
  // La ligne « Structure de montage » varie aussi selon le support choisi —
  // ou disparaît si le client a le sien (includeMounting).
  const displayQuotation = useMemo(
    () => (selectedKit ? buildKitQuotation(selectedKit, mountingType, includeMounting, sizing, INVERTERS, products) : null),
    [selectedKit, mountingType, includeMounting, sizing, INVERTERS, products]
  );
  // Panneaux réellement inclus au devis : ceux du kit, complétés si le besoin
  // calculé en exige plus (kit choisi sur sa batterie, pas ses panneaux).
  const installedPanels = displayQuotation?.panelsIncluded || selectedKit?.panels || 0;

  // Fiche de dimensionnement — étude technique du BESOIN du client.
  // Elle ne reprend rien du kit proposé au devis : nombre de panneaux, calibre
  // d'onduleur, capacité batterie et production sont ceux du calcul, exprimés
  // sur le panneau de référence (PANEL_REFERENCE_WC).
  const openSheet = async () => {
    if (!sizing || ficheEnCours) return;
    // L'onglet est ouvert AVANT tout `await` : passé une opération
    // asynchrone, le navigateur ne rattache plus l'ouverture au clic et la
    // bloque — systématiquement sur iOS. Sans onglet, la fiche est
    // téléchargée (voir ouvrirFichePdf) : elle n'est jamais perdue.
    const onglet = window.open('', '_blank');
    setFicheEnCours(true);
    const { ouvrirFichePdf } = await import('../../utils/sizingSheet');
    const lead = myLeads.find((l) => l.id === selectedLeadId);
    const psh = Number(sunHours) || DEFAULT_PEAK_SUN_HOURS;
    const apporteur = partnerId ? partners.find((p) => p.id === partnerId) : null;
    await ouvrirFichePdf({
      client: { name: lead?.contact || lead?.name || '', phone: lead?.phone || '', ville: lead?.address || '' },
      apporteur: apporteur ? { name: apporteur.name, code: apporteur.code } : null,
      appliances: rows,
      manualMode,
      consumption,
      systemType,
      sunHours: psh,
      cityName: location?.name || lead?.address || null,
      cityCountry: location?.country || '',
      solarSource: solar?.source || null,
      sizing,
      // Seules les grandeurs techniques sont transmises : les marques du
      // catalogue interne (onduleur, batteries) n'apparaissent jamais.
      inverter: { capacity: sizing.inverter.capacity, maxPvPower: sizing.inverter.maxPvPower || null, quantite: sizing.inverterQuantite },
      batteries: sizing.batteries.map((b) => ({ capacity: b.capacity, qty: b.quantity })),
      panelName: `Panneau photovoltaïque ${sizing.panelWc}W`,
      // Rentabilité (page 3) : l'investissement estimé = total du devis kit.
      investissement: displayQuotation?.total || null,
    }, { onglet }).catch((e) => {
      // L'onglet affiche déjà l'échec ; le journal en garde la trace.
      signalerErreur(e, { origine: 'fiche-dimensionnement', ecran: '/devis' });
    }).finally(() => setFicheEnCours(false));
  };

  const handleSubmit = (statut = 'finalise') => {
    if (!selectedKit || !displayQuotation) return; // aucun kit disponible
    const psh = Number(sunHours) || DEFAULT_PEAK_SUN_HOURS;
    // Onduleur réellement retenu : celui du kit, ou celui suggéré en
    // remplacement si le premier ne suffisait pas pour les panneaux calculés.
    const inv = displayQuotation.inverterSuggested;
    const submitSizing = {
      numberOfPanels: installedPanels,
      panelCapacity: (installedPanels * selectedKit.panelW) / 1000,
      inverter: inv
        ? { model: `Onduleur hybride ${inv.capacity}kVA ${inv.brand} ${inv.model}`, capacity: inv.capacity }
        : { model: `Onduleur hybride ${selectedKit.inverter} kVA`, capacity: selectedKit.inverter },
      batteries: [],
      batteryCapacity: selectedKit.battery,
      estimatedProduction: Math.round((installedPanels * selectedKit.panelW * psh * 365) / 1000),
      systemType,
      peakSunHours: psh,
      city: location?.name || null,
      kit: selectedKit.name,
    };
    // L'ÉTUDE elle-même est rangée sur le devis : liste des appareils, mode de
    // saisie, ensoleillement retenu. Sans elle, le devis gardait le résultat
    // sans ce qui l'avait produit — impossible de revenir changer un
    // climatiseur sans tout ressaisir de mémoire.
    const dimensionnement = capturerDimensionnement({
      consoMode, rows, manual, facture, systemType, autonomyNights,
      mountingType, includeMounting, sunHours: psh, location, solar,
    });
    const contenu = {
      consumption,
      sizing: submitSizing,
      kit: { id: selectedKit.id, name: selectedKit.name },
      quotation: displayQuotation,
      total: displayQuotation.total,
      dimensionnement,
    };
    if (devisAModifier) {
      // Mise à jour, jamais duplication : le numéro, l'apporteur, l'étape et
      // la commission déjà calculée restent attachés au même document.
      updateDevis(devisAModifier.id, contenu);
    } else {
      addDevis({
        type: 'solar',
        leadId: selectedLeadId,
        partnerId: partnerId || null,
        statut,
        createdBy: user.id,
        ...contenu,
      });
    }
    onDone();
  };

  const canNext = (step === 1 && selectedLeadId) || (step === 2 && totalConsumption > 0) || step === 3;

  return (
    <div className="wizard">
      <div className="steps-indicator">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={`step-dot ${step >= s ? 'active' : ''} ${step > s ? 'completed' : ''}`} />
        ))}
      </div>
      <div className="steps-label">Étape {step} sur 4 · {STEP_NAMES[step - 1]}</div>
      <div className="wizard-form card">
        {/* Étape 1 : client */}
        {step === 1 && (
          <div>
            <div className="wizard-step-title">Sélectionnez un client</div>
            <LeadPicker leads={myLeads} selectedLeadId={selectedLeadId} onSelect={setSelectedLeadId} />
            {selectedLeadId && <PartnerField value={partnerId} />}
          </div>
        )}

        {/* Étape 2 : consommation */}
        {step === 2 && (
          <div>
            <div className="wizard-step-title">Estimez la consommation</div>
            <div className="categories-scroll" style={{ marginBottom: 12 }}>
              {[['appareils', 'Liste des appareils'], ['facture', 'Facture CEET/SBEE (F CFA)'], ['direct', 'Saisie directe (kWh)']].map(([id, label]) => (
                <button key={id} type="button" className={`category-chip ${consoMode === id ? 'active' : ''}`}
                  aria-pressed={consoMode === id} onClick={() => setConsoMode(id)}>
                  {id === 'facture' ? <Banknote size={13} style={{ verticalAlign: -2, marginRight: 4 }} /> : id === 'direct' ? <Calculator size={13} style={{ verticalAlign: -2, marginRight: 4 }} /> : null}
                  {label}
                </button>
              ))}
            </div>

            {consoMode === 'facture' && (
              <>
                <div className="manual-consumption-grid">
                  <Field label={<><Banknote size={14} /> Facture mensuelle moyenne (F CFA)</>}>
                    <input className="input" type="number" min="0" step="500" value={facture.montant}
                      onChange={(e) => setFacture({ ...facture, montant: e.target.value })} placeholder="Ex : 25 000" />
                  </Field>
                  <Field label="Prix du kWh (F CFA)">
                    <input className="input" type="number" min="1" value={facture.prixKwh}
                      onChange={(e) => setFacture({ ...facture, prixKwh: e.target.value })} />
                  </Field>
                </div>
                <div className="chip-selector">
                  <span className="chip-selector-label"><Sun size={13} /> Quand consomme-t-il le plus ?</span>
                  <div className="categories-scroll" style={{ marginBottom: 0 }}>
                    {REPARTITIONS.map((r) => (
                      <button key={r.id} type="button" className={`category-chip ${facture.repartition === r.id ? 'active' : ''}`}
                        onClick={() => setFacture({ ...facture, repartition: r.id })}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                {factureConso.kwhMois > 0 && (
                  <div className="field-hint" role="status">
                    ≈ {factureConso.kwhMois.toLocaleString('fr-FR')} kWh consommés par mois,
                    soit {(factureConso.day + factureConso.night).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kWh
                    par jour. La part de nuit dimensionne la batterie.
                  </div>
                )}
              </>
            )}

            {consoMode === 'direct' && (
              <div className="manual-consumption-grid">
                <Field label={<><Sun size={14} /> Consommation jour (kWh)</>}>
                  <input className="input" type="number" min="0" step="0.1" value={manual.day} onChange={(e) => setManual({ ...manual, day: e.target.value })} placeholder="0" />
                </Field>
                <Field label={<><Moon size={14} /> Consommation nuit (kWh)</>}>
                  <input className="input" type="number" min="0" step="0.1" value={manual.night} onChange={(e) => setManual({ ...manual, night: e.target.value })} placeholder="0" />
                </Field>
              </div>
            )}

            {consoMode === 'appareils' && (
              <>
                <div className="appliance-picker">
                  <select className="input" value={pickerId} onChange={(e) => setPickerId(e.target.value)}>
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
                  <button className="btn btn-primary" onClick={addAppliance} disabled={!pickerId}>
                    <Plus size={16} /> Ajouter
                  </button>
                </div>

                {rows.length > 0 ? (
                  <div className="appliance-list">
                    {rows.map((r) => {
                      const dayWh = r.power * r.quantity * r.day;
                      const nightWh = r.power * r.quantity * r.night;
                      return (
                        <div key={r.rowId} className="appliance-row">
                          <div className="appliance-row-main">
                            {r.custom ? (
                              <input
                                className="input appliance-name-input"
                                value={r.name}
                                onChange={(e) => updateRow(r.rowId, 'name', e.target.value)}
                                placeholder="Nom de l'appareil (ex : Pompe à eau)"
                                aria-label="Nom de l'appareil"
                              />
                            ) : (
                              <div className="appliance-name">{r.name}</div>
                            )}
                            <button className="appliance-delete" onClick={() => removeRow(r.rowId)} aria-label="Supprimer"><Trash2 size={15} /></button>
                          </div>
                          <div className="appliance-fields">
                            <label className="appliance-field">
                              <span>Qté</span>
                              <input type="number" min="1" value={r.quantity} onChange={(e) => updateRow(r.rowId, 'quantity', Math.max(1, Number(e.target.value)))} />
                            </label>
                            <label className="appliance-field">
                              <span>Puiss. (W)</span>
                              <input type="number" min="0" value={r.power} onChange={(e) => updateRow(r.rowId, 'power', Number(e.target.value))} />
                            </label>
                            <label className="appliance-field">
                              <span><Sun size={12} /> h jour</span>
                              <input type="number" min="0" step="0.5" value={r.day} onChange={(e) => updateRow(r.rowId, 'day', Number(e.target.value))} />
                            </label>
                            <label className="appliance-field">
                              <span><Moon size={12} /> h nuit</span>
                              <input type="number" min="0" step="0.5" value={r.night} onChange={(e) => updateRow(r.rowId, 'night', Number(e.target.value))} />
                            </label>
                          </div>
                          <div className="appliance-row-consumption">
                            <span><Sun size={12} /> {dayWh} Wh</span>
                            <span><Moon size={12} /> {nightWh} Wh</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState>Ajoutez les appareils du client pour estimer ses besoins.</EmptyState>
                )}
              </>
            )}

            <div className="consumption-summary">
              <div className="consumption-stat day">
                <Sun size={16} /><div><div className="consumption-value">{consumption.day.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kWh</div><div className="consumption-label">Jour</div></div>
              </div>
              <div className="consumption-stat night">
                <Moon size={16} /><div><div className="consumption-value">{consumption.night.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kWh</div><div className="consumption-label">Nuit</div></div>
              </div>
              {consoMode === 'appareils' && (
                <div className="consumption-stat peak">
                  <Gauge size={16} /><div><div className="consumption-value">{peakLoad.toLocaleString('fr-FR')} W</div><div className="consumption-label">Pic de charge</div></div>
                </div>
              )}
              <div className="consumption-stat total">
                <Zap size={16} /><div><div className="consumption-value">{totalConsumption.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kWh</div><div className="consumption-label">Total / jour</div></div>
              </div>
            </div>
          </div>
        )}

        {/* Étape 3 : type de système */}
        {step === 3 && (
          <div>
            <div className="wizard-step-title">Type de système</div>
            <div className="payment-options">
              {SYSTEM_TYPES.map((t) => (
                <button key={t.id} className={`payment-option ${systemType === t.id ? 'selected' : ''}`} onClick={() => setSystemType(t.id)}>
                  <div className="payment-option-header">
                    <div className="payment-option-icon"><PanelTop size={18} /></div>
                    <div className="payment-option-label">{t.label}</div>
                  </div>
                  <div className="payment-option-details">{t.help}</div>
                </button>
              ))}
            </div>

            {systemType !== 'on-grid' && (
              <div className="chip-selector">
                <span className="chip-selector-label"><Battery size={13} /> Autonomie batterie</span>
                <div className="categories-scroll" style={{ marginBottom: 0 }}>
                  {AUTONOMY_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={`category-chip ${autonomyNights === o.value ? 'active' : ''}`}
                      onClick={() => setAutonomyNights(o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="geo-locator">
              <div className="geo-locator-head">
                <span className="card-title">Localisation</span>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleGeolocate} disabled={geoLoading}>
                  <MapPin size={15} /> Ma position
                </button>
              </div>
              <form className="geo-search" onSubmit={handleSearch}>
                <input
                  className="input" value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher une ville (ex : Dakar, Abidjan, Bamako…)"
                  aria-label="Rechercher une ville"
                />
                <button type="submit" className="btn btn-outline" disabled={geoLoading} aria-label="Rechercher la ville">
                  <Search size={16} />
                </button>
              </form>

              {geoLoading && <div className="geo-loading">Récupération des données solaires…</div>}
              {geoError && <div className="geo-error">{geoError}</div>}

              {location && (
                <div className="geo-result">
                  <MapPin size={15} />
                  <strong>{location.name}</strong>
                  <span className="geo-coords">({location.lat.toFixed(2)}°, {location.lon.toFixed(2)}°)</span>
                </div>
              )}

              {solar && (
                <div className="solar-card">
                  <div className="solar-card-head">
                    <span className="solar-card-title"><Sun size={15} /> Ensoleillement — {location?.name}</span>
                    <span className="solar-source">Base de données {solar.source}</span>
                  </div>
                  <div className="solar-stats">
                    <div className="solar-stat">
                      <div className="solar-stat-value">{solar.peakSunHours}h</div>
                      <div className="solar-stat-label">Heures pic / jour (pire mois)</div>
                    </div>
                    <div className="solar-stat">
                      <div className="solar-stat-value">{solar.yearlyYield.toLocaleString('fr-FR')}</div>
                      <div className="solar-stat-label">kWh/kWc/an</div>
                    </div>
                    <div className="solar-stat">
                      <div className="solar-stat-value">{solar.optimalAngle}°</div>
                      <div className="solar-stat-label">Angle optimal</div>
                    </div>
                  </div>
                </div>
              )}

              <details className="geo-manual">
                <summary>Saisie manuelle (hors-ligne)</summary>
                <Field label="Heures de pic solaire / jour">
                  <input
                    className="input" type="number" min="3" max="7" step="0.1"
                    value={sunHours} onChange={(e) => setSunHours(e.target.value)}
                    aria-label="Heures de pic solaire par jour"
                  />
                </Field>
              </details>
            </div>

            {/* Résumé des besoins calculés — même bloc que l'espace Pro */}
            {sizing && (
              <div className="sizing-grid" style={{ marginTop: 16 }}>
                <div className="sizing-card">
                  <div className="sizing-icon"><PanelTop size={18} /></div>
                  <div className="sizing-value">{sizing.numberOfPanels}</div>
                  <div className="sizing-label">Panneaux · {sizing.panelCapacity.toFixed(1)} kWc</div>
                </div>
                <div className="sizing-card">
                  <div className="sizing-icon"><Cpu size={18} /></div>
                  <div className="sizing-value">{Math.round(sizing.requiredPanelPower)} W</div>
                  <div className="sizing-label">Puissance requise</div>
                </div>
                <div className="sizing-card">
                  <div className="sizing-icon"><Battery size={18} /></div>
                  <div className="sizing-value">{sizing.batteryCapacity > 0 ? `${sizing.batteryCapacity.toFixed(1)} kWh` : '—'}</div>
                  <div className="sizing-label">Batterie conseillée</div>
                </div>
                <div className="sizing-card">
                  <div className="sizing-icon"><Zap size={18} /></div>
                  <div className="sizing-value">{Math.round(sizing.estimatedProduction).toLocaleString('fr-FR')}</div>
                  <div className="sizing-label">kWh / an</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Étape 4 : résultat */}
        {step === 4 && sizing && !selectedKit && (
          <div>
            <div className="wizard-step-title">Choix du kit et devis</div>
            <EmptyState card>
              Aucun kit n'est disponible. Composez vos kits dans
              <strong> Plus › Mes kits </strong> — l'assistant s'appuie
              uniquement sur eux pour chiffrer un devis.
            </EmptyState>
          </div>
        )}

        {step === 4 && sizing && selectedKit && (
          <div>
            <div className="wizard-step-title">Choix du kit et devis</div>

            {/* Les variantes de même capacité conseillée restent toutes visibles :
                le technicien choisit la marque ou la composition du devis. */}
            <div className="kit-selector">
              <div className="kit-selector-title">{suggestedKits.length > 1 ? 'Kits suggérés' : 'Kit suggéré'}</div>
              <div className="kit-options">
                {suggestedKits.map((kit) => {
                  const isSelected = kit.id === selectedKit.id;
                  const quotation = isSelected
                    ? displayQuotation
                    : buildKitQuotation(kit, mountingType, includeMounting, sizing, INVERTERS, products);
                  return (
                    <button
                      key={kit.id}
                      type="button"
                      className={`kit-option ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedSuggestedKitId(kit.id)}
                      aria-pressed={isSelected}
                    >
                      <span className="kit-option-name">
                        {kit.name}
                        <span className="kit-badge">Suggéré</span>
                      </span>
                      <span className="kit-option-meta">{formatCFA(quotation.total)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="kit-summary">
              <Package size={16} />
              <span>
                {selectedKit.name} — {installedPanels} panneaux {selectedKit.panelW}Wc
                {installedPanels > selectedKit.panels && ` (complétés depuis ${selectedKit.panels})`}
                {' '}· batterie {selectedKit.battery} kWh · onduleur{' '}
                {displayQuotation.inverterSuggested
                  ? `${displayQuotation.inverterSuggested.quantite > 1 ? `${displayQuotation.inverterSuggested.quantite} × ` : ''}${displayQuotation.inverterSuggested.capacity} kVA ${displayQuotation.inverterSuggested.brand}`
                  : `${selectedKit.inverter} kVA`}
              </span>
            </div>
            {displayQuotation.inverterSuggested && (
              <div className="field-hint" role="status" style={{ marginTop: -6, marginBottom: 12 }}>
                <Cpu size={13} style={{ verticalAlign: -2 }} /> Onduleur adapté automatiquement : celui du kit
                ({selectedKit.inverter} kVA) ne suffit pas pour ce besoin —{' '}
                {displayQuotation.inverterSuggested.quantite > 1 && `${displayQuotation.inverterSuggested.quantite} × `}
                {designationOnduleur(displayQuotation.inverterSuggested)}
                {displayQuotation.inverterSuggested.quantite > 1 ? ' en parallèle' : ''} retenus à la place.
              </div>
            )}
            {/* Aucun onduleur configuré ne convient : le dire AVANT le devis,
                sinon un modèle sous-calibré part chez le client. Deux causes
                possibles — la puissance de sortie (pic) et l'entrée PV du MPPT
                — et le message doit désigner celle qui bloque vraiment. */}
            {sizing?.inverterSuffisant === false && (
              <div className="storage-alert abo-alert is-warning" role="alert">
                <div>
                  <Cpu size={13} style={{ verticalAlign: -2 }} /> Aucun onduleur ne convient pour ce besoin :
                  {!sizing.inverterTientPic && (
                    <div style={{ marginTop: 4 }}>
                      • <strong>Puissance de sortie</strong> — le pic de {peakLoad.toLocaleString('fr-FR')} W
                      exige {Math.round(sizing.inverterSortieRequise).toLocaleString('fr-FR')} W
                      (marge +20 %), soit un calibre d’au moins{' '}
                      <strong>{sizing.inverterCalibreRequis} kVA</strong>.
                    </div>
                  )}
                  {!sizing.inverterAcceptePv && (
                    <div style={{ marginTop: 4 }}>
                      • <strong>Entrée PV (MPPT)</strong> — l’installation pose{' '}
                      {Math.round(sizing.installedPvPower).toLocaleString('fr-FR')} Wc de panneaux, alors que
                      l’onduleur retenu n’en accepte que{' '}
                      {Math.round(sizing.inverterPvMax).toLocaleString('fr-FR')} Wc. Il faut un modèle dont
                      la puissance PV max atteint {Math.round(sizing.installedPvPower).toLocaleString('fr-FR')} Wc.
                    </div>
                  )}
                  <div style={{ marginTop: 4 }}>
                    Complétez la liste dans Plus › Onduleurs{!sizing.inverterTientPic && ', ou réduisez les charges simultanées'}.
                  </div>
                </div>
              </div>
            )}

            {/* Structure de montage PV rails galvanisé : le prix suit le
                type de support, calculé au panneau (terrain différent = coût différent).
                Le client qui a déjà son support peut l'exclure du devis. */}
            <div className="chip-selector">
              <span className="chip-selector-label"><PanelTop size={13} /> Type de support</span>
              <div className="categories-scroll" style={{ marginBottom: 0, opacity: includeMounting ? 1 : 0.5 }}>
                {MOUNTING_TYPES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`category-chip ${mountingType === m.id ? 'active' : ''}`}
                    onClick={() => setMountingType(m.id)}
                    disabled={!includeMounting}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <label className="checkbox-row" style={{ paddingTop: 2 }}>
                <input type="checkbox" checked={!includeMounting} onChange={(e) => setIncludeMounting(!e.target.checked)} />
                Client a son propre soudeur — ne pas inclure la structure au devis
              </label>
            </div>

            <div className="bom">
              <div className="bom-title">Équipements</div>
              {displayQuotation.components.map((c, i) => (
                <div key={i} className="bom-row">
                  <div className="bom-name">{c.name}{c.quantity > 1 ? <span className="bom-qty"> × {c.quantity % 1 === 0 ? c.quantity : c.quantity.toFixed(1)}</span> : ''}</div>
                  <div className="bom-price">{formatCFA(c.totalPrice)}</div>
                </div>
              ))}
              <div className="bom-title">Prestations</div>
              {displayQuotation.prestations.map((c, i) => (
                <div key={i} className="bom-row">
                  <div className="bom-name">{c.name}</div>
                  <div className="bom-price">{formatCFA(c.totalPrice)}</div>
                </div>
              ))}
            </div>

            <div className="devis-summary">
              <div className="devis-summary-row"><span>Sous-total HT</span><span>{formatCFA(displayQuotation.subtotalHT)}</span></div>
              {displayQuotation.tva > 0 && (
                <div className="devis-summary-row credit"><span>TVA ({TVA_PCT} %)</span><span>{formatCFA(displayQuotation.tva)}</span></div>
              )}
              <div className="devis-summary-row total"><span>Total TTC</span><span>{formatCFA(displayQuotation.total)}</span></div>
            </div>
            {displayQuotation.roi > 0 && (
              <div className="roi-note">
                <Zap size={14} /> Retour sur investissement estimé : <strong>{displayQuotation.roi.toFixed(1)} mois</strong>
              </div>
            )}

            <button type="button" className="btn btn-outline btn-block" style={{ marginTop: 12 }}
              onClick={openSheet} disabled={ficheEnCours}>
              <FileText size={16} /> {ficheEnCours ? 'Préparation de la fiche…' : 'Fiche de dimensionnement (PDF)'}
            </button>
          </div>
        )}

        <div className="wizard-actions">
          {/* Dernière étape : une seule primaire (Créer le devis) ; retour réduit
              à une flèche et brouillon en action secondaire compacte. */}
          {step > 1 && (step < 4 ? (
            <button className="btn btn-outline btn-block" onClick={() => setStep(step - 1)}>
              <ChevronLeft size={18} /> Précédent
            </button>
          ) : (
            <button className="btn btn-outline" style={{ flex: '0 0 auto' }} onClick={() => setStep(step - 1)} aria-label="Étape précédente">
              <ChevronLeft size={18} />
            </button>
          ))}
          {step < 4 ? (
            <button className="btn btn-primary btn-block" onClick={() => setStep(step + 1)} disabled={!canNext}>
              Suivant <ChevronRight size={18} />
            </button>
          ) : (
            <>
              <button className="btn btn-outline" style={{ flex: '0 0 auto' }} onClick={() => handleSubmit('brouillon')} disabled={!selectedKit}>
                Brouillon
              </button>
              <button className="btn btn-accent btn-block" onClick={() => handleSubmit('finalise')} disabled={!selectedKit}>
                <Check size={18} /> Créer le devis{selectedLead ? ` pour ${selectedLead.name}` : ''}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
