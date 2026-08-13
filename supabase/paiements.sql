-- =====================================================================
--  Moyens de paiement configurables depuis l'espace gérant
--  À exécuter dans SQL Editor APRÈS schema.sql, security.sql et
--  multitenant.sql. Idempotent : ré-exécutable sans danger.
-- =====================================================================
--
-- CE QUI EST STOCKÉ ICI : uniquement des valeurs PUBLIQUES — nom de
-- l'agrégateur (KkiaPay, CinetPay, FedaPay), clé PUBLIQUE, mode test/réel,
-- activation.
--
-- CE QUI NE DOIT JAMAIS Y ÊTRE : clé privée, clé secrète, jeton d'API. Ces
-- valeurs autorisent remboursements et versements. Elles restent en variables
-- d'environnement Vercel, lues uniquement par les fonctions serveur. Toute
-- ligne de cette table est lisible par les membres de l'organisation ET, par
-- la policy de partage ci-dessous, par TOUTES les entreprises inscrites — car
-- c'est bien le but : leur app doit connaître la clé publique pour afficher
-- le bouton de paiement.

-- 1. La table, au même format que les autres collections répliquées.
create table if not exists public."paiementConfigs" (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2. Multi-entreprise : org_id, index, clé primaire (org_id, id).
--    Reprend à l'identique ce que multitenant.sql applique aux autres tables ;
--    une table créée APRÈS son exécution ne l'a évidemment pas reçu.
alter table public."paiementConfigs" add column if not exists org_id text;
update public."paiementConfigs" set org_id = 'org-bestasolar' where org_id is null;
alter table public."paiementConfigs" alter column org_id set not null;

create index if not exists "idx_paiementConfigs_org_updated"
  on public."paiementConfigs" (org_id, updated_at);

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public."paiementConfigs"'::regclass
      and c.contype = 'p' and a.attname = 'org_id'
  ) then
    alter table public."paiementConfigs" drop constraint "paiementConfigs_pkey";
    alter table public."paiementConfigs" add primary key (org_id, id);
  end if;
end $$;

-- 3. RLS : LECTURE partagée, ÉCRITURE réservée à son organisation.
--    Même modèle que le catalogue produits et les cours de formation :
--    BestaSolar encaisse, donc l'app de CHAQUE entreprise abonnée doit lire
--    sa configuration pour afficher le bon bouton de paiement. L'écriture,
--    elle, reste strictement chez soi : une entreprise externe ne peut pas
--    détourner les paiements en modifiant la ligne de BestaSolar.
alter table public."paiementConfigs" enable row level security;

drop policy if exists "org isolation" on public."paiementConfigs";
drop policy if exists "paiements lecture partagee" on public."paiementConfigs";
drop policy if exists "paiements ecriture org" on public."paiementConfigs";

create policy "paiements lecture partagee" on public."paiementConfigs"
  for select to authenticated
  using (org_id = public.auth_org_id() or public.org_est_interne(org_id));

create policy "paiements ecriture org" on public."paiementConfigs"
  for all to authenticated
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

-- 4. Diffusion temps réel (comme les autres collections).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'paiementConfigs'
  ) then
    alter publication supabase_realtime add table public."paiementConfigs";
  end if;
end $$;

-- Rappel : après cette exécution, rejouer temps-reel.sql n'est pas nécessaire
-- (le bloc 4 ci-dessus s'en charge pour cette table).
