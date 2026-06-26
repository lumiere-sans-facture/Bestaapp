-- ============================================================
-- BestaSolar Pro — Durcissement de sécurité (correctif RLS) · CRITIQUE
-- ============================================================
-- Corrige la faille C1 : aujourd'hui la RLS autorise TOUT utilisateur
-- « authenticated » (using true). Or la clé anon est publique → n'importe qui
-- peut s'inscrire via l'API Supabase Auth et lire/écrire/supprimer TOUTES les
-- données (clients, factures, commissions), en contournant le contrôle de
-- profil fait côté app.
--
-- Ce script restreint l'accès aux MEMBRES DE L'ÉQUIPE (porteurs d'un profil).
-- Les profils étant créés uniquement par l'admin (SQL), un inconnu inscrit
-- n'a aucun accès. Idempotent — à exécuter dans le SQL Editor.
--
-- ⚠️  Sans effet de bord pour les utilisateurs légitimes : adam/fatou/ibrahim
--     ont un profil → is_team_member() = true → accès conservé.
-- ============================================================

-- Membre de l'équipe = possède un profil lié à l'email du JWT.
-- security definer : lit profiles sans déclencher sa propre RLS (pas de récursion).
create or replace function public.is_team_member()
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles where lower(email) = lower(auth.jwt() ->> 'email')
  )
$$;

-- Remplace « using (true) » par « using (is_team_member()) » sur toutes les
-- collections + tombstones.
do $$
declare t text;
begin
  foreach t in array array[
    'products','leads','partners','commissions','devis','referrals','orders',
    'formations','formationProgress','subscriptions','subscriptionPayments',
    'companies','factures','tombstones'
  ] loop
    execute format('drop policy if exists "team full access" on public.%I', t);
    execute format('create policy "team full access" on public.%I for all to authenticated using (public.is_team_member()) with check (public.is_team_member())', t);
  end loop;
end $$;

-- profiles : lecture réservée aux membres (plus d'énumération de l'équipe par un inconnu).
drop policy if exists "team read" on public.profiles;
create policy "team read" on public.profiles for select to authenticated
  using (public.is_team_member());

-- ============================================================
-- À FAIRE AUSSI (config Supabase, hors SQL) — défense en profondeur :
--   Authentication → Providers → Email → DÉSACTIVER « Enable sign-ups »
--   (ou passer le projet en invite-only). Empêche la création de comptes
--   par des inconnus, même avant que la RLS ne les bloque.
-- ============================================================
