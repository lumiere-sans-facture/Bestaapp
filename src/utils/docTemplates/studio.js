// Modèle A — Studio. Modèle par défaut, seul disponible côté public.
// Couleur primaire structurante (navy par défaut), secondaire strictement
// réservée aux trois pastilles, montant focal en primaire. En Pro, ce sont les
// couleurs de l'abonné (couleurPrimaire / couleurSecondaire) qui s'appliquent.
// Marges 40 px, angles 8 px (blocs) / 6 px (pastilles, totaux).
import { nf, esc, dateFr, libelles, conditionsPour, paginer, documentHtml } from './shared';

// Capacités mesurées dans le navigateur (voir paginer).
const CAPACITES = { seule: 9, premiere: 11, suite: 16, derniere: 8 };

const cssPour = (p, s) => `
  .page { padding: 40px; color: #3a3a3a; }
  .micro { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; color: #6b6b6b; }
  .val { font-size: 13px; }
  .navy { color: ${p}; font-weight: 600; }

  .bandeau { display: flex; align-items: flex-end; gap: 32px; padding-bottom: 16px; border-bottom: 1px solid #e5e5e5; }
  .bandeau img { height: 32px; width: auto; display: block; }
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
`;

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
  const pages = paginer(data.lignes, CAPACITES);
  const total = pages.length;

  const corps = pages.map((lignes, i) => {
    const premiere = i === 0;
    const derniere = i === total - 1;
    return `
<section class="page">
  ${premiere ? `
  <div class="bandeau">
    ${e.logo ? `<img src="${e.logo}" alt="${esc(e.name)}">` : `<div class="navy" style="font-size:18px">${esc(e.name)}</div>`}
    <div class="bandeau-col"><div class="micro">Adresse</div><div class="val">${esc(e.address || '—')}</div></div>
    <div class="bandeau-col"><div class="micro">Téléphone</div><div class="val">${esc(e.phone || '—')}</div></div>
  </div>

  <div class="titre-rang">
    <div class="pave"><div class="pave-texte">${L.titre}</div></div>
    <div class="titre-meta">
      <div><div class="micro">${L.numeroLabel}</div><div class="val navy">${esc(data.numero || '—')}</div></div>
      <div><div class="micro">Date d’émission</div><div class="val navy">${dateFr(data.date)}</div></div>
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
      <span class="pastille">Total à régler</span>
      <div class="focal-montant">${nf(t.totalTTC)}</div>
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

  ${derniere ? `
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

  <div class="pied push">
    <span>${esc(e.name)}${e.rccm ? ` · RCCM ${esc(e.rccm)}` : ''}${e.ifu ? ` · NIF ${esc(e.ifu)}` : ''}</span>
    <span>${esc(e.website || e.email || '')}${total > 1 ? ` · Page ${i + 1} / ${total}` : ''}</span>
  </div>
</section>`;
  });

  return documentHtml({
    titre: `${L.titre} ${data.numero} — ${data.client.name}`,
    css: cssPour(e.couleurPrimaire, e.couleurSecondaire),
    pages: corps,
  });
}
