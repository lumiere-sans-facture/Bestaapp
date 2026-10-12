-- =====================================================================
--  RATTRAPAGE : liens parrain → filleul et commissions par niveau des
--  affaires DÉJÀ validées. À passer une fois, après
--  migrations/20261013_parrainage_commissions.sql, DANS LES DEUX PROJETS.
--
--  OÙ : Supabase › SQL Editor › coller ce fichier › Run.
--  Rejouable sans danger : relancé, il ne trouve plus rien à faire.
-- =====================================================================
--
-- ÉTAPE 1 — APERÇU. Tout est calculé puis ANNULÉ : rien ne change, le
-- tableau dit exactement ce que l'étape 2 fera.
--
--   lien parrain          un filleul retrouve son parrain (repris de sa fiche
--                         partenaire, de son ancienne entreprise ou de son
--                         inscription) ;
--   doublon retiré        deux commissions pour le même devis et le même
--                         niveau : la seconde part (jamais une commission
--                         payée ou demandée) ;
--   bénéficiaire corrigé  une commission EN ATTENTE allait à la mauvaise
--                         personne (l'ancienne règle donnait le niveau 1 à
--                         celui qui créait le devis — souvent le gérant) ;
--   commission retirée    un niveau sans bénéficiaire selon la règle, encore
--                         en attente ;
--   commission créée      niveau manquant (le niveau 2 du parrain, le plus
--                         souvent) ;
--   à vérifier            rien n'est touché : une commission déjà PAYÉE ou
--                         DEMANDÉE ne se réécrit pas, une inscription notée
--                         par le seul nom ne se devine pas. À trancher à la
--                         main (la ligne propose la commande).
select etape, objet, detail
from public.rattraper_parrainage_commissions(false)
order by case etape when 'à vérifier' then 0 else 1 end, etape, objet;

-- ÉTAPE 2 — APPLICATION. Retirer les deux tirets de la ligne ci-dessous,
-- puis Run. Le tableau rendu est le compte rendu de ce qui a été fait.
-- select etape, objet, detail from public.rattraper_parrainage_commissions(true) order by etape, objet;

-- Correction à la main d'un parrain (après « à vérifier ») :
--   select public.admin_definir_parrain('<identifiant du compte>', '<CODE-PARRAIN>');
--   select public.admin_definir_parrain('<identifiant du compte>', null);  -- retirer
-- Le gérant peut aussi relancer le rattrapage depuis l'application :
-- Plus › Commissions › « Rattraper les commissions manquantes ».
