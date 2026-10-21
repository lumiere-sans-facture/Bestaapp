-- =========================================================================
-- Paiements des factures de l'espace Pro — une ligne PAR paiement.
-- =========================================================================
-- Jusqu'ici, les encaissements d'une facture étaient rangés DANS la facture
-- (liste `paiements`). Deux appareils qui encaissaient la même facture
-- réécrivaient chacun toute la liste : le second effaçait le paiement du
-- premier. Une ligne par paiement supprime ce risque et permet un reçu par
-- paiement. L'échéancier, lui, reste dans la facture (seul l'émetteur le modifie).
--
-- Même forme que toutes les collections répliquées : (org_id, id) + data jsonb,
-- isolation stricte par entreprise, suppression par tombstone.
--
-- À passer dans les DEUX projets Supabase (recette ET production), après
-- multitenant.sql. Rejouable sans risque.
-- Sans ce script, l'application fonctionne : les paiements restent sur
-- l'appareil et la synchronisation de cette seule table est réessayée toutes
-- les 5 minutes — mais ils ne partent ni vers les autres appareils, ni dans la
-- sauvegarde de la nuit.
-- =========================================================================

create table if not exists public."facturePaiements" (
  org_id     text        not null,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (org_id, id)
);

alter table public."facturePaiements" enable row level security;

drop policy if exists "org isolation" on public."facturePaiements";
create policy "org isolation" on public."facturePaiements" for all to authenticated
  using (org_id = public.auth_org_id())
  with check (org_id = public.auth_org_id());

create index if not exists idx_facturepaiements_org_updated
  on public."facturePaiements" (org_id, updated_at);
