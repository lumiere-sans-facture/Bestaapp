// Modèle B — Vague. Bandeaux décoratifs SVG à fond plat (jamais de dégradé),
// en-tête de tableau gris clair (c'est ce qui le distingue de Studio),
// couleur secondaire réservée aux traits de titre, au filet du total et au
// montant du total. En Pro, les couleurs de l'abonné remplacent navy/orange ;
// la vague claire est une teinte éclaircie de la primaire.
import { nf, esc, dateFr, libelles, conditionsPour, paginer, documentHtml, piedApporteur, eclaircir, identifiantsDe } from './shared';
import { phraseArretee, lignesTexte, paginerFacture, montantInsecable, cssStatuts, hauteurLigneArticle } from './reglement';
import { jourFr } from '../date';
import { styleLogo } from '../logo';

// Capacités mesurées dans le navigateur (voir paginer).
const CAPACITES = { seule: 9, premiere: 10, suite: 14, derniere: 8 };
// Factures : découpe à la hauteur (voir paginerFacture).
const AIRE = { premiere: 676, suite: 854 }; // place des lignes sous l'en-tête du tableau (px, mesurée)
const HAUTEUR_LIGNE = hauteurLigneArticle({ base: 17, texte: 19.5, parLigne: 46 });

const hauteurModes = (modes) => 27 + 19 + Math.max(1, modes.length) * 24
  + modes.reduce((h, m) => h + (m.detail ? lignesTexte(m.detail, 50) * 18 : 0), 0);

/** Place du règlement d'une facture (px, estimation prudente vérifiée dans le navigateur). */
export function placeFactureVague(r, e, conditions) {
  // Identifiants sous les coordonnées ; « Mise à jour » et « Reste à payer »
  // sous l'échéance, quand la colonne de droite dépasse celle du client.
  const meta = (3 + (r.miseAJour ? 1 : 0) + (r.paye > 0 ? 1 : 0)) * 28;
  const haut = identifiantsDe(e).length * 17 + Math.max(0, meta - 124);
  const totaux = 20 + 43 + r.versements.reduce((h, v) => h + 28 + (v.detail ? 17 : 0), 0)
    + (r.paye > 0 ? 54 : 0) + (r.tropPercu > 0 ? 28 : 0) + (r.mention ? 8 + lignesTexte(r.mention, 44) * 17 : 0) + 28; // + remise / TVA éventuelles
  const echeancier = r.echeances.length
    ? 27 + 19 + 30 + r.echeances.reduce((h, x) => h + 14 + lignesTexte(x.libelle, 24) * 20 + (x.quand ? lignesTexte(x.quand, 30) * 17 : 0), 0)
    : 0;
  const gauche = r.echeances.length ? echeancier : hauteurModes(r.modes);
  const arretee = 26 + phraseArretee(r).reduce((h, [a, b]) => h + lignesTexte(a + b, 88) * 20, 0);
  const merci = Math.max(27 + (r.echeances.length ? 16 + hauteurModes(r.modes) : 0), 17 + (r.signataire?.cachet ? 84 : 64) + 5 + (r.signataire?.nom ? 24 : 0));
  const blocConditions = 27 + 19 + lignesTexte(conditions, 104) * 17;
  const partieTotaux = 16 + Math.max(gauche, totaux) + 16 + arretee;
  return { haut, totaux: partieTotaux, bloc: partieTotaux + 16 + merci + 16 + blocConditions };
}

