# Architecture — BestaSolar Pro

> CRM solaire local-first (React 18 + Vite 5 + Supabase) pour BestaSolar, Parakou (Bénin).
> Web responsive + applications natives Android/iOS (Capacitor) à partir d'une base de code unique.
>
> Ce document décrit l'architecture **réelle** du dépôt (pas une cible théorique) et trace le
> chemin d'évolution vers une échelle de plusieurs millions d'utilisateurs. Aucune modification
> de code n'a été nécessaire pour le produire : la structure existante est déjà découpée pour
> grandir.

---

## 1. Architecture du système

### Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLIENTS (1 base de code)                   │
│                                                                    │
│   Web (Vercel, SPA)        Android (Capacitor)     iOS (Capacitor) │
│        │                         │                       │         │
│        └─────────────┬───────────┴───────────────────────┘         │
│                      │  Bundle React identique (dist/)              │
└──────────────────────┼─────────────────────────────────────────────┘
                       │
              ┌────────▼─────────┐
              │   APP REACT 18    │   État applicatif = source de vérité côté client
              │                   │
              │  Contexts (4) :   │   Auth · Data · Mode · Cart
              │  Local-first      │   localStorage = cache + mode hors-ligne
              └────────┬──────────┘
                       │  @supabase/supabase-js (optionnel, auto-détecté)
                       │  REST auto-générée + Realtime (WebSocket) + Auth
              ┌────────▼──────────────────────────────────────────────┐
              │                     SUPABASE                            │
              │  Postgres  ·  Row Level Security  ·  Realtime  ·  Auth  │
              │  14 tables « collection » (id, data jsonb)              │
              │  + profiles + tombstones                                │
              └─────────────────────────────────────────────────────────┘
