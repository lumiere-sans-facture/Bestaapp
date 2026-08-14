-- =====================================================================
--  Journal des plantages de l'application
--  À exécuter dans SQL Editor. Idempotent : ré-exécutable sans danger.
-- =====================================================================
--
-- POURQUOI : sans ce journal, un écran qui plante chez un technicien reste
-- invisible. L'utilisateur voit un message, referme, et personne n'est
-- prévenu. Ici, chaque plantage laisse une trace exploitable.
--
-- CE QUI N'Y ENTRE JAMAIS : aucun nom, aucun téléphone, aucune adresse
-- e-mail. Les messages et piles d'appel sont nettoyés DEUX fois — sur
-- l'appareil (src/utils/journalErreurs.js) puis à la réception
-- (api/erreur.js) — parce que l'adresse d'envoi est ouverte et qu'un appel
-- forgé ne doit pas pouvoir y déposer autre chose.

create table if not exists public.erreurs (
  id          bigserial primary key,
  -- Code court montré à l'utilisateur (« ERR-7F3A »), identique pour toutes
  -- les occurrences du même bug : c'est la clé de regroupement.
  code        text not null,
  signature   text not null default '',
  message     text not null default '',
  pile        text not null default '',
  ecran       text not null default '',
  origine     text not null default '',   -- rendu | globale | promesse
  version     text not null default '',
  appareil    text not null default '',
  user_id     text,
  org_id      text,
  role        text,
  en_ligne    boolean not null default true,
  -- Horloge de l'appareil : indicative, elle peut être fausse.
  survenu_le  timestamptz,
  -- Horloge du serveur : fait foi pour tout classement.
  recu_le     timestamptz not null default now()
);

-- « Qu'est-ce qui plante en ce moment ? » : la requête la plus fréquente.
create index if not exists idx_erreurs_recentes on public.erreurs (recu_le desc);
create index if not exists idx_erreurs_code on public.erreurs (code, recu_le desc);
create index if not exists idx_erreurs_org on public.erreurs (org_id, recu_le desc);

-- RLS ACTIVE SANS AUCUNE POLICY : rien n'est lisible depuis le navigateur.
-- Seule la clé service_role (fonctions serveur) écrit et lit. Un journal
-- d'erreurs peut contenir des indices sur la structure interne de l'app : il
-- n'a rien à faire entre les mains d'un utilisateur, fût-il gérant.
alter table public.erreurs enable row level security;
revoke all on public.erreurs from anon, authenticated;

-- ---------------------------------------------------------------------
-- REQUÊTES D'EXPLOITATION — à lancer à la demande dans SQL Editor
-- ---------------------------------------------------------------------

-- Ce qui plante le plus ces 7 derniers jours, du plus fréquent au moins :
-- select code, count(*) as occurrences, count(distinct user_id) as comptes,
--        max(recu_le) as dernier, min(version) as version, max(message) as exemple
-- from public.erreurs
-- where recu_le > now() - interval '7 days'
-- group by code
-- order by occurrences desc
-- limit 20;

-- Le détail d'un code précis (pile d'appel comprise) :
-- select recu_le, version, appareil, ecran, message, pile
-- from public.erreurs where code = 'ERR-7F3A'
-- order by recu_le desc limit 5;

-- Purge : un journal n'a pas vocation à grossir indéfiniment.
-- delete from public.erreurs where recu_le < now() - interval '90 days';
