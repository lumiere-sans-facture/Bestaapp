# Sauvegarde automatique de la production

Le workflow **Sauvegarde quotidienne** exporte chaque nuit les données métier de
Supabase, les compresse, calcule leur empreinte SHA-256 puis les pousse dans un
dépôt GitHub privé séparé. Il peut aussi être lancé manuellement.

## Mise en service (une seule fois)

### 1. Créer le dépôt privé

Dans l’organisation ou le compte qui possède `Bestaapp`, créer le dépôt :

- nom : `bestasolar-sauvegardes` ;
- visibilité : **Private** ;
- cocher **Add a README file** afin que la branche `main` existe.

Ne jamais rendre ce dépôt public : il contient les données métier des clients.

### 2. Créer le jeton restreint

Dans GitHub, ouvrir **Settings → Developer settings → Personal access tokens →
Fine-grained tokens**, puis créer un jeton :

- accès au propriétaire de `bestasolar-sauvegardes` ;
- accès uniquement au dépôt `bestasolar-sauvegardes` ;
- permission **Contents: Read and write** ;
- aucune autre permission ;
- expiration la plus longue autorisée, avec un rappel avant expiration.

Copier le jeton directement dans le secret GitHub décrit ci-dessous. Ne jamais
le placer dans un fichier, une issue, un message ou le dépôt.

### 3. Ajouter les secrets à `Bestaapp`

Dans **Bestaapp → Settings → Secrets and variables → Actions**, créer :

| Secret | Valeur |
|---|---|
| `SUPABASE_URL` | URL du projet Supabase de production (`https://…supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | clé `service_role` du projet de production |
| `SAUVEGARDES_TOKEN` | jeton GitHub restreint créé à l’étape 2 |

La clé `service_role` contourne toutes les règles RLS. Elle ne doit jamais être
utilisée côté navigateur, préfixée par `VITE_`, écrite dans `.env` suivi par Git
ou copiée dans une conversation.

### 4. Faire la recette

Ouvrir **Bestaapp → Actions → Sauvegarde quotidienne → Run workflow**.
L’exécution doit finir en vert. Vérifier ensuite dans le dépôt privé :

`sauvegardes/AAAA/MM/`

Chaque sauvegarde comprend :

- l’archive `*.json.gz` ;
- son empreinte `*.sha256` ;
- le manifeste `*.manifest.json` (nombre de lignes par table).

La planification ne s’exécute que lorsque le workflow est sur la branche par
défaut `main`. L’horaire est 02 h 17 au Bénin et au Togo.

## Données incluses

L’export couvre les organisations, profils métier, catalogue, kits, onduleurs,
clients, partenaires, commissions, devis, commandes, formations, abonnements,
paiements métier, sociétés, factures, clients Pro, demandes de retrait,
tombstones, codes promotionnels, paiements vérifiés et file de synchronisation
Google Contacts. Les tables absentes d’une ancienne installation sont indiquées
dans le manifeste sans rendre la sauvegarde inutilisable.

## Exclusions volontaires

- **Comptes Supabase Auth (`auth.users`)** : ils devront être réinvités après
  une reconstruction. Les profils métier de la table `profiles` sont sauvegardés.
- **Jetons Google Contacts** : `google_contacts_configs`, états OAuth et verrous
  sont exclus. Le compte Google devra être reconnecté après restauration.
- **Secrets d’environnement** (Vercel, Supabase, GitHub) : à conserver dans un
  coffre-fort séparé.
- **Base de recette/staging** : seul le projet indiqué par `SUPABASE_URL` est
  exporté.

## Vérification et restauration

Avant toute restauration, travailler sur un nouveau projet Supabase de test :

1. télécharger l’archive et le fichier `.sha256` ;
2. vérifier l’empreinte avec `sha256sum -c <fichier>.sha256` ;
3. décompresser le JSON ;
4. recréer d’abord le schéma avec les scripts du dossier `supabase/` ;
5. réimporter les tables en respectant les dépendances (`orgs`, puis `profiles`,
   puis les collections métier) ;
6. contrôler les nombres de lignes avec le manifeste ;
7. seulement après validation, planifier la restauration de production.

Une restauration de production ne doit jamais être automatisée depuis ce
workflow : elle nécessite une validation humaine, une fenêtre de maintenance et
une sauvegarde supplémentaire de l’état à remplacer.
