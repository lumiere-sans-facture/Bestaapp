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
export const estRefusRls = (erreur = '') => {
  // Le code SQLSTATE fait foi quand il est là : il ne dépend ni de la langue
  // du serveur ni de la formulation, que PostgREST peut changer d'une version
  // à l'autre. Le message reste le filet — la file d'attente ne conserve que
  // du texte.
  if (erreur && typeof erreur === 'object' && erreur.code === '42501') return true;
  const message = typeof erreur === 'string' ? erreur : String(erreur?.message || '');
  return /row-level security|row level security|violates row-level/i.test(message);
};

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

// Nom métier des collections, pour parler de « clients » plutôt que de
// « leads » — le message est lu par le gérant, pas par un développeur.
const NOMS = {
  leads: ['client', 'clients'],
  partners: ['partenaire', 'partenaires'],
  devis: ['devis', 'devis'],
  proClients: ['client Pro', 'clients Pro'],
  commissions: ['commission', 'commissions'],
  orders: ['commande', 'commandes'],
  factures: ['facture', 'factures'],
};
const nommer = (table, n) => {
  const [un, plusieurs] = NOMS[table] || [table, table];
  return `${n} ${n > 1 ? plusieurs : un}`;
};

/**
 * Ce que le serveur refuse d'enregistrer, dit en clair.
 *
 * Une précision qui décide de la formulation : ces lignes sont exactement
 * celles que le compte ne peut pas LIRE sur le serveur — la politique réserve
 * chaque client à son auteur, en lecture comme en écriture. L'app ne peut donc
 * pas savoir si elles y sont déjà (posées par leur auteur depuis son appareil)
 * ou nulle part. Le message ne l'affirme ni dans un sens ni dans l'autre : il
 * dit ce qui est vérifié — elles ne partent pas d'ici, elles restent lisibles
 * ici — et où aller pour trancher.
 *
 * Il ne cite AUCUN chemin de fichier : il est lu sur un téléphone, par le
 * gérant, qui n'a pas le dépôt sous la main. La marche à suivre vit dans
 * Plus › Diagnostic, avec le bouton qui met le script dans le presse-papiers.
 *
 * @param {Record<string, number>} parTable ex. { leads: 32 }
 */
export const messageLignesRefusees = (parTable = {}) => {
  const parts = Object.entries(parTable)
    .filter(([, n]) => n > 0)
    .map(([table, n]) => nommer(table, n));
  if (!parts.length) return null;
  return `${parts.join(', ')} appartiennent à d’autres membres : le serveur `
    + 'réserve chaque client à celui qui l’a enregistré, et ne les accepte donc '
    + 'pas depuis ce compte. Ils restent consultables ici, et le reste est bien '
    + 'synchronisé. Pour les rattacher à votre compte : Plus › Diagnostic.';
};
