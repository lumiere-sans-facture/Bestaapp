// Lecture du diagnostic de réplication — logique pure, sans réseau.
//
// Une écriture refusée par la RLS se ramène toujours à la même comparaison :
// `org_id = auth_org_id()`. Quatre valeurs suffisent à savoir laquelle des
// deux est fautive, et il n'y a pas d'autre cas.

export const VERDICTS = {
  local: {
    titre: 'Mode local',
    detail: 'Aucun serveur configuré : rien n’est répliqué, et rien ne peut être refusé.',
  },
  'sans-session': {
    titre: 'Session absente',
    detail: 'Aucun compte connecté côté serveur. Reconnectez-vous.',
  },
  'profil-absent': {
    titre: 'Aucun profil pour cette adresse',
    detail: 'La base ne connaît aucun profil portant l’e-mail de votre session. '
      + 'Toute écriture est refusée, et le rester tant que le profil n’existe pas. '
      + 'Cause la plus fréquente : une connexion avec une AUTRE adresse Google que '
      + 'celle du compte, ou un profil supprimé lors d’une réorganisation.',
  },
  'org-introuvable': {
    titre: 'Profil sans entreprise lisible',
    detail: 'Le profil existe mais la base ne rend aucune entreprise pour lui : '
      + '`auth_org_id()` répond vide, donc la comparaison de sécurité échoue toujours.',
  },
  'estampille-vide': {
    titre: 'Écritures non estampillées',
    detail: 'L’application n’attache aucune entreprise aux lignes envoyées. '
      + 'Déconnectez-vous puis reconnectez-vous pour la relire.',
  },
  'org-differente': {
    titre: 'Deux entreprises différentes',
    detail: 'L’application écrit sous une entreprise, la base en attend une autre. '
      + 'Déconnectez-vous puis reconnectez-vous.',
  },
  'refus-constates': {
    titre: 'Le serveur a refusé des clients',
    detail: 'Ce n’est pas une déduction : pendant cette session, la base a REFUSÉ '
      + 'd’enregistrer des clients de ce compte. Peu importe ce que dit le drapeau '
      + 'gérant plateforme — la règle posée sur la table des clients ne les laisse '
      + 'pas passer. Le script ci-dessous la corrige.',
  },
  'clients-non-detenus': {
    titre: 'Clients d’un autre membre, illisibles par ce compte',
    detail: 'Le serveur réserve chaque client à celui qui l’a enregistré : ceux de '
      + 'vos partenaires ne sont donc ni lisibles ni renvoyables depuis ce compte. '
      + 'Rien ne se débloquera de soi-même — c’est une règle de la base, à changer '
      + 'une fois, avec le script ci-dessous.',
  },
  coherent: {
    titre: 'Identité cohérente',
    detail: 'L’entreprise utilisée pour écrire est bien celle que la base attribue '
      + 'à votre compte, et tous les clients en attente vous appartiennent. Un refus '
      + 'de sécurité ne peut plus venir de là.',
  },
};

/**
 * Clients de la file que la base refusera : depuis la fusion, un client
 * n'est écrivable que par son auteur. Le calcul est LOCAL — inutile
 * d'interroger le serveur pour savoir ce qu'il va refuser.
 *
 * @param {Array<object>} leads
 * @param {string|null} profilId identifiant du profil connecté (profiles.id)
 */
export const clientsNonDetenus = (leads = [], profilId = null) => {
  if (!profilId) return [];
  return (leads || []).filter((lead) => {
    const auteur = lead?.registeredByUserId || lead?.assignedTo || lead?.userId || null;
    return auteur && auteur !== profilId;
  });
};

/**
 * Faut-il proposer la réparation ? Dès qu'un client n'est pas à ce compte —
 * refusé pour de bon, ou seulement en attente de l'être. Le drapeau « gérant
 * plateforme » n'entre pas dans ce calcul : il a déjà fait croire une fois que
 * tout allait bien, et masqué le bouton à celui qui en avait besoin.
 */
export const reparationUtile = (etat = {}) =>
  (etat.refusConstates || 0) > 0 || (etat.clientsNonDetenus || 0) > 0;

/**
 * @param {{email?: string|null, profilTrouve?: boolean, orgBase?: string|null,
 *          orgEcriture?: string|null, refusConstates?: number, local?: boolean}} etat
 * @returns {{code: keyof VERDICTS, ok: boolean, titre: string, detail: string}}
 */
export const verdictReplication = (etat = {}) => {
  const code = (() => {
    if (etat.local) return 'local';
    if (!etat.email) return 'sans-session';
    if (!etat.profilTrouve) return 'profil-absent';
    if (!etat.orgBase) return 'org-introuvable';
    if (!etat.orgEcriture) return 'estampille-vide';
    if (etat.orgBase !== etat.orgEcriture) return 'org-differente';
    // CE QUI S'EST RÉELLEMENT PASSÉ passe avant ce qu'on déduit. Le drapeau
    // « gérant plateforme » laissait conclure que ce compte écrit partout, donc
    // que tout allait bien — verdict vert, réparation masquée — alors que le
    // serveur refusait des clients pour de bon. Un refus constaté ne se discute
    // pas : c'est la politique en place qui tranche, pas le drapeau.
    if (etat.refusConstates > 0) return 'refus-constates';
    // Le gérant plateforme écrit partout : pour lui, l'appartenance ne joue pas.
    if (!etat.adminPlateforme && etat.clientsNonDetenus > 0) return 'clients-non-detenus';
    return 'coherent';
  })();
  return { code, ok: code === 'coherent' || code === 'local', ...VERDICTS[code] };
};
