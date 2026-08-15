import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileText, Printer, X, ZoomIn, ZoomOut } from 'lucide-react';

const STORAGE_PREFIX = 'besta:sizing-sheet:';
const PAGES = [
  { number: 1, label: 'Synthèse', description: 'Besoin et charges' },
  { number: 2, label: 'Étude technique', description: 'Matériel et calculs' },
  { number: 3, label: 'Analyse', description: 'Couverture et rentabilité' },
];

function readDocument() {
  const key = new URLSearchParams(window.location.search).get('document');
  if (!key?.startsWith(STORAGE_PREFIX)) return '';
  const inSession = window.sessionStorage.getItem(key);
  if (inSession) return inSession;
  const saved = window.localStorage.getItem(key);
  if (!saved) return '';
  try {
    const { html } = JSON.parse(saved);
    if (html) window.sessionStorage.setItem(key, html);
    window.localStorage.removeItem(key);
    return html || '';
  } catch {
    window.localStorage.removeItem(key);
    return '';
  }
}

export default function SizingSheetViewer() {
  const frameRef = useRef(null);
  const [html, setHtml] = useState('');
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(92);

  useEffect(() => { setHtml(readDocument()); }, []);

  const goToPage = (nextPage) => {
    const safePage = Math.max(1, Math.min(PAGES.length, nextPage));
    setPage(safePage);
    const target = frameRef.current?.contentWindow?.document?.querySelectorAll('.page')?.[safePage - 1];
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const print = () => frameRef.current?.contentWindow?.print();

  const download = () => {
    if (!html) return;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fiche-dimensionnement.html';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  if (!html) {
    return (
      <main className="sizing-viewer sizing-viewer-empty">
        <FileText size={38} />
        <h1>Fiche indisponible</h1>
        <p>Revenez au dimensionnement puis ouvrez à nouveau la fiche.</p>
        <button type="button" className="sizing-viewer-close" onClick={() => window.close()}>
          <X size={17} /> Fermer cette page
        </button>
      </main>
    );
  }

  return (
    <main className="sizing-viewer">
      <header className="sizing-viewer-toolbar">
        <div className="sizing-viewer-brand">
          <span className="sizing-viewer-logo"><FileText size={18} /></span>
          <div><strong>Fiche de dimensionnement</strong><span>Aperçu du document</span></div>
        </div>

        <div className="sizing-viewer-controls" aria-label="Contrôles du document">
          <button type="button" aria-label="Page précédente" disabled={page === 1} onClick={() => goToPage(page - 1)}><ChevronLeft size={19} /></button>
          <span className="sizing-viewer-page-count">{page} / {PAGES.length}</span>
          <button type="button" aria-label="Page suivante" disabled={page === PAGES.length} onClick={() => goToPage(page + 1)}><ChevronRight size={19} /></button>
          <span className="sizing-viewer-separator" />
          <button type="button" aria-label="Réduire l’aperçu" disabled={zoom <= 70} onClick={() => setZoom((value) => value - 10)}><ZoomOut size={18} /></button>
          <span className="sizing-viewer-zoom">{zoom}%</span>
          <button type="button" aria-label="Agrandir l’aperçu" disabled={zoom >= 110} onClick={() => setZoom((value) => value + 10)}><ZoomIn size={18} /></button>
          <span className="sizing-viewer-separator" />
          <button type="button" className="sizing-viewer-action" onClick={download}><Download size={17} /> Télécharger</button>
          <button type="button" className="sizing-viewer-action sizing-viewer-print" onClick={print}><Printer size={17} /> Imprimer / PDF</button>
          <button type="button" className="sizing-viewer-icon-close" aria-label="Fermer" onClick={() => window.close()}><X size={19} /></button>
        </div>
      </header>

      <div className="sizing-viewer-body">
        <aside className="sizing-viewer-sidebar" aria-label="Pages de la fiche">
          <div className="sizing-viewer-sidebar-title">Pages</div>
          {PAGES.map((item) => (
            <button key={item.number} type="button" className={'sizing-viewer-thumb' + (page === item.number ? ' active' : '')} onClick={() => goToPage(item.number)}>
              <span className="sizing-viewer-thumb-paper"><span>{item.number}</span><i /><i /><i /><b /></span>
              <span className="sizing-viewer-thumb-copy"><strong>{item.number}. {item.label}</strong><small>{item.description}</small></span>
            </button>
          ))}
        </aside>

        <section className="sizing-viewer-stage" aria-label="Aperçu de la fiche">
          <div className="sizing-viewer-sheet" style={{ '--sheet-zoom': zoom / 100 }}>
            <iframe ref={frameRef} title="Fiche de dimensionnement" srcDoc={html} />
          </div>
        </section>
      </div>

      <style>{`
        .sizing-viewer { min-height: 100vh; background: #1b202a; color: #edf1f7; display: flex; flex-direction: column; }
        .sizing-viewer-toolbar { min-height: 68px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 10px 20px; background: #252c38; border-bottom: 1px solid #384352; }
        .sizing-viewer-brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .sizing-viewer-logo { display: grid; place-items: center; width: 35px; height: 35px; border-radius: 9px; background: #f5a623; color: #07183f; flex-shrink: 0; }
        .sizing-viewer-brand strong, .sizing-viewer-brand span { display: block; }
        .sizing-viewer-brand strong { font-size: .92rem; }
        .sizing-viewer-brand div span { margin-top: 1px; font-size: .72rem; color: #aeb9c8; }
        .sizing-viewer-controls { display: flex; align-items: center; gap: 6px; }
        .sizing-viewer-controls button, .sizing-viewer-close { min-height: 36px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 7px 9px; color: #e8edf5; border-radius: 7px; font-size: .8rem; font-weight: 600; }
        .sizing-viewer-controls button:hover:not(:disabled), .sizing-viewer-close:hover { background: #354152; }
        .sizing-viewer-controls button:disabled { opacity: .38; cursor: not-allowed; }
        .sizing-viewer-page-count, .sizing-viewer-zoom { min-width: 44px; text-align: center; font-size: .78rem; color: #c8d1df; font-variant-numeric: tabular-nums; }
        .sizing-viewer-separator { width: 1px; height: 25px; margin: 0 4px; background: #465262; }
        .sizing-viewer-action { border: 1px solid #465262; }
        .sizing-viewer-print { background: #f5a623; border-color: #f5a623; color: #16223b !important; }
        .sizing-viewer-icon-close { margin-left: 4px; }
        .sizing-viewer-body { flex: 1; min-height: 0; display: flex; }
        .sizing-viewer-sidebar { width: 224px; flex-shrink: 0; padding: 18px 12px; overflow-y: auto; background: #202733; border-right: 1px solid #384352; }
        .sizing-viewer-sidebar-title { padding: 0 8px 10px; color: #aeb9c8; font-size: .71rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
        .sizing-viewer-thumb { width: 100%; display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 9px; color: #cbd4e1; }
        .sizing-viewer-thumb:hover, .sizing-viewer-thumb.active { background: #303b4b; }
        .sizing-viewer-thumb.active { box-shadow: inset 2px 0 0 #f5a623; }
        .sizing-viewer-thumb-paper { width: 54px; height: 72px; padding: 9px 7px; display: flex; flex-direction: column; gap: 5px; background: #fff; box-shadow: 0 3px 9px rgba(0,0,0,.3); color: #64748b; flex-shrink: 0; }
        .sizing-viewer-thumb-paper span { font-size: 8px; font-weight: 800; color: #0a2472; }
        .sizing-viewer-thumb-paper i { height: 3px; background: #d9e0e8; display: block; }
        .sizing-viewer-thumb-paper b { height: 15px; margin-top: auto; background: #e9edf2; display: block; }
        .sizing-viewer-thumb-copy { min-width: 0; text-align: left; }
        .sizing-viewer-thumb-copy strong, .sizing-viewer-thumb-copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sizing-viewer-thumb-copy strong { font-size: .78rem; color: inherit; }
        .sizing-viewer-thumb-copy small { margin-top: 2px; font-size: .68rem; color: #9eabba; }
        .sizing-viewer-stage { flex: 1; min-width: 0; overflow: auto; padding: 28px; background: #171c25; }
        .sizing-viewer-sheet { width: 794px; height: 1123px; margin: 0 auto; transform: scale(var(--sheet-zoom)); transform-origin: top center; box-shadow: 0 12px 35px rgba(0,0,0,.4); }
        .sizing-viewer-sheet iframe { width: 794px; height: 1123px; border: 0; background: white; display: block; }
        .sizing-viewer-empty { align-items: center; justify-content: center; gap: 10px; text-align: center; padding: 24px; }
        .sizing-viewer-empty svg { color: #f5a623; }
        .sizing-viewer-empty h1 { font-size: 1.25rem; }
        .sizing-viewer-empty p { color: #aeb9c8; font-size: .9rem; }
        .sizing-viewer-close { margin-top: 8px; border: 1px solid #465262; }
        @media (max-width: 760px) {
          .sizing-viewer-toolbar { align-items: flex-start; padding: 11px 12px; }
          .sizing-viewer-controls { flex-wrap: wrap; justify-content: flex-end; }
          .sizing-viewer-action { font-size: 0; width: 36px; }
          .sizing-viewer-sidebar { width: 74px; padding: 12px 7px; }
          .sizing-viewer-sidebar-title, .sizing-viewer-thumb-copy { display: none; }
          .sizing-viewer-thumb { justify-content: center; padding: 7px; }
          .sizing-viewer-stage { padding: 18px 10px; }
          .sizing-viewer-sheet { transform-origin: top left; }
        }
      `}</style>
    </main>
  );
}
