// Codes d'essai Devis Pro : un code donne accès à l'espace Pro pendant une
// durée fixée (30 jours par défaut), sans paiement. C'est la porte d'entrée
// en attendant l'encaissement en ligne.
//
// Logique PURE, partagée par le mode local (le gérant crée et valide sur son
// appareil) et reproduite à l'identique dans supabase/codes-promo.sql, seul
// juge dès que le backend est configuré : un code vérifié par le navigateur
// ne prouverait rien, n'importe qui pourrait s'activer le Pro depuis la
// console.
import { DAY_MS } from './date.js';

/** Durée d'un essai quand le code n'en précise pas. */
export const JOURS_ESSAI = 30;

/** Bornes d'une durée saisie : un jour au moins, un an au plus. */
export const JOURS_ESSAI_MAX = 366;

/** Identifiant de « formule » d'un abonnement ouvert par un code — distinct
 *  des formules PAYANTES (utils/subscription.js), qui fixent un montant. */
export const FORMULE_ESSAI = 'essai';

/**
 * Forme canonique d'un code : majuscules, sans espaces. Le client recopie un
 * code lu sur une affiche ou dicté au téléphone — « besta 30 » et « BESTA30 »
 * doivent désigner le même.
 */
export const normaliserCode = (code) => String(code ?? '').replace(/\s+/g, '').toUpperCase();

/** Lettres, chiffres et tirets, de 4 à 32 caractères. */
export const formatCodeValide = (code) => /^[A-Z0-9-]{4,32}$/.test(normaliserCode(code));

// Sans 0/O ni 1/I : un code dicté ou recopié ne doit pas prêter à confusion.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Code aléatoire prêt à distribuer, ex. « ESSAI-7KQ4PM ». */
export const genererCode = (prefixe = 'ESSAI', longueur = 6) => {
  const octets = new Uint8Array(longueur);
  crypto.getRandomValues(octets);
  const suffixe = [...octets].map((o) => ALPHABET[o % ALPHABET.length]).join('');
  return `${normaliserCode(prefixe)}-${suffixe}`;
};

/** Durée d'un code, ramenée dans ses bornes. */
export const joursDuCode = (code) => {
  const j = Math.round(Number(code?.jours));
  if (!Number.isFinite(j) || j < 1) return JOURS_ESSAI;
  return Math.min(j, JOURS_ESSAI_MAX);
};

/**
 * Le code peut-il être utilisé par ce compte, maintenant ?
 * @param {object|null} code  { code, jours, actif, maxUtilisations, expireLe, utilisations: [{ userId }] }
 * @returns {{ ok: true } | { ok: false, raison: 'format'|'inconnu'|'desactive'|'expire'|'epuise'|'deja' }}
 */
export const verifierCode = (saisie, code, userId, maintenant = Date.now()) => {
  if (!formatCodeValide(saisie)) return { ok: false, raison: 'format' };
  if (!code) return { ok: false, raison: 'inconnu' };
  if (code.actif === false) return { ok: false, raison: 'desactive' };
  if (code.expireLe && new Date(code.expireLe).getTime() < maintenant) return { ok: false, raison: 'expire' };
  const utilisations = code.utilisations || [];
  if (utilisations.some((u) => u.userId === userId)) return { ok: false, raison: 'deja' };
  const max = Number(code.maxUtilisations) || 0;
  if (max > 0 && utilisations.length >= max) return { ok: false, raison: 'epuise' };
  return { ok: true };
};

/** Message affiché au client pour chaque refus — jamais le code lui-même
 *  ni une donnée du compte (voir CLAUDE.md, messages d'erreur). */
export const MESSAGES_CODE = {
  format: 'Ce code n’a pas le bon format : 4 à 32 caractères, lettres, chiffres et tirets.',
  inconnu: 'Code inconnu. Vérifiez l’orthographe, sans confondre O et 0.',
  desactive: 'Ce code n’est plus valable.',
  expire: 'Ce code a expiré.',
  epuise: 'Ce code a déjà été utilisé le nombre de fois prévu.',
  deja: 'Vous avez déjà utilisé ce code sur ce compte.',
  trop: 'Trop d’essais infructueux. Réessayez dans une heure.',
  reseau: 'Vérification impossible : connexion au serveur indisponible. Réessayez.',
  profil: 'Compte introuvable sur le serveur. Déconnectez-vous puis reconnectez-vous.',
  indisponible: 'L’essai par code n’est pas encore ouvert sur ce serveur. Contactez BestaSolar.',
};

export const messageCode = (raison) => MESSAGES_CODE[raison] || MESSAGES_CODE.inconnu;

/**
 * Abonnement après utilisation d'un code : actif, prolongé de la durée du
 * code à partir d'aujourd'hui — ou de la fin actuelle si une période court
 * encore (un abonné ne perd jamais les jours déjà acquis).
 *
 * Un abonné PAYANT garde sa formule : le code prolonge, il ne le fait pas
 * passer pour un essai (il sortirait du revenu mensuel du tableau de bord).
 */
export const abonnementApresCode = (sub, { userId, code, jours }, maintenant = Date.now()) => {
  const finActuelle = sub?.dateFin ? new Date(sub.dateFin).getTime() : 0;
  const enCours = sub?.status === 'actif' && finActuelle > maintenant;
  const base = finActuelle > maintenant ? finActuelle : maintenant;
  const payant = enCours && sub?.formule && sub.formule !== FORMULE_ESSAI;
  const iso = new Date(maintenant).toISOString();
  return {
    type: 'devis_pro',
    lastPaymentAt: null,
    ...sub,
    id: sub?.id || `sub-${userId}`,
    userId,
    status: 'actif',
    dateDebut: sub?.dateDebut || iso,
    dateFin: new Date(base + jours * DAY_MS).toISOString(),
    ...(payant ? {} : { formule: FORMULE_ESSAI, recurrence: FORMULE_ESSAI, montant: 0 }),
    codePromo: normaliserCode(code),
  };
};

/** L'abonnement est-il un essai gratuit (ouvert par un code) ? */
export const estEssai = (sub) => sub?.formule === FORMULE_ESSAI;
