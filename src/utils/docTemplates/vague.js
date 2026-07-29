// Modèle B — Vague. Bandeaux décoratifs SVG à fond plat (jamais de dégradé),
// en-tête de tableau gris clair (c'est ce qui le distingue de Studio),
// couleur secondaire réservée aux traits de titre, au filet du total et au
// montant du total. En Pro, les couleurs de l'abonné remplacent navy/orange ;
// la vague claire est une teinte éclaircie de la primaire.
import { nf, esc, dateFr, libelles, conditionsPour, paginer, documentHtml, eclaircir } from './shared';

// Capacités mesurées dans le navigateur (voir paginer).
const CAPACITES = { seule: 9, premiere: 10, suite: 14, derniere: 8 };

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
  .identite img { height: 32px; width: auto; display: block; }

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
`;

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
  const pages = paginer(data.lignes, CAPACITES);
  const total = pages.length;
  // Vague claire : la primaire de l'émetteur éclaircie (le second tracé du ruban).
  const clair = eclaircir(e.couleurPrimaire, 0.24);
  let rang = 0;

  const corps = pages.map((lignes, i) => {
    const premiere = i === 0;
    const derniere = i === total - 1;
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
      </div>
      ${e.logo ? `<img src="${e.logo}" alt="${esc(e.name)}">` : `<div class="titre-bloc">${esc(e.name)}</div>`}
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
      </div>
    </div>` : ''}

    <table class="lignes">
      ${enTeteTableau()}
      <tbody>${rows}</tbody>
    </table>

    ${derniere ? `
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

    <div class="legal push">
      <span>${esc(e.name)}${e.slogan ? ` — ${esc(e.slogan)}` : ''}</span>
      <span>${e.rccm ? `RCCM ${esc(e.rccm)}` : ''}${e.rccm && e.ifu ? ' · ' : ''}${e.ifu ? `IFU ${esc(e.ifu)}` : ''}${total > 1 ? ` · Page ${i + 1} / ${total}` : ''}</span>
    </div>
  </div>
  ${vagueBasse(e.couleurPrimaire, clair)}
</section>`;
  });

  return documentHtml({
    titre: `${L.titre} ${data.numero} — ${data.client.name}`,
    css: cssPour(e.couleurPrimaire, e.couleurSecondaire),
    pages: corps,
  });
}
