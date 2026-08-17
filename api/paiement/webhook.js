// POST /api/paiement/webhook — appelé par KkiaPay quand une transaction
// aboutit. Filet pour le cas où le navigateur se ferme avant d'avoir confirmé
// (réseau coupé, application quittée, téléphone éteint).
//
// SÉCURITÉ : le corps reçu n'est JAMAIS cru sur parole — n'importe qui peut
// appeler cette adresse. On n'en retient que l'identifiant de transaction,
// puis on demande son vrai statut à KkiaPay avec nos clés privée et secrète.
// Cette indépendance vaut mieux qu'une signature : même un appel forgé ne
// peut rien créditer si l'agrégateur ne confirme pas le paiement.
//
// LIMITE ASSUMÉE : le webhook seul ne sait pas TOUJOURS à quel compte
// rattacher le paiement. Quand la transaction porte une métadonnée `data`
// contenant l'identifiant du profil (posée par le widget), l'abonnement est
// crédité directement ; sinon la transaction est seulement consignée, et
// c'est le retour du navigateur — ou le gérant — qui la rattachera.
import { statutTransaction, clesCompletes } from '../_lib/kkiapay.js';
import {
  consignerTransaction, crediterAbonnement, marquerCommandePayee, montantCommande,
  profilParId, supabaseConfigure, modeSandbox,
} from '../_lib/encaissement.js';
import { transactionIdValide, verdictTransaction } from '../../src/utils/verificationPaiement.js';


/** Métadonnée posée par le widget : à qui, et pour quoi. */
const metaDeLaTransaction = (reponse) => {
  const brut = reponse?.data ?? reponse?.metadata ?? reponse?.custom_data;
  if (!brut) return {};
  const meta = typeof brut === 'string' ? safeJson(brut) : brut;
  return meta && typeof meta === 'object' ? meta : {};
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }
  if (!clesCompletes() || !supabaseConfigure()) {
    res.status(503).json({ error: 'Vérification serveur non configurée' });
    return;
  }

  const corps = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  const transactionId = String(corps.transactionId || corps.transaction_id || corps.id || '').trim();
  if (!transactionIdValide(transactionId)) {
    res.status(400).json({ error: 'Référence de transaction invalide' });
    return;
  }

  let reponse;
  try {
    reponse = await statutTransaction(transactionId, { sandbox: await modeSandbox() });
  } catch (e) {
    // 502 : KkiaPay réessaiera. Un 200 ferait passer l'incident pour traité.
    res.status(502).json({ error: 'Agrégateur injoignable', detail: e.message });
    return;
  }

  const verdict = verdictTransaction(reponse);
  if (!verdict.valide) {
    // Paiement non abouti : rien à créditer, mais l'appel est bien traité —
    // inutile que KkiaPay le rejoue indéfiniment.
    res.status(200).json({ traite: true, active: false, motif: verdict.motif });
    return;
  }

  const meta = metaDeLaTransaction(reponse);
  const profilId = meta.profilId || meta.userId;
  const profil = profilId ? await profilParId(String(profilId)) : null;

  try {
    if (!profil) {
      await consignerTransaction(transactionId, verdict.montant);
      res.status(200).json({ traite: true, active: false, motif: 'Compte non identifié — transaction consignée.' });
      return;
    }
    if (meta.type === 'commande' && meta.commandeId) {
      // Le montant attendu est relu en base, comme sur le chemin principal :
      // la métadonnée dit QUOI est payé, jamais COMBIEN.
      const r = await montantCommande(String(meta.commandeId), profil);
      if (r.erreur) {
        await consignerTransaction(transactionId, verdict.montant);
        res.status(200).json({ traite: true, active: false, motif: r.erreur });
        return;
      }
      if (verdict.montant < r.montant) {
        res.status(200).json({ traite: true, active: false, motif: 'Montant reçu inférieur au total de la commande.' });
        return;
      }
      const resultat = await marquerCommandePayee({
        profil, commandeId: String(meta.commandeId), transactionId,
        montant: verdict.montant, methode: 'kkiapay',
      });
      res.status(200).json({ traite: true, active: true, deja: !!resultat.deja });
      return;
    }
    const resultat = await crediterAbonnement({
      profil, transactionId, montant: verdict.montant, methode: 'kkiapay',
    });
    res.status(200).json({ traite: true, active: true, deja: !!resultat.deja });
  } catch (e) {
    res.status(500).json({ error: 'Enregistrement du paiement impossible', detail: e.message });
  }
}

function safeJson(txt) {
  try { return JSON.parse(txt); } catch { return {}; }
}
