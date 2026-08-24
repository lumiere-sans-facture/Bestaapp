# Sécurité — BestaSolar Pro

Ce que l'application tient, comment le vérifier, et ce qu'elle ne tient **pas**.
Un document de sécurité qui ne liste que les points forts ne sert à rien : les
limites assumées sont en fin de page, ce sont elles qui comptent le jour d'un
incident.

## Le modèle en une phrase

Le navigateur n'est jamais cru sur parole. Toute décision qui engage de
l'argent ou donne accès à des données est prise **côté serveur** — par la RLS
Postgres, par une fonction `security definer` qui vérifie l'appelant, ou par
une fonction serverless qui redemande la vérité à la source (l'agrégateur de
paiement, jamais le widget).

## 1. Accès aux données — la RLS fait tout le travail

L'app parle à Supabase avec la clé **anon**, qui est publique : elle vit dans
le bundle téléchargé par chaque visiteur. Ce n'est pas un secret et ne doit pas
être traitée comme tel. **La seule chose qui protège les données, c'est la
RLS.**

Les 19 tables métier portent la policy `org isolation` :
`org_id = auth_org_id()`. Une entreprise ne voit donc que ses lignes, quel que
soit ce que le client demande. Trois exceptions documentées :

| Table | Règle | Pourquoi |
|---|---|---|
| `products`, `kits`, `formations` | lecture partagée, écriture limitée à l'org propriétaire | actifs internes BestaSolar, consultés par toutes les entreprises |
| `profiles` | lecture limitée à sa propre org | annuaire d'équipe |
| `erreurs`, `paiements_verifies` | RLS **sans aucune policy** | écrites par le serveur (`service_role`), lisibles par personne depuis le navigateur |

Les fonctions `security definer` contournent la RLS par construction : chacune
pose sa propre garde en première ligne (`auth_is_platform_admin()`,
`auth_org_id()`) et fige son `search_path`.

**À vérifier après chaque déploiement SQL** — dans les DEUX projets Supabase :
exécuter `supabase/verification-securite.sql`. Il répond à la seule question
que le code ne peut pas trancher : *le SQL a-t-il réellement été rejoué ici ?*
Une base restée sur l'ancien schéma mono-équipe expose toutes les entreprises
les unes aux autres, avec un code applicatif pourtant irréprochable.

## 2. Secrets

Deux familles, à ne jamais confondre :

- **Publiques** (préfixe `VITE_`) — partent dans le bundle, c'est leur rôle :
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_KKIAPAY_PUBLIC_KEY`,
  `VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY` (clé de projet `phc_`, jamais `phx_`).
- **Serveur** (aucun préfixe) — variables Vercel uniquement, jamais dans un
  fichier partagé : `SUPABASE_SERVICE_ROLE_KEY` (elle contourne la RLS, elle
  vaut un accès total), `KKIAPAY_PRIVATE_KEY`, `KKIAPAY_SECRET`,
  `YOUTUBE_API_KEY`, `SENTRY_AUTH_TOKEN`.

`api/_lib/kkiapay.js` et `api/_lib/encaissement.js` manipulent les clés
serveur : **ils ne doivent jamais être importés depuis `src/`**. Le bundle les
emporterait.

Contrôle rapide après un build :

```bash
npm run build
grep -rE "eyJhbGciOiJIUzI1NiIs|sk_[a-z]+_|phx_|AIza" dist/   # doit ne rien rendre
```

## 3. Points d'entrée API

Cinq fonctions serverless, toutes passées par `api/_lib/garde.js` :

| Route | Auth | Plafond /min/IP | Ce qu'elle engage |
|---|---|---|---|
| `POST /api/paiement/verifier` | jeton Supabase **vérifié** | 10 | active un abonnement |
| `POST /api/paiement/webhook` | aucune (appelée par KkiaPay) | 60 | crédite un paiement |
| `POST /api/erreur` | aucune, **volontairement** | 20 | écrit dans `erreurs` |
| `GET /api/solar` | aucune | 30 | relaie PVGIS / NASA |
| `GET /api/youtube` | aucune | 20 | relaie l'API YouTube (quota) |

Les deux routes de paiement ne croient jamais le corps de la requête : elles en
retiennent l'identifiant de transaction, puis redemandent statut **et montant**
à l'agrégateur avec les clés privée et secrète. Le montant attendu est relu en
base. Un appel forgé ne peut donc rien créditer.

`/api/erreur` est ouverte à dessein — un plantage survient souvent avant que la
session ne soit lue. Le corps est plafonné, chaque champ retaillé et re-nettoyé
côté serveur de toute donnée personnelle (`utils/journalErreurs.js`).

## 4. Injection

- **SQL** : aucune requête construite par concaténation. Tout passe par le
  client Supabase (requêtes paramétrées) ou par des fonctions plpgsql à
  paramètres typés.
- **XSS** : les documents imprimables (devis, factures, reçus, fiche de
  dimensionnement) sont du HTML généré puis ouvert par `document.write`. Toute
  donnée client y passe par `esc()` — nom, adresse, désignation, référence,
  note. Les couleurs de marque d'un abonné Pro sont validées contre
  `/^#[0-9a-fA-F]{6}$/` avant d'entrer dans le CSS : sans ce filtre, une
  « couleur » pourrait refermer la balise `<style>`.
- **Commandes** : l'application n'exécute aucun processus système.

## 5. Journal

`api/_lib/garde.js` écrit une ligne JSON sur stdout — que Vercel agrège et rend
filtrable — pour : plafond atteint, authentification refusée, erreur 4xx/5xx,
configuration incomplète. Chaque ligne porte horodatage, IP réelle, méthode et
chemin.

Aucun détail technique ne part au client : message générique en réponse, cause
exacte (exception, message Postgres, réponse de l'agrégateur) au journal.

**Requêtes utiles dans les logs Vercel :**

```
[securite] "evenement":"auth-refusee"      # jetons refusés — appels forgés
[securite] "evenement":"plafond-atteint"   # abus ou boucle client
[securite] "evenement":"erreur"            # 4xx/5xx avec leur cause réelle
```

## 6. Limites assumées

À lire avant de considérer le sujet clos.

1. **Le plafond de requêtes n'est pas anti-DDoS.** Le compteur vit dans la
   mémoire d'**une** instance serverless ; Vercel en démarre plusieurs sous
   charge, et chacune repart à zéro. C'est un garde-fou contre les boucles et
   les scripts naïfs. Une vraie protection distribuée demande une règle au
   niveau du CDN/WAF (Vercel Firewall) ou un compteur partagé (Upstash Redis).

2. **Le webhook de paiement n'est pas signé.** KkiaPay ne fournit pas de
   signature ; l'app compense en redemandant le statut à l'agrégateur, ce qui
   rend un appel forgé inoffensif — mais l'adresse reste appelable par
   n'importe qui.

3. **La sécurité dépend d'un SQL réellement appliqué.** Voir le point 1 : c'est
   le risque le plus élevé du produit, et il est opérationnel, pas logiciel.

4. **Les comptes de démonstration** (`demo123`, `src/data/seed.js`) ne
   fonctionnent qu'en mode local, sans backend. Dès que Supabase est
   configuré, l'authentification passe exclusivement par Supabase Auth.
