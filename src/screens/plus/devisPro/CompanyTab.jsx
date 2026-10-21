import { useEffect, useRef, useState } from 'react';
import { Building2, Check, Camera, Palette, CreditCard, FileText, Eye, Globe, PenLine, Trash2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useData } from '../../../context/DataContext';
import { logoDepuisFichier } from '../../../utils/image';
import Field from '../../../components/Field';
import { useToast } from '../../../components/Toast';
import FacturePreview from './FacturePreview';
import ApercuDocument from '../../../components/ApercuDocument';
import ChampCouleur from '../../../components/ChampCouleur';
import { MODELES, EMPTY_COMPANY, normalizeModele } from './constants';
import { PAYS, paysDeLEntreprise, paysDuTelephone, tvaPct, libelleDevise, indicationTva } from '../../../data/pays';
import { modesPaiementProposes, modesPaiementAffiches, MENTIONS_FISCALES } from '../../../utils/facture';

// Facture d'exemple pour l'aperçu PDF.
const SAMPLE_LIGNES = [
  { designation: 'Panneau 550W monocristallin', qty: 6, pu: 95000 },
  { designation: 'Onduleur hybride 5 kVA', qty: 1, pu: 320000 },
  { designation: 'Batterie lithium 5 kWh', qty: 2, pu: 480000 },
];

/** Onglet « Mon entreprise » : identité, coordonnées, apparence des documents,
 *  facturation — avec aperçu en direct et barre d'enregistrement collante. */
