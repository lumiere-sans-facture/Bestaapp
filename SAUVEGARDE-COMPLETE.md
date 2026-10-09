# Deuxième sauvegarde : PostgreSQL, Auth et fichiers Storage

Cette protection complète la sauvegarde JSON métier existante. Elle sauvegarde
les comptes de connexion (`auth.users`, hashes de mots de passe, identités), les
données métier et les objets Storage. Elle ne constitue pas une image de toute
la plateforme Supabase/Vercel/Google. Une restauration avec reconnexion doit
être testée avant de déclarer le plan de reprise validé.

## Mise en service

Dans Bestaapp → Settings → Secrets and variables → Actions, conserver les secrets
existants SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY et SAUVEGARDES_TOKEN. Ajouter :

| Secret | Contenu |
| --- | --- |
| BACKUP_DB_PASSWORD | Mot de passe PostgreSQL de **production**, pas la clé API |
| BACKUP_ENCRYPTION_PASSPHRASE | Phrase aléatoire d'au moins 32 caractères, une seule ligne |
| BACKUP_RECOVERY_CONFIG_JSON | Facultatif : inventaire JSON privé des réglages et secrets de reprise |

La connexion vérifiée dans le dashboard est le Session pooler sur
`aws-0-eu-west-1.pooler.supabase.com:5432`, utilisateur
`postgres.ujllvzkhqlabxpoyidor`, base `postgres`. SSL est requis. Le script
refuse d'utiliser une URL Storage d'un autre projet.

**Conserver la phrase de chiffrement hors de GitHub**, dans un gestionnaire de
mots de passe, avec une seconde copie sécurisée. GitHub ne permet pas de relire
un secret enregistré. Perdre cette phrase rend les copies chiffrées inutilisables.
Ne jamais la mettre dans un fichier suivi par Git, un journal ou une conversation.

Lancer Actions → **Sauvegarde complète chiffrée** → Run workflow sur `main`.
Après une exécution réussie et vérification des copies, créer la variable Actions
`BACKUP_COMPLETE_ENABLED` avec la valeur `true`. Le calendrier est alors actif
à 02:47 UTC (Lomé), soit 03:47 au Bénin. GitHub peut retarder l'exécution.
La sauvegarde JSON de 02:17 UTC reste indépendante.

## Contenu et protections

- `roles.sql`, `schema.sql`, `data.sql` : exports CLI officiels Supabase 2.120.0.
  Un contrôle refuse un export sans `auth.users`, sans `auth.identities` ou sans
  colonne `encrypted_password`. Les mots de passe ne sont pas en clair : ce sont
  leurs hashes existants. Les identifiants des utilisateurs sont conservés.
- `managed-schema.sql` : référence des objets `auth` et `storage`, notamment les
  personnalisations. Ne pas l'importer intégralement par-dessus les schémas gérés.
- `storage.json` et `storage/` : configuration des buckets, noms originaux,
  métadonnées, fichiers téléchargés et empreintes SHA-256. Le script parcourt
  les dossiers et toutes les pages; une erreur de copie fait échouer l'ensemble.
- `supabase-source/` : SQL/migrations et fonctions Edge présents au commit exporté.
- `manifest.json` : date, commit, nombre de comptes/fichiers et limites de reprise.
- `recovery-config.json` seulement si le secret facultatif a été renseigné.

Les fichiers temporaires en clair restent hors des checkouts. Une archive gzip
est chiffrée par GnuPG AES-256, puis déchiffrée et comparée avant publication.
Seuls les fragments chiffrés et leurs empreintes sont poussés dans le dépôt
**privé** `bestasolar-sauvegardes/completes-chiffrees/AAAA-MM-JJ/`.
Aucun artefact de sauvegarde n'est publié dans le dépôt applicatif public.
Les journaux affichent des compteurs, jamais les lignes clients ni les secrets.

Conservation dans la branche courante : 7 dates récentes et une copie par semaine
pour les 4 semaines les plus récentes. **Git conserve les anciennes versions dans
son historique** : la rétention n'efface pas physiquement ces anciennes copies.
La taille du dépôt continuera donc à croître. Au-delà d'un volume raisonnable,
prévoir un stockage d'objets avec expiration, plutôt que réécrire l'historique.
Les fragments font au plus 40 Mio; le script refuse plus de 2 Gio de fichiers
Storage. Cette destination convient au petit volume initial, à surveiller.