const cssPour = (p, s) => `
  .page { color: #3a3a3a; }
  .corps { padding: 0 56px; position: relative; z-index: 1; display: flex; flex-direction: column; flex: 1; }
  .micro { font-size: 11px; color: #6b6b6b; }
  .navy { color: ${p}; }
  .titre-bloc { font-size: 18px; font-weight: 600; color: ${p}; }
  .trait { width: 40px; height: 3px; background: ${s}; margin: 8px 0; }

  .vague-haute { position: relative; height: 112px; flex-shrink: 0; }
  .vague-basse { height: 72px; flex-shrink: 0; }
  .vague-haute svg, .vague-basse svg { display: block; width: 100%; height: 100%; }
  .vague-titre { position: absolute; top: 32px; left: 56px; font-size: 28px; font-weight: 600; color: #fff; letter-spacing: 4px; }

  .identite { display: flex; align-items: flex-start; justify-content: space-between; gap: 32px; padding-top: 8px; }
  /* Taille selon les proportions du logo (utils/logo.js), en style en ligne. */
  .identite img { display: block; flex-shrink: 0; }

  .client-rang { display: grid; grid-template-columns: 1fr 288px; gap: 32px; margin-top: 16px; }
  .meta-ligne { display: flex; justify-content: space-between; gap: 16px; font-size: 13px; }
  .meta-ligne + .meta-ligne { margin-top: 8px; }
  .meta-ligne .libelle { font-weight: 600; color: ${p}; }

  table.lignes { margin-top: 16px; }
  table.lignes th { background: #f2f3f7; color: ${p}; font-size: 11px; font-weight: 600; text-transform: uppercase;
                    letter-spacing: 0.5px; text-align: left; padding: 10px 12px; }
  table.lignes th.num { text-align: right; }
  table.lignes td { padding: 8px 12px; border-bottom: 1px solid #e5e5e5; font-size: 13px; }
  table.lignes td:first-child { height: 32px; box-sizing: border-box; }
  table.lignes th.ordre, table.lignes td:first-child { padding-left: 8px; padding-right: 8px; }

  .bas { display: grid; grid-template-columns: 1fr 288px; gap: 32px; margin-top: 16px; }
  .totaux-ligne { display: flex; justify-content: space-between; gap: 16px; font-size: 13px; }
  .totaux-ligne + .totaux-ligne { margin-top: 8px; }
  .total-final { display: flex; justify-content: space-between; align-items: baseline; gap: 16px;
                 border-top: 2px solid ${s}; margin-top: 8px; padding-top: 8px; }
  .total-final .libelle { font-size: 13px; font-weight: 600; color: ${p}; }
  .total-final .montant { font-size: 18px; font-weight: 600; color: ${s}; }

  .conditions { font-size: 11px; color: #6b6b6b; }
  .legal { display: flex; justify-content: space-between; gap: 24px; font-size: 11px; color: #6b6b6b; margin-top: 16px; }
  .filigrane { position: absolute; inset: 0; z-index: 0; opacity: 0.07; background-size: cover; background-position: center; }

  /* ---- Facture : règlement ---- */
  .insecable { white-space: nowrap; }
  .maj { font-style: italic; }
  .versement { display: flex; justify-content: space-between; gap: 16px; font-size: 13px; margin-top: 8px; }
  .versement small { display: block; font-size: 11px; color: #6b6b6b; }
  .versement .navy { white-space: nowrap; }
  .reste-final { display: flex; justify-content: space-between; align-items: center; gap: 16px;
                 background: ${p}; padding: 10px 12px; margin-top: 8px; }
  .reste-final .libelle { font-size: 13px; font-weight: 600; color: #fff; }
  .reste-final .montant { font-size: 18px; font-weight: 600; color: #fff; }
  .trop { display: flex; justify-content: space-between; gap: 16px; font-size: 13px; font-weight: 600; margin-top: 8px; }
  .mention { font-size: 11px; color: #6b6b6b; margin-top: 8px; }
  .arretee { margin-top: 16px; padding: 12px 16px; border-left: 3px solid ${s}; background: #f7f8fb; font-size: 13px; }
  .arretee strong { font-weight: 600; color: ${p}; }
  .mode + .mode { margin-top: 4px; }
  .mode .nom { font-size: 13px; font-weight: 600; color: ${p}; }
  table.echeances { margin-top: 0; }
  table.echeances th { background: #f2f3f7; color: ${p}; font-size: 11px; font-weight: 600; text-transform: uppercase;
                       letter-spacing: 0.5px; text-align: left; padding: 8px; }
  table.echeances th.num { text-align: right; }
  table.echeances td { padding: 6px 8px; border-bottom: 1px solid #e5e5e5; font-size: 13px; vertical-align: middle; }
  table.echeances td small { display: block; font-size: 11px; color: #6b6b6b; }
  .statut { display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: 600; white-space: nowrap; }
  ${cssStatuts()}
  .fin-rang { display: grid; grid-template-columns: 1fr 288px; gap: 32px; margin-top: 16px; }
  .signature { text-align: center; }
  .signature .micro { font-weight: 600; color: ${p}; }
  .signature img { display: block; max-width: 220px; max-height: 80px; margin: 4px auto 0; }
  .signature-espace { height: 64px; }
  .signature-filet { border-top: 1px solid #c9ccd4; margin-top: 4px; }
  .signature-nom { font-size: 13px; font-weight: 600; color: ${p}; margin-top: 4px; }
`;

