import { Component } from 'react';

// Un échec de chargement de chunk se reconnaît à son message : le module
// n'a pas pu être importé. Tout le reste est un vrai bug applicatif.
const ESTCHUNK = /Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

// Filet pour le découpage par route : si un chunk d'écran échoue à charger
// (réseau coupé au mauvais moment, ou hash obsolète après un déploiement en
// cours de session), on propose un rechargement au lieu de planter l'écran.
//
// Il ne traite QUE ce cas. Auparavant il attrapait toute erreur de rendu et
// affichait « Impossible de charger cette page » — message faux la plupart du
// temps, et surtout écran d'arrêt silencieux : le filet applicatif, qui lui
// consigne et permet de signaler, n'était jamais atteint. Une erreur qui ne
// le concerne pas est donc relancée pour qu'il la reçoive.
export default class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, autre: null };
  }

  static getDerivedStateFromError(error) {
    if (ESTCHUNK.test(error?.message || '') || ESTCHUNK.test(error?.name || '')) {
      return { failed: true, autre: null };
    }
    return { failed: false, autre: error };
  }

  render() {
    // Relancée pendant le rendu : le filet applicatif parent la reçoit.
    if (this.state.autre) throw this.state.autre;
    if (this.state.failed) {
      return (
        <div className="splash-screen">
          <span>Impossible de charger cette page.</span>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
