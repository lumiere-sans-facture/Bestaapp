-- ============================================================
-- Temps réel : diffusion immédiate des changements à toute l'équipe
-- À exécuter dans le SQL Editor de Supabase (Run). Rejouable sans risque.
--
-- POURQUOI : l'application écoute les changements de la base pour les
-- afficher aussitôt sur les autres appareils (un kit ajouté par le gérant
-- apparaît chez les techniciens sans rien faire). Supabase ne diffuse que
-- les tables inscrites dans la publication « supabase_realtime » : une
-- table oubliée là ne se propage jamais en direct.
--
-- Ce script se contente d'INSCRIRE les tables. Il ne touche NI aux données,
-- NI aux droits d'accès (RLS) — contrairement à schema.sql, qu'il ne faut
-- PAS rejouer sur une base déjà passée en multi-entreprise : il y
-- réinstallerait l'accès « toute l'équipe » à la place de l'isolation
-- par organisation.
--
-- L'app fonctionne même sans ce script : depuis la version d'août 2026,
-- chaque appareil relit le serveur au plus tard toutes les minutes et à
-- chaque retour à l'écran. Ce script sert à passer de « au plus tard une
-- minute » à « immédiat ».
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array[
    'products', 'kits', 'inverters', 'pompeKits', 'leads', 'partners',
    'commissions', 'devis', 'referrals', 'orders', 'formations',
    'formationProgress', 'subscriptions', 'subscriptionPayments',
    'companies', 'factures', 'proClients', 'payoutRequests', 'tombstones'
  ] loop
    -- Table absente de cette base : on passe, sans faire échouer le reste.
    if to_regclass(format('public.%I', t)) is null then
      raise notice 'Table % absente : ignorée', t;
      continue;
    end if;
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
      raise notice 'Table % ajoutée au temps réel', t;
    exception when duplicate_object then
      raise notice 'Table % déjà diffusée', t;
    end;
  end loop;
end $$;

-- Vérification : la liste ci-dessous doit contenir toutes vos tables.
select tablename as "table diffusée en temps réel"
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;
