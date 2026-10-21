// Modèle Sobre (espace Pro) — remplace l'ancien « Classique ». Noir, blanc et
// gris UNIQUEMENT : il s'imprime à l'identique sur une imprimante noir et
// blanc. Aucun logo, aucune image : l'en-tête est purement typographique.
//
// Tailles : 28 / 18 / 13 / 11 px, rien entre. Une ligne d'article fait au
// moins 40 px. Le tableau garde sa largeur quoi qu'il arrive : une
// désignation longue passe à la ligne dans sa cellule.
import { nf, esc, libelles, conditionsPour, paginer, documentHtml, piedApporteur } from './shared';
import { phraseArretee, paginerFacture, montantInsecable, hauteurLigneArticle } from './reglement';
import { jourFr } from '../date';

/** Les seules couleurs du modèle (vérifié par les tests). */
export const COULEURS_SOBRE = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#888888', '#e3e3e3', '#ffffff'];

// Lignes par page, mesurées dans le navigateur (voir paginer) avec des
// désignations d'une ligne, les conditions générales par défaut et un nom
// d'entreprise d'une ligne : page unique, première, intermédiaire, dernière.
const CAPACITES = { seule: 9, premiere: 18, suite: 23, derniere: 14 };
const HAUTEUR_RANG = 40;

// Un texte plus long que celui des mesures pousse le bas de page : chaque
// ligne de texte en plus retire des lignes d'articles, sinon l'encadré, la
// signature ou le pied de page sortiraient de la feuille (débordement masqué
// = totaux coupés sur le PDF). Caractères par ligne volontairement bas :
// mieux vaut une ligne d'article de moins qu'un total coupé.
const lignesDe = (texte, parLigne) => Math.max(1, Math.ceil(String(texte || '').length / parLigne));
const LIGNES_CONDITIONS_MESUREES = 7; // « Livraison : À convenir. » + conditions par défaut

function capacitesPour({ nom, conditions, pied, reference }) {
  const haut = (lignesDe(nom, 20) - 1) * 34; // nom en 28 px dans l'en-tête
  const bas = (lignesDe(conditions, 48) - LIGNES_CONDITIONS_MESUREES) * 16.5
    + (lignesDe(nom, 28) - 1) * 19.5 // nom au-dessus de la signature (232 px)
    + pied.reduce((somme, ligne) => somme + (lignesDe(ligne, 95) - 1) * 16.5, 0)
    + (reference ? 20 : 0); // « Réf. partenaire », sur sa ligne au-dessus du pied
  const rangs = (px) => Math.max(0, Math.ceil(px / HAUTEUR_RANG));
  return {
    seule: Math.max(0, CAPACITES.seule - rangs(haut + bas)),
    premiere: Math.max(1, CAPACITES.premiere - rangs(haut)),
    suite: CAPACITES.suite,
    derniere: Math.max(0, CAPACITES.derniere - rangs(bas)),
  };
}

// Factures : découpe à la hauteur (voir paginerFacture). Le pied n'est
// imprimé que sur la dernière page : il compte dans le règlement.
const AIRE = { premiere: 740, suite: 952 }; // de l'en-tête du tableau au bas de la page (px, mesurée)
const HAUTEUR_LIGNE = hauteurLigneArticle({ base: 14, texte: 19.5, parLigne: 42, min: 40 });

/**
 * Place du règlement d'une facture Sobre (px, estimation prudente vérifiée
 * dans le navigateur). Le pied, imprimé sur la seule dernière page, en fait partie.
 */
