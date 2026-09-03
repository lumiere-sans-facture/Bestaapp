// Lecture des erreurs de réplication — logique pure, sans réseau.

/**
 * Une écriture refusée par la sécurité au niveau ligne (RLS).
 *
 * Message PostgreSQL : « new row violates row-level security policy for
 * table "leads" ». Deux causes possibles, dans cet ordre :
 *
 *   1. la ligne est estampillée d'une organisation qui n'est plus celle du
 *      compte — `resynchroniserOrg()` la relit et l'envoi repart seul ;
 *   2. la ligne appartient à un AUTRE membre. Depuis la fusion des
 *      organisations, la politique des clients compare aussi l'auteur
 *      (`auth_owns_client`) : le gérant ne peut réécrire les clients de ses
 *      partenaires que si la règle « manager client access » est posée sur
 *      `leads`. C'est le cas traité par le message ci-dessous.
 */
export const estRefusRls = (message = '') =>
  /row-level security|row level security|violates row-level/i.test(String(message || ''));

/**
 * Message affiché quand le réalignement de l'organisation n'a rien changé :
 * l'estampille était DÉJÀ la bonne. Se reconnecter ne sert donc à rien — la
 * cause est côté base. Dire quoi faire vaut mieux que répéter le message brut
 * de PostgreSQL, que personne ne sait interpréter.
 */
export const MESSAGE_REFUS_RLS =
  'Le serveur refuse d’enregistrer certains clients : ils ont été saisis par un '
  + 'autre membre, et ce compte n’a pas encore le droit de les réécrire. Rien '
  + 'n’est perdu, tout reste sur cet appareil. Prévenez le gérant : la règle de '
  + 'sécurité de la base doit être mise à jour.';