```

### Principes directeurs

| Principe | Mise en œuvre | Fichier |
|---|---|---|
| **Local-first** | L'app fonctionne à 100 % sans backend ; `localStorage` est la source de vérité, Supabase une réplication optionnelle. | `context/DataContext.jsx` |
| **Backend auto-détecté** | Si `VITE_SUPABASE_*` (ou les variables injectées par l'intégration Vercel↔Supabase) sont présentes, la sync s'active ; sinon mode local. Aucune branche de code morte. | `lib/supabase.js` |
| **Sync non-destructive** | Réplication par *upsert* + table `tombstones` pour les suppressions → pas de perte de données créées hors-ligne par un autre appareil. | `lib/remoteSync.js`, `DataContext.jsx` |
| **Mode public / Pro étanche** | Une seule arborescence de routes montée à la fois ; zéro fuite de données entre l'espace commercial (public) et l'espace entreprise du technicien (Pro). | `App.jsx` (`ModeSwitch`) |
| **Une base de code, 3 cibles** | Le même `dist/` est servi par Vercel (web) et empaqueté par Capacitor (Android/iOS). | `capacitor.config.json`, `vite.config.js` |

### Pourquoi cette architecture pour ce marché

Le contexte (PME au Bénin, connectivité intermittente, équipe terrain) impose le **local-first** :
les techniciens créent pistes et devis en clientèle sans réseau, la synchronisation se fait
quand la connexion revient. C'est le choix structurant dont découlent la table `tombstones`,
le *merge* à la réception et le repli automatique en mode local.

---

## 2. Structure des fichiers

```
Bestaapp/
├── index.html                  Point d'entrée Vite
├── vite.config.js              Build + envPrefix (VITE_, NEXT_PUBLIC_)
├── vercel.json                 Rewrites SPA (fallback index.html)
├── capacitor.config.json       Empaquetage natif Android/iOS
├── supabase/
│   └── schema.sql              DDL : tables, RLS, Realtime, tombstones, seed profils
├── public/
│   ├── products/               Photos catalogue (servies statiquement)
│   └── privacy.html            Politique de confidentialité (stores)
├── .github/workflows/          CI : build APK Android, release
└── src/
    ├── main.jsx                Bootstrap React (StrictMode)
    ├── App.jsx                 Providers + routing + bascule de mode  ◄── cœur
    ├── ProApp.jsx              Coquille de l'espace Pro
    ├── index.css               Design system (variables CSS + composants)
    │
    ├── config/
    │   └── company.js          Identité émetteur (BestaSolar) pour les PDF
    │
    ├── context/                ── ÉTAT GLOBAL (le « cerveau ») ──
    │   ├── AuthContext.jsx     Session, login/logout (Supabase Auth ou local)
    │   ├── DataContext.jsx     Composition root : assemble les modules ci-dessous
    │   ├── dataState.js        Forme initiale, chargement/migration, persistance
    │   ├── dataActions.js      Assemble les domaines d'actions (createActions)
    │   ├── actions/            Actions par domaine : leads, partners, catalogue,
    │   │                       devis, formations, pro (+ shared)
    │   ├── useRemoteSync.js    Moteur de réplication Supabase (hook isolé)
    │   ├── ModeContext.jsx     Bascule public/Pro (réservée aux abonnés)
    │   └── CartContext.jsx     Panier boutique
    │
    ├── lib/                    ── ACCÈS BACKEND ──
    │   ├── supabase.js         Client + détection de configuration
    │   └── remoteSync.js       pullAll / pushCollections / pushTombstone / realtime
    │
    ├── data/                   ── DONNÉES DE RÉFÉRENCE (seed) ──
    │   ├── seed.js             Utilisateurs, étapes pipeline, pistes, partenaires…
    │   ├── catalogue.js        Catalogue produits officiel 2026
    │   ├── appliances.js       Appareils types (dimensionnement solaire)
    │   └── ensoleillement.js   Heures d'ensoleillement par ville
    │
    ├── components/             ── UI PARTAGÉE ──
    │   ├── AppLayout.jsx       Coquille : sidebar (desktop) + tab-bar (mobile)
    │   ├── PageHeader.jsx      En-tête de page
    │   ├── Sheet.jsx           Panneau modal (bottom-sheet mobile / fenêtre desktop)
    │   ├── Ring.jsx            Anneau de progression (donut SVG) — partagé
    │   └── SyncStatus.jsx      Indicateur d'état de synchronisation
    │
    ├── screens/                ── PAGES (1 par route) ──
    │   ├── Login.jsx
    │   ├── Dashboard.jsx       Tableau de bord public (style Atera)
    │   ├── Pipeline.jsx        Suivi clients (kanban)
    │   ├── Boutique.jsx        E-commerce interne
    │   ├── Devis.jsx           Génération de devis
    │   ├── Plus.jsx            Menu : profil, équipe, partenaires, formation…
    │   ├── ProDashboard.jsx    Tableau de bord Pro (style Atera)
    │   ├── devis/              Sous-écrans devis (Solar/Manual wizard, partenaire)
    │   ├── plus/               Sections du menu Plus (10 modules)
    │   └── pro/                Écrans de l'espace Pro
    │
    └── utils/                  ── LOGIQUE MÉTIER PURE (testable) ──
        ├── solarSizing.js      Dimensionnement + génération de devis solaire
        ├── referral.js         Affiliation (capture ?ref=, codes, last-click 30j)
        ├── subscription.js     Règles d'abonnement Devis Pro
        ├── stats.js            Agrégations mensuelles (dashboard)
        ├── devisPdf.js         Génération PDF devis (jsPDF)
        ├── proDocPdf.js        Génération PDF factures Pro
        ├── format.js           Formatage CFA / dates
        ├── power.js            Calculs de puissance
        ├── image.js            Helpers images
        └── video.js            Lecteur vidéo formation
```

**Loi de dépendance** (de l'extérieur vers le cœur, jamais l'inverse) :
`screens → components → context → lib → (data | utils)`.
Les `utils/` sont des fonctions pures sans dépendance React : le socle le plus stable et le plus testable.

---

## 3. Schéma de base de données

Modèle **hybride** assumé : Postgres relationnel pour l'identité/sécurité, JSONB pour les
collections métier (vélocité produit côté client, schéma piloté par l'app).

### Tables relationnelles

```sql
profiles (
  id     text primary key,             -- 'u1', 'u2'… (lié au compte Auth par email)
  email  text unique not null,
  name   text not null,
  role   text not null check (role in ('gerant','technicien')),
  phone  text default '',
  avatar text default ''               -- initiales
)

