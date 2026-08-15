// Fiche de dimensionnement — point d'entrée : assemble les calculs
// (compute.js), le graphique (chart.js) et la mise en page 3 pages A4
// (layout.js).
//
// Deux façons de l'ouvrir, qui partagent la même mise en page HTML :
//   · openSizingSheet — lecteur intégré (/fiche-dimensionnement) : instantané,
//     avec sa barre d'outils. Le document reste du HTML.
//   · ouvrirFichePdf  — vrai fichier PDF affiché dans le lecteur du
//     navigateur : quelques secondes de plus, mais c'est un document que l'on
//     ENVOIE au client (WhatsApp), ce qu'une page HTML ne permet pas.
import { computeSheet } from './compute';
import { renderSheet } from './layout';

const STORAGE_PREFIX = 'besta:sizing-sheet:';

export function buildSizingSheetHtml(d) {
  return renderSheet(d, computeSheet(d));
}

/** Ouvre la fiche dans le lecteur intégré (repli : fichier HTML téléchargeable). */
export function openSizingSheet(data) {
  const html = buildSizingSheetHtml(data);
  const random = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const key = `${STORAGE_PREFIX}${random}`;

  try {
    // Le document reste local au navigateur : aucune donnée client n'est placée
    // dans l'URL. Le lecteur le transfère ensuite dans son sessionStorage.
    window.localStorage.setItem(key, JSON.stringify({ html, createdAt: Date.now() }));
    const reader = window.open(`/fiche-dimensionnement?document=${encodeURIComponent(key)}`, '_blank');
    if (reader) return;
    window.localStorage.removeItem(key);
  } catch {
    // Le bloqueur de pop-up ou un stockage indisponible utilise le repli ci-dessous.
  }

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fiche-dimensionnement.html';
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export { ouvrirFichePdf, construireFichePdf, pdfDepuisHtml } from './pdf';
