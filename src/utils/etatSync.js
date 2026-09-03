// États du moteur de réplication — logique pure, sans React.

/**
 * Les seuls états depuis lesquels un envoi peut PARTIR.
 *
 * `connecting` n'en fait pas partie : c'est l'état de la connexion initiale,
 * pendant laquelle l'état local n'est pas encore comparable à celui du
 * serveur. Conséquence à ne jamais oublier : passer le statut à `connecting`
 * depuis la boucle d'envoi la fige pour de bon — plus aucune tentative ne
 * repart, et le voyant reste orange jusqu'au rechargement de la page. C'est
 * arrivé ; d'où cette constante et son nom.
 */
export const STATUTS_QUI_ENVOIENT = ['online', 'error'];

/** Un envoi peut-il partir depuis cet état ? */
export const peutEnvoyer = (statut) => STATUTS_QUI_ENVOIENT.includes(statut);
