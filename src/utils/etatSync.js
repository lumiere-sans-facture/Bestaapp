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

/**
 * La relecture du serveur qui vient d'arriver est-elle PÉRIMÉE ?
 *
 * Une relecture prend du temps (une vingtaine de tables, sur un réseau
 * mobile : plusieurs secondes). Si un envoi d'ici a eu lieu pendant ce temps
 * — ou était déjà en cours quand elle est partie —, la photo qu'elle rapporte
 * peut être ANTÉRIEURE à ce qu'on vient d'écrire. L'appliquer ramenait
 * l'ancienne version par-dessus la nouvelle : l'envoi étant confirmé, la
 * fiche n'était plus « en attente » et rien ne la protégeait. Une modification
 * de devis « sautait » ainsi quelques secondes après l'enregistrement.
 * Une relecture périmée est jetée, et une autre repart un peu plus tard.
 *
 * @param {object} o
 * @param {number} o.generationAvant  compteur d'envois au départ de la relecture
 * @param {number} o.generationApres  compteur d'envois à son arrivée
 * @param {boolean} o.envoiAuDepart   un envoi était en cours au départ
 * @param {boolean} o.envoiALArrivee  un envoi est en cours à l'arrivée
 */
export const relecturePerimee = ({ generationAvant, generationApres, envoiAuDepart, envoiALArrivee }) =>
  envoiAuDepart || envoiALArrivee || generationAvant !== generationApres;
