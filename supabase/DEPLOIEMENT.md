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

Les scripts sont idempotents (ré-exécutables sans danger) — **à une
exception près** : une fois `multitenant.sql` passé, ne PAS rejouer
`schema.sql`, qui réinstallerait l'accès « toute l'équipe » à la place de
l'isolation par organisation. Pour rétablir le temps réel sans toucher aux
droits, utiliser `temps-reel.sql`.

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
3. L'admin plateforme valide dans « Abonnements Devis Pro » → statut `actif`
   (seul l'admin peut l'écrire).
4. L'espace Pro s'ouvre (vérification côté serveur). Un renouvellement demandé
   pendant la période payée ne coupe jamais l'accès avant l'échéance.
