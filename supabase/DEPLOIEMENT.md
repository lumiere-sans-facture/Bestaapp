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

Les trois scripts sont idempotents (ré-exécutables sans danger).

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

## Les deux types de comptes

- **Org `interne`** (BestaSolar, `org-bestasolar`) : le CRM complet — pipeline,
  boutique, commandes, partenaires, commissions, équipe, formations + espace Pro.
- **Org `pro`** (toute inscription self-service) : **l'espace Devis Pro
  uniquement** — ses clients, ses devis/factures à son identité, le
  dimensionnement solaire. Pas de modules internes BestaSolar. C'est l'offre
  à 5 000 F/mois : tant que l'abonnement n'est pas validé, le compte n'accède
  qu'aux écrans « Mon abonnement » (paiement) et « Mon entreprise » (identité).

## Flux d'abonnement Devis Pro

1. L'installateur s'inscrit (« Créer mon espace Devis Pro ») et atterrit sur
   l'écran d'activation : paiement MoMo au numéro affiché + référence.
2. La demande est synchronisée (statut `en_attente` — la RLS refuse tout autre
   statut à un non-admin).
3. L'admin plateforme valide dans « Abonnements Devis Pro » → statut `actif`
   (seul l'admin peut l'écrire).
4. L'espace Pro complet s'ouvre (vérification côté serveur). Un renouvellement
   demandé pendant la période payée ne coupe jamais l'accès avant l'échéance.
