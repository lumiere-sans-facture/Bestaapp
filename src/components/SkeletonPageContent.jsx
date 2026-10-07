import { formeSquelette, titreSquelette } from '../utils/squelette';

/**
 * Squelette de contenu de page, à la FORME de la page en cours (voir
 * utils/squelette.js) : colonnes du suivi, cartes clients, grille de la
 * boutique, liste des devis, menu « Plus »… Utilisé par LoadingShell
 * (session en cours de résolution, au rafraîchissement) et par le `Suspense`
 * de AppLayout (chargement d'un écran). Construit avec les classes des vraies
 * pages : quand le contenu arrive, rien ne saute.
 */
const Barre = ({ l = '100%', h = 12, style }) => <span className="skeleton" style={{ width: l, height: h, ...style }} />;
const Rond = ({ d = 42 }) => <span className="skeleton" style={{ width: d, height: d, borderRadius: '50%', flexShrink: 0 }} />;
const repete = (n, rendu) => Array.from({ length: n }).map((_, i) => rendu(i));

const Tableau = () => (
  <>
    <div className="stat-strip">
      {repete(4, (i) => (
        <div key={i} className="stat-pill">
          <Rond />
          <Barre l="70%" h={11} />
        </div>
      ))}
    </div>
    <div className="card">
      <Barre l="35%" h={15} style={{ marginBottom: 16 }} />
      <Barre h={110} />
    </div>
  </>
);

const Kanban = () => (
  <div className="kanban-container">
    {repete(3, (i) => (
      <div key={i} className="kanban-column">
        <div className="kanban-column-header">
          <Barre l="45%" h={14} />
          <Barre l="65%" h={10} style={{ marginTop: 8 }} />
        </div>
        <div className="kanban-column-body">
          {repete(i === 0 ? 2 : 1, (j) => (
            <div key={j} className="card" style={{ display: 'grid', gap: 10 }}>
              <Barre l="70%" h={14} />
              <Barre l="45%" h={11} />
              <Barre l="35%" h={13} />
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const Recherche = () => <span className="skeleton" style={{ display: 'block', width: '100%', maxWidth: 320, height: 42, borderRadius: 10, marginBottom: 16 }} />;

const Cartes = () => (
  <>
    <Recherche />
    <div className="client-grid">
      {repete(3, (i) => (
        <div key={i} className="card" style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Rond d={44} />
            <div style={{ flex: 1, display: 'grid', gap: 8 }}><Barre l="65%" h={14} /><Barre l="35%" h={18} /></div>
          </div>
          <Barre l="55%" h={11} />
          <Barre l="45%" h={11} />
        </div>
      ))}
    </div>
  </>
);

const Fiche = () => (
  <>
    <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
      <Rond d={56} />
      <div style={{ flex: 1, display: 'grid', gap: 8 }}><Barre l="55%" h={16} /><Barre l="40%" h={11} /></div>
    </div>
    <div className="card" style={{ display: 'grid', gap: 12 }}>{repete(4, (i) => <Barre key={i} l={`${80 - i * 12}%`} h={12} />)}</div>
  </>
);

const Puces = () => (
  <div className="categories-scroll">
    {repete(4, (i) => <span key={i} className="skeleton" style={{ width: i === 0 ? 64 : 104, height: 38, borderRadius: 999, flexShrink: 0 }} />)}
  </div>
);

const Boutique = () => (
  <>
    <Puces />
    <div className="products-grid">
      {repete(4, (i) => (
        <div key={i} className="product-card card" style={{ display: 'grid', gap: 10 }}>
          <Barre l="80%" h={14} />
          <Barre l="40%" h={10} />
          <Barre h={110} />
          <Barre l="55%" h={15} />
        </div>
      ))}
    </div>
  </>
);

const Liste = () => (
  <div className="flat-list">
    {repete(5, (i) => (
      <div key={i} className="flat-row">
        <div className="flat-row-main" style={{ display: 'grid', gap: 9 }}>
          <Barre l="60%" h={14} />
          <Barre l="35%" h={11} />
        </div>
        <Barre l={86} h={14} />
      </div>
    ))}
  </div>
);

const LignesMenu = ({ n }) => (
  <div className="plus-card card">
    {repete(n, (i) => (
      <div key={i} className="menu-item">
        <span className="skeleton" style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0 }} />
        <div className="menu-item-info" style={{ display: 'grid', gap: 7 }}>
          <Barre l="45%" h={13} />
          <Barre l="70%" h={10} />
        </div>
      </div>
    ))}
  </div>
);

const Menu = () => (
  <>
    <span className="skeleton" style={{ display: 'block', width: '100%', height: 96, borderRadius: 'var(--radius)', marginBottom: 16 }} />
    <Barre l={90} h={10} style={{ marginBottom: 10 }} />
    <LignesMenu n={6} />
  </>
);

const SousPage = () => (
  <>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
      <span className="skeleton" style={{ width: 96, height: 34, borderRadius: 10 }} />
      <span className="skeleton" style={{ width: 110, height: 34, borderRadius: 10 }} />
    </div>
    <LignesMenu n={5} />
  </>
);

const Formulaire = () => (
  <div className="card" style={{ display: 'grid', gap: 16 }}>
    {repete(4, (i) => (
      <div key={i} style={{ display: 'grid', gap: 8 }}>
        <Barre l="30%" h={11} />
        <span className="skeleton" style={{ width: '100%', height: 42, borderRadius: 10 }} />
      </div>
    ))}
  </div>
);

const FORMES = {
  tableau: Tableau, kanban: Kanban, cartes: Cartes, fiche: Fiche, boutique: Boutique,
  liste: Liste, menu: Menu, 'sous-page': SousPage, formulaire: Formulaire,
};

/** En-tête bleu de la page : le vrai titre s'il est fixe, sinon une barre. */
// Pages dont l'en-tête porte une rangée d'actions (bouton « Nouveau… »,
// recherche) sous le titre : le squelette la réserve, sans quoi le contenu
// descend d'un cran à l'arrivée de la page.
const AVEC_ACTIONS = new Set(['kanban', 'cartes', 'boutique', 'liste']);

export function EnteteSquelette({ chemin }) {
  const titre = titreSquelette(chemin);
  const forme = formeSquelette(chemin);
  return (
    <header className="page-header" aria-hidden={titre ? undefined : 'true'}>
      <div className="page-header-inner">
        <div className="page-header-text">
          {titre
            ? <h1 className="page-title">{titre}</h1>
            : <span className="skeleton skeleton-inverse" style={{ width: 180, height: 22 }} />}
          {forme !== 'menu' && (
            <span className="skeleton skeleton-inverse" style={{ display: 'block', width: 150, height: 12, marginTop: 10 }} />
          )}
          {AVEC_ACTIONS.has(forme) && (
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <span className="skeleton skeleton-inverse" style={{ width: 160, height: 40, borderRadius: 10 }} />
              <span className="skeleton skeleton-inverse" style={{ width: 40, height: 40, borderRadius: '50%' }} />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default function SkeletonPageContent({ chemin }) {
  const forme = formeSquelette(chemin ?? (typeof window !== 'undefined' ? window.location.pathname : '/'));
  const Contenu = FORMES[forme] || Tableau;
  return (
    <div className="page-content" aria-hidden="true" data-squelette={forme}>
      <Contenu />
    </div>
  );
}