export function placeFactureSobre(r, e, conditions, { pied = [], reference = false, remise = 0 } = {}) {
  const haut = (lignesDe(e.name, 20) - 1) * 34 + (r.miseAJour ? 17 : 0);
  const gauche = 24 + 23.5 + lignesDe(conditions, 50) * 16.5 + (r.mention ? 4 + lignesDe(r.mention, 50) * 16.5 : 0);
  const droite = 24 + 19.5 + (remise ? 23.5 : 0) + 23.5 + 43
    + r.versements.reduce((t, v) => t + 20.5 + (v.detail ? 16.5 : 0), 0) + (r.paye > 0 ? 43 : 0) + (r.tropPercu > 0 ? 20.5 : 0);
  const cadre = 40 + 4 + Math.max(gauche, droite);
  const echeancier = r.echeances.length
    ? 24 + 23.5 + 33 + r.echeances.reduce((t, x) => t + 13 + 19.5 * Math.max(lignesDe(x.libelle, 34), lignesDe(x.quand, 22)), 0)
    : 0;
  // Dernier rang : montant en lettres et modes de paiement | signature.
  const arretee = phraseArretee(r).reduce((t, [a, b]) => t + lignesDe(a + b, 58) * 19.5, 0);
  const modes = r.modes.length ? 8 + 19.5 + r.modes.reduce((t, m) => t + lignesDe(`${m.nom} — ${m.detail}`, 64) * 16.5, 0) : 0;
  const signature = lignesDe(r.signataire?.titre || e.name, 28) * 19.5 + 48 + 1 + 20.5;
  const fin = 24 + Math.max(arretee + modes, signature);
  const basDePage = pied.reduce((t, ligne) => t + lignesDe(ligne, 95) * 16.5, 0) + (reference ? 20 : 0);
  return { haut, totaux: cadre + echeancier + basDePage, bloc: cadre + echeancier + fin + basDePage };
}

export const CSS_SOBRE = `
  .page { padding: 48px 56px 40px; color: #222222; line-height: 1.5; background: #ffffff; }
  .entete { display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; }
  .nom { font-size: 28px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: #111111; line-height: 1.2; }
  .slogan { font-size: 11px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: #444444; margin-top: 4px; }
  .titre { font-size: 18px; font-weight: 600; letter-spacing: 2px; color: #111111; text-align: right; line-height: 1.2; }
  .meta { font-size: 11px; font-style: italic; color: #444444; text-align: right; }
  .suite { font-size: 11px; font-style: italic; color: #444444; text-align: right; }

  .client { display: grid; grid-template-columns: 1fr 248px; gap: 48px; margin-top: 40px; font-size: 13px; }
  .champs { display: grid; grid-template-columns: 96px minmax(0, 1fr); column-gap: 12px; }
  /* Une valeur = une ligne : la grille garde la même hauteur d'un document à l'autre. */
  .champs > div, .droite > div { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lib { font-weight: 600; color: #111111; }
  .droite { text-align: right; }
  .droite .vide { height: 24px; }

  table.lignes { margin-top: 32px; table-layout: fixed; border-collapse: collapse; width: 100%; }
  table.lignes th {
    background: #e3e3e3; color: #111111; font-size: 13px; font-weight: 600; text-align: center;
    padding: 6px 4px; border-top: 2px solid #111111; border-bottom: 2px solid #111111; white-space: nowrap;
  }
  table.lignes th + th { border-left: 1px solid #888888; }
  table.lignes th:first-child { border-left: 2px solid #111111; }
  table.lignes th:last-child { border-right: 2px solid #111111; }
  table.lignes td {
    height: 40px; padding: 6px 8px; font-size: 13px; color: #222222; vertical-align: middle;
    border-bottom: 1px dashed #555555; overflow-wrap: anywhere;
  }
  /* « # » et « Qté » : jamais coupés (un « 12 » passait sur deux lignes). */
  table.lignes td.centre { text-align: center; white-space: nowrap; padding-left: 2px; padding-right: 2px; }
  table.lignes td.cat { font-size: 11px; color: #444444; }

  .cadre { display: grid; grid-template-columns: 1fr 280px; margin-top: 40px; border: 2px solid #111111; }
  .suite + .cadre { margin-top: 32px; }
  .conditions { padding: 12px 16px; border-right: 2px solid #111111; }
  .conditions-titre { font-size: 13px; font-weight: 600; text-transform: uppercase; color: #111111; margin-bottom: 4px; }
  .conditions-texte { font-size: 11px; color: #333333; }
  .conditions-texte strong { font-weight: 600; color: #111111; }
  .totaux { padding: 12px 16px; font-size: 13px; }
  .totaux .rang { display: flex; justify-content: space-between; gap: 16px; }
  .totaux .rang + .rang { margin-top: 4px; }
  .totaux .total { margin-top: 8px; padding-top: 8px; border-top: 1px solid #111111; align-items: baseline; }
  .totaux .total span:first-child { font-weight: 600; color: #111111; }
  .totaux .montant { font-size: 18px; font-weight: 600; color: #111111; }

  .signature { width: 232px; margin: 56px 0 0 auto; text-align: center; }
  .signature-nom { font-size: 13px; font-weight: 600; color: #111111; }
  .signature-espace { height: 48px; }
  .signature-filet { border-top: 1px solid #888888; }
  .signature-libelle { font-size: 11px; color: #666666; margin-top: 4px; }

  .pied { text-align: center; font-size: 11px; color: #333333; }

  /* ---- Facture : règlement (noir, blanc et gris, comme le reste) ---- */
  .totaux .versement { font-size: 11px; color: #333333; }
  .totaux .versement small { display: block; color: #666666; }
  .totaux .reste { margin-top: 8px; padding-top: 8px; border-top: 2px solid #111111; align-items: baseline; }
  .totaux .reste span:first-child { font-weight: 600; color: #111111; }
  .conditions-texte.mention { margin-top: 4px; font-style: italic; }
  .arretee { font-size: 13px; color: #222222; }
  .arretee strong { font-weight: 600; color: #111111; }
  .insecable { white-space: nowrap; }
  .echeancier-titre { margin-top: 24px; font-size: 13px; font-weight: 600; text-transform: uppercase; color: #111111; }
  table.echeances { margin-top: 4px; table-layout: fixed; border-collapse: collapse; width: 100%; }
  table.echeances th { background: #e3e3e3; color: #111111; font-size: 11px; font-weight: 600; text-align: left;
                       padding: 6px 8px; border-top: 2px solid #111111; border-bottom: 2px solid #111111; }
  table.echeances th.num { text-align: right; }
  table.echeances td { padding: 6px 8px; font-size: 13px; color: #222222; border-bottom: 1px dashed #555555; vertical-align: middle; }
  /* Statuts distingués sans couleur : graisse, italique, cadre. */
  .statut { font-size: 11px; white-space: nowrap; }
  .statut-recu { font-weight: 600; color: #111111; }
  .statut-partiel { font-style: italic; color: #222222; }
  .statut-en_retard { font-weight: 600; text-transform: uppercase; color: #111111; border: 1px solid #111111; padding: 0 4px; }
  .statut-attendu { color: #222222; border: 1px dashed #555555; padding: 0 4px; }
  .statut-a_venir { color: #666666; }
  .fin { display: grid; grid-template-columns: 1fr 232px; gap: 32px; margin-top: 24px; align-items: start; }
  .fin .signature { margin: 0; }
  .modes-titre { font-size: 13px; font-weight: 600; text-transform: uppercase; color: #111111; margin: 8px 0 0; }
  .mode { font-size: 11px; color: #333333; }
  .mode strong { font-weight: 600; color: #111111; }
`;

