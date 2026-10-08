# Sauvegarde automatique quotidienne

Chaque nuit à **02h17** (heure de Lomé), la base Supabase de **production** est
exportée dans un fichier JSON déposé sur un dépôt GitHub **privé**. Sept
sauvegardes sont conservées : la plus ancienne est supprimée à chaque dépôt.

| | |
|---|---|
| Tâche planifiée | `.github/workflows/sauvegarde-quotidienne.yml` |
| Script | `scripts/sauvegarde-supabase.mjs` |
| Logique pure + tests | `src/utils/sauvegardeAuto.js`, `src/utils/__tests__/sauvegardeAuto.test.js` |
| Dépôt de dépôt | `lumiere-sans-facture/bestasolar-sauvegardes` (privé) |
| Fichier produit | `bestasolar-sauvegarde-AAAA-MM-JJ.json` |

Le fichier a **exactement la forme de l'export manuel** (`Plus › Sauvegarde des
données`). La sauvegarde de cette nuit se restaure donc par le bouton existant,
sans outil à installer.

> **Pourquoi un second dépôt, privé ?** `Bestaapp` est public. Déposer l'export
> des clients sur une de ses branches publierait chaque nuit leurs noms,
> téléphones, adresses, devis et factures sur Internet. Les artefacts d'un dépôt
> public sont également téléchargeables par n'importe qui : ils ne conviennent
> pas davantage.

## Mise en route (une seule fois)

### 1. Créer le dépôt de sauvegardes

Sur GitHub : **New repository** → nom `bestasolar-sauvegardes`, visibilité
**Private**, et **coche « Add a README file »**. Un dépôt complètement vide n'a
pas de branche, et la tâche échouerait à le récupérer.

### 2. Créer un jeton d'accès

Settings du compte → **Developer settings** → **Personal access tokens** →
**Fine-grained tokens** → *Generate new token* :

- **Repository access** : *Only select repositories* → `bestasolar-sauvegardes`
- **Permissions** → *Repository permissions* → **Contents : Read and write**
- **Expiration** : le plus long possible, ou *No expiration*

⚠️ **Un jeton expiré arrête les sauvegardes.** La tâche passera au rouge et
GitHub t'enverra un e-mail, mais personne ne surveille une tâche qui réussit
depuis six mois : note la date d'expiration dans ton agenda.

### 3. Renseigner les trois secrets

Dans `Bestaapp` → **Settings › Secrets and variables › Actions** → *New
repository secret* :

| Secret | Valeur |
|---|---|
| `SUPABASE_URL` | adresse du projet Supabase de **production** (`https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | clé `service_role` du projet de production (Settings › API) |
| `SAUVEGARDES_TOKEN` | le jeton créé à l'étape 2 |

La clé `service_role` contourne les règles de sécurité (RLS) : c'est ce qui
permet de lire les lignes de **toutes** les entreprises. Elle ne doit jamais
sortir des secrets du dépôt — ni dans un fichier, ni dans un commit.

### 4. Essayer la tâche à la main

Onglet **Actions** → *Sauvegarde quotidienne* → **Run workflow**. Au bout d'une
minute, le dépôt privé doit contenir le fichier du jour et un
`DERNIERE-SAUVEGARDE.md` récapitulant les lignes par table.

> **GitHub ne déclenche les tâches planifiées que depuis la branche par
> défaut.** Le réveil automatique de 02h17 n'existera donc **qu'après la fusion
> en `main`**. Avant cela, seul « Run workflow » fonctionne.

## Vérifier que ça tourne encore

Une sauvegarde qu'on croit faite et qui ne l'est plus est le piège classique.
Trois réflexes :

- **`DERNIERE-SAUVEGARDE.md`** dans le dépôt privé : sa date doit être celle
  d'hier ou d'aujourd'hui. C'est le coup d'œil le plus rapide.
- **Un échec est signalé** : GitHub envoie un e-mail au propriétaire du dépôt
  dès qu'une tâche planifiée échoue.
- **GitHub suspend les tâches planifiées d'un dépôt inactif pendant 60 jours.**
  Tant qu'on développe, le cas ne se présente pas ; après une longue pause, il
  faut les réactiver depuis l'onglet Actions.

## Restaurer

### Les données métier — par l'application

1. Télécharger le fichier `bestasolar-sauvegarde-AAAA-MM-JJ.json` du dépôt privé.
2. Dans l'app, en gérant : `Plus › Sauvegarde des données › Restaurer`.
3. Confirmer. **La restauration remplace les données de toute l'équipe** : tout
   ce qui a été créé depuis cette sauvegarde est perdu. L'écran le rappelle.

### Les tables de structure — par SQL

Le fichier contient aussi `orgs`, `profiles`, `codes_promo`,
`codes_promo_utilisations`, `paiements_verifies` et `tombstones`. L'application
ne les réplique pas : le bouton de restauration les **ignore**. Pour reconstruire
une base de zéro, il faut rejouer les scripts de `supabase/`, puis réinjecter ces
tables à la main depuis le JSON (SQL Editor).

## Ce qui n'est PAS sauvegardé

Il faut le savoir avant d'en avoir besoin :

- **Les comptes de connexion** (`auth.users` de Supabase). Après une
  reconstruction, les membres doivent être réinvités et refaire un mot de passe.
  Leurs profils métier, eux, sont dans la sauvegarde.
- **Les jetons Google Contacts** (`google_contacts_*`), volontairement exclus :
  un secret n'a rien à faire dans une sauvegarde qu'on recopie. La connexion
  Google est à refaire.
- **Le journal d'erreurs** (`erreurs`), sans valeur métier.
- **Les compteurs de numérotation du navigateur** (`devisCounter`,
  `orderCounter`) : ils vivent dans le `localStorage`, pas en base. Ce n'est pas
  une perte — à la restauration, une clé absente est laissée telle quelle, donc
  la numérotation en cours n'est pas écrasée.
- **La base de recette.** Seule la production est sauvegardée.
- **Le code**, déjà sur GitHub.

## Changer la rétention

`JOURS_GARDES` en tête de `.github/workflows/sauvegarde-quotidienne.yml`. Les
fichiers excédentaires sont supprimés au dépôt suivant. Un fichier qui n'est pas
une sauvegarde (README, résumé) n'est jamais touché.