export default function CompanyTab({ company }) {
  const { user } = useAuth();
  const { saveCompany } = useData();
  const toast = useToast();
  const [companyForm, setCompanyForm] = useState(null); // null = pas en édition
  // Couleurs en place avant la dernière détection automatique (pour « Annuler »).
  const [couleursAvant, setCouleursAvant] = useState(null);
  const [erreurNom, setErreurNom] = useState(false);
  // Aperçu du modèle, dans l'application (avec retour), jamais dans un onglet.
  const [apercu, setApercu] = useState(null);
  const logoInputRef = useRef(null);
  const cachetInputRef = useRef(null);

  const f = companyForm || { ...EMPTY_COMPANY, ...company };
  const set = (patch) => setCompanyForm({ ...f, ...patch });
  const modele = normalizeModele(f.modeleDefaut);
  // Pays : celui choisi, sinon déduit du téléphone (entreprises d'avant ce
  // réglage), sinon le Togo. Il règle libellés, exemples, TVA et Mobile Money.
  const pays = paysDeLEntreprise(f);
  // Numéro d'un autre pays que celui choisi : souvent un oubli après un changement de pays.
  const autrePays = (tel) => { const p = paysDuTelephone(tel); return p && p.id !== pays.id ? p : null; };
  const telAutrePays = autrePays(f.telephone);
  const momoAutrePays = autrePays(f.momo);
  const dirty = companyForm !== null;

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Rogné de ses marges vides, en PNG (transparence gardée) : il occupe
      // ensuite tout son emplacement sur les documents (utils/logo.js).
      const dataUrl = await logoDepuisFichier(file);
      // Détecte les couleurs de marque du logo — sans écraser silencieusement
      // un réglage manuel : l'ancien couple reste restaurable via « Annuler ».
      const patch = { logo: dataUrl, logoAjuste: true };
      const { couleursDuLogo } = await import('../../../utils/logoColors');
      const couleurs = await couleursDuLogo(dataUrl);
      if (couleurs) {
        setCouleursAvant({ couleurPrimaire: f.couleurPrimaire, couleurSecondaire: f.couleurSecondaire });
        patch.couleurPrimaire = couleurs.primaire;
        patch.couleurSecondaire = couleurs.secondaire;
      }
      set(patch);
    } catch { toast('Impossible de lire cette image.', { type: 'error' }); }
    e.target.value = '';
  };

  // Signature et cachet : une image (scan ou photo), rognée de ses marges et
  // gardée transparente comme le logo, posée dans le bloc du signataire.
  const handleCachet = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { set({ cachet: await logoDepuisFichier(file) }); } catch { toast('Impossible de lire cette image.', { type: 'error' }); }
    e.target.value = '';
  };
  const modesProposes = modesPaiementProposes(pays);
  const modesCoches = modesPaiementAffiches(f, pays);
  const basculerMode = (mode) => set({
    modesPaiement: modesCoches.includes(mode) ? modesCoches.filter((m) => m !== mode) : [...modesCoches, mode],
  });
  const mentions = MENTIONS_FISCALES(pays);
  const mentionPreset = mentions.find((m) => m.texte === (f.mentionFiscale || ''))?.id || 'perso';

  // Logo enregistré avant le rognage automatique : recadré une fois, à
  // l'ouverture de l'écran (marges vides retirées, transparence gardée), et
  // annoncé — il paraissait minuscule sur les documents.
  useEffect(() => {
    if (!company?.logo || company.logoAjuste || !user?.id) return undefined;
    let annule = false;
    (async () => {
      try {
        const blob = await (await fetch(company.logo)).blob();
        const logo = await logoDepuisFichier(blob);
        if (annule) return;
        saveCompany(user.id, { ...company, logo, logoAjuste: true });
        toast('Votre logo a été recadré pour remplir son emplacement sur vos documents.');
      } catch { /* logo illisible : on le laisse tel quel */ }
    })();
    return () => { annule = true; };
  }, [company?.logo, company?.logoAjuste]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveCompanyForm = (e) => {
    e.preventDefault();
    if (!f.nomEntreprise.trim()) {
      setErreurNom(true);
      return;
    }
    setErreurNom(false);
    saveCompany(user.id, { ...f, pays: pays.id, modeleDefaut: modele });
    setCompanyForm(null);
    setCouleursAvant(null);
    toast('Entreprise enregistrée.');
  };

  // Aperçu : le vrai document, dans le modèle sélectionné, sur des lignes d'exemple.
  const previewPdf = async () => {
    const { htmlApercuModele } = await import('./proPdf');
    setApercu(await htmlApercuModele(f, modele, SAMPLE_LIGNES, 'facture'));
  };

  return (
    <form className="pro-company-form" onSubmit={saveCompanyForm} noValidate>
      {/* Aperçu en direct : logo, couleurs, modèle et slogan se règlent à vue. */}
      <div className="card my-partner-section">
        <div className="sheet-section-title"><Eye size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Aperçu en direct</div>
        <div className="pro-preview-wrap">
          <FacturePreview company={f} modele={modele} />
        </div>
        <div className="input-group" style={{ margin: '14px 0 0' }}>
          <span className="input-label" id="modele-doc-label">Modèle de document</span>
          <div className="segmented" role="group" aria-labelledby="modele-doc-label">
            {MODELES.map((m) => (
              <button key={m.id} type="button" className={`segmented-btn ${modele === m.id ? 'active' : ''}`} onClick={() => set({ modeleDefaut: m.id })}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="field-hint">{MODELES.find((m) => m.id === modele)?.desc}</div>
        </div>
        <button type="button" className="btn btn-outline btn-block" style={{ marginTop: 12 }} onClick={previewPdf}>
          <Eye size={16} /> Voir un aperçu du document
        </button>
      </div>

      {/* Identité */}
      <div className="card my-partner-section">
        <div className="sheet-section-title"><Building2 size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Identité</div>
        <div className="photo-field">
          <button type="button" className="photo-preview" onClick={() => logoInputRef.current?.click()} aria-label={f.logo ? 'Changer le logo' : 'Ajouter mon logo'}>
            {f.logo ? (
              <img src={f.logo} alt="Logo de l'entreprise" />
            ) : (
              <span className="photo-placeholder"><Camera size={22} /> Ajouter mon logo</span>
            )}
          </button>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => logoInputRef.current?.click()}>
            <Camera size={14} /> {f.logo ? 'Changer le logo' : 'Ajouter mon logo'}
          </button>
          <div className="field-hint" style={{ marginTop: 0 }}>PNG ou JPG · fond transparent conseillé</div>
          <input ref={logoInputRef} type="file" accept="image/*" className="photo-input" onChange={handleLogo} />
        </div>
        <Field label="Nom de l'entreprise *">
          <input
            className={`input${erreurNom && !f.nomEntreprise.trim() ? ' invalid' : ''}`}
            required
            value={f.nomEntreprise}
            onChange={(e) => set({ nomEntreprise: e.target.value })}
            placeholder="Ex : Fatou Solaire Services"
          />
          {erreurNom && !f.nomEntreprise.trim() && <div className="field-error">Le nom de l'entreprise est requis.</div>}
        </Field>
        <Field label="Slogan">
          <input className="input" value={f.slogan} onChange={(e) => set({ slogan: e.target.value })} placeholder="Ex : L'énergie à votre porte" />
        </Field>
      </div>

      {/* Coordonnées */}
      <div className="card my-partner-section">
        <div className="sheet-section-title"><FileText size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Coordonnées</div>
        <Field label="Pays de l'entreprise">
          <select className="input" value={pays.id} onChange={(e) => set({ pays: e.target.value })}>
            {PAYS.map((p) => <option key={p.id} value={p.id}>{p.drapeau} {p.nom}</option>)}
          </select>
          <div className="field-hint pays-resume">
            <Globe size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
            Indicatif {pays.indicatif} · TVA {tvaPct(pays.tva)} % · {libelleDevise(pays)} · identifiant fiscal : {pays.fiscal.sigle}
          </div>
        </Field>
        <div className="form-row-2">
          <Field label="Téléphone">
            <input className="input" type="tel" value={f.telephone} onChange={(e) => set({ telephone: e.target.value })} placeholder={pays.exempleTel} />
            {telAutrePays && <div className="field-hint text-warning">Numéro en {telAutrePays.indicatif} ({telAutrePays.nom}) : est-ce le bon ?</div>}
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} />
          </Field>
        </div>
        <Field label="Adresse">
          <input className="input" value={f.adresse} onChange={(e) => set({ adresse: e.target.value })} placeholder="Quartier, ville" />
        </Field>
        <div className="form-row-2">
          {/* La clé reste `ifu` (données déjà enregistrées) ; le libellé suit le pays. */}
          <Field label={`${pays.fiscal.sigle} (optionnel)`}>
            <input className="input" value={f.ifu} onChange={(e) => set({ ifu: e.target.value })}
              placeholder={pays.fiscal.exemple ? `Ex : ${pays.fiscal.exemple}` : pays.fiscal.sigle} />
            <div className="field-hint">{pays.fiscal.nom}</div>
          </Field>
          <Field label="RCCM (optionnel)">
            <input className="input" value={f.rccm} onChange={(e) => set({ rccm: e.target.value })} placeholder={`Ex : ${pays.exempleRccm}`} />
            <div className="field-hint">Registre du commerce (OHADA)</div>
          </Field>
        </div>
        <Field label="CNSS (optionnel)">
          <input className="input" value={f.cnss || ''} onChange={(e) => set({ cnss: e.target.value })} placeholder="N° d’employeur à la caisse de sécurité sociale" />
          <div className="field-hint">Affiché sur les factures, à côté de l’identifiant fiscal et du RCCM.</div>
        </Field>
      </div>

      {/* Apparence */}
      <div className="card my-partner-section">
        <div className="sheet-section-title"><Palette size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Couleurs des documents</div>
        <div className="form-pair">
          {/* Nuancier OU code couleur tapé (#E30613…) : le code de la charte
              graphique s'applique tel quel. */}
          <Field label="Couleur principale">
            <ChampCouleur valeur={f.couleurPrimaire} libelle="Couleur principale" onChange={(hex) => set({ couleurPrimaire: hex })} />
          </Field>
          <Field label="Couleur secondaire">
            <ChampCouleur valeur={f.couleurSecondaire} libelle="Couleur secondaire" onChange={(hex) => set({ couleurSecondaire: hex })} />
          </Field>
        </div>
        {couleursAvant ? (
          <div className="colors-detected-note">
            <Check size={14} /> Couleurs détectées depuis votre logo ·{' '}
            <button type="button" className="colors-undo" onClick={() => { set(couleursAvant); setCouleursAvant(null); }}>
              Annuler
            </button>
          </div>
        ) : (
          <div className="field-hint">Détectées automatiquement à l'import de votre logo, ajustables ici — au nuancier ou en tapant le code couleur de votre charte (ex. #E30613). Appliquées aux modèles Studio et Vague ; le modèle Sobre reste noir et blanc.</div>
        )}
      </div>

      {/* Facturation */}
      <div className="card my-partner-section">
        <div className="sheet-section-title"><CreditCard size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Facturation & paiement</div>
        <Field label="Préfixe des factures">
          <input className="input" value={f.facturePrefix} onChange={(e) => set({ facturePrefix: e.target.value.toUpperCase().slice(0, 6) })} placeholder="FAC" />
        </Field>
        <Field label="Opérateur Mobile Money">
          <input className="input" list="operateurs-mobile-money" value={f.momoOperateur || ''} onChange={(e) => set({ momoOperateur: e.target.value })}
            placeholder={`Ex : ${pays.mobileMoney[0]}`} />
          <datalist id="operateurs-mobile-money">
            {pays.mobileMoney.map((o) => <option key={o} value={o} />)}
          </datalist>
          <div className="field-hint">{pays.dans.charAt(0).toUpperCase() + pays.dans.slice(1)} : {pays.mobileMoney.join(', ')}. Il figure sur vos factures et vos relances.</div>
        </Field>
        <div className="form-row-2">
          <Field label="Numéro Mobile Money">
            <input className="input" type="tel" value={f.momo} onChange={(e) => set({ momo: e.target.value })} placeholder={pays.exempleTel} />
            {momoAutrePays && <div className="field-hint text-warning">Numéro en {momoAutrePays.indicatif} ({momoAutrePays.nom}) : est-ce le bon ?</div>}
          </Field>
          <Field label="Nom du compte MoMo">
            <input className="input" value={f.momoNom} onChange={(e) => set({ momoNom: e.target.value })} placeholder="Titulaire" />
          </Field>
        </div>
        <Field label="Mentions / conditions (bas de document)">
          <textarea className="input" rows="2" value={f.conditions} onChange={(e) => set({ conditions: e.target.value })} placeholder="Ex : Devis valable 30 jours. Acompte de 50 % à la commande…" />
        </Field>
        <Field label="Mention fiscale (sous les totaux de la facture)">
          <select className="input" value={mentionPreset}
            onChange={(e) => { const m = mentions.find((x) => x.id === e.target.value); set({ mentionFiscale: m ? m.texte : (f.mentionFiscale || ' ') }); }}>
            {mentions.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            <option value="perso">Personnalisée…</option>
          </select>
          {mentionPreset === 'perso' && (
            <input className="input" style={{ marginTop: 8 }} value={(f.mentionFiscale || '').trim()} placeholder="Votre mention"
              onChange={(e) => set({ mentionFiscale: e.target.value })} />
          )}
        </Field>
        <div className="form-row-2">
          <Field label="Banque (virement)">
            <input className="input" value={f.banque || ''} onChange={(e) => set({ banque: e.target.value })} placeholder="Ex : Ecobank" />
          </Field>
          <Field label="N° de compte / RIB">
            <input className="input" value={f.compteBancaire || ''} onChange={(e) => set({ compteBancaire: e.target.value })} />
          </Field>
        </div>
        <div className="input-group">
          <span className="input-label" id="company-modes-label">Modes de paiement affichés sur la facture</span>
          <div role="group" aria-labelledby="company-modes-label">
            {modesProposes.map((mode) => (
              <label key={mode} className="checkbox-row">
                <input type="checkbox" checked={modesCoches.includes(mode)} onChange={() => basculerMode(mode)} />
                <span>{mode}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="sheet-section-title"><PenLine size={13} style={{ verticalAlign: -2, marginRight: 5 }} />Signataire des factures</div>
        <div className="form-row-2">
          <Field label="Titre">
            <input className="input" value={f.signataireTitre || ''} onChange={(e) => set({ signataireTitre: e.target.value })} placeholder="Le Directeur Général" />
          </Field>
          <Field label="Nom">
            <input className="input" value={f.signataireNom || ''} onChange={(e) => set({ signataireNom: e.target.value })} placeholder="Prénom Nom" />
          </Field>
        </div>
        <div className="photo-field">
          <button type="button" className="photo-preview cachet-preview" onClick={() => cachetInputRef.current?.click()}>
            {f.cachet ? <img src={f.cachet} alt="Signature et cachet" /> : <span className="photo-placeholder"><PenLine size={22} /><span>Signature et cachet</span></span>}
          </button>
          <input ref={cachetInputRef} type="file" accept="image/*" onChange={handleCachet} hidden aria-label="Image de la signature et du cachet" />
          <div className="photo-field-actions">
            <button type="button" className="btn btn-sm btn-outline" onClick={() => cachetInputRef.current?.click()}>
              <Camera size={15} /> {f.cachet ? 'Changer l’image' : 'Ajouter une image'}
            </button>
            {f.cachet && (
              <button type="button" className="btn btn-sm btn-outline" onClick={() => set({ cachet: '' })}><Trash2 size={15} /> Retirer</button>
            )}
          </div>
          <div className="field-hint">Scan ou photo de la signature et du cachet, sur fond blanc. Facultatif : sans image, la facture garde une zone à signer — comme le modèle Sobre, imprimé sans aucune image.</div>
        </div>
        <div className="input-group" style={{ marginBottom: 0 }}>
          <span className="input-label" id="company-tva-label">TVA sur les nouveaux documents</span>
          <div className="segmented" role="group" aria-labelledby="company-tva-label">
            <button type="button" className={`segmented-btn ${!f.assujettieVAT ? 'active' : ''}`} aria-pressed={!f.assujettieVAT} onClick={() => set({ assujettieVAT: false })}>
              Exonérée
            </button>
            <button type="button" className={`segmented-btn ${f.assujettieVAT ? 'active' : ''}`} aria-pressed={!!f.assujettieVAT} onClick={() => set({ assujettieVAT: true })}>
              TVA {tvaPct(pays.tva)} %
            </button>
          </div>
          <div className="field-hint">{indicationTva(pays)} Ce choix s'applique aux nouveaux devis et factures, ajustable document par document.</div>
        </div>
      </div>

      {/* Barre d'enregistrement collante : l'état d'édition est toujours visible. */}
      <div className="form-actions-sticky">
        {dirty && <span className="form-dirty-note">Non enregistré</span>}
        <button type="submit" className="btn btn-primary" style={{ marginLeft: 'auto' }}>
          <Check size={17} /> Enregistrer
        </button>
        {dirty && (
          <button type="button" className="btn btn-outline" onClick={() => { setCompanyForm(null); setCouleursAvant(null); setErreurNom(false); }}>
            Annuler
          </button>
        )}
      </div>
      <ApercuDocument html={apercu} titre={`Aperçu — modèle ${MODELES.find((m) => m.id === modele)?.label || ''}`} onFermer={() => setApercu(null)} />
    </form>
  );
}
