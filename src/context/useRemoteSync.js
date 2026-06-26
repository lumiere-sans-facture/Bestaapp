// Moteur de réplication Supabase (optionnel, auto-détecté). Isolé du Provider :
// reçoit l'état et son setter, gère le pull initial, la diffusion temps réel
// et la réplication non-destructive (tombstones). Retourne le statut de sync.
import { useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { pullAll, pushCollections, pushTombstone, subscribeToChanges, SYNCED_COLLECTIONS } from '../lib/remoteSync';

export function useRemoteSync(state, setState, stateRef) {
  const syncedRef = useRef(null); // dernier état répliqué/reçu, par collection
  const lastPushAt = useRef(0);
  const [syncStatus, setSyncStatus] = useState(isSupabaseConfigured ? 'connecting' : 'local');

  // ---- Pull initial + abonnement temps réel ----
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    let unsubscribe = () => {};

    // Pull fusionné : les items locaux absents du remote sont conservés
    // (créés hors-ligne), sauf si un tombstone indique une suppression distante.
    const applyRemote = (collections, tombstones = new Map()) => {
      const merged = { ...stateRef.current };
      for (const table of SYNCED_COLLECTIONS) {
        const remoteItems = collections[table] || [];
        const localItems = stateRef.current[table] || [];
        const remoteMap = new Map(remoteItems.map((i) => [i.id, i]));
        const deletedIds = tombstones.get(table) || new Set();
        const localOnly = localItems.filter((i) => !remoteMap.has(i.id) && !deletedIds.has(i.id));
        merged[table] = [...remoteItems, ...localOnly];
      }
      syncedRef.current = collections;
      setState(merged);
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

    (async () => {
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
          syncedRef.current = initial;
        } else {
          applyRemote(collections, tombstones);
        }
        setSyncStatus('online');
        let timer = null;
        unsubscribe = subscribeToChanges(() => {
          // Ignorer l'écho de nos propres écritures, regrouper les rafales
          if (Date.now() - lastPushAt.current < 2500) return;
          clearTimeout(timer);
          timer = setTimeout(refreshFromRemote, 600);
        });
      } catch (e) {
        console.error('Supabase indisponible, mode local :', e.message);
        if (!cancelled) setSyncStatus('error');
      }
    })();

    return () => { cancelled = true; unsubscribe(); };
  }, []);

  // ---- Réplication des changements locaux ----
  // Push uniquement les collections modifiées ; les suppressions passent par tombstones.
  useEffect(() => {
    if (!isSupabaseConfigured || syncStatus !== 'online' || !syncedRef.current) return;
    const changed = {};
    const deletedByTable = {};
    for (const table of SYNCED_COLLECTIONS) {
      if (state[table] === syncedRef.current[table]) continue;
      changed[table] = state[table] || [];
      // Détection des suppressions locales
      const prevIds = new Set((syncedRef.current[table] || []).map((i) => i.id));
      const nextIds = new Set((state[table] || []).map((i) => i.id));
      const deleted = [...prevIds].filter((id) => !nextIds.has(id));
      if (deleted.length) deletedByTable[table] = deleted;
    }
    if (!Object.keys(changed).length) return;
    syncedRef.current = { ...syncedRef.current, ...changed };
    lastPushAt.current = Date.now();
    const doSync = async () => {
      try {
        await pushCollections(changed);
        for (const [table, ids] of Object.entries(deletedByTable)) {
          for (const id of ids) await pushTombstone(table, id);
        }
      } catch (e) {
        console.error('Réplication Supabase échouée :', e.message);
      }
    };
    doSync();
  }, [state, syncStatus]);

  return syncStatus;
}
