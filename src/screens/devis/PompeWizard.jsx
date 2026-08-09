import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check, Droplets, Waves, ArrowDown, Building, Gauge, Package } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { formatCFA } from '../../utils/format';
import {
  SOURCES_EAU, HEURES_POMPAGE, debitRequis, hmtEstimee, suggestPompeKit, buildPompeQuotation,
} from '../../utils/pompeSizing';
import { resolveAutoPartner } from '../../utils/referral';
import PartnerField from './PartnerField';
import LeadPicker from './LeadPicker';
import Field from '../../components/Field';
import EmptyState from '../../components/EmptyState';

const STEP_NAMES = ['Client', 'Besoin en eau', 'Kit et devis'];

/**
 * Dimensionnement d'un POMPAGE SOLAIRE : besoin en eau (volume quotidien,
 * profondeur, réservoir) → kit pompe suggéré → devis chiffré. Même parcours
 * que l'assistant solaire (client d'abord), mêmes règles (apporteur suivi).
 */
export default function PompeWizard({ onDone, initialLeadId = null }) {
  const { user } = useAuth();
  // Les kits viennent de l'état : ils se modifient dans « Kits pompage »,
  // l'assistant reflète immédiatement les réglages du gérant.
  const { addDevis, leadsForUser, partners, ensurePartnerForUser, pompeKits } = useData();
  const kitsDisponibles = pompeKits || [];

  const [step, setStep] = useState(initialLeadId ? 2 : 1);
  const [selectedLeadId, setSelectedLeadId] = useState(initialLeadId);
  const [partnerId, setPartnerId] = useState('');

  // Chaque devis a impérativement un apporteur (repli : profil du créateur).
  useEffect(() => {
    ensurePartnerForUser(user);
  }, [user, ensurePartnerForUser]);
  useEffect(() => {
    if (!selectedLeadId) return;
    const lead = leadsForUser(user).find((l) => l.id === selectedLeadId);
    setPartnerId(lead ? resolveAutoPartner(lead, partners, user.id)?.id || '' : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeadId, partners]);

  const myLeads = leadsForUser(user);
  const selectedLead = myLeads.find((l) => l.id === selectedLeadId);

  // --- Besoin en eau ---
  const [source, setSource] = useState('forage');
  const [volumeJour, setVolumeJour] = useState('');       // m³ / jour
  const [profondeur, setProfondeur] = useState('');       // m (niveau de l'eau)
  const [hauteurReservoir, setHauteurReservoir] = useState(''); // m (château d'eau)
  // HMT : estimée depuis les mesures, mais corrigeable par le technicien
  // (il peut connaître la vraie valeur du forage).
  const [hmtManuelle, setHmtManuelle] = useState('');

  const hmtCalculee = hmtEstimee({ profondeur, hauteurReservoir });
  const hmt = Number(hmtManuelle) > 0 ? Number(hmtManuelle) : hmtCalculee;
  const debit = debitRequis(volumeJour);

  const kit = useMemo(
    () => suggestPompeKit(kitsDisponibles, { volumeJour, hmt }),
    [kitsDisponibles, volumeJour, hmt]
  );
  const quotation = useMemo(
    () => (kit ? buildPompeQuotation(kit, { profondeur }) : null),
    [kit, profondeur]
  );

  const handleSubmit = (statut = 'finalise') => {
    if (!kit || !quotation) return;
    addDevis({
      // Type 'solar' + quotation : l'affichage, les filtres et le PDF des
      // devis solaires fonctionnent tels quels pour le pompage.
      type: 'solar',
      sousType: 'pompage',
      leadId: selectedLeadId,
      partnerId: partnerId || null,
      pompage: {
        source, volumeJour: Number(volumeJour) || 0, hmt,
        profondeur: Number(profondeur) || 0, hauteurReservoir: Number(hauteurReservoir) || 0,
        debitRequis: debit,
      },
      kit: { id: kit.id, name: kit.name },
      quotation,
      total: quotation.total,
      statut,
      createdBy: user.id,
    });
    onDone();
  };

  const besoinRempli = Number(volumeJour) > 0 && hmt > 0;
  const canNext = (step === 1 && selectedLeadId) || (step === 2 && besoinRempli);

  return (
    <div className="wizard">
      <div className="steps-indicator">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`step-dot ${step >= s ? 'active' : ''} ${step > s ? 'completed' : ''}`} />
        ))}
      </div>
      <div className="steps-label">Étape {step} sur 3 · {STEP_NAMES[step - 1]}</div>
      <div className="wizard-form card">
        {/* Étape 1 : client */}
        {step === 1 && (
          <div>
            <div className="wizard-step-title">Sélectionnez un client</div>
            <LeadPicker leads={myLeads} selectedLeadId={selectedLeadId} onSelect={setSelectedLeadId} />
            {selectedLeadId && <PartnerField value={partnerId} />}
          </div>
        )}

        {/* Étape 2 : besoin en eau */}
        {step === 2 && (
          <div>
            <div className="wizard-step-title">Besoin en eau</div>

            <div className="chip-selector">
              <span className="chip-selector-label"><Waves size={13} /> Source d'eau</span>
              <div className="categories-scroll" style={{ marginBottom: 0 }}>
                {SOURCES_EAU.map((sn) => (
                  <button key={sn.id} type="button" className={`category-chip ${source === sn.id ? 'active' : ''}`}
                    onClick={() => setSource(sn.id)}>
                    {sn.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="manual-consumption-grid">
              <Field label={<><Droplets size={14} /> Eau nécessaire par jour (m³)</>}>
                <input className="input" type="number" min="0" step="0.5" value={volumeJour}
                  onChange={(e) => setVolumeJour(e.target.value)} placeholder="Ex : 5" />
              </Field>
              <Field label={<><ArrowDown size={14} /> Profondeur de l'eau (m)</>}>
                <input className="input" type="number" min="0" value={profondeur}
                  onChange={(e) => setProfondeur(e.target.value)} placeholder="Ex : 40" />
              </Field>
              <Field label={<><Building size={14} /> Hauteur du réservoir (m)</>}>
                <input className="input" type="number" min="0" value={hauteurReservoir}
                  onChange={(e) => setHauteurReservoir(e.target.value)} placeholder="0 si sortie directe" />
              </Field>
              <Field label={<><Gauge size={14} /> HMT (m) — corrigez si connue</>}>
                <input className="input" type="number" min="0" value={hmtManuelle}
                  onChange={(e) => setHmtManuelle(e.target.value)} placeholder={hmtCalculee > 0 ? `Estimée : ${hmtCalculee}` : 'Calculée automatiquement'} />
              </Field>
            </div>
            <div className="field-hint">
              1 m³ = 1 000 litres (≈ 5 fûts de 200 L). La HMT additionne profondeur de l'eau,
              hauteur du réservoir et 10 % de pertes dans la tuyauterie.
            </div>

            {besoinRempli && (
              <div className="consumption-summary">
                <div className="consumption-stat day">
                  <Droplets size={16} /><div><div className="consumption-value">{Number(volumeJour).toLocaleString('fr-FR')} m³</div><div className="consumption-label">Par jour</div></div>
                </div>
                <div className="consumption-stat night">
                  <Gauge size={16} /><div><div className="consumption-value">{debit.toLocaleString('fr-FR')} m³/h</div><div className="consumption-label">Débit requis ({HEURES_POMPAGE} h de soleil)</div></div>
                </div>
                <div className="consumption-stat total">
                  <ArrowDown size={16} /><div><div className="consumption-value">{hmt} m</div><div className="consumption-label">HMT</div></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Étape 3 : kit et devis */}
        {step === 3 && !kit && (
          <div>
            <div className="wizard-step-title">Kit pompage et devis</div>
            <EmptyState card>
              {kitsDisponibles.length === 0 ? (
                <>Aucun kit pompage configuré. Composez votre gamme dans
                <strong> Plus › Kits pompage </strong> — l'assistant s'appuie
                uniquement sur elle pour suggérer et chiffrer.</>
              ) : (
                <>Aucun kit de la gamme ne couvre ce besoin ({Number(volumeJour).toLocaleString('fr-FR')} m³/jour
                à {hmt} m de HMT). C'est un chantier sur mesure : contactez BestaSolar pour une étude dédiée.</>
              )}
            </EmptyState>
          </div>
        )}

        {step === 3 && kit && quotation && (
          <div>
            <div className="wizard-step-title">Kit pompage et devis</div>

            <div className="kit-selector">
              <div className="kit-selector-title">Kit suggéré</div>
              <div className="kit-options">
                <div className="kit-option selected">
                  <span className="kit-option-name">
                    {kit.name}
                    <span className="kit-badge">Suggéré</span>
                  </span>
                  <span className="kit-option-meta">{formatCFA(quotation.total)}</span>
                </div>
              </div>
            </div>

            <div className="kit-summary">
              <Package size={16} />
              <span>
                {kit.name} — jusqu'à {kit.maxDebit.toLocaleString('fr-FR')} m³/h et {kit.maxHmt} m de HMT
                · {kit.panels} panneaux {kit.panelW} Wc · {kit.usage}
              </span>
            </div>

            <div className="bom">
              <div className="bom-title">Équipements</div>
              {quotation.components.map((c, i) => (
                <div key={i} className="bom-row">
                  <div className="bom-name">{c.name}{c.quantity > 1 ? <span className="bom-qty"> × {c.quantity}</span> : ''}</div>
                  <div className="bom-price">{formatCFA(c.totalPrice)}</div>
                </div>
              ))}
              <div className="bom-title">Prestations</div>
              {quotation.prestations.map((c, i) => (
                <div key={i} className="bom-row">
                  <div className="bom-name">{c.name}</div>
                  <div className="bom-price">{formatCFA(c.totalPrice)}</div>
                </div>
              ))}
            </div>

            <div className="devis-summary">
              <div className="devis-summary-row"><span>Sous-total HT</span><span>{formatCFA(quotation.subtotalHT)}</span></div>
              <div className="devis-summary-row"><span>TVA</span><span>Exonérée</span></div>
              <div className="devis-summary-row total"><span>Total TTC</span><span>{formatCFA(quotation.total)}</span></div>
            </div>
          </div>
        )}

        <div className="wizard-actions">
          {step > 1 && (step < 3 ? (
            <button className="btn btn-outline btn-block" onClick={() => setStep(step - 1)}>
              <ChevronLeft size={18} /> Précédent
            </button>
          ) : (
            <button className="btn btn-outline" style={{ flex: '0 0 auto' }} onClick={() => setStep(step - 1)} aria-label="Étape précédente">
              <ChevronLeft size={18} />
            </button>
          ))}
          {step < 3 ? (
            <button className="btn btn-primary btn-block" onClick={() => setStep(step + 1)} disabled={!canNext}>
              Suivant <ChevronRight size={18} />
            </button>
          ) : (
            <>
              <button className="btn btn-outline" style={{ flex: '0 0 auto' }} onClick={() => handleSubmit('brouillon')} disabled={!kit}>
                Brouillon
              </button>
              <button className="btn btn-accent btn-block" onClick={() => handleSubmit('finalise')} disabled={!kit}>
                <Check size={18} /> Créer le devis{selectedLead ? ` pour ${selectedLead.name}` : ''}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
