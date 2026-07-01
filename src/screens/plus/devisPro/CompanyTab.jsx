import { useRef, useState } from 'react';
import { Building2, Check, Camera } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { fileToResizedDataUrl } from '../../../utils/image';
import Field from '../../../components/Field';
import { MODELES, EMPTY_COMPANY } from './constants';

/** Onglet « Mon entreprise » : identité (logo, couleurs, coordonnées, TVA). */
export default function CompanyTab({ company }) {
  const { user } = useAuth();
  const { saveCompany } = useData();
  const [companyForm, setCompanyForm] = useState(null); // null = pas en édition
  const logoInputRef = useRef(null);

  const f = companyForm || { ...EMPTY_COMPANY, ...company };

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToResizedDataUrl(file, 360, 0.85);
      setCompanyForm((prev) => ({ ...(prev || f), logo: dataUrl }));
    } catch {
      alert('Impossible de lire cette image.');
    }
    e.target.value = '';
  };

  const saveCompanyForm = (e) => {
    e.preventDefault();
    saveCompany(user.id, f);
    setCompanyForm(null);
  };

  return (
    <div className="card my-partner-section">
      <div className="card-title"><Building2 size={15} /> Identité de mon entreprise</div>
      <form onSubmit={saveCompanyForm}>
        {/* Aperçu en direct */}
        <div className="pro-preview" style={{ borderColor: f.couleurPrimaire }}>
          <div className="pro-preview-band" style={{ background: f.couleurPrimaire }}>
            {f.logo
              ? <img src={f.logo} alt="" className="pro-preview-logo" />
              : <span className="pro-preview-logo pro-preview-initials" style={{ background: f.couleurSecondaire }}>
                  {(f.nomEntreprise || 'ME').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </span>}
            <div>
              <div className="pro-preview-name">{f.nomEntreprise || 'Mon Entreprise'}</div>
              <div className="pro-preview-slogan">{f.slogan || 'Votre slogan ici'}</div>
            </div>
            <span className="pro-preview-doc" style={{ color: f.couleurSecondaire }}>DEVIS</span>
          </div>
          <div className="pro-preview-line" style={{ background: f.couleurSecondaire }} />
          <div className="pro-preview-meta">{[f.telephone, f.email, f.adresse].filter(Boolean).join('  ·  ') || 'Téléphone · Email · Adresse'}</div>
        </div>

        <div className="pro-logo-row">
          <button type="button" className="btn btn-sm btn-outline" onClick={() => logoInputRef.current?.click()}>
            <Camera size={14} /> {f.logo ? 'Changer le logo' : 'Ajouter mon logo'}
          </button>
          <input ref={logoInputRef} type="file" accept="image/*" className="photo-input" onChange={handleLogo} />
        </div>

        <Field label="Nom de l'entreprise *">
          <input className="input" required value={f.nomEntreprise} onChange={(e) => setCompanyForm({ ...f, nomEntreprise: e.target.value })} placeholder="Ex : Fatou Solaire Services" />
        </Field>
        <Field label="Slogan">
          <input className="input" value={f.slogan} onChange={(e) => setCompanyForm({ ...f, slogan: e.target.value })} placeholder="Ex : L'énergie à votre porte" />
        </Field>
        <div className="form-row-2">
          <Field label="Téléphone">
            <input className="input" type="tel" value={f.telephone} onChange={(e) => setCompanyForm({ ...f, telephone: e.target.value })} placeholder="+229 ..." />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={f.email} onChange={(e) => setCompanyForm({ ...f, email: e.target.value })} />
          </Field>
        </div>
        <Field label="Adresse">
          <input className="input" value={f.adresse} onChange={(e) => setCompanyForm({ ...f, adresse: e.target.value })} placeholder="Quartier, ville" />
        </Field>
        <div className="form-row-2">
          <Field label="IFU (optionnel)">
            <input className="input" value={f.ifu} onChange={(e) => setCompanyForm({ ...f, ifu: e.target.value })} />
          </Field>
          <Field label="RCCM (optionnel)">
            <input className="input" value={f.rccm} onChange={(e) => setCompanyForm({ ...f, rccm: e.target.value })} />
          </Field>
        </div>
        <div className="form-row-2">
          <Field label="Couleur principale">
            <input className="input pro-color-input" type="color" value={f.couleurPrimaire} onChange={(e) => setCompanyForm({ ...f, couleurPrimaire: e.target.value })} />
          </Field>
          <Field label="Couleur secondaire">
            <input className="input pro-color-input" type="color" value={f.couleurSecondaire} onChange={(e) => setCompanyForm({ ...f, couleurSecondaire: e.target.value })} />
          </Field>
        </div>
        <div className="form-row-2">
          <Field label="Modèle par défaut">
            <select className="input" value={f.modeleDefaut} onChange={(e) => setCompanyForm({ ...f, modeleDefaut: e.target.value })}>
              {MODELES.map((m) => <option key={m.id} value={m.id}>{m.label} — {m.desc}</option>)}
            </select>
          </Field>
          <Field label="Préfixe des factures">
            <input className="input" value={f.facturePrefix} onChange={(e) => setCompanyForm({ ...f, facturePrefix: e.target.value.toUpperCase().slice(0, 6) })} />
          </Field>
        </div>
        <label className="pro-tva-toggle">
          <input type="checkbox" checked={!!f.assujettieVAT} onChange={(e) => setCompanyForm({ ...f, assujettieVAT: e.target.checked })} />
          Entreprise assujettie à la TVA <span className="text-secondary">(active la TVA 18 % par défaut sur les nouvelles factures)</span>
        </label>
        <button type="submit" className="btn btn-primary btn-block"><Check size={17} /> Enregistrer mon entreprise</button>
      </form>
    </div>
  );
}