tombstones (
  id         text not null,            -- id de l'entité supprimée
  collection text not null,            -- table d'origine
  deleted_at timestamptz default now(),
  primary key (id, collection)         -- suppression non-destructive
)
```

### Tables « collection » (14, modèle uniforme)

```sql
<collection> (
  id         text primary key,         -- crypto.randomUUID()
  data       jsonb not null,           -- l'entité complète, schéma côté app
  updated_at timestamptz default now()
)
```

| Collection | Contenu (clés `data`) | Synchronisée |
|---|---|:--:|
| `products` | catalogue (prix, stock, photos, catégorie) | ✓ |
| `leads` | pistes CRM (étape, valeur, parrains L1/L2, activités) | ✓ |
| `partners` | partenaires affiliés (code, sponsorId, statut, MoMo) | ✓ |
| `commissions` | commissions N1 (3 %) / N2 (1,5 %) | ✓ |
| `devis` | devis solaires/manuels | ✓ |
| `referrals` | registre d'affiliation (clic/piste/devis) | ✓ |
| `orders` | commandes boutique (décrément de stock) | ✓ |
| `formations` | modules de formation technicien | ✓ |
| `formationProgress` | avancement par technicien | ✓ |
| `subscriptions` | abonnements Devis Pro | ✓ |
| `subscriptionPayments` | paiements Mobile Money | ✓ |
| `companies` | entreprise du technicien (identité facture, TVA, compteur) | ✓ |
| `factures` | factures Pro | ✓ |

### Sécurité (Row Level Security)

- **RLS activé sur toutes les tables.**
- Politique actuelle : `for all to authenticated using (true)` → tout membre **connecté** de
  l'équipe accède à toutes les données. Modèle **mono-tenant** (une équipe = une instance),
  adapté au MVP.
- `profiles` : lecture seule pour les authentifiés.

### Temps réel

Les 14 collections sont ajoutées à la publication `supabase_realtime` → tout changement est
diffusé par WebSocket aux autres appareils (voir §4, Realtime).

> ⚠️ **Pré-requis déploiement** : exécuter `supabase/schema.sql` dans le SQL Editor (notamment
> le bloc `tombstones`) avant la première synchronisation multi-appareils.

---

## 4. Endpoints / Couche d'API

Il n'y a **pas de serveur d'API maison** : c'est un choix d'architecture. L'« API » a deux faces.

### 4.1 — API distante (Supabase, auto-générée)

`lib/remoteSync.js` encapsule tous les appels. Aucun composant n'appelle Supabase directement.

| Fonction | Rôle | Opération Supabase |
|---|---|---|
| `pullAll()` | Récupère les 14 collections + tombstones, filtre les supprimés. Retourne `{ empty, collections, tombstones }`. | `select` (×15) |
| `pushCollections(collections)` | Réplique les collections modifiées — **upsert uniquement** (non-destructif). | `upsert` |
| `pushTombstone(table, id)` | Enregistre une suppression puis retire la ligne source. | `upsert` + `delete` |
| `subscribeToChanges(onChange)` | Abonnement Realtime à `postgres_changes` (toutes tables). Retourne un *unsubscribe*. | Realtime |

**Authentification** (`lib/supabase.js`, `context/AuthContext.jsx`) :
`supabase.auth.signInWithPassword` → `profiles` chargé par email → session persistée.

### 4.2 — API interne (couche d'actions `DataContext`)

C'est le véritable contrat applicatif : ~30 actions exposées via `useData()`, qui muent l'état
puis se répliquent automatiquement. Équivalent fonctionnel d'endpoints REST.

```
Pistes      addLead · updateLeadStage · addLeadNote · leadsForUser · getLeadById
Partenaires addPartner · updatePartner · ensurePartnerForUser · getPartnerByUserId
Affiliation updateReferralStatus            (capture ?ref= : utils/referral.js)
Commissions addCommission · payCommission · payAllCommissionsForPartner
Catalogue   addProduct · updateProduct · deleteProduct
Devis       addDevis · markDevisPro
Boutique    addOrder · updateOrderStatus    (décrément/restitution de stock)
Formation   addFormation · updateFormation · deleteFormation · setFormationProgress
Abonnement  requestSubscription · confirmSubscriptionPayment · rejectSubscriptionPayment
Pro         saveCompany · addFacture · updateFacture · deleteFacture · getCompanyForUser
Système     resetData
```

**Garanties transverses** appliquées par cette couche :
- Identifiants : `crypto.randomUUID()` (jamais de collision, pas de compteur global fragile).
- Numérotation séquentielle métier : devis `BS-AAAAMMJJ-0001`, commandes `CMD-…`, factures `FAC-AAAA-001`.
- Effets de bord cohérents : confirmer une commande décrémente le stock, l'annuler le restitue ;
  apporter une piste déclenche les commissions N1/N2 selon le réseau de parrainage.

### 4.3 — Moteur de synchronisation (`useRemoteSync`)

```
DÉMARRAGE
  pullAll()
    ├─ base vide      → push de l'état local (cet appareil amorce la base)
    └─ base peuplée   → applyRemote() : merge (remote ∪ local-only) − tombstones
  setSyncStatus('online') ; subscribeToChanges()

