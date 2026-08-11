import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, Plus, Trash2, Sun, Moon, Zap, Gauge, PanelTop, Cpu, Battery, MapPin, Search, FileText } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { formatCFA } from '../../../utils/format';
import { applianceCategories, getApplianceById, CUSTOM_APPLIANCE_ID, newCustomAppliance } from '../../../data/appliances';
import {
  calculateSystemSize, SYSTEM_TYPES, DEFAULT_PEAK_SUN_HOURS, PANEL_SPEC, INSTALLATION_COST_PER_PANEL, parsePanelWc,
  inverterOptionsFromCatalog, batteryOptionsFromCatalog, brandsOf, suggestInverterFor, limitePv, puissanceSortie, suggestBatteryCombo,
  AUTONOMY_OPTIONS, DEFAULT_AUTONOMY_NIGHTS,
} from '../../../utils/solarSizing';
import { geocodeCity, reverseGeocode, fetchSolarData } from '../../../lib/solarData';
import { computeFactureTotals } from '../../../utils/facture';
import { prixPublic } from '../../../utils/price';
import Field from '../../../components/Field';
import ClientIdentityFields, { contactEffectif } from '../../../components/ClientIdentityFields';
import TvaToggle from '../../../components/TvaToggle';

let rowSeq = 0;
const EMPTY_CLIENT = { name: '', contact: '', phone: '', ville: '', type: 'particulier' };

// Même ordre d'étapes que l'assistant public (client d'abord) : un technicien
// qui utilise les deux modes garde le même parcours.
const STEP_NAMES = ['Client', 'Consommation', 'Système & localisation', 'Matériel & devis'];

// Format fr-FR (virgule décimale), cohérent avec le reste de l'app.
const nbFr = (n, dec = 2) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: dec });

// Accessoires standards ajoutés à tout dimensionnement.
const accessoryLines = (numberOfPanels) => [
  { designation: 'Structure de montage', qty: Math.max(1, Math.round(numberOfPanels / 10)), pu: 120000 },
  { designation: 'Kit de câblage solaire', qty: 1, pu: 45000 },
  { designation: 'Coffret de protection DC/AC', qty: 1, pu: 85000 },
];

/**
 * Dimensionnement Pro guidé : consommation → aperçu → choix de l'onduleur (par
 * marque) → choix des batteries → devis. Les onduleurs, batteries et panneaux
 * proviennent du CATALOGUE BOUTIQUE (marques + prix réels), pas de listes en dur.
 */
