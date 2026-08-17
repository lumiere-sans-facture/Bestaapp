// Encaissement vérifié — CÔTÉ SERVEUR EXCLUSIVEMENT.
// Deux objets peuvent être payés : l'abonnement Devis Pro et une commande
// boutique. Les deux partagent le même verrou anti-rejeu ; seul ce qu'ils
// débloquent diffère.
// Utilise la clé service_role de Supabase, qui contourne la RLS : elle ne doit
// jamais quitter les variables d'environnement Vercel.
import { createClient } from '@supabase/supabase-js';
import { abonnementApresPaiement } from '../../src/utils/verificationPaiement.js';
import { SUBSCRIPTION_PRICE } from '../../src/utils/subscription.js';

const url = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRole = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anon = () => process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseConfigure = () => !!(url() && serviceRole());

/** Client administrateur : contourne la RLS, réservé à ce module. */
const admin = () => createClient(url(), serviceRole(), { auth: { persistSession: false } });

/**
 * Profil correspondant au jeton d'accès du navigateur.
 *
 * L'identité vient du JETON VÉRIFIÉ, jamais du corps de la requête : sinon
 * n'importe qui pourrait faire créditer l'abonnement d'un autre compte — ou
 * le sien avec la transaction d'un tiers.
 * @returns {Promise<{id: string, email: string, org_id: string}|null>}
 */
