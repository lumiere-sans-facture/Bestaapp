import { Component } from 'react';

// Filet pour le découpage par route : si un chunk d'écran échoue à charger
// (réseau coupé au mauvais moment, ou hash obsolète après un déploiement en
// cours de session), on propose un rechargement au lieu de planter l'écran.
export default class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
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