export default function ProSolarWizard({ onDone }) {
  const { user } = useAuth();
  const { products, proClientsForUser, addProClient, addDevis, getCompanyForUser, inverters: onduleursConfigures } = useData();

  const myClients = proClientsForUser(user.id);
  const company = getCompanyForUser(user.id);

  // Options matériel issues de la boutique
  const inverterOptions = useMemo(() => inverterOptionsFromCatalog(products), [products]);
  const batteryOptions = useMemo(() => batteryOptionsFromCatalog(products), [products]);
  const brands = useMemo(() => brandsOf(inverterOptions), [inverterOptions]);
  const panelProduct = useMemo(() => products.find((p) => p.category === 'panneaux'), [products]);
  const panelName = panelProduct?.name || `Panneau ${PANEL_SPEC.brand} ${PANEL_SPEC.model} ${PANEL_SPEC.power}W ${PANEL_SPEC.type}`;
  // Prix PUBLIC, jamais le prix technicien sur un devis remis au client.
  const panelPrice = panelProduct ? prixPublic(panelProduct.basePrice) : PANEL_SPEC.price;

  const [step, setStep] = useState(1);

  // --- Consommation ---
  const [rows, setRows] = useState([]);
  const [pickerId, setPickerId] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manual, setManual] = useState({ day: '', night: '' });

  // --- Système --- (off-grid par défaut : cas majoritaire sur le terrain)
  const [systemType, setSystemType] = useState('off-grid');
  const [sunHours, setSunHours] = useState(DEFAULT_PEAK_SUN_HOURS);
  // Autonomie batterie : nombre de nuits sans soleil couvertes (1 par défaut).
  const [autonomyNights, setAutonomyNights] = useState(DEFAULT_AUTONOMY_NIGHTS);

  // --- Localisation / ensoleillement (PVGIS / NASA) ---
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
    try { await loadSolar(await geocodeCity(query.trim())); }
    catch (err) { setGeoError(err.message || 'Données indisponibles — saisie manuelle possible.'); }
    finally { setGeoLoading(false); }
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

  // --- Sélection matériel ---
  const [inverterBrand, setInverterBrand] = useState('');
  const [selectedInverterId, setSelectedInverterId] = useState(null); // null = onduleur conseillé
  const [showAllInverters, setShowAllInverters] = useState(false);
  const [batteryBrand, setBatteryBrand] = useState('');
  const [batteryQty, setBatteryQty] = useState(null); // null = combinaison suggérée à venir

  // --- Client / devis ---
  const [clientMode, setClientMode] = useState(myClients.length ? 'existing' : 'new');
  const [clientId, setClientId] = useState(myClients[0]?.id || '');
  const [newClient, setNewClient] = useState(EMPTY_CLIENT);
  const [tvaActive, setTvaActive] = useState(company?.assujettieVAT || false);

  // Appareil du catalogue, ou appareil personnalisé (tout est saisi à la main).
  const addAppliance = () => {
    const tpl = pickerId === CUSTOM_APPLIANCE_ID ? newCustomAppliance() : getApplianceById(pickerId);
    if (!tpl) return;
    // En TÊTE de liste : la nouvelle ligne apparaît juste sous le sélecteur,
    // sans défilement jusqu'au bas de la liste (même règle que l'assistant public).
    setRows((prev) => [{ rowId: ++rowSeq, ...tpl, quantity: 1 }, ...prev]);
    setPickerId('');
  };
  const updateRow = (rowId, field, value) => setRows((p) => p.map((r) => (r.rowId === rowId ? { ...r, [field]: value } : r)));
  const removeRow = (rowId) => setRows((p) => p.filter((r) => r.rowId !== rowId));

  const consumption = useMemo(() => {
    if (manualMode) return { day: Number(manual.day) || 0, night: Number(manual.night) || 0 };
    const day = rows.reduce((s, r) => s + r.power * r.quantity * r.day, 0) / 1000;
    const night = rows.reduce((s, r) => s + r.power * r.quantity * r.night, 0) / 1000;
    return { day: Number(day.toFixed(2)), night: Number(night.toFixed(2)) };
  }, [rows, manualMode, manual]);
  const totalConsumption = consumption.day + consumption.night;
  // Pic de charge : toutes les charges branchées en même temps (dimensionne l'onduleur).
  const peakLoad = useMemo(() => rows.reduce((s, r) => s + r.power * r.quantity, 0), [rows]);

  // Le devis Pro livre le panneau du catalogue : le nombre de panneaux est
  // calculé sur SA puissance crête réelle, pour que la puissance installée
  // corresponde bien au besoin (la référence 620 Wc ne sert qu'à l'étude).
  const panelWcCatalogue = useMemo(() => parsePanelWc(panelName) || PANEL_SPEC.power, [panelName]);
  const sizing = useMemo(
    () => (totalConsumption > 0
      ? calculateSystemSize(consumption, systemType, Number(sunHours) || DEFAULT_PEAK_SUN_HOURS, panelWcCatalogue, autonomyNights, { peakLoad, inverters: inverterOptions, configures: onduleursConfigures || [] })
      : null),
    [consumption, systemType, sunHours, totalConsumption, panelWcCatalogue, autonomyNights, peakLoad, inverterOptions, onduleursConfigures]
  );

  // Critère de choix de l'onduleur : le PIC de consommation d'abord (il doit
  // le tenir), la puissance PV posée ensuite (limite d'entrée PV des onduleurs
  // configurés dans Plus › Onduleurs, seule source des vraies valeurs).
  const critereOnduleur = useMemo(() => ({
    peakLoad,
    pvPower: sizing?.installedPvPower || 0,
    configures: onduleursConfigures || [],
  }), [peakLoad, sizing, onduleursConfigures]);

  // Nouveau dimensionnement → on repart des sélections conseillées.
  useEffect(() => { setSelectedInverterId(null); setBatteryQty(null); }, [sizing]);

  const brand = inverterBrand || brands[0] || '';
  const brandInverters = useMemo(() => inverterOptions.filter((o) => o.brand === brand), [inverterOptions, brand]);

  // Onduleur effectif : choix explicite, sinon conseillé dans la marque courante.
  const inverter = useMemo(() => {
    if (!sizing) return null;
    if (selectedInverterId) return inverterOptions.find((o) => o.id === selectedInverterId) || null;
    return suggestInverterFor(brandInverters, critereOnduleur);
  }, [sizing, selectedInverterId, brandInverters, inverterOptions, critereOnduleur]);

  // Onduleur conseillé de la marque (badge) + filtrage sur la puissance requise.
  const recommendedInv = useMemo(
    () => (sizing ? suggestInverterFor(brandInverters, critereOnduleur) : null),
    [sizing, brandInverters, critereOnduleur]
  );
  // Convient = tient le pic ET accepte les panneaux posés (limite PV configurée).
  const suitableInverters = useMemo(
    () => brandInverters.filter((i) => puissanceSortie(i) >= (critereOnduleur.peakLoad || critereOnduleur.pvPower) * 1.2
      && (!limitePv(i, critereOnduleur.configures) || limitePv(i, critereOnduleur.configures) >= critereOnduleur.pvPower)),
    [brandInverters, critereOnduleur]
  );
  const shownInverters = (showAllInverters || suitableInverters.length === 0) ? brandInverters : suitableInverters;

  // Batteries : une marque à la fois (réaliste sur le terrain).
  const batteryBrands = useMemo(() => brandsOf(batteryOptions), [batteryOptions]);
  const bBrand = batteryBrand || batteryBrands[0] || '';
  const brandBatteries = useMemo(() => batteryOptions.filter((o) => o.brand === bBrand), [batteryOptions, bBrand]);

  // Semence de la combinaison de batteries (suggestion, dans la marque) à l'étape Matériel.
  useEffect(() => {
    if (step === 4 && sizing && batteryQty === null) {
      setBatteryQty(suggestBatteryCombo(brandBatteries, sizing.batteryCapacity));
    }
  }, [step, sizing, batteryQty, brandBatteries]);

  const batteryList = batteryOptions
    .filter((b) => (batteryQty?.[b.id] || 0) > 0)
    .map((b) => ({ ...b, qty: batteryQty[b.id] }));
  const totalBatteryCapacity = batteryList.reduce((s, b) => s + b.capacity * b.qty, 0);
  const setBattery = (id, qty) => setBatteryQty((m) => ({ ...(m || {}), [id]: Math.max(0, qty) }));

  const lignes = useMemo(() => {
    if (!sizing || !inverter) return [];
    return [
      { designation: panelName, qty: sizing.numberOfPanels, pu: panelPrice },
      { designation: inverter.model, qty: 1, pu: inverter.price },
      ...batteryList.map((b) => ({ designation: b.model, qty: b.qty, pu: b.price })),
      ...accessoryLines(sizing.numberOfPanels),
      { designation: "Main d'œuvre et installation", qty: 1, pu: sizing.numberOfPanels * INSTALLATION_COST_PER_PANEL },
    ];
  }, [sizing, inverter, batteryList, panelName, panelPrice]);

  const totals = useMemo(() => computeFactureTotals(lignes, tvaActive), [lignes, tvaActive]);

  // Paramètres de rentabilité de la fiche (page 3) — vides = défauts
  // (tarif 145 F/kWh, taux 0,85, maintenance 50 000 F/an, provision 320 000 F,
  // investissement = total du devis).
  const [renta, setRenta] = useState({ tarifElec: '', tauxUtilisation: '', maintenanceAnnuelle: '', provisionOnduleur: '', investissement: '' });

  // Fiche de dimensionnement — récapitulatif technique complet (HTML imprimable),
  // généré à la dernière étape avec le client et le matériel réellement retenus.
  const openSheet = async () => {
    if (!sizing) return;
    const { openSizingSheet } = await import('../../../utils/sizingSheet');
    const client = clientMode === 'new' ? newClient : (myClients.find((c) => c.id === clientId) || {});
    openSizingSheet({
      // La fiche porte l'identité de l'installateur abonné (logo, couleurs,
      // coordonnées), comme ses devis et ses factures.
      company,
      client: { name: client.name || '', phone: client.phone || '', ville: client.ville || '' },
      appliances: rows,
      manualMode,
      consumption,
      systemType,
      sunHours: Number(sunHours) || DEFAULT_PEAK_SUN_HOURS,
      cityName: location?.name || client.ville || null,
      solarSource: solar?.source || null,
      sizing,
      inverter,
      batteries: batteryList,
      panelName,
      // Rentabilité (page 3) : total du devis par défaut, surchargeable
      // champ par champ dans « Paramètres de rentabilité » ci-dessous.
      investissement: Number(renta.investissement) > 0 ? Number(renta.investissement) : (totals.totalTTC || null),
      rentabilite: {
        ...(Number(renta.tarifElec) > 0 ? { tarifElec: Number(renta.tarifElec) } : {}),
        ...(Number(renta.tauxUtilisation) > 0 ? { tauxUtilisation: Number(renta.tauxUtilisation) } : {}),
        ...(Number(renta.maintenanceAnnuelle) >= 0 && renta.maintenanceAnnuelle !== '' ? { maintenanceAnnuelle: Number(renta.maintenanceAnnuelle) } : {}),
        ...(Number(renta.provisionOnduleur) >= 0 && renta.provisionOnduleur !== '' ? { provisionOnduleur: Number(renta.provisionOnduleur) } : {}),
      },
    });
  };

  const submit = (statut = 'finalise') => {
    if (!sizing || !inverter || !lignes.length) return;
    let client;
    if (clientMode === 'new') {
      if (!newClient.name.trim()) return;
      client = addProClient({ userId: user.id, name: newClient.name.trim(), contact: contactEffectif(newClient).trim(), phone: newClient.phone.trim(), ville: newClient.ville.trim(), type: newClient.type });
    } else {
      client = myClients.find((c) => c.id === clientId);
      if (!client) return;
    }
    const t = computeFactureTotals(lignes, tvaActive);
    addDevis({
      type: 'pro',
      leadId: null,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone || '',
      clientVille: client.ville || '',
      lignes,
      subtotal: t.totalHT,
      tvaActive,
      tva: t.tva,
      total: t.totalTTC,
      statut,
      createdBy: user.id,
      pro: true,
      sizing: {
        numberOfPanels: sizing.numberOfPanels,
        panelCapacity: sizing.panelCapacity,
        inverter: { brand: inverter.brand, model: inverter.model, capacity: inverter.capacity },
        batteryCapacity: totalBatteryCapacity,
        systemType,
        autonomyNights,
        peakSunHours: Number(sunHours) || DEFAULT_PEAK_SUN_HOURS,
        estimatedProduction: sizing.estimatedProduction,
        city: location?.name || null,
      },
    });
    onDone();
  };

  const clientReady = clientMode === 'new' ? newClient.name.trim() : clientId;
  const canNext =
    (step === 1 && !!clientReady) ||
    (step === 2 && totalConsumption > 0) ||
    step === 3;

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
            <div className="wizard-step-title">Client</div>
            <div className="client-type-toggle" role="group" aria-label="Source du client" style={{ marginBottom: 14 }}>
              <button type="button" className={`client-type-btn ${clientMode === 'existing' ? 'active' : ''}`} onClick={() => setClientMode('existing')} disabled={!myClients.length}>Client existant</button>
              <button type="button" className={`client-type-btn ${clientMode === 'new' ? 'active' : ''}`} onClick={() => setClientMode('new')}><Plus size={15} /> Nouveau client</button>
            </div>
            {clientMode === 'existing' ? (
              <Field label="Choisir un client">
                <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  {!myClients.length && <option value="">Aucun client — créez-en un</option>}
                  {myClients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.ville ? ` — ${c.ville}` : ''}</option>)}
                </select>
              </Field>
            ) : (
              <>
                {/* Identité adaptée au type : une entreprise a un nom ET une
                    personne de contact (le champ manquait ici). */}
                <ClientIdentityFields
                  idPrefix="solar-client"
                  clientType={newClient.type}
                  onTypeChange={(type) => setNewClient({ ...newClient, type })}
                  name={newClient.name}
                  onNameChange={(name) => setNewClient({ ...newClient, name })}
                  contact={newClient.contact}
                  onContactChange={(contact) => setNewClient({ ...newClient, contact })}
                />
                <div className="form-row-2">
                  <Field label="Téléphone"><input className="input" type="tel" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} placeholder="+228 ..." /></Field>
                  <Field label="Ville"><input className="input" value={newClient.ville} onChange={(e) => setNewClient({ ...newClient, ville: e.target.value })} /></Field>
                </div>
                <div className="field-hint" style={{ marginBottom: 8 }}>Ce client sera ajouté à votre carnet.</div>
              </>
            )}
          </div>
        )}

        {/* Étape 2 : consommation */}
        {step === 2 && (
          <div>
            <div className="wizard-step-header">
              <div className="wizard-step-title">Estimez la consommation</div>
              <button className="btn btn-sm btn-outline" onClick={() => setManualMode((m) => !m)}>
                {manualMode ? 'Calculateur' : 'Saisie directe'}
              </button>
            </div>
            {manualMode ? (
              <div className="manual-consumption-grid">
                <Field label={<><Sun size={14} /> Jour (kWh)</>}>
                  <input className="input" type="number" min="0" step="0.1" value={manual.day} onChange={(e) => setManual({ ...manual, day: e.target.value })} placeholder="0" />
                </Field>
                <Field label={<><Moon size={14} /> Nuit (kWh)</>}>
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
                        {cat.items.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.power} W)</option>)}
                      </optgroup>
                    ))}
                  </select>
                  <button className="btn btn-primary" onClick={addAppliance} disabled={!pickerId}><Plus size={16} /> Ajouter</button>
                </div>
                {rows.length ? (
                  <div className="appliance-list">
                    {rows.map((r) => (
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
                          <label className="appliance-field"><span>Quantité</span><input type="number" min="1" value={r.quantity} onChange={(e) => updateRow(r.rowId, 'quantity', Math.max(1, Number(e.target.value)))} /></label>
                          <label className="appliance-field"><span>Puissance (W)</span><input type="number" min="0" value={r.power} onChange={(e) => updateRow(r.rowId, 'power', Number(e.target.value))} /></label>
                          <label className="appliance-field"><span><Sun size={12} /> Heures de jour</span><input type="number" min="0" step="0.5" value={r.day} onChange={(e) => updateRow(r.rowId, 'day', Number(e.target.value))} /></label>
                          <label className="appliance-field"><span><Moon size={12} /> Heures de nuit</span><input type="number" min="0" step="0.5" value={r.night} onChange={(e) => updateRow(r.rowId, 'night', Number(e.target.value))} /></label>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <div className="empty-state">Ajoutez les appareils du client pour estimer ses besoins.</div>}
              </>
            )}
            <div className="consumption-summary">
              <div className="consumption-stat day"><Sun size={16} /><div><div className="consumption-value">{nbFr(consumption.day)}</div><div className="consumption-label">Jour (kWh)</div></div></div>
              <div className="consumption-stat night"><Moon size={16} /><div><div className="consumption-value">{nbFr(consumption.night)}</div><div className="consumption-label">Nuit (kWh)</div></div></div>
              {!manualMode && (
                <div className="consumption-stat peak"><Gauge size={16} /><div><div className="consumption-value">{peakLoad.toLocaleString('fr-FR')}</div><div className="consumption-label">Pic de charge (W)</div></div></div>
              )}
              <div className="consumption-stat total"><Zap size={16} /><div><div className="consumption-value">{nbFr(totalConsumption)}</div><div className="consumption-label">Total / jour (kWh)</div></div></div>
            </div>
          </div>
        )}

        {/* Étape 3 : système + aperçu */}
        {step === 3 && sizing && (
          <div>
            <div className="wizard-step-title">Type de système & localisation</div>
            <div className="payment-options">
              {SYSTEM_TYPES.map((t) => (
                <button key={t.id} className={`payment-option ${systemType === t.id ? 'selected' : ''}`} onClick={() => setSystemType(t.id)}>
                  <div className="payment-option-header"><div className="payment-option-icon"><PanelTop size={18} /></div><div className="payment-option-label">{t.label}</div></div>
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
                <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une ville (ex : Lomé, Kara…)" aria-label="Rechercher une ville" />
                <button type="submit" className="btn btn-outline" disabled={geoLoading} aria-label="Rechercher la ville"><Search size={16} /></button>
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
                    <div className="solar-stat"><div className="solar-stat-value">{solar.peakSunHours}h</div><div className="solar-stat-label">Heures pic / jour (pire mois)</div></div>
                    <div className="solar-stat"><div className="solar-stat-value">{solar.yearlyYield.toLocaleString('fr-FR')}</div><div className="solar-stat-label">kWh/kWc/an</div></div>
                    <div className="solar-stat"><div className="solar-stat-value">{solar.optimalAngle}°</div><div className="solar-stat-label">Angle optimal</div></div>
                  </div>
                </div>
              )}
              <details className="geo-manual">
                <summary>Saisie manuelle (hors-ligne)</summary>
                <Field label="Heures de pic solaire / jour">
                  <input className="input" type="number" min="3" max="7" step="0.1" value={sunHours} onChange={(e) => setSunHours(e.target.value)} aria-label="Heures de pic solaire par jour" />
                </Field>
              </details>
            </div>
            <div className="sizing-grid" style={{ marginTop: 16 }}>
              <div className="sizing-card"><div className="sizing-icon"><PanelTop size={18} /></div><div className="sizing-value">{sizing.numberOfPanels}</div><div className="sizing-label">Panneaux · {sizing.panelCapacity.toFixed(1)} kWc</div></div>
              <div className="sizing-card"><div className="sizing-icon"><Cpu size={18} /></div><div className="sizing-value">{Math.round(sizing.requiredPanelPower)} W</div><div className="sizing-label">Puissance requise</div></div>
              <div className="sizing-card"><div className="sizing-icon"><Battery size={18} /></div><div className="sizing-value">{sizing.batteryCapacity > 0 ? `${sizing.batteryCapacity.toFixed(1)} kWh` : '—'}</div><div className="sizing-label">Batterie conseillée</div></div>
              <div className="sizing-card"><div className="sizing-icon"><Zap size={18} /></div><div className="sizing-value">{Math.round(sizing.estimatedProduction).toLocaleString('fr-FR')}</div><div className="sizing-label">kWh / an</div></div>
            </div>
            <div className="field-hint" role="status">
              Calcul basé sur {Number(sunHours) || DEFAULT_PEAK_SUN_HOURS} h de pic solaire / jour{solar ? ` (${solar.source})` : ' (valeur par défaut — géolocalisez ou saisissez la vôtre ci-dessus)'}.
            </div>
          </div>
        )}

        {/* Étape 4 : matériel (onduleur + batteries) + devis */}
        {step === 4 && sizing && (
          <div>
            <div className="wizard-step-title">Matériel & devis</div>

            {/* --- Onduleur --- */}
            <div className="mat-section-head">
              <span className="mat-section-title"><Cpu size={15} /> Onduleur</span>
              <span className="mat-section-need">Requis : {Math.round(sizing.requiredPanelPower)} W</span>
            </div>
            {brands.length ? (
              <>
                <div className="categories-scroll">
                  {brands.map((b) => (
                    <button key={b} className={`category-chip ${brand === b ? 'active' : ''}`} aria-pressed={brand === b} onClick={() => { setInverterBrand(b); setSelectedInverterId(null); }}>{b}</button>
                  ))}
                </div>
                <div className="kit-options" style={{ marginTop: 12 }}>
                  {shownInverters.map((i) => (
                    <button key={i.id} className={`kit-option ${inverter?.id === i.id ? 'selected' : ''}`} onClick={() => setSelectedInverterId(i.id)}>
                      <span className="kit-option-name">{i.model}{recommendedInv?.id === i.id && <span className="kit-badge">Conseillé</span>}</span>
                      <span className="kit-option-meta">{formatCFA(i.price)}</span>
                    </button>
                  ))}
                </div>
                {suitableInverters.length > 0 && suitableInverters.length < brandInverters.length && !showAllInverters && (
                  <div className="filter-status" role="status" style={{ marginTop: 8 }}>
                    {brandInverters.length - suitableInverters.length} modèle{brandInverters.length - suitableInverters.length > 1 ? 's' : ''} masqué{brandInverters.length - suitableInverters.length > 1 ? 's' : ''} (puissance insuffisante).
                  </div>
                )}
                {suitableInverters.length > 0 && suitableInverters.length < brandInverters.length && (
                  <label className="checkbox-row">
                    <input type="checkbox" checked={showAllInverters} onChange={(e) => setShowAllInverters(e.target.checked)} />
                    Voir aussi les modèles plus petits
                  </label>
                )}
              </>
            ) : <div className="empty-state">Aucun onduleur dans la boutique.</div>}

            {/* --- Batteries --- */}
            <div className="mat-section-head" style={{ marginTop: 18 }}>
              <span className="mat-section-title"><Battery size={15} /> Batteries</span>
              {systemType !== 'on-grid' && (
                <span className={`mat-section-need ${totalBatteryCapacity >= sizing.batteryCapacity ? 'ok' : ''}`}>
                  {nbFr(totalBatteryCapacity, 1)} / {nbFr(sizing.batteryCapacity, 1)} kWh
                  {totalBatteryCapacity >= sizing.batteryCapacity && <Check size={12} style={{ verticalAlign: -2, marginLeft: 3 }} />}
                </span>
              )}
            </div>
            {systemType === 'on-grid' && <div className="field-hint">Raccordé réseau : batteries optionnelles.</div>}
            {batteryBrands.length ? (
              <>
                <div className="categories-scroll">
                  {batteryBrands.map((b) => (
                    <button key={b} className={`category-chip ${bBrand === b ? 'active' : ''}`} aria-pressed={bBrand === b}
                      onClick={() => { setBatteryBrand(b); setBatteryQty(suggestBatteryCombo(batteryOptions.filter((o) => o.brand === b), sizing.batteryCapacity)); }}>{b}</button>
                  ))}
                </div>
                <div className="appliance-list" style={{ marginTop: 12 }}>
                  {brandBatteries.map((b) => {
                    const qty = batteryQty?.[b.id] || 0;
                    return (
                      <div key={b.id} className={`bat-row ${qty > 0 ? 'active' : ''}`}>
                        <div className="bat-row-info">
                          <div className="bat-row-name">{b.model}</div>
                          <div className="bat-row-meta">{b.capacity} kWh · {formatCFA(b.price)}</div>
                        </div>
                        <div className="qty-stepper">
                          <button type="button" className="btn btn-sm btn-outline" onClick={() => setBattery(b.id, qty - 1)}>−</button>
                          <span className="qty-value">{qty}</span>
                          <button type="button" className="btn btn-sm btn-outline" onClick={() => setBattery(b.id, qty + 1)}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button type="button" className="btn btn-sm btn-outline" style={{ marginTop: 10 }}
                  onClick={() => setBatteryQty(suggestBatteryCombo(brandBatteries, sizing.batteryCapacity))}>
                  ↻ Combinaison suggérée
                </button>
              </>
            ) : <div className="empty-state">Aucune batterie dans la boutique.</div>}

            {/* Récapitulatif du devis, dès que l'onduleur est arrêté. */}
            {inverter && (
              <>
                <div className="bom" style={{ marginTop: 18 }}>
                  <div className="bom-title">Équipements & prestations</div>
                  {lignes.map((l, i) => (
                    <div key={i} className="bom-row">
                      <div className="bom-name">{l.designation}{l.qty > 1 ? <span className="bom-qty"> × {l.qty}</span> : ''}</div>
                      <div className="bom-price">{formatCFA(l.qty * l.pu)}</div>
                    </div>
                  ))}
                </div>

                {/* Rentabilité de la fiche : chaque champ vide garde son défaut. */}
                <details className="geo-manual" style={{ marginTop: 12 }}>
                  <summary>Paramètres de rentabilité de la fiche (facultatif)</summary>
                  <div className="form-row-2">
                    <Field label="Tarif électricité (F CFA/kWh)">
                      <input className="input" type="number" min="1" value={renta.tarifElec}
                        onChange={(e) => setRenta({ ...renta, tarifElec: e.target.value })} placeholder="145" />
                    </Field>
                    <Field label="Taux d'utilisation (0–1)">
                      <input className="input" type="number" min="0.1" max="1" step="0.05" value={renta.tauxUtilisation}
                        onChange={(e) => setRenta({ ...renta, tauxUtilisation: e.target.value })} placeholder="0,85" />
                    </Field>
                    <Field label="Maintenance annuelle (F CFA)">
                      <input className="input" type="number" min="0" value={renta.maintenanceAnnuelle}
                        onChange={(e) => setRenta({ ...renta, maintenanceAnnuelle: e.target.value })} placeholder="50 000" />
                    </Field>
                    <Field label="Provision onduleur (F CFA)">
                      <input className="input" type="number" min="0" value={renta.provisionOnduleur}
                        onChange={(e) => setRenta({ ...renta, provisionOnduleur: e.target.value })} placeholder="320 000" />
                    </Field>
                  </div>
                  <Field label="Investissement estimé (F CFA)">
                    <input className="input" type="number" min="0" value={renta.investissement}
                      onChange={(e) => setRenta({ ...renta, investissement: e.target.value })}
                      placeholder={`Total du devis (${formatCFA(totals.totalTTC)})`} />
                  </Field>
                </details>

                <button type="button" className="btn btn-outline btn-block" style={{ marginTop: 12 }} onClick={openSheet}>
                  <FileText size={16} /> Fiche de dimensionnement (imprimable / PDF)
                </button>

                <TvaToggle value={tvaActive} onChange={setTvaActive} />
                <div className="devis-summary">
                  <div className="devis-summary-row"><span>Total HT</span><span>{formatCFA(totals.totalHT)}</span></div>
                  <div className="devis-summary-row"><span>TVA</span><span>{tvaActive ? formatCFA(totals.tva) : 'Exonérée'}</span></div>
                  <div className="devis-summary-row total"><span>Total TTC</span><span>{formatCFA(totals.totalTTC)}</span></div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="wizard-actions">
          {step > 1 && (
            <button className="btn btn-outline" style={{ flex: '0 0 auto' }} onClick={() => setStep(step - 1)} aria-label="Étape précédente">
              <ChevronLeft size={18} />
            </button>
          )}
          {step < 4 ? (
            <button className="btn btn-primary btn-block" onClick={() => setStep(step + 1)} disabled={!canNext}>
              {STEP_NAMES[step]} <ChevronRight size={18} />
            </button>
          ) : (
            <>
              <button className="btn btn-accent btn-block" onClick={() => submit('finalise')} disabled={!clientReady || !inverter || !lignes.length}><Check size={18} /> Créer le devis</button>
              <button className="btn btn-outline" style={{ flex: '0 0 auto' }} onClick={() => submit('brouillon')} disabled={!clientReady || !inverter || !lignes.length}>Brouillon</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
