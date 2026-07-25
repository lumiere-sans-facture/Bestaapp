// Documents de commissions conformes aux usages comptables : reçu de paiement
// (avec montant arrêté en lettres) et relevé de commissions par partenaire.
// HTML autonome imprimable (Ctrl+P) — même approche que la fiche de dimensionnement.
import { COMPANY } from '../config/company';

const nf = (v) =>
  Math.round(Number(v) || 0).toLocaleString('fr-FR').replace(/[\u202f\u00a0]/g, ' ');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fdate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

export const PAY_MODE_LABEL = { momo: 'Mobile Money', especes: 'Espèces', virement: 'Virement bancaire', cheque: 'Chèque' };

// ---- Montant en lettres (français standard, pour « arrêté à la somme de… ») ----
const UNITES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const DIZAINES = { 20: 'vingt', 30: 'trente', 40: 'quarante', 50: 'cinquante', 60: 'soixante' };

const moins100 = (n) => {
  if (n < 20) return UNITES[n];
  if (n < 70) {
    const d = Math.floor(n / 10) * 10;
    const u = n - d;
    if (u === 0) return DIZAINES[d];
    return u === 1 ? `${DIZAINES[d]} et un` : `${DIZAINES[d]}-${UNITES[u]}`;
  }
  if (n < 80) return n === 71 ? 'soixante et onze' : `soixante-${UNITES[n - 60]}`;
  if (n === 80) return 'quatre-vingts';
  return `quatre-vingt-${UNITES[n - 80]}`;
};

const moins1000 = (n) => {
  const c = Math.floor(n / 100);
  const r = n % 100;
  if (!c) return moins100(r);
  const cent = c > 1 ? `${UNITES[c]} cent${r === 0 ? 's' : ''}` : 'cent';
  return r ? `${cent} ${moins100(r)}` : cent;
};

/** Nombre entier → lettres françaises (jusqu'aux milliards). */
export const montantEnLettres = (n) => {
  n = Math.round(Math.abs(Number(n) || 0));
  if (n === 0) return 'zéro';
  const parts = [];
  const milliard = Math.floor(n / 1e9);
  const million = Math.floor((n % 1e9) / 1e6);
  const mille = Math.floor((n % 1e6) / 1e3);
  const reste = n % 1e3;
  if (milliard) parts.push(`${moins1000(milliard)} milliard${milliard > 1 ? 's' : ''}`);
  if (million) parts.push(`${moins1000(million)} million${million > 1 ? 's' : ''}`);
  if (mille) parts.push(mille === 1 ? 'mille' : `${moins1000(mille)} mille`);
  if (reste) parts.push(moins1000(reste));
  return parts.join(' ');
};

