// Sauvegarde quotidienne automatique — LOGIQUE PURE.
//
// Partagée par le script de la tâche planifiée (scripts/sauvegarde-supabase.mjs)
// et par ses tests. Ce module ne doit RIEN importer de `lib/` : il est chargé
// par Node brut, hors de Vite, où `import.meta.env` n'existe pas — un import
// de `lib/supabase.js` ferait échouer le script dès la première ligne.
//
// Le fichier produit a EXACTEMENT la forme de l'export manuel
// (utils/backup.js) : la sauvegarde de cette nuit se restaure donc par le
// bouton existant « Plus › Sauvegarde des données », sans outil à installer.

/** Marqueur reconnu par `isValidBackup` (utils/backup.js). Doit rester identique. */
export const MARQUEUR_SAUVEGARDE = 'bestasolar-pro';

/** Nombre de sauvegardes conservées : 7 jours glissants. */
export const SAUVEGARDES_GARDEES = 7;

/**
 * Tables lues pour la sauvegarde — MIROIR de `SYNCED_COLLECTIONS`
 * (lib/remoteSync). La restauration ne sait relire que ces clés.
 *
 * Un test compare les deux listes, et c'est le garde-fou important : une
 * collection ajoutée à la réplication mais oubliée ici sortirait de la
 * sauvegarde EN SILENCE. On ne s'en apercevrait qu'en restaurant, c'est-à-dire
 * le jour où il est déjà trop tard.
 */
export const TABLES_METIER = [
  'products', 'kits', 'inverters', 'pompeKits', 'leads', 'partners', 'commissions',
  'devis', 'referrals', 'orders', 'formations', 'formationProgress', 'subscriptions',
  'subscriptionPayments', 'companies', 'paiementConfigs', 'factures', 'proClients',
  'payoutRequests',
];

/**
 * Tables qui n'existent QUE côté serveur : l'app ne les réplique pas, donc le
 * bouton de restauration les ignore. Sans elles, pourtant, une base reconstruite
 * de zéro n'aurait plus ni entreprises, ni membres d'équipe, ni codes promo.
 *
 * Volontairement ABSENTES de cette liste : `erreurs` (journal, pas une donnée
 * métier) et les tables `google_contacts_*`, qui contiennent des jetons OAuth —
 * un secret n'a rien à faire dans une sauvegarde qu'on recopie.
 */
export const TABLES_SERVEUR = [
  'orgs', 'profiles', 'codes_promo', 'codes_promo_utilisations',
  'paiements_verifies', 'tombstones',
];

/** Toutes les tables à lire, dans l'ordre de la sauvegarde. */
export const TABLES_SAUVEGARDE = [...TABLES_METIER, ...TABLES_SERVEUR];

/**
 * Colonnes de tri utilisées pour parcourir une table page par page. Sans ordre
 * stable, deux pages successives peuvent se recouvrir ou se sauter des lignes.
 * Les clés primaires ne sont pas toutes `id` (cf. supabase/*.sql).
 */
const ORDRE_PAR_TABLE = {
  tombstones: 'id.asc,collection.asc',
  codes_promo: 'code.asc',
  codes_promo_utilisations: 'code.asc,user_id.asc',
  paiements_verifies: 'transaction_id.asc',
};

/** Ordre de parcours d'une table (clé primaire la plus probable). */
export const ordreDeTri = (table) => ORDRE_PAR_TABLE[table] || 'id.asc';

const deuxChiffres = (n) => String(n).padStart(2, '0');

/** Jour d'une date au format AAAA-MM-JJ, en temps universel (UTC). */
export const jourUTC = (date) =>
  `${date.getUTCFullYear()}-${deuxChiffres(date.getUTCMonth() + 1)}-${deuxChiffres(date.getUTCDate())}`;

/**
 * Nom du fichier du jour. Même gabarit que l'export manuel, et surtout : le
 * même nom pour un même jour, donc deux exécutions le même jour se remplacent
 * au lieu de s'empiler.
 */
export const nomFichierSauvegarde = (date) => `bestasolar-sauvegarde-${jourUTC(date)}.json`;

const MOTIF_NOM = /^bestasolar-sauvegarde-(\d{4}-\d{2}-\d{2})\.json$/;

