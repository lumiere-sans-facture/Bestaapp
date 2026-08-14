import { useState } from 'react';
import { Stethoscope, CheckCircle2, AlertTriangle, Send } from 'lucide-react';
import { signalerErreur } from '../lib/rapportErreur';
import { sentryConfigure } from '../lib/sentry';
import { analytiqueConfiguree } from '../lib/analytique';
import { useToast } from './Toast';

const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
const ENVIRONNEMENT = typeof __APP_ENV__ === 'string' ? __APP_ENV__ : 'test';

/**
 * « Diagnostic » — carte réservée au gérant, en bas du menu Plus.
 *
 * Elle répond à deux questions qu'aucun écran ne posait :
 *
 *  1. LE SUIVI EST-IL RÉELLEMENT ACTIF ? Une clé oubliée dans Vercel ne
 *     provoque aucune erreur : les plantages cessent simplement d'être
 *     rapportés, et l'absence de signalement se lit à tort comme « tout va
 *     bien ». Ici, l'état est écrit noir sur blanc.
 *  2. EST-CE QUE ÇA ARRIVE BIEN CHEZ MOI ? Le bouton envoie une erreur de
 *     test — inoffensive, elle ne fait pas planter l'écran — et affiche son
 *     code, qu'il suffit de chercher dans Sentry pour confirmer la chaîne
 *     complète.
 */
export default function DiagnosticCard() {
  const [dernier, setDernier] = useState(null);
  const toast = useToast();
  const sentryActif = sentryConfigure();
  const analytiqueActive = analytiqueConfiguree();

  const tester = () => {
    // signalerErreur consigne et transmet SANS lever : l'app continue de
    // fonctionner normalement, contrairement à un vrai plantage.
    const rapport = signalerErreur(
      new Error('Test du suivi des erreurs — déclenché depuis le Diagnostic'),
      { origine: 'test', ecran: '/plus' }
    );
    setDernier(rapport);
    toast(`Erreur de test envoyée — code ${rapport.code}`);
  };

  return (
    <div className="plus-section">
      <div className="plus-section-label">Diagnostic</div>
      <div className="card">
        <div className="sheet-row">
          <span className="sheet-label">Version installée</span>
          <span className="sheet-value paiement-mono">{VERSION} ({ENVIRONNEMENT})</span>
        </div>
        <div className="sheet-row">
          <span className="sheet-label">Suivi des erreurs</span>
          <span className="sheet-value">
            {sentryActif ? (
              <span className="diag-ok"><CheckCircle2 size={14} /> Sentry actif</span>
            ) : (
              <span className="diag-partiel"><AlertTriangle size={14} /> Journal serveur seul</span>
            )}
          </span>
        </div>
        <div className="sheet-row">
          <span className="sheet-label">Analytique</span>
          <span className="sheet-value">
            {analytiqueActive ? (
              <span className="diag-ok"><CheckCircle2 size={14} /> PostHog actif</span>
            ) : (
              <span className="diag-partiel"><AlertTriangle size={14} /> Non configurée</span>
            )}
          </span>
        </div>
        <p className="text-sm text-secondary" style={{ margin: '8px 0 0' }}>
          {sentryActif
            ? 'Les plantages partent vers Sentry et vers le journal serveur. Le test ci-dessous vérifie toute la chaîne.'
            : 'Sentry n’est pas configuré (VITE_SENTRY_DSN dans Vercel). Les plantages sont tout de même enregistrés dans le journal serveur.'}
        </p>

        <button className="btn btn-outline btn-block" style={{ marginTop: 12 }} onClick={tester}>
          <Send size={16} /> Envoyer une erreur de test
        </button>

        {dernier && (
          <div className="callout" role="status" style={{ marginTop: 12 }}>
            <div className="callout-title"><Stethoscope size={13} /> Test envoyé</div>
            <div className="text-sm">
              Code <strong className="paiement-mono">{dernier.code}</strong>. Cherchez-le dans
              Sentry (onglet <em>Issues</em>) ou dans la table <span className="paiement-mono">erreurs</span>.
              Il peut mettre une minute à apparaître. Aucun écran n’a planté : c’est voulu.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
