import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, Plus, Trash2, Sun, Moon, Zap, PanelTop, Cpu, Battery, User, Building2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { formatCFA } from '../../../utils/format';
import { applianceCategories, getApplianceById } from '../../../data/appliances';
import {
  calculateSystemSize, SYSTEM_TYPES, DEFAULT_PEAK_SUN_HOURS,
  INVERTER_MODELS, INVERTER_BRANDS, invertersByBrand, recommendedInverter,
  BATTERY_MODELS, PANEL_SPEC, INSTALLATION_COST_PER_PANEL,
} from '../../../utils/solarSizing';
import { computeFactureTotals } from '../../../utils/facture';
import Field from '../../../components/Field';

let rowSeq = 0;
const EMPTY_CLIENT = { name: '', phone: '', ville: '', type: 'particulier' };

// Accessoires standards ajoutés à tout dimensionnement.
const accessoryLines = (numberOfPanels) => [
  { designation: 'Structure de montage', qty: Math.max(1, Math.round(numberOfPanels / 10)), pu: 120000 },
  { designation: 'Kit de câblage solaire', qty: 1, pu: 45000 },
  { designation: 'Coffret de protection DC/AC', qty: 1, pu: 85000 },
];

/**
 * Dimensionnement Pro guidé : consommation → aperçu → choix de l'onduleur (par
 * marque) → choix des batteries → génération du devis. Inspiré de l'appli
 * besta-solar de référence, adapté à notre moteur (calculateSystemSize) et à
 * notre modèle de devis Pro (lignes éditables + carnet clients).
 */
