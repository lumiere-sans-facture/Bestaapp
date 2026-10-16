# Historique des modifications

Journal des changements de **BestaSolar Pro**, du plus récent au plus ancien,
généré à partir de l'historique Git (une entrée par commit sur `main` ou sur
la branche de travail en cours). Les numéros entre parenthèses renvoient aux
pull requests correspondantes sur GitHub.

## 2026-10-16
- **Brouillons de la boutique : visibles dès l'arrivée du gérant.**
  - Un bandeau en tête de boutique annonce « 29 produits en brouillon », avec un bouton « Voir ».
  - La puce « Brouillons » vient juste après « Tous ».
  - Avant, elle fermait la rangée des catégories, hors de l'écran d'un téléphone. Dans « Tous », le premier brouillon arrivait en 158ᵉ position : le gérant ne les trouvait pas.
  - Scénario `e2e/brouillons-boutique.mjs` : gérant BestaSolar et gérant d'une entreprise Pro, Supabase simulé.
- **29 produits Deye en boutique, en brouillon : le gérant les relit et les publie un par un.**
  - Nouveau statut « Brouillon ». Le produit n'est visible que du gérant de BestaSolar. Il porte un badge et a sa propre puce « Brouillons (N) », et le bouton « Publier » se trouve sur sa fiche.
  - Un brouillon n'existe nulle part ailleurs : boutique des techniciens et des entreprises Pro, devis, dimensionnement, panier.
  - Prix : le prix client affiché est le prix converti du dry-run. L'arrondi du +10 % saute certains montants : 3 produits s'affichent alors à 1 F de plus (897 001 F au lieu de 897 000 F).
  - Catégories existantes : 13 onduleurs, 7 batteries, 8 accessoires, 1 contrôleur. Chaque fiche affiche une présentation en français au-dessus des caractéristiques.
  - Pas de doublon. Trois modèles déjà vendus par BestaSolar (SUN-20K-SG05LP3, BOS-G-PDU-2, BOS-G PRO 5 kWh) ne sont pas réimportés, et leur prix du catalogue est conservé.
  - Relancer l'import (`scrape_deye.py importer`) met à jour un SKU existant au lieu de le créer. Le journal (`deye_import/import.md`) compte créés, mis à jour et échecs.
  - Photos : un visuel provisoire « Photo à venir » porte déjà le nom définitif de chaque image. Les photos officielles Deye le remplaceront sans toucher aux données.
  - Textes corrigés à la relance : les onduleurs réseau 100 et 136 kW ne se disent plus « batterie haute tension ». Les plages et dimensions s'écrivent à la française (« -20 à 55 °C », « 601,5 × 520 × 135 mm »).
- **Script de synchronisation des produits Deye, prêt à tourner** (`scripts/scrape_deye.py`). Il fonctionne en dry-run et ne touche pas à la boutique.
  - Il parcourt une catégorie en ligne, ne garde que les produits Deye et convertit les prix (NGN × 0,6, arrondi à la centaine supérieure).
  - Il rédige les descriptions en français à partir des caractéristiques et écrit `deye_import/products.csv`, `products.json` et `rapport.md`.
  - Il respecte le robots.txt du site.
  - Une seconde commande passe sur fond bleu BestaSolar, sans liseré, des photos que l'entreprise a le droit d'utiliser.
  - Premier dry-run (`deye_import/`) : 32 produits Deye retenus sur les 34 de la catégorie (2 supports Pylontech écartés), prix convertis, noms et descriptions en français, caractéristiques au format de la boutique. Rien n'est encore importé.
- **Kits étendus : un onduleur n'est plus écarté pour un seul panneau.**
  - Sur un onduleur, deux chaînes d'une même entrée MPPT ont la même longueur. Certains nombres de panneaux ne se câblent donc pas alors que le suivant, oui. Exemple : un 80 kW à 6 entrées de 2 chaînes, avec 17 panneaux de 620 Wc au plus par chaîne, refuse 201 panneaux mais accepte 202.
  - Avant, l'app écartait cet onduleur : deux 50 kW en parallèle à la place, ou « Configuration impossible » s'il n'y avait pas d'autre modèle. Cela arrivait alors même que sa puissance PV max (126 kWc) suffisait pour les 124,6 kWc demandés.
  - Désormais, jusqu'à 2 panneaux sont posés en plus quand cela permet de câbler les chaînes, jamais moins que le dimensionnement. L'écran l'explique : « 1 panneau ajouté pour câbler les chaînes : 201 panneaux ne se répartissent pas sur … ; 202 oui. »
  - Le bouton « + » va au nombre câblable suivant, au lieu d'annoncer « Maximum atteint ».
  - La puissance PV max de l'onduleur reste respectée : 203 panneaux demandés exigeraient 204 (126,48 kWc, au-delà de 126 kWc), et l'onduleur passe alors en parallèle comme avant.

## 2026-10-15
- **Kits étendus : plus de coffrets ni de lots facturés à chaque chaîne, des chaînes au plus près du minimum, et un « Pourquoi ? » sous les alertes d'onduleur.**
  - **Accessoires reconnus correctement.**
    - Un « Coffret de protection DC + Ensemble fusible » n'est plus pris pour un fusible, ni un « Lot de petites fournitures » pour une gaine. Coffrets et lots ne sont jamais tarifés comme accessoire de chaîne, que ce soit depuis le kit ou depuis la boutique.
    - Les fusibles ne s'ajoutent qu'aux chaînes au-delà des entrées d'un coffret qui les contient déjà.
    - Il faut un coffret de jonction par tranche de 8 chaînes en trop, au lieu d'un seul quel que soit le dépassement.
  - **Chaînes.**
    - Des chaînes égales ne sont retenues que si elles en comptent au plus une de plus que le minimum possible ; sinon, chaînes de n et n+1 panneaux au minimum.
    - Kit 208 kWh à 190 panneaux (PCS 125 kW) : 12 chaînes de 15 ou 16 panneaux au lieu de 19 de 10. Le total passe de 61 005 000 à 51 573 500 F.
  - **Caractéristiques d'onduleur incohérentes avec le kit de base** (ex. 2 MPPT et « chaînes par MPPT » vide) : ce n'est plus une « configuration impossible ».
    - L'onduleur du kit est gardé et le devis reste possible.
    - L'assistant dit quoi corriger dans Plus › Onduleurs.
  - **« Pourquoi ? »**, sous « Configuration impossible » et sous « Onduleur à vérifier » :
    - les onduleurs essayés, chacun avec la raison de son échec ;
    - les onduleurs écartés d'office : autre tension, sans tension (donc HV) pour un kit 12/24/48 V, non triphasé, caractéristiques manquantes, parallèle insuffisant.
  - Aucun onduleur enregistré ni aucun kit n'est modifié : seule la logique change.

## 2026-10-14
- **Boutique : les congélateurs solaires et leurs kits, repris de la brochure « Réfrigérateur & Congélateur solaire ».**
  - **Deux nouvelles catégories** :
    - **« Congélateurs »** : les 6 appareils seuls (vertical BD 198L, réfrigérateur-congélateur BCD-202L, coffres BD 004 de 318, 218, 168 et 118 L), avec capacité, alimentation 12/24 V et 220 V, et consommation ;
    - **« Kits »** : les 6 kits prêts à poser. La fiche de chacun liste sa composition : congélateur, batterie lithium, panneaux, régulateur, câble 6 mm², coffret DC, moulure et cosses.
  - **Prix** : la brochure n'a qu'une colonne de prix, traitée comme le **prix partenaire**, comme pour les pompes et le reste du catalogue. La boutique affiche le prix public, +10 % (ex. kit 218L : 670 000 F partenaire, 737 000 F public).
  - **Photos** extraites du PDF, sur fond blanc.
  - Ces kits restent des **articles de boutique**. Ils fonctionnent en courant continu, sans onduleur : ils ne rejoignent pas « Mes kits », dont le dimensionnement les proposerait à tort pour une maison.
  - « Kits » était déjà la catégorie proposée par défaut à la création d'un produit, mais elle n'existait pas : un produit créé sans changer la catégorie n'apparaissait sous aucun filtre. Il apparaît désormais sous « Kits ».
  - **En production, aucun script SQL n'est nécessaire.** Au premier lancement de l'application mise à jour sur un appareil BestaSolar déjà installé, les 12 produits rejoignent le catalogue partagé, comme les pompes avant eux.
  - Vérification :
    - test `catalogueDotation` : un appareil déjà installé reçoit les 12 produits, sans perdre un prix retouché par le gérant ;
    - au navigateur : filtres, prix, photos, fiche, recherche « congélateur » (12 résultats), tableau de bord, téléphone de 360 px.
- **Suivi des formations : recherche d'un apprenant, et statistiques de l'équipe dans « Mon profil » du gérant.**
  - **Recherche** dans Plus → « Suivi des formations » → Apprenants : par nom, e-mail ou numéro. Les accents et les majuscules sont ignorés, et chaque mot tapé doit correspondre. Elle se combine aux filtres et affiche « N apprenants sur M » ; quand rien ne correspond, l'écran le dit.
  - **« Mon profil » du gérant** : un bloc « Formation de mon équipe » donne les membres à former, la part qui a commencé, les actifs sur 30 jours, les modules terminés, les quiz et leur moyenne, et ceux qui ont terminé un cours. Il montre aussi les trois plus avancés et ceux qui n'ont pas encore commencé, avec un lien vers le suivi détaillé. Le profil d'un technicien ne change pas.
  Tests `suiviFormation` (15 cas, dont la recherche) ; parcours `e2e/suivi-formations.mjs` (37 vérifications) ; suite complète des parcours rejouée.