// ---- Gabarit commun ----
const shell = (titre, corps) => `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titre)}</title>
<style>
  :root { --bleu: #0a2472; --bleu-fonce: #061540; --orange: #f5a623; --gris: #6b7280; --ligne: #e5e7eb; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; font-size: 13px; line-height: 1.5; background: #f4f6fb; }
  .sheet { max-width: 760px; margin: 0 auto; background: white; }
  @media screen { .sheet { margin: 24px auto; box-shadow: 0 8px 30px rgba(10,36,114,.16); border-radius: 8px; overflow: hidden; } }
  header { background: var(--bleu); color: white; padding: 20px 28px; display: flex; align-items: center; gap: 14px; }
  .logo { width: 42px; height: 42px; border-radius: 11px; background: var(--orange); color: var(--bleu-fonce); display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
  .brand-name { font-size: 16px; font-weight: 800; }
  .brand-slogan { font-size: 10.5px; opacity: .85; font-style: italic; }
  .doc-meta { margin-left: auto; text-align: right; }
  .doc-title { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; }
  .doc-date { font-size: 11px; opacity: .8; }
  .band { height: 5px; background: var(--orange); }
  main { padding: 22px 28px 26px; }
  h2 { font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .6px; color: var(--bleu); border-bottom: 2px solid var(--orange); padding-bottom: 4px; margin: 16px 0 10px; }
  h2:first-child { margin-top: 0; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { background: var(--bleu); color: white; text-align: left; padding: 6px 9px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .4px; }
  td { padding: 6px 9px; border-bottom: 1px solid var(--ligne); }
  tr:nth-child(even) td { background: #f8f9fc; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  th.num { text-align: right; }
  tfoot td { font-weight: 800; background: #fef3e0 !important; border-top: 2px solid var(--orange); border-bottom: none; }
  .kv { display: flex; justify-content: space-between; gap: 16px; padding: 6px 2px; border-bottom: 1px dashed var(--ligne); }
  .kv:last-child { border-bottom: none; }
  .kv b { text-align: right; }
  .somme { border: 1.5px solid var(--ligne); border-left: 4px solid var(--orange); border-radius: 6px; padding: 10px 14px; margin-top: 14px; font-size: 13px; }
  .signatures { display: flex; gap: 24px; margin-top: 30px; }
  .signature { flex: 1; text-align: center; font-size: 11px; color: var(--gris); }
  .signature .ligne-sign { border-top: 1px solid var(--gris); margin-top: 46px; padding-top: 5px; }
  footer { padding: 12px 28px; border-top: 1px solid var(--ligne); display: flex; justify-content: space-between; font-size: 10px; color: var(--gris); }
  .footer-band { height: 8px; background: var(--bleu); }
  .print-bar { max-width: 760px; margin: 14px auto 40px; display: flex; justify-content: center; }
  .print-btn { background: var(--bleu); color: white; border: none; border-radius: 10px; padding: 12px 26px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .muted { color: var(--gris); }
  @page { size: A4; margin: 12mm; }
  @media print { body { background: white; } .sheet { max-width: none; box-shadow: none; border-radius: 0; } .print-bar { display: none; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="sheet">
  <header>
    <div class="logo">☀</div>
    <div>
      <div class="brand-name">${esc(COMPANY.name)}</div>
      <div class="brand-slogan">${esc(COMPANY.slogan)}</div>
    </div>
    <div class="doc-meta">
      <div class="doc-title">${esc(titre)}</div>
      <div class="doc-date">${fdate(new Date())}</div>
    </div>
  </header>
  <div class="band"></div>
  <main>${corps}</main>
  <footer>
    <span>${esc(COMPANY.name)} — ${esc(COMPANY.addressShort)} · ${esc(COMPANY.phone)}</span>
    <span>Document généré par BestaSolar Pro</span>
  </footer>
  <div class="footer-band"></div>
</div>
<div class="print-bar"><button class="print-btn" onclick="window.print()">🖨 Imprimer / Exporter en PDF</button></div>
</body>
</html>`;

/**
 * Reçu de paiement d'une commission (une commission payée).
 * @param {object} d { commission, partner, lead, payeur }
 */
