// Moteur de réplication Supabase (optionnel, auto-détecté). Isolé du Provider :
// reçoit l'état et son setter, gère le pull initial, la diffusion temps réel
// et la réplication non-destructive (tombstones). Retourne le statut de sync.
import { useCallback, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { pullAll, pushCollections, pushTombstone, resynchroniserOrg, subscribeToChanges, lignesRefuseesParTable, SYNCED_COLLECTIONS } from '../lib/remoteSync';
import { estRefusRls, MESSAGE_REFUS_RLS, messageLignesRefusees } from '../utils/erreurSync';
import { peutEnvoyer } from '../utils/etatSync';
import { loadFileSync, persistFileSync } from './dataState';
import { fileEnAttente, unionFiles, totalEnAttente, enAttentePourTable, fusionnerCollection } from '../utils/fileSync';

// Filet de sécurité du temps réel : intervalle entre deux relectures du
// serveur quand l'app est visible. Le temps réel reste le canal principal
// (propagation immédiate) ; ce rappel régulier couvre ce qu'il peut manquer —
// table absente de la publication `supabase_realtime`, connexion coupée,
// téléphone sorti de veille. Sans lui, un kit ajouté par le gérant n'arrivait
// au technicien qu'au prochain lancement de l'app.
const INTERVALLE_RELECTURE = 60000;

// Délai avant une nouvelle tentative, doublé à chaque échec et plafonné.
// Sert aussi bien à la CONNEXION initiale qu'au renvoi des modifications.
const delaiReprise = (echecs) => Math.min(60000, 5000 * 2 ** Math.max(0, echecs - 1));

// L'appareil se sait-il sans réseau ? Distingue la coupure ordinaire — banale
// sur le terrain, rien à signaler — d'un serveur qui refuse, qui, lui, demande
// une intervention. `navigator.onLine` n'est fiable que dans ce sens : « faux »
// veut dire hors-ligne à coup sûr, « vrai » ne promet rien.
const horsLigne = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export function useRemoteSync(state, setState, stateRef, scope = null) {
  const syncedRef = useRef(null); // dernier état RÉELLEMENT répliqué, par collection
  const lastPushAt = useRef(0);
  const echecs = useRef(0);       // échecs consécutifs de push (délai croissant)
  // Second passage : écarter les lignes refusées une à une. Armé seulement
  // après un réalignement d'organisation resté sans effet — sinon on se
  // priverait de la réparation qui, elle, débloque TOUT d'un coup.
  const isolerRefus = useRef(false);
  const retryTimer = useRef(null);
  const [retryTick, setRetryTick] = useState(0); // relance un envoi échoué
  const [syncStatus, setSyncStatus] = useState(isSupabaseConfigured ? 'connecting' : 'local');
  // Motif du dernier échec, affiché dans l'app : sans lui, « Serveur
  // injoignable » n'aide personne à comprendre CE qui est refusé.
  const [syncError, setSyncError] = useState(null);

  // ---- File d'attente : ce qui est modifié ici et pas encore confirmé ----
  // Elle SURVIT à la fermeture de l'app. Sans elle, une modification faite
  // hors-ligne (étape d'un client, prix d'un kit) était écrasée au lancement
  // suivant par la copie du serveur, plus ancienne — silencieusement, et
  // seulement pour les modifications : les créations, absentes du serveur,
  // étaient bien conservées.
  const fileInitiale = useRef(isSupabaseConfigured ? loadFileSync(scope) : {});
  const fileRef = useRef(fileInitiale.current);
  // État au montage : sert de référence de comparaison tant que rien n'a été
  // répliqué dans cette session (app ouverte sans réseau). Comparer à `null`
  // ferait passer TOUTE la base locale — catalogue compris — pour « en
  // attente », et afficherait un compte absurde.
  const baseRef = useRef(state);
  const [enAttente, setEnAttente] = useState(() => totalEnAttente(fileInitiale.current));

  // Recalcule la file depuis la dernière référence connue, la retient et
  // l'enregistre. Tant que la session n'a rien répliqué, la file de la session
  // précédente compte toujours : elle n'a pas été envoyée pour autant.
  const fileEcrite = useRef(null); // dernière forme enregistrée, pour ne pas réécrire à l'identique
  const majFile = useCallback((etat) => {
    const vivante = fileEnAttente(SYNCED_COLLECTIONS, syncedRef.current || baseRef.current, etat);
    const file = syncedRef.current ? vivante : unionFiles(fileInitiale.current, vivante);
    fileRef.current = file;
    // Écriture seulement quand la file CHANGE : la frappe au clavier remet le
    // même identifiant en attente des dizaines de fois d'affilée, inutile de
    // réécrire le stockage à chaque caractère.
    const forme = JSON.stringify(file);
    if (forme !== fileEcrite.current) {
      fileEcrite.current = forme;
      persistFileSync(file, scope);
      setEnAttente(totalEnAttente(file));
    }
    return file;
  }, [scope]);

  // La relecture et la connexion sont déclenchées depuis d'autres effets
  // (filet de sécurité, bouton « Synchroniser maintenant ») : exposées par des
  // refs, remplies au montage.
  const refreshRef = useRef(null);
  const connecterRef = useRef(null);

  // ---- Connexion (pull initial + abonnement temps réel), avec reprise ----
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let cancelled = false;
    let unsubscribe = () => {};
    let timerConnexion = null;
    let echecsConnexion = 0;
    let enCours = false;

    // Pull fusionné : les modifications locales en attente et les items créés
    // hors-ligne survivent à la réception (voir utils/fileSync.js).
    const applyRemote = (collections, tombstones = new Map()) => {
      const merged = { ...stateRef.current };
      for (const table of SYNCED_COLLECTIONS) {
        merged[table] = fusionnerCollection(
          stateRef.current[table] || [],
          collections[table] || [],
          tombstones.get(table) || new Set(),
          enAttentePourTable(fileRef.current, table)
        );
      }
      syncedRef.current = collections;
      setState(merged);
      // La file se recalcule maintenant depuis le serveur : ce qui vient d'en
      // arriver n'attend plus, ce qui a été retenu localement attend encore.
      majFile(merged);
    };

    const refreshFromRemote = async () => {
      try {
        // Passer les tombstones est indispensable : sinon une suppression faite
        // sur un autre appareil n'est pas appliquée au merge (l'item local serait
        // traité comme « créé hors-ligne » puis ré-uploadé en zombie).
        const { collections, tombstones } = await pullAll();
        if (!cancelled) applyRemote(collections, tombstones);
      } catch (e) {
        console.error('Synchronisation Supabase impossible :', e.message);
      }
    };
    refreshRef.current = refreshFromRemote;

    // Première connexion au serveur. REJOUÉE tant qu'elle échoue : sans cela,
    // une app ouverte hors réseau restait déconnectée pour toute la session,
    // même une fois la 4G revenue — une journée de travail ne montait qu'au
    // prochain rechargement complet de la page.
    const connecter = async () => {
      if (cancelled || enCours || syncedRef.current) return;
      enCours = true;
      try {
        const { empty, collections, tombstones } = await pullAll();
        if (cancelled) return;
        // Ne bootstrapper que sur une base RÉELLEMENT vierge : aucune ligne ET
        // aucun tombstone. Une base vidée volontairement porte des tombstones ;
        // re-seeder depuis le localStorage de cet appareil ressusciterait alors
        // les données effacées par l'équipe.
        const pristine = empty && tombstones.size === 0;
        if (pristine) {
          // Première initialisation : la base reçoit les données de cet appareil
          const initial = Object.fromEntries(SYNCED_COLLECTIONS.map((t) => [t, stateRef.current[t] || []]));
          lastPushAt.current = Date.now();
          await pushCollections(initial);
          if (cancelled) return;
          syncedRef.current = initial;
          majFile(stateRef.current);
        } else {
          applyRemote(collections, tombstones);
        }
        echecsConnexion = 0;
        setSyncError(null);
        setSyncStatus('online');
        let timer = null;
        unsubscribe = subscribeToChanges(() => {
          // Ignorer l'écho de nos propres écritures, regrouper les rafales
          if (Date.now() - lastPushAt.current < 2500) return;
          clearTimeout(timer);
          timer = setTimeout(refreshFromRemote, 600);
        });
      } catch (e) {
        if (cancelled) return;
        console.error('Supabase indisponible, mode local :', e.message);
        setSyncError(e.message);
        setSyncStatus('error');
        echecsConnexion += 1;
        clearTimeout(timerConnexion);
        timerConnexion = setTimeout(connecter, delaiReprise(echecsConnexion));
      } finally {
        enCours = false;
      }
    };
    connecterRef.current = connecter;
    connecter();

    // Reprise immédiate au retour du réseau ou de l'app, sans attendre le
    // minuteur : c'est le geste naturel de l'utilisateur qui ressort de la
    // zone blanche et rouvre l'app.
    const reprendre = () => { if (!syncedRef.current) connecter(); };
    window.addEventListener('online', reprendre);
    window.addEventListener('focus', reprendre);
    document.addEventListener('visibilitychange', reprendre);

    return () => {
      cancelled = true;
      clearTimeout(timerConnexion);
      unsubscribe();
      window.removeEventListener('online', reprendre);
      window.removeEventListener('focus', reprendre);
      document.removeEventListener('visibilitychange', reprendre);
    };
  // Dépendances volontairement vides : ce pull initial + abonnement temps réel
  // ne doit s'exécuter QU'UNE FOIS par montage. setState est stable (useState)
  // et stateRef est une ref — les inclure relancerait la souscription à chaque
  // rendu, ce qui provoquerait des re-pulls en boucle.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Réplication des changements locaux ----
  // Push uniquement les collections modifiées ; les suppressions passent par tombstones.
  //
  // RÈGLE CRITIQUE : `syncedRef` n'est mis à jour qu'APRÈS un push réussi.
  // Le marquer avant ferait passer pour répliquées des données restées locales :
  // elles ne seraient jamais repoussées (perte silencieuse) et le voyant
  // resterait au vert. En cas d'échec, le statut passe à « error » (visible) et
  // le même envoi est retenu avec un délai croissant.
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    // La file est tenue à jour MÊME sans connexion : c'est elle qui protège
    // le travail fait hors-ligne, et elle alimente le compte affiché.
    majFile(state);
    if (!syncedRef.current) return undefined;
    if (!peutEnvoyer(syncStatus)) return undefined;
    const changed = {};
    const deletedByTable = {};
    for (const table of SYNCED_COLLECTIONS) {
      if (state[table] === syncedRef.current[table]) continue;
      changed[table] = state[table] || [];
      // Détection des suppressions locales. Les éléments PARTAGÉS en sont
      // exclus : ils ne nous appartiennent pas, et un tombstone porte sur un
      // id — il masquerait la ligne de l'organisation interne à la réception
      // suivante, faisant disparaître un cours partagé pour tout le monde ici.
      const prevIds = new Set((syncedRef.current[table] || []).filter((i) => !i.partage).map((i) => i.id));
      const nextIds = new Set((state[table] || []).map((i) => i.id));
      const deleted = [...prevIds].filter((id) => !nextIds.has(id));
      if (deleted.length) deletedByTable[table] = deleted;
    }
    if (!Object.keys(changed).length) return undefined;

    let annule = false;
    lastPushAt.current = Date.now();
    const doSync = async () => {
      const erreurs = [];
      let reussies = [];
      try {
        reussies = await pushCollections(changed, { isolerRefus: isolerRefus.current });
      } catch (e) {
        reussies = e.reussies || [];
        erreurs.push(e.message);
      }
      // Suppressions locales → tombstones, suivies PAR TABLE et tentées même
      // si l'envoi des lignes a échoué (opérations indépendantes, upsert
      // idempotent). Avant, un seul tombstone en échec faisait tout perdre :
      // l'erreur n'ayant pas de `reussies`, AUCUNE table n'était acquise et
      // l'intégralité repartait à chaque reprise — le volume ne redescendait
      // jamais, voyant rouge en permanence.
      const suppressionsEchouees = new Set();
      for (const [table, ids] of Object.entries(deletedByTable)) {
        for (const id of ids) {
          try {
            await pushTombstone(table, id);
          } catch (e) {
            suppressionsEchouees.add(table);
            erreurs.push(`${table} (suppression) : ${e.message}`);
            break;
          }
        }
      }
      if (annule) return;
      // Une table n'est acquise que si ses lignes ET ses suppressions sont
      // passées. L'acquérir avec un tombstone en échec ferait oublier la
      // suppression (deletedByTable est recalculé depuis syncedRef) : l'item
      // resterait sur le serveur et réapparaîtrait au pull suivant (zombie).
      const acquises = reussies.filter((t) => !suppressionsEchouees.has(t));
      if (acquises.length) {
        const acquis = { ...syncedRef.current };
        for (const t of acquises) if (changed[t]) acquis[t] = changed[t];
        syncedRef.current = acquis;
        // Ce qui vient d'être confirmé quitte la file d'attente.
        majFile(stateRef.current);
      }
      if (!erreurs.length) {
        // Réellement répliqué : on peut enfin considérer ces données à jour.
        echecs.current = 0;
        // ... à une exception près : les lignes que le serveur REFUSE, mises de
        // côté pour ne pas bloquer les autres. Elles ne sont pas parties, et
        // l'app doit le dire — le voyant reste vert parce que tout le reste
        // circule, le détail nomme ce qui est resté à quai.
        setSyncError(messageLignesRefusees(lignesRefuseesParTable()));
        setSyncStatus('online');
        return;
      }
      console.error('Réplication Supabase échouée :', erreurs.join(' · '));
      // Refus de la sécurité au niveau ligne : la ligne porte une organisation
      // qui n'est plus celle du compte — l'organisation est lue à la CONNEXION
      // et un rattachement corrigé entre-temps la périme. On la relit auprès de
      // la base ; si elle a bougé, l'envoi repart tout de suite avec la bonne,
      // sans attendre la déconnexion. C'est le seul cas où réessayer plus vite
      // a un sens : rien d'autre n'aura changé entre deux tentatives.
      if (erreurs.some(estRefusRls)) {
        const { change } = await resynchroniserOrg();
        if (annule) return;
        if (change) {
          setSyncError(null);
          setRetryTick((t) => t + 1);
          return;
        }
        // L'estampille était déjà la bonne : ce ne sont donc pas TOUTES les
        // lignes qui sont refusées, mais certaines — celles saisies par un
        // autre membre, que la politique des clients réserve à leur auteur.
        // On repart aussitôt en les isolant : le reste passe enfin, et on
        // saura exactement combien restent à quai.
        if (!isolerRefus.current) {
          isolerRefus.current = true;
          // Le statut n'est PAS touché : seuls `online` et `error` autorisent
          // un envoi (STATUTS_QUI_ENVOIENT). Le passer à « connecting » ici
          // bloquait la relance qu'on vient de demander — voyant orange figé,
          // et plus rien qui part jusqu'au rechargement de la page.
          setRetryTick((t) => t + 1);
          return;
        }
        // Isolation déjà tentée et refus toujours global : la cause est
        // ailleurs, et le message brut de PostgreSQL n'aide personne.
        echecs.current += 1;
        const bloquees = Object.keys(changed).filter((t) => !acquises.includes(t));
        setSyncError(`${MESSAGE_REFUS_RLS}${bloquees.length ? ` (en attente : ${bloquees.join(', ')})` : ''}`);
        setSyncStatus('error');
        clearTimeout(retryTimer.current);
        retryTimer.current = setTimeout(() => setRetryTick((t) => t + 1), delaiReprise(echecs.current));
        return;
      }
      // Le voyant passe au rouge et l'envoi est REJOUÉ : les données locales
      // restent marquées « à pousser » tant qu'elles ne sont pas arrivées.
      echecs.current += 1;
      const restantes = Object.keys(changed).filter((t) => !acquises.includes(t));
      setSyncError(`${erreurs.join(' · ')}${restantes.length ? ` (en attente : ${restantes.join(', ')})` : ''}`);
      setSyncStatus('error');
      clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => setRetryTick((t) => t + 1), delaiReprise(echecs.current));
    };
    doSync();
    return () => { annule = true; };
  }, [state, syncStatus, retryTick, majFile, stateRef]); // stateRef est une ref stable

  // ---- Filet de sécurité : relecture régulière et au retour de l'app ----
  // Le temps réel reste le canal principal, mais il ne garantit rien : une
  // table oubliée dans la publication Supabase, un socket coupé ou un
  // téléphone en veille et l'appareil ne voit plus rien arriver. Ici, il
  // rattrape au plus tard en une minute, et immédiatement au retour à l'écran.
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    const relire = () => {
      if (syncStatus !== 'online' || !syncedRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      // Jamais par-dessus un changement local pas encore répliqué : la
      // réception le protège désormais (file d'attente), mais relire pendant
      // un envoi en cours ne sert à rien — l'écho reviendra juste après.
      if (SYNCED_COLLECTIONS.some((t) => stateRef.current[t] !== syncedRef.current[t])) return;
      // Ni dans la foulée de notre propre écriture (l'écho revient à peine).
      if (Date.now() - lastPushAt.current < 2500) return;
      refreshRef.current?.();
    };
    // Retour du réseau alors que des modifications attendent : les renvoyer
    // tout de suite plutôt que d'attendre la fin du délai de reprise en cours.
    const reprendreEnvoi = () => {
      if (syncedRef.current && syncStatus !== 'online') setRetryTick((t) => t + 1);
    };
    const timer = setInterval(relire, INTERVALLE_RELECTURE);
    document.addEventListener('visibilitychange', relire);
    window.addEventListener('online', relire);
    window.addEventListener('online', reprendreEnvoi);
    window.addEventListener('focus', relire);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', relire);
      window.removeEventListener('online', relire);
      window.removeEventListener('online', reprendreEnvoi);
      window.removeEventListener('focus', relire);
    };
  }, [syncStatus, stateRef]);

  // ---- Réseau de l'appareil : coupure ordinaire ou serveur qui refuse ? ----
  // Les deux donnaient « Serveur injoignable ». Sur le terrain, la coupure est
  // la règle : la signaler comme une panne rendait le voyant rouge permanent,
  // donc ignoré — et le vrai refus passait inaperçu avec lui.
  const [reseauCoupe, setReseauCoupe] = useState(horsLigne);
  useEffect(() => {
    const majReseau = () => setReseauCoupe(horsLigne());
    window.addEventListener('online', majReseau);
    window.addEventListener('offline', majReseau);
    return () => {
      window.removeEventListener('online', majReseau);
      window.removeEventListener('offline', majReseau);
    };
  }, []);

  // Relance manuelle : reconnecte si la session n'a jamais joint le serveur,
  // sinon renvoie ce qui attend et relit le serveur.
  const synchroniserMaintenant = useCallback(() => {
    if (!isSupabaseConfigured) return;
    if (!syncedRef.current) { connecterRef.current?.(); return; }
    clearTimeout(retryTimer.current);
    echecs.current = 0;
    setRetryTick((t) => t + 1);
    refreshRef.current?.();
  }, []);

  // Arrêt du minuteur de reprise au démontage (évite un setState post-unmount).
  useEffect(() => () => clearTimeout(retryTimer.current), []);

  // Statut affiché : une panne d'envoi alors que l'appareil se sait sans
  // réseau est un « hors ligne », pas une erreur — le travail est en sécurité
  // localement et repartira tout seul.
  const statut = syncStatus === 'error' && reseauCoupe ? 'offline' : syncStatus;
  return { syncStatus: statut, syncError, enAttente, synchroniserMaintenant };
}
