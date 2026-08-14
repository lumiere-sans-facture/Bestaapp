-- =====================================================================
--  Vérifier / désigner l'organisation INTERNE (BestaSolar)
--  Script d'entretien — à exécuter à la demande, jamais au déploiement.
-- =====================================================================
--
-- À QUOI SERT `kind = 'interne'` : l'organisation interne est celle qui
-- possède le catalogue produits, les kits et les cours de formation partagés
-- avec toutes les entreprises inscrites. C'est aussi la SEULE qui peut
-- « Commander en ligne » depuis la boutique — puisque cet encaissement
-- alimente les commandes BestaSolar.
--
-- SYMPTÔME QUI AMÈNE ICI : le bouton « Commander en ligne » n'apparaît pas
-- dans le panier, alors qu'on est bien gérant.

-- 1. ÉTAT DES LIEUX — à lancer d'abord, seul.
--    Repérez la ligne de VOTRE entreprise et regardez sa colonne `kind`.
select o.id, o.name, o.kind, count(p.id) as membres
from public.orgs o
left join public.profiles p on p.org_id = o.id
group by o.id, o.name, o.kind
order by (o.kind = 'interne') desc, membres desc;

-- 2. À QUELLE ENTREPRISE APPARTIENT MON COMPTE ?
--    Remplacez l'adresse par la vôtre.
-- select p.email, p.role, p.org_id, o.name, o.kind
-- from public.profiles p
-- join public.orgs o on o.id = p.org_id
-- where lower(p.email) = lower('vous@exemple.com');

-- 3. DÉSIGNER L'ORGANISATION INTERNE.
--    ⚠️ Il ne doit y en avoir QU'UNE : deux organisations internes
--    partageraient toutes les deux leur catalogue, et les entreprises
--    inscrites verraient des produits en double.
--    Décommentez, remplacez l'identifiant, puis exécutez le bloc entier.
--
-- begin;
--   -- Toutes les autres redeviennent des entreprises ordinaires.
--   update public.orgs set kind = 'pro' where kind = 'interne' and id <> 'org-bestasolar';
--   update public.orgs set kind = 'interne' where id = 'org-bestasolar';
--   -- Contrôle avant validation : une seule ligne doit apparaître.
--   select id, name, kind from public.orgs where kind = 'interne';
-- commit;

-- 4. RATTACHER VOTRE COMPTE À L'ORGANISATION INTERNE.
--    Utile si vous vous êtes inscrit sans lien d'invitation : votre compte
--    est alors seul dans une entreprise créée pour l'occasion.
--    Pour déplacer AUSSI les données déjà saisies, utiliser plutôt
--    `rattacher-membre.sql`, qui traite chaque collection.
--
-- update public.profiles set org_id = 'org-bestasolar'
-- where lower(email) = lower('vous@exemple.com');