CHANGEMENT LOCAL (effect sur `state`)
  diff par collection (référence !==) → pushCollections(modifiées)
  diff des ids disparus → pushTombstone(table, id)
  anti-écho : lastPushAt (ignore nos propres événements < 2,5 s)

CHANGEMENT DISTANT (Realtime)
  debounce 600 ms → refreshFromRemote() → applyRemote() (merge, jamais d'écrasement)
```

C'est le composant le plus délicat ; il est volontairement concentré dans un seul fichier,
derrière `remoteSync.js`, pour rester auditable.

---

## 5. Architecture de l'interface

### Arbre des providers (`App.jsx`)

```
BrowserRouter
└─ AuthProvider                 session (avant tout le reste)
   └─ AppRoutes
      ├─ isLoading → splash
      ├─ !user     → <Login/>
      └─ user →
         DataProvider           état métier + sync
         └─ ModeProvider        public / Pro (garde par abonnement)
            └─ CartProvider      panier boutique
               └─ ModeSwitch     ◄── monte UNE seule arborescence de routes
```

### Bascule de mode étanche (`ModeSwitch`)

- `mode === 'public'` → routes `/dashboard /pipeline /boutique /devis /plus`
- `mode === 'pro'` → routes `/pro /pro/gestion`
- Catch-all `*` qui redirige vers le tableau de bord du mode courant.

Une seule arborescence est rendue à la fois : aucune donnée publique n'est montée en mode Pro,
et inversement. La garde d'accès vit dans `ModeContext` (repli auto en public si l'abonnement
expire en cours de session).

### Coquille responsive unique (`AppLayout`)

Le **même** composant adapte la navigation au viewport, sans dupliquer les écrans :
- **Desktop** : `sidebar` latérale (marque, liens, utilisateur, déconnexion).
- **Mobile** : `tab-bar` inférieure (icônes + libellés courts).
- Les `navItems` changent selon le mode (`publicNavItems` / `proNavItems`).

### Design system (`index.css`)

CSS natif, **zéro dépendance UI** (pas de Tailwind, pas de librairie de graphiques) :
- Variables : `--primary:#0a2472`, `--accent:#f5a623`, `--success:#10b981`, `--radius:12px`…
- Primitives réutilisables : `card`, `stat-pill`, `dash-row`, `ring` (donut SVG), `rating-bar`,
  `alert-feed`, `kanban-*`, `sheet`, `bar-chart`.
- Graphiques faits main en SVG/CSS (anneaux, histogrammes) → bundle léger, rendu instantané.

---

## 6. Production-ready : ce qui est déjà en place

| Dimension | État actuel |
|---|---|
| **Build** | Vite 5, build vérifié sans erreur ; assets hashés, code-split PDF (`jspdf` chargé à la demande). |
| **Déploiement web** | Vercel, rewrites SPA, déploiement auto sur merge `main`. |
| **Mobile** | Capacitor (Android + iOS) sur le même `dist/` ; CI GitHub Actions pour l'APK. |
| **Sécurité** | RLS activé partout ; clés secrètes jamais exposées (`envPrefix` limité aux préfixes publics) ; client Supabase `null` proprement géré (mode local). |
| **Résilience** | Local-first : l'app reste pleinement utilisable hors-ligne ; sync non-destructive ; anti-écho ; debounce ; repli auto en cas d'erreur backend. |
| **Intégrité des données** | `crypto.randomUUID()`, numérotation séquentielle, migrations de seed versionnées (`SEED_VERSION`), correctifs catalogue ciblés. |
| **Conformité stores** | `public/privacy.html` (politique de confidentialité). |
| **Maintenabilité** | Loi de dépendance respectée, logique métier isolée en `utils/` purs, accès backend derrière une seule façade. |

---

## 7. Chemin vers le million d'utilisateurs

L'architecture actuelle est dimensionnée pour **une équipe / une PME**. Voici l'évolution
**sans réécriture**, par paliers — chaque palier reste compatible avec le code existant car les
accès backend sont déjà centralisés dans `lib/` et la logique métier isolée dans `utils/`.

**Palier 1 — Multi-tenant (plusieurs entreprises clientes)**
- Ajouter `org_id` aux tables et durcir la RLS : `using (org_id = auth.jwt() ->> 'org_id')`.
  → seul `supabase/schema.sql` change ; la couche d'actions reste identique.
- Plan de tarification SaaS au-dessus du module Devis Pro existant.

**Palier 2 — Validation côté serveur**
- Déplacer les invariants sensibles (calcul des commissions, transitions d'abonnement,
  décrément de stock) dans des **Edge Functions** / RPC Postgres pour ne plus faire confiance
  au client. La couche `remoteSync` appelle alors ces RPC au lieu d'`upsert` directs.

**Palier 3 — Volumétrie**
- Index sur `data->>'userId'`, `data->>'statut'`, `updated_at` ; pull incrémental
  (`updated_at > lastSync`) au lieu du pull complet → coût constant quand les données croissent.
- Normaliser progressivement les collections à fort volume (`leads`, `factures`) de JSONB vers
  colonnes typées pour requêtes analytiques.

**Palier 4 — Distribution & observabilité**
- CDN edge (déjà via Vercel) ; lecture sur réplicas Postgres ; cache.
- Monitoring (Sentry), métriques produit, journalisation des échecs de sync.

**Garde-fous à lever avant l'échelle** (dette assumée du MVP, pas des bugs) :
1. RLS « tout authentifié » → RLS par organisation (Palier 1) — **bloquant pour le multi-tenant**.
2. Logique métier côté client → côté serveur pour les données monétaires (Palier 2).
3. Pull complet au démarrage → pull incrémental (Palier 3).

---

## Annexe — Démarrer

```bash
npm install
npm run dev        # http://localhost:3000  (mode local, sans backend)
npm run build      # bundle de production → dist/
npm run preview    # prévisualiser le build

# Backend (optionnel) : créer .env à partir de .env.example
#   VITE_SUPABASE_URL=...
#   VITE_SUPABASE_ANON_KEY=...
# puis exécuter supabase/schema.sql dans le SQL Editor Supabase.
```

Comptes de démonstration (mode local) : `adam@bestasolar.bj` (gérant),
`fatou@bestasolar.bj` / `ibrahim@bestasolar.bj` (techniciens) — mot de passe `demo123`.