export function buildRecuCommissionHtml({ commission: c, partner, lead, payeur, rates = {} }) {
  const numero = `REC-${(c.paidAt || '').replaceAll('-', '')}-${String(c.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()}`;
  const taux = rates[c.level] ? `${(rates[c.level] * 100).toLocaleString('fr-FR')} %` : '—';
  const corps = `
    <h2>Reçu n° ${esc(numero)}</h2>
    <div class="kv"><span>Bénéficiaire (partenaire)</span><b>${esc(partner?.name || '—')}${partner?.code ? ` · ${esc(partner.code)}` : ''}</b></div>
    ${partner?.phone ? `<div class="kv"><span>Téléphone</span><b>${esc(partner.phone)}</b></div>` : ''}
    <div class="kv"><span>Affaire apportée</span><b>${esc(lead?.name || 'Commission manuelle')}</b></div>
    ${lead ? `<div class="kv"><span>Valeur de l'affaire</span><b>${nf(lead.estimatedValue)} F CFA</b></div>` : ''}
    <div class="kv"><span>Niveau de parrainage · taux</span><b>Niveau ${esc(c.level)} · ${taux}</b></div>
    <div class="kv"><span>Date de paiement</span><b>${fdate(c.paidAt)}</b></div>
    <div class="kv"><span>Mode de règlement</span><b>${esc(PAY_MODE_LABEL[c.payMode] || c.payMode || 'Mobile Money')}</b></div>
    ${c.payRef ? `<div class="kv"><span>Référence de la transaction</span><b>${esc(c.payRef)}</b></div>` : ''}
    ${c.payNote ? `<div class="kv"><span>Note</span><b>${esc(c.payNote)}</b></div>` : ''}
    <div class="somme">
      Arrêté le présent reçu à la somme de <strong>${esc(montantEnLettres(c.amount))} (${nf(c.amount)}) francs CFA</strong>.
    </div>
    <div class="signatures">
      <div class="signature">Payé par${payeur ? ` : ${esc(payeur.name)}` : ''}<div class="ligne-sign">Signature</div></div>
      <div class="signature">Reçu par : ${esc(partner?.name || '')}<div class="ligne-sign">Signature</div></div>
    </div>`;
  return shell('Reçu de commission', corps);
}

/**
 * Relevé des commissions d'un partenaire (toutes ou une période déjà filtrée).
 * @param {object} d { partner, commissions, getLeadName }
 */
export function buildReleveCommissionsHtml({ partner, commissions, getLeadName, rates = {} }) {
  const payees = commissions.filter((c) => c.status === 'payée');
  const attente = commissions.filter((c) => c.status !== 'payée');
  const total = (list) => list.reduce((s, c) => s + (c.amount || 0), 0);
  const lignes = commissions.map((c) => `
    <tr>
      <td>${fdate(c.createdAt)}</td>
      <td>${esc(getLeadName(c.leadId) || 'Commission manuelle')}</td>
      <td class="num">N${esc(c.level)}${rates[c.level] ? ` · ${(rates[c.level] * 100).toLocaleString('fr-FR')} %` : ''}</td>
      <td class="num">${nf(c.amount)}</td>
      <td>${c.status === 'payée' ? `Payée le ${fdate(c.paidAt)}${c.payRef ? ` <span class="muted">(réf. ${esc(c.payRef)})</span>` : ''}` : 'En attente'}</td>
    </tr>`).join('');
  const corps = `
    <h2>Partenaire</h2>
    <div class="kv"><span>Nom</span><b>${esc(partner?.name || '—')}</b></div>
    <div class="kv"><span>Code partenaire</span><b>${esc(partner?.code || '—')}</b></div>
    ${partner?.phone ? `<div class="kv"><span>Téléphone</span><b>${esc(partner.phone)}</b></div>` : ''}
    ${partner?.momoNumber ? `<div class="kv"><span>N° Mobile Money</span><b>${esc(partner.momoNumber)}</b></div>` : ''}
    <h2>Détail des commissions (${commissions.length})</h2>
    <table>
      <thead><tr><th>Date</th><th>Affaire</th><th class="num">Niveau · taux</th><th class="num">Montant (F CFA)</th><th>Statut</th></tr></thead>
      <tbody>${lignes || '<tr><td colspan="5">Aucune commission.</td></tr>'}</tbody>
      <tfoot>
        <tr><td colspan="3">Total payé (${payees.length})</td><td class="num">${nf(total(payees))}</td><td></td></tr>
        <tr><td colspan="3">Reste à payer (${attente.length})</td><td class="num">${nf(total(attente))}</td><td></td></tr>
      </tfoot>
    </table>
    <div class="somme">
      Solde dû au partenaire arrêté à la somme de <strong>${esc(montantEnLettres(total(attente)))} (${nf(total(attente))}) francs CFA</strong>.
    </div>
    <div class="signatures">
      <div class="signature">Le gérant<div class="ligne-sign">Signature</div></div>
      <div class="signature">Le partenaire<div class="ligne-sign">Signature</div></div>
    </div>`;
  return shell('Relevé de commissions', corps);
}

/** Ouvre un document HTML dans un nouvel onglet, prêt à imprimer. */
export function openHtmlDoc(html) {
  const w = window.open('about:blank', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
