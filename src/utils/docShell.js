// Habillage commun des documents imprimables BestaSolar (HTML autonome,
// export PDF via Ctrl+P) : charte graphique, en-tête de marque, pied de page
// et styles d'impression A4. Les documents n'ont ainsi qu'à produire leurs
// sections.
import { COMPANY } from '../config/company';

/** Échappement HTML — à utiliser sur TOUTE donnée saisie. */
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const DOC_CSS = `
  :root { --bleu: #0a2472; --bleu-fonce: #061540; --orange: #f5a623; --gris: #6b7280; --ligne: #e5e7eb; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; font-size: 13px; line-height: 1.5; background: #f4f6fb; }
  .sheet { max-width: 800px; margin: 0 auto; background: white; }
  @media screen { .sheet { margin: 24px auto; box-shadow: 0 8px 30px rgba(10,36,114,.16); border-radius: 8px; overflow: hidden; } }

  header { background: var(--bleu); color: white; padding: 22px 28px; display: flex; align-items: center; gap: 16px; }
  .logo { width: 46px; height: 46px; border-radius: 12px; background: var(--orange); color: var(--bleu-fonce); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 26px; }
  .brand-name { font-size: 18px; font-weight: 800; letter-spacing: .3px; }
  .brand-slogan { font-size: 11px; opacity: .85; font-style: italic; }
  .doc-meta { margin-left: auto; text-align: right; }
  .doc-title { font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px; }
  .doc-date { font-size: 11px; opacity: .8; }
  .doc-usage { font-size: 10px; margin-top: 3px; background: rgba(255,255,255,.16); border-radius: 4px; padding: 2px 6px; display: inline-block; }
  .band { height: 5px; background: var(--orange); }

  main { padding: 22px 28px 28px; }
  section { margin-bottom: 20px; }
  h2 { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .6px; color: var(--bleu); border-bottom: 2px solid var(--orange); padding-bottom: 4px; margin-bottom: 10px; }
  .muted { color: var(--gris); font-weight: 400; font-size: 11px; }
  .mention { font-size: 11.5px; color: var(--gris); line-height: 1.5; margin-top: 8px; }

  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th { background: var(--bleu); color: white; text-align: left; padding: 7px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; }
  td { padding: 7px 10px; border-bottom: 1px solid var(--ligne); vertical-align: top; }
  tr:nth-child(even) td { background: #f8f9fc; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  th.num { text-align: right; }
  tfoot td { font-weight: 800; background: #fef3e0 !important; border-top: 2px solid var(--orange); border-bottom: none; }
  tfoot tr.sous td { font-weight: 700; background: #f8f9fc !important; border-top: 1px solid var(--ligne); }

  .kv-row { display: flex; justify-content: space-between; gap: 16px; padding: 6px 2px; border-bottom: 1px dashed var(--ligne); }
  .kv-row:last-child { border-bottom: none; }
  .kv-label { color: #374151; }
  .kv-value { font-weight: 700; text-align: right; white-space: nowrap; }
  .kv-value .muted { white-space: normal; }

  .calc { border: 1.5px solid var(--ligne); border-left: 4px solid var(--orange); border-radius: 6px; padding: 10px 14px; margin-bottom: 10px; page-break-inside: avoid; }
  .calc-head { font-weight: 800; color: var(--bleu); margin-bottom: 3px; }
  .calc-formula { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: 11.5px; color: var(--gris); margin-bottom: 3px; }
  .calc-apply { font-size: 12.5px; }
  .calc-result { font-size: 12.5px; color: var(--bleu); margin-top: 2px; }

  .client-grid { display: flex; flex-wrap: wrap; gap: 6px 28px; }
  .client-item strong { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: var(--gris); font-weight: 700; }

  .verdict { font-weight: 800; }
  .verdict.ok { color: #047857; }
  .verdict.ko { color: #b91c1c; }
  .consigne { border: 1.5px solid #fcd9a0; background: #fdf6ea; border-radius: 6px; padding: 10px 14px; font-size: 12px; margin-top: 10px; }
  .refs { font-size: 11.5px; color: var(--gris); }
  .refs li { margin: 3px 0 3px 16px; }

  footer { padding: 14px 28px; border-top: 1px solid var(--ligne); display: flex; justify-content: space-between; gap: 12px; font-size: 10.5px; color: var(--gris); }
  .footer-band { height: 8px; background: var(--bleu); }

  .print-bar { max-width: 800px; margin: 16px auto 40px; display: flex; justify-content: center; }
  .print-btn { background: var(--bleu); color: white; border: none; border-radius: 10px; padding: 12px 26px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .print-btn:hover { background: #1a3a8c; }

  @page { size: A4; margin: 10mm; }
  @media print {
    body { background: white; font-size: 12px; }
    .sheet { max-width: none; box-shadow: none; border-radius: 0; }
    .print-bar { display: none; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    section { page-break-inside: avoid; }
  }
`;

/**
 * Enveloppe un contenu de sections dans le document complet.
 * @param {object} o
 * @param {string} o.titreDocument   titre en en-tête (ex. « Fiche de dimensionnement »)
 * @param {string} o.titreOnglet     <title> de la page
 * @param {string} o.sections        HTML des sections
 * @param {string} [o.usage]         mention d'usage (ex. « Document interne »)
 * @param {string} [o.piedMention]   mention légale du pied de page
 */
export function documentShell({ titreDocument, titreOnglet, sections, usage = '', piedMention = '' }) {
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titreOnglet)}</title>
<style>${DOC_CSS}</style>
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
      <div class="doc-title">${esc(titreDocument)}</div>
      <div class="doc-date">${date}</div>
      ${usage ? `<div class="doc-usage">${esc(usage)}</div>` : ''}
    </div>
  </header>
  <div class="band"></div>
  <main>${sections}</main>
  <footer>
    <span>${esc(COMPANY.name)} — ${esc(COMPANY.addressShort)} · ${esc(COMPANY.phone)}</span>
    <span>${esc(piedMention)}</span>
  </footer>
  <div class="footer-band"></div>
</div>
<div class="print-bar">
  <button class="print-btn" onclick="window.print()">Imprimer / Enregistrer en PDF</button>
</div>
</body>
</html>`;
}

/** Ouvre un document HTML dans un nouvel onglet (repli : téléchargement). */
export function openHtmlDocument(html, nomFichier = 'document.html') {
  const fenetre = window.open('', '_blank');
  if (fenetre) {
    fenetre.document.write(html);
    fenetre.document.close();
    return;
  }
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