## Limites à connaître et inventaire de reprise

La sauvegarde est un export logique. Le SQL des données provient d'un dump
PostgreSQL; les schémas et les fichiers Storage sont lus séparément. Ce n'est pas
un snapshot atomique de toute l'application. Éviter les migrations de schéma et
les suppressions de fichiers pendant l'export. Les changements depuis le dernier
export ne sont pas récupérables.

Le CLI exclut notamment Vault/pgsodium et les données d'historique
`supabase_migrations`. Si Vault ou du chiffrement de colonnes est utilisé, exporter
les éléments requis et conserver la clé racine selon la documentation officielle
avant de considérer la reconstruction couverte. Les fichiers de migrations du
dépôt sont inclus, mais ne prouvent pas quelles migrations ont été appliquées.

Conserver dans un coffre-fort l'inventaire des paramètres **effectifs** :

- Auth : Site URL, Redirect URLs, Google Client ID/secret, SMTP, templates, MFA;
- fonctions Edge : versions déployées et variables secrètes;
- Vercel et Android : variables, domaine/DNS, signature et configuration Google;
- extensions, publications Realtime, webhooks, tâches cron et réglages Storage;
- clés de chiffrement externes si utilisées.

Le code source copié ne prouve pas qu'il est identique aux fonctions déployées.
Les jetons Google présents dans les tables métier sont désormais dans l'archive
**chiffrée**, mais peuvent avoir expiré ou dépendre de secrets externes : prévoir
la reconnexion Google. Les sessions en cours peuvent devoir être renouvelées.

## Déchiffrer sans toucher à la production

1. Télécharger ou cloner le dépôt privé sur une machine de confiance.
2. Installer Python 3.12+, GnuPG et, pour la restauration SQL, PostgreSQL/psql.
3. Exécuter depuis le dépôt applicatif :

   ```sh
   python scripts/dechiffrer-sauvegarde.py --archive-dir /chemin/completes-chiffrees/AAAA-MM-JJ --output /chemin/nouveau-dossier-prive
   ```

   La phrase est demandée sans écho. Les fragments, leur ordre et leurs empreintes
   sont vérifiés avant déchiffrement. Le dossier de sortie doit être nouveau.
   Cette commande ne se connecte à aucune base et ne restaure rien automatiquement.

## Recette de restauration obligatoire

Utiliser un **nouveau projet isolé**, jamais la production ni la recette déjà
utilisée. Bloquer les emails, SMS, paiements, webhooks et tâches planifiées sortants
avant de charger les données réelles. Ne pas démarrer les synchronisations Google.

Suivre la procédure officielle Supabase pour importer `roles.sql`, `schema.sql`
puis `data.sql` dans une transaction avec arrêt à la première erreur et les
triggers désactivés pendant l'import. Ne pas recréer les rôles/schémas gérés que
la plateforme a déjà installés. Revoir `managed-schema.sql` pour réappliquer
seulement les triggers/politiques personnalisés, en conservant leurs propriétaires
et permissions requis. Réactiver les publications Realtime nécessaires.

Recréer ou vérifier les buckets puis réimporter chaque binaire référencé dans
`storage.json` à son chemin original via l'API Storage. Ne pas confondre les
métadonnées SQL avec les fichiers eux-mêmes. Réappliquer les paramètres Auth,
OAuth/SMTP, les fonctions Edge et secrets depuis le coffre-fort.

Vérifier les comptes, leurs UUID, le nombre de lignes et les empreintes fichiers.
Avec deux comptes de test contrôlés : connexion email/mot de passe, connexion
Google si configurée, accès aux données propres, impossibilité d'accéder aux
données de l'autre utilisateur, ouverture d'un devis et d'un fichier. Consigner
la date, l'archive, les versions et le résultat de la recette hors des données clients.

**Un workflow vert prouve l'export et le déchiffrement, pas encore cette recette.**
Le champ `restore_tested` reste `false` jusqu'à une validation distincte.

Référence : https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