const listeModes = (r) => (r.modes.length
  ? r.modes.map((m) => `<div class="mode"><div class="nom">${esc(m.nom)}</div>${m.detail ? `<div class="micro">${esc(m.detail)}</div>` : ''}</div>`).join('')
  : '<div class="micro">Règlement à convenir avec l’émetteur.</div>');

/** Bas de la dernière page d'une facture : `totaux` puis `fin` (voir paginerFacture). */
function basFacture(kind, data) {
  const e = data.emetteur;
  const t = data.totaux;
  const r = data.reglement;
  const sig = r.signataire;
  const totaux = `
    <div class="bas">
      <div>
        ${r.echeances.length ? `
        <div class="titre-bloc">Échéancier de paiement</div>
        <div class="trait"></div>
        <table class="echeances">
          <colgroup><col><col style="width:104px"><col style="width:84px"></colgroup>
          <thead><tr><th>Échéance</th><th class="num">Montant</th><th>Statut</th></tr></thead>
          <tbody>${r.echeances.map((x) => `
            <tr><td>${esc(x.libelle)}${x.quand ? `<small>${esc(x.quand)}</small>` : ''}</td><td class="num">${nf(x.montant)}</td><td><span class="statut statut-${x.statut}">${esc(x.statutLabel)}</span></td></tr>`).join('')}
          </tbody>
        </table>` : `
        <div class="titre-bloc">Modes de paiement</div>
        <div class="trait"></div>
        ${listeModes(r)}`}
      </div>
      <div>
        <div class="totaux-ligne"><span>Sous-total HT (F CFA)</span><span class="navy">${nf(t.totalHT)}</span></div>
        ${t.remise ? `<div class="totaux-ligne"><span>Remise (F CFA)</span><span class="navy">− ${nf(t.remise)}</span></div>` : ''}
        ${t.tvaActive ? `<div class="totaux-ligne"><span>TVA (F CFA)</span><span class="navy">${nf(t.tva)}</span></div>` : ''}
        <div class="total-final"><span class="libelle">Total net à payer (F CFA)</span><span class="montant">${nf(t.totalTTC)}</span></div>
        ${r.versements.map((v) => `
        <div class="versement"><span>${esc(v.libelle)}${v.detail ? `<small>${esc(v.detail)}</small>` : ''}</span><span class="navy">− ${nf(v.montant)}</span></div>`).join('')}
        ${r.paye > 0 ? `<div class="reste-final"><span class="libelle">Reste à payer (F CFA)</span><span class="montant">${nf(r.reste)}</span></div>` : ''}
        ${r.tropPercu > 0 ? `<div class="trop"><span>Trop-perçu (F CFA)</span><span>${nf(r.tropPercu)}</span></div>` : ''}
        ${r.mention ? `<div class="mention">${esc(r.mention)}</div>` : ''}
      </div>
    </div>

    <div class="arretee">${phraseArretee(r).map(([texte, montant]) => `<div>${esc(texte)}<strong>${montantInsecable(montant)}</strong>.</div>`).join('')}</div>`;
  const fin = `
    <div class="fin-rang">
      <div>
        <div class="titre-bloc">Merci de votre confiance.</div>
        ${r.echeances.length ? `<div style="margin-top:16px"><div class="titre-bloc">Modes de paiement</div><div class="trait"></div>${listeModes(r)}</div>` : ''}
      </div>
      <div class="signature">
        <div class="micro">${esc(sig?.titre || 'Signature et cachet')}</div>
        ${sig?.cachet ? `<img src="${esc(sig.cachet)}" alt="Signature et cachet">` : '<div class="signature-espace"></div>'}
        <div class="signature-filet"></div>
        ${sig?.nom ? `<div class="signature-nom">${esc(sig.nom)}</div>` : ''}
      </div>
    </div>

    <div style="margin-top:16px">
      <div class="titre-bloc">Conditions générales</div>
      <div class="trait"></div>
      <div class="conditions">${esc(conditionsPour(kind, e))}</div>
    </div>`;
  return { totaux, fin };
}

