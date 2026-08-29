// File d'attente de synchronisation : quels éléments ont été modifiés ici et
// ne sont pas encore confirmés par le serveur, et comment fusionner une
// réception sans les écraser.
//
// Pourquoi ce module existe : le moteur de réplication savait déjà, EN
// MÉMOIRE, ce qui restait à envoyer (comparaison avec le dernier état
// répliqué). Ce savoir mourait à la fermeture de l'app. Au lancement suivant,
// la lecture du serveur remplaçait chaque élément de même identifiant par la
// version distante — une modification faite hors-ligne (étape d'un client,
// prix d'un kit, statut d'un devis) était donc silencieusement effacée par
// une copie serveur plus ancienne. Les créations, elles, survivaient : le
// serveur ne les portait pas. D'où une perte invisible et sélective.
//
// Logique pure, sans React ni localStorage : la persistance est faite par
// l'appelant (context/useRemoteSync.js).

/**
 * Identifiants dont l'objet a changé entre deux versions d'une collection.
 *
 * La comparaison porte sur la RÉFÉRENCE de l'objet, pas sur son contenu : les
 * actions de `context/actions/` reconstruisent uniquement l'élément touché
 * (`map(l => l.id === id ? { ...l, ...patch } : l)`), les autres gardent leur
 * référence. Un élément absent d'`avant` compte comme modifié — c'est une
 * création locale, elle aussi en attente d'envoi.
 */
export const idsModifies = (avant = [], apres = []) => {
  // Même tableau : rien n'a bougé. Raccourci volontaire — sans lui, la file
  // se recalcule sur l'intégralité des collections à chaque frappe au clavier.
  if (avant === apres) return [];
  const parId = new Map(avant.map((i) => [i.id, i]));
  const ids = [];
  for (const item of apres) if (parId.get(item.id) !== item) ids.push(item.id);
  return ids;
};

/** File d'attente complète : { table: [ids] }, tables vides omises. */
export const fileEnAttente = (tables, repliques, courant) => {
  const file = {};
  for (const table of tables) {
    const ids = idsModifies(repliques?.[table], courant?.[table]);
    if (ids.length) file[table] = ids;
  }
  return file;
};

/**
 * Réunion de deux files. Sert au lancement : la file de la session précédente
 * (relue du stockage) n'est pas envoyée pour autant, elle s'ajoute à ce qui a
 * été modifié depuis l'ouverture, tant que rien n'a encore été répliqué.
 */
export const unionFiles = (a = {}, b = {}) => {
  const file = {};
  for (const table of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    const ids = [...new Set([...(a?.[table] || []), ...(b?.[table] || [])])];
    if (ids.length) file[table] = ids;
  }
  return file;
};

/** Nombre total d'éléments en attente d'envoi (pour l'affichage). */
export const totalEnAttente = (file) =>
  Object.values(file || {}).reduce((n, ids) => n + (ids?.length || 0), 0);

/** Ids en attente pour une table, en Set (lecture rapide à la fusion). */
export const enAttentePourTable = (file, table) => new Set(file?.[table] || []);

/**
 * Fusionne une collection reçue du serveur avec la version locale.
 *
 * Trois règles, dans cet ordre :
 *  1. Un élément local encore EN ATTENTE d'envoi gagne contre la version
 *     reçue : c'est une modification faite ici que le serveur ne connaît pas
 *     encore. Sans cette règle, la réception l'efface.
 *  2. Un élément local absent de la réception est conservé — créé hors-ligne —
 *     sauf si un tombstone le déclare supprimé ailleurs, et sauf s'il est
 *     `partage` (actif de l'organisation interne retiré à la source : le
 *     garder le figerait ici pour toujours, sans propriétaire).
 *  3. Sinon, la version du serveur fait foi.
 *
 * Renvoie la RÉFÉRENCE `distants` telle quelle quand rien n'a été substitué ni
 * ajouté. Ce détail est vital : un nouveau tableau passerait pour une
 * modification locale, et l'app renverrait l'intégralité des collections au
 * serveur à chaque réception (plusieurs mégaoctets avec les photos produits).
 */
export const fusionnerCollection = (locaux = [], distants = [], supprimes = new Set(), enAttente = new Set()) => {
  const distantsIds = new Set(distants.map((i) => i.id));
  const locauxSeuls = locaux.filter(
    (i) => !distantsIds.has(i.id) && !supprimes.has(i.id) && !i.partage
  );
  const parId = new Map(locaux.map((i) => [i.id, i]));
  let substitue = false;
  const retenus = distants.map((distant) => {
    const local = parId.get(distant.id);
    // `partage` : ne nous appartient pas, jamais poussé — donc jamais en attente.
    if (!local || distant.partage || !enAttente.has(distant.id)) return distant;
    substitue = true;
    return local;
  });
  if (!substitue && !locauxSeuls.length) return distants;
  return [...retenus, ...locauxSeuls];
};
