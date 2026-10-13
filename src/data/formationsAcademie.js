// Académie BestaSolar : trois formations pour les techniciens, installateurs
// et commerciaux solaires (Bénin, Togo, Côte d'Ivoire).
//
// Même format que les autres cours (cours → modules → leçons, voir
// utils/formation.js), avec deux ajouts du même schéma :
//   - la leçon de type « quiz » (questions QCM, corrigées sur place) ;
//   - la ligne « [[schema:nom]] » dans un texte, qui affiche un schéma livré
//     avec l'application (components/formation/SchemaFormation).
//
// Chaque leçon suit le même plan : un objectif (sous le titre), un texte court
// lisible sur téléphone, un exemple local, les erreurs fréquentes du terrain,
// et l'encadré « À retenir / Actions » de l'écran, titré « L’essentiel »
// (3 points au plus).
//
// Tout ce qui est décrit existe dans l'application : boutons et libellés ont
// été relevés sur les écrans. Les montants sont des EXEMPLES — aucune
// promesse de gain.
//
// Identifiants FIXES : la progression des apprenants s'y rattache, et le
// script supabase/formations-academie.sql (généré depuis ce fichier par
// scripts/formations-sql.mjs) doit pouvoir être rejoué sans doublon.

import { COUVERTURE_DEMARRER, COUVERTURE_DEVIS, COUVERTURE_REVENUS } from './couverturesFormations.js';

const AUTEUR = 'Académie BestaSolar';

/** Leçon de lecture au plan commun. `texte` : paragraphes (et lignes
 *  « [[schema:nom]] »), l'exemple en dernier paragraphe. */
const lecon = (id, title, duration, { objectif, texte, exemple, erreurs, retenir }) => ({
  id,
  title,
  type: 'texte',
  duration,
  description: `Objectif : ${objectif}`,
  content: [
    ...texte,
    `Exemple — ${exemple}`,
    ['Erreurs fréquentes sur le terrain :', ...erreurs.map((e) => `- ${e}`)].join('\n'),
  ].join('\n\n'),
  actionTitle: 'L’essentiel',
  actionContent: retenir.map((r) => `- ${r}`).join('\n'),
});

/** Leçon quiz : [question, choix, index de la bonne réponse, explication]. */
const quiz = (id, title, duration, questions, description = 'Cochez une réponse par question, puis vérifiez : chaque réponse est expliquée.') => ({
  id,
  title,
  type: 'quiz',
  duration,
  description,
  questions: questions.map(([question, choix, bonne, explication], i) => ({
    id: `${id}-q${i + 1}`, question, choix, bonne, explication,
  })),
});

