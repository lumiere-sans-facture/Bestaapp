# Déploiement commercial — comptes réels, multi-entreprise, abonnement serveur

Guide pas-à-pas pour passer du mode démonstration au mode SaaS sécurisé.
Sans ces étapes, l'app reste 100 % fonctionnelle en mode local (démo).

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
  - *Site URL* : l'URL de production (ex. `https://app.bestasolar.bj`).
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

## Flux d'abonnement Devis Pro (inchangé côté utilisateur)

1. Le technicien demande l'abonnement dans l'app (paiement MoMo + référence).
2. La demande est synchronisée (statut `en_attente` — la RLS refuse tout autre statut à un non-admin).
3. L'admin plateforme valide dans « Abonnements Devis Pro » → statut `actif` (seul l'admin peut l'écrire).
4. Le mode Pro du technicien s'active (vérification serveur).
