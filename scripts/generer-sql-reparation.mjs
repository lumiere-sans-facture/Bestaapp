// Génère src/data/sqlReparationClients.js depuis le script SQL de référence.
// Le fichier .sql reste la source de vérité : c'est lui qu'on exécute dans le
// SQL Editor. L'app en embarque une copie pour le bouton « Copier le SQL de
// réparation », et un test vérifie que les deux ne divergent jamais.
//
//   node scripts/generer-sql-reparation.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'supabase/reparer-clients-publics.sql';
const CIBLE = 'src/data/sqlReparationClients.js';

const sql = readFileSync(SOURCE, 'utf8');
const litteral = sql.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

writeFileSync(CIBLE, `// Script de réparation des accès aux clients publics — COPIE GÉNÉRÉE.
//
// Source de vérité : ${SOURCE}. Ne pas modifier ici : éditer le .sql, puis
//   node scripts/generer-sql-reparation.mjs
// Un test compare les deux (src/utils/__tests__/sqlReparation.test.js).
//
// Pourquoi embarquer le SQL dans l'app : le gérant lit le refus sur son
// téléphone. Lui demander d'aller chercher un fichier dans le dépôt, c'est lui
// demander un ordinateur. Le bouton du Diagnostic met le script dans son
// presse-papiers, son adresse déjà remplie — il n'a plus qu'à coller.

export const SQL_REPARATION_CLIENTS = \`${litteral}\`;

// Adresse de démonstration présente dans le script : remplacée par celle de la
// session, pour qu'il n'y ait rien à éditer avant de coller.
export const EMAIL_MODELE = 'mon.email@exemple.com';

/** Le script prêt à coller, avec l'e-mail de la session. */
export const sqlReparationPour = (email) => {
  const propre = String(email || '').trim().toLowerCase().replace(/'/g, '');
  return propre ? SQL_REPARATION_CLIENTS.replaceAll(EMAIL_MODELE, propre) : SQL_REPARATION_CLIENTS;
};
`);
console.log(`${CIBLE} régénéré (${sql.length} caractères de SQL).`);
