// Sauvegarde quotidienne de la base Supabase — exécuté par la tâche planifiée
// .github/workflows/sauvegarde-quotidienne.yml, jamais par le navigateur.
//
//   node scripts/sauvegarde-supabase.mjs --dossier <dossier> [--garder 7]
//
// Variables d'environnement attendues :
//   SUPABASE_URL                 adresse du projet
//   SUPABASE_SERVICE_ROLE_KEY    clé service_role (contourne RLS : indispensable
//                                pour lire les lignes de TOUTES les entreprises)
//
// Deux principes tiennent ce script :
//
//   1. Une sauvegarde PARTIELLE ne doit jamais être déposée en silence. Une
//      table illisible (réseau, clé refusée) fait échouer tout le script : mieux
//      vaut une tâche en rouge qu'un fichier incomplet qu'on croira valide le
//      jour où on en aura besoin. Seule exception : une table qui n'existe pas
//      encore dans ce projet (script SQL pas encore passé) est consignée dans
//      `tablesAbsentes` et n'empêche pas la sauvegarde du reste.
//
//   2. Aucune donnée client dans les messages. Les journaux d'une tâche GitHub
//      sont lisibles par tous les collaborateurs : on cite la table et le
//      nombre de lignes, jamais un nom, un téléphone ou une adresse.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TABLES_SAUVEGARDE,
  TABLES_METIER,
  SAUVEGARDES_GARDEES,
  ordreDeTri,
  nomFichierSauvegarde,
  sauvegardesAPurger,
  construireSauvegarde,
  compterLignes,
  resumeMarkdown,
  versionDepuisSeed,
} from '../src/utils/sauvegardeAuto.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 1000; // lignes par requête
const RESUME = 'DERNIERE-SAUVEGARDE.md';

/** Lit un argument `--nom valeur` sur la ligne de commande. */
const argument = (nom, defaut) => {
  const i = process.argv.indexOf(`--${nom}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
};

const adresse = () => (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const cleService = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** Total de lignes annoncé par PostgREST dans l'en-tête `content-range` (« 0-99/1234 »). */
const totalAnnonce = (contentRange) => {
  const brut = (contentRange || '').split('/')[1];
  const n = Number.parseInt(brut, 10);
  return Number.isFinite(n) ? n : null;
};

/** Vrai si la réponse signale une table inexistante (script SQL pas encore passé). */
const tableAbsente = (reponse, corps) =>
  reponse.status === 404 || corps?.code === '42P01' || corps?.code === 'PGRST205';

/**
 * Lit TOUTES les lignes d'une table, page par page.
 * @returns {Promise<{lignes: object[]}|{absente: true}>}
 */
async function lireTable(table) {
  const base = `${adresse()}/rest/v1/${encodeURIComponent(table)}`;
  const cle = cleService();
  const entetes = {
    apikey: cle,
    // Une clé moderne `sb_secret_…` n'est pas un JWT et Supabase la refuse
    // dans Authorization. Les anciennes clés service_role restent compatibles.
    ...(cle.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${cle}` }),
    Accept: 'application/json',
    Prefer: 'count=exact',
  };

  const lignes = [];
  let total = null;

  for (let offset = 0; ; offset += PAGE) {
    const url = `${base}?select=*&order=${ordreDeTri(table)}&limit=${PAGE}&offset=${offset}`;
    let reponse;
    try {
      reponse = await fetch(url, { headers: entetes });
    } catch (erreur) {
      // L'adresse du projet n'est pas journalisée : elle peut porter la
      // référence du projet, et le diagnostic tient dans la cause.
      throw new Error(`Base injoignable à la lecture de « ${table} » (${erreur.cause?.code || erreur.message}).`);
    }
    const texte = await reponse.text();
    let corps = null;
    try { corps = texte ? JSON.parse(texte) : null; } catch { /* corps non JSON : traité plus bas */ }

    if (!reponse.ok) {
      if (tableAbsente(reponse, corps)) return { absente: true };
      // Ni la clé ni le corps de la réponse ne sont journalisés : le corps peut
      // contenir une ligne de données, la clé est un secret.
      throw new Error(
        `Lecture de « ${table} » refusée (HTTP ${reponse.status}${corps?.code ? `, code ${corps.code}` : ''}).`,
      );
    }
    if (!Array.isArray(corps)) throw new Error(`Réponse inattendue pour « ${table} » (tableau attendu).`);

    if (total === null) total = totalAnnonce(reponse.headers.get('content-range'));
    lignes.push(...corps);

    if (corps.length < PAGE) break;
    if (total !== null && lignes.length >= total) break;
    if (offset > 5_000_000) throw new Error(`Parcours de « ${table} » interrompu : trop de pages.`);
  }

  // Garde-fou contre une pagination qui sauterait des lignes : le compte exact
  // annoncé par la base doit correspondre à ce qu'on a ramené.
  if (total !== null && lignes.length !== total) {
    throw new Error(`Sauvegarde de « ${table} » incomplète : ${lignes.length} lignes sur ${total} annoncées.`);
  }
  return { lignes };
}

