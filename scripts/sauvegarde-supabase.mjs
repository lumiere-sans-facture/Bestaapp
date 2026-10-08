import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const PAGE_SIZE = 1000;

// Tables métier restaurables. Les tables OAuth Google contenant les jetons,
// les états OAuth éphémères et les verrous ne doivent jamais être exportés.
const TABLES = [
  'orgs',
  'profiles',
  'products',
  'kits',
  'inverters',
  'pompeKits',
  'leads',
  'partners',
  'commissions',
  'devis',
  'referrals',
  'orders',
  'formations',
  'formationProgress',
  'subscriptions',
  'subscriptionPayments',
  'companies',
  'paiementConfigs',
  'factures',
  'proClients',
  'payoutRequests',
  'tombstones',
  'codes_promo',
  'codes_promo_utilisations',
  'codes_promo_echecs',
  'paiements_verifies',
  'google_contact_sync_jobs',
];

const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const outputArg = process.argv.indexOf('--output');
const outputDir = path.resolve(
  outputArg >= 0 ? process.argv[outputArg + 1] : (process.env.BACKUP_OUTPUT_DIR || 'sauvegarde-sortie'),
);

if (!/^https:\/\/[^/]+\.supabase\.co$/i.test(url)) {
  throw new Error('SUPABASE_URL absente ou invalide.');
}
if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY absente.');
if (outputArg >= 0 && !process.argv[outputArg + 1]) throw new Error('Valeur manquante après --output.');

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  Accept: 'application/json',
  Prefer: 'count=exact',
};

async function exportTable(table) {
  const rows = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const response = await fetch(`${url}/rest/v1/${encodeURIComponent(table)}?select=*`, {
      headers: {
        ...headers,
        'Range-Unit': 'items',
        Range: `${start}-${start + PAGE_SIZE - 1}`,
      },
    });

    if (response.status === 416) break;
    if (response.status === 404) {
      return { table, rows: null, absent: true };
    }
    if (!response.ok) {
      const message = (await response.text()).slice(0, 500);
      throw new Error(`${table} : réponse Supabase ${response.status} — ${message}`);
    }

    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`${table} : réponse Supabase inattendue.`);
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return { table, rows, absent: false };
}

const exportedAt = new Date();
const data = {};
const missingTables = [];

for (const table of TABLES) {
  const result = await exportTable(table);
  if (result.absent) {
    missingTables.push(table);
    console.warn(`Table absente, ignorée : ${table}`);
  } else {
    data[table] = result.rows;
    console.log(`${table} : ${result.rows.length} ligne(s)`);
  }
}

if (!Object.prototype.hasOwnProperty.call(data, 'profiles')) {
  throw new Error('La table profiles n’a pas pu être exportée : sauvegarde annulée.');
}

const iso = exportedAt.toISOString();
const stamp = iso.replace(/[:.]/g, '-');
const baseName = `bestasolar-production-${stamp}`;
const backup = {
  format: 'bestasolar-supabase-backup',
  version: 1,
  exportedAt: iso,
  source: new URL(url).hostname,
  excluded: [
    'auth.users',
    'google_contacts_configs',
    'google_contacts_oauth_states',
    'google_contact_sync_locks',
  ],
  missingTables,
  tables: data,
};

const compressed = gzipSync(Buffer.from(JSON.stringify(backup)), { level: 9 });
const checksum = createHash('sha256').update(compressed).digest('hex');
const counts = Object.fromEntries(Object.entries(data).map(([table, rows]) => [table, rows.length]));
const manifest = {
  format: backup.format,
  version: backup.version,
  exportedAt: iso,
  source: backup.source,
  archive: `${baseName}.json.gz`,
  sha256: checksum,
  counts,
  missingTables,
  excluded: backup.excluded,
};

await mkdir(outputDir, { recursive: true });
await Promise.all([
  writeFile(path.join(outputDir, `${baseName}.json.gz`), compressed),
  writeFile(path.join(outputDir, `${baseName}.sha256`), `${checksum}  ${baseName}.json.gz\n`, 'utf8'),
  writeFile(path.join(outputDir, `${baseName}.manifest.json`), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8'),
]);

console.log(`Sauvegarde créée : ${baseName}.json.gz (${compressed.length} octets)`);
