// Modèle A — Studio. Modèle par défaut, seul disponible côté public.
// Couleur primaire structurante (navy par défaut), secondaire strictement
// réservée aux trois pastilles, montant focal en primaire. En Pro, ce sont les
// couleurs de l'abonné (couleurPrimaire / couleurSecondaire) qui s'appliquent.
// Marges 40 px, angles 8 px (blocs) / 6 px (pastilles, totaux).
import { nf, esc, dateFr, libelles, conditionsPour, paginer, documentHtml, piedApporteur, identifiantsDe } from './shared';
import { phraseArretee, lignesTexte, paginerFacture, montantInsecable, cssStatuts, hauteurLigneArticle } from './reglement';
import { jourFr } from '../date';
import { styleLogo } from '../logo';

// Capacités mesurées dans le navigateur (voir paginer).
const CAPACITES = { seule: 9, premiere: 11, suite: 16, derniere: 8 };
// Factures : découpe à la hauteur (voir paginerFacture) — place réelle des
// pages, hauteur de chaque ligne selon sa désignation, place du règlement.
const AIRE = { premiere: 673, suite: 912 }; // place des lignes sous l'en-tête du tableau (px, mesurée)
const HAUTEUR_LIGNE = hauteurLigneArticle({ base: 17, texte: 19.5, parLigne: 48 });

/** Hauteur (px) d'une liste de modes de paiement : nom, coordonnée sous le nom. */
const hauteurModes = (modes, parLigne) => 30 + Math.max(1, modes.length) * 28
  + modes.reduce((h, m) => h + (m.detail ? lignesTexte(m.detail, parLigne) * 17 : 0), 0);

/**
 * Place que prend le règlement d'une facture (px, estimation prudente vérifiée
 * dans le navigateur) : `haut` en plus sur la 1ʳᵉ page, `bloc` tout le bas de
 * la dernière (totaux, montant en lettres, échéancier, signature, conditions).
 */
export function placeFactureStudio(r, e, conditions) {
  const ids = identifiantsDe(e).length;
  const haut = (r.miseAJour ? 18 : 0) + Math.max(0, 16 + ids * 17 - 36);
  const totaux = 52 + 59 + r.versements.reduce((h, v) => h + 28 + (v.detail ? 17 : 0), 0)
    + (r.paye > 0 ? 59 : 0) + (r.tropPercu > 0 ? 28 : 0) + (r.mention ? 8 + lignesTexte(r.mention, 50) * 17 : 0);
  const echeancier = r.echeances.length
    ? 30 + 30 + r.echeances.reduce((h, x) => h + 14 + lignesTexte(x.libelle, 22) * 20 + (x.quand ? lignesTexte(x.quand, 26) * 17 : 0), 0)
    : 0;
  const gauche = r.echeances.length ? echeancier : hauteurModes(r.modes, 44);
  const arretee = 26 + phraseArretee(r).reduce((h, [a, b]) => h + lignesTexte(a + b, 92) * 20, 0);
  const merci = Math.max(27 + (r.echeances.length ? 8 + hauteurModes(r.modes, 44) : 0), 17 + (r.signataire?.cachet ? 84 : 64) + 5 + (r.signataire?.nom ? 24 : 0));
  const blocConditions = 30 + lignesTexte(conditions, 110) * 17;
  const partieTotaux = 16 + Math.max(gauche, totaux) + 16 + arretee;
  return { haut, totaux: partieTotaux, bloc: partieTotaux + 16 + merci + 16 + blocConditions };
}

