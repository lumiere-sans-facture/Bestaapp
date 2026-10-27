# Vérifications en navigateur réel

Ces scénarios pilotent l'application dans un vrai navigateur, comme un
utilisateur. Ils existent parce que plusieurs défauts n'étaient visibles
qu'à l'usage et invisibles aux tests unitaires :

- un champ de formulaire qui perdait le focus à chaque caractère ;
- un écran blanc causé par une variable supprimée mais encore référencée ;
- un écran d'administration resté ouvert à un simple utilisateur après une
  reconnexion, l'adresse ayant survécu à la déconnexion.

## Lancer

```bash
npm run dev                 # dans un terminal
node e2e/suivi-clients.mjs  # dans un autre
node e2e/commissions.mjs
node e2e/validation.mjs
node e2e/espace-partenaire.mjs
node e2e/acces-sections.mjs
node e2e/mes-kits.mjs
node e2e/demande-paiement.mjs
node e2e/formulaire-client.mjs
node e2e/landing.mjs
node e2e/abonnement-inscription.mjs
```

Chaque scénario prépare son propre jeu de données (mode local, sans backend)
puis vérifie ce que l'utilisateur voit réellement à l'écran.

## Ce qui est couvert

| Fichier | Vérifie |
|---|---|
| `suivi-clients.mjs` | Deux devis d'un même client donnent deux cartes distinctes, dans des colonnes différentes, chacune avec son numéro et son montant ; un client sans devis garde sa carte de prospection ; la barre de progression est présente ; déplacer une affaire ne touche pas l'autre. |
| `validation.mjs` | Le commercial demande une progression (rien ne bouge, bandeau « en attente », puce sur la carte, pas de bouton Valider chez lui) ; le gérant voit la barre « Progressions à valider » avec client, étape et demandeur, puis valide (l'étape s'applique) ou refuse (l'étape reste) ; le gérant, lui, agit directement sans créer de demande. |
| `commissions.mjs` | Une affaire passée à « Gagné » crée la commission **automatiquement**, au bon montant, rattachée au bon devis ; deux affaires gagnées donnent deux commissions sans doublon ; elles apparaissent dans l'écran Commissions. Réseau à deux niveaux : l'apporteur touche 3 % **et son parrain 1,5 %**. |
| `acces-sections.mjs` | Un simple utilisateur ne peut atteindre AUCUNE section d'administration (`partners`, `commissions`, `orders`, `team`, `backup`, `subsadmin`), même en tapant l'adresse : renvoi au menu, aucun montant ni bouton d'action affiché, aucun lien dans la barre latérale. Ses propres sections restent ouvertes, et le gérant garde tout. |
| `demande-paiement.mjs` | Le partenaire voit son solde mobilisable (hors commissions déjà payées), demande le règlement de commissions précises — tout ou partie — et ne peut pas en lancer une seconde sur le même argent ; rien n'est payé tant que le gérant n'a pas tranché ; le gérant reçoit la demande dans l'écran Commissions avec le numéro à créditer, la règle avec sa référence de transaction (les commissions couvertes passent « payées », référence reportée) ou la refuse avec motif — le refus libère les commissions. |
| `mes-kits.mjs` | Les kits solaires sont récupérés dans les données (5), affichés et chiffrés ; modifier un prix se recalcule à la saisie, s'enregistre et ne change ni l'identifiant ni le nombre de kits ; création, duplication et suppression ; un kit d'origine supprimé est signalé et peut être remis **sans écraser** les prix ajustés ; la section est fermée à un simple utilisateur. |
| `formulaire-client.mjs` | Le formulaire « Nouveau client » (Clients et Suivi clients) adapte ses champs au type choisi : « Nom complet » seul pour un particulier (son contact reprend automatiquement son nom, aucune ligne redondante dans sa fiche) ; « Nom de l'entreprise » **et** « Personne de contact » distincts pour une entreprise. |
| `espace-partenaire.mjs` | Le profil ne parle plus d'argent (ni tuiles de commissions, ni Mobile Money, ni affaires gagnées, ni le mot « commission ») ; l'espace partenaire porte tout : affaires gagnées, historique complet des commissions (niveau et taux, devis d'origine, date de paiement, à encaisser d'abord) et Mobile Money. Ses sections sont repliées à l'ouverture — la page tient sur un écran, chaque en-tête annonce son compte et son montant, et chacune s'ouvre au clic. |
| `landing.mjs` | La page publique d'accueil : un visiteur non connecté arrive sur la vitrine et non sur le formulaire ; toutes ses sections sont présentes ; les onglets de schémas n'en montrent qu'un à la fois et le bon ; l'accordéon FAQ s'ouvre et se referme ; les appels à l'action mènent à `/inscription` ; le lien légal ouvre la page de confidentialité ; aucun débordement horizontal sur mobile. |
| `abonnement-inscription.mjs` | Le client qui choisit une formule sur la page d'accueil arrive au paiement de CETTE formule : chaque carte de tarif porte son identifiant, l'adresse est nettoyée après capture, une formule inventée est ignorée ; le compte créé ouvre la fiche d'abonnement avec la bonne formule pré-sélectionnée, son tarif et sa durée ; changer de formule change le montant engagé ; sans choix, rien ne change ; un abonné actif n'est jamais renvoyé au paiement. |
| `parrainage-serveur.mjs` | *(Supabase simulé, voir l'en-tête du fichier)* Un visiteur ANONYME sur `/r/CODE` ou `?ref=CODE` : le clic part au serveur avec l'identifiant anonyme du navigateur, l'adresse est nettoyée, le code gardé pour l'inscription. Le technicien voit son parrain (définitif), ses filleuls et ce qu'ils lui ont rapporté, ses clics, inscriptions et taux de conversion, ses commissions avec leur niveau, leur taux, le filleul et le devis d'origine, et les sous-totaux par niveau ; le gérant voit les sous-totaux et lance le rattrapage, fait par le serveur. Les fonctions SQL elles-mêmes sont testées sur un vrai PostgreSQL : `supabase/tests/lancer.sh`. |
| `brouillons-boutique.mjs` | *(Supabase simulé)* Sur téléphone, le gérant de BestaSolar voit dès l'arrivée en boutique le bandeau « N produits en brouillon » et la puce « Brouillons » (dans l'écran, juste après « Tous ») ; « Voir » n'affiche que les brouillons, aucun ne se met au panier ; publier un produit part au serveur. Le gérant d'une entreprise Pro, qui reçoit le même catalogue, ne voit ni bandeau, ni puce, ni brouillon — seulement le produit publié. |
| `deux-appareils.mjs` | *(Supabase simulé)* Une modification faite sur un appareil n'est pas effacée par l'autre : seules les fiches modifiées partent, une fiche changée ailleurs est recalée avant l'envoi, et un appareil neuf ne réinitialise pas le profil partenaire. |
| `facture-acomptes.mjs` | Facture à acomptes (espace Pro) : le devis converti propose un objet tiré de ses lignes (262 panneaux, sans compter la « structure des panneaux ») ; l'échéancier en trois tranches bloque la création tant qu'il n'égale pas le total ; l'acompte de 11 000 000 F laisse 55 876 000 F à payer, échéances « Reçu · Attendu · À venir » ; la saisie suivante propose le complément ; un trop-perçu se confirme avant d'être enregistré ; correction et suppression d'un paiement ; filtres « Impayées » et « Annulées », annulation puis rétablissement ; un ancien paiement rangé dans la facture est repris dans la collection ; « Mon entreprise » enregistre CNSS, mention fiscale, banque, modes de paiement, signataire et cachet ; sur téléphone, la fiche ne déborde pas. |
| `paiements-deux-appareils.mjs` | *(Supabase simulé)* Deux appareils encaissent la même facture : chacun n'envoie que SON paiement, les deux restent sur le serveur et s'additionnent ; une suppression part en pierre tombale sans toucher au paiement de l'autre ; sur une base pas encore migrée (table `facturePaiements` absente), l'encaissement reste sur l'appareil et la facture continue de se synchroniser. |
| `devis-modification.mjs` | *(Supabase simulé)* Modifier un devis pendant que l'app se synchronise : une ligne enregistrée garde sa nouvelle valeur après une relecture du serveur ; deux modifications successives arrivent toutes les deux au serveur ; une ligne en cours de saisie n'est ni refermée ni effacée ; une relecture lente, partie juste avant l'enregistrement, ne ramène pas l'ancienne version. |
| `facture-pdf.mjs` | La facture à acomptes imprimée, aux trois modèles : « Arrêtée la présente facture… » (total et reste en toutes lettres), acompte déduit et reste à payer 55 876 000 F, échéancier « Reçu · Attendu · À venir », modes de paiement avec leurs coordonnées, signataire, CNSS, mention fiscale ; signature et cachet imprimés (sauf Sobre, sans image) ; aucune page ne déborde, la dernière porte des lignes avec les totaux, le PDF a autant de pages que l'aperçu. Puis le reçu du paiement (PDF d'une page, `Recu-FAC-…-R1-…`), son envoi, et l'aperçu de « Mon entreprise ». |
| `pagination-factures.mjs` | La découpe des factures en pages, mesurée dans le navigateur sur le HTML même du PDF : trois modèles × huit cas (exemple de référence, désignations longues ou en capitales, deux versements et logo, règlement minimal, logo seul, émetteur BestaSolar, cas extrême) × 1 à 40 lignes. Rien ne déborde ; les totaux ne partent jamais seuls sur une page. |

Les scénarios tournent en mode local (sans backend) : ils couvrent le circuit
à l'intérieur d'une organisation. La remontée des demandes et commissions des
AUTRES organisations passe par des fonctions serveur, éprouvées à part sur une
base PostgreSQL locale.