/** Vrai si ce nom de fichier est celui d'une sauvegarde quotidienne. */
export const estNomDeSauvegarde = (nom) => MOTIF_NOM.test(nom || '');

/**
 * Sauvegardes à supprimer pour n'en garder que les `aGarder` plus récentes.
 * Les noms portent la date au format AAAA-MM-JJ : l'ordre alphabétique est
 * donc l'ordre chronologique. Tout fichier qui n'est pas une sauvegarde
 * (README, états) est ignoré — jamais supprimé.
 */
export const sauvegardesAPurger = (noms, aGarder = SAUVEGARDES_GARDEES) => {
  const sauvegardes = (noms || []).filter(estNomDeSauvegarde).sort();
  const garde = Math.max(0, aGarder);
  return sauvegardes.slice(0, Math.max(0, sauvegardes.length - garde));
};

/**
 * Objet de sauvegarde, à la forme attendue par `isValidBackup` / `extractState`.
 *
 * `tablesAbsentes` reste HORS de `data` : la restauration ne lit que `data`, et
 * on ne veut pas lui présenter une clé qui n'est pas une collection.
 *
 * Note : les compteurs de numérotation (`devisCounter`, `orderCounter`) vivent
 * dans le navigateur, pas en base — ils ne peuvent pas figurer ici. Ce n'est pas
 * une perte : à la restauration, une clé absente est laissée telle quelle, donc
 * la numérotation en cours n'est pas écrasée.
 */
export const construireSauvegarde = ({ tables, version, exportedAt, tablesAbsentes = [] }) => ({
  app: MARQUEUR_SAUVEGARDE,
  version,
  exportedAt,
  origine: 'tache-planifiee',
  tablesAbsentes,
  data: { ...tables },
});

/**
 * Version du schéma local, extraite du texte de `src/data/seed.js`.
 *
 * Pourquoi lire le fichier au lieu de l'importer : `seed.js` importe
 * `./catalogue` sans extension, ce que Vite résout mais pas Node — un import
 * ferait échouer le script de sauvegarde. Le champ `version` n'est pas vérifié
 * à la restauration ; le renseigner sert aux migrations futures, donc `null`
 * en cas de doute est préférable à une valeur inventée.
 */
export const versionDepuisSeed = (contenu) => {
  const trouve = /export\s+const\s+SEED_VERSION\s*=\s*(\d+)/.exec(contenu || '');
  return trouve ? Number.parseInt(trouve[1], 10) : null;
};

/** Nombre de lignes par table, pour le résumé lisible du dépôt de sauvegardes. */
export const compterLignes = (tables) =>
  Object.fromEntries(Object.entries(tables || {}).map(([t, lignes]) => [t, (lignes || []).length]));

/** Résumé Markdown déposé à côté des sauvegardes : permet de voir d'un coup d'œil
 *  si la tâche tourne encore, et ce qu'elle a ramené. Une sauvegarde qu'on croit
 *  faite et qui ne l'est plus est le piège classique. */
export const resumeMarkdown = ({ exportedAt, tables, tablesAbsentes = [], fichier, gardees }) => {
  const comptes = compterLignes(tables);
  const total = Object.values(comptes).reduce((s, n) => s + n, 0);
  const lignes = [
    '# Dernière sauvegarde',
    '',
    `- **Date** : ${exportedAt}`,
    `- **Fichier** : \`${fichier}\``,
    `- **Lignes au total** : ${total}`,
    `- **Sauvegardes conservées** : ${gardees}`,
    '',
    '| Table | Lignes |',
    '| --- | --- |',
    ...TABLES_SAUVEGARDE.filter((t) => comptes[t] !== undefined).map((t) => `| ${t} | ${comptes[t]} |`),
  ];
  if (tablesAbsentes.length) {
    lignes.push(
      '',
      '## Tables absentes de la base',
      '',
      "Ces tables n'existent pas encore dans ce projet Supabase — leur script SQL",
      "n'y a probablement pas été exécuté. La sauvegarde est valide pour tout le reste.",
      '',
      ...tablesAbsentes.map((t) => `- \`${t}\``),
    );
  }
  return `${lignes.join('\n')}\n`;
};
