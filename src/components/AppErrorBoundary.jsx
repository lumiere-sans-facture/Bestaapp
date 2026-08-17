import { Component } from 'react';
import { AlertTriangle, RotateCcw, MessageCircle } from 'lucide-react';
import { signalerErreur } from '../lib/rapportErreur';
import { suivre, EVENEMENTS } from '../lib/analytique';
import { messageSignalement } from '../utils/journalErreurs';
import { whatsappLink } from '../utils/paiement';
import { COMPANY } from '../config/company';

/**
 * Filet applicatif : tout plantage d'affichage est attrapé ici.
 *
 * Ce qu'il remplace : un écran affichait « Impossible de charger cette page »
 * pour N'IMPORTE QUELLE erreur de rendu — message faux dans la plupart des
 * cas — et personne n'était jamais prévenu. Un utilisateur bloqué à Kara
 * restait bloqué, sans que nous en sachions rien.
 *
 * Ce qu'il apporte :
 *  - un code court (« ERR-7F3A ») que l'utilisateur peut dicter au téléphone,
 *    et qui est le MÊME pour toutes les occurrences du même bug ;
 *  - un envoi du rapport, nettoyé de toute donnée personnelle, mis en file
 *    d'attente si l'appareil est hors-ligne ;
 *  - un signalement WhatsApp pré-rempli du contexte technique — parce que
 *    c'est par là que les utilisateurs écrivent réellement.
 */
export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { rapport: null };
  }

  static getDerivedStateFromError() {
    // Marqueur provisoire : le rapport complet est construit dans
    // componentDidCatch, qui seul reçoit la pile de composants.
    return { rapport: { code: '…' } };
  }

  componentDidCatch(error) {
    const rapport = signalerErreur(error, {
      origine: 'rendu',
      ecran: typeof window !== 'undefined' ? window.location?.pathname : '',
    });
    // Combien d'utilisateurs voient réellement cet écran ? Le journal compte
    // les plantages ; ceci compte les personnes bloquées.
    suivre(EVENEMENTS.ECRAN_PLANTE, { code: rapport.code, ecran: rapport.ecran });
    this.setState({ rapport });
  }

  render() {
    const { rapport } = this.state;
    if (!rapport) return this.props.children;

    const lien = whatsappLink(COMPANY.phone, messageSignalement(rapport, this.props.nomUtilisateur || ''));
    return (
      <div className="ecran-erreur">
        <div className="ecran-erreur-icone"><AlertTriangle size={30} /></div>
        <div className="ecran-erreur-titre">Cet écran n’a pas pu s’afficher</div>
        <p className="text-sm text-secondary">
          Vos données sont intactes — elles sont enregistrées sur cet appareil. Rechargez
          la page pour continuer.
        </p>
        <div className="ecran-erreur-code" aria-label="Code du problème">{rapport.code}</div>
        <p className="field-hint">
          Communiquez ce code si vous nous signalez le problème : il nous mène droit à la cause.
        </p>
        <button className="btn btn-primary btn-block" onClick={() => window.location.reload()}>
          <RotateCcw size={17} /> Recharger l’application
        </button>
        <a className="btn btn-outline btn-block" href={lien} target="_blank" rel="noopener noreferrer">
          <MessageCircle size={17} /> Signaler le problème
        </a>
      </div>
    );
  }
}