const cssPour = (p, s) => `
  .page { padding: 40px; color: #3a3a3a; }
  .micro { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; color: #6b6b6b; }
  .val { font-size: 13px; }
  .navy { color: ${p}; font-weight: 600; }

  .bandeau { display: flex; align-items: flex-end; gap: 32px; padding-bottom: 16px; border-bottom: 1px solid #e5e5e5; }
  /* Taille selon les proportions du logo (utils/logo.js), en style en ligne. */
  .bandeau img { display: block; flex-shrink: 0; }
  .bandeau-col { min-width: 160px; }

  .titre-rang { display: flex; align-items: center; justify-content: space-between; gap: 32px; margin-top: 16px; }
  .pave { background: ${p}; border-radius: 8px; padding: 16px 32px; }
  .pave-texte { font-size: 28px; font-weight: 600; color: #fff; letter-spacing: 4px; }
  .titre-meta { text-align: right; }
  .titre-meta > div + div { margin-top: 8px; }

  .triptyque { display: grid; grid-template-columns: 1fr 1fr 240px; gap: 32px; margin-top: 16px; }
  .triptyque .val + .val { margin-top: 4px; }
  .pastille { display: inline-block; background: ${s}; color: ${p}; border-radius: 6px; padding: 4px 12px;
              font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; }
  .focal { text-align: right; }
  .focal-montant { font-size: 28px; font-weight: 600; color: ${p}; line-height: 1.2; margin-top: 8px; }
  .focal-unite { font-size: 11px; color: #6b6b6b; }
  .focal-date { margin-top: 8px; }

  table.lignes { margin-top: 16px; }
  table.lignes th { background: ${p}; color: #fff; font-size: 11px; font-weight: 600; text-transform: uppercase;
                    letter-spacing: 0.5px; text-align: left; padding: 10px 12px; }
  table.lignes th.num { text-align: right; }
  table.lignes th:first-child { border-radius: 8px 0 0 8px; }
  table.lignes th:last-child { border-radius: 0 8px 8px 0; }
  table.lignes td { padding: 8px 12px; border-bottom: 1px solid #e5e5e5; font-size: 13px; }
  table.lignes td:first-child { height: 32px; box-sizing: border-box; }
  table.lignes td.montant { font-weight: 600; color: ${p}; }

  .bas { display: grid; grid-template-columns: 1fr 328px; gap: 32px; margin-top: 16px; }
  .banque-ligne { margin-top: 8px; }
  .banque-ligne .val { border-bottom: 1px solid #e5e5e5; padding-bottom: 4px; }
  .totaux-bloc { background: #f7f8fb; border-radius: 6px; padding: 16px; }
  .totaux-ligne { display: flex; justify-content: space-between; gap: 16px; font-size: 13px; }
  .totaux-ligne + .totaux-ligne { margin-top: 8px; }
  .total-barre { display: flex; justify-content: space-between; align-items: center; gap: 16px;
                 background: ${p}; border-radius: 8px; padding: 12px 16px; margin-top: 8px; }
  .total-barre .libelle { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; color: #fff; }
  .total-barre .montant { font-size: 18px; font-weight: 600; color: #fff; }

  .merci { display: grid; grid-template-columns: 1fr 328px; gap: 32px; margin-top: 16px; }
  .merci-titre { font-size: 18px; font-weight: 600; color: ${p}; }
  .conditions { font-size: 11px; color: #6b6b6b; margin-top: 8px; }

  .pied { padding-top: 8px; border-top: 1px solid #e5e5e5; display: flex; justify-content: space-between;
          gap: 24px; font-size: 11px; color: #6b6b6b; }

  /* ---- Facture : règlement ---- */
  .ids { font-size: 11px; line-height: 1.5; white-space: nowrap; }
  .bandeau.avec-ids .bandeau-col { min-width: 0; }
  .bandeau.avec-ids .bandeau-col:last-child { margin-left: auto; }
  .maj { font-size: 11px; color: #6b6b6b; margin-top: 2px; }
  .mode { border-bottom: 1px solid #e5e5e5; padding-bottom: 4px; }
  .mode .val { font-weight: 600; border-bottom: none; padding-bottom: 0; }
  .mode .detail { font-size: 11px; color: #6b6b6b; }
  .insecable { white-space: nowrap; }
  .versement { display: flex; justify-content: space-between; gap: 16px; padding: 8px 16px 0; font-size: 13px; }
  .versement small { display: block; font-size: 11px; color: #6b6b6b; }
  .versement .navy { white-space: nowrap; }
  .reste-barre { display: flex; justify-content: space-between; align-items: center; gap: 16px;
                 background: ${s}; border-radius: 8px; padding: 12px 16px; margin-top: 8px; }
  .reste-barre .libelle { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; color: ${p}; }
  .reste-barre .montant { font-size: 18px; font-weight: 600; color: ${p}; }
  .trop { display: flex; justify-content: space-between; gap: 16px; padding: 8px 16px 0; font-size: 13px; font-weight: 600; }
  .mention { font-size: 11px; color: #6b6b6b; margin-top: 8px; }
  .arretee { margin-top: 16px; padding: 12px 16px; border: 1px solid #e5e5e5; border-radius: 6px; font-size: 13px; }
  .arretee strong { font-weight: 600; color: ${p}; }
  table.echeances { margin-top: 8px; }
  table.echeances th { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6b6b6b;
                       text-align: left; padding: 6px 8px; border-bottom: 2px solid ${p}; }
  table.echeances th.num { text-align: right; }
  table.echeances td { padding: 6px 8px; border-bottom: 1px solid #e5e5e5; font-size: 13px; vertical-align: middle; }
  table.echeances th:first-child, table.echeances td:first-child { padding-left: 0; }
  table.echeances th:last-child, table.echeances td:last-child { padding-right: 0; }
  table.echeances td small { display: block; font-size: 11px; color: #6b6b6b; }
  .statut { display: inline-block; border-radius: 6px; padding: 2px 8px; font-size: 11px; font-weight: 600; white-space: nowrap; }
  ${cssStatuts()}
  .signature { text-align: center; }
  .signature img { display: block; max-width: 220px; max-height: 80px; margin: 4px auto 0; }
  .signature-espace { height: 64px; }
  .signature-filet { border-top: 1px solid #e5e5e5; margin-top: 4px; }
  .signature-nom { font-size: 13px; font-weight: 600; color: ${p}; margin-top: 4px; }
  .conditions-bloc { margin-top: 16px; }
  .conditions-bloc .conditions { margin-top: 4px; }
  .page-fin .merci { margin-top: 24px; }
`;

