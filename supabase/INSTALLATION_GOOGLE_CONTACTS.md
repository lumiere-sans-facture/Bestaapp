# Installer Google Contacts — pas à pas

Guide de bout en bout, de la console Google jusqu'à la synchronisation qui
tourne. Il complète `GOOGLE_CONTACTS.md`, qui dit *quoi* faire ; celui-ci dit
*où cliquer*, avec les libellés des consoles **en français**.

Comptez un quart d'heure. Les huit étapes sont dans l'ordre : la migration
avant les fonctions (elles écrivent dans ces tables), les fonctions avant les
secrets (les secrets se posent sur des fonctions qui existent).

---

## Ce que vous repartez chercher

Deux valeurs, et rien d'autre :

| Nom | Forme |
|---|---|
| `GOOGLE_CLIENT_ID` | `742…-xxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxxxxxxxxxxxxxx` |

## D'abord : votre identifiant de projet Supabase

Il revient dans presque toutes les adresses de ce guide. Lisez-le dans
l'adresse de votre tableau de bord Supabase :
`https://`**`votre-identifiant`**`.supabase.co`

⚠️ Celui du projet de **production** si vous installez en production, celui de
**recette** si vous installez en recette. Les deux projets sont distincts et
demandent chacun leur propre installation.

Dans tout ce qui suit, remplacez `VOTRE-REF` par cet identifiant.

---

## 1. Ouvrir la console Google, sur le bon projet

Sur <https://console.cloud.google.com>, connecté avec **le compte Google de
l'entreprise** — celui qui recevra les contacts.

En haut à gauche, à côté du logo, un sélecteur affiche le projet courant.
Ouvrez-le : si un projet BestaSolar existe, choisissez-le ; sinon
**Nouveau projet**, nommez-le *BestaSolar*, puis **Créer**.

> ⚠️ Tout ce qui suit se fait **dans ce projet**. Le sélecteur revient parfois
> sur un autre après une navigation : vérifiez son nom avant chaque étape.

## 2. Activer l'API People

C'est elle qui autorise l'écriture des contacts.

**Menu → APIs et services → Bibliothèque**

Tapez `People API` dans la recherche, ouvrez la fiche, cliquez **Activer**.
Le bouton devient **Gérer** : c'est fait.

> Le nom reste en anglais dans la console française. Ne le confondez pas avec
> « Contacts API », son ancêtre fermé depuis 2022.

## 3. Renseigner l'écran de consentement

C'est la page que verra le gérant au moment d'autoriser. Google refuse de
créer un identifiant tant qu'elle est vide.

**APIs et services → Écran de consentement OAuth**

> Console récente ? La section s'appelle **API Google Auth**, divisée en
> *Informations sur la marque*, *Public cible*, *Clients* et *Accès aux
> données*. Le contenu à saisir est le même.

1. Type d'utilisateur : **Externe**
2. Nom de l'application : *BestaSolar Pro*
3. E-mail d'assistance et coordonnées du développeur : votre adresse
4. Champs d'application : **Ajouter ou supprimer des champs d'application**,
   puis collez ceci dans le filtre et cochez la ligne trouvée :

```
https://www.googleapis.com/auth/contacts
```

Tant que l'application reste en **Test**, seuls les comptes listés dans
**Utilisateurs tests** peuvent se connecter : ajoutez-y le compte Google de
l'entreprise. **Publier l'application** lève cette limite.

## 4. Créer l'identifiant OAuth

**APIs et services → Identifiants → + Créer des identifiants → ID client OAuth**

