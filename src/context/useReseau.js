import { useCallback, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  fetchClientsReseau, fetchPartenairesReseau,
  syncClientGoogleContact, syncPartnerGoogleContact,
} from '../lib/remoteSync';

/**
 * Le RÉSEAU vu du gérant : les partenaires nés de nos codes d'affiliation, et
 * les clients qu'ils enregistrent. Chacun d'eux a ouvert sa PROPRE
 * organisation ; l'isolation les rendait invisibles ici, alors que ce sont
 * nos filleuls. Cette lecture les montre — en LECTURE SEULE, l'isolation
 * reste entière.
 *
 * Rien ne rejoint l'état local : ces données ne nous appartiennent pas, et
 * l'app doit rester utilisable sans backend. Elles vivent en mémoire, le
 * temps de la session.
 */
export function useReseau() {
  const [clients, setClients] = useState([]);
  const [partenaires, setPartenaires] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(false);
  const pousses = useRef(new Set());

  const recharger = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setChargement(true);
    try {
      const [lesClients, lesPartenaires] = await Promise.all([
        fetchClientsReseau(),
        fetchPartenairesReseau(),
      ]);
      setClients(lesClients);
      setPartenaires(lesPartenaires);
      setErreur(null);
    } catch (e) {
      setErreur(e.message || 'Réseau indisponible.');
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { recharger(); }, [recharger]);

  // Carnet Google. Ces contacts n'ont pas d'état local où retenir leur
  // synchronisation ; la file serveur, elle, s'en souvient — un numéro déjà
  // synchronisé revient sans rien recréer chez Google. Il suffit donc de ne
  // pas le redemander deux fois dans la même session, et d'envoyer un contact
  // à la fois pour ne pas saturer la file.
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    const envois = [
      ...partenaires.map((p) => ({
        cle: p.partner_id,
        telephone: p.telephone,
        envoyer: () => syncPartnerGoogleContact({
          id: p.partner_id, name: p.nom, code: p.code,
          phone: p.telephone, email: p.email || '',
        }),
      })),
      ...clients.map((c) => ({
        cle: c.lead_id,
        telephone: c.telephone,
        envoyer: () => syncClientGoogleContact(
          { id: c.lead_id, name: c.nom, phone: c.telephone }, c.partner_code,
        ),
      })),
    ];
    if (!envois.length) return undefined;
    let actif = true;
    (async () => {
      for (const envoi of envois) {
        if (!actif) return;
        if (!envoi.telephone || pousses.current.has(envoi.cle)) continue;
        pousses.current.add(envoi.cle);
        try {
          await envoi.envoyer();
        } catch {
          // Envoi manqué : oublié, pour être retenté au prochain chargement.
          pousses.current.delete(envoi.cle);
        }
      }
    })();
    return () => { actif = false; };
  }, [clients, partenaires]);

  return {
    clientsReseau: clients,
    partenairesReseau: partenaires,
    reseauEnCours: chargement,
    reseauErreur: erreur,
    rechargerReseau: recharger,
  };
}
