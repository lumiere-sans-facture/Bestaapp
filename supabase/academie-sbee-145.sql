-- =====================================================================
--  Académie BestaSolar — exemples SBEE recalculés à 145 F le kWh
--
--  Les exemples de facture SBEE de l'Académie comptaient 115 F le kWh. Le
--  prix par défaut du Bénin est désormais 145 F partout dans l'application
--  (simulateur, fiche, espace Pro) : ce script met à jour les cours DÉJÀ
--  présents dans la base. Les nouvelles bases les reçoivent à jour par
--  formations-academie.sql.
--
--  OÙ : Supabase › SQL Editor › New query › coller TOUT ce fichier › Run.
--  DANS LES DEUX PROJETS : test (recette) ET production.
--
--  Ce qui change (cours « Démarrer » et « Créer des devis ») : 25 000 F à
--  145 F le kWh = 172 kWh par mois, 5,7 kWh par jour ; batterie conseillée
--  3,8 kWh (« Équilibré ») et 5,3 kWh (« Surtout le soir ») ; kits suggérés
--  3,8 kWh et 10 kWh ; le kWh du groupe (250 F) n'est plus « plus du double »
--  du réseau, mais « bien plus cher ».
--
--  Rejouable sans risque :
--   - ne touche que les deux cours de l'organisation interne ;
--   - remplace chaque texte ENTIER, seulement s'il est encore mot pour mot
--     l'ancien : une leçon retouchée par le gérant reste telle quelle ;
--   - une deuxième exécution ne change plus rien.
--  Les téléphones reçoivent la nouvelle version à leur prochaine relecture.
--
--  Le tableau affiché à la fin doit montrer « ✅ » sur les deux lignes.
--  Généré depuis la différence des cours ; un test le compare à
--  src/data/formationsAcademie.js.
-- =====================================================================

do $$
declare
  v_org text;
  v_n   int := 0;
  r     record;
  t     text;
