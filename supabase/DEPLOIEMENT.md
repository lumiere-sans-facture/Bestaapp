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
| 4 | `paiements.sql` | Moyens de paiement configurables depuis l'espace gérant (clés PUBLIQUES uniquement) |
| 5 | `erreurs.sql` | Journal des plantages — sans lui, aucune panne ne vous remonte |
| 6 | `temps-reel.sql` | **En dernier, et facultatif** — diffusion immédiate à toute l'équipe (à rejouer après l'ajout d'une table) |

`temps-reel.sql` vient en dernier parce qu'il ne crée rien : il ne fait
qu'INSCRIRE au temps réel des tables déjà existantes. Passé plus tôt, il
ignore simplement celles qui n'existent pas encore. Et il est **facultatif** :
sans lui l'app fonctionne, chaque appareil relisant le serveur au plus tard
toutes les minutes et à chaque retour à l'écran. Il fait passer de « au plus
tard une minute » à « immédiat ». **Il ne doit donc jamais retarder une mise
en production.**

Les scripts sont idempotents (ré-exécutables sans danger) — **à une
exception près** : une fois `multitenant.sql` passé, ne PAS rejouer
`schema.sql`, qui réinstallerait l'accès « toute l'équipe » à la place de
l'isolation par organisation. Pour rétablir le temps réel sans toucher aux
droits, utiliser `temps-reel.sql`.

**Une fois les six scripts passés, exécuter `verification-securite.sql`** —
lecture seule, quatre requêtes, deux minutes. C'est la seule preuve que la
base est réellement fermée : le code peut être irréprochable et les données
ouvertes si un script n'a pas été rejoué ici. Marche à suivre en **11.5**.

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
- **Connexion Google (facultative) — TROIS réglages, et le bouton disparaît si
  l'un manque** :
  1. *Authentication → Providers → Google* : activé, avec le *Client ID* et le
     *Client Secret* d'un identifiant OAuth de la console Google Cloud.
  2. Dans la console Google Cloud, *URI de redirection autorisés* doit contenir
     l'adresse de rappel du projet Supabase :
     `https://VOTRE-PROJET.supabase.co/auth/v1/callback`.
  3. Dans **Vercel**, la variable `VITE_ENABLE_GOOGLE_AUTH=true`. Sans elle, le
     bouton « Continuer avec Google » n'est même pas affiché — l'app n'a alors
     rien de cassé, elle ne propose simplement pas ce moyen d'entrée.

  Le retour de Google atterrit sur la RACINE du site (`window.location.origin`) :
  cette adresse doit donc figurer dans les *Redirect URLs* ci-dessus, pour
  chaque environnement (production ET recette).
- **Authentication → Rate Limits** : resserrer la limite de tentatives de
  connexion (`sign_in_attempts` — la valeur par défaut est large). C'est la
  VRAIE limite anti-brute-force ; le compteur de l'écran de connexion
  (`utils/loginThrottle.js`) n'est qu'une couche supplémentaire côté
  navigateur, contournable par un appel direct à l'API.
- **Authentication → Attack Protection → CAPTCHA protection** : **désactivé**,
  définitivement — voir l'encadré ci-dessous. ⚠️ Si l'inscription échoue avec
  `captcha protection: request disallowed (no captcha_token found)`, c'est que
  ce réglage traîne encore activé sur cet environnement : il n'y a plus aucun
  widget CAPTCHA dans l'app pour fournir le jeton qu'il exige.