/** 09/10/2026 */
const dateCourte = (iso) => {
  const d = iso ? new Date(iso) : new Date();
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/** Identifiant de la piste ou du client, court : les 8 premiers caractères d'un UUID. */
const refClient = (ref) => {
  const r = String(ref || '').trim();
  if (!r) return '—';
  return r.length > 12 ? r.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase() : r;
};

const val = (v) => esc(String(v ?? '').trim() || '—');

const enTeteTableau = () => `
  <colgroup>
    <col style="width:32px"><col style="width:104px"><col><col style="width:40px"><col style="width:96px"><col style="width:96px">
  </colgroup>
  <thead>
    <tr><th>#</th><th>Cat.</th><th>Désignation</th><th>Qté</th><th>Prix unitaire</th><th>Prix total</th></tr>
  </thead>`;

/** Bas de la dernière page d'une facture : `totaux` puis `fin` (voir paginerFacture). */
function basFacture(data, { livraison, conditions }) {
  const e = data.emetteur;
  const t = data.totaux;
  const r = data.reglement;
  const sig = r.signataire;
  const totaux = `
  <div class="cadre">
    <div class="conditions">
      <div class="conditions-titre">Conditions</div>
      <div class="conditions-texte"><strong>Livraison :</strong> ${esc(livraison)}. ${esc(conditions)}</div>
      ${r.mention ? `<div class="conditions-texte mention">${esc(r.mention)}</div>` : ''}
    </div>
    <div class="totaux">
      <div class="rang"><span>Sous-total HT</span><span class="num">${nf(t.totalHT)}</span></div>
      ${t.remise ? `<div class="rang"><span>Remise</span><span class="num">− ${nf(t.remise)}</span></div>` : ''}
      <div class="rang"><span>TVA</span><span class="num">${t.tvaActive ? nf(t.tva) : '—'}</span></div>
      <div class="rang total"><span>TOTAL (F CFA)</span><span class="num montant">${nf(t.totalTTC)}</span></div>
      ${r.versements.map((v) => `
      <div class="rang versement"><span>${esc(v.libelle)}${v.detail ? `<small>${esc(v.detail)}</small>` : ''}</span><span class="num">− ${nf(v.montant)}</span></div>`).join('')}
      ${r.paye > 0 ? `<div class="rang reste"><span>RESTE À PAYER</span><span class="num montant">${nf(r.reste)}</span></div>` : ''}
      ${r.tropPercu > 0 ? `<div class="rang versement"><span>Trop-perçu</span><span class="num">${nf(r.tropPercu)}</span></div>` : ''}
    </div>
  </div>

  ${r.echeances.length ? `
  <div class="echeancier-titre">Échéancier de paiement</div>
  <table class="echeances">
    <colgroup><col><col style="width:184px"><col style="width:112px"><col style="width:88px"></colgroup>
    <thead><tr><th>Échéance</th><th>Date</th><th class="num">Montant</th><th>Statut</th></tr></thead>
    <tbody>${r.echeances.map((x) => `
      <tr><td>${esc(x.libelle)}</td><td>${esc(x.quand || '—')}</td><td class="num">${nf(x.montant)}</td><td><span class="statut statut-${x.statut}">${esc(x.statutLabel)}</span></td></tr>`).join('')}
    </tbody>
  </table>` : ''}`;
  const fin = `
  <div class="fin">
    <div>
      <div class="arretee">${phraseArretee(r).map(([texte, montant]) => `<div>${esc(texte)}<strong>${montantInsecable(montant)}</strong>.</div>`).join('')}</div>
      ${r.modes.length ? `<div class="modes-titre">Modes de paiement</div>${r.modes.map((m) => `<div class="mode"><strong>${esc(m.nom)}</strong>${m.detail ? ` — ${esc(m.detail)}` : ''}</div>`).join('')}` : ''}
    </div>
    <div class="signature">
      <div class="signature-nom">${esc(sig?.titre || e.name)}</div>
      <div class="signature-espace"></div>
      <div class="signature-filet"></div>
      <div class="signature-libelle">${esc(sig?.nom || 'Signature et cachet')}</div>
    </div>
  </div>`;
  return { totaux, fin };
}

export function renderSobre({ kind, data }) {
  const L = libelles(kind);
  const e = data.emetteur;
  const t = data.totaux;
  const c = data.client || {};
  // Conditions de vente : livraison et paiement, « à convenir » faute de mieux.
  const livraison = String(data.livraison || '').trim() || 'À convenir';
  const modesFacture = kind === 'facture' ? (data.reglement?.modes || []).map((m) => m.nom).join(', ') : '';
  const paiement = String(data.paiement || '').trim() || modesFacture || (e.bank?.name || 'À convenir');
  const conditions = conditionsPour(kind, e);
  const pied = [
    [e.name, e.rccm ? `RCCM ${e.rccm}` : '', e.ifu ? `${e.fiscal || 'NIF'} ${e.ifu}` : '', e.cnss ? `CNSS ${e.cnss}` : ''].filter(Boolean).join(' — '),
    e.address || '',
    [e.phone ? `Tél ${e.phone}` : '', e.email || '', e.website || ''].filter(Boolean).join(' · '),
  ];
  const ref = piedApporteur(data);
  const r = kind === 'facture' ? data.reglement : null;
  const { pages, scinder } = r
    ? paginerFacture(data.lignes, placeFactureSobre(r, e, `Livraison : ${livraison}. ${conditions}`, { pied, reference: !!ref.ligne, remise: data.totaux.remise }), { aire: AIRE, hauteurLigne: HAUTEUR_LIGNE })
    : { pages: paginer(data.lignes, capacitesPour({ nom: e.name, conditions: `Livraison : ${livraison}. ${conditions}`, pied, reference: !!ref.ligne })), scinder: false };
  const total = pages.length + (scinder ? 1 : 0);
  const condition = kind === 'facture'
    ? (data.dateSecondaire ? `Payable au ${dateCourte(data.dateSecondaire)}` : 'Payable à réception')
    : (data.dateSecondaire ? `Valable jusqu’au ${dateCourte(data.dateSecondaire)}` : '');
  const nomClient = [c.name, c.societe].filter(Boolean).join(' — ');
  let rang = 0;

  const corps = pages.map((lignes, i) => {
    const premiere = i === 0;
    const derniere = i === pages.length - 1; // dernière page de LIGNES (la page de fin éventuelle suit)
    const rows = lignes.map((l) => {
      rang += 1;
      return `
      <tr>
        <td class="centre">${rang}</td>
        <td class="cat">${esc(l.categorie || '')}</td>
        <td>${esc(l.designation)}</td>
        <td class="centre">${nf(l.qty, l.qty % 1 ? 1 : 0)}</td>
        <td class="num">${nf(l.pu)}</td>
        <td class="num">${nf(l.pu * l.qty)}</td>
      </tr>`;
    }).join('');

    return `
<section class="page">
  ${premiere ? `
  <div class="entete">
    <div>
      <div class="nom">${esc(e.name)}</div>
      ${e.slogan ? `<div class="slogan">${esc(e.slogan)}</div>` : ''}
    </div>
    <div>
      <div class="titre">${L.titre}</div>
      <div class="meta">${L.numeroLabel} ${esc(data.numero || '—')}</div>
      ${condition ? `<div class="meta">${condition}</div>` : ''}
      <div class="meta">Date : ${dateCourte(data.date)}</div>
      ${r?.miseAJour ? `<div class="meta">Mise à jour : ${jourFr(r.miseAJour)}</div>` : ''}
    </div>
  </div>

  <div class="client">
    <div class="champs">
      <div class="lib">Client</div><div>${val(nomClient)}</div>
      <div class="lib">${esc(e.fiscal || 'NIF')}</div><div>${val(c.ifu)}</div>
      <div class="lib">Adresse</div><div>${val(c.adresse)}</div>
      <div class="lib">Objet</div><div>${val(data.objet)}</div>
      <div class="lib">Tél</div><div>${val(c.phone)}</div>
      <div class="lib">Email</div><div>${val(c.email)}</div>
    </div>
    <div class="droite">
      <div><span class="lib">Client ID</span> ${esc(refClient(c.ref))}</div>
      <div class="vide"></div>
      <div><span class="lib">Livraison</span> ${esc(livraison)}</div>
      <div><span class="lib">Paiement</span> ${esc(paiement)}</div>
      <div><span class="lib">Devise</span> Franc CFA</div>
    </div>
  </div>` : `
  <div class="suite">${L.titre} ${esc(data.numero || '')} — suite (page ${i + 1} / ${total})</div>`}

  ${lignes.length || premiere ? `<table class="lignes">
    ${enTeteTableau()}
    <tbody>${rows}</tbody>
  </table>` : ''}

  ${derniere && r ? `${basFacture(data, { livraison, conditions }).totaux}${scinder ? '' : basFacture(data, { livraison, conditions }).fin}
  ${ref.ligne}
  <div class="pied ${ref.push}">${pied.filter(Boolean).map((ligne) => `<div>${esc(ligne)}</div>`).join('')}</div>` : ''}
  ${derniere && !r ? `
  <div class="cadre">
    <div class="conditions">
      <div class="conditions-titre">Conditions</div>
      <div class="conditions-texte"><strong>Livraison :</strong> ${esc(livraison)}. ${esc(conditions)}</div>
    </div>
    <div class="totaux">
      <div class="rang"><span>Sous-total HT</span><span class="num">${nf(t.totalHT)}</span></div>
      ${t.remise ? `<div class="rang"><span>Remise</span><span class="num">− ${nf(t.remise)}</span></div>` : ''}
      <div class="rang"><span>TVA</span><span class="num">${t.tvaActive ? nf(t.tva) : '—'}</span></div>
      <div class="rang total"><span>TOTAL (F CFA)</span><span class="num montant">${nf(t.totalTTC)}</span></div>
    </div>
  </div>

  <div class="signature">
    <div class="signature-nom">${esc(e.name)}</div>
    <div class="signature-espace"></div>
    <div class="signature-filet"></div>
    <div class="signature-libelle">Signature et cachet</div>
  </div>

  ${ref.ligne}
  <div class="pied ${ref.push}">${pied.filter(Boolean).map((ligne) => `<div>${esc(ligne)}</div>`).join('')}</div>` : ''}
</section>`;
  });

  if (scinder) {
    corps.push(`
<section class="page page-fin">
  <div class="suite">${L.titre} ${esc(data.numero || '')} — suite (page ${total} / ${total})</div>
  ${basFacture(data, { livraison, conditions }).fin}
  <div class="pied push">${pied.filter(Boolean).map((ligne) => `<div>${esc(ligne)}</div>`).join('')}</div>
</section>`);
  }

  return documentHtml({
    titre: `${L.titre} ${data.numero} — ${c.name || ''}`,
    css: CSS_SOBRE,
    pages: corps,
  });
}