export async function profilDuJeton(token) {
  if (!token || !url() || !anon()) return null;
  const client = createClient(url(), anon(), { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  const email = data?.user?.email;
  if (error || !email) return null;
  const { data: profil } = await admin()
    .from('profiles').select('id, email, org_id').eq('email', email.toLowerCase()).single();
  return profil || null;
}

/**
 * Mode d'encaissement EFFECTIF, lu dans la configuration du gérant
 * (« Moyens de paiement »), pas dans une variable d'environnement.
 *
 * Sans cela, deux réglages indépendants devaient rester d'accord : le gérant
 * passe l'app en réel, la variable serveur reste en test, et la vérification
 * cherche la transaction dans le bac à sable où elle n'existe pas — paiement
 * réel refusé, sans explication compréhensible. Une seule source, donc.
 * Repli sur KKIAPAY_SANDBOX si rien n'est configuré.
 */
export async function modeSandbox() {
  if (!supabaseConfigure()) return process.env.KKIAPAY_SANDBOX !== 'false';
  try {
    const { data } = await admin().from('paiementConfigs').select('data');
    const actives = (data || []).map((r) => r.data).filter((c) => c?.actif && c?.provider === 'kkiapay');
    if (!actives.length) return process.env.KKIAPAY_SANDBOX !== 'false';
    // Plusieurs actives ne devrait pas arriver (l'app en désactive les autres) :
    // la plus récente tranche, comme côté navigateur.
    const retenue = actives.sort((a, b) => String(b.majLe || '').localeCompare(String(a.majLe || '')))[0];
    return retenue.mode !== 'live';
  } catch {
    // Table absente (paiements.sql pas encore exécuté) : repli prudent.
    return process.env.KKIAPAY_SANDBOX !== 'false';
  }
}

/** Profil par son identifiant — pour le webhook, qui n'a pas de jeton. */
export async function profilParId(id) {
  if (!id || !supabaseConfigure()) return null;
  const { data } = await admin()
    .from('profiles').select('id, email, org_id').eq('id', String(id)).maybeSingle();
  return data || null;
}

/**
 * Transaction payée mais non rattachable à un compte : consignée pour que le
 * gérant la retrouve. Sans cette trace, un paiement réel dont le navigateur
 * n'est jamais revenu disparaîtrait sans laisser de trace côté BestaSolar.
 */
export async function consignerTransaction(transactionId, montant) {
  const { error } = await admin().from('paiements_verifies').insert({
    transaction_id: transactionId, org_id: null, user_id: null, montant, credite: false,
  });
  // Déjà consignée (23505) : rien à faire, l'appel est idempotent.
  if (error && error.code !== '23505') throw new Error(error.message);
}

/**
 * Réserve la transaction. Retourne false si elle a DÉJÀ été encaissée.
 *
 * C'est le verrou anti-rejeu : sans lui, renvoyer dix fois le même
 * identifiant de transaction validé offrirait dix mois d'abonnement.
 * L'unicité est garantie par la clé primaire de la table, pas par une
 * lecture préalable — deux requêtes simultanées ne peuvent pas passer.
 */
async function reserverTransaction(transactionId, profil, montant) {
  const db = admin();
  const proprietaire = { org_id: profil.org_id || null, user_id: profil.id, credite: true };
  const { error } = await db.from('paiements_verifies')
    .insert({ transaction_id: transactionId, montant, ...proprietaire });
  if (!error) return true;
  // 23505 = violation d'unicité. Deux cas très différents : soit la
  // transaction a déjà crédité un abonnement (rejeu, à refuser), soit le
  // webhook l'a seulement CONSIGNÉE faute de savoir à qui l'attribuer — et
  // il faut alors pouvoir la réclamer, sinon un paiement réel resterait
  // bloqué par son propre filet de sécurité.
  if (error.code !== '23505') throw new Error(`Enregistrement du paiement impossible : ${error.message}`);
  // Mise à jour conditionnelle : atomique, deux requêtes simultanées ne
  // peuvent pas réclamer la même ligne.
  const { data } = await db.from('paiements_verifies')
    .update(proprietaire)
    .eq('transaction_id', transactionId).eq('credite', false)
    .select('transaction_id');
  return !!(data && data.length);
}

// Le crédit a échoué : la ligne reste (trace du paiement reçu) mais redevient
// réclamable — un incident réseau ne doit pas faire perdre un paiement réel.
const libererTransaction = (transactionId) =>
  admin().from('paiements_verifies').update({ credite: false }).eq('transaction_id', transactionId);

/**
 * Commande boutique correspondant à cet identifiant, dans l'organisation du
 * payeur. La réplication est asynchrone : une commande créée à l'instant peut
 * ne pas être encore arrivée. On patiente brièvement plutôt que de refuser un
 * paiement réel pour une seconde d'écart.
 */
async function lireCommande(commandeId, org, essais = 3) {
  const db = admin();
  for (let i = 0; i < essais; i += 1) {
    const { data } = await db.from('orders')
      .select('data').eq('id', commandeId).eq('org_id', org).maybeSingle();
    if (data?.data) return data.data;
    if (i < essais - 1) await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

/**
 * Montant ATTENDU pour une commande — le serveur ne croit jamais celui que le
 * navigateur annonce.
 * @returns {Promise<{montant: number}|{erreur: string}>}
 */
export async function montantCommande(commandeId, profil) {
  const commande = await lireCommande(commandeId, profil.org_id);
  if (!commande) return { erreur: 'Commande introuvable — attendez la synchronisation puis réessayez.' };
  const total = Number(commande.total) || 0;
  if (total <= 0) return { erreur: 'Commande sans montant.' };
  if (commande.paiement?.statut === 'verifie') return { erreur: 'Commande déjà réglée.' };
  return { montant: total };
}

/**
 * Marque une commande réglée. Le statut de la commande n'est PAS avancé à
 * « confirmé » : la confirmation décrémente le stock, c'est une décision du
 * gérant qui doit avoir la marchandise. Le paiement, lui, est un fait.
 */
export async function marquerCommandePayee({ profil, commandeId, transactionId, montant, methode = 'kkiapay' }) {
  if (!(await reserverTransaction(transactionId, profil, montant))) {
    return { active: false, deja: true };
  }
  try {
    const db = admin();
    const commande = await lireCommande(commandeId, profil.org_id, 1);
    if (!commande) throw new Error('Commande introuvable');
    const maintenant = new Date().toISOString();
    const { error } = await db.from('orders').upsert({
      id: commandeId,
      org_id: profil.org_id,
      updated_at: maintenant,
      data: {
        ...commande,
        paiement: { statut: 'verifie', reference: transactionId, montant, methode, date: maintenant },
      },
    });
    if (error) throw new Error(error.message);
    return { active: true, montant };
  } catch (e) {
    await libererTransaction(transactionId).catch(() => {});
    throw e;
  }
}

/**
 * Crédite 30 jours d'abonnement au profil, et consigne le paiement.
 * @returns {Promise<{active: boolean, deja?: boolean, dateFin?: string}>}
 */
export async function crediterAbonnement({ profil, transactionId, montant, methode = 'kkiapay' }) {
  if (!(await reserverTransaction(transactionId, profil, montant))) {
    return { active: false, deja: true };
  }
  try {
    const db = admin();
    const subId = `sub-${profil.id}`;
    const org = profil.org_id;

    const { data: ligne } = await db.from('subscriptions')
      .select('data').eq('id', subId).eq('org_id', org).maybeSingle();
    const actuel = ligne?.data || {
      id: subId, userId: profil.id, type: 'devis_pro', status: 'en_attente_paiement',
      dateDebut: null, dateFin: null, montant: SUBSCRIPTION_PRICE, recurrence: 'mensuel',
      lastPaymentAt: null,
    };
    // Même règle que la validation manuelle du gérant : les jours déjà payés
    // ne sont jamais perdus (utils/verificationPaiement.js).
    const sub = abonnementApresPaiement(actuel);

    const maintenant = new Date().toISOString();
    const { error: e1 } = await db.from('subscriptions')
      .upsert({ id: subId, org_id: org, data: sub, updated_at: maintenant });
    if (e1) throw new Error(e1.message);

    // Trace visible par le gérant dans « Abonnements Devis Pro ».
    const { error: e2 } = await db.from('subscriptionPayments').upsert({
      id: `pay-${transactionId}`,
      org_id: org,
      updated_at: maintenant,
      data: {
        id: `pay-${transactionId}`, subscriptionId: subId, userId: profil.id,
        montant, methode, phone: '', referenceTransaction: transactionId,
        statut: 'confirme', verifieServeur: true, date: maintenant,
      },
    });
    if (e2) throw new Error(e2.message);

    return { active: true, dateFin: sub.dateFin };
  } catch (e) {
    // Le crédit a échoué : la réservation ne doit pas condamner la
    // transaction, sinon un incident réseau ferait perdre un paiement réel.
    await libererTransaction(transactionId).catch(() => {});
    throw e;
  }
}
