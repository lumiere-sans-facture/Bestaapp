import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, Plus, Trash2, Sun, Moon, Zap, Gauge, PanelTop, Cpu, Battery, MapPin, Search, FileText, Package } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { formatCFA } from '../../../utils/format';
import { applianceCategories, getApplianceById, CUSTOM_APPLIANCE_ID, newCustomAppliance } from '../../../data/appliances';
import {
  calculateSystemSize, buildKitQuotation, suggestKitsForBattery, designationOnduleur, SYSTEM_TYPES, DEFAULT_PEAK_SUN_HOURS, PANEL_SPEC, INSTALLATION_COST_PER_PANEL, parsePanelWc,
  inverterOptionsFromCatalog, batteryOptionsFromCatalog, brandsOf, suggestInverterFor, limitePv, puissanceSortie, suggestBatteryCombo,
  AUTONOMY_OPTIONS, MOUNTING_TYPES,
} from '../../../utils/solarSizing';
import { factureVersConsommation } from '../../../utils/factureConso';
import { geocodeCity, reverseGeocode, fetchSolarData } from '../../../lib/solarData';
import { computeFactureTotals } from '../../../utils/facture';
import { provisionOnduleurDuDevis, tarifElectriciteParDefaut } from '../../../utils/sizingSheet/compute';
import { coefficientMainOeuvre } from '../../../utils/mainOeuvre';
import { prixPublic } from '../../../utils/price';
import Field from '../../../components/Field';
import ClientIdentityFields, { contactEffectif } from '../../../components/ClientIdentityFields';
import TvaToggle from '../../../components/TvaToggle';
import EditableQuotation, { lignesDepuisDevisKit, lignesModifiables } from '../../../components/EditableQuotation';
import { ConsumptionModePicker, InvoiceConsumptionFields } from '../../../components/SolarConsumptionControls';
import { signalerErreur } from '../../../lib/rapportErreur';
import {
  capturerDimensionnement, restaurerDimensionnement, prochainRowId,
  localisationAvecCoordonnees, donneesSolairesCompletes,
} from '../../../utils/dimensionnement';

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
export default function ProSolarWizard({ onDone, devisAModifier = null }) {
  // La reprise est calculée une seule fois afin que les valeurs restaurées ne
  // viennent jamais écraser les modifications faites pendant cette session.
  const [reprise] = useState(() => {
    const r = restaurerDimensionnement(devisAModifier);
    rowSeq = Math.max(rowSeq, prochainRowId(r.appareils) - 1);
    return r;
  });
  const { user } = useAuth();
  const { products, kits, proClientsForUser, addProClient, addDevis, updateDevis, getCompanyForUser, inverters: onduleursConfigures } = useData();

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

  const [step, setStep] = useState(devisAModifier ? 2 : 1);

  // --- Consommation ---
  const [rows, setRows] = useState(reprise.appareils);
  const [pickerId, setPickerId] = useState('');
  const [consoMode, setConsoMode] = useState(reprise.consoMode);
  const manualMode = consoMode !== 'appareils';
  const [manual, setManual] = useState(reprise.manuel);
  const [facture, setFacture] = useState(reprise.facture);

  // --- Système --- (off-grid par défaut : cas majoritaire sur le terrain)
  const [systemType, setSystemType] = useState(reprise.systemType);
  const [sunHours, setSunHours] = useState(reprise.sunHours);
  // Autonomie batterie : nombre de nuits sans soleil couvertes (1 par défaut).
  const [autonomyNights, setAutonomyNights] = useState(reprise.autonomyNights);
  const [mountingType, setMountingType] = useState(reprise.mountingType);
  const [includeMounting, setIncludeMounting] = useState(reprise.includeMounting);

  // --- Localisation / ensoleillement (PVGIS / NASA) ---
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState(reprise.location); // { name, lat, lon }
  const [solar, setSolar] = useState(reprise.solarSource ? { source: reprise.solarSource } : null); // { peakSunHours, yearlyYield, optimalAngle, source }
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const locationAvecCoords = localisationAvecCoordonnees(location);
  const solaireComplet = donneesSolairesCompletes(solar);

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
  const [proposalMode, setProposalMode] = useState(devisAModifier?.kitId ? 'kit' : ((kits || []).length ? 'kit' : 'custom'));
  const [selectedKitId, setSelectedKitId] = useState(devisAModifier?.kitId || null);
  const [proposalLines, setProposalLines] = useState([]);

  // --- Client / devis ---
  const [clientMode, setClientMode] = useState((devisAModifier?.clientId || myClients.length) ? 'existing' : 'new');
  const [clientId, setClientId] = useState(devisAModifier?.clientId || myClients[0]?.id || '');
  const [newClient, setNewClient] = useState(EMPTY_CLIENT);
  const [tvaActive, setTvaActive] = useState(devisAModifier ? !!devisAModifier.tvaActive : (company?.assujettieVAT || false));

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

  const factureConso = useMemo(
    () => factureVersConsommation(facture.montant, facture.prixKwh, facture.repartition),
    [facture]
  );
  const consumption = useMemo(() => {
    if (consoMode === 'direct') return { day: Number(manual.day) || 0, night: Number(manual.night) || 0 };
    if (consoMode === 'facture') return { day: factureConso.day, night: factureConso.night };
    const day = rows.reduce((s, r) => s + r.power * r.quantity * r.day, 0) / 1000;
    const night = rows.reduce((s, r) => s + r.power * r.quantity * r.night, 0) / 1000;
    return { day: Number(day.toFixed(2)), night: Number(night.toFixed(2)) };
  }, [rows, consoMode, manual, factureConso]);
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

  // Client et lieu du chantier : ils décident du tarif du kWh de la fiche de
  // rentabilité ET du coefficient de main d'œuvre. Déclarés ici, avant les
  // lignes du devis, qui en dépendent maintenant.
  const clientSelectionne = clientMode === 'new'
    ? newClient
    : (myClients.find((c) => c.id === clientId) || {});
  const villeDimensionnement = location?.name || clientSelectionne.ville || '';
  const tarifElecDefaut = tarifElectriciteParDefaut(villeDimensionnement, location?.country || '');
  const coefMainOeuvre = coefficientMainOeuvre({
    ville: villeDimensionnement,
    pays: location?.country || '',
    telephone: clientSelectionne.phone || '',
  });

  const customLines = useMemo(() => {
    if (!sizing || !inverter) return [];
    return [
      { designation: panelName, qty: sizing.numberOfPanels, pu: panelPrice },
      { designation: inverter.model, qty: 1, pu: inverter.price },
      ...batteryList.map((b) => ({ designation: b.model, qty: b.qty, pu: b.price })),
      ...accessoryLines(sizing.numberOfPanels),
      // Main d'œuvre doublée au Togo (utils/mainOeuvre.js) : seule cette
      // ligne bouge, le matériel garde son prix des deux côtés.
      { designation: "Main d'œuvre et installation", qty: 1, pu: sizing.numberOfPanels * INSTALLATION_COST_PER_PANEL * coefMainOeuvre },
    ];
  }, [sizing, inverter, batteryList, panelName, panelPrice, coefMainOeuvre]);

  // Même catalogue de kits et même critère de recommandation que le parcours
  // public : la plus petite capacité batterie suffisante, variantes incluses.
  const suggestedKits = useMemo(
    () => (sizing ? suggestKitsForBattery(kits || [], sizing.batteryCapacity) : []),
    [kits, sizing]
  );
  // Comme dans le parcours public, la sélection est strictement limitée aux
  // variantes de la capacité compatible retenue. Un ancien choix devenu trop
  // petit après modification du besoin ne doit jamais rester sélectionné.
  const effectiveKitId = suggestedKits.some((kit) => kit.id === selectedKitId)
    ? selectedKitId
    : suggestedKits[0]?.id || null;
  const selectedKit = (kits || []).find((kit) => kit.id === effectiveKitId) || null;
  const kitQuotation = useMemo(
    () => (selectedKit
      ? buildKitQuotation(selectedKit, mountingType, includeMounting, sizing, onduleursConfigures || [], products, coefMainOeuvre)
      : null),
    [selectedKit, mountingType, includeMounting, sizing, onduleursConfigures, products, coefMainOeuvre]
  );

  const proposalKey = proposalMode === 'kit'
    ? `kit:${effectiveKitId}:${mountingType}:${includeMounting}:${sizing?.requiredPanelPower || 0}`
    : `custom:${inverter?.id || ''}:${JSON.stringify(batteryQty)}:${sizing?.numberOfPanels || 0}`;
  useEffect(() => {
    if (step !== 4) return;
    setProposalLines(proposalMode === 'kit'
      ? lignesDepuisDevisKit(kitQuotation)
      : lignesModifiables(customLines));
    // `proposalKey` décrit les choix structurants. Une modification manuelle
    // des lignes ne le change pas et n'est donc jamais écrasée par cet effet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, proposalMode, proposalKey]);

  const totals = useMemo(() => computeFactureTotals(proposalLines, tvaActive), [proposalLines, tvaActive]);
  // Provision de remplacement : le prix de l'onduleur RÉELLEMENT au devis,
  // lignes modifiées comprises. Le champ « Provision onduleur » reste
  // prioritaire quand le technicien y saisit un montant.
  const provisionOnduleurDefaut = useMemo(
    () => provisionOnduleurDuDevis(proposalLines), [proposalLines]
  );
  const proposalReady = proposalLines.length > 0 && proposalLines.every((line) => (
    line.designation.trim() && Number(line.qty) > 0 && Number(line.pu) >= 0
  ));

  // Paramètres de rentabilité de la fiche (page 3) — vides = défauts.
  // Le tarif est automatique : 114 F/kWh au Togo, 145 F/kWh au Bénin.
  const [renta, setRenta] = useState({ tarifElec: '', tauxUtilisation: '', maintenanceAnnuelle: '', provisionOnduleur: '', investissement: '' });
  // Production de la fiche PDF : quelques secondes sur un téléphone d'entrée
  // de gamme. Sans cet état, on appuie deux fois et deux onglets s'ouvrent.
  const [ficheEnCours, setFicheEnCours] = useState(false);

  // Fiche de dimensionnement — récapitulatif technique complet, produit en PDF
  // à la dernière étape avec le client et le matériel réellement retenus.
  const openSheet = async () => {
    if (!sizing || ficheEnCours) return;
    // L'onglet est ouvert AVANT tout `await` : passé une opération
    // asynchrone, le navigateur ne rattache plus l'ouverture au clic et la
    // bloque — systématiquement sur iOS. Sans onglet, la fiche est
    // téléchargée (voir ouvrirFichePdf) : elle n'est jamais perdue.
    const onglet = window.open('', '_blank');
    setFicheEnCours(true);
    const { ouvrirFichePdf } = await import('../../../utils/sizingSheet');
    const client = clientMode === 'new' ? newClient : (myClients.find((c) => c.id === clientId) || {});
    const villeFiche = location?.name || client.ville || null;
    const ficheInverter = proposalMode === 'kit'
      ? (kitQuotation?.inverterSuggested || (selectedKit ? { model: `Onduleur du kit ${selectedKit.inverter} kVA`, capacity: selectedKit.inverter } : null))
      : inverter;
    const ficheBatteries = proposalMode === 'kit' && selectedKit
      ? [{ model: `Batterie du kit ${selectedKit.name}`, capacity: selectedKit.battery, qty: 1 }]
      : batteryList;
    await ouvrirFichePdf({
      // La fiche porte l'identité de l'installateur abonné (logo, couleurs,
      // coordonnées), comme ses devis et ses factures.
      company,
      client: { name: client.name || '', phone: client.phone || '', ville: client.ville || '' },
      appliances: rows,
      manualMode,
      consumption,
      systemType,
      sunHours: Number(sunHours) || DEFAULT_PEAK_SUN_HOURS,
      cityName: villeFiche,
      cityCountry: location?.country || '',
      solarSource: solar?.source || null,
      sizing,
      inverter: ficheInverter,
      batteries: ficheBatteries,
      panelName: proposalMode === 'kit' && selectedKit ? `Panneau ${selectedKit.panelW} Wc` : panelName,
      // Rentabilité (page 3) : total du devis par défaut, surchargeable
      // champ par champ dans « Paramètres de rentabilité » ci-dessous.
      investissement: Number(renta.investissement) > 0 ? Number(renta.investissement) : (totals.totalTTC || null),
      rentabilite: {
        ...(Number(renta.tarifElec) > 0 ? { tarifElec: Number(renta.tarifElec) } : {}),
        ...(Number(renta.tauxUtilisation) > 0 ? { tauxUtilisation: Number(renta.tauxUtilisation) } : {}),
        ...(Number(renta.maintenanceAnnuelle) >= 0 && renta.maintenanceAnnuelle !== '' ? { maintenanceAnnuelle: Number(renta.maintenanceAnnuelle) } : {}),
        ...(Number(renta.provisionOnduleur) >= 0 && renta.provisionOnduleur !== ''
          ? { provisionOnduleur: Number(renta.provisionOnduleur) }
          : (provisionOnduleurDefaut != null ? { provisionOnduleur: provisionOnduleurDefaut } : {})),
      },
    }, { onglet }).catch((e) => {
      // L'onglet affiche déjà l'échec ; le journal en garde la trace.
      signalerErreur(e, { origine: 'fiche-dimensionnement', ecran: '/plus/devis-pro' });
    }).finally(() => setFicheEnCours(false));
  };

  const submit = (statut = 'finalise') => {
    if (!sizing || !proposalReady) return;
    let client;
    if (clientMode === 'new') {
      if (!newClient.name.trim()) return;
      client = addProClient({ userId: user.id, name: newClient.name.trim(), contact: contactEffectif(newClient).trim(), phone: newClient.phone.trim(), ville: newClient.ville.trim(), type: newClient.type });
    } else {
      client = myClients.find((c) => c.id === clientId);
      if (!client) return;
    }
    const lignesFinales = proposalLines.map(({ id: _id, ...line }) => line);
    const t = computeFactureTotals(lignesFinales, tvaActive);
    const inverterInfo = proposalMode === 'kit'
      ? (kitQuotation?.inverterSuggested || (selectedKit ? { brand: '', model: `Onduleur du kit ${selectedKit.inverter} kVA`, capacity: selectedKit.inverter } : null))
      : inverter;
    const dimensionnement = capturerDimensionnement({
      consoMode, rows, manual, facture, systemType, autonomyNights,
      mountingType, includeMounting, sunHours: Number(sunHours) || DEFAULT_PEAK_SUN_HOURS,
      location, solar,
    });
    const contenu = {
      type: 'pro',
      leadId: null,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone || '',
      clientVille: client.ville || '',
      lignes: lignesFinales,
      subtotal: t.totalHT,
      tvaActive,
      tva: t.tva,
      total: t.totalTTC,
      statut,
      createdBy: user.id,
      pro: true,
      kitId: proposalMode === 'kit' ? selectedKit?.id || null : null,
      kitName: proposalMode === 'kit' ? selectedKit?.name || null : null,
      consumption,
      dimensionnement,
      sizing: {
        numberOfPanels: proposalMode === 'kit' ? kitQuotation?.panelsIncluded || sizing.numberOfPanels : sizing.numberOfPanels,
        panelCapacity: sizing.panelCapacity,
        inverter: inverterInfo ? { brand: inverterInfo.brand || '', model: inverterInfo.model, capacity: inverterInfo.capacity } : null,
        batteryCapacity: proposalMode === 'kit' ? selectedKit?.battery || sizing.batteryCapacity : totalBatteryCapacity,
        systemType,
        autonomyNights,
        peakSunHours: Number(sunHours) || DEFAULT_PEAK_SUN_HOURS,
        estimatedProduction: sizing.estimatedProduction,
        city: location?.name || null,
        consoMode,
        consumption,
        facture: consoMode === 'facture' ? facture : null,
      },
    };
    if (devisAModifier) updateDevis(devisAModifier.id, contenu);
    else addDevis(contenu);
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
            <div className="wizard-step-title">Estimez la consommation</div>
            <ConsumptionModePicker value={consoMode} onChange={setConsoMode} />

            {consoMode === 'facture' && (
              <InvoiceConsumptionFields facture={facture} onChange={setFacture} result={factureConso} />
            )}

            {consoMode === 'direct' && (
              <div className="manual-consumption-grid">
                <Field label={<><Sun size={14} /> Jour (kWh)</>}>
                  <input className="input" type="number" min="0" step="0.1" value={manual.day} onChange={(e) => setManual({ ...manual, day: e.target.value })} placeholder="0" />
                </Field>
                <Field label={<><Moon size={14} /> Nuit (kWh)</>}>
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
              {consoMode === 'appareils' && (
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
                  {locationAvecCoords && <span className="geo-coords">({Number(location.lat).toFixed(2)}°, {Number(location.lon).toFixed(2)}°)</span>}
                </div>
              )}
              {solaireComplet && (
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

            <div className="client-type-toggle" role="group" aria-label="Source de la proposition" style={{ marginBottom: 16 }}>
              <button type="button" className={`client-type-btn ${proposalMode === 'kit' ? 'active' : ''}`}
                onClick={() => setProposalMode('kit')} disabled={!(kits || []).length}>
                <Package size={15} /> Kits Besta
              </button>
              <button type="button" className={`client-type-btn ${proposalMode === 'custom' ? 'active' : ''}`}
                onClick={() => setProposalMode('custom')}>
                <Cpu size={15} /> Composition pro
              </button>
            </div>

            {proposalMode === 'kit' && (
              <>
                {suggestedKits.length ? (
                  <div className="kit-selector">
                    <div className="kit-selector-title">{suggestedKits.length > 1 ? 'Kits suggérés' : 'Kit suggéré'}</div>
                    <div className="kit-options">
                      {suggestedKits.map((kit) => {
                        const isSelected = kit.id === selectedKit?.id;
                        const quotation = isSelected
                          ? kitQuotation
                          : buildKitQuotation(kit, mountingType, includeMounting, sizing, onduleursConfigures || [], products, coefMainOeuvre);
                        return (
                          <button key={kit.id} type="button" className={`kit-option ${isSelected ? 'selected' : ''}`}
                            onClick={() => setSelectedKitId(kit.id)} aria-pressed={isSelected}>
                            <span className="kit-option-name">
                              {kit.name}<span className="kit-badge">Suggéré</span>
                            </span>
                            <span className="kit-option-meta">{formatCFA(quotation?.total || 0)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">Aucun kit compatible n’est disponible. Utilisez la composition Pro ou ajoutez un kit adapté.</div>
                )}

                {selectedKit && (
                  <div className="kit-summary">
                    <Package size={16} />
                    <span>
                      {selectedKit.name} — {kitQuotation?.panelsIncluded || selectedKit.panels} panneaux {selectedKit.panelW}Wc
                      {(kitQuotation?.panelsIncluded || selectedKit.panels) > selectedKit.panels && ` (complétés depuis ${selectedKit.panels})`}
                      {' '}· batterie {selectedKit.battery} kWh · onduleur{' '}
                      {kitQuotation?.inverterSuggested
                        ? `${kitQuotation.inverterSuggested.quantite > 1 ? `${kitQuotation.inverterSuggested.quantite} × ` : ''}${kitQuotation.inverterSuggested.capacity} kVA ${kitQuotation.inverterSuggested.brand}`
                        : `${selectedKit.inverter} kVA`}
                    </span>
                  </div>
                )}

                {kitQuotation?.inverterSuggested && (
                  <div className="field-hint" role="status" style={{ marginTop: -6, marginBottom: 12 }}>
                    <Cpu size={13} style={{ verticalAlign: -2 }} /> Onduleur adapté automatiquement : celui du kit
                    ({selectedKit.inverter} kVA) ne suffit pas pour ce besoin —{' '}
                    {kitQuotation.inverterSuggested.quantite > 1 && `${kitQuotation.inverterSuggested.quantite} × `}
                    {designationOnduleur(kitQuotation.inverterSuggested)}
                    {kitQuotation.inverterSuggested.quantite > 1 ? ' en parallèle' : ''} retenus à la place.
                  </div>
                )}

                <div className="chip-selector">
                  <span className="chip-selector-label"><PanelTop size={13} /> Type de support</span>
                  <div className="categories-scroll" style={{ marginBottom: 0, opacity: includeMounting ? 1 : 0.5 }}>
                    {MOUNTING_TYPES.map((mounting) => (
                      <button key={mounting.id} type="button" className={`category-chip ${mountingType === mounting.id ? 'active' : ''}`}
                        onClick={() => setMountingType(mounting.id)} disabled={!includeMounting}>
                        {mounting.label}
                      </button>
                    ))}
                  </div>
                  <label className="checkbox-row" style={{ paddingTop: 2 }}>
                    <input type="checkbox" checked={!includeMounting} onChange={(event) => setIncludeMounting(!event.target.checked)} />
                    Ne pas inclure la structure de montage
                  </label>
                </div>
              </>
            )}

            {proposalMode === 'custom' && (
              <>

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
              </>
            )}

            {/* Récapitulatif du devis, dès que l'onduleur est arrêté. */}
            {(proposalMode === 'kit' ? !!selectedKit : !!inverter) && (
              <>
                <EditableQuotation lines={proposalLines} onChange={setProposalLines} products={products} />

                {/* Rentabilité de la fiche : chaque champ vide garde son défaut. */}
                <details className="geo-manual" style={{ marginTop: 12 }}>
                  <summary>Paramètres de rentabilité de la fiche (facultatif)</summary>
                  <div className="form-row-2">
                    <Field label={`Tarif électricité (F CFA/kWh) — défaut : ${tarifElecDefaut} F`}>
                      <input className="input" type="number" min="1" value={renta.tarifElec}
                        onChange={(e) => setRenta({ ...renta, tarifElec: e.target.value })} placeholder={String(tarifElecDefaut)} />
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
                        onChange={(e) => setRenta({ ...renta, provisionOnduleur: e.target.value })}
                        placeholder={provisionOnduleurDefaut != null ? String(provisionOnduleurDefaut) : '320 000'} />
                    </Field>
                  </div>
                  <Field label="Investissement estimé (F CFA)">
                    <input className="input" type="number" min="0" value={renta.investissement}
                      onChange={(e) => setRenta({ ...renta, investissement: e.target.value })}
                      placeholder={`Total du devis (${formatCFA(totals.totalTTC)})`} />
                  </Field>
                </details>

                <button type="button" className="btn btn-outline btn-block" style={{ marginTop: 12 }}
                  onClick={openSheet} disabled={ficheEnCours}>
                  <FileText size={16} /> {ficheEnCours ? 'Préparation de la fiche…' : 'Fiche de dimensionnement (PDF)'}
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
              <button className="btn btn-accent btn-block" onClick={() => submit(devisAModifier?.statut || 'finalise')} disabled={!clientReady || !proposalReady}><Check size={18} /> {devisAModifier ? 'Mettre à jour le devis' : 'Créer le devis'}</button>
              {!devisAModifier && <button className="btn btn-outline" style={{ flex: '0 0 auto' }} onClick={() => submit('brouillon')} disabled={!clientReady || !proposalReady}>Brouillon</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
