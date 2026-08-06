import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, Plus, Trash2, Sun, Moon, Zap, Gauge, Calculator, PanelTop, Cpu, Battery, MapPin, Search, Package, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { formatCFA } from '../../utils/format';
import { applianceCategories, getApplianceById, CUSTOM_APPLIANCE_ID, newCustomAppliance } from '../../data/appliances';
import { calculateSystemSize, buildKitQuotation, suggestKitForBattery, SYSTEM_TYPES, DEFAULT_PEAK_SUN_HOURS, AUTONOMY_OPTIONS, DEFAULT_AUTONOMY_NIGHTS, MOUNTING_TYPES, DEFAULT_MOUNTING_TYPE } from '../../utils/solarSizing';
import { geocodeCity, reverseGeocode, fetchSolarData } from '../../lib/solarData';
import { resolveAutoPartner } from '../../utils/referral';
import PartnerField from './PartnerField';
import LeadPicker from './LeadPicker';
import Field from '../../components/Field';
import EmptyState from '../../components/EmptyState';
import { TVA_PCT } from '../../config/company';

let rowSeq = 0;

// Noms des étapes, affichés sous les pastilles de progression.
const STEP_NAMES = ['Client', 'Consommation', 'Type de système', 'Résultat'];

export default function SolarWizard({ onDone, initialLeadId = null }) {
  const { user } = useAuth();
  // Les kits viennent de l'état : ils se modifient dans « Mes kits », l'assistant
  // reflète immédiatement les prix du gérant sans mise à jour de l'application.
  const { addDevis, leadsForUser, partners, ensurePartnerForUser, kits, inverters } = useData();
  const SOLAR_KITS = useMemo(() => kits || [], [kits]);
  const INVERTERS = useMemo(() => inverters || [], [inverters]);
  // Client déjà choisi (fiche client) : l'étape de sélection est sautée.
  const [step, setStep] = useState(initialLeadId ? 2 : 1);
  const [selectedLeadId, setSelectedLeadId] = useState(initialLeadId);
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
  const [rows, setRows] = useState([]); // appareils sélectionnés
  const [pickerId, setPickerId] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manual, setManual] = useState({ day: '', night: '' });
  // Off-grid par défaut : cas majoritaire sur le terrain.
  const [systemType, setSystemType] = useState('off-grid');
  // Autonomie batterie : nombre de nuits sans soleil couvertes (1 par défaut).
  const [autonomyNights, setAutonomyNights] = useState(DEFAULT_AUTONOMY_NIGHTS);
  // Type de support des panneaux : tôle par défaut (cas le plus courant).
  const [mountingType, setMountingType] = useState(DEFAULT_MOUNTING_TYPE);
  // Inclure ou non la structure de montage au devis (client qui a déjà le sien).
  const [includeMounting, setIncludeMounting] = useState(true);
  // Ensoleillement : récupéré en ligne (PVGIS / NASA POWER) via géolocalisation
  // ou recherche de ville ; repli en saisie manuelle des heures de pic.
  const [sunHours, setSunHours] = useState(DEFAULT_PEAK_SUN_HOURS);
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState(null); // { name, lat, lon }
  const [solar, setSolar] = useState(null);        // { peakSunHours, yearlyYield, optimalAngle, source }
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
    setRows((prev) => [...prev, { rowId: ++rowSeq, ...tpl, quantity: 1 }]);
    setPickerId('');
  };

  const updateRow = (rowId, field, value) =>
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, [field]: value } : r)));

  const removeRow = (rowId) => setRows((prev) => prev.filter((r) => r.rowId !== rowId));

  // Consommation jour/nuit en kWh
  const consumption = useMemo(() => {
    if (manualMode) {
      return { day: Number(manual.day) || 0, night: Number(manual.night) || 0 };
    }
    const day = rows.reduce((sum, r) => sum + r.power * r.quantity * r.day, 0) / 1000;
    const night = rows.reduce((sum, r) => sum + r.power * r.quantity * r.night, 0) / 1000;
    return { day: Number(day.toFixed(2)), night: Number(night.toFixed(2)) };
  }, [rows, manualMode, manual]);

  const totalConsumption = consumption.day + consumption.night;
  // Pic de charge : toutes les charges branchées en même temps (dimensionne l'onduleur).
  const peakLoad = useMemo(() => rows.reduce((s, r) => s + r.power * r.quantity, 0), [rows]);

  const sizing = useMemo(
    () => (totalConsumption > 0
      ? calculateSystemSize(consumption, systemType, Number(sunHours) || DEFAULT_PEAK_SUN_HOURS, undefined, autonomyNights)
      : null),
    [consumption, systemType, sunHours, totalConsumption, autonomyNights]
  );

  // Kit suggéré : le plus petit kit dont la batterie COUVRE le besoin calculé
  // (jamais moins — un client sous-équipé se retrouve à sec). C'est toujours
  // ce kit — et lui seul — qui est proposé au devis : pas de choix manuel
  // d'un kit sous- ou sur-dimensionné par rapport au besoin.
  const suggestedKitId = useMemo(
    () => (sizing ? suggestKitForBattery(SOLAR_KITS, sizing.batteryCapacity)?.id || null : null),
    [sizing, SOLAR_KITS]
  );
  // La liste est modifiable depuis « Mes kits » : elle peut être vide, ou le
  // kit retenu avoir été supprimé entre-temps. Tout est optionnel à partir d'ici.
  const effectiveKitId = suggestedKitId || SOLAR_KITS[0]?.id || null;
  const selectedKit = SOLAR_KITS.find((k) => k.id === effectiveKitId) || SOLAR_KITS[0] || null;
  // Le devis est toujours basé sur un kit préconfiguré : pas de dimensionnement
  // « calculé » proposé. La consommation sert uniquement à suggérer le bon kit
  // — dont le nombre de panneaux est ensuite complété si le besoin réel en
  // exige plus (le kit est choisi sur sa batterie, pas sur ses panneaux).
  // La ligne « Structure de montage » varie aussi selon le support choisi —
  // ou disparaît si le client a le sien (includeMounting).
  const displayQuotation = useMemo(
    () => (selectedKit ? buildKitQuotation(selectedKit, mountingType, includeMounting, sizing, INVERTERS) : null),
    [selectedKit, mountingType, includeMounting, sizing, INVERTERS]
  );
  // Panneaux réellement inclus au devis : ceux du kit, complétés si le besoin
  // calculé en exige plus (kit choisi sur sa batterie, pas ses panneaux).
  const installedPanels = displayQuotation?.panelsIncluded || selectedKit?.panels || 0;

  // Fiche de dimensionnement — étude technique du BESOIN du client.
  // Elle ne reprend rien du kit proposé au devis : nombre de panneaux, calibre
  // d'onduleur, capacité batterie et production sont ceux du calcul, exprimés
  // sur le panneau de référence (PANEL_REFERENCE_WC).
  const openSheet = async () => {
    if (!sizing) return;
    const { openSizingSheet } = await import('../../utils/sizingSheetHtml');
    const lead = myLeads.find((l) => l.id === selectedLeadId);
    const psh = Number(sunHours) || DEFAULT_PEAK_SUN_HOURS;
    const apporteur = partnerId ? partners.find((p) => p.id === partnerId) : null;
    openSizingSheet({
      client: { name: lead?.contact || lead?.name || '', phone: lead?.phone || '', ville: lead?.address || '' },
      apporteur: apporteur ? { name: apporteur.name, code: apporteur.code } : null,
      appliances: rows,
      manualMode,
      consumption,
      systemType,
      sunHours: psh,
      cityName: location?.name || lead?.address || null,
      solarSource: solar?.source || null,
      sizing,
      // Seules les grandeurs techniques sont transmises : les marques du
      // catalogue interne (onduleur, batteries) n'apparaissent jamais.
      inverter: { capacity: sizing.inverter.capacity },
      batteries: sizing.batteries.map((b) => ({ capacity: b.capacity, qty: b.quantity })),
      panelName: `Panneau photovoltaïque ${sizing.panelWc}W`,
    });
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
    addDevis({
      type: 'solar',
      leadId: selectedLeadId,
      partnerId: partnerId || null,
      consumption,
      sizing: submitSizing,
      kit: { id: selectedKit.id, name: selectedKit.name },
      quotation: displayQuotation,
      total: displayQuotation.total,
      statut,
      createdBy: user.id,
    });
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
            <div className="wizard-step-header">
              <div className="wizard-step-title">Estimez la consommation</div>
              <button className="btn btn-sm btn-outline" onClick={() => setManualMode((m) => !m)}>
                <Calculator size={15} /> {manualMode ? 'Calculateur' : 'Saisie directe'}
              </button>
            </div>

            {manualMode ? (
              <div className="manual-consumption-grid">
                <Field label={<><Sun size={14} /> Consommation jour (kWh)</>}>
                  <input className="input" type="number" min="0" step="0.1" value={manual.day} onChange={(e) => setManual({ ...manual, day: e.target.value })} placeholder="0" />
                </Field>
                <Field label={<><Moon size={14} /> Consommation nuit (kWh)</>}>
                  <input className="input" type="number" min="0" step="0.1" value={manual.night} onChange={(e) => setManual({ ...manual, night: e.target.value })} placeholder="0" />
                </Field>
              </div>
            ) : (
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
              {!manualMode && (
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
                      <div className="solar-stat-label">Heures pic / jour</div>
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

            {/* Kit suggéré par le dimensionnement : seul celui dont la batterie
                colle le mieux au besoin calculé est proposé, pas de choix
                manuel d'un kit sous- ou sur-dimensionné. */}
            <div className="kit-selector">
              <div className="kit-selector-title">Kit suggéré</div>
              <div className="kit-options">
                <div className="kit-option selected">
                  <span className="kit-option-name">
                    {selectedKit.name}
                    <span className="kit-badge">Suggéré</span>
                  </span>
                  <span className="kit-option-meta">{formatCFA(displayQuotation.total)}</span>
                </div>
              </div>
            </div>

            <div className="kit-summary">
              <Package size={16} />
              <span>
                {selectedKit.name} — {installedPanels} panneaux {selectedKit.panelW}Wc
                {installedPanels > selectedKit.panels && ` (complétés depuis ${selectedKit.panels})`}
                {' '}· batterie {selectedKit.battery} kWh · onduleur{' '}
                {displayQuotation.inverterSuggested
                  ? `${displayQuotation.inverterSuggested.capacity} kVA ${displayQuotation.inverterSuggested.brand}`
                  : `${selectedKit.inverter} kVA`}
              </span>
            </div>
            {displayQuotation.inverterSuggested && (
              <div className="field-hint" role="status" style={{ marginTop: -6, marginBottom: 12 }}>
                <Cpu size={13} style={{ verticalAlign: -2 }} /> Onduleur remplacé automatiquement : celui du kit
                ({selectedKit.inverter} kVA) ne prend pas assez de panneaux pour ce besoin —{' '}
                {displayQuotation.inverterSuggested.capacity} kVA {displayQuotation.inverterSuggested.brand}{' '}
                {displayQuotation.inverterSuggested.model} suggéré à la place.
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

            <button type="button" className="btn btn-outline btn-block" style={{ marginTop: 12 }} onClick={openSheet}>
              <FileText size={16} /> Fiche de dimensionnement (imprimable / PDF)
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
