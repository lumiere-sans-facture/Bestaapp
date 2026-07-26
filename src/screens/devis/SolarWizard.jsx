import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, Sun, Moon, Zap, Gauge, Calculator, PanelTop, MapPin, Search, Package, FileText, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { formatCFA } from '../../utils/format';
import { calculateSystemSize, buildKitQuotation, SYSTEM_TYPES, DEFAULT_PEAK_SUN_HOURS } from '../../utils/solarSizing';
import { bilanConsommation } from '../../utils/dimensionnementV2';
import { dimensionnerDepuisWizard } from '../../utils/dimensionnementAdapter';
import AlertesDimensionnement from '../../components/dimensionnement/AlertesDimensionnement';
import { SOLAR_KITS } from '../../data/kits';
import { DEFAULT_SITE_ID } from '../../data/irradiation';
import { geocodeCity, reverseGeocode, fetchSolarData } from '../../lib/solarData';
import { resolveAutoPartner } from '../../utils/referral';
import PartnerField from './PartnerField';
import LeadPicker from './LeadPicker';
import Field from '../../components/Field';
import ChargesTable from '../../components/dimensionnement/ChargesTable';
import ParametresProjet, { PARAMETRES_DEFAUT } from '../../components/dimensionnement/ParametresProjet';

export default function SolarWizard({ onDone, initialLeadId = null }) {
  const { user } = useAuth();
  const { addDevis, leadsForUser, partners, ensurePartnerForUser, products, getIrradiationSiteById } = useData();
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
  // Charges : puissance unitaire, quantité, heures JOUR et NUIT séparées,
  // et drapeau « démarrage moteur / compresseur » (appel au démarrage).
  const [rows, setRows] = useState([]);
  const [manualMode, setManualMode] = useState(false);
  // En saisie directe, la puissance de pointe doit être saisie : c'est elle qui
  // dimensionne l'onduleur (jamais la puissance crête du champ PV).
  const [manual, setManual] = useState({ day: '', night: '', peak: '' });
  // Paramètres de projet du moteur v2 (site, stratégie, autonomie, câblage).
  const [params, setParams] = useState({ ...PARAMETRES_DEFAUT, siteId: DEFAULT_SITE_ID });
  // Off-grid par défaut : cas majoritaire sur le terrain.
  const [systemType, setSystemType] = useState('off-grid');
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

  // Bilan de consommation (moteur v2) : énergies jour / nuit, pointe simultanée
  // et appel au démarrage.
  const bilan = useMemo(
    () => bilanConsommation(rows, { coefficientSimultaneite: params.coefficientSimultaneite }),
    [rows, params.coefficientSimultaneite]
  );

  const consumption = useMemo(() => (
    manualMode
      ? { day: Number(manual.day) || 0, night: Number(manual.night) || 0 }
      : { day: bilan.jourKwh, night: bilan.nuitKwh }
  ), [manualMode, manual, bilan]);

  const totalConsumption = consumption.day + consumption.night;
  // Puissance de pointe simultanée des charges — dimensionne l'onduleur.
  const puissanceSimultanee = manualMode ? Number(manual.peak) || 0 : bilan.puissanceSimultanee;

  // v1 conservé pour la suggestion de kit (capacité batterie ↔ besoin) : le
  // chiffrage kit et les prix restent strictement inchangés.
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

  // --- Dimensionnement v2 : méthodologie corrigée -------------------------
  // Piloté par les charges (onduleur), calé sur le mois le plus défavorable
  // (irradiation) et justifiant l'écart puissance minimale → installée (kit).
  const site = params.siteId ? getIrradiationSiteById(params.siteId) : null;
  const dim = useMemo(() => {
    if (totalConsumption <= 0) return null;
    return dimensionnerDepuisWizard({
      charges: rows,
      params,
      site,
      products,
      hsp: Number(sunHours) || DEFAULT_PEAK_SUN_HOURS,
      kit: selectedKit,
      consommationDirecte: manualMode
        ? { jourKwh: consumption.day, nuitKwh: consumption.night, puissanceSimultanee }
        : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, params, site, products, sunHours, selectedKit, manualMode, consumption.day, consumption.night, puissanceSimultanee, totalConsumption]);

  const alertes = dim?.alertes || [];
  // Une alerte bloquante interdit la génération du devis.
  const devisBloque = Boolean(dim?.bloquant);

  // Fiche technique de dimensionnement (HTML imprimable / PDF).
  // Version client : désignations techniques et quantités, sans aucune marque.
  // Version interne : la même fiche augmentée des marques et références.
  const openSheet = async (interne = false) => {
    const lead = myLeads.find((l) => l.id === selectedLeadId);
    const apporteur = partnerId ? partners.find((p) => p.id === partnerId) : null;
    const client = { name: lead?.contact || lead?.name || '', phone: lead?.phone || '', ville: lead?.address || '' };
    if (!dim) {
      // Repli : dimensionnement v2 indisponible → ancien document (v1).
      const { openSizingSheet } = await import('../../utils/sizingSheetHtml');
      const psh = Number(sunHours) || DEFAULT_PEAK_SUN_HOURS;
      openSizingSheet({
        client,
        apporteur: apporteur ? { name: apporteur.name, code: apporteur.code } : null,
        appliances: bilan.parEquipement.map((e) => ({
          name: e.nom, power: e.puissanceW, quantity: e.quantite, day: e.heuresJour, night: e.heuresNuit,
        })),
        manualMode, consumption, systemType, sunHours: psh,
        cityName: location?.name || lead?.address || null,
        solarSource: solar?.source || null,
        sizing: { ...sizing, numberOfPanels: selectedKit.panels },
        inverter: { capacity: selectedKit.inverter },
        batteries: selectedKit.batteryModules || (selectedKit.battery > 0 ? [{ capacity: selectedKit.battery, qty: 1 }] : []),
        panelName: `Panneau photovoltaïque ${selectedKit.panelW}W`,
      });
      return;
    }
    const { openFicheTechnique } = await import('../../utils/ficheTechniqueHtml');
    const { detectBrand } = await import('../../utils/solarSizing');
    openFicheTechnique({
      dim,
      client,
      apporteur: apporteur ? { name: apporteur.name, code: apporteur.code } : null,
      systemType,
      interne,
      // Version interne : le matériel réel du kit, marques comprises.
      materielDetaille: interne
        ? selectedKit.lines.filter((l) => !l.labor).map((l) => {
            const marque = detectBrand(l.designation);
            return { ref: l.designation, qty: l.qty, unite: l.unit, marque: marque === 'Autre' ? '' : marque };
          })
        : null,
    });
  };

  const handleSubmit = (statut = 'finalise') => {
    const psh = Number(sunHours) || DEFAULT_PEAK_SUN_HOURS;
    const submitSizing = {
      numberOfPanels: selectedKit.panels,
      panelCapacity: (selectedKit.panels * selectedKit.panelW) / 1000,
      inverter: { model: `Onduleur hybride ${selectedKit.inverter} kVA`, capacity: selectedKit.inverter },
      batteries: [],
      batteryCapacity: selectedKit.battery,
      estimatedProduction: Math.round((selectedKit.panels * selectedKit.panelW * psh * 365) / 1000),
      systemType,
      peakSunHours: psh,
      city: location?.name || null,
      kit: selectedKit.name,
      // Traçabilité du moteur : les anciens enregistrements restent en 'v1'.
      moteurVersion: dim ? 'v2' : 'v1',
      entrees: dim ? {
        charges: rows, params, siteId: params.siteId, manualMode,
        consommation: consumption, puissanceSimultanee,
      } : null,
      resultats: dim || null,
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
      <div className="wizard-form card">
        {/* Étape 1 : client */}
        {step === 1 && (
          <div>
            <div className="wizard-step-title">1. Sélectionnez un client</div>
            <LeadPicker leads={myLeads} selectedLeadId={selectedLeadId} onSelect={setSelectedLeadId} />
            {selectedLeadId && <PartnerField value={partnerId} />}
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
                <Field label={<><Gauge size={14} /> Puissance de pointe simultanée (W)</>}>
                  <input className="input" type="number" min="0" step="100" value={manual.peak} onChange={(e) => setManual({ ...manual, peak: e.target.value })} placeholder="0" />
                </Field>
                <div className="param-hint">
                  La puissance de pointe des charges dimensionne l’onduleur : sans elle, le calibre
                  ne peut pas être vérifié.
                </div>
              </div>
            ) : (
              <ChargesTable
                lignes={rows}
                onChange={setRows}
                coefficientSimultaneite={params.coefficientSimultaneite}
              />
            )}

            <AlertesDimensionnement alertes={alertes.filter((a) => a.code === 'repartition-jour-nuit' || a.code === 'aucune-consommation')} compact />

            {manualMode && (
              <div className="consumption-summary">
                <div className="consumption-stat day">
                  <Sun size={16} /><div><div className="consumption-value">{consumption.day.toFixed(2)}</div><div className="consumption-label">Jour kWh</div></div>
                </div>
                <div className="consumption-stat night">
                  <Moon size={16} /><div><div className="consumption-value">{consumption.night.toFixed(2)}</div><div className="consumption-label">Nuit kWh</div></div>
                </div>
                <div className="consumption-stat peak">
                  <Gauge size={16} /><div><div className="consumption-value">{puissanceSimultanee.toLocaleString('fr-FR')}</div><div className="consumption-label">Pointe (W)</div></div>
                </div>
                <div className="consumption-stat total">
                  <Zap size={16} /><div><div className="consumption-value">{totalConsumption.toFixed(2)}</div><div className="consumption-label">Total / jour</div></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Étape 3 : type de système */}
        {step === 3 && (
          <div>
            <div className="wizard-step-title">3. Site, système et paramètres</div>
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

            {/* Paramètres du dimensionnement (moteur v2) */}
            <ParametresProjet valeurs={params} onChange={setParams} consommation={consumption} />
            <AlertesDimensionnement
              alertes={alertes.filter((a) => ['irradiation-absente', 'irradiation-annuelle', 'strategie-moyenne', 'autonomie-journee'].includes(a.code))}
              compact
            />
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
              <span>{selectedKit.name} — {selectedKit.panels} panneaux {selectedKit.panelW}Wc · batterie {selectedKit.battery} kWh · onduleur {selectedKit.inverter} kVA</span>
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

            {/* Alertes du moteur : bloquant (rouge) / important (orange) / info (gris) */}
            <AlertesDimensionnement alertes={alertes} />

            <button type="button" className="btn btn-outline btn-block" style={{ marginTop: 12 }} onClick={() => openSheet(false)}>
              <FileText size={16} /> Fiche de dimensionnement (client)
            </button>
            <button type="button" className="btn btn-outline btn-block" style={{ marginTop: 8 }} onClick={() => openSheet(true)}>
              <Lock size={16} /> Version interne (marques et références)
            </button>
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
            <>
              <button className="btn btn-outline btn-block" onClick={() => handleSubmit('brouillon')}>
                Brouillon
              </button>
              <button
                className="btn btn-accent btn-block"
                onClick={() => handleSubmit('finalise')}
                disabled={devisBloque}
                title={devisBloque ? 'Corrigez les alertes bloquantes avant de générer le devis.' : undefined}
              >
                <Check size={18} /> Créer le devis{selectedLead ? ` pour ${selectedLead.name}` : ''}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
