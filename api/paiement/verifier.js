// POST /api/paiement/verifier   { transactionId }
// En-tête : Authorization: Bearer <jeton Supabase de l'utilisateur>
//
// C'EST ICI QUE S'ACTIVE UN ABONNEMENT. Avant cette fonction, l'app croyait
// le navigateur sur parole : le widget annonçait « payé », l'abonnement
// partait. Il suffisait d'appeler la même fonction depuis la console pour
// s'offrir l'espace Pro gratuitement.
//
// Désormais, trois vérifications que le navigateur ne peut pas contourner :
//   1. QUI  — l'identité vient du jeton vérifié, pas du corps de la requête ;
//   2. QUOI — le statut et le montant sont demandés à KkiaPay avec les clés
//             privée et secrète, que le navigateur n'a pas ;
//   3. UNE FOIS — la transaction est verrouillée en base, un rejeu ne crédite
//             rien de plus.
import { statutTransaction, clesCompletes } from '../_lib/kkiapay.js';
import { crediterAbonnement, profilDuJeton, supabaseConfigure, modeSandbox } from '../_lib/abonnement.js';
import { transactionIdValide, verdictTransaction } from '../../src/utils/verificationPaiement.js';


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }
  // Configuration incomplète : le dire franchement plutôt que de laisser
  // croire à un refus de paiement.
  if (!clesCompletes() || !supabaseConfigure()) {
    res.status(503).json({
      error: 'Vérification serveur non configurée',
      detail: 'Déclarez KKIAPAY_PRIVATE_KEY, KKIAPAY_SECRET et SUPABASE_SERVICE_ROLE_KEY dans Vercel.',
    });
    return;
  }

  const corps = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  const transactionId = String(corps.transactionId || '').trim();
  if (!transactionIdValide(transactionId)) {
    res.status(400).json({ error: 'Référence de transaction invalide' });
    return;
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const profil = await profilDuJeton(token);
  if (!profil) {
    res.status(401).json({ error: 'Session non reconnue — reconnectez-vous.' });
    return;
  }

  let reponse;
  try {
    reponse = await statutTransaction(transactionId, { sandbox: await modeSandbox() });
  } catch (e) {
    // L'agrégateur n'a pas répondu : ce n'est PAS un refus. Le paiement peut
    // très bien avoir eu lieu ; la validation manuelle du gérant reste la
    // porte de sortie.
    res.status(502).json({ error: 'Agrégateur injoignable', detail: e.message });
    return;
  }

  const verdict = verdictTransaction(reponse);
  if (!verdict.valide) {
    res.status(402).json({ error: verdict.motif, statut: verdict.statut });
    return;
  }

  try {
    const resultat = await crediterAbonnement({
      profil, transactionId, montant: verdict.montant, methode: 'kkiapay',
    });
    if (resultat.deja) {
      res.status(200).json({ active: true, deja: true, message: 'Ce paiement a déjà été pris en compte.' });
      return;
    }
    res.status(200).json({ active: true, dateFin: resultat.dateFin });
  } catch (e) {
    res.status(500).json({ error: 'Activation impossible', detail: e.message });
  }
}

function safeJson(txt) {
  try { return JSON.parse(txt); } catch { return {}; }
}
