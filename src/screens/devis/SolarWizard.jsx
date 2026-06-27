import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, Plus, Trash2, Sun, Moon, Zap, Calculator, PanelTop, MapPin, Search, Package } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { formatCFA } from '../../utils/format';
import { applianceCategories, getApplianceById } from '../../data/appliances';
import { calculateSystemSize, buildKitQuotation, SYSTEM_TYPES, DEFAULT_PEAK_SUN_HOURS } from '../../utils/solarSizing';
import { SOLAR_KITS } from '../../data/kits';
import { geocodeCity, fetchSolarData } from '../../lib/solarData';
import { resolveAutoPartner } from '../../utils/referral';
import PartnerField from './PartnerField';
import Field from '../../components/Field';
import EmptyState from '../../components/EmptyState';

let rowSeq = 0;

export default function SolarWizard({ onDone }) {
  const { user } = useAuth();
  const { addDevis, leadsForUser, partners } = useData();
  const [step, setStep] = useState(1);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [partnerId, setPartnerId] = useState('');
  const [rows, setRows] = useState([]); // appareils sélectionnés
  const [pickerId, setPickerId] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manual, setManual] = useState({ day: '', night: '' });
  const [systemType, setSystemType] = useState('hybrid');
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
        try { await loadSolar({ name: 'Ma position', lat: pos.coords.latitude, lon: pos.coords.longitude }); }
        catch (err) { setGeoError(err.message || 'Données solaires indisponibles.'); }
        finally { setGeoLoading(false); }
      },
      () => { setGeoError('Accès à la position refusé.'); setGeoLoading(false); },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  const myLeads = leadsForUser(user);
  const availableLeads = myLeads.filter((l) => l.stage !== 'gagne' && l.stage !== 'perdu');
  const selectedLead = myLeads.find((l) => l.id === selectedLeadId);

  const addAppliance = () => {
    const tpl = getApplianceById(pickerId);
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

  const sizing = useMemo(
    () => (totalConsumption > 0 ? calculateSystemSize(consumption, systemType, Number(sunHours) || DEFAULT_PEAK_SUN_HOURS) : null),
    [consumption, systemType, sunHours, totalConsumption]
  );

  // Le devis est toujours basé sur un kit préconfiguré : pas de dimensionnement
  // « calculé » proposé. La consommation sert uniquement à suggérer le bon kit.
  const kitQuotations = useMemo(() => Object.fromEntries(SOLAR_KITS.map((k) => [k.id, buildKitQuotation(k)])), []);
  // Kit suggéré : capacité de batterie la plus proche du besoin calculé.
  const suggestedKitId = useMemo(() => {
    if (!sizing) return null;
    const need = sizing.batteryCapacity || 0;
    return [...SOLAR_KITS].sort((a, b) => Math.abs(a.battery - need) - Math.abs(b.battery - need))[0].id;
  }, [sizing]);
  // null = sélection auto (kit suggéré), sinon le kit explicitement choisi.
  const [selectedKitId, setSelectedKitId] = useState(null);
  const effectiveKitId = selectedKitId || suggestedKitId || SOLAR_KITS[0].id;
  const selectedKit = SOLAR_KITS.find((k) => k.id === effectiveKitId) || SOLAR_KITS[0];
  const displayQuotation = kitQuotations[effectiveKitId];

  const handleSubmit = () => {
    const psh = Number(sunHours) || DEFAULT_PEAK_SUN_HOURS;
    const submitSizing = {
      numberOfPanels: selectedKit.panels,
      panelCapacity: (selectedKit.panels * 620) / 1000,
      inverter: { brand: 'Growatt', model: `${selectedKit.inverter} kVA`, capacity: selectedKit.inverter },
      batteries: [],
      batteryCapacity: selectedKit.battery,
      estimatedProduction: Math.round((selectedKit.panels * 620 * psh * 365) / 1000),
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
      <div className="wizard-form card">
        {/* Étape 1 : client */}
        {step === 1 && (
          <div>
            <div className="wizard-step-title">1. Sélectionnez un client</div>
            <div className="lead-select">
              {availableLeads.map((lead) => (
                <button
                  key={lead.id}
                  className={`lead-select-item ${selectedLeadId === lead.id ? 'selected' : ''}`}
                  onClick={() => { setSelectedLeadId(lead.id); setPartnerId(resolveAutoPartner(lead, partners)?.id || ''); }}
                >
                  <div className="lead-select-name">{lead.name}</div>
                  <div className="lead-select-value">{lead.contact} — {formatCFA(lead.estimatedValue)}</div>
                </button>
              ))}
              {availableLeads.length === 0 && <EmptyState>Aucune piste disponible. Créez d’abord une piste dans Suivi clients.</EmptyState>}
            </div>
            {selectedLeadId && <PartnerField value={partnerId} onChange={setPartnerId} />}
          </div>
        )}

        {/* Étape 2 : consommation */}
        {step === 2 && (
          <div>
            <div className="wizard-step-header">
              <div className="wizard-step-title">2. Estimez la consommation</div>
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
                            <div className="appliance-name">{r.name}</div>
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
                <Sun size={16} /><div><div className="consumption-value">{consumption.day.toFixed(2)} kWh</div><div className="consumption-label">Jour</div></div>
              </div>
              <div className="consumption-stat night">
                <Moon size={16} /><div><div className="consumption-value">{consumption.night.toFixed(2)} kWh</div><div className="consumption-label">Nuit</div></div>
              </div>
              <div className="consumption-stat total">
                <Zap size={16} /><div><div className="consumption-value">{totalConsumption.toFixed(2)} kWh</div><div className="consumption-label">Total / jour</div></div>
              </div>
            </div>
          </div>
        )}

        {/* Étape 3 : type de système */}
        {step === 3 && (
          <div>
            <div className="wizard-step-title">3. Type de système</div>
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
          </div>
        )}

        {/* Étape 4 : résultat */}
        {step === 4 && sizing && (
          <div>
            <div className="wizard-step-title">4. Choix du kit et devis</div>

            {/* Sélection d'un kit préconfiguré */}
            <div className="kit-selector">
              <div className="kit-selector-title">Kit préconfiguré</div>
              <div className="kit-options">
                {SOLAR_KITS.map((k) => (
                  <button type="button" key={k.id} className={`kit-option ${effectiveKitId === k.id ? 'selected' : ''}`} onClick={() => setSelectedKitId(k.id)}>
                    <span className="kit-option-name">
                      {k.name}
                      {k.id === suggestedKitId && <span className="kit-badge">Suggéré</span>}
                    </span>
                    <span className="kit-option-meta">{formatCFA(kitQuotations[k.id].total)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="kit-summary">
              <Package size={16} />
              <span>{selectedKit.name} — {selectedKit.panels} panneaux 620Wc · batterie {selectedKit.battery} kWh · onduleur {selectedKit.inverter} kVA</span>
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
                <div className="devis-summary-row credit"><span>TVA (18 %)</span><span>{formatCFA(displayQuotation.tva)}</span></div>
              )}
              <div className="devis-summary-row total"><span>Total TTC</span><span>{formatCFA(displayQuotation.total)}</span></div>
            </div>
            {displayQuotation.roi > 0 && (
              <div className="roi-note">
                <Zap size={14} /> Retour sur investissement estimé : <strong>{displayQuotation.roi.toFixed(1)} mois</strong>
              </div>
            )}
          </div>
        )}

        <div className="wizard-actions">
          {step > 1 && (
            <button className="btn btn-outline btn-block" onClick={() => setStep(step - 1)}>
              <ChevronLeft size={18} /> Précédent
            </button>
          )}
          {step < 4 ? (
            <button className="btn btn-primary btn-block" onClick={() => setStep(step + 1)} disabled={!canNext}>
              Suivant <ChevronRight size={18} />
            </button>
          ) : (
            <button className="btn btn-accent btn-block" onClick={handleSubmit}>
              <Check size={18} /> Créer le devis{selectedLead ? ` pour ${selectedLead.name}` : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
