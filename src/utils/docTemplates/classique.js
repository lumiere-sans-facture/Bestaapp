// Modèle C — Classique. Document administratif sans logo, entièrement
// quadrillé, lisible à l'identique en noir et blanc. Aucune couleur de marque :
// ni navy #0a2472, ni orange #f5a623 — uniquement des gris et deux bleus très
// clairs pour les fonds de tableau.
import { nf, esc, dateFr, libelles, conditionsPour, paginer, documentHtml } from './shared';

// Capacités mesurées dans le navigateur (voir paginer).
const CAPACITES = { seule: 12, premiere: 13, suite: 17, derniere: 11 };

const CSS = `
  .page { padding: 40px; color: #212529; }
  .attenue { color: #666666; }
  .ital { font-style: italic; color: #666666; }

  .entete-rang1 { display: flex; align-items: baseline; justify-content: space-between; gap: 32px; }
  .entete-rang1 > div { font-size: 18px; font-weight: 600; letter-spacing: 4px; }
  .entete-rang2 { display: flex; align-items: flex-start; justify-content: space-between; gap: 32px; margin-top: 8px; }
  .entete-legal { font-size: 11px; color: #666666; }
  .meta-ligne { display: flex; justify-content: space-between; gap: 24px; font-size: 13px; }
  .meta-ligne + .meta-ligne { margin-top: 4px; }
  .meta-val { text-align: right; }
  .meta-val.fort { font-weight: 600; }

  .panneaux { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 24px; }
  .panneau { border: 1px solid #888888; }
  .panneau-titre { background: #808080; color: #fff; font-size: 11px; font-weight: 600; text-transform: uppercase;
                   letter-spacing: 1.4px; padding: 6px 12px; }
  .panneau-corps { padding: 12px; display: grid; grid-template-columns: 96px 1fr; gap: 4px 12px; font-size: 13px; }

  table.lignes { margin-top: 24px; }
  table.lignes th { background: #e0eefb; color: #212529; font-size: 13px; font-weight: 600; text-align: left;
                    padding: 6px 10px; border: 1px solid #888888; }
  table.lignes th.num { text-align: right; }
  table.lignes td { padding: 4px 10px; border: 1px solid #888888; font-size: 13px; }
  table.lignes td:first-child { height: 30px; box-sizing: border-box; text-align: right; color: #666666; }

  .bas { display: grid; grid-template-columns: 1fr 296px; gap: 16px; margin-top: 24px; }
  .sous-total { background: #e7eff7; border: 1px solid #888888; padding: 6px 12px; display: flex;
                justify-content: space-between; gap: 16px; font-size: 13px; }
  .sous-total + .sous-total { border-top: none; }
  .total-encadre { border: 1px solid #212529; padding: 12px; margin-top: 8px; text-align: right; }
  .total-libelle { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; color: #666666; }
  .total-montant { font-size: 18px; font-weight: 600; letter-spacing: 1.6px; margin-top: 4px; }
  .total-unite { font-size: 11px; color: #666666; }

  .cg-titre { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; color: #666666;
              border-bottom: 1px solid #888888; padding-bottom: 4px; margin-bottom: 8px; }
  .cg-texte { font-size: 11px; color: #666666; }

  .pied { padding-top: 8px; border-top: 1px solid #888888; display: flex; justify-content: space-between;
          gap: 24px; font-size: 11px; color: #666666; }
`;

const enTeteTableau = () => `
  <thead>
    <tr>
      <th class="num" style="width:36px">#</th>
      <th>Désignation</th>
      <th class="num" style="width:112px">P.U. (F CFA)</th>
      <th class="num" style="width:80px">Quantité</th>
      <th class="num" style="width:124px">Total (F CFA)</th>
    </tr>
  </thead>`;

const champ = (libelle, valeur) => `<div class="ital">${libelle}</div><div>${esc(valeur || '—')}</div>`;