// ===================================================================
// FORMATION 1 — Démarrer avec BestaSolar Pro (débutant, ~45 min)
// ===================================================================
const DEMARRER = {
  id: 'academie-demarrer',
  title: 'Démarrer avec BestaSolar Pro',
  author: AUTEUR,
  description: 'Créer son compte, comprendre l’écran, enregistrer son premier client et lancer son premier dimensionnement — même sans réseau. Niveau débutant.',
  cover: COUVERTURE_DEMARRER,
  modules: [
    {
      id: 'ad-m1',
      title: 'Créer son compte et rejoindre son équipe',
      lecons: [
        lecon('ad-m1-l1', 'Créer son compte', '4 min', {
          objectif: 'créer votre compte BestaSolar Pro et vous connecter.',
          texte: [
            'Sur l’écran de connexion, touchez « Créer un compte ». L’application demande votre nom complet, votre numéro de téléphone, votre e-mail et un mot de passe d’au moins 8 caractères.',
            'Le numéro se tape sans l’indicatif : choisissez d’abord le pays dans la liste à gauche du champ (Bénin, Togo, Côte d’Ivoire…). Au Bénin, le numéro compte 10 chiffres.',
            'Dernier champ, « Code partenaire (facultatif) » : le code de la personne qui vous a recommandé l’application, sous la forme NOM-XXXXXX. Arrivé par son lien, il est déjà rempli. Sinon, vous pourrez le saisir une seule fois plus tard, dans Plus → Parrainage.',
            'Touchez « Créer mon compte ». Si un e-mail de confirmation vous est envoyé, ouvrez le lien qu’il contient, puis connectez-vous avec votre e-mail et votre mot de passe.',
          ],
          exemple: 'Koffi, installateur à Cotonou, choisit le Bénin dans la liste, tape 0197123456, puis le code AWA-K7P2QX que sa collègue lui a envoyé sur WhatsApp. Une minute plus tard, il est dans l’application.',
          erreurs: [
            'Taper l’indicatif (+229) dans le numéro alors que le pays est déjà choisi.',
            'Créer deux comptes avec deux e-mails différents : vos clients se retrouvent éparpillés.',
            'Saisir un code partenaire au hasard : il devient votre parrain pour de bon.',
          ],
          retenir: [
            'Le pays se choisit dans le champ du téléphone, avant le numéro.',
            'Le code partenaire est facultatif, mais il ne s’attribue qu’une fois.',
            'Un seul compte par personne, avec un mot de passe de 8 caractères au moins.',
          ],
        }),
        lecon('ad-m1-l2', 'Gérant ou technicien : qui fait quoi', '3 min', {
          objectif: 'savoir ce que votre rôle vous permet de faire dans l’application.',
          texte: [
            'Il y a deux rôles. Le gérant dirige l’entreprise : il voit tous les clients et tous les devis, valide les ventes et règle les commissions. Le technicien travaille sur ses propres clients et ses propres devis.',
            'Le rôle ne se choisit pas à l’inscription : un compte créé seul est un compte technicien. Pour rejoindre une équipe, le plus simple est le lien d’invitation : le gérant ouvre Plus → Équipe, touche « Copier » sous « Inviter un technicien », et vous l’envoie.',
            'En ouvrant ce lien, vous créez votre compte et arrivez directement dans l’équipe. Le gérant retrouve alors votre profil et vos performances dans Plus → Équipe.',
            'Une règle à connaître : quand un technicien fait passer une affaire à « Gagné », l’application affiche « Le changement d’étape sera soumis à la validation du gérant ». C’est le gérant qui confirme une vente.',
          ],
          exemple: 'À Lomé, Mme Amouzou, gérante, envoie le lien d’invitation à ses deux techniciens sur WhatsApp. Le soir même, elle voit leurs premiers clients apparaître.',
          erreurs: [
            'S’inscrire seul puis attendre d’« apparaître » dans l’équipe : demandez le lien d’invitation au gérant.',
            'Croire qu’une affaire passée à « Gagné » par un technicien est déjà une vente : elle attend la validation du gérant.',
          ],
          retenir: [
            'Gérant : toute l’équipe, la validation des ventes, les commissions.',
            'Technicien : ses propres clients et ses propres devis.',
            'Pour rejoindre une équipe : le lien « Inviter un technicien » du gérant.',
          ],
        }),
        quiz('ad-m1-quiz', 'Quiz — Votre compte', '2 min', [
          ['Où choisit-on le pays au moment de l’inscription ?',
            ['Dans la liste à gauche du champ téléphone', 'Dans un écran « Pays » après l’inscription', 'On ne peut pas le choisir'], 0,
            'Le pays se choisit dans le champ du numéro de téléphone : il fixe l’indicatif. On tape ensuite le numéro sans l’indicatif.'],
          ['Vous voulez rejoindre l’équipe de votre gérant. Que faites-vous ?',
            ['Je m’inscris seul et j’attends', 'Je saisis son nom dans le code partenaire', 'J’ouvre le lien « Inviter un technicien » qu’il m’a envoyé'], 2,
            'Le lien d’invitation (Plus → Équipe) crée votre compte directement dans son équipe. Le code partenaire, lui, sert au parrainage.'],
          ['Un technicien passe une affaire à « Gagné ». Que se passe-t-il ?',
            ['La vente est enregistrée tout de suite', 'Le changement est soumis à la validation du gérant', 'L’affaire est supprimée'], 1,
            'L’application le dit : « Le changement d’étape sera soumis à la validation du gérant ». C’est lui qui confirme la vente.'],
        ]),
      ],
    },
    {
      id: 'ad-m2',
      title: 'Tour de l’interface',
      lecons: [
        lecon('ad-m2-l1', 'Le tableau de bord', '4 min', {
          objectif: 'lire en un coup d’œil où en est votre activité.',
          texte: [
            'Le tableau de bord vous accueille par « Bonjour » et votre prénom. Juste dessous, une rangée de pastilles résume votre activité ; chacune s’ouvre d’un toucher sur l’écran concerné.',
            [
              'Les pastilles :',
              '- Pistes actives : vos affaires en cours.',
              '- Nouvelles · 7j : les clients ajoutés ces 7 derniers jours.',
              '- À relancer : les affaires sans nouvelle depuis plus de 7 jours.',
              '- Gagnées · ce mois et Devis · ce mois.',
              '- Devis sans suite : émis il y a plus de 7 jours, toujours sans réponse.',
            ].join('\n'),
            'Plus bas : « Alertes récentes » (ce qui demande une action), « Indicateurs clés » avec le taux de conversion, et « Performance ». La cloche, en haut de l’écran, reprend les mêmes alertes.',
          ],
          exemple: 'lundi matin, Ibrahim voit « À relancer : 3 ». Il touche la pastille, retrouve les trois clients et les appelle avant 10 h.',
          erreurs: [
            'Ouvrir l’application seulement pour faire un devis, sans regarder les alertes.',
            'Laisser grossir « Devis sans suite » : un devis oublié est souvent un client perdu.',
          ],
          retenir: [
            'Une pastille d’alerte, c’est une action à faire aujourd’hui.',
            'Chaque pastille ouvre l’écran concerné.',
            '« À relancer » et « Devis sans suite » s’allument après 7 jours sans nouvelle.',
          ],
        }),
        lecon('ad-m2-l2', 'Les cinq onglets', '4 min', {
          objectif: 'savoir où se trouve chaque outil de l’application.',
          texte: [
            'Sur téléphone, cinq onglets vivent en bas de l’écran : Tableau, Suivi, Devis, Boutique et Plus. Sur ordinateur, les mêmes entrées sont dans la barre de gauche.',
            '[[schema:interface]]',
            'Le gros bouton + au centre, c’est Devis : c’est de là que part un dimensionnement solaire. Suivi clients range vos affaires par étape. La Boutique présente le catalogue et ses prix publics.',
            'Plus regroupe le reste : Clients (votre carnet d’adresses), Simulateur ROI, Formation, Mon espace partenaire et les Paramètres. Le gérant y trouve aussi Équipe, Commissions, Mes kits et Onduleurs.',
          ],
          exemple: 'en visite chez un client à Abomey-Calavi, Rachidi ouvre Plus → Simulateur ROI pour lui montrer ce qu’il dépense en carburant, puis touche + pour lancer le devis.',
          erreurs: [
            'Chercher ses clients dans la Boutique : ils sont dans Plus → Clients et dans Suivi clients.',
            'Croire qu’un outil manque alors qu’il est réservé au gérant (Équipe, Commissions, Mes kits).',
          ],
          retenir: [
            'Le + du centre : tout nouveau devis.',
            'Plus → Clients : le carnet d’adresses.',
            'Plus → Simulateur ROI : l’argument chiffré pour le client.',
          ],
        }),
        quiz('ad-m2-quiz', 'Quiz — L’interface', '2 min', [
          ['Que signifie la pastille « Devis sans suite » ?',
            ['Des devis émis il y a plus de 7 jours, toujours sans réponse', 'Des devis refusés par le client', 'Des brouillons jamais envoyés'], 0,
            'Un devis est « sans suite » quand il a été émis il y a plus de 7 jours, qu’il est toujours en cours et qu’aucune relance n’a été faite depuis.'],
          ['Où lancer un nouveau dimensionnement solaire ?',
            ['Dans la Boutique', 'Dans Plus → Paramètres', 'Avec le bouton + au centre (Devis)'], 2,
            'Le + central ouvre les devis : choisissez ensuite « Dimensionnement solaire ».'],
          ['Sur téléphone, où se trouve le carnet d’adresses de vos clients ?',
            ['Dans Plus → Clients', 'Dans la Boutique', 'Dans la cloche'], 0,
            'Plus → Clients liste tous vos clients, avec une recherche. Les mêmes clients apparaissent aussi dans Suivi clients.'],
          ['La pastille « À relancer » affiche 4. Quelle est la bonne réaction ?',
            ['L’ignorer, ce n’est qu’un chiffre', 'La toucher et contacter ces clients aujourd’hui', 'Supprimer ces affaires'], 1,
            'Ce sont des affaires sans nouvelle depuis plus de 7 jours : un appel ou un message WhatsApp aujourd’hui peut les relancer.'],
        ]),
      ],
    },
    {
      id: 'ad-m3',
      title: 'Premier client, première affaire',
      lecons: [
        lecon('ad-m3-l1', 'Ajouter un client', '3 min', {
          objectif: 'enregistrer un client complet en moins d’une minute.',
          texte: [
            'Ouvrez Plus → Clients, puis touchez « Nouveau client ». Choisissez le type : particulier ou entreprise. Pour une entreprise, l’application demande aussi la personne de contact.',
            'Remplissez le nom, le téléphone, l’adresse (quartier et ville) et une note sur le besoin, puis touchez « Ajouter le client ».',
            'Le client apparaît aussitôt dans Suivi clients, à l’étape « Nouveau » : pas besoin de le créer une deuxième fois. Si son téléphone ou son e-mail existe déjà, la fiche existante est complétée au lieu d’être dupliquée.',
          ],
          exemple: 'Mme Hounkpatin, atelier de couture à Parakou, quartier Zongo. Note : « coupures le soir, veut faire tourner deux machines et un ventilateur ».',
          erreurs: [
            'Oublier le téléphone : impossible ensuite d’envoyer le devis sur WhatsApp.',
            'Noter seulement « Maman Ablavi » sans le quartier : introuvable trois semaines plus tard.',
          ],
          retenir: [
            'Un client = une fiche, visible dans Clients et dans Suivi clients.',
            'Toujours le téléphone : c’est par lui que partent les devis WhatsApp.',
            'La note décrit le besoin, avec les mots du client.',
          ],
        }),
        lecon('ad-m3-l2', 'Suivre l’affaire étape par étape', '4 min', {
          objectif: 'faire avancer une affaire jusqu’à la vente.',
          texte: [
            'Suivi clients range vos affaires en colonnes : Nouveau, Qualifié, Visite, Proposition, Négociation, Gagné. Une affaire abandonnée passe en « Perdu ».',
            'Pour changer d’étape, faites glisser la carte vers la colonne suivante, ou ouvrez-la et choisissez « Déplacer vers… ». Le bouton « Nouvelle piste », en haut, crée un client directement ici.',
            '[[schema:parcours]]',
            'La valeur de l’affaire n’est pas à saisir : elle se calcule toute seule à partir des devis du client. Notez chaque échange dans « Notes et activités » : c’est votre mémoire.',
          ],
          exemple: 'après la visite chez Mme Hounkpatin, Ibrahim déplace la carte de « Qualifié » à « Visite » et note : « toit en tôle, ombre le matin côté est ».',
          erreurs: [
            'Laisser tous les clients en « Nouveau » : le suivi ne sert plus à rien.',
            'Passer en « Gagné » avant l’accord réel du client.',
          ],
          retenir: [
            'Une étape = un vrai pas du client, pas un espoir.',
            'Notez chaque appel ou visite dans la fiche.',
            '« Gagné » se confirme par le gérant.',
          ],
        }),
        quiz('ad-m3-quiz', 'Quiz — Clients et affaires', '2 min', [
          ['Vous ajoutez un client dans Plus → Clients. Faut-il aussi le créer dans Suivi clients ?',
            ['Oui, sinon il n’y apparaît pas', 'Non, il y apparaît déjà à l’étape « Nouveau »', 'Oui, avec un autre numéro'], 1,
            'C’est la même fiche : un client ajouté dans Clients apparaît automatiquement dans Suivi clients, à l’étape « Nouveau ».'],
          ['Quelle information ne faut-il jamais oublier sur la fiche ?',
            ['La couleur de la maison', 'L’âge du client', 'Le téléphone'], 2,
            'Le téléphone sert à envoyer le devis et les relances sur WhatsApp.'],
          ['Comment fixe-t-on la valeur d’une affaire ?',
            ['On la tape à la main', 'Elle se calcule à partir des devis du client', 'Le gérant la décide'], 1,
            'La valeur est déduite automatiquement des devis du client : il suffit de faire le devis.'],
          ['Après une visite technique, que faire ?',
            ['Déplacer la carte à « Visite » et noter ce qu’on a vu', 'Attendre que le client rappelle', 'Supprimer la fiche'], 0,
            'Déplacer la carte garde le suivi juste, et la note (toit, ombre, besoins) servira pour le devis.'],
        ]),
      ],
    },
    {
      id: 'ad-m4',
      title: 'Premier dimensionnement',
      lecons: [
        lecon('ad-m4-l1', 'À partir des appareils du client', '4 min', {
          objectif: 'obtenir le bon kit à partir de la liste des appareils du client.',
          texte: [
            'Touchez le + central, puis « Dimensionnement solaire ». L’assistant compte quatre étapes : Client, Consommation, Type de système, Résultat.',
            'Étape Consommation : choisissez « Liste des appareils », puis ajoutez chaque appareil (lampes, frigo, télé, ventilateur…) avec sa quantité, sa puissance, ses heures de jour et ses heures de nuit. Un appareil absent ? « Autre appareil (non listé) ».',
            'L’application calcule la consommation de jour, de nuit, et le « Pic de charge » : tous les appareils allumés en même temps. C’est lui qui sert à choisir l’onduleur.',
            'Étape Type de système : « Autonome (off-grid) » est proposé par défaut. Indiquez la ville du chantier (ou « Ma position ») pour l’ensoleillement, puis passez au Résultat : le kit suggéré et son prix.',
          ],
          exemple: 'un salon de coiffure à Kara : 6 lampes LED, 2 sèche-cheveux, 1 ventilateur. Les sèche-cheveux font monter le pic de charge : c’est lui qui impose un onduleur assez puissant.',
          erreurs: [
            'Mettre 24 h à un frigo qui tourne par cycles : la batterie est surdimensionnée.',
            'Oublier un gros appareil (pompe, congélateur) : le kit lâche dès le premier soir.',
            'Utiliser « Ma position » au bureau alors que le chantier est dans une autre ville.',
          ],
          retenir: [
            'Les heures de NUIT décident de la batterie.',
            'Le pic de charge décide de l’onduleur.',
            'La ville décide de l’ensoleillement, donc des panneaux.',
          ],
        }),
        lecon('ad-m4-l2', 'À partir de la facture SBEE ou CEET', '3 min', {
          objectif: 'dimensionner quand le client ne connaît que sa facture.',
          texte: [
            'Le client ne sait pas lister ses appareils, mais il connaît sa facture ? À l’étape Consommation, choisissez « Facture CEET/SBEE (F CFA) ».',
            'Saisissez la « Facture mensuelle moyenne (F CFA) », vérifiez le « Prix du kWh (F CFA) » de son compteur, puis répondez à « Quand consomme-t-il le plus ? » : surtout en journée, équilibré, ou surtout le soir.',
            'Ce dernier choix compte beaucoup : ce qui est consommé le soir passe par la batterie. Le même montant de facture peut donc demander un kit plus grand si le client vit surtout le soir.',
          ],
          exemple: 'facture SBEE de 25 000 F par mois à 115 F le kWh : environ 217 kWh par mois, soit 7,2 kWh par jour. « Équilibré » donne une batterie conseillée d’environ 4,8 kWh ; « surtout le soir », d’environ 6,7 kWh.',
          erreurs: [
            'Prendre la facture d’un mois de coupures : elle sous-estime le besoin.',
            'Garder un prix du kWh qui n’est pas celui de la facture du client.',
          ],
          retenir: [
            'Facture ÷ prix du kWh = la consommation du mois.',
            'Prenez une facture moyenne, pas celle du mois le plus bas.',
            'Le choix « surtout le soir » agrandit la batterie.',
          ],
        }),
        quiz('ad-m4-quiz', 'Quiz — Dimensionner', '2 min', [
          ['Qu’est-ce qui décide surtout de la taille de la batterie ?',
            ['La consommation de nuit', 'La couleur du toit', 'Le nombre de prises'], 0,
            'La nuit, les panneaux ne produisent plus : tout ce qui est consommé passe par la batterie.'],
          ['À quoi sert le « Pic de charge » ?',
            ['À choisir la structure de montage', 'À calculer la facture', 'À choisir l’onduleur'], 2,
            'C’est la puissance de tous les appareils allumés ensemble : l’onduleur doit pouvoir la fournir.'],
          ['Facture de 25 000 F à 115 F le kWh : combien de kWh par mois, environ ?',
            ['22 kWh', '217 kWh', '2 875 kWh'], 1,
            '25 000 ÷ 115 ≈ 217 kWh par mois, soit environ 7,2 kWh par jour.'],
          ['Même facture, mais le client consomme surtout le soir. Que devient la batterie conseillée ?',
            ['Plus petite', 'Identique', 'Plus grande'], 2,
            'Ce qui est consommé le soir passe par la batterie : à facture égale, « surtout le soir » demande plus de stockage.'],
        ]),
      ],
    },
    {
      id: 'ad-m5',
      title: 'Hors ligne et synchronisation',
      lecons: [
        lecon('ad-m5-l1', 'Travailler sans réseau', '3 min', {
          objectif: 'continuer à travailler quand le réseau coupe, sans rien perdre.',
          texte: [
            'BestaSolar Pro enregistre d’abord tout sur votre téléphone. Sans réseau, vous pouvez quand même ajouter un client, faire un dimensionnement et préparer un devis.',
            'Dès que le réseau revient, l’application envoie toute seule ce qui a été fait. Le gérant en voit l’état dans Plus : « Données partagées en temps réel » quand tout est parti, sinon « Hors ligne — le travail est enregistré ici », avec le nombre d’éléments en attente d’envoi.',
            'Hors ligne, l’ensoleillement de la ville ne peut pas être téléchargé : utilisez « Saisie manuelle (hors-ligne) » à l’étape Type de système.',
            'Pour que l’envoi se fasse, rouvrez simplement l’application une fois revenu en zone couverte. Ne la désinstallez jamais avant : ce qui n’est pas encore envoyé n’existe que sur ce téléphone.',
          ],
          exemple: 'en brousse près de Bassila, aucune barre de réseau. Adjoa enregistre deux clients et leurs dimensionnements. Le soir, de retour à Djougou, tout part sur le serveur en quelques secondes.',
          erreurs: [
            'Refaire un devis en double parce que le gérant ne le voit pas encore : attendez le retour du réseau.',
            'Vider les données ou désinstaller l’application avec des éléments en attente d’envoi.',
          ],
          retenir: [
            'Sans réseau, on travaille normalement.',
            'Le retour du réseau envoie tout, tout seul.',
            'Jamais de désinstallation avant l’envoi.',
          ],
        }),
        lecon('ad-m5-l2', 'Sauvegarder ses données', '2 min', {
          objectif: 'garder une copie de secours de toutes les données.',
          texte: [
            'Le gérant peut télécharger une copie complète : Plus → Sauvegarde des données → « Exporter (télécharger) ». Gardez ce fichier ailleurs que sur le téléphone : ordinateur, clé USB ou e-mail.',
            '« Importer (restaurer) » remet une sauvegarde en place. Attention : l’import remplace les données actuelles. Exportez toujours d’abord, par sécurité.',
          ],
          exemple: 'chaque fin de mois, M. Kodjo exporte sa sauvegarde et l’envoie sur sa propre adresse e-mail.',
          erreurs: [
            'Importer une vieille sauvegarde par-dessus des données récentes.',
            'Garder la sauvegarde uniquement sur le téléphone qu’on risque de perdre.',
          ],
          retenir: [
            'Une sauvegarde par mois, au minimum.',
            'Exporter avant d’importer, toujours.',
            'Le fichier se garde ailleurs que sur le téléphone.',
          ],
        }),
        quiz('ad-m5-quiz', 'Quiz — Hors ligne', '2 min', [
          ['Le réseau coupe pendant une visite. Que faire ?',
            ['Arrêter et revenir plus tard', 'Continuer : tout est enregistré sur le téléphone', 'Noter sur papier puis tout ressaisir'], 1,
            'L’application enregistre d’abord sur le téléphone, puis envoie tout au retour du réseau.'],
          ['Quand ne faut-il surtout pas désinstaller l’application ?',
            ['Après une mise à jour', 'Le dimanche', 'Quand des éléments sont en attente d’envoi'], 2,
            'Ce qui n’est pas encore envoyé n’existe que sur ce téléphone : le désinstaller l’effacerait.'],
          ['Avant d’« Importer (restaurer) » une sauvegarde, que faut-il faire ?',
            ['Rien', 'Exporter d’abord les données actuelles', 'Désinstaller l’application'], 1,
            'L’import remplace les données actuelles : une exportation préalable évite toute perte.'],
        ]),
      ],
    },
    {
      id: 'ad-final',
      title: 'Quiz final',
      lecons: [
        quiz('ad-final-quiz', 'Quiz final — Démarrer avec BestaSolar Pro', '3 min', [
          ['Quelles informations demande l’inscription ?',
            ['Nom, téléphone, e-mail, mot de passe et code partenaire facultatif', 'Seulement le téléphone', 'Une pièce d’identité'], 0,
            'Cinq champs, dont le code partenaire facultatif : le pays se choisit dans le champ téléphone.'],
          ['Qui valide le passage d’une affaire à « Gagné » ?',
            ['Le client', 'Le gérant', 'Personne'], 1,
            'Le changement d’étape d’un technicien vers « Gagné » est soumis à la validation du gérant.'],
          ['Un client ajouté dans Plus → Clients apparaît aussi…',
            ['Nulle part ailleurs', 'Dans la Boutique', 'Dans Suivi clients, à l’étape « Nouveau »'], 2,
            'Clients et Suivi clients montrent la même fiche.'],
          ['Le client ne connaît que sa facture SBEE. Quel mode de consommation choisir ?',
            ['Liste des appareils', 'Facture CEET/SBEE (F CFA)', 'Saisie directe (kWh)'], 1,
            'Le mode facture convertit le montant mensuel en kWh avec le prix du kWh.'],
          ['Que se passe-t-il quand le réseau revient après une journée hors ligne ?',
            ['Il faut tout ressaisir', 'Les données sont perdues', 'L’application envoie tout, toute seule'], 2,
            'Tout ce qui a été fait hors ligne part automatiquement au retour du réseau.'],
        ], 'Cinq questions sur toute la formation. Chaque réponse est expliquée.'),
      ],
    },
  ],
};

