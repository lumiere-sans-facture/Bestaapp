# Historique des modifications

Journal des changements de **BestaSolar Pro**, du plus récent au plus ancien,
généré à partir de l'historique Git (une entrée par commit sur `main` ou sur
la branche de travail en cours). Les numéros entre parenthèses renvoient aux
pull requests correspondantes sur GitHub.

## 2026-08-18
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
