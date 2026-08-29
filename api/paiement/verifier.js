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
import {
  crediterAbonnement, marquerCommandePayee, montantCommande,
  profilDuJeton, supabaseConfigure, modeSandbox,
} from '../_lib/encaissement.js';
import { transactionIdValide, verdictTransaction } from '../../src/utils/verificationPaiement.js';
import { formule, formuleValide, FORMULE_DEFAUT } from '../../src/utils/subscription.js';
import { limiter, erreurServeur, refusAuth, journaliser, PLAFONDS } from '../_lib/garde.js';


export default async function handler(req, res) {
  // C'est ici que s'active un abonnement : le point le plus sensible de l'API.
  if (limiter(req, res, PLAFONDS.paiementVerifier, 'paiement-verifier')) return;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }
  // Configuration incomplète : le dire franchement plutôt que de laisser
  // croire à un refus de paiement.
  if (!clesCompletes() || !supabaseConfigure()) {
    // Les NOMS des variables manquantes n'ont rien à faire dans une réponse
    // publique : ils décrivent la pile technique. Au journal, pour l'exploitant.
    journaliser('config-incomplete', req, {
      cles_kkiapay: clesCompletes(), supabase: supabaseConfigure(),
    });
    res.status(503).json({ error: 'Vérification serveur non configurée' });
    return;
  }

  const corps = typeof req.body === 'string' ? safeJson(req.body) : (req.body || {});
  const transactionId = String(corps.transactionId || '').trim();
  const objet = corps.objet && typeof corps.objet === 'object' ? corps.objet : { type: 'abonnement' };
  if (objet.type !== 'abonnement' && objet.type !== 'commande') {
    res.status(400).json({ error: 'Objet du paiement inconnu' });
    return;
  }
  if (!transactionIdValide(transactionId)) {
    res.status(400).json({ error: 'Référence de transaction invalide' });
    return;
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const profil = await profilDuJeton(token);
  if (!profil) {
    // Tentative d'activation sans session valide : à tracer, c'est le signal
    // d'un appel forgé bien plus que d'un utilisateur distrait.
    refusAuth(req, res, token ? 'jeton refuse' : 'jeton absent');
    return;
  }

  // Montant ATTENDU : lu côté serveur (tarif de la formule au catalogue, ou
  // total de la commande en base). Jamais celui annoncé par le navigateur —
  // sinon il suffirait de déclarer 100 F pour une commande de 500 000.
  //
  // Le navigateur choisit sa FORMULE, pas son prix : l'identifiant reçu est
  // confronté au catalogue, et c'est le catalogue qui dit combien exiger et
  // combien de jours créditer. Déclarer « annuel » en payant 5 000 F fait
  // échouer la vérification ; payer 45 000 en déclarant « mensuel » ne
  // crédite que trente jours — dans les deux sens, jamais plus que payé.
  let montantAttendu;
  let formuleId = FORMULE_DEFAUT;
  if (objet.type === 'commande') {
    const r = await montantCommande(String(objet.commandeId || ''), profil);
    if (r.erreur) {
      res.status(409).json({ error: r.erreur });
      return;
    }
    montantAttendu = r.montant;
  } else {
    if (objet.formule && !formuleValide(objet.formule)) {
      journaliser('formule-inconnue', req, { recue: String(objet.formule).slice(0, 40) });
      res.status(400).json({ error: 'Formule d’abonnement inconnue' });
      return;
    }
    formuleId = objet.formule || FORMULE_DEFAUT;
    montantAttendu = formule(formuleId).prix;
  }

  let reponse;
  try {
    reponse = await statutTransaction(transactionId, { sandbox: await modeSandbox() });
  } catch (e) {
    // L'agrégateur n'a pas répondu : ce n'est PAS un refus. Le paiement peut
    // très bien avoir eu lieu ; la validation manuelle du gérant reste la
    // porte de sortie.
    // `e.message` recopie la réponse brute de l'agrégateur : au journal.
    erreurServeur(req, res, 502, 'Agrégateur injoignable', e, { transactionId });
    return;
  }

  const verdict = verdictTransaction(reponse, montantAttendu ? { montantAttendu } : undefined);
  if (!verdict.valide) {
    res.status(402).json({ error: verdict.motif, statut: verdict.statut });
    return;
  }

  try {
    const resultat = objet.type === 'commande'
      ? await marquerCommandePayee({
          profil, commandeId: String(objet.commandeId), transactionId,
          montant: verdict.montant, methode: 'kkiapay',
        })
      : await crediterAbonnement({
          profil, transactionId, montant: verdict.montant, methode: 'kkiapay',
          formule: formuleId,
        });
    if (resultat.deja) {
      res.status(200).json({ active: true, deja: true, message: 'Ce paiement a déjà été pris en compte.' });
      return;
    }
    res.status(200).json({ active: true, dateFin: resultat.dateFin, montant: verdict.montant });
  } catch (e) {
    erreurServeur(req, res, 500, 'Enregistrement du paiement impossible', e, {
      profil: profil.id, transactionId,
    });
  }
}

function safeJson(txt) {
  try { return JSON.parse(txt); } catch { return {}; }
}
