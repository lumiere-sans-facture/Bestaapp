#!/bin/bash
# Joue les scripts SQL du projet sur un PostgreSQL LOCAL, puis un test.
#
#   supabase/tests/lancer.sh                 # scénario parrainage.sql
#   supabase/tests/lancer.sh autre-test.sql
#
# Il faut un serveur PostgreSQL (14 ou plus) joignable : par défaut le socket
# local ; sinon PGHOST / PGPORT / PGUSER (superutilisateur). La base `besta_test`
# est recréée de zéro à chaque lancement. Rien ne touche à Supabase.
#
# La chaîne suit l'ordre de supabase/DEPLOIEMENT.md : le socle, puis les
# migrations dans l'ordre de leurs dates — exactement ce que reçoit un projet.
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
SUPA="$(dirname "$ICI")"
TEST="${1:-$ICI/parrainage.sql}"
BASE=besta_test
export PGOPTIONS='-c client_min_messages=warning'
P=(psql -v ON_ERROR_STOP=1 -q -X)

"${P[@]}" -d postgres <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
SQL
"${P[@]}" -d postgres -c "drop database if exists $BASE with (force);" -c "create database $BASE;"

jouer() { "${P[@]}" -d "$BASE" -f "$1" > /dev/null; }
jouer "$ICI/supabase-imite.sql"
for f in schema.sql security.sql multitenant.sql paiements.sql erreurs.sql \
         migrations/20260829_google_contacts.sql migrations/20260830_google_contacts_leads.sql \
         migrations/20260830_partner_code_uniqueness.sql migrations/20260831_partner_code_format.sql \
         migrations/20260831_merge_manager_accounts.sql codes-promo.sql suppression-compte.sql \
         migrations/20260902_google_contacts_all_clients.sql "$ICI/avant-fusion.sql" \
         migrations/20260902_unify_besta_organization.sql migrations/20260903_leads_publics_visibles_gerant.sql \
         migrations/20260903_restrict_pro_client_visibility.sql migrations/20261012_index_email_profils.sql \
         migrations/20261013_parrainage_commissions.sql; do
  case "$f" in /*) jouer "$f" ;; *) jouer "$SUPA/$f" ;; esac
done
# Rejouable : la dernière migration passe une seconde fois sans rien casser.
jouer "$SUPA/migrations/20261013_parrainage_commissions.sql"

"${P[@]}" -d "$BASE" -f "$TEST"