// ===================================================================
// FORMATION 2 — Créer des devis qui signent (intermédiaire, ~1 h)
// ===================================================================
const DEVIS = {
  id: 'academie-devis',
  title: 'Créer des devis qui signent',
  author: AUTEUR,
  description: 'Du dimensionnement au devis signé : composer, présenter la fiche et le Simulateur ROI, envoyer, relancer — et personnaliser vos documents avec l’offre Pro. Niveau intermédiaire.',
  cover: COUVERTURE_DEVIS,
  modules: [
    {
      id: 'dv-m1',
      title: 'Anatomie d’un bon devis solaire',
      lecons: [
        lecon('dv-m1-l1', 'Ce que le client doit lire', '5 min', {
          objectif: 'savoir ce qu’un devis solaire doit contenir pour rassurer le client.',
          texte: [
            'Un bon devis répond à trois questions : qu’est-ce que j’achète, combien ça coûte en tout, et que se passe-t-il après ? Le devis de l’application range tout en deux blocs : « Équipements » et « Prestations ».',
            'Équipements : panneaux, onduleur hybride, batterie, protections et câbles, chacun avec sa quantité et son prix. Prestations : la main-d’œuvre de pose. Le total TTC conclut.',
            '[[schema:kit]]',
            'Ce schéma, expliquez-le avec le devis : les panneaux produisent, le régulateur MPPT de l’onduleur hybride en tire le maximum, la batterie stocke pour la nuit, et la maison reçoit du 230 V.',
            'Le bas du document porte les conditions : le devis est valable 30 jours, et la livraison se fait après réception de l’acompte convenu. Parlez aussi de la garantie de chaque équipement : c’est souvent elle qui décide le client.',
          ],
          exemple: 'face à un commerçant de Dantokpa qui compare avec un « kit pas cher » du marché, montrez ligne par ligne : batterie lithium, onduleur hybride, protections DC/AC, pose incluse. Le prix bas d’en face oublie souvent les protections et la pose.',
          erreurs: [
            'Envoyer un devis sans l’expliquer : le client ne compare que le total.',
            'Promettre une garantie que le fournisseur ne donne pas.',
            'Oublier la pose dans le prix annoncé à l’oral.',
          ],
          retenir: [
            'Équipements + Prestations = le total, sans surprise.',
            'Expliquez le chemin : panneaux → MPPT → onduleur → batterie → maison.',
            'Validité de 30 jours : rappelez-la, elle crée l’urgence.',
          ],
        }),
        quiz('dv-m1-quiz', 'Quiz — Le bon devis', '3 min', [
          ['Dans le devis de l’application, où se trouve la main-d’œuvre de pose ?',
            ['Elle n’apparaît pas', 'Dans « Équipements »', 'Dans « Prestations »'], 2,
            'La pose est une prestation : elle est séparée du matériel pour que le client voie ce qu’il paie.'],
          ['Quel élément tire le maximum d’énergie des panneaux ?',
            ['La batterie', 'Le régulateur MPPT de l’onduleur hybride', 'Le coffret AC'], 1,
            'Le MPPT, intégré à l’onduleur hybride, ajuste en permanence le point de fonctionnement des panneaux.'],
          ['Combien de temps un devis est-il valable par défaut ?',
            ['7 jours', '30 jours', '1 an'], 1,
            'Les conditions du devis indiquent une validité de 30 jours.'],
          ['Le client compare votre total avec un kit moins cher du marché. Votre meilleure réponse ?',
            ['Baisser votre prix tout de suite', 'Abandonner l’affaire', 'Montrer ligne par ligne ce que contient votre devis (protections, pose…)'], 2,
            'Le client compare souvent un kit incomplet à une installation complète : le détail du devis le montre.'],
        ]),
      ],
    },
    {
      id: 'dv-m2',
      title: 'Du dimensionnement au devis',
      lecons: [
        lecon('dv-m2-l1', 'Le kit suggéré', '6 min', {
          objectif: 'transformer un dimensionnement en devis chiffré, en quelques touches.',
          texte: [
            'À l’étape Résultat, l’application propose le kit le mieux adapté : la plus petite batterie qui couvre la nuit. Si plusieurs kits ont la même capacité, ils sont tous proposés : choisissez la marque ou la composition.',
            'Le nombre de panneaux est ajusté au besoin réel du client. Si l’onduleur du kit ne suffit pas pour ces panneaux, l’application en retient un adapté et l’explique dans un encadré.',
            'Réglez ensuite le « Type de support » (Tôle, Dalle, Au sol) et le « Réseau électrique » (Monophasé ou Triphasé). Cochez « Client a son propre soudeur » si la structure ne doit pas figurer au devis.',
            '[[schema:flux-devis]]',
            'Vérifiez les blocs Équipements et Prestations et le « Total TTC », puis touchez « Créer le devis pour … ». Il reçoit un numéro du type BS-20261015-0001.',
          ],
          exemple: 'pour un ménage de Porto-Novo, deux kits de 5 kWh sont proposés à des prix différents. Odile montre les deux au client, qui choisit la version qui lui convient.',
          erreurs: [
            'Ignorer l’encadré « Pic de consommation » : le client risque de faire disjoncter son onduleur.',
            'Laisser « Tôle » pour une pose sur dalle : le prix de la structure est faux.',
          ],
          retenir: [
            'Le kit est choisi sur la batterie, les panneaux sur le besoin.',
            'Le support change le prix : tôle, dalle ou au sol.',
            'Lisez toujours les encadrés : onduleur changé, pic non couvert.',
          ],
        }),
        lecon('dv-m2-l2', 'Brouillon, devis finalisé, devis à revoir', '4 min', {
          objectif: 'choisir le bon statut et corriger un devis sans le refaire.',
          texte: [
            'En bas de l’assistant, deux boutons : « Brouillon » garde le devis pour plus tard ; « Créer le devis » le finalise. Un brouillon n’est jamais compté parmi les devis sans suite.',
            'Dans l’onglet Devis, touchez un devis pour ouvrir ses actions : « Envoyer le devis sur WhatsApp », « Fiche de dimensionnement (PDF) », « Relancer par WhatsApp » et, pour un devis solaire, « Revoir le dimensionnement ».',
            '« Revoir le dimensionnement » rouvre l’étude avec tous les appareils : retirez un congélateur, et le même devis est mis à jour, avec le même numéro. Un brouillon, lui, se valide avec « Finaliser ».',
          ],
          exemple: 'le client de Bohicon renonce au congélateur. Au lieu de tout ressaisir, Serge ouvre « Revoir le dimensionnement », retire l’appareil, et le devis se recalcule avec un kit plus petit.',
          erreurs: [
            'Créer un nouveau devis à chaque modification : le client reçoit trois numéros différents.',
            'Envoyer un brouillon sans l’avoir vérifié.',
          ],
          retenir: [
            'Brouillon = pas encore montré au client.',
            '« Revoir le dimensionnement » corrige sans dupliquer.',
            'Un devis garde son numéro du début à la fin.',
          ],
        }),
        quiz('dv-m2-quiz', 'Quiz — Du dimensionnement au devis', '3 min', [
          ['Sur quoi l’application choisit-elle le kit suggéré ?',
            ['Sur la plus petite batterie qui couvre la nuit', 'Sur le kit le plus cher', 'Au hasard'], 0,
            'Le kit se choisit sur sa batterie ; les panneaux sont ensuite ajustés au besoin réel.'],
          ['Le client a déjà sa structure de montage. Que faites-vous ?',
            ['Rien, la structure reste au devis', 'Choisir « Au sol »', 'Cocher « Client a son propre soudeur »'], 2,
            'Cette case retire la ligne « Structure de montage » du devis.'],
          ['Le client change d’avis sur un appareil. Le bon geste ?',
            ['Refaire un devis neuf', '« Revoir le dimensionnement » sur le même devis', 'Supprimer le client'], 1,
            'Le même devis est recalculé, avec le même numéro : le client ne reçoit pas plusieurs devis.'],
          ['Un brouillon peut-il apparaître dans « Devis sans suite » ?',
            ['Oui, après 7 jours', 'Non, seuls les devis émis y apparaissent'], 1,
            'Un brouillon n’a jamais été montré au client : il ne peut pas être « sans suite ».'],
        ]),
      ],
    },
    {
      id: 'dv-m3',
      title: 'Présenter la fiche de dimensionnement',
      lecons: [
        lecon('dv-m3-l1', 'La fiche en trois pages', '5 min', {
          objectif: 'présenter la fiche technique pour justifier le prix.',
          texte: [
            'La « Fiche de dimensionnement (PDF) » est l’étude technique du besoin du client. Elle se produit depuis l’étape Résultat de l’assistant, ou depuis les actions d’un devis.',
            'Elle tient en trois pages : la page 1 liste les appareils du client et met en avant la puissance des panneaux, en kWc ; la page 2 donne les paramètres, le matériel et les résultats ; la page 3, l’analyse.',
            'La page 3 est celle qui convainc : la « Production mensuelle » sur l’année, l’« Économie annuelle », le « Retour sur investissement » et la maintenance prévue. Commencez par elle quand le client hésite.',
          ],
          exemple: 'M. Gbaguidi trouve le kit cher. Sylvie lui montre la page 3 : l’économie annuelle et le nombre d’années pour rembourser l’installation. La discussion passe du prix au placement.',
          erreurs: [
            'Envoyer la fiche sans la commenter : le client ne lit que le total.',
            'Annoncer une économie différente de celle de la fiche.',
          ],
          retenir: [
            'Page 1 : le besoin du client.',
            'Page 2 : le matériel et les résultats.',
            'Page 3 : l’argent — économie et retour sur investissement.',
          ],
        }),
        lecon('dv-m3-l2', 'Le Simulateur ROI face au client', '5 min', {
          objectif: 'montrer au client ce qu’il paie déjà, réseau et groupe électrogène compris.',
          texte: [
            'Plus → Simulateur ROI part de ce que le client paie aujourd’hui. Saisissez sa consommation « D’après ses appareils » ou « D’après sa facture », puis le pays : le prix du kWh de l’opérateur (SBEE, CEET, CIE…) se règle tout seul.',
            'Indiquez les « Coupures de courant » en heures par jour et cochez « Le client a un groupe électrogène », avec le prix du litre de gazole. L’écran compare alors le kWh au réseau et le kWh au groupe.',
            'En face, l’application place le kit qu’elle proposerait, avec son prix. Elle affiche le temps pour rembourser l’installation, l’économie de la 1re année et le gain sur la durée choisie : 10, 15 ou 25 ans.',
            'En bas, « Ce que le calcul suppose » liste les hypothèses. Lisez-les : un chiffre qu’on ne sait pas justifier ne vaut rien devant le client.',
          ],
          exemple: 'facture SBEE de 25 000 F, 4 h de coupure par jour, gazole à 750 F le litre : le kWh du groupe revient à 250 F, contre 115 F au réseau. Le client comprend pourquoi ses dépenses explosent pendant les coupures.',
          erreurs: [
            'Annoncer un remboursement plus rapide que celui affiché.',
            'Oublier les coupures : on sous-estime ce que le client dépense déjà.',
          ],
          retenir: [
            'Partez de ce que le client paie déjà.',
            'Le kWh au groupe coûte souvent plus du double du réseau.',
            'Choisissez la durée avec le client : 10, 15 ou 25 ans.',
          ],
        }),
        quiz('dv-m3-quiz', 'Quiz — Présenter les chiffres', '3 min', [
          ['Quelle page de la fiche montre l’économie annuelle et le retour sur investissement ?',
            ['La page 1', 'La page 2', 'La page 3'], 2,
            'La page 3, l’analyse, porte la production mensuelle, l’économie annuelle et le retour sur investissement.'],
          ['Gazole à 750 F le litre : combien coûte environ un kWh produit par le groupe ?',
            ['75 F', '250 F', '750 F'], 1,
            'Un groupe tire environ 3 kWh d’un litre : 750 ÷ 3 = 250 F le kWh, plus du double du réseau.'],
          ['Où trouver les hypothèses du Simulateur ROI ?',
            ['Dans « Ce que le calcul suppose »', 'Nulle part', 'Dans la Boutique'], 0,
            'Toutes les hypothèses y sont écrites, pour pouvoir les expliquer au client.'],
          ['Le client hésite sur le prix. Par quoi commencer ?',
            ['Baisser le prix', 'Parler d’un autre client', 'La page 3 de la fiche : économie et retour sur investissement'], 2,
            'Montrer ce que l’installation fait économiser change la question : le client compare un placement, plus un prix.'],
        ]),
      ],
    },
    {
      id: 'dv-m4',
      title: 'Envoyer, relancer, suivre',
      lecons: [
        lecon('dv-m4-l1', 'Envoyer le devis sur WhatsApp', '4 min', {
          objectif: 'faire arriver le devis chez le client, en PDF, au bon moment.',
          texte: [
            'Dans l’onglet Devis, touchez le devis puis « Envoyer le devis sur WhatsApp ». Le PDF est préparé et joint directement à la conversation du client.',
            'Envoyez-le pendant que l’intérêt est chaud : idéalement le jour de la visite. Ajoutez un message court qui reprend le besoin du client, avec ses mots.',
            'La « Fiche de dimensionnement (PDF) » se produit au même endroit. Pour garder le devis ou l’imprimer, il peut aussi être téléchargé en PDF.',
          ],
          exemple: 'message d’Ibrahim : « Bonsoir Mme Hounkpatin, voici le devis pour vos deux machines et le ventilateur, même pendant les coupures du soir. Je passe mardi répondre à vos questions. »',
          erreurs: [
            'Envoyer le devis sans un mot : il se perd dans la conversation.',
            'Attendre une semaine « pour laisser réfléchir ».',
          ],
          retenir: [
            'Le jour même de la visite, si possible.',
            'Un message court qui reprend le besoin du client.',
            'Proposez une date de rappel dans le message.',
          ],
        }),
        lecon('dv-m4-l2', 'Gérer les devis sans suite', '5 min', {
          objectif: 'relancer au bon moment, sans harceler.',
          texte: [
            'Un devis devient « sans suite » quand il a été émis il y a plus de 7 jours, qu’il est toujours en cours et qu’il n’a pas été relancé depuis. Le tableau de bord le compte dans la pastille « Devis sans suite ».',
            'Touchez cette pastille : l’onglet Devis s’ouvre sur le filtre « Sans suite ». Pour chaque devis, « Relancer par WhatsApp » ouvre un message déjà rédigé, avec le numéro du devis, son montant et sa date de fin de validité.',
            'La relance est notée sur le devis (« Dernière relance ») et il quitte la liste des sans suite. Si le client dit non, passez l’affaire en « Perdu » : un tableau propre vaut mieux qu’un faux espoir.',
          ],
          exemple: 'le devis BS-20261002-0004 de 1 180 000 F dort depuis 9 jours. Odile touche « Relancer par WhatsApp » ; le client répond le soir même : il attendait sa paie de fin de mois.',
          erreurs: [
            'Relancer tous les jours : le client finit par bloquer votre numéro.',
            'Laisser des affaires mortes gonfler le compteur au lieu de les passer en « Perdu ».',
          ],
          retenir: [
            '7 jours sans nouvelle : on relance.',
            'Le message de relance est déjà rédigé.',
            'Un « non » se range en « Perdu ».',
          ],
        }),
        quiz('dv-m4-quiz', 'Quiz — Envoyer et relancer', '3 min', [
          ['Quand un devis devient-il « sans suite » ?',
            ['Dès son envoi', 'Émis depuis plus de 7 jours, en cours, sans relance', 'Quand le client dit non'], 1,
            'Les trois conditions ensemble : plus de 7 jours, toujours en cours, aucune relance depuis l’envoi.'],
          ['Que contient le message de « Relancer par WhatsApp » ?',
            ['Rien, il faut tout écrire', 'Une publicité', 'Le numéro du devis, son montant et sa date de fin de validité'], 2,
            'Le message est pré-rempli : vous pouvez le personnaliser avant de l’envoyer.'],
          ['Le meilleur moment pour envoyer le devis ?',
            ['Le jour de la visite', 'Un mois après', 'Jamais par WhatsApp'], 0,
            'Le jour même, le client a encore la visite en tête et ses questions fraîches.'],
          ['Le client refuse définitivement. Que faire ?',
            ['Le relancer chaque jour', 'Passer l’affaire en « Perdu »', 'Supprimer son numéro'], 1,
            '« Perdu » garde la trace de l’affaire et laisse vos indicateurs justes.'],
        ]),
      ],
    },
    {
      id: 'dv-m5',
      title: 'Personnaliser ses devis avec l’offre Pro',
      lecons: [
        lecon('dv-m5-l1', 'Vos documents à votre nom', '5 min', {
          objectif: 'savoir ce que l’offre Pro change pour vos devis et vos factures.',
          texte: [
            'L’offre Pro (« Abonnement Devis Pro », dans Plus) vous donne votre propre espace : vos clients, vos devis et vos factures, à l’identité de VOTRE entreprise. Le dimensionnement et le suivi clients restent gratuits, avec ou sans Pro.',
            'Dans « Mon entreprise » : ajoutez votre logo (« Ajouter mon logo »), le nom et le slogan, vos coordonnées et le pays, puis choisissez le « Modèle de document » : Studio, Vague ou Sobre. Les couleurs sont détectées sur votre logo, et ajustables.',
            'Vous réglez aussi le préfixe des factures, votre numéro Mobile Money pour être payé, et les « Mentions / conditions (bas de document) » : c’est là que vous écrivez votre garantie.',
            'Trois formules : Pro Essentiel à 5 000 F par mois, Pro Confort à 12 750 F pour 3 mois, Pro Premium à 45 000 F par an, réglées par Mobile Money.',
          ],
          exemple: '« Soleil d’Atakora », petite entreprise de Natitingou, envoie désormais ses devis à son logo jaune et vert. Ses clients reconnaissent son entreprise du premier coup d’œil.',
          erreurs: [
            'Un logo flou, pris en photo : utilisez un fichier PNG ou JPG, fond transparent conseillé.',
            'Oublier le numéro Mobile Money : le client ne sait pas comment payer.',
          ],
          retenir: [
            'Pro = vos documents à votre nom, avec votre logo et vos couleurs.',
            'La garantie s’écrit dans les mentions du bas de document.',
            'Le dimensionnement reste gratuit, avec ou sans Pro.',
          ],
        }),
        quiz('dv-m5-quiz', 'Quiz — L’offre Pro', '2 min', [
          ['Où écrire la garantie qui apparaîtra sur vos documents Pro ?',
            ['Dans « Mentions / conditions (bas de document) »', 'Dans le nom de l’entreprise', 'On ne peut pas'], 0,
            'Ces mentions s’impriment en bas de chaque devis et de chaque facture.'],
          ['Combien coûte la formule Pro Essentiel ?',
            ['Elle est gratuite', '5 000 F par mois', '45 000 F par mois'], 1,
            'Pro Essentiel : 5 000 F par mois. Pro Confort : 12 750 F pour 3 mois. Pro Premium : 45 000 F par an.'],
          ['Sans abonnement Pro, le dimensionnement solaire est-il disponible ?',
            ['Oui, il reste gratuit', 'Non'], 0,
            'Le dimensionnement, les devis et le suivi clients sont gratuits ; Pro ajoute vos documents à votre nom.'],
        ]),
      ],
    },
    {
      id: 'dv-ex',
      title: 'Exercice pratique : un ménage à Parakou',
      lecons: [
        lecon('dv-ex-l1', 'Le cas complet, de la facture à la relance', '8 min', {
          objectif: 'dérouler un dossier complet, de la facture au devis relancé.',
          texte: [
            'Le cas : M. et Mme Bio, à Parakou, quartier Banikanni. Facture SBEE d’environ 25 000 F par mois. Télé et ventilateurs tournent surtout le soir, et les coupures sont fréquentes.',
            'Étape 1 — Créez le client (Plus → Clients → « Nouveau client »), avec le téléphone et le quartier. Notez : « coupures le soir, facture 25 000 F ».',
            'Étape 2 — Touchez +, puis « Dimensionnement solaire ». Choisissez le client, puis « Facture CEET/SBEE (F CFA) » : 25 000 F, prix du kWh 115 F. Essayez « Équilibré », puis « Surtout le soir », et comparez.',
            'Ce que vous devez trouver : environ 217 kWh par mois, soit 7,2 kWh par jour. En « Équilibré », une batterie conseillée d’environ 4,8 kWh ; en « Surtout le soir », d’environ 6,7 kWh, donc un kit plus grand.',
            'Étape 3 — À l’étape Résultat, notez le kit suggéré et son total. Avec les kits livrés par défaut dans l’application : le Kit 5 kWh en « Équilibré », le Kit 10 kWh en « Surtout le soir ». Vos montants suivent les kits de votre entreprise.',
            'Étape 4 — Ouvrez Plus → Simulateur ROI avec la même facture, 4 h de coupure et un groupe électrogène : montrez au couple le prix du kWh au groupe face au réseau.',
            'Étape 5 — Créez le devis, envoyez-le sur WhatsApp le jour même avec la fiche de dimensionnement, et proposez une date de rappel. Sans réponse après 7 jours : « Relancer par WhatsApp ».',
          ],
          exemple: 'comme le couple vit surtout le soir, Odile retient « Surtout le soir ». Le kit est plus grand, mais la batterie tient jusqu’au matin : c’est ce qu’elle explique avec la page 3 de la fiche.',
          erreurs: [
            'Dimensionner en « Équilibré » un ménage qui vit le soir : la batterie est vide avant minuit.',
            'Annoncer un prix avant d’avoir vu le résultat de l’assistant.',
          ],
          retenir: [
            'La répartition jour/soir change le kit : posez la question.',
            'Fiche + Simulateur ROI = l’argument chiffré.',
            'Envoi le jour même, relance à 7 jours.',
          ],
        }),
        quiz('dv-final-quiz', 'Quiz final — Créer des devis qui signent', '4 min', [
          ['Facture SBEE de 25 000 F à 115 F le kWh : consommation par jour, environ ?',
            ['2,4 kWh', '7,2 kWh', '21,7 kWh'], 1,
            '25 000 ÷ 115 ≈ 217 kWh par mois ; divisé par 30 jours, environ 7,2 kWh par jour.'],
          ['Le couple vit surtout le soir. Par rapport à « Équilibré », le kit…',
            ['est plus petit', 'est le même', 'est plus grand (batterie plus grosse)'], 2,
            'La consommation du soir passe par la batterie : il en faut une plus grosse.'],
          ['Quel document montre l’économie annuelle et le retour sur investissement ?',
            ['La Boutique', 'Le reçu Mobile Money', 'La page 3 de la fiche de dimensionnement'], 2,
            'La page 3 de la fiche, l’analyse, porte l’économie annuelle et le retour sur investissement.'],
          ['Sans nouvelle 7 jours après l’envoi, que faire ?',
            ['« Relancer par WhatsApp »', 'Refaire un devis', 'Attendre un mois'], 0,
            'Le message de relance est déjà rédigé, et la relance est notée sur le devis.'],
          ['Avec l’offre Pro, où écrit-on sa garantie ?',
            ['Dans « Mentions / conditions (bas de document) »', 'Dans le nom du client', 'Dans le préfixe des factures'], 0,
            'Ces mentions apparaissent en bas de chaque devis et facture Pro.'],
        ], 'Cinq questions sur toute la formation, dont le cas de Parakou. Chaque réponse est expliquée.'),
      ],
    },
  ],
};