/** Ruban supérieur : deux tracés pleins, teinte claire puis primaire par-dessus. */
const vagueHaute = (titre, p, clair) => `
  <div class="vague-haute">
    <svg viewBox="0 0 794 136" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0,0 H794 V72 C620,120 420,40 250,96 C160,126 70,120 0,104 Z" fill="${clair}"></path>
      <path d="M0,0 H794 V44 C640,92 430,16 250,68 C160,94 70,88 0,72 Z" fill="${p}"></path>
    </svg>
    <div class="vague-titre">${titre}</div>
  </div>`;

/** Ruban inférieur : miroir du supérieur, masse à droite. */
const vagueBasse = (p, clair) => `
  <div class="vague-basse">
    <svg viewBox="0 0 794 96" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0,96 H794 V16 C650,-8 500,64 320,40 C200,24 90,56 0,40 Z" fill="${clair}"></path>
      <path d="M0,96 H794 V48 C660,24 520,88 340,64 C210,46 100,78 0,64 Z" fill="${p}"></path>
    </svg>
  </div>`;

const enTeteTableau = () => `
  <thead>
    <tr>
      <th class="ordre" style="width:44px">N°</th>
      <th>Désignation</th>
      <th class="num" style="width:112px">P.U. (F CFA)</th>
      <th class="num" style="width:56px">Qté</th>
      <th class="num" style="width:120px">Total (F CFA)</th>
    </tr>
  </thead>`;