begin
  if to_regclass('public.orgs') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'formations' and column_name = 'org_id') then
    raise exception 'Base en retard : multitenant.sql (le socle) n''est pas passé. Rien n''a été modifié.';
  end if;
  if (select count(*) from public.orgs where kind = 'interne') <> 1 then
    raise exception 'Il faut exactement UNE organisation interne : voir organisation-interne.sql. Rien n''a été modifié.';
  end if;
  select id into v_org from public.orgs where kind = 'interne';

  for r in
    select id, data from public.formations
     where org_id = v_org and id in ('academie-demarrer', 'academie-devis')
  loop
    t := r.data::text;
    t := replace(t,
      $ancien$"Le client ne sait pas lister ses appareils, mais il connaît sa facture ? À l’étape Consommation, choisissez « Facture CEET/SBEE (F CFA) ».\n\nSaisissez la « Facture mensuelle moyenne (F CFA) », vérifiez le « Prix du kWh (F CFA) » de son compteur, puis répondez à « Quand consomme-t-il le plus ? » : surtout en journée, équilibré, ou surtout le soir.\n\nCe dernier choix compte beaucoup : ce qui est consommé le soir passe par la batterie. Le même montant de facture peut donc demander un kit plus grand si le client vit surtout le soir.\n\nExemple — facture SBEE de 25 000 F par mois à 115 F le kWh : environ 217 kWh par mois, soit 7,2 kWh par jour. « Équilibré » donne une batterie conseillée d’environ 4,8 kWh ; « surtout le soir », d’environ 6,7 kWh.\n\nErreurs fréquentes sur le terrain :\n- Prendre la facture d’un mois de coupures : elle sous-estime le besoin.\n- Garder un prix du kWh qui n’est pas celui de la facture du client."$ancien$,
      $nouveau$"Le client ne sait pas lister ses appareils, mais il connaît sa facture ? À l’étape Consommation, choisissez « Facture CEET/SBEE (F CFA) ».\n\nSaisissez la « Facture mensuelle moyenne (F CFA) », vérifiez le « Prix du kWh (F CFA) » de son compteur, puis répondez à « Quand consomme-t-il le plus ? » : surtout en journée, équilibré, ou surtout le soir.\n\nCe dernier choix compte beaucoup : ce qui est consommé le soir passe par la batterie. Le même montant de facture peut donc demander un kit plus grand si le client vit surtout le soir.\n\nExemple — facture SBEE de 25 000 F par mois à 145 F le kWh : environ 172 kWh par mois, soit 5,7 kWh par jour. « Équilibré » donne une batterie conseillée d’environ 3,8 kWh ; « surtout le soir », d’environ 5,3 kWh.\n\nErreurs fréquentes sur le terrain :\n- Prendre la facture d’un mois de coupures : elle sous-estime le besoin.\n- Garder un prix du kWh qui n’est pas celui de la facture du client."$nouveau$);
    t := replace(t,
      $ancien$"Facture de 25 000 F à 115 F le kWh : combien de kWh par mois, environ ?"$ancien$,
      $nouveau$"Facture de 25 000 F à 145 F le kWh : combien de kWh par mois, environ ?"$nouveau$);
    t := replace(t,
      $ancien$"22 kWh"$ancien$,
      $nouveau$"17 kWh"$nouveau$);
    t := replace(t,
      $ancien$"217 kWh"$ancien$,
      $nouveau$"172 kWh"$nouveau$);
    t := replace(t,
      $ancien$"2 875 kWh"$ancien$,
      $nouveau$"3 625 kWh"$nouveau$);
    t := replace(t,
      $ancien$"25 000 ÷ 115 ≈ 217 kWh par mois, soit environ 7,2 kWh par jour."$ancien$,
      $nouveau$"25 000 ÷ 145 ≈ 172 kWh par mois, soit environ 5,7 kWh par jour."$nouveau$);
    t := replace(t,
      $ancien$"Plus → Simulateur ROI part de ce que le client paie aujourd’hui. Saisissez sa consommation « D’après ses appareils » ou « D’après sa facture », puis le pays : le prix du kWh de l’opérateur (SBEE, CEET, CIE…) se règle tout seul.\n\nIndiquez les « Coupures de courant » en heures par jour et cochez « Le client a un groupe électrogène », avec le prix du litre de gazole. L’écran compare alors le kWh au réseau et le kWh au groupe.\n\nEn face, l’application place le kit qu’elle proposerait, avec son prix. Elle affiche le temps pour rembourser l’installation, l’économie de la 1re année et le gain sur la durée choisie : 10, 15 ou 25 ans.\n\nEn bas, « Ce que le calcul suppose » liste les hypothèses. Lisez-les : un chiffre qu’on ne sait pas justifier ne vaut rien devant le client.\n\nExemple — facture SBEE de 25 000 F, 4 h de coupure par jour, gazole à 750 F le litre : le kWh du groupe revient à 250 F, contre 115 F au réseau. Le client comprend pourquoi ses dépenses explosent pendant les coupures.\n\nErreurs fréquentes sur le terrain :\n- Annoncer un remboursement plus rapide que celui affiché.\n- Oublier les coupures : on sous-estime ce que le client dépense déjà."$ancien$,
      $nouveau$"Plus → Simulateur ROI part de ce que le client paie aujourd’hui. Saisissez sa consommation « D’après ses appareils » ou « D’après sa facture », puis le pays : le prix du kWh de l’opérateur (SBEE, CEET, CIE…) se règle tout seul.\n\nIndiquez les « Coupures de courant » en heures par jour et cochez « Le client a un groupe électrogène », avec le prix du litre de gazole. L’écran compare alors le kWh au réseau et le kWh au groupe.\n\nEn face, l’application place le kit qu’elle proposerait, avec son prix. Elle affiche le temps pour rembourser l’installation, l’économie de la 1re année et le gain sur la durée choisie : 10, 15 ou 25 ans.\n\nEn bas, « Ce que le calcul suppose » liste les hypothèses. Lisez-les : un chiffre qu’on ne sait pas justifier ne vaut rien devant le client.\n\nExemple — facture SBEE de 25 000 F, 4 h de coupure par jour, gazole à 750 F le litre : le kWh du groupe revient à 250 F, contre 145 F au réseau. Le client comprend pourquoi ses dépenses explosent pendant les coupures.\n\nErreurs fréquentes sur le terrain :\n- Annoncer un remboursement plus rapide que celui affiché.\n- Oublier les coupures : on sous-estime ce que le client dépense déjà."$nouveau$);
    t := replace(t,
      $ancien$"- Partez de ce que le client paie déjà.\n- Le kWh au groupe coûte souvent plus du double du réseau.\n- Choisissez la durée avec le client : 10, 15 ou 25 ans."$ancien$,
      $nouveau$"- Partez de ce que le client paie déjà.\n- Le kWh au groupe coûte bien plus cher que celui du réseau.\n- Choisissez la durée avec le client : 10, 15 ou 25 ans."$nouveau$);
    t := replace(t,
      $ancien$"Un groupe tire environ 3 kWh d’un litre : 750 ÷ 3 = 250 F le kWh, plus du double du réseau."$ancien$,
      $nouveau$"Un groupe tire environ 3 kWh d’un litre : 750 ÷ 3 = 250 F le kWh, bien plus cher que le réseau (145 F à la SBEE)."$nouveau$);
    t := replace(t,
      $ancien$"Le cas : M. et Mme Bio, à Parakou, quartier Banikanni. Facture SBEE d’environ 25 000 F par mois. Télé et ventilateurs tournent surtout le soir, et les coupures sont fréquentes.\n\nÉtape 1 — Créez le client (Plus → Clients → « Nouveau client »), avec le téléphone et le quartier. Notez : « coupures le soir, facture 25 000 F ».\n\nÉtape 2 — Touchez +, puis « Dimensionnement solaire ». Choisissez le client, puis « Facture CEET/SBEE (F CFA) » : 25 000 F, prix du kWh 115 F. Essayez « Équilibré », puis « Surtout le soir », et comparez.\n\nCe que vous devez trouver : environ 217 kWh par mois, soit 7,2 kWh par jour. En « Équilibré », une batterie conseillée d’environ 4,8 kWh ; en « Surtout le soir », d’environ 6,7 kWh, donc un kit plus grand.\n\nÉtape 3 — À l’étape Résultat, notez le kit suggéré et son total. Avec les kits livrés par défaut dans l’application : le Kit 5 kWh en « Équilibré », le Kit 10 kWh en « Surtout le soir ». Vos montants suivent les kits de votre entreprise.\n\nÉtape 4 — Ouvrez Plus → Simulateur ROI avec la même facture, 4 h de coupure et un groupe électrogène : montrez au couple le prix du kWh au groupe face au réseau.\n\nÉtape 5 — Créez le devis, envoyez-le sur WhatsApp le jour même avec la fiche de dimensionnement, et proposez une date de rappel. Sans réponse après 7 jours : « Relancer par WhatsApp ».\n\nExemple — comme le couple vit surtout le soir, Odile retient « Surtout le soir ». Le kit est plus grand, mais la batterie tient jusqu’au matin : c’est ce qu’elle explique avec la page 3 de la fiche.\n\nErreurs fréquentes sur le terrain :\n- Dimensionner en « Équilibré » un ménage qui vit le soir : la batterie est vide avant minuit.\n- Annoncer un prix avant d’avoir vu le résultat de l’assistant."$ancien$,
      $nouveau$"Le cas : M. et Mme Bio, à Parakou, quartier Banikanni. Facture SBEE d’environ 25 000 F par mois. Télé et ventilateurs tournent surtout le soir, et les coupures sont fréquentes.\n\nÉtape 1 — Créez le client (Plus → Clients → « Nouveau client »), avec le téléphone et le quartier. Notez : « coupures le soir, facture 25 000 F ».\n\nÉtape 2 — Touchez +, puis « Dimensionnement solaire ». Choisissez le client, puis « Facture CEET/SBEE (F CFA) » : 25 000 F, prix du kWh 145 F. Essayez « Équilibré », puis « Surtout le soir », et comparez.\n\nCe que vous devez trouver : environ 172 kWh par mois, soit 5,7 kWh par jour. En « Équilibré », une batterie conseillée d’environ 3,8 kWh ; en « Surtout le soir », d’environ 5,3 kWh, donc un kit plus grand.\n\nÉtape 3 — À l’étape Résultat, notez le kit suggéré et son total. Avec les kits livrés par défaut dans l’application : le Kit 3,8 kWh en « Équilibré », le Kit 10 kWh en « Surtout le soir ». Vos montants suivent les kits de votre entreprise.\n\nÉtape 4 — Ouvrez Plus → Simulateur ROI avec la même facture, 4 h de coupure et un groupe électrogène : montrez au couple le prix du kWh au groupe face au réseau.\n\nÉtape 5 — Créez le devis, envoyez-le sur WhatsApp le jour même avec la fiche de dimensionnement, et proposez une date de rappel. Sans réponse après 7 jours : « Relancer par WhatsApp ».\n\nExemple — comme le couple vit surtout le soir, Odile retient « Surtout le soir ». Le kit est plus grand, mais la batterie tient jusqu’au matin : c’est ce qu’elle explique avec la page 3 de la fiche.\n\nErreurs fréquentes sur le terrain :\n- Dimensionner en « Équilibré » un ménage qui vit le soir : la batterie est vide avant minuit.\n- Annoncer un prix avant d’avoir vu le résultat de l’assistant."$nouveau$);
    t := replace(t,
      $ancien$"Facture SBEE de 25 000 F à 115 F le kWh : consommation par jour, environ ?"$ancien$,
      $nouveau$"Facture SBEE de 25 000 F à 145 F le kWh : consommation par jour, environ ?"$nouveau$);
    t := replace(t,
      $ancien$"2,4 kWh"$ancien$,
      $nouveau$"1,9 kWh"$nouveau$);
    t := replace(t,
      $ancien$"7,2 kWh"$ancien$,
      $nouveau$"5,7 kWh"$nouveau$);
    t := replace(t,
      $ancien$"21,7 kWh"$ancien$,
      $nouveau$"17,2 kWh"$nouveau$);
    t := replace(t,
      $ancien$"25 000 ÷ 115 ≈ 217 kWh par mois ; divisé par 30 jours, environ 7,2 kWh par jour."$ancien$,
      $nouveau$"25 000 ÷ 145 ≈ 172 kWh par mois ; divisé par 30 jours, environ 5,7 kWh par jour."$nouveau$);
    if t <> r.data::text then
      update public.formations
         set data = t::jsonb, updated_at = now()
       where org_id = v_org and id = r.id;
      v_n := v_n + 1;
    end if;
  end loop;
  raise notice 'Académie : % cours mis à jour (145 F le kWh SBEE).', v_n;
end $$;

-- Contrôle : « ✅ » = plus aucun exemple à 115 F. « ⚠️ » = une leçon a été
-- retouchée à la main : corriger ses chiffres depuis l'application.
-- « — absent » = cours supprimé ou jamais doté (rien à faire).
select c.id as cours,
       case
         when f.id is null then '— absent'
         when f.data::text like '%115 F le kWh%' or f.data::text like '%÷ 115%'
           or f.data::text like '%contre 115 F%' or f.data::text like '%prix du kWh 115 F%'
           then '⚠️ encore un exemple à 115 F'
         else '✅ à jour (145 F)'
       end as etat
  from (values ('academie-demarrer'), ('academie-devis')) as c(id)
  left join public.formations f
    on f.id = c.id and f.org_id = (select id from public.orgs where kind = 'interne')
 order by c.id;