/** Version du schéma local, lue dans le fichier de référence (jamais importée :
 *  `src/data/seed.js` s'appuie sur la résolution de Vite, pas sur celle de Node). */
const versionSeed = () => {
  try {
    return versionDepuisSeed(readFileSync(join(RACINE, 'src/data/seed.js'), 'utf8'));
  } catch {
    return null;
  }
};

async function principal() {
  const dossier = argument('dossier');
  const garder = Number.parseInt(argument('garder', String(SAUVEGARDES_GARDEES)), 10);

  if (!dossier) throw new Error('Dossier de destination manquant (--dossier <dossier>).');
  if (!Number.isFinite(garder) || garder < 1) throw new Error('Nombre de sauvegardes à garder invalide (--garder).');
  if (!adresse()) throw new Error('SUPABASE_URL absent : secret non configuré sur le dépôt.');
  if (!cleService()) throw new Error('SUPABASE_SERVICE_ROLE_KEY absent : secret non configuré sur le dépôt.');

  const maintenant = new Date();
  const tables = {};
  const tablesAbsentes = [];

  for (const table of TABLES_SAUVEGARDE) {
    const resultat = await lireTable(table);
    if (resultat.absente) {
      tablesAbsentes.push(table);
      console.log(`· ${table} : absente de la base, ignorée`);
      continue;
    }
    tables[table] = resultat.lignes;
    console.log(`· ${table} : ${resultat.lignes.length} ligne(s)`);
  }

  // Une table MÉTIER absente est tolérée (base en retard sur le code), mais
  // qu'elles le soient TOUTES veut dire qu'on ne lit pas la bonne base.
  if (TABLES_METIER.every((t) => tablesAbsentes.includes(t))) {
    throw new Error('Aucune table métier trouvée : adresse de projet ou clé incorrecte.');
  }

  const exportedAt = maintenant.toISOString();
  const fichier = nomFichierSauvegarde(maintenant);
  const sauvegarde = construireSauvegarde({
    tables,
    version: versionSeed(),
    exportedAt,
    tablesAbsentes,
  });

  mkdirSync(dossier, { recursive: true });
  writeFileSync(join(dossier, fichier), `${JSON.stringify(sauvegarde, null, 2)}\n`, 'utf8');
  writeFileSync(
    join(dossier, RESUME),
    resumeMarkdown({ exportedAt, tables, tablesAbsentes, fichier, gardees: garder }),
    'utf8',
  );

  // Purge seulement après une écriture réussie : on ne supprime jamais une
  // ancienne sauvegarde avant d'avoir la nouvelle sur le disque.
  for (const vieille of sauvegardesAPurger(readdirSync(dossier), garder)) {
    rmSync(join(dossier, vieille));
    console.log(`· purge : ${vieille}`);
  }

  const total = Object.values(compterLignes(tables)).reduce((s, n) => s + n, 0);
  console.log(`\nSauvegarde écrite : ${fichier} — ${total} ligne(s), ${Object.keys(tables).length} table(s).`);
  if (tablesAbsentes.length) console.log(`Tables absentes de la base : ${tablesAbsentes.join(', ')}.`);
}

principal().catch((erreur) => {
  console.error(`Échec de la sauvegarde : ${erreur.message}`);
  process.exit(1);
});