> **Pourquoi pas de CAPTCHA du tout, ni sur l'app ni sur Supabase.**
> Le CAPTCHA de Supabase est tout-ou-rien : un seul interrupteur pour
> connexion, inscription et mot de passe oublié ensemble — impossible de le
> réserver à la connexion sans casser l'inscription (vérifié dans la doc
> Supabase). Comme l'inscription doit rester sans friction, le réglage reste
> désactivé partout, et le widget hCaptcha/Turnstile a été retiré de l'app
> plutôt que de laisser une friction d'écran qui ne protège plus rien.
>
> Ce qui protège réellement les tentatives de connexion répétées, sans
> CAPTCHA : le verrouillage progressif après 5 échecs (`utils/loginThrottle.js`
> — 15 min à 2 h, par email) et la limite par IP ci-dessus (*Rate Limits*),
> réglage Supabase indépendant du CAPTCHA.
- **Authentication → Sessions** : fixer une durée de vie de session
  (« Time-box user sessions ») et un délai d'inactivité (« Inactivity
  timeout ») — **réservé au plan payant Supabase**. Par défaut, Supabase
  renouvelle le jeton indéfiniment tant que l'appareil revient. Sans ce
  palier, `utils/sessionLifetime.js` fait office de filet côté app : 30
  jours d'âge absolu, 7 jours d'inactivité, revérifiés à chaque ouverture,
  avec vraie déconnexion serveur (`signOut`) au dépassement — pas une
  vraie limite serveur (un jeton volé continue de marcher directement
  contre l'API), mais ça borne l'usage normal en attendant. Prendre le
  palier payant rend ce filet redondant, sans besoin de le retirer. La
  déconnexion (`AuthContext.logout`) révoque déjà la session côté serveur
  immédiatement, indépendamment de ce qui précède.

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
| `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` | navigateur | analytique produit (clé de projet, publique) |
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

### Vérifier que tout est branché

**Plus → Diagnostic** (bas du menu, gérant uniquement) affiche la version
installée et l'état réel du suivi — *Sentry actif* ou *Journal serveur seul*.
Une clé oubliée dans Vercel ne provoque aucune erreur : sans cet indicateur,
l'absence de signalement se lit à tort comme « tout va bien ».

Le bouton **« Envoyer une erreur de test »** déclenche une erreur inoffensive
(elle ne fait pas planter l'écran) et affiche son code. Cherchez ce code dans
Sentry, onglet *Issues*, ou dans la table `erreurs` : s'il y est, toute la
chaîne fonctionne.

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

## 9. Analytique produit (PostHog)

Répond à « par où passent les utilisateurs », là où Sentry répond à « où ça
casse ». Deux besoins distincts, deux outils.

**Ce qui est mesuré** — une liste fermée d'événements
(`src/utils/analytique.js`), pas de capture automatique :

| Événement | Quand |
|---|---|
| `page_vue` | changement d'écran, chemin normalisé |
| `devis_cree` | création d'un devis (montant, type) |
| `commande_creee` | commande boutique (montant, nombre d'articles) |
| `abonnement_demande` | demande d'abonnement Devis Pro |
| `paiement_verifie` | paiement confirmé par le serveur |
| `lecon_terminee` | progression en formation |
| `ecran_plante` | l'écran d'erreur s'est affiché |

**Trois décisions, et pourquoi :**

- **Pas de SDK.** `posthog-js` pèse une cinquantaine de kilooctets et sa force
  est la capture automatique. Nous n'en voulons pas : les événements partent
  par une simple requête HTTP. Coût dans le bundle : **zéro**.
- **Pas de capture automatique, pas de rejeu de session.** Ils filmeraient les
  coordonnées des clients de vos abonnés, et feraient payer la donnée mobile à
  des techniciens en tournée.
- **Chemins normalisés.** `/clients/c-4f2a-9b` devient `/clients/:id`. Sans
  cela, la liste des pages vues serait l'annuaire des clients.

**Ce qui ne part jamais** : aucun nom, aucun téléphone, aucun e-mail. Les
propriétés textuelles passent par le même nettoyage que les rapports d'erreur,
et les objets ou tableaux sont écartés — trop faciles à remplir d'une fiche
client entière. L'identité est l'identifiant interne du compte, rien d'autre.

**Hors-ligne** : les événements sont mis en file sur l'appareil et partent par
lots (toutes les 15 s au plus, ou à la fermeture de l'écran via `sendBeacon`).

⚠️ **Deux clés existent dans PostHog, et une seule va dans l'app.**

| Clé | Prefixe | Où |
|---|---|---|
| Clé de **projet** | `phc_…` | `VITE_POSTHOG_KEY` — publique, faite pour le navigateur |
| Clé **personnelle** | `phx_…` | **nulle part ici** — c'est un mot de passe du compte |

Une variable `VITE_` part telle quelle dans le bundle que chaque visiteur
télécharge. Une clé `phx_` qui y arrive est publiée : il faut la **révoquer**
dans PostHog (*Settings → Personal API keys*), pas seulement la retirer.

⚠️ **`VITE_POSTHOG_HOST` est une ADRESSE, pas une clé.** Les deux variables se
saisissent l'une après l'autre et s'intervertissent facilement. Une adresse qui
n'est pas une URL absolue est traitée par le navigateur comme un chemin
*relatif* : les événements partent alors sur notre propre serveur, qui répond
`405 Method Not Allowed`. L'app détecte ce cas, cesse d'émettre et l'écrit dans
*Plus → Diagnostic*.

⚠️ **La RÉGION doit correspondre au projet.** PostHog héberge en `eu` ou en
`us`, et un projet créé dans l'une est inconnu de l'autre. Viser la mauvaise
région ne provoque aucun symptôme : les événements disparaissent, et les
statistiques restent simplement vides. La région se lit dans l'adresse de
votre tableau de bord (`us.posthog.com` → `VITE_POSTHOG_HOST=https://us.i.posthog.com`).

**Vérifier** : *Plus → Diagnostic* affiche l'état, **la destination réelle**
des envois, et un bouton **« Tester l'envoi analytique »** qui montre la
réponse de PostHog :

| Réponse | Signification |
|---|---|
| `200` | tout fonctionne |
| `401` | clé erronée, **ou mauvaise région** |
| `404` | hôte incorrect |
| `405` | l'envoi n'est pas parti chez PostHog : `VITE_POSTHOG_HOST` n'est pas une URL |

Côté PostHog, l'onglet *Activity* montre ensuite les événements en direct.

## 10. E-mails du compte (SMTP Brevo)

L'app envoie **deux e-mails**, tous deux par Supabase Auth : la confirmation
d'inscription et le lien « mot de passe oublié » (`context/AuthContext.jsx`).

⚠️ **Le serveur d'e-mail intégré de Supabase n'est pas fait pour la
production.** Il est bridé à quelques envois par heure et expédie depuis un
domaine Supabase : un technicien qui demande à réinitialiser son mot de passe
peut ne jamais recevoir le message, sans qu'aucune erreur n'apparaisse nulle
part. Tant qu'un SMTP maison n'est pas branché, cette porte est fragile.

### 10.1 Côté Brevo

1. *Senders, Domains & Dedicated IPs* → **valider le domaine** `bestasolar.com`
   (ou au minimum l'adresse expéditrice).
2. *SMTP & API* → **Generate a new SMTP key**. Noter le login (de la forme
   `xxxxxxx@smtp-brevo.com`) et la clé.
3. *Settings → Security → **Authorized IPs*** : **ne rien activer**.

> ⚠️ **La restriction par IP casserait tout, silencieusement.** Ce ne sont ni
> votre ordinateur ni votre téléphone qui se connectent à Brevo, mais les
> serveurs de **Supabase** (e-mails du compte) et de **Vercel** (envois depuis
> l'app). Leurs adresses IP sortantes changent d'un envoi à l'autre : aucune
> liste ne peut les couvrir. Avec « Block unknown IP addresses » activé, les
> e-mails partiraient un jour et seraient rejetés le lendemain. Laissez la
> liste vide et le blocage désactivé.

### 10.2 Enregistrements DNS

Chez le registrar du domaine (ou dans Vercel → *Domains* → *DNS*), poser les
trois enregistrements que Brevo affiche :

| Type | Rôle | Sans lui |
|---|---|---|
| **SPF** (TXT) | autorise Brevo à écrire en votre nom | courrier en indésirables |
| **DKIM** (TXT) | signature cryptographique du message | courrier en indésirables |
| **DMARC** (TXT) | dit quoi faire d'un message non signé | usurpation possible |

Aucun fournisseur ne rattrape leur absence : c'est ce qui décide qu'un e-mail
arrive en boîte de réception plutôt qu'en spam.

### 10.3 Côté Supabase

*Project Settings → Authentication → SMTP Settings* → **Enable Custom SMTP** :

| Champ | Valeur |
|---|---|
| Host | `smtp-relay.brevo.com` |
| Port | `587` (STARTTLS) |
| Username | le login `…@smtp-brevo.com` donné par Brevo |
| Password | la **clé SMTP** Brevo (pas le mot de passe du compte) |
| Sender email | une adresse du domaine validé, ex. `contact@bestasolar.com` |
| Sender name | `BestaSolar` |

Puis, dans *Authentication → Rate Limits*, relever la limite d'envoi : elle
reste calée sur l'ancien service tant qu'on n'y touche pas.

### 10.4 URL de retour — sinon le lien reçu ne marche pas

`resetPassword()` demande à Supabase de renvoyer l'utilisateur vers
`window.location.origin`. Cette adresse doit figurer dans
*Authentication → URL Configuration* :

- **Site URL** : l'adresse de production (ex. `https://app.bestasolar.com`)
- **Redirect URLs** : y ajouter aussi les URL de préproduction Vercel et
  `http://localhost:3000` pour les essais.

Une adresse absente de cette liste fait échouer le lien **après** le clic —
l'e-mail arrive, et c'est la page d'arrivée qui refuse.

### 10.5 Vérifier

1. Depuis l'écran de connexion, « Mot de passe oublié ».
2. Brevo → *Transactional → Logs* : l'envoi doit y apparaître en `delivered`.
   Un `blocked` ou `hard bounce` s'y explique en clair.
3. Cliquer le lien reçu : il doit ouvrir l'app sur la saisie du nouveau mot de
   passe. S'il renvoie une erreur, c'est le § 10.4.

Les textes des deux e-mails sont dans `supabase/emails/` — à coller dans
*Authentication → Email Templates*.

## 11. Deux environnements — comment les tenir alignés

Le projet vit sur **deux environnements complets**, chacun avec son projet
Vercel et son projet Supabase :

| | Branche déployée | Base | Paiement |
|---|---|---|---|
| **Test** | `claude/kit-selection-preconfigured-ixj6o0` | recette | KkiaPay **Sandbox** |
| **Production** | `main` | réelle | KkiaPay **Live** |

C'est la bonne architecture — elle évite d'écrire des devis d'essai dans les
données des clients. Mais elle a un prix : **tout ce qui n'est pas du code doit
être fait deux fois.**

### 11.1 Ce qui se fait DANS LES DEUX projets Supabase

Dans cet ordre, à chaque fois :

1. Les scripts SQL du § 2 : `schema.sql` → `security.sql` → `multitenant.sql`
   → `paiements.sql` → `erreurs.sql`, puis `temps-reel.sql` **en dernier**.
2. *Authentication → SMTP* (§ 10), *« Confirm email »*, *Site URL* et
   *Redirect URLs* — avec **l'adresse propre à cet environnement**.
3. Se déclarer admin plateforme (§ 4) : les comptes ne sont **pas** partagés
   entre les deux bases, c'est deux fois le même geste.
4. *Rate Limits*, *Attack Protection* (CAPTCHA **désactivé**) et *Sessions*
   (§ 3) — sinon l'environnement de test reste sans les mêmes garde-fous que
   la production, ou pire, avec un CAPTCHA oublié activé qui casse
   l'inscription.

⚠️ **Le piège de la mise en production.** Fusionner vers `main` déploie le
CODE, pas le schéma. Du code neuf devant une base restée en arrière donne une
table manquante, donc une synchronisation en échec — visible au voyant rouge
de *Plus*, mais après coup. **Passer les scripts SQL sur la base de production
AVANT de fusionner**, jamais après.

### 11.2 Ce qui doit DIFFÉRER entre les deux

| Variable Vercel | Test | Production |
|---|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | base de recette | base réelle |
| `VITE_KKIAPAY_PUBLIC_KEY` | clé Sandbox | clé Live |
| `VITE_KKIAPAY_SANDBOX` | `true` | `false` |
| `KKIAPAY_PRIVATE_KEY`, `KKIAPAY_SECRET` | onglet Sandbox | onglet Live |
| `SUPABASE_SERVICE_ROLE_KEY` | base de recette | base réelle |

**La règle qui évite les accidents** : sur chaque projet Vercel, cocher les
variables pour *Production* **et** *Preview*, et ne jamais faire pointer un
environnement vers la base de l'autre. Un aperçu qui écrit dans la vraie base
crée des comptes et des devis bien réels.

### 11.3 Savoir ce qui manque AVANT de toucher à la base

Exécuter **`supabase/etat-base.sql`** dans le SQL Editor du projet concerné.
Il est en **lecture seule** : il ne crée rien, ne modifie rien. Il dit quelles
tables manquent, si l'isolation par entreprise (`org_id` + RLS) est en place,
si le temps réel est branché, et combien de comptes et de clients contient la
base — de quoi ne jamais confondre les deux.

⚠️ **On ne « recopie » jamais une base dans l'autre.** Les scripts de
`supabase/` sont les mêmes pour les deux environnements : on les EXÉCUTE dans
chacun, et ils n'ajoutent que ce qui manque. Copier la base de test sur la
production effacerait les vrais clients, devis et commissions.

⚠️ **Une fois `multitenant.sql` passé, ne PAS rejouer `schema.sql`** : il
réinstallerait l'accès « toute l'équipe » à la place de l'isolation par
entreprise. Pour rétablir seulement le temps réel, utiliser `temps-reel.sql`.

### 11.4 Vérifier qu'un environnement est complet

Ouvrir l'app de cet environnement :

| Ce qu'on voit | Ce que ça veut dire |
|---|---|
| *Plus* affiche « Mode local — données sur cet appareil » | les variables Supabase manquent sur ce projet Vercel |
| Voyant rouge de synchronisation | la base répond mais **il manque des tables** : scripts SQL non passés |
| *Plus → Diagnostic* en vert, « Mot de passe oublié » reçu | l'environnement est complet |

### 11.5 Vérifier que la base est bien FERMÉE

Complet ne veut pas dire fermé : une base peut répondre à tout, voyant vert,
et laisser chaque entreprise lire les données des autres. Seule la base sait
quels droits y sont réellement posés — le code ne peut pas le dire.

**À faire après chaque déploiement SQL, dans les DEUX projets Supabase.**

1. Dashboard Supabase → choisir le projet (recette **ou** production) →
   **SQL Editor** → *New query*.
2. Coller le **BILAN** de `supabase/verification-securite.sql` — le bloc qui
   va de `with anomalies as (` au `;` qui suit `order by 1, 2` → **Run**.
   Le fichier ne contient que des `select` : il ne modifie rien, il est
   rejouable autant de fois qu'on veut.
3. Lire l'unique tableau de résultat :

| Ce qui s'affiche | Ce que ça veut dire |
|---|---|
| une ligne **« ✅ aucune anomalie »** | la base est fermée, rien à faire |
| `1. table sans RLS` | la table nommée est lisible par n'importe quel visiteur → rejouer `multitenant.sql` |
| `2. RLS sans policy` | la table nommée n'est plus lisible par personne (donnée perdue de vue côté app) |
| `3. policy « tout ouvert »` | ⚠️ le plus grave : `multitenant.sql` n'est pas passé ici, **chaque entreprise voit toutes les autres** → le rejouer immédiatement |
| `4. search_path non figé` | rejouer `multitenant.sql` (il redéfinit les fonctions avec leur `search_path` figé) |

⚠️ **Ne pas coller le fichier entier d'un bloc** : le SQL Editor de Supabase
n'affiche que le résultat de la **dernière** instruction d'un script. On ne
verrait donc que le contrôle 4 — et on croirait les trois autres passés. Les
quatre requêtes détaillées, sous le bilan, se lancent **une par une** :
sélectionner la requête dans l'éditeur, puis *Run*.

4. **Recommencer dans l'autre projet.** Recette et production sont deux bases
   distinctes : l'une peut être impeccable et l'autre grande ouverte.

Le détail du modèle de sécurité et ses limites assumées sont dans
`SECURITE.md`, à la racine du dépôt.

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
