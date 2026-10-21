// Reçu de paiement d'une facture Pro — une page A4, aux couleurs de
// l'entreprise (noir, blanc et gris, sans image, quand elle a choisi Sobre).
// Il dit ce qui a été reçu, comment, et où en est la facture APRÈS ce
// paiement : total, encaissé à ce jour, reste, prochaine échéance.
import { nf, esc, documentHtml, emetteurDe, identifiantsDe, sourceDeFacture, eclaircir } from './shared';
import { signataireDe, montantInsecable } from './reglement';
import { montantEnLettres } from '../montantEnLettres';
import { etatEcheancier, quandEcheance } from '../echeancier';
import { jourDuPaiement, libelleModePaiement } from '../facturePaiements';
import { jourFr, jourLocal } from '../date';
import { styleLogo } from '../logo';

/**
 * @param {object} o
 * @param {object} o.facture   facture AVEC ses paiements (joindrePaiements)
 * @param {object} o.paiement  l'un d'eux
 * @param {object} o.company   entreprise de l'abonné
 */
export function donneesDeRecu({ facture, paiement, company }) {
  const source = sourceDeFacture(facture, company);
  const emetteur = emetteurDe(source);
  const paiements = facture.paiements || [];
  const rang = Math.max(0, paiements.findIndex((p) => p.id === paiement.id));
  const jusquIci = paiements.slice(0, rang + 1);
  const paye = jusquIci.reduce((s, p) => s + Math.round(Number(p.montant) || 0), 0);
  const total = Math.round(Number(facture.totalTTC) || 0);
  const jour = jourDuPaiement(paiement) || jourLocal();
  const etat = etatEcheancier({ ...facture, paiements: jusquIci }, paye, jour);
  const montant = Math.round(Number(paiement.montant) || 0);
  return {
    // Un reçu par paiement, numéroté dans l'ordre des paiements de la facture.
    numero: `${facture.numero || 'FAC'}-R${rang + 1}`,
    date: jour,
    emetteur,
    ids: identifiantsDe(emetteur),
    client: { name: facture.clientName || 'Client', phone: facture.clientPhone || '', adresse: facture.clientVille || '' },
    montant,
    enLettres: montantEnLettres(montant),
    nature: paye >= total && total > 0 ? 'Solde' : (rang === 0 ? 'Acompte' : 'Versement'),
    mode: libelleModePaiement(paiement),
    reference: paiement.reference || '',
    note: paiement.note || '',
    facture: { numero: facture.numero || '', objet: facture.objet || '', date: facture.createdAt || null, total },
    paye,
    reste: Math.max(0, total - paye),
    tropPercu: Math.max(0, paye - total),
    prochaine: etat.prochaine && total > paye
      ? { libelle: etat.prochaine.libelle || 'Échéance', montant: etat.prochaine.du, quand: quandEcheance(etat.prochaine) }
      : null,
    signataire: signataireDe(source),
  };
}

const css = (p, clair, sobre) => `
  .page { padding: 48px 56px 40px; color: #333333; }
  .entete { display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; padding-bottom: 16px; border-bottom: 2px solid ${p}; }
  .entete img { display: block; margin-bottom: 8px; }
  .nom { font-size: 18px; font-weight: 600; color: ${p}; }
  .coord { font-size: 11px; color: #555555; line-height: 1.5; }
  .titre { font-size: 18px; font-weight: 600; letter-spacing: 2px; color: ${p}; text-align: right; }
  .meta { font-size: 13px; text-align: right; margin-top: 4px; }
  .meta strong { color: ${p}; font-weight: 600; }
  .montant-bloc { margin-top: 32px; padding: 20px 24px; background: ${clair}; border-left: 4px solid ${p}; }
  .micro { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.4px; color: #555555; }
  .montant { font-size: 28px; font-weight: 600; color: ${p}; margin-top: 4px; }
  .lettres { font-size: 13px; margin-top: 4px; }
  .lettres strong { font-weight: 600; color: #111111; }
  .insecable { white-space: nowrap; }
  table.details { margin-top: 24px; }
  table.details td { padding: 8px 0; border-bottom: 1px solid #e3e3e3; font-size: 13px; vertical-align: top; }
  table.details td:first-child { width: 168px; color: #555555; }
  table.details td:last-child { color: #222222; }
  .situation { margin-top: 32px; }
  .situation-titre { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: ${p}; }
  .rang { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; border-bottom: 1px solid #e3e3e3; font-size: 13px; }
  .rang.reste { border-bottom: 2px solid ${p}; font-weight: 600; color: #111111; align-items: baseline; }
  .rang.reste .num { font-size: 18px; color: ${p}; }
  .prochaine { font-size: 11px; color: #555555; margin-top: 8px; }
  .signature { width: 260px; margin: 48px 0 0 auto; text-align: center; }
  .signature .micro { color: ${sobre ? '#111111' : p}; }
  .signature img { display: block; max-width: 220px; max-height: 80px; margin: 4px auto 0; }
  .signature-espace { height: 64px; }
  .signature-filet { border-top: 1px solid #888888; margin-top: 4px; }
  .signature-nom { font-size: 13px; font-weight: 600; color: #111111; margin-top: 4px; }
  .pied { font-size: 11px; color: #555555; text-align: center; border-top: 1px solid #e3e3e3; padding-top: 8px; }
`;

