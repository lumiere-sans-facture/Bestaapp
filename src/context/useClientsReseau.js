import { useCallback, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { fetchClientsReseau, syncClientGoogleContact } from '../lib/remoteSync';

/**
 * Clients du RÉSEAU : les pistes saisies par les entreprises nées de nos codes
 * partenaires. Un partenaire qui s'inscrit par un lien d'affiliation ouvre sa
 * propre organisation ; ses clients restent chez lui, l'isolation est entière.
 * Cette lecture les rend visibles à la tête de réseau, en LECTURE SEULE.
 *
 * Ils ne rejoignent jamais l'état local : ils ne nous appartiennent pas, et
 * l'app doit rester entièrement utilisable sans backend. Ils vivent donc en
 * mémoire, le temps de la session.
 */
export function useClientsReseau() {
  const [clients, setClients] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(false);
  const pousses = useRef(new Set());

  const recharger = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setChargement(true);
    try {
      setClients(await fetchClientsReseau());
      setErreur(null);
    } catch (e) {
      setErreur(e.message || 'Clients du réseau indisponibles.');
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { recharger(); }, [recharger]);

  // Carnet Google. Ces clients n'ont pas d'état local où retenir leur
  // synchronisation ; la file serveur, elle, s'en souvient — un même numéro
  // déjà synchronisé revient sans rien recréer chez Google. Il suffit donc de
  // ne pas le redemander deux fois dans la même session, et d'envoyer un
  // contact à la fois pour ne pas saturer la file.
  useEffect(() => {
    if (!isSupabaseConfigured || !clients.length) return undefined;
    let actif = true;
    (async () => {
      for (const client of clients) {
        if (!actif) return;
        if (!client.telephone || pousses.current.has(client.lead_id)) continue;
        pousses.current.add(client.lead_id);
        try {
          await syncClientGoogleContact(
            { id: client.lead_id, name: client.nom, phone: client.telephone },
            client.partner_code,
          );
        } catch {
          // Envoi manqué : oublié, pour être retenté au prochain chargement.
          pousses.current.delete(client.lead_id);
        }
      }
    })();
    return () => { actif = false; };
  }, [clients]);

  return {
    clientsReseau: clients,
    clientsReseauEnCours: chargement,
    clientsReseauErreur: erreur,
    rechargerClientsReseau: recharger,
  };
}