export function renderVague({ kind, data }) {
  const L = libelles(kind);
  const e = data.emetteur;
  const t = data.totaux;
  const r = kind === 'facture' ? data.reglement : null;
  const { pages, scinder } = r
    ? paginerFacture(data.lignes, placeFactureVague(r, e, conditionsPour(kind, e)), { aire: AIRE, hauteurLigne: HAUTEUR_LIGNE })
    : { pages: paginer(data.lignes, CAPACITES), scinder: false };
  const bas = r ? basFacture(kind, data) : null;
  const ids = identifiantsDe(e);
  const ref = piedApporteur(data);
  const total = pages.length + (scinder ? 1 : 0);
  // Vague claire : la primaire de l'émetteur éclaircie (le second tracé du ruban).
  const clair = eclaircir(e.couleurPrimaire, 0.24);
  let rang = 0;

  const corps = pages.map((lignes, i) => {
    const premiere = i === 0;
    const derniere = i === pages.length - 1; // dernière page de LIGNES (la page de fin éventuelle suit)
    const rows = lignes.map((l) => {
      rang += 1;
      return `
      <tr>
        <td class="num">${rang}</td>
        <td>${esc(l.designation)}</td>
        <td class="num">${nf(l.pu)}</td>
        <td class="num">${nf(l.qty, l.qty % 1 ? 1 : 0)}</td>
        <td class="num">${nf(l.pu * l.qty)}</td>
      </tr>`;
    }).join('');

    return `
<section class="page">
  ${data.filigrane ? `<div class="filigrane" style="background-image:url('${data.filigrane}')"></div>` : ''}
  ${vagueHaute(premiere ? L.titre : `${L.titre} · ${esc(data.numero || '')}`, e.couleurPrimaire, clair)}
  <div class="corps">
    ${premiere ? `
    <div class="identite">
      <div class="micro">
        <div>${esc(e.address || '—')}</div>
        <div>${esc(e.phone || '—')}</div>
        <div>${esc(e.email || '—')}</div>
        ${e.website ? `<div>${esc(e.website)}</div>` : ''}
        ${r ? ids.map((x) => `<div>${esc(x)}</div>`).join('') : ''}
      </div>
      ${e.logo ? `<img src="${e.logo}" alt="${esc(e.name)}" style="${styleLogo(e.logo)}">` : `<div class="titre-bloc">${esc(e.name)}</div>`}
    </div>

    <div class="client-rang">
      <div>
        <div class="titre-bloc">${L.destinataire} :</div>
        <div class="trait"></div>
        <div>${esc(data.client.name)}</div>
        ${data.client.societe ? `<div>${esc(data.client.societe)}</div>` : ''}
        <div>${esc(data.client.adresse || '—')}</div>
        <div>${esc(data.client.phone || '—')}</div>
      </div>
      <div>
        <div class="meta-ligne"><span class="libelle">${L.numeroLabel}</span><span>${esc(data.numero || '—')}</span></div>
        <div class="meta-ligne"><span class="libelle">Date</span><span>${dateFr(data.date)}</span></div>
        <div class="meta-ligne"><span class="libelle">${L.dateSecondaireLabel}</span><span>${data.dateSecondaire ? dateFr(data.dateSecondaire) : '—'}</span></div>
        ${r?.miseAJour ? `<div class="meta-ligne maj"><span class="libelle">Mise à jour</span><span>${jourFr(r.miseAJour)}</span></div>` : ''}
        ${r?.paye > 0 ? `<div class="meta-ligne"><span class="libelle">Reste à payer</span><span class="navy" style="font-weight:600">${nf(r.reste)} F CFA</span></div>` : ''}
      </div>
    </div>` : ''}

    <table class="lignes">
      ${enTeteTableau()}
      <tbody>${rows}</tbody>
    </table>

    ${derniere && r ? `${bas.totaux}${scinder ? '' : bas.fin}` : ''}
    ${derniere && !r ? `
    <div class="bas">
      <div>
        <div class="titre-bloc">Merci de votre confiance.</div>
        <div style="margin-top:16px">
          <div class="titre-bloc">Coordonnées bancaires</div>
          <div class="trait"></div>
          ${e.bank ? `
          <div class="micro">Banque : ${esc(e.bank.name)}</div>
          <div class="micro">Compte : ${esc(e.bank.account)}</div>
          ${e.bank.swift ? `<div class="micro">SWIFT : ${esc(e.bank.swift)}</div>` : ''}`
          : '<div class="micro">Règlement à convenir avec l’émetteur.</div>'}
        </div>
      </div>
      <div>
        <div class="totaux-ligne"><span>Sous-total HT (F CFA)</span><span class="navy">${nf(t.totalHT)}</span></div>
        ${t.remise ? `<div class="totaux-ligne"><span>Remise (F CFA)</span><span class="navy">− ${nf(t.remise)}</span></div>` : ''}
        ${t.tvaActive ? `<div class="totaux-ligne"><span>TVA (F CFA)</span><span class="navy">${nf(t.tva)}</span></div>` : ''}
        <div class="total-final"><span class="libelle">Total (F CFA)</span><span class="montant">${nf(t.totalTTC)}</span></div>
      </div>
    </div>

    <div style="margin-top:16px">
      <div class="titre-bloc">Conditions générales</div>
      <div class="trait"></div>
      <div class="conditions">${esc(conditionsPour(kind, e))}</div>
    </div>` : ''}

    ${ref.ligne}
    <div class="legal ${ref.push}">
      <span>${esc(e.name)}${e.slogan ? ` — ${esc(e.slogan)}` : ''}</span>
      <span>${[e.rccm ? `RCCM ${esc(e.rccm)}` : '', e.ifu ? `${esc(e.fiscal || 'NIF')} ${esc(e.ifu)}` : '', e.cnss ? `CNSS ${esc(e.cnss)}` : '', total > 1 ? `Page ${i + 1} / ${total}` : ''].filter(Boolean).join(' · ')}</span>
    </div>
  </div>
  ${vagueBasse(e.couleurPrimaire, clair)}
</section>`;
  });
  if (scinder) {
    corps.push(`
<section class="page page-fin">
  ${vagueHaute(`${L.titre} · ${esc(data.numero || '')}`, e.couleurPrimaire, clair)}
  <div class="corps">
    ${bas.fin}
    <div class="legal">
      <span>${esc(e.name)}${e.slogan ? ` — ${esc(e.slogan)}` : ''}</span>
      <span>${[...ids.map(esc), `Page ${total} / ${total}`].join(' · ')}</span>
    </div>
  </div>
  ${vagueBasse(e.couleurPrimaire, clair)}
</section>`);
  }

  return documentHtml({
    titre: `${L.titre} ${data.numero} — ${data.client.name}`,
    css: cssPour(e.couleurPrimaire, e.couleurSecondaire),
    pages: corps,
  });
}