// ===================================================================
// FORMATION 3 — Gagner de l'argent avec BestaSolar Pro (intermédiaire, ~1 h)
// ===================================================================
const REVENUS = {
  id: 'academie-revenus',
  title: 'Gagner de l’argent avec BestaSolar Pro',
  author: AUTEUR,
  description: 'Les sources de revenus d’une vente solaire, trouver ses clients, piloter son activité avec le tableau de bord, fidéliser — et un plan d’action sur 30 jours. Niveau intermédiaire.',
  cover: COUVERTURE_REVENUS,
  modules: [
    {
      id: 'rv-m1',
      title: 'Les sources de revenus',
      lecons: [
        lecon('rv-m1-l1', 'D’où vient l’argent', '7 min', {
          objectif: 'connaître les quatre sources de revenus d’une vente solaire.',
          texte: [
            'Une installation solaire peut vous rapporter de quatre façons : la marge sur le matériel, la pose, la maintenance et, si vous êtes partenaire BestaSolar, les commissions. Aucune n’est garantie : tout dépend de vos prix, de vos frais et de votre travail.',
            'Le matériel : la Boutique affiche les prix publics. Votre marge, c’est l’écart entre votre prix d’achat réel et le prix payé par le client, moins le transport et vos frais.',
            'La pose : c’est la ligne « Main d’œuvre » du devis. Au Togo, l’application la double automatiquement (sauf pour les kits haute tension).',
            '[[schema:marge]]',
            'La maintenance : l’application la compte 30 000 F par an pour moins de 10 panneaux, puis 50 000 F plus 2 000 F par panneau au-delà de 10. Proposez le contrat dès la signature.',
            'Les commissions : quand la vente d’un de vos clients est validée, vous touchez 3 % du devis (niveau 1) et votre parrain 1,5 % (niveau 2). Suivez-les dans Plus → Mon espace partenaire.',
          ],
          exemple: 'un Kit 5 kWh vendu 1 180 000 F à Cotonou : 75 000 F de pose, 35 400 F de commission (3 %), et 30 000 F par an si le client prend le contrat de maintenance.',
          erreurs: [
            'Brader la pose pour signer : c’est souvent votre vraie marge.',
            'Oublier le transport du matériel dans le calcul.',
            'Promettre au client un prix du matériel que vous ne maîtrisez pas.',
          ],
          retenir: [
            'Quatre sources : matériel, pose, maintenance, commissions.',
            'Calculez toujours APRÈS vos frais (transport, outillage).',
            'La maintenance rapporte chaque année, pas une seule fois.',
          ],
        }),
        quiz('rv-m1-quiz', 'Quiz — Les revenus', '3 min', [
          ['Quelle commission touchez-vous quand la vente d’un de vos clients est validée ?',
            ['1,5 % du devis', '3 % du devis', '10 % du devis'], 1,
            'Niveau 1 : 3 % pour le technicien propriétaire du client ; niveau 2 : 1,5 % pour son parrain.'],
          ['Une installation de 6 panneaux : quelle maintenance annuelle l’application prévoit-elle ?',
            ['30 000 F par an', '50 000 F par an', '62 000 F par an'], 0,
            'Moins de 10 panneaux : 30 000 F par an.'],
          ['Au Togo, la ligne « Main d’œuvre » d’un kit basse tension est…',
            ['la même qu’au Bénin', 'doublée automatiquement', 'supprimée'], 1,
            'L’application double la main-d’œuvre pour un chantier togolais, sauf pour les kits haute tension.'],
          ['Votre vraie marge sur le matériel, c’est…',
            ['Le prix public', 'Le total du devis', 'L’écart entre votre prix d’achat et le prix client, moins vos frais'], 2,
            'Le prix public n’est pas un bénéfice : seul l’écart, frais déduits, l’est.'],
        ]),
      ],
    },
    {
      id: 'rv-m2',
      title: 'Trouver ses clients',
      lecons: [
        lecon('rv-m2-l1', 'Quartier, WhatsApp, bouche-à-oreille', '5 min', {
          objectif: 'remplir votre liste de pistes sans budget publicitaire.',
          texte: [
            'Vos premiers clients sont autour de vous : voisins, commerçants du marché, églises, mosquées, associations. Ceux que les coupures font perdre de l’argent — boutiques, salons, ateliers, maquis — sont les plus pressés.',
            'Chaque contact intéressé devient une piste : Suivi clients → « Nouvelle piste ». Notez d’où il vient (« marché de Zongo », « recommandé par M. Bio ») : vous saurez ce qui marche.',
            'Sur WhatsApp, publiez en statut une installation terminée (avec l’accord du client) et un chiffre parlant tiré du Simulateur ROI, comme le prix du kWh au groupe électrogène.',
            'Après chaque installation réussie, demandez deux noms à votre client. Un client satisfait qui recommande, c’est la vente la plus facile.',
          ],
          exemple: 'à Sokodé, Aïcha fait le tour des salons de coiffure du quartier avec le Simulateur ROI. En deux semaines, elle a ouvert onze pistes.',
          erreurs: [
            'Noter les contacts dans un cahier au lieu de l’application : ils se perdent.',
            'Publier la photo d’un client sans son accord.',
          ],
          retenir: [
            'Visez d’abord ceux que les coupures font perdre de l’argent.',
            'Chaque contact = une piste, avec sa source.',
            'Après chaque pose : demandez deux noms.',
          ],
        }),
        lecon('rv-m2-l2', 'Votre lien de parrainage', '5 min', {
          objectif: 'faire travailler votre lien de parrainage pour vous.',
          texte: [
            'Dans Plus → Mon espace partenaire, vous trouvez votre code (NOM-XXXXXX) et vos liens : « Copier le lien » pour le site, et « Lien de l’app » pour l’application Android, avec votre code déjà rempli.',
            'Partagez-le dans vos statuts et vos groupes WhatsApp. Chaque ouverture est comptée dans « Clics sur mon lien » (une fois par personne et par 24 h), et chaque inscription dans « Inscriptions par mon lien ».',
            'Les personnes inscrites avec votre code deviennent vos filleuls (« Mes filleuls »). Quand leurs ventes sont validées, vous touchez le niveau 2 : 1,5 % du devis.',
            'Vos commissions s’accumulent dans « À réclamer ». Dès 5 000 F, « Demander un paiement » envoie la demande au gérant, qui règle sur votre numéro Mobile Money.',
          ],
          exemple: 'Koffi partage son lien dans le groupe WhatsApp des électriciens de Kpalimé. Trois collègues s’inscrivent avec son code et deviennent ses filleuls.',
          erreurs: [
            'Changer de numéro Mobile Money sans le mettre à jour dans « Mon réseau et mon paiement ».',
            'Partager une capture d’écran du code au lieu du lien : presque personne ne le recopie.',
          ],
          retenir: [
            'Votre code lie le filleul pour de bon.',
            '« Clics sur mon lien » dit si votre partage marche.',
            'Paiement des commissions dès 5 000 F, sur demande.',
          ],
        }),
        quiz('rv-m2-quiz', 'Quiz — Trouver ses clients', '3 min', [
          ['Quels clients viser en premier ?',
            ['Ceux que les coupures font perdre de l’argent (boutiques, salons, ateliers)', 'Ceux qui n’ont jamais de coupure', 'Uniquement les clients des concurrents'], 0,
            'Ceux qui perdent de l’argent à chaque coupure ont un besoin urgent : ils décident plus vite.'],
          ['Un nouveau contact est intéressé. Que faire dans l’application ?',
            ['Rien pour l’instant', 'L’ajouter dans la Boutique', 'Suivi clients → « Nouvelle piste », en notant d’où il vient'], 2,
            'La piste garde le contact, et la source vous dira plus tard quel canal fonctionne.'],
          ['Une personne inscrite avec votre code vend une installation validée. Que touchez-vous ?',
            ['Rien', '1,5 % du devis (niveau 2)', '50 %'], 1,
            'Le parrain touche le niveau 2 : 1,5 % des ventes validées de ses filleuls.'],
          ['À partir de quel montant pouvez-vous demander le paiement de vos commissions ?',
            ['500 F', '5 000 F', '100 000 F'], 1,
            '« Demander un paiement » s’ouvre dès 5 000 F à réclamer.'],
        ]),
      ],
    },
    {
      id: 'rv-m3',
      title: 'Piloter son activité avec le tableau de bord',
      lecons: [
        lecon('rv-m3-l1', 'Les bons chiffres à regarder', '7 min', {
          objectif: 'savoir où vous perdez vos ventes, grâce aux indicateurs.',
          texte: [
            'Une vente suit un entonnoir : beaucoup de contacts, moins de pistes sérieuses, encore moins de devis, et quelques ventes. Le tableau de bord mesure chaque étage.',
            '[[schema:entonnoir]]',
            'Regardez chaque semaine « Pistes actives », « Devis · ce mois » et « Gagnées · ce mois ». Dans « Indicateurs clés », le « Taux de conversion » et la « Transformation devis → commande » disent combien de devis deviennent des ventes.',
            'Beaucoup de pistes, peu de devis : vous ne visitez pas assez. Beaucoup de devis, peu de ventes : travaillez la présentation (fiche, Simulateur ROI) et les relances.',
            '« À relancer » et « Devis sans suite » sont vos listes de travail du jour. « Pistes par étape » montre où vos affaires s’entassent.',
          ],
          exemple: 'ce mois-ci, Rachidi a 20 pistes actives, 8 devis et 1 vente. Son problème n’est pas la prospection mais les relances : il traite ses 5 « Devis sans suite » dans la semaine.',
          erreurs: [
            'Ne regarder que le chiffre d’affaires.',
            'Garder des pistes mortes : elles faussent le taux de conversion.',
          ],
          retenir: [
            'Contacts → pistes → devis → ventes : trouvez l’étage qui fuit.',
            'Peu de devis : plus de visites. Peu de ventes : meilleures relances.',
            'Un coup d’œil par semaine, toujours au même moment.',
          ],
        }),
        quiz('rv-m3-quiz', 'Quiz — Les indicateurs', '3 min', [
          ['Beaucoup de pistes, très peu de devis. Le problème est surtout…',
            ['La relance', 'Les visites et les dimensionnements', 'Le prix'], 1,
            'Les pistes ne se transforment pas en devis : il faut visiter et dimensionner davantage.'],
          ['Beaucoup de devis, très peu de ventes. Que travailler ?',
            ['La prospection', 'Rien', 'La présentation et les relances'], 2,
            'Les clients reçoivent des devis mais ne signent pas : la fiche, le Simulateur ROI et les relances font la différence.'],
          ['Quel indicateur dit combien de devis deviennent des ventes ?',
            ['Nouvelles · 7j', 'Transformation devis → commande', 'Catalogue par catégorie'], 1,
            'Il compare les devis acceptés aux devis émis.'],
          ['Pourquoi passer en « Perdu » une affaire morte ?',
            ['Pour garder des indicateurs justes', 'Pour la cacher au gérant', 'Ce n’est pas utile'], 0,
            'Une affaire morte laissée ouverte fausse vos pistes actives et votre taux de conversion.'],
        ]),
      ],
    },
    {
      id: 'rv-m4',
      title: 'Fidéliser',
      lecons: [
        lecon('rv-m4-l1', 'SAV, maintenance, recommandations', '5 min', {
          objectif: 'transformer un client installé en revenus réguliers et en recommandations.',
          texte: [
            'Le travail ne s’arrête pas à la pose. Dans la semaine qui suit, appelez le client : tout fonctionne ? A-t-il compris l’écran de l’onduleur ? Ce simple appel évite beaucoup de pannes « mystère ».',
            'Proposez le contrat de maintenance annuel dès la signature : nettoyage des panneaux, serrage des connexions, contrôle de la batterie et des protections. La fiche de dimensionnement en affiche déjà le montant.',
            'Gardez la fiche du client à jour dans l’application, avec la date de pose dans les notes : vous saurez quand revenir.',
            'Un client satisfait est votre meilleur vendeur. Demandez-lui deux noms, et donnez-lui votre lien de parrainage à transmettre.',
          ],
          exemple: 'six mois après la pose, Serge repasse chez M. Akakpo à Aného pour nettoyer les panneaux couverts de poussière d’harmattan. Le voisin, qui regardait, lui demande un devis.',
          erreurs: [
            'Disparaître après l’encaissement : le client raconte la panne à tout le quartier.',
            'Laisser la poussière d’harmattan sur les panneaux : la production chute.',
          ],
          retenir: [
            'Un appel la première semaine.',
            'Le contrat de maintenance se propose à la signature.',
            'Chaque visite de maintenance peut amener une nouvelle vente.',
          ],
        }),
        quiz('rv-m4-quiz', 'Quiz — Fidéliser', '3 min', [
          ['Quand proposer le contrat de maintenance ?',
            ['Après la première panne', 'Jamais', 'Dès la signature'], 2,
            'À la signature, le client est en confiance et voit le montant sur la fiche de dimensionnement.'],
          ['Pourquoi appeler le client la semaine qui suit la pose ?',
            ['Ce n’est pas utile', 'Pour lui vendre un autre kit tout de suite', 'Pour vérifier que tout marche et qu’il sait utiliser son installation'], 2,
            'Un client qui comprend son installation l’utilise bien, et la recommande.'],
          ['En saison d’harmattan, que faire en priorité lors d’une visite ?',
            ['Nettoyer les panneaux', 'Changer la batterie', 'Rien'], 0,
            'La poussière sur les panneaux fait chuter la production : un nettoyage la rétablit.'],
        ]),
      ],
    },
    {
      id: 'rv-m5',
      title: 'Plan d’action sur 30 jours',
      lecons: [
        lecon('rv-m5-l1', 'Semaine par semaine', '8 min', {
          objectif: 'organiser vos 30 prochains jours pour viser vos 5 premiers clients.',
          texte: [
            'Cinq clients en 30 jours, c’est un objectif, pas une promesse : tout dépend de votre zone, de vos prix et du temps que vous y mettez. Le plan ci-dessous vous donne une méthode.',
            [
              'Semaine 1 — Préparer :',
              '- Terminer les formations « Démarrer » et « Créer des devis qui signent ».',
              '- Connaître vos kits et leurs prix dans l’application.',
              '- Préparer votre lien de parrainage et un message WhatsApp de présentation.',
            ].join('\n'),
            [
              'Semaine 2 — Prospecter :',
              '- Ouvrir 20 pistes dans Suivi clients (voisins, commerçants, ateliers).',
              '- Noter la source de chaque contact.',
              '- Faire le Simulateur ROI avec les plus pressés.',
            ].join('\n'),
            [
              'Semaine 3 — Visiter et chiffrer :',
              '- Visiter au moins 8 clients.',
              '- Faire leur dimensionnement et leur devis le jour même.',
              '- Envoyer devis et fiche sur WhatsApp.',
            ].join('\n'),
            [
              'Semaine 4 — Relancer et signer :',
              '- Traiter chaque « Devis sans suite ».',
              '- Passer les « non » en « Perdu ».',
              '- À chaque signature : contrat de maintenance et deux noms demandés.',
            ].join('\n'),
          ],
          exemple: 'le premier mois, Adjoa a ouvert 20 pistes, fait 9 devis et signé 2 ventes. Le deuxième mois, ses premiers clients lui ont recommandé quatre voisins.',
          erreurs: [
            'Prospecter sans jamais relancer.',
            'Viser trop large : commencez par votre quartier.',
          ],
          retenir: [
            'Une semaine, un objectif.',
            'Tout passe par l’application : pistes, devis, relances.',
            'Faites le point chaque vendredi avec le tableau de bord.',
          ],
        }),
        {
          id: 'rv-m5-l2',
          title: 'La checklist des 30 jours (PDF)',
          type: 'pdf',
          duration: '2 min',
          url: '/formations/checklist-30-jours.pdf',
          description: 'Le plan des 30 jours en une page, à imprimer ou à garder sur votre téléphone. Cochez chaque action au fil des semaines.',
          actionTitle: 'L’essentiel',
          actionContent: [
            '- Une page, quatre semaines, une case par action.',
            '- Gardez-la à côté de votre tableau de bord.',
          ].join('\n'),
        },
        quiz('rv-final-quiz', 'Quiz final — Gagner de l’argent avec BestaSolar Pro', '5 min', [
          ['Quelles sont les quatre sources de revenus d’une vente solaire ?',
            ['Matériel, pose, maintenance, commissions', 'Seulement le matériel', 'Publicité, transport, pose, matériel'], 0,
            'Le matériel, la pose, la maintenance chaque année et, pour un partenaire BestaSolar, les commissions.'],
          ['Votre filleul vend une installation validée. Vous touchez…',
            ['3 %', '1,5 %', 'rien'], 1,
            'Le parrain touche le niveau 2 : 1,5 % du devis.'],
          ['Beaucoup de devis, peu de ventes. La priorité ?',
            ['Ouvrir plus de pistes', 'Baisser tous les prix', 'Mieux présenter et relancer'], 2,
            'Les devis existent : c’est la présentation et les relances qui les transforment.'],
          ['Que proposer à la signature pour un revenu chaque année ?',
            ['Le contrat de maintenance', 'Un deuxième onduleur', 'Rien'], 0,
            'La maintenance rapporte chaque année et garde le lien avec le client.'],
          ['Le plan de 30 jours garantit-il 5 clients ?',
            ['Oui, toujours', 'Non : c’est une méthode, le résultat dépend de votre zone et de votre travail'], 1,
            'Aucun résultat n’est garanti : le plan organise votre travail, il ne remplace pas le terrain.'],
        ], 'Cinq questions sur toute la formation. Chaque réponse est expliquée.'),
      ],
    },
  ],
};

export const FORMATIONS_ACADEMIE = [DEMARRER, DEVIS, REVENUS];
