import SkeletonPageContent, { EnteteSquelette } from './SkeletonPageContent';
import { publicNavItems, proNavItems, clientsItem } from './navigation';
import IconeOnglet from './IconeOnglet';
import { formeSquelette, estAdressePro, ongletActif } from '../utils/squelette';

/**
 * Écran affiché pendant la résolution de la session (AuthContext.isLoading)
 * et le chargement du premier écran — au RAFRAÎCHISSEMENT d'une page.
 * Il prend la forme de LA page rechargée (utils/squelette.js) :
 *   - la vitrine (/) : un squelette de vitrine, pas celui de l'application ;
 *   - la connexion : un formulaire ;
 *   - une page de l'application : la vraie barre latérale et la vraie barre
 *     d'onglets (onglet de la page allumé), le vrai titre de la page quand il
 *     est fixe, et un contenu à la forme de la page (colonnes du suivi,
 *     grille de la boutique, menu « Plus »…).
 * Seule l'adresse est connue à ce stade (ni session, ni rôle, ni données) :
 * tout se déduit d'elle.
 */
const lireRepli = () => {
  try { return localStorage.getItem('bestasolar_sidebar_repliee') === '1'; } catch { return false; }
};

const S = ({ l, h, r = 6, style }) => <span className="skeleton" style={{ display: 'block', width: l, height: h, borderRadius: r, ...style }} />;

function SqueletteVitrine() {
  return (
    <div role="status" aria-live="polite" style={{ minHeight: '100vh', background: '#fff8ee' }}>
      <span className="sr-only">Chargement…</span>
      <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: '#fff', boxShadow: '0 1px 0 #eef0f5' }}>
        <S l={120} h={22} />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><S l={84} h={16} /><S l={100} h={36} r={8} /></div>
      </div>
      <div aria-hidden="true" style={{ maxWidth: 720, padding: '36px 20px', display: 'grid', gap: 18 }}>
        <S l={200} h={30} r={999} />
        <div style={{ display: 'grid', gap: 10 }}><S l="92%" h={34} /><S l="80%" h={34} /><S l="62%" h={34} /></div>
        <div style={{ display: 'grid', gap: 9, marginTop: 6 }}><S l="96%" h={14} /><S l="90%" h={14} /><S l="70%" h={14} /></div>
        <S l={226} h={56} r={8} style={{ marginTop: 12 }} />
        <S l={164} h={56} r={8} />
      </div>
    </div>
  );
}

function SqueletteConnexion() {
  return (
    <div role="status" aria-live="polite" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', padding: 16 }}>
      <span className="sr-only">Chargement…</span>
      <div className="card" aria-hidden="true" style={{ width: '100%', maxWidth: 400, display: 'grid', gap: 16 }}>
        <S l={140} h={28} style={{ margin: '0 auto 8px' }} />
        <S l="100%" h={44} r={10} />
        <S l="100%" h={44} r={10} />
        <S l="100%" h={46} r={10} />
      </div>
    </div>
  );
}

export default function LoadingShell() {
  const chemin = typeof window !== 'undefined' ? window.location.pathname : '/';
  const forme = formeSquelette(chemin);
  if (forme === 'accueil') return <SqueletteVitrine />;
  if (forme === 'connexion') return <SqueletteConnexion />;

  const pro = estAdressePro(chemin);
  const onglets = pro ? proNavItems : publicNavItems;
  const lateraux = pro ? proNavItems : publicNavItems.flatMap((i) => (i.path === '/pipeline' ? [i, clientsItem] : [i]));

  return (
    <div className={`app-shell ${lireRepli() ? 'sidebar-repliee' : ''}`} role="status" aria-live="polite">
      <span className="sr-only">Chargement…</span>
      <aside className="sidebar" aria-hidden="true">
        <div className="sidebar-brand">
          <span className="skeleton skeleton-inverse" style={{ width: 150, height: 30 }} />
        </div>
        <nav className="sidebar-nav">
          {lateraux.map((item) => (
            <div key={item.path} className={`sidebar-link ${ongletActif(item.path, chemin) ? 'active' : ''}`}>
              <item.icon size={20} strokeWidth={2} />
              <span>{item.label}</span>
            </div>
          ))}
        </nav>
      </aside>

      <main className="app-main">
        <EnteteSquelette chemin={chemin} />
        <SkeletonPageContent chemin={chemin} />
      </main>

      <nav className="tab-bar" aria-hidden="true">
        {onglets.map((item) => (
          <div key={item.path} className={`tab-item ${item.central ? 'tab-central' : ''} ${ongletActif(item.path, chemin) ? 'active' : ''}`}>
            <IconeOnglet item={item} />
            <span>{item.shortLabel}</span>
          </div>
        ))}
      </nav>
    </div>
  );
}
