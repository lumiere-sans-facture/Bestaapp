# Déploiement commercial — comptes réels, multi-entreprise, abonnement serveur

Guide pas-à-pas pour passer du mode démonstration au mode SaaS sécurisé.
Sans ces étapes, l'app reste 100 % fonctionnelle en mode local (démo).

## 0. Nom de domaine : `app.bestasolar.com`

Le sous-domaine du site existant est le bon choix (gratuit, HTTPS automatique).
Aucune adresse n'est codée en dur dans l'app : liens d'affiliation
(`utils/referral.js`) et lien « mot de passe oublié » utilisent
`window.location.origin` — ils suivent le domaine tout seuls.

1. **Vercel** → projet → *Settings → Domains* → ajouter `app.bestasolar.com`.
2. **Chez le registrar de `bestasolar.com`** (là où le site est hébergé) →
   zone DNS → ajouter un enregistrement :
   `CNAME` · nom `app` · valeur `cname.vercel-dns.com`.
   Propagation : de quelques minutes à quelques heures ; Vercel émet le
   certificat HTTPS automatiquement dès que le DNS répond.
3. **Supabase** → *Authentication → URL Configuration* :
   *Site URL* = `https://app.bestasolar.com`, et l'ajouter aux *Redirect URLs*
   (sinon les liens de réinitialisation de mot de passe ne reviendront pas
   vers l'app).
4. Sur le site vitrine `bestasolar.com`, ajouter un bouton bien visible
   « Ouvrir l'application » → `https://app.bestasolar.com`.

## 1. Créer / préparer le projet Supabase

1. Créer un projet sur [supabase.com](https://supabase.com) (région Europe de l'Ouest).
2. Copier l'URL et la clé publique dans `.env` (voir `.env.example`) :
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## 2. Exécuter les scripts SQL — dans cet ordre

Dans **SQL Editor** du dashboard Supabase :

| Ordre | Script | Rôle |
|---|---|---|
| 1 | `schema.sql` | Tables + temps réel + tombstones |
| 2 | `security.sql` | Accès réservé aux porteurs d'un profil (bloque les inscrits inconnus) |
| 3 | `multitenant.sql` | Organisations, isolation par entreprise (RLS), inscription self-service, codes d'invitation, verrou serveur des abonnements |
| 4 | `temps-reel.sql` | Diffusion immédiate des changements à toute l'équipe (à rejouer après l'ajout d'une table) |
| 5 | `paiements.sql` | Moyens de paiement configurables depuis l'espace gérant (clés PUBLIQUES uniquement) |
| 6 | `erreurs.sql` | Journal des plantages — sans lui, aucune panne ne vous remonte |

Les scripts sont idempotents (ré-exécutables sans danger) — **à une
exception près** : une fois `multitenant.sql` passé, ne PAS rejouer
`schema.sql`, qui réinstallerait l'accès « toute l'équipe » à la place de
l'isolation par organisation. Pour rétablir le temps réel sans toucher aux
droits, utiliser `temps-reel.sql`.

### Scripts d'entretien (à la demande, jamais au déploiement)

| Script | Quand s'en servir |
|---|---|
| `rattacher-membre.sql` | Un compte s'est inscrit sans le lien d'invitation : il est seul dans sa propre entreprise et ne voit ni les kits ni les clients de l'équipe. Ce script le rattache, et déplace ses données sur option. |
| `temps-reel.sql` | Les changements d'un appareil n'apparaissent pas tout de suite sur les autres. |
| `partage-formation.sql`, `nettoyage-doublons-formation.sql` | Cours de formation : partage du catalogue BestaSolar, purge des anciennes copies. |
| `pompe-kits.sql` | Table des kits de pompage absente (installation antérieure à cette fonctionnalité). |
| `organisation-interne.sql` | Le bouton « Commander en ligne » n'apparaît pas dans le panier : vérifie quelle entreprise porte `kind = 'interne'` (la seule à pouvoir encaisser pour BestaSolar) et permet de la désigner. |

## 3. Configuration Auth (dashboard Supabase)

- **Authentication → Providers → Email** : laisser « Enable sign-ups » **activé**
  (l'inscription self-service crée l'entreprise ; la RLS isole chaque org).
  « Confirm email » activé recommandé.
- **Authentication → URL Configuration** :
  - *Site URL* : l'URL de production (`https://app.bestasolar.com`).
  - *Redirect URLs* : ajouter la même URL (nécessaire au lien « mot de passe oublié »).

## 4. Se déclarer admin plateforme (une fois)

L'admin plateforme est le SEUL à pouvoir activer un abonnement Devis Pro
(l'écran « Abonnements Devis Pro » ne s'affiche que pour lui). Après avoir
créé TON compte via l'écran d'inscription de l'app :

```sql
update public.profiles set is_platform_admin = true where email = 'ton@email';
```

## 5. Sauvegardes

**Dashboard → Database → Backups** : vérifier que les sauvegardes quotidiennes
sont actives, et tester une restauration une fois avant le lancement.

## 6. Variables d'environnement Vercel

*Settings → Environment Variables*, en plus de `VITE_SUPABASE_URL` et
`VITE_SUPABASE_ANON_KEY` :

| Variable | Portée | Rôle |
|---|---|---|
| `VITE_KKIAPAY_PUBLIC_KEY` | navigateur | clé **publique** du widget de paiement |
| `YOUTUBE_API_KEY` | serveur, facultative | sommaire minuté des vidéos de formation |
| `KKIAPAY_PRIVATE_KEY`, `KKIAPAY_SECRET` | serveur | vérification des paiements KkiaPay |
| `SUPABASE_SERVICE_ROLE_KEY` | serveur | activation de l'abonnement après paiement vérifié |
| `VITE_SENTRY_DSN` | navigateur | suivi des plantages (valeur publique) |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | build | envoi des source maps — sans elles, les piles restent illisibles |
| `CINETPAY_API_KEY` | serveur | idem, si CinetPay est branché un jour |
| `FEDAPAY_SECRET_KEY` | serveur | idem, si FedaPay est branché un jour |

⚠️ **Les clés privées et secrètes ne se saisissent JAMAIS dans l'application.**
Tout ce qui est tapé dans un écran part dans `localStorage` puis dans Supabase,
où chaque membre de l'organisation peut le lire — et ces clés autorisent
remboursements et versements. L'écran *Plus → Moyens de paiement* n'accepte que
la clé **publique** et refuse une valeur qui ressemble à un secret ; les secrets
vivent uniquement ici, en variables d'environnement serveur (sans préfixe
`VITE_`, qui les ferait entrer dans le bundle du navigateur).

`YOUTUBE_API_KEY` (clé « YouTube Data API v3 », console Google Cloud) n'est pas
obligatoire : sans elle, `/api/youtube` lit la page publique de la vidéo pour y
retrouver les chapitres. La clé rend simplement la lecture stable, indépendante
de la mise en page de YouTube. Elle n'a **pas** de préfixe `VITE_` : une variable
serveur ne doit jamais partir dans le bundle du navigateur.

## 7. Vérification serveur des paiements

Sans elle, un abonnement s'activait sur la parole du navigateur : le widget
annonçait « payé », l'app enregistrait. Le même retour était reproductible
depuis la console du navigateur — donc un abonnement gratuit à qui savait le
faire.

Deux adresses la portent :

| Adresse | Qui l'appelle | Rôle |
|---|---|---|
| `POST /api/paiement/verifier` | l'app, après le widget | vérifie et active — chemin principal |
| `POST /api/paiement/webhook` | KkiaPay | filet si le navigateur s'est fermé avant |

Deux choses peuvent être payées : l'**abonnement Devis Pro** et une
**commande boutique**. Le montant attendu est lu côté serveur dans les deux
cas — prix de l'abonnement, ou total de la commande en base.

Ce que le serveur vérifie, et que le navigateur ne peut pas contourner :

1. **Qui** — l'identité vient du jeton Supabase vérifié, jamais du corps de la
   requête : impossible de faire créditer le compte d'un autre.
2. **Quoi** — le statut et le montant sont demandés à KkiaPay avec les clés
   privée et secrète. Un paiement de 100 F n'ouvre pas un abonnement à 5 000.
3. **Une seule fois** — la transaction est verrouillée dans
   `paiements_verifies` (clé primaire) : rejouer la même référence ne crédite
   rien de plus.

Une commande réglée n'est pas pour autant *confirmée* : la confirmation
décrémente le stock, elle reste une décision du gérant qui doit avoir la
marchandise. Le paiement est noté à part (`paiement.statut = 'verifie'`).

**À faire dans le tableau de bord KkiaPay** : déclarer l'URL de webhook
`https://app.bestasolar.com/api/paiement/webhook`.

Le webhook ne fait jamais confiance à ce qu'il reçoit — n'importe qui peut
appeler cette adresse. Il n'en retient que la référence de transaction, puis
demande son vrai statut à KkiaPay. Un appel forgé ne crédite donc rien.

**Si la vérification n'est pas configurée** (clés absentes), l'app le détecte
et retombe sur la validation manuelle par le gérant, comme avant. Rien ne
casse ; l'abonnement demande simplement une validation humaine.

## 8. Journal des plantages

Sans lui, un écran qui plante chez un technicien reste invisible : l'utilisateur
voit un message, referme, et personne n'est prévenu.

Chaque plantage produit un **code court** (« ERR-7F3A »), identique pour toutes
les occurrences du même bug. L'utilisateur le voit à l'écran et peut le dicter ;
vous le retrouvez en base.

Ce qui est capté : erreurs d'affichage React, erreurs hors React (minuteurs,
gestionnaires d'événements) et promesses rejetées sans `catch`. Les rapports
sont mis en **file d'attente sur l'appareil** et repartent au retour du réseau —
un technicien plante souvent là où il n'a pas de connexion.

⚠️ **Aucune donnée personnelle n'y entre.** Noms, téléphones, e-mails, clés et
jetons sont remplacés par des marqueurs (`[tel]`, `[email]`, `[cle]`) — deux
fois : sur l'appareil, puis à la réception. `/api/erreur` est volontairement
ouverte (un plantage survient souvent avant même la lecture de la session), donc
le serveur ne fait jamais confiance à ce qu'il reçoit. La table n'est lisible
par personne depuis le navigateur : seul le `service_role` y accède.

### Sentry (facultatif, recommandé)

Le journal ci-dessus dit **qu'il y a** un problème. Sentry dit **où** : il
traduit la pile d'appel minifiée en vraies lignes de code, regroupe les
occurrences et alerte par e-mail à la première apparition d'un bug.

1. Créer un projet sur [sentry.io](https://sentry.io) (offre gratuite).
2. Copier le DSN dans `VITE_SENTRY_DSN` (Vercel). Il est long — 80 à 100
   caractères, de la forme
   `https://<clé>@<organisation>.ingest.<région>.sentry.io/<projet>` — et
   entièrement **public** : il finit de toute façon dans le code JavaScript
   livré au navigateur. Le copier en entier, sans guillemets ni espace : un
   DSN tronqué est refusé par l'app (avertissement dans la console) plutôt que
   d'échouer en silence.
3. Pour les source maps — sans lesquelles l'intérêt principal disparaît :
   créer un jeton (*Settings → Auth Tokens*, portée `project:releases`) et
   déclarer `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.

Comment il est branché, et pourquoi :

- **Aucune instrumentation automatique.** Sentry sait capturer clics,
  requêtes et console pour en faire un « fil d'Ariane ». C'est exactement là
  que fuiraient les données de vos clients : le texte d'un bouton, une URL.
  Toutes ces intégrations sont désactivées ; Sentry ne reçoit que ce que nous
  lui donnons, après nettoyage, et le fil d'Ariane est vidé.
- **Chargé à la demande.** Le SDK (27 Ko compressés) n'est téléchargé qu'au
  premier plantage. Sur une app qui fonctionne, il ne coûte rien — ce qui
  compte quand la connexion se paie au mégaoctet.
- **Absent sans DSN.** Sans `VITE_SENTRY_DSN` au build, le SDK n'entre même
  pas dans le bundle.

⚠️ **Limite à connaître.** Le nettoyage reconnaît les téléphones, e-mails,
suites de chiffres, clés et jetons. Il ne peut PAS reconnaître un **nom
propre** : « Kossi Adjé » ressemble à n'importe quel mot. Un message d'erreur
qui cite le nom d'un client le ferait donc sortir. D'où la règle de
développement : **ne jamais interpoler de donnée client dans un message
d'erreur** — utiliser l'identifiant (`client c-4f2a introuvable`), jamais le
nom.

**Exploitation** — dans SQL Editor, les requêtes prêtes figurent en bas de
`erreurs.sql`. La plus utile :

```sql
select code, count(*) as occurrences, count(distinct user_id) as comptes,
       max(recu_le) as dernier, max(message) as exemple
from public.erreurs
where recu_le > now() - interval '7 days'
group by code order by occurrences desc limit 20;
```

Le journal fonctionne sans `SUPABASE_SERVICE_ROLE_KEY`, mais n'enregistre alors
rien : l'écran d'erreur et le signalement WhatsApp restent opérationnels.

## Ce que fait l'app selon la configuration

| | Sans backend (démo) | Backend configuré (SaaS) |
|---|---|---|
| Connexion | comptes du seed (dev uniquement) | comptes Supabase Auth |
| Inscription | — | self-service : créer son entreprise, ou rejoindre avec un code d'invitation (Plus → Équipe) |
| Mot de passe oublié | message « contactez votre gérant » | email + lien de réinitialisation |
| Données initiales | jeu de démonstration complet | catalogue + formations seulement ; données métier vides |
| Équipe | utilisateurs du seed | profils de l'organisation |
| Isolation | — | chaque entreprise ne voit que ses données (RLS) |
| Mode Pro | abonnement local | abonnement relu sur le serveur (infalsifiable) ; repli local si hors-ligne |

## Le modèle des comptes

**Tout inscrit atterrit dans la même app, gratuitement, dans sa propre
entreprise (bulle étanche)** : tableau de bord, suivi clients, boutique,
formations, espace partenaire (programme d'affiliation) — tout. La dotation
de départ : catalogue produits + cours de formation ; les données métier
démarrent vides.

**Une seule chose est payante : l'espace Pro** (« Mon entreprise » — devis et
factures à l'identité de l'abonné, suivi des encaissements) à 5 000 F/mois.

La colonne `orgs.kind` ('interne' pour BestaSolar, 'pro' pour les inscrits)
existe en base pour d'éventuelles distinctions futures, mais ne restreint
rien aujourd'hui.

## Flux d'abonnement Devis Pro

1. L'utilisateur clique « Passer en mode Pro » (menu Plus) : paiement MoMo au
   numéro affiché + référence.
2. La demande est synchronisée (statut `en_attente` — la RLS refuse tout autre
   statut à un non-admin).
3. **Paiement en ligne** : le serveur vérifie la transaction auprès de
   l'agrégateur et active l'abonnement tout seul (section 7).
   **Paiement Mobile Money manuel** — ou vérification indisponible : l'admin
   plateforme valide dans « Abonnements Devis Pro » → statut `actif` (seul
   l'admin peut l'écrire).
4. L'espace Pro s'ouvre (vérification côté serveur). Un renouvellement demandé
   pendant la période payée ne coupe jamais l'accès avant l'échéance.