const listeModes = (r) => (r.modes.length ? r.modes.map((m) => `
      <div class="banque-ligne mode"><div class="val">${esc(m.nom)}</div>${m.detail ? `<div class="detail">${esc(m.detail)}</div>` : ''}</div>`).join('')
  : '<div class="banque-ligne"><div class="val">Règlement à convenir avec l’émetteur.</div></div>');

/**
 * Bas de la dernière page d'une facture, en deux parties : `totaux` (totaux,
 * acomptes, reste à payer, échéancier, montant en lettres) puis `fin`
 * (modes de paiement, signature, conditions). Ensemble, sauf quand le tout
 * ne tient pas sur une page : `fin` passe alors sur la suivante.
 */
function basFacture(kind, data) {
  const e = data.emetteur;
  const t = data.totaux;
  const r = data.reglement;
  const sig = r.signataire;
  const totaux = `
  <div class="bas">
    <div>
      ${r.echeances.length ? `
      <span class="pastille">Échéancier de paiement</span>
      <table class="echeances">
        <colgroup><col><col style="width:104px"><col style="width:84px"></colgroup>
        <thead><tr><th>Échéance</th><th class="num">Montant</th><th>Statut</th></tr></thead>
        <tbody>${r.echeances.map((x) => `
          <tr><td>${esc(x.libelle)}${x.quand ? `<small>${esc(x.quand)}</small>` : ''}</td><td class="num">${nf(x.montant)}</td><td><span class="statut statut-${x.statut}">${esc(x.statutLabel)}</span></td></tr>`).join('')}
        </tbody>
      </table>` : `
      <span class="pastille">Modalités de règlement</span>${listeModes(r)}`}
    </div>
    <div>
      <div class="totaux-bloc">
        <div class="totaux-ligne"><span>Sous-total HT (F CFA)</span><span class="navy">${nf(t.totalHT)}</span></div>
        ${t.remise ? `<div class="totaux-ligne"><span>Remise (F CFA)</span><span class="navy">− ${nf(t.remise)}</span></div>` : ''}
        ${t.tvaActive ? `<div class="totaux-ligne"><span>TVA (F CFA)</span><span class="navy">${nf(t.tva)}</span></div>` : ''}
      </div>
      <div class="total-barre">
        <span class="libelle">Total net à payer (F CFA)</span>
        <span class="montant">${nf(t.totalTTC)}</span>
      </div>
      ${r.versements.map((v) => `
      <div class="versement"><span>${esc(v.libelle)}${v.detail ? `<small>${esc(v.detail)}</small>` : ''}</span><span class="navy">− ${nf(v.montant)}</span></div>`).join('')}
      ${r.paye > 0 ? `
      <div class="reste-barre"><span class="libelle">Reste à payer (F CFA)</span><span class="montant">${nf(r.reste)}</span></div>` : ''}
      ${r.tropPercu > 0 ? `<div class="trop"><span>Trop-perçu (F CFA)</span><span>${nf(r.tropPercu)}</span></div>` : ''}
      ${r.mention ? `<div class="mention">${esc(r.mention)}</div>` : ''}
    </div>
  </div>

  <div class="arretee">${phraseArretee(r).map(([texte, montant]) => `<div>${esc(texte)}<strong>${montantInsecable(montant)}</strong>.</div>`).join('')}</div>`;
  const fin = `
  <div class="merci">
    <div>
      <div class="merci-titre">Merci de votre confiance.</div>
      ${r.echeances.length ? `<div style="margin-top:8px"><span class="pastille">Modalités de règlement</span>${listeModes(r)}</div>` : ''}
    </div>
    <div class="signature">
      <div class="micro">${esc(sig?.titre || 'Signature et cachet')}</div>
      ${sig?.cachet ? `<img src="${esc(sig.cachet)}" alt="Signature et cachet">` : '<div class="signature-espace"></div>'}
      <div class="signature-filet"></div>
      ${sig?.nom ? `<div class="signature-nom">${esc(sig.nom)}</div>` : ''}
    </div>
  </div>

  <div class="conditions-bloc"><span class="pastille">Conditions générales</span><div class="conditions">${esc(conditionsPour(kind, e))}</div></div>`;
  return { totaux, fin };
}

