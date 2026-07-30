import { useRef, useState } from 'react';
import { Building2, Check, Camera, Palette, CreditCard, FileText, Eye, Download } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { fileToResizedDataUrl } from '../../../utils/image';
import Field from '../../../components/Field';
import { MODELES, EMPTY_COMPANY, normalizeModele } from './constants';
import { TVA_PCT } from '../../../config/company';

// Facture d'exemple pour l'aperçu PDF.
const SAMPLE_LIGNES = [
  { designation: 'Panneau 550W monocristallin', qty: 6, pu: 95000 },
  { designation: 'Onduleur hybride 5 kVA', qty: 1, pu: 320000 },
  { designation: 'Batterie lithium 5 kWh', qty: 2, pu: 480000 },
];
const SAMPLE_HT = SAMPLE_LIGNES.reduce((s, l) => s + l.pu * l.qty, 0);

/** Onglet « Mon entreprise » : identité, coordonnées, apparence des documents,
 *  facturation — organisé en sections, avec aperçu live de la facture. */
export default function CompanyTab({ company }) {
  const { user } = useAuth();
  const { saveCompany } = useData();
  const [companyForm, setCompanyForm] = useState(null); // null = pas en édition
  const logoInputRef = useRef(null);

  const f = companyForm || { ...EMPTY_COMPANY, ...company };
  const set = (patch) => setCompanyForm({ ...f, ...patch });
  const modele = normalizeModele(f.modeleDefaut);

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file, 360, 0.85);
      // Détecte les couleurs de marque du logo et les applique aux documents
      // (l'utilisateur peut toujours les ajuster dans la section Couleurs).
      const patch = { logo: dataUrl };
      const { couleursDuLogo } = await import('../../../utils/logoColors');
      const couleurs = await couleursDuLogo(dataUrl);
      if (couleurs) {
        patch.couleurPrimaire = couleurs.primaire;
        patch.couleurSecondaire = couleurs.secondaire;
      }
      set(patch);
    } catch { alert('Impossible de lire cette image.'); }
    e.target.value = '';
  };

  const saveCompanyForm = (e) => {
    e.preventDefault();
    saveCompany(user.id, { ...f, modeleDefaut: modele });
    setCompanyForm(null);
  };

  // Aperçu : le vrai document imprimable, dans le modèle sélectionné.
  const previewPdf = async () => {
    const { previewDocument } = await import('./proPdf');
    previewDocument(f, modele, SAMPLE_LIGNES, 'facture');
  };

  return (
    <form className="pro-company-form" onSubmit={saveCompanyForm}>
      {/* Aperçu + modèle */}
      <div className="card my-partner-section">
        <div className="card-title"><Eye size={15} /> Modèle de document</div>
        <div className="client-type-toggle" role="group" aria-label="Modèle de document" style={{ marginBottom: 14 }}>
          {MODELES.map((m) => (
            <button key={m.id} type="button" className={`client-type-btn ${modele === m.id ? 'active' : ''}`} onClick={() => set({ modeleDefaut: m.id })}>
              {m.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-outline btn-block" style={{ marginTop: 12 }} onClick={previewPdf}>
          <Download size={16} /> Ouvrir un aperçu imprimable
        </button>
        <div className="field-hint">{MODELES.find((m) => m.id === modele)?.desc}</div>
      </div>

      {/* Identité */}
      <div className="card my-partner-section">
        <div className="card-title"><Building2 size={15} /> Identité</div>
        <div className="pro-logo-row">
          <button type="button" className="btn btn-sm btn-outline" onClick={() => logoInputRef.current?.click()}>
            <Camera size={14} /> {f.logo ? 'Changer le logo' : 'Ajouter mon logo'}
          </button>
          <input ref={logoInputRef} type="file" accept="image/*" className="photo-input" onChange={handleLogo} />
        </div>
        <Field label="Nom de l'entreprise *">
          <input className="input" required value={f.nomEntreprise} onChange={(e) => set({ nomEntreprise: e.target.value })} placeholder="Ex : Fatou Solaire Services" />
        </Field>
        <Field label="Slogan">
          <input className="input" value={f.slogan} onChange={(e) => set({ slogan: e.target.value })} placeholder="Ex : L'énergie à votre porte" />
        </Field>
      </div>

      {/* Coordonnées */}
      <div className="card my-partner-section">
        <div className="card-title"><FileText size={15} /> Coordonnées</div>
        <div className="form-row-2">
          <Field label="Téléphone">
            <input className="input" type="tel" value={f.telephone} onChange={(e) => set({ telephone: e.target.value })} placeholder="+229 ..." />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
        </div>
        <Field label="Adresse">
          <input className="input" value={f.adresse} onChange={(e) => set({ adresse: e.target.value })} placeholder="Quartier, ville" />
        </Field>
        <div className="form-row-2">
          <Field label="IFU (optionnel)">
            <input className="input" value={f.ifu} onChange={(e) => set({ ifu: e.target.value })} />
          </Field>
          <Field label="RCCM (optionnel)">
            <input className="input" value={f.rccm} onChange={(e) => set({ rccm: e.target.value })} />
          </Field>
        </div>
      </div>

      {/* Apparence */}
      <div className="card my-partner-section">
        <div className="card-title"><Palette size={15} /> Couleurs des documents</div>
        <div className="form-row-2">
          <Field label="Couleur principale">
            <input className="input pro-color-input" type="color" value={f.couleurPrimaire} onChange={(e) => set({ couleurPrimaire: e.target.value })} />
          </Field>
          <Field label="Couleur secondaire">
            <input className="input pro-color-input" type="color" value={f.couleurSecondaire} onChange={(e) => set({ couleurSecondaire: e.target.value })} />
          </Field>
        </div>
        <div className="field-hint">Détectées automatiquement à l'import de votre logo, ajustables ici. Appliquées aux modèles Studio et Vague ; le modèle Classique reste noir et blanc.</div>
      </div>

      {/* Facturation */}
      <div className="card my-partner-section">
        <div className="card-title"><CreditCard size={15} /> Facturation & paiement</div>
        <Field label="Préfixe des factures">
          <input className="input" value={f.facturePrefix} onChange={(e) => set({ facturePrefix: e.target.value.toUpperCase().slice(0, 6) })} placeholder="FAC" />
        </Field>
        <div className="form-row-2">
          <Field label="Numéro Mobile Money">
            <input className="input" type="tel" value={f.momo} onChange={(e) => set({ momo: e.target.value })} placeholder="+229 ..." />
          </Field>
          <Field label="Nom du compte MoMo">
            <input className="input" value={f.momoNom} onChange={(e) => set({ momoNom: e.target.value })} placeholder="Titulaire" />
          </Field>
        </div>
        <Field label="Mentions / conditions (bas de document)">
          <textarea className="input" rows="2" value={f.conditions} onChange={(e) => set({ conditions: e.target.value })} placeholder="Ex : Devis valable 30 jours. Acompte de 50 % à la commande…" />
        </Field>
        <label className="pro-tva-toggle">
          <input type="checkbox" checked={!!f.assujettieVAT} onChange={(e) => set({ assujettieVAT: e.target.checked })} />
          Entreprise assujettie à la TVA <span className="text-secondary">(active la TVA {TVA_PCT} % par défaut sur les nouvelles factures)</span>
        </label>
      </div>

      <button type="submit" className="btn btn-primary btn-block"><Check size={17} /> Enregistrer mon entreprise</button>
    </form>
  );
}
