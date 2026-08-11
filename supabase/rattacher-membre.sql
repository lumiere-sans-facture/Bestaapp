-- ============================================================
-- Rattacher un compte EXISTANT à l'organisation d'un gérant
-- À exécuter dans le SQL Editor de Supabase (Run).
-- ============================================================
--
-- POURQUOI CE SCRIPT EXISTE
-- Une inscription faite SANS le lien d'invitation (?equipe=CODE) passe par
-- signup_create_org : elle crée une NOUVELLE organisation et y place la
-- personne avec le rôle « technicien ». Le compte est donc bien un
-- technicien… mais seul dans sa propre entreprise. Or tout est isolé par
-- organisation (RLS) : clients, catalogue, kits ET cours de formation.
-- Chaque nouvelle organisation reçoit sa propre copie des cours livrés avec
-- l'application — mêmes titres, mêmes identifiants — d'où l'illusion que
-- « la formation est là mais le contenu ajouté n'arrive pas ».
--
-- signup_join_org refuse de rejoindre une équipe quand un profil existe déjà
-- pour cet email : un compte mal inscrit ne peut donc pas se rattacher
-- lui-même depuis l'application. D'où ce script, réservé à l'administrateur.
--
-- AVANT DE LANCER
--   • Remplacez les deux emails ci-dessous.
--   • Le membre ne doit pas avoir de données à conserver dans son
--     organisation actuelle : elles y RESTENT (elles ne suivent pas le
--     rattachement). Pour un compte fraîchement créé, il n'y a rien à perdre.
--   • Le membre devra se déconnecter puis se reconnecter : l'organisation est
--     lue à la connexion, et le cache local est rangé par organisation.

-- 0. Inventaire : tous les comptes et leur entreprise. Les membres d'une même
--    équipe partagent le MÊME org_id ; deux entreprises peuvent porter le même
--    nom sans rien partager. Utile pour repérer d'un coup tous les comptes
--    inscrits hors du lien d'invitation.
select o.name as entreprise, p.org_id, p.email, p.name, p.role
  from public.profiles p
  left join public.orgs o on o.id = p.org_id
 order by o.name nulls first, p.email;

-- 1. Vérification : qui est où ? (à lire AVANT de modifier)
select p.email, p.name, p.role, p.org_id, o.name as entreprise
  from public.profiles p
  left join public.orgs o on o.id = p.org_id
 where lower(p.email) in (
   lower('gerant@exemple.com'),      -- ← le compte gérant (organisation cible)
   lower('technicien@exemple.com')   -- ← le compte à rattacher
 );

-- 2. Rattachement. Le rôle reste « technicien » : seul l'org_id change.
update public.profiles
   set org_id = (
     select org_id from public.profiles
      where lower(email) = lower('gerant@exemple.com')
   )
 where lower(email) = lower('technicien@exemple.com');

-- 3. Contrôle : les deux lignes doivent afficher le MÊME org_id.
select p.email, p.name, p.role, p.org_id, o.name as entreprise
  from public.profiles p
  left join public.orgs o on o.id = p.org_id
 where lower(p.email) in (
   lower('gerant@exemple.com'),
   lower('technicien@exemple.com')
 );

-- L'ancienne organisation, désormais vide, peut rester : elle n'est plus
-- lue par personne. Ne la supprimez pas sans avoir vérifié qu'aucun autre
-- profil ne s'y rattache (la contrainte de clé étrangère vous en empêchera).