const enTeteTableau = () => `
  <thead>
    <tr>
      <th>Désignation</th>
      <th class="num" style="width:136px">P.U. (F CFA)</th>
      <th class="num" style="width:80px">Quantité</th>
      <th class="num" style="width:136px">Total (F CFA)</th>
    </tr>
  </thead>`;

const ligne = (l) => `
  <tr>
    <td>${esc(l.designation)}</td>
    <td class="num">${nf(l.pu)}</td>
    <td class="num">${nf(l.qty, l.qty % 1 ? 1 : 0)}</td>
    <td class="num montant">${nf(l.pu * l.qty)}</td>
  </tr>`;

export function renderStudio({ kind, data }) {
  const L = libelles(kind);
  const e = data.emetteur;
  const t = data.totaux;
  const r = kind === 'facture' ? data.reglement : null;
  const { pages, scinder } = r
    ? paginerFacture(data.lignes, placeFactureStudio(r, e, conditionsPour(kind, e)), { aire: AIRE, hauteurLigne: HAUTEUR_LIGNE })
    : { pages: paginer(data.lignes, CAPACITES), scinder: false };
  const bas = r ? basFacture(kind, data) : null;
  const ref = piedApporteur(data);
  const ids = identifiantsDe(e);
  const total = pages.length + (scinder ? 1 : 0);

  const corps = pages.map((lignes, i) => {
    const premiere = i === 0;
    const derniere = i === pages.length - 1; // dernière page de LIGNES (la page de fin éventuelle suit)
    return `
<section class="page">
  ${premiere ? `
  <div class="bandeau${r && ids.length ? ' avec-ids' : ''}">
    ${e.logo ? `<img src="${e.logo}" alt="${esc(e.name)}" style="${styleLogo(e.logo)}">` : `<div class="navy" style="font-size:18px">${esc(e.name)}</div>`}
    <div class="bandeau-col"><div class="micro">Adresse</div><div class="val">${esc(e.address || '—')}</div></div>
    <div class="bandeau-col"><div class="micro">Téléphone</div><div class="val">${esc(e.phone || '—')}</div></div>
    ${r && ids.length ? `<div class="bandeau-col"><div class="micro">Identifiants</div>${ids.map((x) => `<div class="ids">${esc(x)}</div>`).join('')}</div>` : ''}
  </div>

  <div class="titre-rang">
    <div class="pave"><div class="pave-texte">${L.titre}</div></div>
    <div class="titre-meta">
      <div><div class="micro">${L.numeroLabel}</div><div class="val navy">${esc(data.numero || '—')}</div></div>
      <div><div class="micro">Date d’émission</div><div class="val navy">${dateFr(data.date)}</div>${r?.miseAJour ? `<div class="maj">Mise à jour le ${jourFr(r.miseAJour)}</div>` : ''}</div>
    </div>
  </div>

  <div class="triptyque">
    <div>
      <div class="micro">Émis par</div>
      <div class="val navy" style="margin-top:8px">${esc(e.name)}</div>
      <div class="val">${esc(e.phone || '—')}</div>
      <div class="val">${esc(e.email || '—')}</div>
    </div>
    <div>
      <div class="micro">${L.destinataire}</div>
      <div class="val navy" style="margin-top:8px">${esc(data.client.name)}</div>
      ${data.client.societe ? `<div class="val">${esc(data.client.societe)}</div>` : ''}
      <div class="val">${esc(data.client.phone || '—')}</div>
      <div class="val">${esc(data.client.adresse || '—')}</div>
    </div>
    <div class="focal">
      <span class="pastille">${r?.paye > 0 ? 'Reste à payer' : 'Total à régler'}</span>
      <div class="focal-montant">${nf(r?.paye > 0 ? r.reste : t.totalTTC)}</div>
      <div class="focal-unite">F CFA, prix tout compris</div>
      <div class="focal-date micro">${L.dateSecondaireLabel}</div>
      <div class="val navy">${data.dateSecondaire ? dateFr(data.dateSecondaire) : '—'}</div>
    </div>
  </div>` : `
  <div class="bandeau">
    <div class="navy" style="font-size:18px">${esc(e.name)}</div>
    <div class="bandeau-col"><div class="micro">${L.numeroLabel}</div><div class="val navy">${esc(data.numero || '—')}</div></div>
    <div class="bandeau-col"><div class="micro">${L.destinataire}</div><div class="val">${esc(data.client.name)}</div></div>
  </div>`}

  <table class="lignes">
    ${enTeteTableau()}
    <tbody>${lignes.map(ligne).join('')}</tbody>
  </table>

  ${derniere && r ? `${bas.totaux}${scinder ? '' : bas.fin}` : ''}
  ${derniere && !r ? `
  <div class="bas">
    <div>
      <span class="pastille">Modalités de règlement</span>
      ${e.bank ? `
      <div class="banque-ligne"><div class="micro">Banque</div><div class="val">${esc(e.bank.name)}</div></div>
      <div class="banque-ligne"><div class="micro">Numéro de compte</div><div class="val">${esc(e.bank.account)}</div></div>
      ${e.bank.swift ? `<div class="banque-ligne"><div class="micro">Code SWIFT</div><div class="val">${esc(e.bank.swift)}</div></div>` : ''}`
      : '<div class="banque-ligne"><div class="val">Règlement à convenir avec l’émetteur.</div></div>'}
    </div>
    <div>
      <div class="totaux-bloc">
        <div class="totaux-ligne"><span>Sous-total HT (F CFA)</span><span class="navy">${nf(t.totalHT)}</span></div>
        ${t.remise ? `<div class="totaux-ligne"><span>Remise (F CFA)</span><span class="navy">− ${nf(t.remise)}</span></div>` : ''}
        ${t.tvaActive ? `<div class="totaux-ligne"><span>TVA (F CFA)</span><span class="navy">${nf(t.tva)}</span></div>` : ''}
      </div>
      <div class="total-barre">
        <span class="libelle">Total général (F CFA)</span>
        <span class="montant">${nf(t.totalTTC)}</span>
      </div>
    </div>
  </div>

  <div class="merci">
    <div class="merci-titre">Merci de votre confiance.</div>
    <div>
      <span class="pastille">Conditions générales</span>
      <div class="conditions">${esc(conditionsPour(kind, e))}</div>
    </div>
  </div>` : ''}

  ${ref.ligne}
  <div class="pied ${ref.push}">
    <span>${esc(e.name)}${e.rccm ? ` · RCCM ${esc(e.rccm)}` : ''}${e.ifu ? ` · ${esc(e.fiscal || 'NIF')} ${esc(e.ifu)}` : ''}${e.cnss ? ` · CNSS ${esc(e.cnss)}` : ''}</span>
    <span>${[esc(e.website || e.email || ''), total > 1 ? `Page ${i + 1} / ${total}` : ''].filter(Boolean).join(' · ')}</span>
  </div>
</section>`;
  });
  if (scinder) {
    corps.push(`
<section class="page page-fin">
  <div class="bandeau">
    <div class="navy" style="font-size:18px">${esc(e.name)}</div>
    <div class="bandeau-col"><div class="micro">${L.numeroLabel}</div><div class="val navy">${esc(data.numero || '—')}</div></div>
    <div class="bandeau-col"><div class="micro">${L.destinataire}</div><div class="val">${esc(data.client.name)}</div></div>
  </div>
  ${bas.fin}
  <div class="pied push">
    <span>${esc(e.name)}${ids.length ? ` · ${ids.map(esc).join(' · ')}` : ''}</span>
    <span>${[esc(e.website || e.email || ''), `Page ${total} / ${total}`].filter(Boolean).join(' · ')}</span>
  </div>
</section>`);
  }

  return documentHtml({
    titre: `${L.titre} ${data.numero} — ${data.client.name}`,
    css: cssPour(e.couleurPrimaire, e.couleurSecondaire),
    pages: corps,
  });
}