export default function ProSolarWizard({ onDone }) {
  const { user } = useAuth();
  const { proClientsForUser, addProClient, addDevis, getCompanyForUser } = useData();

  const myClients = proClientsForUser(user.id);
  const company = getCompanyForUser(user.id);

  const [step, setStep] = useState(1);

  // --- Consommation ---
  const [rows, setRows] = useState([]);
  const [pickerId, setPickerId] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manual, setManual] = useState({ day: '', night: '' });

  // --- Système ---
  const [systemType, setSystemType] = useState('hybrid');
  const [sunHours, setSunHours] = useState(DEFAULT_PEAK_SUN_HOURS);

  // --- Sélection matériel ---
  const [inverterBrand, setInverterBrand] = useState(INVERTER_BRANDS[0]);
  const [selectedInverterId, setSelectedInverterId] = useState(null); // null = onduleur conseillé
  const [batteryQty, setBatteryQty] = useState(null); // null = combinaison suggérée à venir

  // --- Client / devis ---
  const [clientMode, setClientMode] = useState(myClients.length ? 'existing' : 'new');
  const [clientId, setClientId] = useState(myClients[0]?.id || '');
  const [newClient, setNewClient] = useState(EMPTY_CLIENT);
  const [tvaActive, setTvaActive] = useState(company?.assujettieVAT || false);

  const addAppliance = () => {
    const tpl = getApplianceById(pickerId);
    if (!tpl) return;
    setRows((prev) => [...prev, { rowId: ++rowSeq, ...tpl, quantity: 1 }]);
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

  const sizing = useMemo(
    () => (totalConsumption > 0 ? calculateSystemSize(consumption, systemType, Number(sunHours) || DEFAULT_PEAK_SUN_HOURS) : null),
    [consumption, systemType, sunHours, totalConsumption]
  );

  // Nouveau dimensionnement → on repart des sélections conseillées.
  useEffect(() => { setSelectedInverterId(null); setBatteryQty(null); }, [sizing]);

  // Onduleur effectif : choix explicite, sinon conseillé dans la marque.
  const inverter = useMemo(() => {
    if (!sizing) return null;
    if (selectedInverterId) return INVERTER_MODELS.find((i) => i.id === selectedInverterId) || null;
    return recommendedInverter(sizing.requiredPanelPower, inverterBrand);
  }, [sizing, selectedInverterId, inverterBrand]);

  // Semence de la combinaison de batteries (suggestion) à l'arrivée sur l'étape.
  useEffect(() => {
    if (step === 4 && sizing && batteryQty === null) {
      const seed = {};
      sizing.batteries.forEach((b) => { seed[b.id] = b.quantity; });
      setBatteryQty(seed);
    }
  }, [step, sizing, batteryQty]);

  const batteryList = BATTERY_MODELS
    .filter((b) => (batteryQty?.[b.id] || 0) > 0)
    .map((b) => ({ ...b, qty: batteryQty[b.id] }));
  const totalBatteryCapacity = batteryList.reduce((s, b) => s + b.capacity * b.qty, 0);
  const setBattery = (id, qty) => setBatteryQty((m) => ({ ...(m || {}), [id]: Math.max(0, qty) }));

  const lignes = useMemo(() => {
    if (!sizing || !inverter) return [];
    return [
      { designation: `Panneau ${PANEL_SPEC.brand} ${PANEL_SPEC.model} ${PANEL_SPEC.power}W ${PANEL_SPEC.type}`, qty: sizing.numberOfPanels, pu: PANEL_SPEC.price },
      { designation: `Onduleur ${inverter.brand} ${inverter.model} (${inverter.capacity} kVA)`, qty: 1, pu: inverter.price },
      ...batteryList.map((b) => ({ designation: `Batterie ${b.brand} ${b.model} (${b.capacity} kWh)`, qty: b.qty, pu: b.price })),
      ...accessoryLines(sizing.numberOfPanels),
      { designation: "Main d'œuvre et installation", qty: 1, pu: sizing.numberOfPanels * INSTALLATION_COST_PER_PANEL },
    ];
  }, [sizing, inverter, batteryList]);

  const totals = useMemo(() => computeFactureTotals(lignes, tvaActive), [lignes, tvaActive]);

  const submit = () => {
    if (!sizing || !inverter || !lignes.length) return;
    let client;
    if (clientMode === 'new') {
      if (!newClient.name.trim()) return;
      client = addProClient({ userId: user.id, name: newClient.name.trim(), phone: newClient.phone.trim(), ville: newClient.ville.trim(), type: newClient.type });
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
      createdBy: user.id,
      pro: true,
      sizing: {
        numberOfPanels: sizing.numberOfPanels,
        panelCapacity: sizing.panelCapacity,
        inverter: { brand: inverter.brand, model: inverter.model, capacity: inverter.capacity },
        batteryCapacity: totalBatteryCapacity,
        systemType,
        peakSunHours: Number(sunHours) || DEFAULT_PEAK_SUN_HOURS,
        estimatedProduction: sizing.estimatedProduction,
      },
    });
    onDone();
  };

  const canNext =
    (step === 1 && totalConsumption > 0) ||
    step === 2 ||
    (step === 3 && !!inverter) ||
    step === 4;
  const clientReady = clientMode === 'new' ? newClient.name.trim() : clientId;

  return (
    <div className="wizard">
      <div className="steps-indicator">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className={`step-dot ${step >= s ? 'active' : ''} ${step > s ? 'completed' : ''}`} />
        ))}
      </div>
      <div className="wizard-form card">
        {/* Étape 1 : consommation */}
        {step === 1 && (
          <div>
            <div className="wizard-step-header">
              <div className="wizard-step-title">1. Consommation</div>
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
                          <div className="appliance-name">{r.name}</div>
                          <button className="appliance-delete" onClick={() => removeRow(r.rowId)} aria-label="Supprimer"><Trash2 size={15} /></button>
                        </div>
                        <div className="appliance-fields">
                          <label className="appliance-field"><span>Qté</span><input type="number" min="1" value={r.quantity} onChange={(e) => updateRow(r.rowId, 'quantity', Math.max(1, Number(e.target.value)))} /></label>
                          <label className="appliance-field"><span>Puiss. (W)</span><input type="number" min="0" value={r.power} onChange={(e) => updateRow(r.rowId, 'power', Number(e.target.value))} /></label>
                          <label className="appliance-field"><span><Sun size={12} /> h jour</span><input type="number" min="0" step="0.5" value={r.day} onChange={(e) => updateRow(r.rowId, 'day', Number(e.target.value))} /></label>
                          <label className="appliance-field"><span><Moon size={12} /> h nuit</span><input type="number" min="0" step="0.5" value={r.night} onChange={(e) => updateRow(r.rowId, 'night', Number(e.target.value))} /></label>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <div className="empty-state">Ajoutez les appareils du client pour estimer ses besoins.</div>}
              </>
            )}
            <div className="consumption-summary">
              <div className="consumption-stat day"><Sun size={16} /><div><div className="consumption-value">{consumption.day.toFixed(2)}</div><div className="consumption-label">Jour kWh</div></div></div>
              <div className="consumption-stat night"><Moon size={16} /><div><div className="consumption-value">{consumption.night.toFixed(2)}</div><div className="consumption-label">Nuit kWh</div></div></div>
              <div className="consumption-stat total"><Zap size={16} /><div><div className="consumption-value">{totalConsumption.toFixed(2)}</div><div className="consumption-label">Total / jour</div></div></div>
            </div>
          </div>
        )}

        {/* Étape 2 : système + aperçu */}
        {step === 2 && sizing && (
          <div>
            <div className="wizard-step-title">2. Système & aperçu</div>
            <div className="payment-options">
              {SYSTEM_TYPES.map((t) => (
                <button key={t.id} className={`payment-option ${systemType === t.id ? 'selected' : ''}`} onClick={() => setSystemType(t.id)}>
                  <div className="payment-option-header"><div className="payment-option-icon"><PanelTop size={18} /></div><div className="payment-option-label">{t.label}</div></div>
                  <div className="payment-option-details">{t.help}</div>
                </button>
              ))}
            </div>
            <Field label="Heures de pic solaire / jour"><input className="input" type="number" min="3" max="7" step="0.1" value={sunHours} onChange={(e) => setSunHours(e.target.value)} /></Field>
            <div className="sizing-grid" style={{ marginTop: 16 }}>
              <div className="sizing-card"><div className="sizing-icon"><PanelTop size={18} /></div><div className="sizing-value">{sizing.numberOfPanels}</div><div className="sizing-label">Panneaux · {sizing.panelCapacity.toFixed(1)} kWc</div></div>
              <div className="sizing-card"><div className="sizing-icon"><Cpu size={18} /></div><div className="sizing-value">{Math.round(sizing.requiredPanelPower)} W</div><div className="sizing-label">Puissance requise</div></div>
              <div className="sizing-card"><div className="sizing-icon"><Battery size={18} /></div><div className="sizing-value">{sizing.batteryCapacity > 0 ? `${sizing.batteryCapacity.toFixed(1)} kWh` : '—'}</div><div className="sizing-label">Batterie conseillée</div></div>
              <div className="sizing-card"><div className="sizing-icon"><Zap size={18} /></div><div className="sizing-value">{Math.round(sizing.estimatedProduction).toLocaleString('fr-FR')}</div><div className="sizing-label">kWh / an</div></div>
            </div>
          </div>
        )}

        {/* Étape 3 : onduleur par marque */}
        {step === 3 && sizing && (
          <div>
            <div className="wizard-step-title">3. Onduleur</div>
            <div className="categories-scroll">
              {INVERTER_BRANDS.map((b) => (
                <button key={b} className={`category-chip ${inverterBrand === b ? 'active' : ''}`} onClick={() => { setInverterBrand(b); setSelectedInverterId(null); }}>{b}</button>
              ))}
            </div>
            <div className="kit-options" style={{ marginTop: 12 }}>
              {invertersByBrand(inverterBrand).map((i) => {
                const suffisant = i.maxPower >= sizing.requiredPanelPower * 1.2;
                return (
                  <button key={i.id} className={`kit-option ${inverter?.id === i.id ? 'selected' : ''}`} onClick={() => setSelectedInverterId(i.id)}>
                    <span className="kit-option-name">{i.model} · {i.capacity} kVA{suffisant && <span className="kit-badge">OK</span>}</span>
                    <span className="kit-option-meta">{formatCFA(i.price)}</span>
                  </button>
                );
              })}
            </div>
            {inverter && <div className="field-hint" style={{ marginTop: 10 }}>Sélection : {inverter.brand} {inverter.model} ({inverter.capacity} kVA) · rendement {inverter.efficiency} %</div>}
          </div>
        )}

        {/* Étape 4 : batteries */}
        {step === 4 && sizing && (
          <div>
            <div className="wizard-step-title">4. Batteries</div>
            {systemType === 'on-grid' ? (
              <div className="field-hint">Système raccordé réseau : aucune batterie nécessaire. Vous pouvez tout de même en ajouter ci-dessous.</div>
            ) : (
              <div className="field-hint">Besoin estimé : <strong>{sizing.batteryCapacity.toFixed(1)} kWh</strong> — combinaison sélectionnée : <strong>{totalBatteryCapacity.toFixed(1)} kWh</strong></div>
            )}
            <div className="appliance-list" style={{ marginTop: 12 }}>
              {BATTERY_MODELS.map((b) => {
                const qty = batteryQty?.[b.id] || 0;
                return (
                  <div key={b.id} className="appliance-row">
                    <div className="appliance-row-main">
                      <div className="appliance-name">{b.model} · {b.capacity} kWh <span className="text-secondary">({b.brand})</span></div>
                      <div className="qty-stepper">
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => setBattery(b.id, qty - 1)}>−</button>
                        <span className="qty-value">{qty}</span>
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => setBattery(b.id, qty + 1)}>+</button>
                      </div>
                    </div>
                    <div className="appliance-row-consumption"><span>{formatCFA(b.price)} / unité{qty > 0 ? ` · ${formatCFA(b.price * qty)}` : ''}</span></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Étape 5 : client + devis */}
        {step === 5 && sizing && inverter && (
          <div>
            <div className="wizard-step-title">5. Client & devis</div>
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
                <Field label="Nom du client *"><input className="input" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} placeholder="Nom / raison sociale" /></Field>
                <div className="client-type-toggle" role="group" aria-label="Type de client" style={{ marginBottom: 14 }}>
                  <button type="button" className={`client-type-btn ${newClient.type === 'particulier' ? 'active' : ''}`} onClick={() => setNewClient({ ...newClient, type: 'particulier' })}><User size={16} /> Particulier</button>
                  <button type="button" className={`client-type-btn ${newClient.type === 'entreprise' ? 'active' : ''}`} onClick={() => setNewClient({ ...newClient, type: 'entreprise' })}><Building2 size={16} /> Entreprise</button>
                </div>
                <div className="form-row-2">
                  <Field label="Téléphone"><input className="input" type="tel" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} placeholder="+229 ..." /></Field>
                  <Field label="Ville"><input className="input" value={newClient.ville} onChange={(e) => setNewClient({ ...newClient, ville: e.target.value })} /></Field>
                </div>
              </>
            )}

            <div className="bom" style={{ marginTop: 8 }}>
              <div className="bom-title">Équipements & prestations</div>
              {lignes.map((l, i) => (
                <div key={i} className="bom-row">
                  <div className="bom-name">{l.designation}{l.qty > 1 ? <span className="bom-qty"> × {l.qty}</span> : ''}</div>
                  <div className="bom-price">{formatCFA(l.qty * l.pu)}</div>
                </div>
              ))}
            </div>

            <label className="pro-tva-toggle">
              <input type="checkbox" checked={tvaActive} onChange={(e) => setTvaActive(e.target.checked)} />
              Appliquer la TVA 18 % <span className="text-secondary">(exonérée par défaut sur le solaire)</span>
            </label>
            <div className="devis-summary">
              <div className="devis-summary-row"><span>Total HT</span><span>{formatCFA(totals.totalHT)}</span></div>
              <div className="devis-summary-row"><span>TVA</span><span>{tvaActive ? formatCFA(totals.tva) : 'Exonérée'}</span></div>
              <div className="devis-summary-row total"><span>Total TTC</span><span>{formatCFA(totals.totalTTC)}</span></div>
            </div>
          </div>
        )}

        <div className="wizard-actions">
          {step > 1 && <button className="btn btn-outline btn-block" onClick={() => setStep(step - 1)}><ChevronLeft size={18} /> Précédent</button>}
          {step < 5 ? (
            <button className="btn btn-primary btn-block" onClick={() => setStep(step + 1)} disabled={!canNext}>Suivant <ChevronRight size={18} /></button>
          ) : (
            <button className="btn btn-accent btn-block" onClick={submit} disabled={!clientReady || !lignes.length}><Check size={18} /> Créer le devis</button>
          )}
        </div>
      </div>
    </div>
  );
}