1. Type d'application : **Application Web**
2. Nom : *BestaSolar — synchronisation contacts* (interne, jamais vu par personne d'autre)
3. **URI de redirection autorisés** → **Ajouter un URI**, puis exactement :

```
https://VOTRE-REF.supabase.co/functions/v1/google-contacts-oauth?action=callback
```

Laissez **Origines JavaScript autorisées** vide : l'échange se fait de serveur
à serveur, jamais depuis le navigateur.

> ⚠️ Cette adresse doit être **identique au caractère près** à celle donnée à
> Supabase à l'étape 8. Une barre oblique en trop, `http` au lieu de `https`,
> et Google refuse la connexion avec `redirect_uri_mismatch`. Copiez-la
> d'un seul endroit plutôt que de la retaper deux fois.

Puis **Créer**.

## 5. Relever les deux valeurs

Une fenêtre s'ouvre : **Client OAuth créé**.

- **ID client** → c'est `GOOGLE_CLIENT_ID`, il finit par `.apps.googleusercontent.com`
- **Code secret du client** → c'est `GOOGLE_CLIENT_SECRET`, il commence par `GOCSPX-`

> ⚠️ **Copiez le code secret maintenant.** Il ne se réaffiche plus ensuite ; il
> faudrait en générer un nouveau, et l'ancien cesserait de fonctionner.
>
> C'est un mot de passe : jamais dans le dépôt, jamais dans une variable
> `VITE_` — celles-là partent dans le navigateur de chaque visiteur.

Fenêtre refermée trop vite ? **Identifiants** → cliquez sur le nom de
l'identifiant : l'ID client y est toujours, et un bouton permet de créer un
nouveau code secret.

## 6. Créer les tables — éditeur SQL de Supabase

On change de console : Supabase, le bon projet.

1. Ouvrez `supabase/migrations/20260829_google_contacts.sql` et copiez tout son
   contenu (sur GitHub, le bouton *Copy raw file* en haut à droite du code).
2. Dans Supabase : **SQL Editor → New query**
3. Collez, puis **Run** (ou `Ctrl` + `Entrée`)

Vous devez lire `Success. No rows returned`. C'est le bon résultat : une
création de tables ne renvoie aucune ligne.

Vérifiez dans **Table Editor** : quatre tables nouvelles —
`google_contacts_configs`, `google_contacts_oauth_states`,
`google_contact_sync_jobs`, `google_contact_sync_locks`.

> ⚠️ **Les clés Google ne se collent pas ici.** Le SQL crée les tables, rien
> d'autre. Un secret rangé dans une table serait lisible par tout ce qui
> l'interroge ; il va dans les secrets des fonctions, à l'étape 8.

Le script est écrit en `create table if not exists` : le relancer par erreur ne
casse rien et n'efface aucune donnée.

## 7. Déployer les deux fonctions

Dans un terminal, **à la racine du dépôt** (une copie locale à jour sur `main`).

```bash
npx supabase@latest login

npx supabase@latest functions deploy google-contacts-oauth --project-ref VOTRE-REF --no-verify-jwt
npx supabase@latest functions deploy google-contacts-sync  --project-ref VOTRE-REF --no-verify-jwt
```

La connexion ouvre une page dans le navigateur, puis rend la main au terminal.
Vérifiez ensuite dans Supabase : **Edge Functions** doit lister les deux,
actives.

> ⚠️ **Ne passez pas par l'éditeur de fonctions du navigateur.**
> `google-contacts-sync` importe `shared/phone.js`, un fichier situé à la
> racine du dépôt ; un copier-coller dans la console ne l'emporterait pas, et
> la fonction planterait au premier appel. La ligne de commande, elle, suit la
> dépendance et l'embarque.

## 8. Installer les clés dans les secrets

C'est ici que vont les deux valeurs de l'étape 5.

Le secret du cron est une chaîne libre, longue et aléatoire :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Puis, en une seule commande — sous Windows, écrivez-la sur une seule ligne si
les `\` en fin de ligne posent problème :

```bash
npx supabase@latest secrets set --project-ref VOTRE-REF \
  GOOGLE_CLIENT_ID="…apps.googleusercontent.com" \
  GOOGLE_CLIENT_SECRET="GOCSPX-…" \
  GOOGLE_OAUTH_REDIRECT_URI="https://VOTRE-REF.supabase.co/functions/v1/google-contacts-oauth?action=callback" \
  SITE_URL="https://app.bestasolar.com" \
  GOOGLE_CONTACTS_CRON_SECRET="le-secret-généré-ci-dessus"
```

Vérifiez : `npx supabase@latest secrets list --project-ref VOTRE-REF` doit
afficher les cinq noms.

> Les fonctions lisent aussi `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`,
> mais Supabase les fournit lui-même : ne les ajoutez pas, ils seraient refusés.

`SITE_URL` est l'adresse de l'app **de cet environnement** :
`https://app.bestasolar.com` en production, l'adresse Vercel de recette sinon.

---

## C'est en place quand…

Dans l'app, **Paramètres → Google Contacts** affiche le bouton de connexion à
un compte Google, à la place du message rouge
`Failed to send a request to the Edge Function`. Cliquez : Google demande
l'autorisation, et vous revenez dans l'app, compte connecté.

| Ce que vous voyez | Ce qui manque |
|---|---|
| `Failed to send a request to the Edge Function` | les fonctions ne sont pas déployées → étape 7 |
| `redirect_uri_mismatch` | l'adresse de rappel diffère entre l'étape 4 et l'étape 8 |
| `access_denied` | le compte n'est pas dans *Utilisateurs tests* → étape 3 |
| une erreur mentionnant une table | la migration n'est pas passée → étape 6 |

## Reste facultatif : la reprise automatique

Un appel toutes les 5 minutes sur `google-contacts-sync`, corps
`{"action":"retry-pending"}`, en-tête `x-google-contacts-cron-secret` avec le
secret de l'étape 8. Sans elle tout fonctionne — un envoi raté attend
simplement l'action suivante au lieu d'être repris tout seul.

## À refaire pour le second environnement

Recette et production sont deux projets Supabase distincts. Les huit étapes
valent pour chacun, avec **son** identifiant de projet, **son** `SITE_URL`, et
une URI de redirection déclarée en plus côté Google Cloud (un même identifiant
OAuth peut en porter plusieurs).
