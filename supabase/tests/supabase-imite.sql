-- Imitation minimale de l'environnement Supabase, pour jouer les scripts du
-- dossier supabase/ sur un PostgreSQL ordinaire (voir lancer.sh).
--
-- Ce que Supabase fournit et que les scripts supposent : les rôles anon /
-- authenticated / service_role, le schéma auth avec jwt() et uid() lus dans
-- les « claims » de la requête, les droits par défaut du schéma public, et la
-- publication du temps réel. Les rôles sont créés par lancer.sh (ils valent
-- pour tout le serveur, pas pour une base).
create schema auth;
create table auth.users (id uuid primary key, email text, created_at timestamptz not null default now());
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create function auth.role() returns text language sql stable as
  $$ select coalesce(auth.jwt() ->> 'role', 'anon') $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create publication supabase_realtime;
