import { useState } from 'react';
import { Stethoscope, CheckCircle2, AlertTriangle, Send, ShieldCheck, ClipboardCopy } from 'lucide-react';
import { signalerErreur } from '../lib/rapportErreur';
import { isSupabaseConfigured } from '../lib/supabase';
import { diagnosticReplication } from '../lib/remoteSync';
import { clientsNonDetenus, verdictReplication } from '../utils/diagnosticReplication';
import { sqlReparationPour } from '../data/sqlReparationClients';
import { useData } from '../context/DataContext';
import { sentryConfigure } from '../lib/sentry';
import { analytiqueConfiguree, hoteAnalytique, problemeAnalytique, testerAnalytique } from '../lib/analytique';
import { useToast } from './Toast';

const verdictReplicationEtat = (etat) => ({ etat, verdict: verdictReplication(etat) });

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
  const [verdictAnalytique, setVerdictAnalytique] = useState(null);
  const [identite, setIdentite] = useState(null);
  const [identiteEnCours, setIdentiteEnCours] = useState(false);
  const [sqlCopie, setSqlCopie] = useState(false);
  const toast = useToast();
  const { leads } = useData();
  const sentryActif = sentryConfigure();
  const analytiqueActive = analytiqueConfiguree();
  const problemeConfig = problemeAnalytique();

  // Envoi réel vers PostHog, et affichage de SA réponse : une mauvaise région
  // (projet créé en « us », envois vers « eu ») ne se voit pas autrement.
  const testerEnvoiAnalytique = async () => {
    setVerdictAnalytique({ statut: '…' });
    const r = await testerAnalytique();
    setVerdictAnalytique(r);
    toast(r.ok ? 'Événement de test accepté par PostHog.' : `PostHog a répondu : ${r.statut}`,
      { type: r.ok ? 'success' : 'error' });
  };

  // Refus « row-level security » : les quatre valeurs qui le décident, relevées
  // à la source. Le gérant peut les lire et les transmettre — supposer coûtait
  // jusqu'ici plusieurs allers-retours.
  const testerIdentite = async () => {
    setIdentiteEnCours(true);
    try {
      const brut = await diagnosticReplication();
      // Ce que la base refusera, calculé localement : inutile de le lui demander.
      const refuses = clientsNonDetenus(leads, brut.profilId);
      setIdentite(verdictReplicationEtat({ ...brut, clientsNonDetenus: refuses.length }));
    } catch (e) {
      setIdentite({ erreur: e.message || 'Diagnostic impossible.' });
    } finally {
      setIdentiteEnCours(false);
    }
  };

  // Le gérant lit le refus sur son téléphone : lui demander d'aller chercher un
  // fichier dans le dépôt, c'est lui demander un ordinateur. Le script part
  // dans le presse-papiers, son adresse déjà remplie — il n'a plus qu'à ouvrir
  // le SQL Editor de Supabase et coller.
  const copierSqlReparation = async () => {
    const sql = sqlReparationPour(identite?.etat?.email);
    try {
      await navigator.clipboard.writeText(sql);
      setSqlCopie(true);
      setTimeout(() => setSqlCopie(false), 2500);
      toast('Script copié. Collez-le dans Supabase › SQL Editor, puis exécutez.');
    } catch {
      toast('Copie refusée par le navigateur.', { type: 'error' });
    }
  };

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
            {analytiqueActive && <span className="diag-ok"><CheckCircle2 size={14} /> PostHog actif</span>}
            {!analytiqueActive && problemeConfig && (
              <span className="diag-partiel"><AlertTriangle size={14} /> Mal configurée</span>
            )}
            {!analytiqueActive && !problemeConfig && (
              <span className="diag-partiel"><AlertTriangle size={14} /> Non configurée</span>
            )}
          </span>
        </div>
        {analytiqueActive && (
          <div className="sheet-row">
            <span className="sheet-label">Destination</span>
            <span className="sheet-value paiement-mono">{hoteAnalytique().replace('https://', '')}</span>
          </div>
        )}
        {problemeConfig && (
          <div className="callout callout-danger" role="status" style={{ marginTop: 8 }}>
            <div className="callout-title"><AlertTriangle size={13} /> Analytique à corriger dans Vercel</div>
            <div className="text-sm">{problemeConfig}</div>
            <div className="text-sm" style={{ marginTop: 6 }}>
              Aucun événement n’est envoyé tant que ce n’est pas corrigé — plutôt que de
              les expédier à la mauvaise adresse. Redéployez après la correction.
            </div>
          </div>
        )}
        <p className="text-sm text-secondary" style={{ margin: '8px 0 0' }}>
          {sentryActif
            ? 'Les plantages partent vers Sentry et vers le journal serveur. Le test ci-dessous vérifie toute la chaîne.'
            : 'Sentry n’est pas configuré (VITE_SENTRY_DSN dans Vercel). Les plantages sont tout de même enregistrés dans le journal serveur.'}
        </p>

        {isSupabaseConfigured && (
          <button className="btn btn-outline btn-block" style={{ marginTop: 12 }} onClick={testerIdentite} disabled={identiteEnCours}>
            <ShieldCheck size={16} /> {identiteEnCours ? 'Vérification…' : 'Vérifier l’identité de réplication'}
          </button>
        )}

        {identite && (
          <div className={`callout ${identite.verdict?.ok ? '' : 'callout-danger'}`} role="status" style={{ marginTop: 12 }}>
            <div className="callout-title">
              <ShieldCheck size={13} /> {identite.erreur ? 'Diagnostic impossible' : identite.verdict.titre}
            </div>
            {identite.erreur ? (
              <div className="text-sm">{identite.erreur}</div>
            ) : (
              <>
                <div className="text-sm">{identite.verdict.detail}</div>
                <div className="sheet-row">
                  <span className="sheet-label">Session</span>
                  <span className="sheet-value paiement-mono">{identite.etat.email || '—'}</span>
                </div>
                <div className="sheet-row">
                  <span className="sheet-label">Profil en base</span>
                  <span className="sheet-value paiement-mono">{identite.etat.profilTrouve ? (identite.etat.orgProfil || '—') : 'introuvable'}</span>
                </div>
                <div className="sheet-row">
                  <span className="sheet-label">Entreprise attendue</span>
                  <span className="sheet-value paiement-mono">{identite.etat.orgBase || '—'}</span>
                </div>
                <div className="sheet-row">
                  <span className="sheet-label">Gérant plateforme</span>
                  <span className="sheet-value paiement-mono">{identite.etat.adminPlateforme ? 'oui' : 'non'}</span>
                </div>
                <div className="sheet-row">
                  <span className="sheet-label">Clients d’un autre membre</span>
                  <span className="sheet-value paiement-mono">{identite.etat.clientsNonDetenus ?? 0}</span>
                </div>
                <div className="sheet-row">
                  <span className="sheet-label">Entreprise écrite</span>
                  <span className="sheet-value paiement-mono">{identite.etat.orgEcriture || '—'}</span>
                </div>
                {identite.verdict.code === 'clients-non-detenus' && (
                  <>
                    <p className="text-sm" style={{ margin: '10px 0 0' }}>
                      Ces clients ne partent pas d’ici et ne sont pas lisibles par ce
                      compte : le serveur les réserve à celui qui les a enregistrés.
                      Le script ci-dessous rend les clients du côté public visibles au
                      gérant. Les clients du Devis Pro, eux, restent privés.
                    </p>
                    <button className="btn btn-outline btn-block" style={{ marginTop: 10 }} onClick={copierSqlReparation}>
                      <ClipboardCopy size={16} /> {sqlCopie ? 'Script copié' : 'Copier le SQL de réparation'}
                    </button>
                    <p className="text-sm text-secondary" style={{ margin: '8px 0 0' }}>
                      À coller dans Supabase › SQL Editor, puis Exécuter. Votre adresse y
                      est déjà remplie. Le script affiche un tableau de contrôle qui dit
                      s’il a réussi. Ensuite, déconnectez-vous et reconnectez-vous.
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        )}

        <button className="btn btn-outline btn-block" style={{ marginTop: 12 }} onClick={tester}>
          <Send size={16} /> Envoyer une erreur de test
        </button>

        {analytiqueActive && (
          <button className="btn btn-outline btn-block" style={{ marginTop: 8 }} onClick={testerEnvoiAnalytique}>
            <Send size={16} /> Tester l’envoi analytique
          </button>
        )}

        {verdictAnalytique && (
          <div className={`callout ${verdictAnalytique.ok ? '' : 'callout-danger'}`} role="status" style={{ marginTop: 12 }}>
            <div className="callout-title">
              <Stethoscope size={13} /> {verdictAnalytique.ok ? 'PostHog a accepté' : 'PostHog a refusé'}
            </div>
            <div className="text-sm">
              Réponse <strong className="paiement-mono">{String(verdictAnalytique.statut)}</strong> depuis{' '}
              <span className="paiement-mono">{verdictAnalytique.hote?.replace('https://', '')}</span>.
              {!verdictAnalytique.ok && ' Vérifiez la clé et la RÉGION : un projet « us » ne reconnaît pas les envois vers « eu », et inversement.'}
            </div>
          </div>
        )}

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