export function renderClassique({ kind, data }) {
  const L = libelles(kind);
  const e = data.emetteur;
  const t = data.totaux;
  const pages = paginer(data.lignes, CAPACITES);
  const total = pages.length;
  let rang = 0;

  const corps = pages.map((lignes, i) => {
    const premiere = i === 0;
    const derniere = i === total - 1;
    const rows = lignes.map((l) => {
      rang += 1;
      return `
      <tr>
        <td>${rang}</td>
        <td>${esc(l.designation)}</td>
        <td class="num">${nf(l.pu)}</td>
        <td class="num">${nf(l.qty, l.qty % 1 ? 1 : 0)}</td>
        <td class="num">${nf(l.pu * l.qty)}</td>
      </tr>`;
    }).join('');

    return `
<section class="page">
  <div class="entete-rang1">
    <div>${esc(e.name)}</div>
    <div>${L.titre}</div>
  </div>
  <div class="entete-rang2">
    <div class="entete-legal">
      ${e.rccm ? `<div>RCCM : ${esc(e.rccm)}</div>` : ''}
      ${e.ifu ? `<div>NIF : ${esc(e.ifu)}</div>` : ''}
    </div>
    <div style="min-width:280px">
      <div class="meta-ligne"><span class="ital">${L.numeroLabel}</span><span class="meta-val fort">${esc(data.numero || '—')}</span></div>
      <div class="meta-ligne"><span class="ital">Date</span><span class="meta-val">${dateFr(data.date)}</span></div>
      <div class="meta-ligne"><span class="ital">${L.dateSecondaireLabel}</span><span class="meta-val">${data.dateSecondaire ? dateFr(data.dateSecondaire) : '—'}</span></div>
    </div>
  </div>

  ${premiere ? `
  <div class="panneaux">
    <div class="panneau">
      <div class="panneau-titre">Émetteur</div>
      <div class="panneau-corps">
        ${champ('Nom', e.name)}
        ${champ('Adresse', e.address)}
        ${champ('Téléphone', e.phone)}
        ${champ('Email', e.email)}
        ${e.website ? champ('Site', e.website) : ''}
      </div>
    </div>
    <div class="panneau">
      <div class="panneau-titre">Client</div>
      <div class="panneau-corps">
        ${champ('Nom', data.client.name)}
        ${champ('Société', data.client.societe)}
        ${champ('Adresse', data.client.adresse)}
        ${champ('Contact', data.client.phone)}
      </div>
    </div>
  </div>` : ''}

  <table class="lignes">
    ${enTeteTableau()}
    <tbody>${rows}</tbody>
  </table>

  ${derniere ? `
  <div class="bas">
    <div class="panneau">
      <div class="panneau-titre">Coordonnées bancaires</div>
      <div class="panneau-corps">
        ${e.bank ? `${champ('Banque', e.bank.name)}${champ('Compte', e.bank.account)}${e.bank.swift ? champ('SWIFT', e.bank.swift) : ''}` : champ('Règlement', 'À convenir avec l’émetteur')}
        ${champ('Email', e.email)}
      </div>
    </div>
    <div>
      <div class="sous-total"><span>Sous-total HT (F CFA)</span><span>${nf(t.totalHT)}</span></div>
      ${t.remise ? `<div class="sous-total"><span>Remise (F CFA)</span><span>− ${nf(t.remise)}</span></div>` : ''}
      ${t.tvaActive ? `<div class="sous-total"><span>TVA (F CFA)</span><span>${nf(t.tva)}</span></div>` : ''}
      <div class="total-encadre">
        <div class="total-libelle">Total à payer</div>
        <div class="total-montant">${nf(t.totalTTC)}</div>
        <div class="total-unite">F CFA</div>
      </div>
    </div>
  </div>

  <div style="margin-top:24px">
    <div class="cg-titre">Conditions générales</div>
    <div class="cg-texte">${esc(conditionsPour(kind, e))}</div>
  </div>` : ''}

  <div class="pied push">
    <span>${esc(e.name)}${e.slogan ? ` — ${esc(e.slogan)}` : ''}${e.website ? ` · ${esc(e.website)}` : ''}</span>
    <span>Page ${i + 1} / ${total}</span>
  </div>
</section>`;
  });

  return documentHtml({
    titre: `${L.titre} ${data.numero} — ${data.client.name}`,
    css: CSS,
    pages: corps,
  });
}