/**
 * Reçu imprimable (HTML autonome, une page `.page` A4).
 * @param {object} o
 * @param {object} o.data   voir donneesDeRecu
 * @param {string} [o.model] modèle de l'entreprise : 'sobre' imprime en noir et gris, sans image
 */
export function buildRecuHtml({ data, model = 'studio' }) {
  const e = data.emetteur;
  const sobre = model === 'sobre';
  const p = sobre ? '#111111' : e.couleurPrimaire;
  const clair = sobre ? '#e3e3e3' : eclaircir(p, 0.92);
  const sig = data.signataire;
  const details = [
    ['Reçu de', [data.client.name, data.client.phone].filter(Boolean).join(' — ')],
    ['Pour', `${data.nature} — facture ${data.facture.numero}${data.facture.date ? ` du ${jourFr(jourLocal(new Date(data.facture.date)))}` : ''}`],
    ['Objet', data.facture.objet],
    ['Mode de paiement', data.mode],
    ['Référence', data.reference],
    ['Note', data.note],
  ].filter(([, v]) => v);
  const page = `
<section class="page">
  <div class="entete">
    <div>
      ${!sobre && e.logo ? `<img src="${e.logo}" alt="${esc(e.name)}" style="${styleLogo(e.logo)}">` : ''}
      <div class="nom">${esc(e.name)}</div>
      <div class="coord">${[e.address, [e.phone, e.email].filter(Boolean).join(' · ')].filter(Boolean).map(esc).join('<br>')}</div>
      ${data.ids.length ? `<div class="coord">${data.ids.map(esc).join(' · ')}</div>` : ''}
    </div>
    <div>
      <div class="titre">REÇU DE PAIEMENT</div>
      <div class="meta">N° <strong>${esc(data.numero)}</strong></div>
      <div class="meta">Date : ${jourFr(data.date)}</div>
    </div>
  </div>

  <div class="montant-bloc">
    <div class="micro">Montant reçu</div>
    <div class="montant">${nf(data.montant)} F CFA</div>
    <div class="lettres">La somme de <strong>${montantInsecable(data.enLettres)}</strong>.</div>
  </div>

  <table class="details"><tbody>
    ${details.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}
  </tbody></table>

  <div class="situation">
    <div class="situation-titre">Situation de la facture ${esc(data.facture.numero)}</div>
    <div class="rang"><span>Total de la facture</span><span class="num">${nf(data.facture.total)} F CFA</span></div>
    <div class="rang"><span>Encaissé à ce jour (ce paiement compris)</span><span class="num">${nf(data.paye)} F CFA</span></div>
    ${data.tropPercu > 0
    ? `<div class="rang reste"><span>Trop-perçu</span><span class="num">${nf(data.tropPercu)} F CFA</span></div>`
    : `<div class="rang reste"><span>${data.reste > 0 ? 'Reste à payer' : 'Facture soldée'}</span><span class="num">${nf(data.reste)} F CFA</span></div>`}
    ${data.prochaine ? `<div class="prochaine">Prochaine échéance : ${esc(data.prochaine.libelle)} — ${nf(data.prochaine.montant)} F CFA — ${esc(data.prochaine.quand)}</div>` : ''}
  </div>

  <div class="signature">
    <div class="micro">${esc(sig?.titre || 'Pour acquit — signature et cachet')}</div>
    ${!sobre && sig?.cachet ? `<img src="${esc(sig.cachet)}" alt="Signature et cachet">` : '<div class="signature-espace"></div>'}
    <div class="signature-filet"></div>
    ${sig?.nom ? `<div class="signature-nom">${esc(sig.nom)}</div>` : ''}
  </div>

  <div class="pied push">${esc(e.name)}${data.ids.length ? ` · ${data.ids.map(esc).join(' · ')}` : ''}</div>
</section>`;
  return documentHtml({ titre: `Reçu ${data.numero} — ${data.client.name}`, css: css(p, clair, sobre), pages: [page] });
}
