// Lecture des erreurs de réplication — logique pure, sans réseau.

/**
 * Une écriture refusée par la sécurité au niveau ligne (RLS).
 *
 * Message PostgreSQL : « new row violates row-level security policy for
 * table "leads" ». Sur cette app il n'a qu'une cause : la ligne est estampillée
 * d'une organisation qui n'est plus celle du compte. La politique ne compare
 * QUE `org_id = auth_org_id()` — ni l'auteur, ni le partenaire, ni le rôle
 * n'entrent en jeu.
 */
export const estRefusRls = (message = '') =>
  /row-level security|row level security|violates row-level/i.test(String(message || ''));

/**
 * Message affiché quand le réalignement de l'organisation n'a rien changé :
 * l'estampille était déjà la bonne, la cause est ailleurs. Dire quoi faire
 * vaut mieux que répéter le message brut de PostgreSQL, que personne ne sait
 * interpréter.
 */
export const MESSAGE_REFUS_RLS =
  'Écriture refusée par la sécurité : votre session n’est plus rattachée à la '
  + 'même entreprise que votre compte. Déconnectez-vous puis reconnectez-vous — '
  + 'vos données en attente repartiront ensuite.';