- **Suivi des formations de l'équipe, pour le gérant : au tableau de bord et dans Plus.**
  - **Tableau de bord** (gérant seulement) : la carte « Formation de l'équipe » montre la part des membres qui ont commencé l'Académie, et combien n'ont pas commencé. Elle donne aussi les membres actifs sur 30 jours, les modules terminés, les quiz réalisés avec leur score moyen, et ceux qui ont terminé un cours. La carte « Cours de l'Académie » montre les cours les plus suivis et les moins suivis, en nombre de membres qui les ont ouverts.
  - **Plus → « Suivi des formations »** (réservé au gérant, adresse comprise) :
    - **Apprenants** : leçons, modules et cours terminés, quiz réussis et moyenne, dernière activité ; filtres « Pas commencé », « En cours », « Inactifs 30 j ».
    - **Détail d'un membre** : sa progression dans chaque cours, et chacun de ses quiz (meilleur score, tentatives, date).
    - **Cours**, du plus regardé au moins regardé, et **Quiz**, du plus difficile au plus facile, avec « à revoir avec l'équipe » sous 70 %.
    - Le bouton **« Encourager »** ouvre WhatsApp avec un message prêt, au prénom seul : une invitation à commencer pour qui ne l'a pas fait, des félicitations et le cours à continuer pour les autres.
  - **Ce qui est désormais enregistré** : l'ouverture d'une leçon, pour savoir ce qui est regardé même sans clic sur « Terminer », et chaque quiz vérifié (score, meilleur score, nombre de tentatives). Un quiz est compté réussi à partir de 70 % sur la meilleure tentative. Le gérant n'est pas compté parmi les apprenants. Ces informations voyagent avec l'avancement déjà synchronisé : aucun script SQL n'est nécessaire.
  Tests `suiviFormation` (12 cas) ; parcours `e2e/suivi-formations.mjs` (26 vérifications : un technicien suit un cours et refait un quiz, le gérant voit tout au tableau de bord et dans le suivi, le technicien n'y a pas accès, téléphone) ; suite complète des parcours rejouée.
- **Inscription : « Error sending confirmation email » devient un message clair, et le gérant est prévenu.** Quand Supabase n'arrive pas à envoyer l'e-mail (refus du serveur d'envoi Brevo, quota atteint…), le client lisait cette erreur en anglais. Il lit maintenant « L'e-mail n'a pas pu être envoyé pour le moment. Réessayez dans quelques minutes ; si cela continue, contactez BestaSolar. » L'incident part au journal des erreurs, sans l'adresse du client. Même traitement pour « Renvoyer l'e-mail » et « Mot de passe oublié ». La marche à suivre pour trouver la cause est dans `supabase/DEPLOIEMENT.md` § 10.6. Le nouveau modèle d'e-mail a été vérifié avec le moteur de modèles de Supabase (Go) : il n'est pas en cause.
  Parcours `e2e/inscription-code.mjs` (19 vérifications, dont l'envoi refusé).
- **E-mail de confirmation : le lien et le code valent une heure, plus 24 heures.** Avec le code, une durée courte suffit : un code expiré se redemande depuis l'application (« Renvoyer l'e-mail »), et c'est la durée que Supabase recommande. Réglage « Email OTP Expiration » à 3600 dans les deux projets, et texte de l'e-mail aligné (« au bout d'une heure »).
- **E-mail de confirmation : la présentation de l'e-mail actuel, avec le logo, et le code en plus.** Le modèle `supabase/emails/confirmation-inscription.html` reprend l'e-mail que reçoivent aujourd'hui les nouveaux inscrits : logo BestaSolar Pro en tête, « Vérifiez votre adresse e-mail pour continuer vers BestaSolar Pro », l'adresse du compte, le grand bouton orange « Vérifier mon adresse e-mail ». Le code à 6 chiffres est ajouté sous le bouton. Le logo est l'image de l'application, servie par app.bestasolar.com. Si la messagerie bloque les images, « BestaSolar Pro » s'affiche en texte à la place.
  Rendu vérifié sur téléphone (320 et 400 px) et sur ordinateur, avec et sans images : aucun débordement.
- **Inscription : un code de confirmation en plus du lien.** L'e-mail « Confirmez votre compte BestaSolar Pro » porte désormais un code à 6 chiffres sous le bouton. Juste après « Créer mon compte », l'écran « Confirmer votre adresse » s'ouvre : on recopie le code, et l'app s'ouvre connectée. Cela marche même quand l'e-mail est lu sur le téléphone et que le lien s'ouvre dans le navigateur au lieu de l'application. L'entreprise et le code partenaire saisis à l'inscription sont gardés. Le lien marche toujours.
  - « Renvoyer l'e-mail » envoie un nouveau code (seul celui du dernier e-mail vaut). Supabase limite les envois à un par minute, et l'écran le dit en français.
  - « J'ai reçu un code de confirmation » depuis l'écran de connexion. Un compte jamais confirmé qui se connecte avec le bon mot de passe arrive aussi sur la saisie du code, au lieu de « mot de passe incorrect ».
  - Code tapé sur un autre appareil que celui de l'inscription : l'adresse est confirmée, et la dernière étape (nom, téléphone) s'affiche.
  - ⚠️ **À faire dans les DEUX projets Supabase** : recoller `supabase/emails/confirmation-inscription.html` dans *Authentication → Email Templates → Confirm signup*. Sans cela, l'e-mail n'a que le lien. Voir `supabase/DEPLOIEMENT.md` § 10 et `RECETTE.md`.
  Parcours `e2e/inscription-code.mjs` (17 vérifications, Supabase simulé : code faux refusé, bon code, entreprise et parrainage transmis, renvoi et limite, compte non confirmé, autre appareil, téléphone) ; parcours connexion, parrainage, suppression de compte, deux appareils et synchronisation rejoués.
- **Espace Pro : le rappel « Votre abonnement expire dans N jours — Renouveler » reste sur Devis & Factures.** Le gérant le garde dans l'espace Pro. Le bandeau n'est retiré que de l'espace principal.
  Vérifié au navigateur (`e2e/simulateur-devis.mjs`, 30 vérifications) : rappel présent à 2 jours de l'échéance dans l'espace Pro, absent de l'espace principal ; suite complète des parcours rejouée.
- **Plus aucun bandeau « Renouveler » en tête des écrans.** Le rappel d'abonnement Devis Pro, « a expiré » comme « expire dans N jours », ne s'affiche plus en haut des écrans. Cela vaut pour tout l'espace principal (tableau de bord, Devis, Simulateur…) et, un temps, pour l'écran « Devis & Factures » de l'espace Pro (rappel rétabli ensuite, voir au-dessus). Ces écrans se montrent au client, et le bandeau y gênait (décision du gérant). L'échéance proche, dans les 7 derniers jours, reste annoncée discrètement dans les alertes du tableau de bord et la cloche des notifications. La page Abonnement montre toujours l'état et permet de renouveler.
  Vérifié au navigateur sur téléphone (`e2e/simulateur-devis.mjs`, 30 vérifications). Abonnement expiré : aucun bandeau au tableau de bord, au Simulateur ni sur Devis. Échéance dans 2 jours : aucun bandeau, annonce présente dans les alertes. Espace Pro : aucun bandeau sur Devis & Factures. Les mêmes contrôles échouent sur l'ancien code. Parcours abonnement et espace Pro rejoués.
- **Simulateur ROI : plus de rappel « Abonnement expiré — Renouveler » en haut de l'écran.** Le Simulateur se montre au client : ce bandeau, en tête de page devant le prospect, gênait la vente. Le rappel reste sur les autres écrans, dont le tableau de bord et les devis, pour que l'abonnement ne se perde pas par oubli.
  Vérifié au navigateur avec un abonnement expiré, sur téléphone (`e2e/simulateur-devis.mjs`, 26 vérifications) : aucun rappel au Simulateur ; rappel présent au tableau de bord et sur Devis.
- **Simulateur ROI : il s'ouvre sur « D'après sa facture ».** C'est le chiffre que le client a en main. « D'après ses appareils », avec la reprise de l'étude d'un devis, reste à un clic. L'assistant de devis ne change pas : il s'ouvre toujours sur la liste des appareils, et sa rangée des modes de saisie reste une seule ligne qu'on fait glisser.
  Vérifié au navigateur (`e2e/simulateur-devis.mjs`, 23 vérifications, dont les réponses de « Quand consomme-t-il le plus ? » à la ligne dans l'assistant sur téléphone) ; parcours maintenance adapté (il passe sur « D'après ses appareils » pour reprendre l'étude) et rejoué.
- **« Quand consomme-t-il le plus ? » : les trois réponses visibles d'un coup.** Dans le Simulateur ROI comme dans l'assistant de devis (public et Pro), les réponses passent à la ligne quand la place manque. Avant, elles défilaient sur une seule rangée, et « Surtout le soir » était coupé au bord de la carte. Les autres rangées de choix ne changent pas.
  Vérifié au navigateur sur ordinateur et sur téléphone (375 px) : les trois réponses tiennent dans leur carte, sans défilement (`e2e/simulateur-devis.mjs`, 20 vérifications).
- **Simulateur ROI : la question « Quand consomme-t-il le plus ? » revient sur la facture.** Elle propose les mêmes réponses que l'assistant de devis, « Équilibré jour / nuit » par défaut. La facture est convertie de la même façon : mois de 30 jours, part de nuit selon la réponse. Pour une même facture et une même réponse, le Simulateur et l'assistant proposent donc le même kit, les mêmes panneaux, les mêmes modules et le même total. Par exemple, 330 000 F au Togo, consommation équilibrée : Kit 60 kWh porté à 72 kWh, 43 panneaux, 16 426 000 F des deux côtés. « Surtout le soir » porte la batterie à 96 kWh. Le coût annuel de la facture reprend toujours exactement douze factures.
  Tests `propositionKit` (25 cas, dont la même conversion pour les trois réponses) ; parcours `e2e/simulateur-devis.mjs` (17 vérifications au navigateur, dont la question, sa réponse par défaut et le même total à l'assistant) ; parcours maintenance rejoué.
- **Simulateur ROI : l'écran d'avant, avec le kit composé exactement comme au devis.** Le Simulateur retrouve l'écran qu'il avait avant le changement du 13 octobre. Il n'a ni boutons +/−, ni choix de variante, ni « Créer le devis avec cette proposition », ni question jour/nuit sur la facture. Le kit qu'il affiche sort désormais de la même fonction que le dimensionnement de l'assistant de devis. Il a donc le même kit, les mêmes panneaux complétés ou ajustés au besoin, les mêmes modules batterie ajoutés au besoin et le même onduleur. Le prix est le même, main-d'œuvre doublée au Togo comprise. La ligne du kit décrit cette composition, avec les mêmes mots qu'au devis : « 72 kWh de batterie (étendue depuis 60) · 39 panneaux de 620 Wc (ajustés au besoin, au lieu de 42) · onduleur 30 kVA ». Avant, elle affichait la batterie du kit de base, 60 kWh. Un devis repris dans le Simulateur garde son kit et ses réglages. Les boutons +/− et « Modules batterie max » restent dans l'assistant de devis.
  Tests `propositionKit` (24 cas : même consommation, même kit, même total, dont 60 kWh porté à 72 puis 96 kWh) ; parcours `e2e/simulateur-devis.mjs` (13 vérifications : écran d'avant, facture de 300 000 F → 72 kWh et 39 panneaux, même total à l'assistant, 16 076 000 F, téléphone) ; parcours maintenance, reprise d'étude, kit 48 kWh, haute tension et extension rejoués.

## 2026-10-13
- **Simulateur ROI et devis : la même proposition de kit, réglable panneau par panneau et module par module.**
  - **Le même résultat des deux côtés.** Le Simulateur et l'assistant de devis appelaient les mêmes calculs, mais avec des réglages différents. Pour un même besoin, ils ne proposaient donc ni le même kit ni le même prix : 1 771 000 F contre 1 851 000 F pour les quatre appareils de départ au Togo (main-d'œuvre doublée oubliée), et un kit 60 kWh contre 48 kWh pour une facture de 250 000 F. Les deux écrans passent désormais par une seule fonction (`utils/propositionKit.js`), avec la même étude en entrée.
  - **La facture se convertit de la même façon.** Le Simulateur pose la même question que l'assistant (« Quand consomme-t-il le plus ? ») et convertit sur des mois de 30 jours. Le coût annuel affiché reprend toujours exactement douze factures. Le pays du client fixe aussi la main-d'œuvre (doublée au Togo).
  - **Boutons +/− sur les panneaux et les modules batterie**, dans le Simulateur comme dans l'assistant de devis, avec recalcul en direct de la capacité, de l'autonomie (en nuits), de la puissance et du prix. Le kit suggéré reste le point de départ. Les modules ajoutés sont identiques à ceux du kit, donc compatibles avec son onduleur, d'un module jusqu'au maximum. Les panneaux ne descendent pas sous la chaîne minimale de l'onduleur, et le « + » s'arrête quand aucun onduleur n'accepte un panneau de plus. Passer sous le besoin reste possible, avec une alerte « autonomie insuffisante » ou « production insuffisante », sans bloquer le devis. Un bouton ramène à la proposition automatique, et un réglage n'est repris que tant que le besoin n'a pas changé.
  - **« Modules batterie max » dans Mes kits** : combien de modules identiques l'onduleur accepte en parallèle, 4 par défaut. Un kit haute tension suit son boîtier de contrôle (10 pour le GB-W, 12 ou 16 pour le B-PRO).
  - **« Créer le devis avec cette proposition »** depuis le Simulateur : l'assistant de devis s'ouvre avec la même consommation, le même kit, les mêmes réglages et le même pays. On choisit le client, et le total est identique. Le devis enregistre le kit retenu et les réglages : « Revoir le dimensionnement » retrouve exactement la même composition.
  - Sans kit assez grand dans Mes kits, le plus grand est complété en modules jusqu'à couvrir le besoin, dans la limite de son maximum.
  Tests `propositionKit` (23 cas, dont 6 preuves « même besoin, même résultat » : appareils au Togo et au Bénin, facture, kit haute tension étendu, réglages +/−, variante choisie) ; parcours `e2e/simulateur-devis.mjs` (33 vérifications : prix identique, +/− et limites, alerte sous le besoin, création du devis, réouverture, Modules max, téléphone) ; parcours existants de l'assistant de devis rejoués sans écart.
- **Formation : trois parcours guidés de l'Académie BestaSolar, avec quiz et schémas.** « Démarrer avec BestaSolar Pro » (débutant, 47 min), « Créer des devis qui signent » (1 h 05) et « Gagner de l'argent avec BestaSolar Pro » (56 min) rejoignent le catalogue, à côté des cours existants, tous conservés.
  - **Contenu.** Chaque leçon donne son objectif, un texte court lisible sur téléphone, un exemple local en F CFA (Cotonou, Lomé, Parakou…), les erreurs fréquentes du terrain et l'essentiel en trois points au plus. Les boutons et les écrans décrits sont ceux de l'application, relevés écran par écran. La formation 2 se termine par un cas complet : un ménage de Parakou, de la facture SBEE à la relance, avec les chiffres réels de l'assistant. La formation 3 ne promet aucun gain : les montants sont des exemples, et elle le dit.
  - **Quiz corrigés sur place.** Nouveau type de leçon « Quiz » : un QCM de 3 à 5 questions par module, plus un quiz final par formation. Chaque réponse est expliquée, juste ou fausse. La leçon ne se termine qu'une fois le quiz vérifié, réussi ou non, et on peut le recommencer. Les bonnes réponses sont réparties entre A, B et C.
  - **Schémas dessinés en SVG**, livrés avec l'application et colorés par le thème, donc lisibles en mode sombre et hors ligne : les cinq onglets, le parcours d'un premier client, du client à la signature, le chemin de l'énergie dans un kit hybride, l'entonnoir de vente et ce qu'une vente fait entrer. Une leçon les cite par une ligne `[[schema:nom]]` : la base ne stocke jamais de dessin. Les couvertures (16:9) sont embarquées elles aussi, sans image à télécharger.
  - **Checklist du plan d'action sur 30 jours** en PDF d'une page (70 Ko), à imprimer ou à garder sur le téléphone.
  - **Mode sombre : l'encadré « À retenir / Actions » des leçons redevient lisible**, pour tous les cours. Son fond crème était codé en dur, et le texte clair du thème sombre s'y effaçait.
  - **À exécuter dans les DEUX projets Supabase : `supabase/formations-academie.sql`.** En mode SaaS, les cours sont ceux de l'organisation interne, lus en partage par toutes les entreprises : sans ce script, les trois formations n'apparaissent pas. Il est rejouable. Il n'ajoute que les cours absents, ne réécrit jamais un cours retouché par le gérant et ne ressuscite pas un cours supprimé. Il compte un bloc indépendant par formation, qui peut se coller seul. Il est généré depuis `src/data/formationsAcademie.js` (`node scripts/formations-sql.mjs`), et un test vérifie que les deux ne divergent pas. Les couvertures y sont encodées au plus court (guillemets simples, seuls `%`, `#`, `<`, `>` et les accents encodés) : 8 Ko au lieu de 13.
  Tests `formationsAcademie` (structure, plan des leçons, quiz, schémas, progression, aucune promesse de gain), `formationsAcademieSql`, dotation des installations existantes ; scénario SQL `supabase/tests/formations-academie.sql`, joué sur la base complète et sur une base restée au socle du 30 août ; parcours `e2e/formations-academie.mjs` (44 vérifications : catalogue, leçon, schéma, quiz, progression après rechargement, ancien cours, PDF, téléphone 375 px, mode sombre).
- **Barre latérale : le menu commence juste sous le logo.** La cloche des notifications occupait une ligne entière sous « BestaSolar Pro », ce qui laissait 86 px vides avant « Tableau de bord ». Elle revient sur la ligne du logo, comme en mode Pro, et l'écart tombe à 38 px. La marque est très légèrement resserrée pour que la cloche ne recouvre jamais le nom ; mesuré dans Chromium avec la vraie police Inter : 10 px d'écart entre le nom et la cloche.
- **Parrainage : la mise à jour passe sur les deux bases réelles, et les nouveaux inscrits ont le bon parrain.** Corrections trouvées en passant la migration sur le projet de test, puis sur la production :
  - **La migration passe sur une base restée aux scripts de fin août.** Elle refusait de s'exécuter (« Base en retard ») et conseillait de rejouer `multitenant.sql`. Ce conseil était dangereux : sur une base où les comptes ont été réunis, ce rejeu rouvre les clients de chacun à tous les membres. Elle crée maintenant elle-même ce qui lui manque, sans rien remplacer.
  - **Une affaire recopiée dans plusieurs entreprises** (avant la réunion des comptes) ne bloque plus le rattrapage, et rien de payé n'est jamais retiré. Un résumé en lecture seule (`rattrapage-parrainage-resume.sql`) dit, devis par devis, s'il s'agit de simples copies ou d'un vrai paiement en double.
  - **Le code tapé à l'inscription prime sur le parrain noté sur la fiche**, que l'ancienne application remplissait parfois d'office. Un code désigne le compte de la personne, pas un contact homonyme saisi à la main. Un lien qui ferait de deux personnes le parrain l'une de l'autre est refusé.
  - **Un inscrit sans code est rattaché au gérant**, et non plus à la plus ancienne fiche de l'entreprise, qui était en production une fiche de démonstration (Adam, Mamadou).
  - Un parrain peut être corrigé à la main depuis le SQL Editor (`admin_definir_parrain`), comme le rattrapage le propose.
  Scénario SQL en 16 étapes, rejoué sur la base complète et sur une base restée au socle du 30 août (`SOCLE=fin-aout supabase/tests/lancer.sh`). En production : liens rétablis (Binta, Fatou, Boubacar Soumana → Siddo ; Starlink benin → Fatou), une copie non payée retirée, une commission manquante créée ; aucun paiement en double constaté.
- **Parrainage et commissions : le parrain est celui de la personne, les commissions sont calculées par le serveur.** Depuis la réunion de tous les comptes dans une organisation Besta unique, le lien parrain → filleul vivait sur l'*organisation*, commune à tout le monde. Quatre défauts en découlaient :
  - **Le filleul n'apparaissait pas chez son parrain.** « Parrainé par » lisait l'organisation commune, et « Mes filleuls » cherchait des *entreprises* nées du code du parrain ; il ne s'en crée plus. Le lien est désormais enregistré à l'inscription, sur la personne (table `parrainages`, une ligne par filleul, boucles refusées). Le parrain voit ses filleuls avec leur nom, leur date d'inscription, leur statut et ce qu'ils lui ont rapporté ; chacun voit son parrain. Le code saisi après l'inscription s'applique à la personne, une seule fois.
  - **La commission allait au gérant au lieu du technicien.** Elle était calculée dans le navigateur de celui qui validait le devis : l'« apporteur » retombait sur le créateur du devis, souvent le gérant, ou sur un lien de parrainage resté actif dans ce navigateur. Elle naît maintenant sur le serveur, quand un devis (ou un client) passe à « gagné » : **niveau 1 au technicien propriétaire du client, niveau 2 à son parrain**, 3 % et 1,5 %. Les taux vivent dans `reglages_commissions` : un niveau 3 s'ajoute par une ligne, sans toucher au code. Il y a une ligne par niveau, sans doublon possible, et une commission déjà payée n'est jamais payée une seconde fois. Chacun ne lit que ses commissions ; le gérant les lit toutes, et lui seul les modifie. Un passage à « gagné » écrit par un autre compte que le gérant est ignoré, et les commissions qu'une ancienne version de l'application calcule encore sont écartées.
  - **Les sous-totaux par niveau** s'affichent dans l'espace partenaire et dans l'écran Commissions du gérant, avec le taux réel, le devis d'origine et, au niveau 2, le filleul qui a fait la vente.
  - **Les clics sur les liens n'étaient jamais comptés** : seulement une fois le visiteur *connecté*, et chez lui. Ils sont désormais comptés dès l'arrivée, visiteur anonyme compris, au nom du parrain (`?ref=CODE`, le nouveau lien court `/r/CODE`, la page `/telecharger`). Un seul clic est compté par visiteur et par 24 h ; l'adresse IP est hachée, jamais gardée en clair. Le parrain voit ses clics, ses inscriptions et le taux de conversion.
  - La commission d'**abonnement** d'un filleul va elle aussi au parrain de la personne.
  - **À exécuter dans les DEUX projets Supabase :** `supabase/migrations/20261013_parrainage_commissions.sql`, puis `supabase/rattrapage-parrainage.sql`. Le rattrapage s'exécute d'abord en aperçu, puis en application ; il recrée les liens et les commissions par niveau des affaires déjà validées, sans jamais toucher une commission payée ou demandée. Retour arrière : `supabase/annuler-parrainage-commissions.sql`.
  Testé sur un vrai PostgreSQL avec toute la chaîne des scripts (`supabase/tests/lancer.sh`, scénario A → B → C en 12 étapes : lecture par rôle, idempotence, boucles, clics, abonnement, rattrapage en aperçu puis appliqué, rejouable) ; parcours `e2e/parrainage-serveur.mjs` (18 vérifications) ; tests `commissionSync`, `referral`, `referralResolve`, `parrainage`.

## 2026-10-12
- **Synchronisation entre appareils : une modification faite sur l'un n'est plus effacée par l'autre.**
  - **La cause.** Chaque envoi renvoyait la collection ENTIÈRE, avec la copie de l'appareil. Or l'ordinateur modifie des fiches tout seul, par exemple en notant l'issue d'une relance Google Contacts. À chacune de ces relances, sur n'importe quel contact, il réécrivait sur le serveur *tous* les contacts avec sa vieille copie. Un nom corrigé sur le téléphone revenait donc à l'ancien, sur le serveur puis partout. Désormais, **seules les fiches modifiées sur l'appareil partent**. C'est aussi beaucoup moins de données envoyées (le catalogue embarque ses photos).
  - **Même fiche modifiée des deux côtés.** Avant l'envoi, la fiche est relue sur le serveur, et les changements d'ici y sont reportés champ par champ. L'ordinateur qui relance Google sur sa vieille copie d'un contact renommé envoie le nouveau nom avec son statut Google, et l'affiche aussitôt.
  - **Profil partenaire réinitialisé à la première connexion d'un appareil neuf.** Le profil partenaire du compte était créé avant la première lecture du serveur. Vierge, il l'emportait à la réception et écrasait le vrai : numéro Mobile Money effacé, **code partenaire changé**, alors que ce code figure dans les liens de parrainage déjà diffusés. La création attend maintenant la lecture du serveur. Les relances Google Contacts attendent aussi, pour ne plus s'appliquer à des copies périmées.
  Parcours `e2e/deux-appareils.mjs` (9 vérifications, Supabase simulé qui garde les données ; 2/9 seulement sur l'ancien code) ; tests `fileSync.test.js` (`rebaserSurServeur`).
- **Connexion : l'app s'ouvre tout de suite, sur mobile comme sur le web.**
  - **Réouverture instantanée.** Le jeton de connexion expire au bout d'une heure : à presque chaque réouverture, l'app attendait son renouvellement auprès du serveur, puis relisait l'entreprise, avant d'afficher quoi que ce soit. Elle s'ouvre maintenant aussitôt sur le profil mémorisé de l'appareil ; session et profil sont vérifiés juste après, en arrière-plan. Mesuré avec un serveur simulé dont le renouvellement prend 4 s : tableau de bord affiché en 0,5 s au lieu de 4,6 s.
  - **Sans réseau, l'app s'ouvre aussi.** Avec un jeton expiré et sans réseau, l'écran « Chargement… » restait affiché 51 s, puis cédait la place à l'écran de connexion, impossible à franchir sans réseau. L'app s'ouvre désormais en 0,4 s et reste ouverte ; le jeton sera renouvelé au retour du réseau.
  - **Garde-fous.** Une session refusée par le serveur (révoquée) referme l'app et oublie le profil mémorisé. Une session ouverte pour un autre compte (lien reçu par e-mail) referme l'app avant tout. Et la synchronisation ne lit plus rien sans session : sans elle, la base répond « aucune ligne » et une base pleine passait pour vierge.
  - **Moins d'allers-retours.** À l'ouverture, profil et entreprise sont relus en même temps ; à chaque synchronisation, les suppressions sont lues en même temps que les données, et non plus après.
  - **Web : moins à retélécharger après une mise à jour.** React, Supabase et la bibliothèque des numéros de téléphone sont rangés dans un fichier à part (`vendor`). Son nom ne change pas d'une version à l'autre, donc il reste dans le cache du navigateur : après un déploiement, le fichier principal à retélécharger pèse 79 Ko compressés au lieu de 226 Ko.
  - **Base de données (à exécuter dans les DEUX projets Supabase) : `supabase/migrations/20261012_index_email_profils.sql`.** Les règles de sécurité cherchent le profil de la session par `lower(email)`, pour chaque ligne lue. Faute d'index adapté, chaque recherche parcourait toute la table des profils, et ce coût grandissait à chaque nouvel inscrit. L'index rend la recherche directe ; il ne change aucun droit.
  Vérifié au navigateur avec un Supabase simulé (jeton lent, révoqué, hors réseau, connexion par mot de passe), et sur le build de production (écrans chargés à la demande) ; tests `syncResilience.test.js`.
- **Synchronisation : plus de voyant, et des contacts Google qui partent vite.**
  - Le voyant de synchronisation (pastille à côté du nom, dans le menu) est retiré pour tous les comptes. La synchronisation, elle, tourne comme avant ; le gérant en garde l'état dans « Plus » (avec « Synchroniser maintenant »). Comme plus rien ne s'affiche chez un technicien, un envoi qui échoue durablement (3 échecs de suite, hors coupure de réseau) est désormais signalé au journal des erreurs — une fois par motif, avec le rôle et l'entreprise, jamais de nom ni de numéro.
  - **Contacts Google : reprise rapide.** Un contact refusé une fois attendait 5 minutes (10 et plus côté serveur) ; il repart maintenant au bout de 15 s, puis 30 s, 1 min, 2 min, 5 min… jusqu'à 1 h au plus, réveillé à l'heure exacte (`utils/contactsGoogle.js`). Un enregistrement réussi repart du début.
  - **Fin d'une boucle.** Un contact laissé « en attente » sans échéance (réponse « déjà en cours » du serveur, réponse vide) était renvoyé aussitôt, en boucle — près de trois appels par seconde juste après la connexion, chacun renvoyant aussi toute la liste des partenaires au serveur. Ce travail parasite alourdissait les premières secondes après la connexion et pouvait empêcher la synchronisation de se stabiliser. Chaque essai a désormais son échéance.
  Parcours `e2e/synchro-silencieuse.mjs` (8 vérifications, Supabase simulé) ; tests `repriseGoogle.test.js`.
- **Menu latéral : plus de localisation.** La mention « Lomé, Togo » sous le logo (espace public, sur ordinateur) est retirée ; la cloche des notifications reste à sa place, alignée à droite.
- **Maintenance annuelle : une seule règle, selon le nombre de panneaux.** 30 000 F CFA/an sous 10 panneaux ; à partir de 10, 50 000 F + 2 000 F par panneau au-delà de 10 (11 panneaux : 52 000 ; 20 : 70 000 ; 100 : 230 000). N = nombre total de panneaux du système dimensionné. Trois montants fixes et différents coexistaient : 50 000 sur la fiche de dimensionnement, 15 000 dans le simulateur ROI, 50 000 sur le devis sur mesure. Tous passent désormais par `calculMaintenanceAnnuelle` (`src/utils/maintenance.js`, constantes `BASE_PETIT`, `BASE`, `SEUIL`, `PAR_PANNEAU`) :
  - **fiche de dimensionnement** (page 3, rentabilité) : maintenance du système dimensionné ; un montant saisi par l'installateur dans l'espace Pro garde la main ;
  - **simulateur ROI** (Plus) : entretien calculé sur les panneaux du kit proposé ;
  - **assistant Pro** : le champ « Maintenance annuelle » annonce le montant par défaut du système ;
  - **devis sur mesure** (`buildQuotation`) : ligne « Maintenance annuelle » au montant de la règle.
  Seul le **montant** s'affiche (« 62 000 F CFA/an ») : la règle de calcul n'est écrite nulle part à l'écran ni sur les documents. Pour un même système, le simulateur et la fiche affichent le même montant — vérifié sur un devis de deux climatiseurs 3 CV (16 panneaux → 62 000 F CFA/an des deux côtés). Les rentabilités changent en conséquence (un petit système passe de 15 000 à 30 000 F/an dans le simulateur, de 50 000 à 30 000 sur la fiche). Tests `maintenance.test.js` (les 8 exemples de contrôle, et la même valeur partout) ; parcours `e2e/maintenance-annuelle.mjs`.
- **Devis et factures : la composition du kit retenu, sans le détail des ajustements.** Le document d'un kit étendu imprimait une page d'annexe « Ajustements du kit » (kit de base → proposition, panneaux ajoutés, suppléments de main-d'œuvre, impact sur le prix) et des lignes « … — extension ». Le devis et la facture ne présentent plus que le **matériel final** : chaque ligne d'extension rejoint la ligne du kit de même désignation et de même prix (quantités additionnées), sinon elle garde sa place sous son nom sans « — extension » ; l'annexe disparaît des trois modèles. Le total ne change pas. La règle vaut aussi pour les devis et factures déjà enregistrés (au moment d'imprimer), et les lignes d'un devis Pro créé depuis un kit naissent déjà à la composition retenue. Le détail reste visible du **vendeur**, à l'écran, dans la section « Ajustements du kit » de l'assistant (`utils/compositionKit.js`).
- **Ordinateur : « Télécharger » ouvre aussi le PDF.** Comme dans l'application Android, le devis, la facture ou la fiche de dimensionnement téléchargés s'ouvrent en plus dans un onglet du navigateur. Si le navigateur bloque cet onglet (préparation trop longue), la notification propose un bouton « Ouvrir ». Sur un téléphone, rien ne change : son navigateur ne sait pas afficher un PDF dans un onglet et le retéléchargerait ; l'envoi WhatsApp depuis un ordinateur (PDF à joindre) n'ouvre pas d'onglet non plus. Notifications : un bouton d'action est désormais possible (`toast(…, { action })`). Parcours `e2e/ouverture-pdf-ordinateur.mjs` (9 vérifications) ; les parcours des documents admettent désormais l'onglet du PDF lui-même, jamais une page à imprimer.

## 2026-10-11
- **Envoi d'un devis ou d'une facture : directement dans la conversation WhatsApp du client.** Dans l'application Android, « Envoyer le devis (la facture) sur WhatsApp » ouvrait le menu de partage : il fallait choisir WhatsApp, puis chercher le client. Comme la relance, l'envoi ouvre maintenant WhatsApp **sur la conversation du client**, PDF et message joints — il ne reste qu'à appuyer sur « Envoyer ». Le numéro est celui du devis ou du client ; un numéro saisi en local reçoit l'indicatif du pays (Togo pour l'espace public, pays de l'entreprise en Pro). WhatsApp et WhatsApp Business installés tous les deux : Android demande lequel utiliser. Sans WhatsApp, ou sans numéro, le comportement d'avant (menu de partage, ou WhatsApp qui demande le contact). Dans un navigateur, rien ne change : le menu de partage du téléphone reste le seul moyen de joindre un fichier.
- **Télécharger un PDF l'ouvre aussitôt.** Dans l'application Android, le devis, la facture ou la fiche de dimensionnement téléchargés sont toujours rangés dans `Documents/BestaSolar`, et s'ouvrent en plus dans le lecteur PDF du téléphone.
  Ces deux comportements passent par un module natif propre à l'application (`android/app/src/main/java/com/bestasolar/app/FichiersNatifsPlugin.java`, déclaré dans `MainActivity` ; paquets WhatsApp déclarés dans `AndroidManifest.xml`). Ils arrivent donc avec le prochain APK, c'est-à-dire à la mise en production. Parcours `e2e/envoi-direct-pdf.mjs` (10 vérifications, module natif simulé).
- **Fiche de dimensionnement : la capacité batterie nécessaire, plus le détail des modules.** Le récapitulatif matériel listait le parc (« Batterie lithium 48 V 208 Ah (10 kWh) × 2 ») et l'encadré « Stockage » sa capacité installée. La fiche donne désormais la seule **capacité nécessaire** issue du calcul — encadré « Stockage », ligne « Capacité batterie nécessaire » du récapitulatif, résultat du § 4 —, sans mention de « parc installé ». Le choix des batteries reste sur le devis.

## 2026-10-10
- **Parrainage : le code partenaire suit l'application Android jusqu'à l'inscription.** Un APK téléchargé hors Play Store ne sait pas par quel lien il est arrivé : le filleul devait retaper le code du partenaire. Désormais :
  - l'espace partenaire (et la fiche partenaire du gérant) donne un second lien, **« App Android »** : `…/telecharger?ref=CODE`, repris dans le message WhatsApp ;
  - ce lien ouvre une page (`public/telecharger.html`) qui affiche le code ; son bouton copie « Code partenaire BestaSolar : CODE » dans le presse-papiers puis lance le téléchargement. Sans code, `/telecharger` mène toujours directement à l'APK (règles `has` / `missing` de `vercel.json`) ;
  - au **premier lancement** de l'application, ce texte est relu une seule fois (`src/lib/parrainageInstallation.js`, module `@capacitor/clipboard`) : l'app s'ouvre sur l'inscription, code partenaire prérempli, attribution de 30 jours comme pour un lien. Garde-fous : APK Android seulement, installation neuve seulement (jamais après une mise à jour d'une app déjà utilisée), jamais si un code est déjà retenu ; seul ce format exact est retenu, rien d'autre n'est gardé ni envoyé ; au-delà de 2 s, l'app démarre sans. La politique de confidentialité le mentionne.
  - limites : Android annonce la lecture (« … a collé depuis le presse-papiers ») ; si le filleul copie autre chose avant d'ouvrir l'app, ou si le téléphone a vidé son presse-papiers entre-temps, il saisit le code à la main, comme avant.
  - au passage, dans l'application Android, les liens partenaires partaient en `https://localhost/?ref=…` : ils visent maintenant le site public.
  Parcours `e2e/parrainage-application.mjs` (16 vérifications en local, dont l'inscription préremplie avec Supabase simulé).
- **Couleurs des documents : le code couleur se tape.** Dans « Mon entreprise », chaque couleur (principale, secondaire) se règle au nuancier OU en tapant le code de la charte graphique : « #E30613 », « E30613 » sans dièse, la forme courte « #E31 », ou « rgb(227, 6, 19) ». Le code s'applique dès qu'il est complet — aperçu en direct, documents et fiche ; un code incomplet ou faux n'efface rien et est signalé ; le nuancier met le code à jour (`ChampCouleur`, `normaliserCodeCouleur`). Le code entier reste lisible sur un téléphone de 360 px. Parcours `e2e/couleurs-code.mjs` (12 vérifications).
- **Logo des documents Pro : à sa juste taille.** Il était affiché à 32 px de haut quelle que soit sa forme : un sigle carré, ou entouré de marges, devenait un timbre-poste sur la facture. Désormais (`src/utils/logo.js`) :
  - sa taille suit ses **proportions** : chaque logo reçoit la même surface visuelle — un sigle carré 80 × 80 px, un logo en longueur environ 124 × 52 px — sans jamais descendre sous l'ancienne hauteur (le logo BestaSolar ne change pas), sur les devis et factures (Studio, Vague), la fiche de dimensionnement et l'aperçu de « Mon entreprise » ; aucune page ne déborde ;
  - à l'import, ses **marges vides** (transparentes ou blanches) sont rognées, et il reste en **PNG** : la conversion JPEG noircissait ou blanchissait le fond d'un logo détouré ;
  - un logo déjà enregistré est recadré une fois, à l'ouverture de « Mon entreprise » (annoncé par un message).
  Parcours `e2e/logo-entreprise.mjs` (9 vérifications).
- **Espace Pro étanche : plus de devis ni de clients publics.** Les devis publics de l'abonné apparaissaient dans « Devis & Factures » et dans l'historique de ses clients Pro ; le carnet Pro proposait d'« Importer depuis mes clients » (le suivi public — pour le gérant, celui de toute la plateforme) ; la cloche de notifications reprenait, en Pro, les alertes publiques (clients sans activité, devis sans suite, commissions). Désormais l'espace Pro ne montre que les devis Pro (`estDevisPro`), le carnet Pro, et ses propres alertes — factures en retard ou à échéance, entreprise, abonnement, brouillons — avec des liens vers les écrans Pro (`buildAlertFeedPro`, partagé avec le tableau de bord Pro). Les conditions par défaut d'un document Pro sont à son nom (« ORT Bâtiment se réserve… ») et non plus « BestaSolar ».
- **Aperçu des documents dans l'application, avec retour.** L'aperçu de « Mon entreprise » ouvrait un onglet séparé — dans l'application Android, une page sans retour possible. Un aperçu plein écran (`ApercuDocument`) le remplace : barre « ← Retour », pages à la largeur de l'écran, et le bouton « retour » du téléphone le ferme sans quitter l'écran. Les devis et factures Pro gagnent un bouton « Aperçu » ; depuis l'aperçu, on télécharge le PDF ou on l'envoie sur WhatsApp. Parcours `e2e/espace-pro-etanche.mjs` (20 vérifications).

## 2026-10-09
- **Pays de l'entreprise : identifiants fiscaux et opérateurs Mobile Money vérifiés.** Les sept sigles fiscaux sont confirmés auprès des administrations : IFU (Bénin : identifiant fiscal unique ; Burkina Faso : identifiant financier unique), NIF (Togo, Niger, Mali), NCC (Côte d'Ivoire), NINEA (Sénégal), NIU (Cameroun). Trois listes d'opérateurs suggérés sont corrigées : Togo — Flooz (Moov Africa), TMoney (Yas), Mixx by Yas ; Niger — ajout de Zamani Cash ; Burkina Faso — ajout de Wave.
- **Espace Pro : l'entreprise choisit son pays — Bénin, Burkina Faso, Cameroun, Côte d'Ivoire, Mali, Niger, Sénégal, Togo.** Jusqu'ici, tout supposait le Togo (NIF, +228, TVA 18 %). Un sélecteur « Pays de l'entreprise » (Mon entreprise › Coordonnées) règle désormais, pour chaque pays (`src/data/pays.js`) :
  - l'**identifiant fiscal** : IFU (Bénin, Burkina Faso), NIF (Togo, Niger, Mali), NCC (Côte d'Ivoire), NINEA (Sénégal), NIU (Cameroun) — libellé du champ, exemple, et sigle imprimé sur les devis, factures (trois modèles) et fiches de dimensionnement ;
  - le **taux de TVA** des nouveaux devis et factures : 18 %, 19 % au Niger, 19,25 % au Cameroun (formulaire de facture, devis manuel, assistant, conversion devis → facture, modification des lignes) ;
  - la **devise** affichée (franc CFA BCEAO ; BEAC au Cameroun), l'**indicatif** et des exemples de numéros et de RCCM ;
  - les **opérateurs Mobile Money** du pays, proposés dans un nouveau champ « Opérateur » (libre) ; l'opérateur est imprimé comme moyen de paiement et repris dans les messages de facture et de relance (« Règlement Orange Money : … ») ;
  - l'**indicatif des numéros clients** saisis en local, pour que la relance et l'envoi WhatsApp joignent le bon pays ;
  - le **prix du kWh** par défaut de la rentabilité de la fiche (quand le lieu du chantier ne le donne pas).
  Une entreprise enregistrée avant ce réglage prend le pays de son téléphone, sinon le Togo : ses documents ne changent pas. Une alerte signale un numéro d'un autre pays que celui choisi. Les taux et prix sont des valeurs de référence, modifiables document par document. Parcours `e2e/pays-entreprise.mjs` (18 vérifications).
- **Espace Pro : la fiche de dimensionnement se télécharge depuis chaque devis.** La fiche d'un devis Pro ne se produisait que dans l'assistant, au moment de la création. Un bouton « Fiche de dimensionnement (PDF) » s'ajoute dans la fiche de tout devis issu de l'assistant (onglet Devis & Factures). La fiche obtenue est **identique** à celle de l'assistant, et non une approximation :
  - le même calcul — panneau du catalogue, onduleurs de « Mes onduleurs » (`contexteCalculPro`, commun aux deux chemins) ;
  - le même matériel — celui du calcul en proposition par kit, celui choisi à l'étape Matériel en composition pro, désormais rangé avec le devis (`materielFiche`) ;
  - la même rentabilité — les paramètres saisis dans l'assistant sont rangés avec le devis (`rentaFiche`) et repris quand on rouvre le dimensionnement ;
  - le pays du lieu est gardé avec l'étude : il fixe le tarif d'électricité par défaut (Togo ou Bénin).
  L'assistant et la liste passent par le même assemblage (`donneesFiche`). Un devis Pro hors kit antérieur à ce changement retombe sur le matériel du calcul. Nouveaux champs dans les données JSON du devis : aucun script SQL. Parcours `e2e/documents-pro.mjs` (30 vérifications, dont la comparaison champ par champ des deux fiches, en mode kit et hors kit).
- **Espace Pro : devis et factures se téléchargent et s'envoient en PDF, directement dans l'application.** Les boutons « Devis imprimable » et « Facture imprimable » ouvraient un onglet à exporter soi-même — inopérant dans l'application Android. Comme pour le devis public :
  - **téléchargement d'un toucher**, depuis la fiche du document ou par une icône sur **chaque ligne** des listes Devis et Factures ; dans l'application Android, rangé dans `Documents/BestaSolar` ;
  - **envoi sur WhatsApp avec le PDF joint** (menu de partage), message signé du nom de l'entreprise de l'abonné ; pour une facture, il rappelle le reste dû, l'échéance et le numéro Mobile Money — rien de tout cela si elle est soldée. La « Relance par WhatsApp » (message seul) reste à part ;
  - le PDF suit le **modèle du document** : celui choisi dans le formulaire de la facture, ou le dernier avec lequel le devis est parti — à défaut, celui de l'entreprise (avant, la fiche proposait toujours le modèle de l'entreprise et ignorait celui de la facture).
  La mécanique (une production à la fois, second toucher, repli sur ordinateur) est désormais commune au devis public et à l'espace Pro (`useEnvoiPdf`, `EnvoiPdfSheet`).
- **Fiche de dimensionnement : le matériel du calcul, jamais celui du kit.** Dans l'assistant Pro, en proposition par kit, la fiche reprenait l'onduleur et la batterie du kit (« Onduleur du kit … », une seule batterie à la capacité du kit). Elle donne maintenant le calibre d'onduleur et le parc batterie que le dimensionnement prescrit, comme la fiche publique : la fiche présente l'étude, le kit n'apparaît que sur le devis (`materielCalcule`). Parcours `e2e/documents-pro.mjs` (23 vérifications).
- **Espace Pro : le modèle « Sobre » remplace « Classique ».** Le troisième modèle de devis et de facture devient un document noir, blanc et gris, sans logo, qui s'imprime à l'identique en noir et blanc. Les espaces Pro gardent trois modèles — Studio, Vague, Sobre — et une entreprise ou une facture restée sur « Classique » s'ouvre d'elle-même en Sobre (sélecteurs, formulaire et document compris). Le document :
  - en-tête : nom de l'entreprise en capitales et slogan à gauche ; à droite le titre, puis en italique le numéro, la validité du devis (« Valable jusqu'au … ») ou l'échéance de la facture (« Payable au … », ou « à réception »), et la date ;
  - bloc client sur deux colonnes : Client, IFU, Adresse, Objet, Tél, Email (« — » quand l'information manque) ; Client ID, Livraison, Paiement, Devise « Franc CFA » ;
  - tableau `#` · **Cat.** · Désignation · Qté · Prix unitaire · Prix total : en-tête gris encadré, répété sur chaque page ; lignes de 40 px séparées en pointillés ; la catégorie (Panneau, Onduleur, Batterie, Protection, Structure, Câblage, Mise à la terre, Service) se déduit de l'article ;
  - cadre Conditions / Sous-total HT · TVA · TOTAL (F CFA), signature, pied de trois lignes : sur la dernière page seulement. Un seul numéro, pas de montant en toutes lettres ;
  - le dossier type (9 lignes, 1 200 000 F CFA) tient sur une page, sans débordement ni désignation coupée.
  L'aperçu en direct de « Mon entreprise » et l'annexe « Ajustements du kit » suivent la même palette. Tests : couleurs autorisées seulement, somme des lignes = total affiché, pagination à 20 lignes, colonne Cat. remplie. Parcours `e2e/modele-sobre.mjs` (17 vérifications).
- **Devis : télécharger le PDF, l'envoyer sur WhatsApp, et sa fiche de dimensionnement — directement dans l'application.** Le « Devis imprimable » ouvrait un onglet à exporter soi-même par « Imprimer », et la fiche un nouvel onglet : impossible à envoyer tel quel, et inopérant dans l'application Android. Le PDF est désormais composé dans l'app (mêmes pages A4 que le document) et :
  - **téléchargé d'un toucher**, depuis la fiche du devis ou par une icône sur **chaque ligne** de la liste ; dans l'application Android, il est rangé dans `Documents/BestaSolar` ;
  - **envoyé sur WhatsApp avec le PDF joint** : le menu de partage s'ouvre (WhatsApp, puis le client), message de présentation compris ; sur ordinateur, le PDF est téléchargé et WhatsApp s'ouvre sur la conversation du client, prête à recevoir le fichier ;
  - la **fiche de dimensionnement** se télécharge depuis un devis solaire enregistré (reconstituée depuis l'étude rangée avec lui — même contenu que dans l'assistant), et depuis les assistants public et Pro sans plus ouvrir d'onglet.
  Relecture de la fiche, deux corrections : le parc batterie n'associe plus deux modèles différents (7,55 kWh donnaient 7,5 + 2,5 kWh ; désormais 2 × 3,8 kWh, toujours des modules identiques), et une installation non amortie sur 10 ans affiche « Plus de 10 ans » au lieu de « investissement à renseigner ». Nouveaux modules Capacitor : Filesystem et Share. Nouveau parcours navigateur : `e2e/documents-devis.mjs` ; `extension-kit` et `partenaire-sur-devis` lisent désormais le document du PDF au lieu de l'onglet imprimable.
- **L'APK se télécharge depuis notre domaine : `app.bestasolar.com/telecharger`.** Le bouton de la page d'accueil ne montre plus une adresse GitHub : il pointe sur `/telecharger`, que Vercel redirige vers le dernier APK publié. C'est le lien court à partager (WhatsApp, flyers). Le fichier reste servi par GitHub — gratuit, rapide, et chaque téléchargement reste compté dans Plus › Diagnostic. Filets : si un serveur ignore la redirection (développement, cache hors-ligne), l'app fait elle-même le renvoi ; le cache hors-ligne ne l'intercepte jamais. Un test vérifie que la règle Vercel et le lien de la page restent d'accord.
- **Espace Pro : même barre d'onglets, « Devis » au centre avec son « + ».** Tableau, Clients, Devis, Entreprise, Abonnement — le « + » mène aux devis et factures. Parcours `e2e/onglet-devis-central.mjs` étendu au mode Pro.
- **Barre d'onglets mobile : « Devis » au centre, avec un « + ».** L'ordre devient Tableau, Suivi, Devis, Boutique, Plus. L'onglet Devis — l'action principale — est un « + » blanc sur une pastille bleue légèrement surélevée, sous le pouce ; actif, il s'entoure d'un anneau orange. Les libellés restent alignés, et la barre affichée pendant un chargement est la même. Dans la barre latérale (ordinateur), Devis passe aussi avant Boutique, avec son icône de document. Nouveau parcours navigateur : `e2e/onglet-devis-central.mjs`.
- **Application Android : le haut des pages ne passe plus sous la barre d'état du téléphone.** Depuis Android 15, l'application s'affiche aussi sous l'heure, le réseau et la batterie : le titre « Bonjour, … » s'y superposait. Une bande de la hauteur exacte de cette barre est désormais réservée en haut de chaque écran, de la couleur de l'en-tête — elle s'y fond — et fixe, pour que le contenu qu'on fait défiler passe dessous. Les icônes de la barre y passent en clair. Même réserve pour l'éditeur de devis plein écran, et aucune hauteur en trop sur les écrans courts. Sur le site web et les Android plus anciens, la bande vaut zéro : rien ne change. Nouveau parcours navigateur : `e2e/barre-etat.mjs`.
- **Durée d'utilisation mesurée, sur le site et dans l'application Android.** Chaque passage au premier plan envoie à PostHog un événement `temps_utilisation` à sa sortie (autre application, écran éteint, onglet changé ou fermé), avec sa durée en secondes et en minutes. C'est le temps ACTIF : un onglet resté ouvert sans un geste ne compte que 5 minutes par silence, pas la journée. Les allers-retours de moins de 30 minutes (passer sur WhatsApp envoyer un devis, revenir) restent dans la même session : chaque événement porte désormais un `$session_id`, d'où PostHog tire le nombre et la durée des sessions. Si Android tue l'application sans prévenir, la période en cours — recopiée sur l'appareil toutes les 30 s — est comptée à l'ouverture suivante, datée de sa vraie fin. Aucune donnée client : des durées et un identifiant tiré au hasard. Nouveau parcours navigateur : `e2e/temps-utilisation.mjs`.

## 2026-10-08
- **Synchronisation : plus d'éléments bloqués « en attente d'envoi ».** Depuis la recomplétion des kits reçus (extension batterie, tension), chaque réception rendait les kits « modifiés ici » : ils partaient en file d'envoi, et un compte non gérant — à qui le serveur refuse d'écrire les kits — les gardait en attente pour toujours (jusqu'à 60 éléments affichés dans « Plus »). Les kits sont désormais recomplétés DANS la réception, qui devient la référence « déjà sur le serveur ». Et un élément en attente identique, champ pour champ, à la version reçue n'attend plus rien : les files déjà bloquées sur les téléphones se libèrent à la réception suivante.
- **Analytique de l'application Android.** Chaque événement envoyé à PostHog porte la plateforme (web ou android) et le numéro de build de l'APK ; avant connexion, il est rattaché à un identifiant ANONYME de l'appareil (tiré au hasard, ni nom ni numéro) au lieu de « anonyme » pour tous. Trois nouveaux événements : `app_installee` (première ouverture de l'app sur un téléphone), `app_mise_a_jour` (avec le build d'origine) et `app_ouverte` (chaque lancement). Plus › Diagnostic (gérant) affiche la plateforme de l'appareil et le total des téléchargements de l'APK (compteurs GitHub, toutes versions). Les anciennes Releases ne sont plus supprimées par le workflow : leurs compteurs comptent dans ce total. Nouveau parcours navigateur : `e2e/analytique-application.mjs`.
- **Sauvegarde nocturne : deux versions écrites en parallèle, une seule retenue.** Deux agents ont implémenté la même tâche le même jour, sous les mêmes trois noms de fichiers (`.github/workflows/sauvegarde-quotidienne.yml`, `SAUVEGARDE.md`, `scripts/sauvegarde-supabase.mjs`) : l'une sur la branche de travail, l'autre poussée directement sur `main`. Elles ne pouvaient pas coexister. Sur décision du gérant, c'est la version de la branche qui est retenue, pour deux raisons mesurables : son fichier se restaure par le bouton existant de l'app (`isValidBackup` exige `app` et `data` ; l'autre produisait `format` et `tables` gzippés, que ce contrôle refuse — il aurait fallu un outil le jour où la sauvegarde servirait), et elle est couverte par des tests dont un compare la liste des tables à `SYNCED_COLLECTIONS`, de sorte qu'une collection ajoutée à la réplication et oubliée dans la sauvegarde fasse échouer la suite. La version remplacée avait deux bonnes idées qu'il faut lui reconnaître — pagination des lectures et empreinte sha256 ; la pagination existe aussi dans la version retenue, avec en plus un recoupement du nombre de lignes contre le compte exact annoncé par la base. Elle portait en revanche une étape `upload-artifact` qui déposait la base complète en artefact de l'exécution : sur un dépôt public comme `Bestaapp`, un artefact se télécharge **sans authentification**, ce qui aurait publié chaque nuit les noms, téléphones, adresses, devis et factures des clients. Cette tâche n'avait encore jamais tourné (aucune exécution, aucun artefact produit) : rien n'a fuité.
- Parcours de bout en bout : la fiche client cherchait encore une ligne de liste (`.client-list-row`) et un panneau, alors que l'écran Clients affiche désormais des cartes ouvrant une page `/clients/:id` à onglets — le parcours bloquait la suite entière. Il désigne maintenant la carte puis l'onglet Contact, et vérifie la **règle** (la ligne « Contact » n'existe que pour une entreprise, où elle nomme quelqu'un d'autre que le client) au lieu de compter les apparitions du nom à l'écran, qui changent à chaque refonte. Les 35 parcours du dossier `e2e/` ont été joués un par un : les 4 restés rouges le sont par manque de leur **environnement**, écrit dans leur propre en-tête (Supabase simulé pour `connexion-rapide`, `pages-legales` et `suppression-compte`, build servi sur le port 4173 pour `demarrage-rapide`) — tous verts une fois cet environnement fourni, aucune régression de l'app
- Parcours de bout en bout : la demande de paiement cherchait un champ par l'indicatif « +229 », devenu « +228 » à la togolisation — la suite s'arrêtait là, et les six parcours suivants n'étaient plus joués
- **Sauvegarde automatique de la base, chaque nuit, sans personne devant l'écran.** La seule sauvegarde existante était manuelle (`Plus › Sauvegarde des données`) : elle ne partait que si le gérant y pensait, et le fichier restait sur son téléphone. Une tâche planifiée GitHub exporte désormais la base de production chaque nuit à 02h17 (heure de Lomé) dans un dépôt **privé** dédié, en gardant **7 jours glissants** — la sauvegarde du jour est ajoutée, la huitième plus ancienne est supprimée. Le fichier produit a exactement la forme de l'export manuel : il se restaure par le bouton existant, sans outil à installer. Le dépôt des sauvegardes est séparé et privé parce que `Bestaapp` est public : une branche de ce dépôt (ou un artefact de tâche, téléchargeable par n'importe qui sur un dépôt public) aurait publié chaque nuit les noms, téléphones, adresses, devis et factures des clients. Sont sauvegardées les 19 collections répliquées **et** les tables qui n'existent que côté serveur (`orgs`, `profiles`, `codes_promo`, `codes_promo_utilisations`, `paiements_verifies`, `tombstones`), sans lesquelles une base reconstruite n'aurait plus ni entreprises ni équipe ; volontairement exclus, les jetons OAuth Google Contacts (un secret n'a rien à faire dans une sauvegarde qu'on recopie) et le journal d'erreurs. Deux garde-fous : une table illisible (réseau, clé refusée) fait échouer toute la tâche plutôt que de déposer un fichier incomplet qu'on croirait valide le jour où on en aurait besoin, et le nombre de lignes ramenées est comparé au compte exact annoncé par la base ; une table simplement absente du projet (script SQL pas encore passé) est consignée dans le fichier et n'empêche pas le reste. La purge n'intervient qu'après l'écriture réussie de la nouvelle sauvegarde, et ne touche jamais un fichier qui n'est pas une sauvegarde. Un `DERNIERE-SAUVEGARDE.md` déposé à côté donne la date et le nombre de lignes par table, pour voir d'un coup d'œil si la tâche tourne encore. Mise en route (dépôt privé à créer, jeton et trois secrets à renseigner), vérification et procédure de restauration : `SAUVEGARDE.md`.

## 2026-10-07
- **APK Android réellement identifié comme production.** Le build GitHub Actions
  reconnaît désormais le commit et la branche `main`, comme le build Vercel :
  l'écran de connexion n'affiche plus `version dev · test`. La configuration
  Google OAuth est transmise explicitement à l'APK et le workflow refuse de
  publier une Release si Supabase ou le Client ID Google manquent.
- **Application Android téléchargeable depuis la page d'accueil (APK, sans Play Store), avec mises à jour.** Le workflow « Build Android APK » ne produisait qu'un artefact GitHub (compte requis, expiré au bout de 30 jours, signé par une clé de débogage neuve à chaque build — Android aurait refusé toute mise à jour). À chaque mise en production, il publie désormais l'APK dans une Release GitHub du dépôt public, sous un nom fixe (`BestaSolar.apk`), avec un numéro de build croissant (versionCode et `VITE_ANDROID_BUILD`) ; signé avec la clé permanente (secrets `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`), sinon avec une clé de débogage et un avertissement. Les 5 dernières Releases sont gardées. Page d'accueil : section « BestaSolar Pro sur Android » (logo Android, pas de badge Play Store), bouton de téléchargement direct vers la dernière Release, version / taille / date lues sur GitHub, installation en trois étapes, lien « Application » dans le menu. Dans l'application installée : bandeau « Nouvelle version disponible — Mettre à jour » dès qu'une Release plus récente existe (vérifié à l'ouverture et à chaque retour dans l'app). Nouveau parcours navigateur : `e2e/application-android.mjs`.
- **Statut de synchronisation réservé au gérant.** Dans « Plus » (sous la carte « Passer en mode Pro ») et dans les paramètres, la ligne « Données partagées en temps réel », le nombre d'éléments en attente d'envoi et le bouton « Synchroniser maintenant » ne s'affichent plus que pour les gérants. Nouveau parcours navigateur : `e2e/synchro-gerant.mjs`.
- **Écran fixe en largeur sur mobile, cinq onglets toujours visibles.** Sur le tableau de bord, le graphique « Catalogue par catégorie » était plus large que l'écran (ses libellés ne rétrécissaient pas) : toute la page s'élargissait, glissait à gauche et à droite, et l'onglet « Tableau » sortait de l'écran. Même chose sur la boutique en 360 px (liste de tri). Libellés du graphique coupés proprement (nom complet dans l'info-bulle), liste de tri rétrécissable, et garde-fou général : la page ne peut plus défiler horizontalement (`overflow-x: clip`), les zones prévues pour défiler (suivi en colonnes, puces) gardent leur défilement. Nouveau parcours navigateur : `e2e/largeur-mobile.mjs`.
- **Chargement à la forme de chaque page.** Au rafraîchissement, le squelette affiché avait toujours la forme du tableau de bord (quatre pastilles et un graphique), quelle que soit la page — y compris sur la page d'accueil publique. Il prend maintenant la forme de LA page rechargée (utils/squelette.js) : colonnes du suivi, cartes clients, grille de la boutique, liste des devis, menu « Plus », sous-pages, formulaires Pro ; avec le vrai titre de la page quand il est fixe, la rangée d'actions de l'en-tête réservée, et la vraie barre d'onglets, onglet de la page allumé. La page d'accueil a un squelette de vitrine, la connexion un formulaire. Même squelette pendant le chargement d'un écran en cours de navigation. Les onglets vivent désormais dans components/navigation.js, partagés par la mise en page et l'écran de chargement. Nouveau parcours navigateur : `e2e/squelette-chargement.mjs`.
- **Onduleur sans tension batterie = haute tension (HV).** Règle du gérant : un onduleur de « Mes onduleurs » dont la tension batterie n'est ni saisie ni écrite dans sa désignation est un onduleur HV. Il n'est plus jamais proposé pour un kit 12, 24 ou 48 V (avant, une tension inconnue « ne bloquait rien », et la règle du moins cher pouvait le faire retenir), et seuls ces onduleurs sont candidats pour un kit HV. Le formulaire indique « Non renseignée — haute tension (HV) » et la liste affiche « haute tension (HV) ».
- **Réseau reconnu d'après l'onduleur du kit.** Le choix « Réseau électrique » se règle tout seul sur le kit retenu : « Triphasé » pour un kit dont l'onduleur est triphasé (réglage « Phases » de « Mes onduleurs », désignation « triphasé »/PCS/« P3 », kits HV), « Monophasé » sinon — à chaque changement de kit, dans l'assistant et dans l'espace Pro. Le technicien peut ensuite le modifier ; un devis rouvert garde son choix enregistré.
- **Onduleur : la solution la moins chère, et jamais de remplacement sur un kit de base.** Règle du gérant (« le prix est très important ») : quand l'onduleur du kit seul ne prend pas les panneaux ajoutés, toutes les solutions — le même en parallèle, un autre modèle seul ou en parallèle — sont essayées de la MOINS CHÈRE à la plus chère (prix × nombre d'appareils) ; un 16 kW seul passe devant deux 12 kW s'il coûte moins. Un modèle sans tension max ni MPPT renseignés reste écarté quand des panneaux sont ajoutés (configuration invérifiable). Kit posé tel quel (aucun panneau ajouté) : son onduleur n'est jamais remplacé — auparavant, un onduleur de kit sans fiche électrique pouvait l'être sur une puissance PV estimée au panneau de référence. Seul le triphasé demandé le fait encore changer.
- **Réseau monophasé ou triphasé.** Nouveau choix « Réseau électrique : Monophasé / Triphasé » à côté du type de support, dans l'assistant de devis et dans l'espace Pro (monophasé par défaut : rien ne change). En triphasé, l'onduleur du kit est gardé s'il est déjà triphasé (réglage « Phases » de Plus › Onduleurs, désignation « triphasé », onduleur PCS ou suffixe Deye « P3 », kits HV) ; sinon il est remplacé par le plus petit onduleur triphasé de « Mes onduleurs », de même tension batterie et de puissance au moins égale, qui prend les panneaux — avec, si besoin, les panneaux supplémentaires qu'exige sa tension de démarrage MPPT (Kit 5 kWh Deye : Deye 12 kVA, 6 panneaux au moins). Aucun triphasé de la bonne tension : l'onduleur du kit reste et l'assistant le signale. Le choix est enregistré avec l'étude et repris à la réouverture du devis. Correctif au passage : « Triphasé » choisi seul dans le formulaire d'un onduleur se perdait faute d'autre valeur électrique. Nouveau parcours navigateur : `e2e/triphase.mjs`.

## 2026-10-06
- **Espace Pro : les onduleurs viennent de « Mes onduleurs », plus de la boutique.** Le parcours « kit » prenait déjà les onduleurs configurés (Plus › Onduleurs), mais le dimensionnement et la « Composition pro » de l'assistant Pro tiraient leurs onduleurs des produits de la boutique — marques, modèles et prix différents de ceux que l'entreprise a réglés. Ils utilisent désormais la même source que les kits (modèle, marque, prix, limites PV). Les batteries de la composition pro restent celles de la boutique. Un article boutique peut toujours être ajouté à la main au devis. Nouveau parcours navigateur : `e2e/onduleurs-mes-onduleurs.mjs`.
- **Panneaux du dimensionnement, même sous ceux du kit.** Règle du gérant : un devis de kit pose TOUJOURS le nombre de panneaux dimensionné — au-dessus du kit (déjà le cas) comme en dessous (avant, le kit n'était jamais réduit). Sous le kit, la ligne des panneaux et la structure suivent, mais la main-d'œuvre du kit de base est GARDÉE (règle du gérant : elle ne baisse jamais ; elle n'augmente que des suppléments panneaux et batterie ajoutés) ; la section « Ajustements du kit » et l'annexe imprimée l'affichent (« −3 en moins »). Garde-fou : jamais moins qu'une chaîne valide sur l'onduleur du kit (tension MPPT minimale), quand ses caractéristiques sont connues. Exemple : Kit 16 kWh pour un besoin de 7 panneaux → 7 panneaux, 219 000 F de moins (panneaux et structure). Parcours navigateur mis à jour : ceux qui gonflaient un kit à 20 panneaux dans « Mes kits » pour forcer le cas « onduleur insuffisant » partent désormais d'un vrai besoin de jour.
- **Kit 60 kWh étendu jusqu'à 120 kWh, même avec les kits reçus du serveur.** Règle du gérant : sous 120 kWh, le kit 60 kWh reçoit les modules de 12 kWh nécessaires ; le 128 kWh n'est proposé qu'au-delà. Le calcul le faisait déjà, mais les kits sont une table PARTAGÉE dont la copie reçue de Supabase remplace la copie locale : une copie enregistrée avant la règle des modules n'avait pas le champ d'extension, et le 128 kWh était alors proposé dès 61 kWh. Les champs de référence des kits officiels (extension batterie, tension) sont désormais recomplétés à chaque réception, comme au chargement — une valeur présente n'est jamais écrasée.
- **Onduleur du kit gardé tant qu'il prend les panneaux.** Règle du gérant, sur tous les kits : l'onduleur d'un kit n'est changé QUE s'il ne peut pas recevoir les panneaux à poser (puissance PV admise, chaînes, MPPT). Il est alors d'abord mis en parallèle avec un second identique ; un modèle plus grand n'est proposé que si le parallèle ne suffit pas (ou n'est pas autorisé pour ce modèle). Avant, deux causes faisaient monter à tort à un onduleur plus gros : le pic de consommation — remplacé par la puissance des panneaux quand aucun appareil n'est saisi, ce qui faisait passer le Kit 16 kWh à 12 kVA avec ses propres 10 panneaux — et un ordre d'essai qui plaçait un modèle plus grand avant le parallèle (Kit 20 kWh, 14 panneaux : 12 kVA au lieu de 2 × 6 kVA). Un pic d'appareils au-delà de la sortie de l'onduleur gardé est désormais SIGNALÉ dans l'assistant (et à l'agent devis), sans changer l'onduleur. Le dimensionnement libre (sans kit) n'est pas modifié.

## 2026-10-05
- **Agent devis visible sur ordinateur.** Sur grand écran, la barre latérale remplace le menu « Plus » : l'agent n'y figurait pas et restait donc introuvable. Il y est ajouté, sous « Onduleurs », pour les gérants.
- **Agent devis (prototype).** Dans « Plus › Agent devis », le gérant converse avec un agent Claude comme le ferait un client sur WhatsApp : l'agent pose les questions (appareils, ville, toiture), dimensionne et chiffre avec les kits, onduleurs et prix de l'entreprise — les calculs sont ceux de l'assistant de devis, exécutés dans l'app — puis prépare le devis. Rien n'est enregistré sans le clic du gérant : piste et devis sont créés en brouillon. La clé Claude reste sur le serveur (variable ANTHROPIC_API_KEY sur Vercel), l'accès est réservé aux gérants connectés et plafonné. Étape suivante : le brancher sur WhatsApp
- **Onduleurs : tension max et nombre de MPPT en avant dans la configuration.** Dans « Plus › Onduleurs », la tension DC max et le nombre de MPPT se saisissent juste sous la puissance PV max ; la plage MPPT, les chaînes par MPPT et les courants passent dans un bloc « Détails (facultatif) ». Ces deux valeurs suffisent désormais à calculer les chaînes d'un kit étendu : aucune chaîne ne dépasse la tension max, même par temps froid (la plage MPPT, si elle manque, est signalée). La liste indique les onduleurs « à compléter »
- **Suppléments de main-d'œuvre fondus dans la ligne « Main d'œuvre ».** Le devis d'un kit étendu ne montre plus de lignes « supplément panneaux » ou « supplément batterie » : leur montant s'ajoute à la ligne « Main d'œuvre » du kit, qui porte le total final. Le détail (base, panneaux, batterie, coefficient Togo) reste lisible dans la section « Ajustements du kit » et l'annexe du devis imprimé
- **Main-d'œuvre d'un kit étendu : 3 500 F par kWh de batterie ajouté, pas par kWc.** Correction du gérant : le second supplément se compte sur la batterie ajoutée (modules d'un kit extensible), plus sur la puissance des panneaux. La main-d'œuvre vaut donc celle du kit + 10 000 F par panneau ajouté + 3 500 F par kWh de batterie ajouté — et le supplément batterie s'applique aussi quand seuls des modules sont ajoutés, sans panneau. Exemple : kit 60 kWh porté à 84 kWh → +84 000 F. Section « Ajustements du kit » et annexe imprimée affichent la batterie de base et la batterie finale
- **Kit étendu : ajustements explicites et vérifiés.** Quand une proposition exige plus de panneaux que le kit n'en compte, le devis affiche une section « Ajustements du kit » : panneaux du kit, demandés et ajoutés (et les kWc) ; chaînes solaires calculées dans les limites électriques de l'onduleur (tension DC max à froid, plage MPPT à chaud, courant par entrée), équilibrées d'abord ; onduleur conservé, remplacé par un modèle compatible, ou doublé — avec la raison technique ; câbles, connecteurs, fusibles, sectionneurs, parafoudres, coffret de jonction et protection AC ajoutés pour chaque chaîne ou entrée MPPT supplémentaire, au prix du kit quand il porte déjà l'article ; main-d'œuvre du kit + 10 000 F par panneau ajouté + 3 500 F par kWc ajouté, détaillée ligne par ligne ; impact sur le prix total, poste par poste. La même section figure dans l'espace Pro, et en annexe du devis imprimé. Une configuration qu'aucun onduleur ne peut accepter est signalée et le devis ne peut pas être finalisé. Les caractéristiques électriques des onduleurs se saisissent dans « Plus › Onduleurs » (renseignées pour les Deye 6 et 12 kVA)
- **Correctif de prix : un sectionneur DC par kit, pas un par panneau.** La ligne « Disjoncteur/sectionneur DC panneaux » était prise pour la ligne des panneaux : sa quantité suivait leur nombre. Les kits 5 kWh Deye, 10 kWh Taico et 25 kWh Felicity étaient surfacturés de 24 000, 56 000 et 112 000 F ; ils reviennent à la somme exacte de leurs lignes (1 429 000, 2 063 000 et 4 203 000 F)
- **Le kit 208 kWh reçoit lui aussi des modules, jusqu'à 256 kWh.** Au-delà de 192 kWh, l'assistant propose le kit 208 kWh Deye et lui ajoute des modules de 16 kWh (1 375 000 F pièce) juste ce qu'il faut : 224, 240 puis 256 kWh (16 modules, le maximum du boîtier B-PRO). Pour un besoin plus grand encore, le kit est porté à 256 kWh. Un seul boîtier de contrôle dans tous les cas (GB-W : 10 modules, B-PRO : 16)

## 2026-10-04
- **Le kit 128 kWh reçoit lui aussi des modules, jusqu'à 200 kWh.** Au-delà de 128 kWh, l'assistant garde le kit 128 kWh Deye et ajoute des modules de 16 kWh (1 375 000 F pièce) juste ce qu'il faut : 144, 160, 176 puis 192 kWh (12 modules, le maximum en modules entiers sous 200 kWh). Au-delà, le kit 208 kWh est proposé
- **Nouveau kit 208 kWh Deye haute tension (125 kW).** Pour les installations commerciales et industrielles : treize batteries Deye B-PRO de 16 kWh avec leur boîtier de contrôle, un convertisseur de puissance (PCS) Deye 125 kW, un module de charge MPPT 200 kW, un commutateur de transfert statique 500 kW et 175 panneaux Jinko bifaciaux de 620 Wc : 50 055 000 F CFA, au franc près le devis n° 254. Proposé par l'assistant au-delà de 128 kWh ; même main d'œuvre (2 500 000 F) au Togo et au Bénin
- **Entre 60 et 120 kWh : le kit 60 kWh reçoit des modules de batterie.** Pour un besoin au-delà de 60 kWh, l'assistant ne saute plus au kit 128 kWh : il garde le kit 60 kWh Deye et ajoute des modules de 12 kWh (1 245 000 F pièce) juste ce qu'il faut, jusqu'à 120 kWh (10 modules). Au-delà de 120 kWh, le kit 128 kWh est proposé. Le récapitulatif l'indique (« batterie 96 kWh, étendue depuis 60 ») et le devis porte la capacité réellement posée
- **Nouveau kit 128 kWh Deye haute tension (triphasé).** Huit batteries Deye B-PRO de 16 kWh avec leur boîtier de contrôle, un onduleur hybride Deye 50 kW (SUN-50K-SG01HP3), 100 panneaux Jinko bifaciaux de 620 Wc et tout le câblage : 28 110 000 F CFA, au franc près le devis d'origine. Comme le 60 kWh : proposé par l'assistant pour les très gros besoins, onduleur 50 kW toujours conservé, et même main d'œuvre (1 500 000 F) au Togo et au Bénin
- **Kits haute tension : même main d'œuvre au Togo et au Bénin.** La main d'œuvre des kits est doublée pour un chantier togolais ; les kits à batterie haute tension (HV) font exception et gardent le même tarif des deux côtés de la frontière — le kit 60 kWh Deye reste à 15 044 000 F CFA au Togo comme au Bénin. La règle vaut aussi pour un kit HV créé dans « Mes kits » : il suffit que sa ligne batterie mentionne « HV »
- **Nouveau kit 60 kWh Deye haute tension (triphasé).** Cinq batteries Deye GB-W de 12 kWh avec leur boîtier de contrôle et leur socle, un onduleur hybride Deye 30 kW (SUN-30K-SG02HP3), 42 panneaux Jinko bifaciaux de 620 Wc et tout le câblage : 15 044 000 F CFA, au franc près le devis d'origine. Il apparaît tout seul dans « Mes kits » et dans l'assistant de devis, y compris sur les appareils déjà utilisés. Sa batterie haute tension n'entre pas dans les choix 12 / 24 / 48 V : l'assistant garde toujours son onduleur 30 kW et ne lui substitue jamais un modèle basse tension

## 2026-10-03
- **Le code partenaire figure de nouveau sur les devis, en pied de page.** Depuis le passage aux nouveaux modèles de document, l'apporteur était bien enregistré sur le devis mais n'était plus imprimé. Chaque page porte désormais « Réf. partenaire : CODE », discrètement, juste au-dessus du pied. Le code imprimé est celui figé à la création du devis : il reste juste si le partenaire est renommé, et s'imprime même quand sa fiche n'est pas sur l'appareil. Aucune page ne déborde (mesuré sur les trois modèles, d'une à trois pages). Jamais de partenaire BestaSolar sur un devis Pro

## 2026-09-25
- **Onduleurs en parallèle : réglés modèle par modèle.** Dans « Plus › Onduleurs », chaque onduleur indique s'il se couple en parallèle et jusqu'à combien d'appareils (2 à 12, selon la fiche du fabricant). L'assistant de devis respecte ce réglage : un seul appareil tant que possible, puis 2, 3… jusqu'au maximum du modèle ; un onduleur « non couplable » n'est jamais doublé. La liste l'affiche (« parallèle ×4 max », « sans parallèle »). Les onduleurs non encore réglés gardent l'ancienne règle de deux au plus
- **Onduleur toujours de la tension de la batterie du kit (12, 24 ou 48 V).** L'assistant de devis pouvait remplacer l'onduleur 3 kVA d'un kit 24 V par un 6 kVA 48 V, qui ne démarre pas sur cette batterie. Il ne propose désormais que des onduleurs de la même tension ; si aucun ne suffit, même à deux, il l'annonce au lieu de glisser un modèle incompatible. La tension se saisit dans « Plus › Onduleurs » et « Plus › Mes kits » et s'affiche dans les listes ; les kits et onduleurs officiels déjà enregistrés la reçoivent automatiquement
- **Devis et factures au nom de BESTA SOLAR TOGO** : RCCM TG-LFW-01-2025-A10-01086, NIF 1002023475, Adidoadin (Lomé), et les deux numéros — Togo et Bénin — imprimés côte à côte sans jamais couper un numéro. Logo BestaSolar Pro sur les devis, les factures, la fiche de dimensionnement et désormais les relevés de commissions ; « NIF » au lieu de « IFU » sur la fiche
- **L'app s'ouvre et se connecte plus vite.** Le script de paiement KKiaPay, placé dans la page d'accueil, bloquait le démarrage de toute l'app le temps que son serveur réponde — à chaque ouverture, même sans payer (mesuré : 3,4 s → 0,15 s avec un serveur KKiaPay lent). Il n'est plus chargé qu'avec le bouton de paiement. La police Inter ne bloque plus l'affichage. À la connexion, profil et entreprise se lisent en même temps : un aller-retour réseau de moins

## 2026-09-24
- **Script de réparation des clients : il teste pour de vrai.** Il concluait « Réparé » d'après le rôle du compte — donc toujours pour un admin plateforme, même quand la base refusait encore. Il rejoue désormais les envois de l'app sous le compte concerné, dans une transaction annulée (rien n'est modifié), et nomme la règle ou le client qui bloque
- **Politique de confidentialité réécrite et conditions d'utilisation créées**, au nom de l'éditeur BESTA SOLAR TOGO (RCCM TG-LFW-01-2025-A10-01086, Adidoadin, Lomé). L'ancienne politique décrivait un outil interne sans serveur ni traceur, à Parakou : elle détaille désormais les données réellement traitées, les prestataires (Supabase, KKiaPay, Google, PostHog, Sentry…), les durées de conservation et les droits selon la loi togolaise. Les deux textes sont accessibles depuis la connexion, l'inscription (phrase d'acceptation), les paramètres et le pied de la page d'accueil — exigence de Google Play et de l'App Store
- **Date d'émission du devis modifiable** : dans l'éditeur (« Éditer »), un devis peut porter la date de la visite plutôt que celle de sa saisie. Elle est imprimée sur le document, fait courir la validité de 30 jours et les relances, et s'affiche dans les listes ; le numéro du devis et l'activité du tableau de bord ne bougent pas. Pas de date dans le futur
- **Supprimer mon compte** (Plus › Paramètres › Profil), exigé par Google Play et l'App Store : confirmation en tapant SUPPRIMER, le compte part — et toute l'entreprise s'il y travaille seul ; en équipe, le travail reste aux collègues. L'appareil est nettoyé, session comprise. Page publique `suppression-compte.html` pour la fiche Play Store. Nécessite `supabase/suppression-compte.sql` dans les deux projets
- **App Android / iOS** : « Ma position » fonctionne dans l'app installée (permission de localisation déclarée, texte d'autorisation iOS) ; le numéro de version se déduit de package.json (1.1.0 → 10100), le deuxième envoi au Play Store n'est plus bloqué ; l'app des stores embarque enfin Sentry et PostHog
- **Plus aucun paiement de test visible des clients** : tant que KKiaPay est en mode test, le bouton de paiement en ligne, les numéros de test et la mention « (test) » disparaissent — seul l'administrateur de l'encaissement est prévenu. Le paiement Mobile Money manuel reste proposé, et la boutique ne promet plus un règlement en ligne qui n'est pas ouvert

## 2026-09-22
- **Essai gratuit de l'espace Pro par code** : dans « Passer en mode Pro », un code ouvre 30 jours d'espace Pro sans paiement. Le gérant crée ses codes (durée, plafond d'utilisations, date limite) et les désactive depuis « Abonnements Devis Pro ». Le serveur juge chaque code — impossible de s'offrir le Pro depuis le navigateur — et un compte n'utilise un même code qu'une fois. Nécessite `supabase/codes-promo.sql` dans les deux projets Supabase
- Onduleur : un seul appareil tant qu'un modèle suffit — le kit 32 kWh recevait deux 6 kVA là où un seul 12 kVA convient

## 2026-09-11
- Kit **48 kWh** (3 × 16, 24 panneaux, onduleur 12 kVA) ajouté au catalogue officiel — 7 198 700 F CFA

## 2026-08-29
- **Connexion Google Contacts** : les deux fonctions serveur ne pouvaient pas fonctionner — quatre expressions régulières portaient un antislash de trop. L'une d'elles rendait le fichier impossible à compiler, donc à déployer ; une autre empêchait la lecture du jeton de session, d'où le `400` renvoyé à chaque tentative. Corrigées, avec le guide d'installation pas à pas qui va avec (`supabase/INSTALLATION_GOOGLE_CONTACTS.md`)
- **« Se connecter » ouvre la connexion**, même sur un appareil ayant suivi un lien de parrainage. L'attribution vit trente jours et détournait la route vers l'inscription pendant tout ce temps — invisible sur un navigateur neuf, systématique sur celui d'un visiteur réel
- **Page publique d'accueil** : un visiteur non connecté arrive sur la vitrine et non sur le formulaire — promesse, aperçu du tableau de bord, les quatre étapes du conseiller, les schémas des quatre architectures (hybride, secours, site isolé, pompage), les avantages, les formules, les parcours partenaires, les témoignages et la FAQ. Bouton « Se connecter » pour qui a déjà un compte ; un lien de parrainage continue d'ouvrir l'inscription directement
- Schémas de principe : sur téléphone, ils gardent la géométrie du grand écran — source à gauche, onduleur au centre, charge à droite — au lieu de défiler hors cadre, où l'on ne voyait que le premier bloc
- **Abonnement pris dès l'inscription** : choisir « Pro Confort » ou « Pro Premium » sur la page d'accueil mène au paiement de CETTE formule, une fois le compte créé. Trois formules réelles (5 000 F/mois, 12 750 F/3 mois, 45 000 F/an), lues par le navigateur ET par le serveur : celui-ci exige le tarif de la formule et crédite sa durée, jamais ce que la requête annonce
- Le revenu mensuel de l'écran d'administration compte chaque abonnement pour ce qu'il rapporte par mois : un abonné annuel pèse 3 750 F, plus 5 000
- **Connexion Google** : l'inscription d'un nouvel arrivant ne se perd plus. Google renvoie sur la racine du site, devenue la vitrine ; le formulaire « complétez votre profil » passe désormais avant elle. La configuration nécessaire (fournisseur Supabase, URI de rappel Google Cloud, `VITE_ENABLE_GOOGLE_AUTH`) est enfin documentée
- **Google Contacts** : les partenaires se synchronisent vers un compte Google de l'entreprise, avec reprise automatique des envois en attente et détection des doublons de téléphone (nécessite la migration et les Edge Functions — voir `supabase/GOOGLE_CONTACTS.md`)
- **Quatre kits solaires d'août 2026** (5 kWh Deye, 10 kWh Taico, 25 kWh Felicity et le 3,8 kWh), catalogue trié par capacité de batterie ; l'assistant propose toutes les variantes d'une même capacité et laisse choisir, et les capacités décimales sont acceptées
- Dimensionnement de pompe : annoncé comme « bientôt disponible » plutôt que de laisser une carte muette

## 2026-08-24
- Nouveaux utilisateurs : mini-guide d’accueil en trois étapes avec flèches vers le suivi clients, les devis et les formations ; responsive PC/mobile, il ne s’affiche qu’après la création réelle du profil et ne revient plus après « Passer » ou « Terminer »

## 2026-08-22
- **Sécurité** : audit complet et correctifs —
  - plafond de requêtes sur les cinq points d'entrée API (10/min pour la vérification de paiement, 20 pour le journal d'erreurs ouvert, 60 pour le webhook, 30 et 20 pour les relais solaire et YouTube), avec `Retry-After` et en-têtes `X-RateLimit-*` ;
  - plus aucun détail technique dans les réponses d'erreur : message générique au client, cause exacte (exception, message Postgres, réponse de l'agrégateur, noms de variables d'environnement) au journal serveur ;
  - journal de sécurité horodaté et attribué (IP réelle, méthode, chemin) pour les plafonds atteints, les authentifications refusées et les erreurs 4xx/5xx ;
  - `.gitignore` durci : `.env.local` — le nom que la documentation du projet demande de créer — n'était pas ignoré, pas plus que les clés, certificats et jetons de déploiement ;
  - `supabase/verification-securite.sql` : quatre requêtes à passer après chaque déploiement SQL pour vérifier que la base est bien à jour (RLS, policies ouvertes de l'ancien schéma mono-équipe, fonctions `security definer`) ;
  - `SECURITE.md` : posture complète, y compris les limites assumées.
- Simulateur ROI : le **prix du kWh se choisit par pays de l'UEMOA** (les huit, avec leur opérateur — SBEE, SONABEL, CIE, EAGB, EDM, NIGELEC, Senelec, CEET), **Bénin par défaut** ; le curseur reste ajustable et l'écart au tarif indicatif est signalé
- Simulateur ROI : l'estimation par facture retient désormais **toujours 60 % la nuit et 40 % en journée** — une facture ne dit pas quand le client consomme, et c'est la part nocturne qui dimensionne la batterie. Le mode « appareils » garde, lui, les heures réelles de chaque appareil
- Simulateur ROI : la consommation s'estime au choix **d'après les appareils** ou **d'après la facture** du client (avec la répartition jour / nuit), et la **durée de vie retenue** se règle — 10, 15 ou 25 ans. L'estimation par facture annualise sur douze factures réelles : sans coupure, la ligne « Réseau CEET » vaut exactement douze fois ce que le client paie — c'est le seul chiffre qu'il a sous les yeux
- **Simulateur ROI** : nouvel écran (barre latérale et menu « Plus », ouvert à toute l'équipe), bâti sur ce que l'app sait déjà calculer. À gauche les saisies : les appareils du client (le catalogue de l'assistant de devis — lampes, réfrigérateur, ventilateurs…), les coupures et les prix, puis le kit que l'assistant proposerait pour cette consommation, au prix du catalogue de l'entreprise — ou le montant d'un devis déjà émis, avec son étude reprise en un clic. À droite les résultats : remboursement, économie de la 1re année, gain sur 25 ans, CO₂ évité, la décomposition du coût actuel et la projection tracée. Aucun réglage abstrait (ni « taux de couverture », ni consommation du groupe en litres/heure) : les litres de gazole se déduisent des kWh, et l'écran met les deux prix du kWh face à face — réseau contre groupe. Un projet qui ne se rembourse pas est annoncé comme tel, et les hypothèses de calcul restent consultables
- Barre latérale : la cloche de notifications rejoint le coin de l'app, à côté du logo (elle ne double plus le bandeau de chaque page sur grand écran ; sur mobile, où il n'y a pas de barre latérale, elle y reste)
- Barre latérale : fléchette de repli — le menu se réduit à un rail d'icônes (264 → 76 px) et le contenu récupère la place ; libellés en infobulle, cloche, voyant de synchronisation et déconnexion restent accessibles, et le choix est conservé d'un écran à l'autre
- **Mode hors-ligne** : l'app s'ouvre et reste utilisable sans réseau, et tout remonte seul au retour de la connexion
  - la session est restaurée depuis le profil mémorisé sur l'appareil — sans réseau, l'app renvoyait l'utilisateur à l'écran de connexion, qu'il ne pouvait pas franchir non plus (ouverture : 7,4 s → 0,2 s)
  - une modification faite hors-ligne (étape d'un client, prix d'un kit, statut d'un devis) survit au relancement : une file d'attente persistante la fait primer sur la copie du serveur, plus ancienne
  - une app lancée sans serveur se reconnecte toute seule dès son retour (reprise à délai croissant, immédiate au retour du réseau ou de l'app) — avant, il fallait recharger la page
  - le voyant distingue « Hors ligne — le travail est enregistré ici » d'un vrai refus du serveur, annonce le nombre d'éléments en attente et propose « Synchroniser maintenant »

## 2026-08-21
- Kits : nouveau **Kit 16 kWh** (batterie Beve 16 kWh, 10 × 590 Wc, onduleur Beve 6 kVA, 14 lignes, 2 319 000 F hors structure) — les kits officiels ajoutés par une mise à jour rejoignent désormais les installations existantes, une seule fois, sans ressusciter un kit supprimé par le gérant
- Paramètres : tous les onglets (Profil, Apparence, Moyens de paiement, Sauvegarde, Administration) recadrés comme l'écran qui y mène — en-tête titre + phrase d'explication, un seul retour (la flèche de l'en-tête, que le bouton « Retour » doublait sur mobile), libellés de section en majuscules et même espacement des cartes partout

## 2026-08-20
- Apparence : écran dédié (Paramètres → Apparence) avec des cartes d'option illustrées, et retrait des icônes de thème de la barre latérale
- Clients : carnet en cartes (pastille d'initiales, téléphone/email/adresse, nombre de devis) et fiche client plein écran sur `/clients/:id` — onglets Résumé / Devis / Contact / Notes, quatre indicateurs, activité sur 6 mois et devis récents
- Clients : champ email ajouté à la fiche client (saisie, affichage, recherche)
- Paramètres : nouvel écran qui réunit tout ce qui se règle (profil, abonnement, apparence, moyens de paiement, sauvegarde, administration, diagnostic) — la barre latérale et le menu « Plus » n'énumèrent plus que le travail quotidien
- Plus → Compte : « Apparence » devient une ligne comme les autres (icône, sous-titre = thème actuel, flèche), le réglage s'ouvre dans une fiche au lieu d'être toujours affiché
- Chargement : l'écran plein « Chargement… » cède la place à un squelette animé qui reprend la forme de l'app (barre latérale, en-tête) — la structure reste visible tout de suite, seul le contenu se dessine en attendant
- Connexion (inscription) : bandeau tarifs/fonctionnalités retiré sous « Créer mon compte » ; texte du volet de marque recentré sur le dimensionnement solaire (fiche complète générée en quelques minutes)
- Connexion : nouvelle mise en page à deux volets sur grand écran (formulaire à gauche, présentation de l'app à droite) — repli sur le formulaire seul en dessous de 900px
- Logo officiel BestaSolar Pro : barre latérale (mode public, version blanche sans plaque) et documents imprimables (devis, factures) ; devient aussi le favicon et l'icône iOS (icône « B » dédiée) — écran de connexion inchangé (icône Sun)
- Apparence : clair par défaut (ne suit plus l'OS tant que « Système » n'est pas choisi exprès) ; la page de connexion reste toujours claire, quel que soit le thème réglé sur l'appareil
- Apparence : mode clair / sombre / système, réglable depuis Plus → Apparence (mobile) ou la barre latérale (desktop), sans backend — préférence d'appareil posée avant le premier rendu (pas de clignotement)
- Devis : bouton « Relancer par WhatsApp » sur les affaires en cours, message pré-rempli et trace de la dernière relance
- Notifications : cloche dans l'en-tête, sur tous les écrans — reprend le flux d'alertes du tableau de bord (pistes sans activité, devis sans suite, abonnement, commissions à payer)

## 2026-08-18
- Tableau de bord : le suivi de stock disparaît, remplacé par « Devis sans suite » et « Transformation devis → commande » — deux indicateurs commerciaux, cliquables vers la liste filtrée
- Boutique : les champs stock passent derrière un interrupteur par produit (« Suivre le stock »), désactivé par défaut — plus de décrément automatique à la confirmation de commande
- Inscription : numéro de téléphone avec choix du pays (Togo +228 / Bénin +229) plutôt qu'un indicatif deviné
- Inscription : message de succès reformulé pour orienter aussi qui a déjà un compte (connexion / mot de passe oublié), sans révéler si l'email existe déjà
- CAPTCHA retiré entièrement (connexion, inscription, mot de passe oublié) : Supabase ne peut pas le réserver à la connexion sans casser l'inscription — la protection réelle reste le verrouillage progressif et les Rate Limits Supabase
- Inscription : CAPTCHA retiré (gardé sur mot de passe oublié et connexion après 3 échecs)
- Connexion : le CAPTCHA n'apparaît plus qu'à partir du 3e échec sur un même email, moins de friction pour la saisie normale
- Session : durée de vie (30 j) et inactivité (7 j) bornées côté app, en attendant le palier payant Supabase qui fait ça nativement
- Connexion / inscription / mot de passe oublié : défi CAPTCHA (hCaptcha ou Turnstile) câblé, actif dès qu'une clé de site est renseignée
- Connexion : verrouillage temporaire après 5 échecs (progressif jusqu'à 2 h) pour freiner le brute force à l'écran
- Inscription : « email déjà utilisé » remplacé par un message générique, pour ne plus révéler les comptes existants

## 2026-08-10
- Ordre des scripts SQL : `temps-reel.sql` passe en dernier, et il est dit facultatif
- Temps réel : une table qui coince n'interrompt plus l'inscription des suivantes
- `etat-base.sql` : savoir en lecture seule ce qui manque à une base, avant d'y toucher
- Deux environnements documentés, et historiques de branche reliés : les fusions redeviennent ordinaires
- Recette avant production : liste de vérification à dérouler sur l'aperçu, du plus risqué au plus visible
- E-mails du compte : marche à suivre SMTP Brevo + textes français d'inscription et de mot de passe
- Dimensionnement : l'étude est gardée avec le devis — on revient voir les appareils et on les corrige
- Documents : police IBM Plex Sans rétablie et embarquée — plus de dépendance à Google Fonts
- Devis : « En cours / Converti en vente / Expiré », relance à 7 jours et conversion qui fige le montant
- Outillage agent : linter réparé (0 problème), démarrage de session automatique, procédures écrites
- Fiche de dimensionnement : ouverte en vrai PDF dans un nouvel onglet, prête à envoyer au client
- Analytique : clé PostHog collée dans l'adresse détectée et nommée — c'était la cause du « 405 »
- Diagnostic : destination des envois analytiques affichée et testable — une mauvaise région ne se voyait pas
- Analytique PostHog : parcours utilisateur mesuré sans SDK, sans capture automatique, chemins anonymisés
- Plus → Diagnostic : état réel du suivi des erreurs et bouton d'envoi d'une erreur de test
- Sentry branché : piles d'appel lisibles, chargé seulement au premier plantage (27 Ko), sans fil d'Ariane
- Plantages : écran clair avec code de référence, journal serveur, signalement WhatsApp pré-rempli
- Paiement en ligne indisponible : le gérant lit le motif et où le corriger, au lieu d'un bouton absent
- Panier : « Commander en ligne » absent s'explique au lieu de disparaître en silence
- Boutique : régler sa commande en ligne, avec la même vérification serveur que l'abonnement
- « Moyens de paiement » rejoint la barre latérale desktop (oublié à sa création)
- Abonnement : activation sur vérification serveur du paiement, plus sur la parole du navigateur
- Moyens de paiement configurables depuis l'espace gérant — clé publique seule, secrets refusés
- KKiaPay : le sandbox n’accepte que ses numéros de test — la liste est affichée, l’erreur enfin expliquée
- Formation : couverture de cours à l’emblème du diplôme, remplaçable par une photo
- Formation : le sommaire minuté d’une vidéo YouTube se remplit tout seul au collage du lien
- Formation : un cours neuf s’ouvre enfin pour y ajouter modules et leçons
- Sync : une table absente côté serveur ne passe plus pour « envoyée » — voyant rouge explicite et reprise automatique
- Synchronisation : relecture du serveur toutes les minutes et au retour à l’écran (filet du temps réel)
- Dimensionnement par facture : « CEET/SBEE » — Togo et Bénin, pas un seul opérateur
- Devis : la carte « Dimensionnement par facture » disparaît — la facture CEET est un mode de saisie de l’assistant solaire
- Saisie des charges : la nouvelle ligne apparaît en haut, sous le sélecteur
- Fiche : l’économie annuelle est doublée de son équivalent mensuel
- Devis : le nom de l’onduleur n’est plus écrit deux fois sur la ligne
- Onduleur : escalade automatique jusqu’à deux appareils en parallèle avant de déclarer forfait
- Onduleur : l’alerte nomme la contrainte qui bloque — puissance de sortie ou entrée PV (MPPT)
- Onduleurs : un « n kVA » compte pour n kW — plus de calibre surdimensionné proposé
- Onduleur : un calibre insuffisant n’est plus proposé en silence — la fiche annonce le calibre à prévoir
- Devis kit : la structure de montage est ajoutée même aux kits qui n’en portent pas (20 et 32 kWh)
- Onduleur choisi sur le pic de consommation, puis sur la capacité PV des onduleurs configurés
- Fiche : le rendement des panneaux intervient à la puissance à installer, plus à l’énergie à produire
- Fiche : production = puissance installée × rendement des panneaux × ensoleillement, sans « pertes système »
- Fiche : un seul taux de pertes (85 %) du dimensionnement au productible — fin des chiffres contradictoires
- Fiche : « Panneaux photovoltaïques » en toutes lettres, colonnes ajustées à leur contenu
- Fiche : « Panneaux photovoltaïques », libellés des durées de vie sur une seule ligne
- Fiche : « Structure et câblages » à 15 ans, durées de vie alignées sur une même ligne
- Fiche : durée de vie des batteries à 15 ans, équipements classés de la plus longue à la plus courte
- Fiche de dimensionnement à l'identité de l'installateur côté Pro (logo, couleurs, coordonnées)
- Graphique de couverture calé sur le pire mois : un système bien dimensionné affiche 12 mois orange

## 2026-08-07
- Fiche de dimensionnement en 3 pages : rentabilité et couverture mensuelle (graphique)
- Devis : retour des coordonnées officielles BestaSolar (Bénin) sur les documents
- Ensoleillement : table hors-ligne et repli calés sur les mesures NASA (4,3 h à Lomé)
- Rendement des panneaux : 75 % → 85 % dans le calcul de dimensionnement
- Dimensionnement sur le PIRE MOIS d'ensoleillement, plus la moyenne annuelle
- Devis pompage : le kit seul — tuyauterie et installation se chiffrent sur place
- Kits pompage modifiables dans l'app (comme « Mes kits ») et synchronisés à l'équipe
- Deux nouveaux dimensionnements : par facture CEET (F CFA) et pompage solaire (kits suggérés)
- Clients Pro : une entreprise a un nom ET une personne de contact
- Togolisation complète : villes, ensoleillement, indicatifs +228, NIF, opérateurs Mobile Money
- Purge des vieux caches affiliés : les cours masqués ne ressuscitent plus
- Masquage réparé : plus de copies des cours chez les affiliés (source unique)
- Formation : cours réservés aux membres Pro et cours masqués sans suppression
- Formation : le catalogue BestaSolar est partagé à toutes les entreprises inscrites
- Mon profil affiche l'entreprise de rattachement (+ script SQL de rattachement)
- Sync bloquée : les abonnements des autres organisations ne polluent plus l'état local
- Statut de synchronisation : le motif de l'échec devient lisible et copiable
- Formation : catalogue enrichi (2 nouveaux cours) + dotation des mises à jour
- Sync : un échec de tombstone ne bloque plus toute la réplication
- Mes kits : moteur de recherche pour lier une ligne à un produit boutique
- Mes kits : lier une ligne à un produit boutique synchronise son prix
- Cohérence des prix : Boutique et devis affichent toujours le prix public
- Marge prix public : 15 % → 10 %
- Onduleurs : la liste de départ reprend ceux des kits, pas une gamme générique
- Ajoute Onduleurs à la barre latérale desktop (oublié)
- Onglet Onduleurs : suggère automatiquement une alternative au kit
- Complète automatiquement les panneaux si le kit suggéré en a moins que le besoin
- Ajuste le libellé de l'exclusion structure de montage
- Devis solaire : option pour ne pas inclure la structure de montage
- Suggestion de kit : batterie toujours ≥ besoin calculé, jamais moins
- Type de support des panneaux (page 4 devis solaire) — prix au panneau
- Devis solaire : seul le kit suggéré est proposé, plus de choix manuel
- Sélecteur d'autonomie batterie dans l'assistant Pro (devis solaire)
- Les panneaux grandissent avec l'autonomie batterie choisie
- Sélecteur d'autonomie batterie discret (chips au lieu de grandes cartes)
- Ajout d'un sélecteur d'autonomie batterie à l'étape 3 du devis solaire

## 2026-08-06
- Dimensionnement solaire : les totaux de consommation sur une seule ligne
- Dimensionnement solaire : champs sur une ligne, page pleine largeur
- Dimensionnement solaire : le wizard reprend toute sa largeur

## 2026-08-05
- Un devis naît à l'étape du client, jamais directement à « Proposition »
- Le formulaire client demande les informations du bon type
- Règlement d'une demande d'un autre compte : plus de faux succès
- Une commission demandée quitte « à payer » jusqu'à la décision
- Les demandes de paiement des autres comptes remontent au gérant
- Demande de paiement des commissions : le partenaire demande, le gérant règle
- Niveau 1 en orange, niveau 2 en vert — et rien d'autre
- Le niveau de parrainage se lit à la couleur de sa pastille
- Mes kits : les compositions solaires deviennent modifiables
- Commissions : l'action de paiement redevient un bouton
- Fermer les écrans d'administration à un simple utilisateur

## 2026-08-04
- Parrainage et commissions de niveau 2 : attribution rétablie
- Espace partenaire : sections repliables et tuiles lisibles
- Les affaires gagnées rejoignent l'espace partenaire
- Profil : zéro mention de commission, bouton de renvoi compris
- Les commissions quittent le profil pour l'espace partenaire

## 2026-08-03
- Les commissions de la plateforme remontent dans le compte gérant
- Suivi partagé : BestaSolar valide les progressions de TOUS les comptes
- Validation : un commercial ne s'octroie plus les droits pendant le chargement
- Progression : retour au circuit demande → validation par le gérant
- Vérifications en navigateur réel : suivi par devis et commissions automatiques
- Saisie : les champs des panneaux ne perdent plus le focus à chaque caractère
- Synchronisation réparée : l'app ne renvoyait pas ses données, elle les renvoyait TOUTES
- Synchronisation : envoi par lots, un gros catalogue ne bloque plus tout
- Synchronisation : le motif de l'échec est affiché, plus seulement le voyant rouge
- Déploiement réparé : versions d'ESLint incompatibles entre elles
- L'app s'ouvre désormais sans réseau, et rappelle l'IFU obligatoire
- Boutique : aucun libellé ne laisse croire à un paiement, numéros de commande fiables
- Profil personnel modifiable, sans jamais ouvrir la porte aux privilèges
- Barème de commission : les libellés suivent la source, plus de « 3 % » en dur
- Abonnement et restauration : l'utilisateur voit ce qui l'engage
- Numérotation : plus de doublons entre appareils sur les devis et les factures
- Fiabilité des données : plus de perte silencieuse (réplication et stockage local)
- Ajout d'ESLint : le filet qui manquait avant le lancement commercial
- Correctifs de la revue : crash du kanban, commission affichée, étape du client
- Suivi clients : une carte par devis, progression directe par le vendeur, commission automatique
- Commissions : création automatique débloquée (chaîne de 4 causes) et fin des doublons
- Validation des progressions : rien n'échappe au gérant, le commercial suit ses clients
- Suivi clients : l'admin retrouve la progression sur SES propres clients
- Suivi clients : le kanban redevient un tableau par client, comme sur main
- Commissions : attribution automatique garantie et bénéficiaire dans toute l'équipe
- Le suivi commercial de toute la plateforme remonte dans le kanban du gérant
- Écran de connexion : l'environnement (test / production) est affiché avec la version
- Déclencheur de déploiement : projet Vercel de test branché sur la branche de travail
- Suivi commercial par affaire : chaque devis a sa propre étape dans le pipeline

## 2026-08-02
- Inscription : le champ « Code partenaire » est toujours proposé (facultatif)
- Les devis publics de tous les comptes remontent dans l'écran Devis du gérant
- Affiliation multi-entreprise : attribution, suivi des filleuls et commissions
- Catalogue interne BestaSolar partagé en lecture seule : aucune copie aux inscrits
- Clés primaires par organisation : la synchronisation des nouvelles entreprises ne peut plus entrer en collision
- Inscription : numéro de téléphone demandé et enregistré sur le profil
- Inscription en une seule page simple ; l'inscrit est un utilisateur classique, pas un gérant
- Version visible sur l'écran de connexion + purge du tiroir local hérité en mode SaaS
- Cache local séparé par organisation : fin de la fuite de données entre comptes d'un même appareil
- Parrainage attribuable une seule fois après l'inscription, verrouillé côté serveur
- Lien partenaire → inscription directe avec code de parrainage prérempli

## 2026-08-01
- Connexion : une inscription interrompue se termine à la connexion (plus de faux « mot de passe incorrect »)
- Un seul parcours pour tous les inscrits : la partie publique gratuite, l'espace Pro payant
- Espace Devis Pro léger : les inscriptions externes n'ouvrent que l'espace Pro (offre 5 000 F/mois)
- multitenant.sql : invite_code fourni explicitement dans les insertions d'org
- multitenant.sql : le bloc invite_code (défaut compris) passe AVANT le bootstrap de l'org
- multitenant.sql : invite_code avec valeur par défaut — script rejouable et inscription réparée
- schema.sql ré-exécutable après multitenant.sql : le seed de profils démo est ignoré si org_id existe
- multitenant.sql : la règle des paiements d'abonnement vérifie le bon champ (statut, pas status)

## 2026-07-31
- Guide de déploiement : section nom de domaine app.bestasolar.com
- Étape commerciale 1 : comptes réels, multi-entreprise et abonnement Pro vérifié serveur
- Connexion : accès démo réservé au développement, sortie de secours, dégradé dans les tokens (bloc 02)
- Hygiène du système : CSS orphelin retiré, miroir design-system synchronisé
- Fin des correctifs de la revue (hors documents imprimables) : Pro, dialogues, écrans publics et Plus
- Mon entreprise : aperçu en direct, logo visible, couleurs annulables, TVA en segmented (bloc 08)
- Kanban utilisable au doigt : sélecteur d'étape sans glisser (bloc 04)
- Primitives transverses : segmented, callout, toast, ConfirmSheet, DangerZone, tokens manquants
- Fin de l'étape 2 : wayfinding Pro, tab bar à 5 entrées, marge prix centralisée (#125)

## 2026-07-30
- Annulation du dernier déploiement — revert du complément desktop (#124)
- Complément desktop : les 8 règles issues de l'audit des 19 blocs (#123)
- Mise en page uniforme : la version mobile devient la seule version (#122)
- Pack de correctifs design — contraste AA, focus, cibles tactiles, wayfinding (#121)

## 2026-07-29
- Détection automatique des couleurs du logo importé (#120)
- Documents Pro aux couleurs de l'abonné (#119)
- Trois modèles de document imprimables pour devis et factures (#118)
- Fiche de dimensionnement : refonte en document deux pages A4 (#117)

## 2026-07-28
- Batterie : profondeur de décharge maintenue à 80 % (#116)
- Dimensionnement batterie : valeurs lithium au lieu de valeurs plomb (#115)
- Fiche de dimensionnement : le besoin calculé, sans le kit (#114)

## 2026-07-26
- Devis public : résumé des besoins à l'étape du type de système (#113)
- Revert "Dimensionnement v2 : méthodologie corrigée, du référentiel à la fiche client (#111)" (#112)
- Dimensionnement v2 : méthodologie corrigée, du référentiel à la fiche client (#111)
- Fiche de dimensionnement : mention de l'apporteur d'affaires (#110)
- Dimensionnement : ajout d'un appareil hors catalogue (#109)
- Devis depuis la fiche client : étape de sélection sautée (#108)
- Clients : suppression de la saisie « valeur estimée » (déduite des devis) (#107)
- Clients : modification, devis direct depuis la fiche et sélecteur complet (#106)
- Clients : page répertoire dans la barre latérale (ajout + recherche) (#105)
- Devis : l'apporteur est impérativement attribué (créateur en repli) (#104)
- Commissions : synchronisation complète des attributions d'apporteur (#103)
- Devis : apporteur d'affaires en lecture seule (profil rattaché à la piste) (#102)

## 2026-07-25
- Commissions : suivi conforme aux normes (paiement tracé, reçu, relevé) (#101)
- Suivi clients : validation des progressions par le gérant (#100)
- Retour à la barre latérale (annule la barre horizontale style Zervant) (#99)
- Navigation desktop : barre horizontale style Zervant (#98)
- Lecteur vidéo « nu » : impossible de deviner l'hébergeur (façon systeme.io) (#97)
- Vidéos Vimeo : lecture des vidéos non répertoriées (code h=) et liens manage (#96)
- Formation : catalogue pleine largeur avec couvertures (#95)
- Formation : lecture vidéo façon systeme.io (sommaire minuté, modules repliables) (#94)
- Barre latérale : navigation à plat, « Passer en mode Pro » au-dessus de « Mon profil » (#93)
- Menu « Plus » : suppression des entrées en double sur desktop (#92)
- Menu « Plus » : réorganisation professionnelle en sections (#91)
- Wizard Pro : même largeur que le public (pleine page) (#90)
- Devis & Factures Pro : ouverture sur l'onglet Devis par défaut (#89)
- Wizards : ville affichée pour « Ma position » + off-grid par défaut (#88)
- Espace Pro : logo et nom de l'entreprise de l'abonné dans la barre latérale (#87)

## 2026-07-13
- Version 1.1.0 — redéploiement Vercel (#86)

## 2026-07-12
- Kits publics : les 5 kits officiels (2,5 Éco/Premium, 5, 20, 32 kWh) (#85)

## 2026-07-06
- Wizard public : fiche de dimensionnement (imprimable) à l'étape 4 (#84)
- Résumé de consommation : les 4 statistiques sur une seule ligne (#83)
- Wizards solaires : pic de charge (W) devant le total de consommation (#82)
- Fiche de dimensionnement : matériel en désignations techniques, sans marques (#81)
- Fiche de dimensionnement : « rendement des panneaux » au lieu de « rendement global » (#80)
- Fiche de dimensionnement : heures jour / nuit séparées dans les charges (#79)
- Wizard Pro : fiche de dimensionnement complète (HTML imprimable) en étape 4 (#78)

## 2026-07-05
- Formation : plateforme « école » (cours → modules → leçons) (#77)
- Espace Pro : clients unifiés avec les documents + fiche client (#76)

## 2026-07-03
- Tableau de bord Pro : trésorerie réelle (encaissements, retards, échéances) (#75)
- Factures Pro : suivi des paiements & relances (#74)
- Public : sous-sections de « Plus » remontées dans la barre latérale (desktop) (#73)
- Écran Devis public : liste plate + menu d'actions (#72)
- Listes devis / factures / clients : présentation en liste plate (#71)

## 2026-07-02
- Devis & Factures : édition des devis (Pro + public) et des factures (Pro) (#70)
- Devis mode public : enregistrement en brouillon (#69)
- Devis & Factures Pro : enregistrement en brouillon (#68)
- Dimensionnement Pro : fiche de dimensionnement (PDF) (#67)
- Devis/Factures Pro : 2 modèles (Couleur / N&B) + aperçu + « Mon entreprise » réorganisée (#66)
- Dimensionnement Pro : étape « Matériel » unifiée (onduleur + batteries) (#65)
- Dimensionnement Pro : géolocalisation + mise en avant de l'outil (#64)

