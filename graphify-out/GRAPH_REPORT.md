# Graph Report - Bestaapp  (2026-08-05)

## Corpus Check
- 150 files · ~123,061 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 729 nodes · 1862 edges · 44 communities (37 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c6a70a46`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- useData
- solarSizing.js
- ProDashboard.jsx
- docTemplates/shared.js
- dataActions.js
- App.jsx
- FormationSection.jsx
- commissionDocs.js
- Architecture — BestaSolar Pro
- dependencies
- AppDelegate
- SCALING.md — Architecture de montée en charge
- schema.sql
- logoColors.js
- Feuille de route — BestaSolar Pro
- proDocPdf.js
- package.json
- devisPdf.js
- CLAUDE.md — Guide de l'agent
- Bibliothèque de composants — BestaSolar Pro
- devDependencies
- BestaSolar Pro
- StageBadge.jsx
- ExampleInstrumentedTest.java
- solar.js
- ExampleUnitTest.java
- gradlew
- ensoleillement.js
- MainActivity.java
- vercel.json
- mcp.json
- Package.swift
- CapApp-SPM/README.md
- solarData.js
- multitenant.sql
- public.is_team_member

## God Nodes (most connected - your core abstractions)
1. `useData()` - 70 edges
2. `useAuth()` - 57 edges
3. `formatCFA()` - 53 edges
4. `formatDate()` - 32 edges
5. `DocumentsTab()` - 20 edges
6. `ProSolarWizard()` - 20 edges
7. `ProDashboard()` - 17 edges
8. `Field()` - 16 edges
9. `FormationSection()` - 16 edges
10. `SolarWizard()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `generateDevisPdf()` --references--> `jspdf`  [EXTRACTED]
  src/utils/devisPdf.js → package.json
- `generateProPdf()` --references--> `jspdf`  [EXTRACTED]
  src/utils/proDocPdf.js → package.json
- `AppRoutes()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.jsx → src/context/AuthContext.jsx
- `AppLayout()` --calls--> `useAuth()`  [EXTRACTED]
  src/components/AppLayout.jsx → src/context/AuthContext.jsx
- `AppLayout()` --calls--> `useData()`  [EXTRACTED]
  src/components/AppLayout.jsx → src/context/DataContext.jsx

## Import Cycles
- None detected.

## Communities (44 total, 7 thin omitted)

### Community 0 - "useData"
Cohesion: 0.07
Nodes (76): EmptyState(), Field(), PageHeader(), Sheet(), TVA_PCT, TVA_RATE, AuthContext, useAuth() (+68 more)

### Community 1 - "solarSizing.js"
Cohesion: 0.07
Nodes (55): LOGO_BESTASOLAR, LOGO_RATIO, applianceCategories, appliances, CUSTOM_APPLIANCE_ID, CUSTOM_APPLIANCE_LABEL, getApplianceById(), newCustomAppliance() (+47 more)

### Community 2 - "ProDashboard.jsx"
Cohesion: 0.10
Nodes (42): Ring(), Dashboard(), ClientsTab(), EMPTY, norm(), DocumentsTab(), nextStatut(), nextStatutLabel() (+34 more)

### Community 3 - "docTemplates/shared.js"
Cohesion: 0.08
Nodes (53): COMPANY, EMPTY_COMPANY, EMPTY_LIGNE, FacturePreview(), SAMPLE, exportDevisProPdf(), exportFacturePdf(), previewDocument() (+45 more)

### Community 4 - "dataActions.js"
Cohesion: 0.08
Nodes (41): createCatalogueActions(), createDevisActions(), createFormationActions(), createLeadActions(), note(), STAGE_LABEL, createPartnerActions(), createProActions() (+33 more)

### Community 5 - "App.jsx"
Cohesion: 0.06
Nodes (33): ALL_SCREENS, App(), AppRoutes(), Boutique, Clients, Dashboard, Devis, ModeSwitch() (+25 more)

### Community 6 - "FormationSection.jsx"
Cohesion: 0.20
Nodes (20): EMPTY_COURSE, EMPTY_LECON, FormationSection(), LECON_ICON, LECON_TYPE_LABEL, allLecons(), chaptersToText(), courseCounts() (+12 more)

### Community 7 - "commissionDocs.js"
Cohesion: 0.10
Nodes (33): useRemoteSync(), pullAll(), pushCollections(), pushTombstone(), subscribeToChanges(), SYNCED_COLLECTIONS, anonKey, isSupabaseConfigured (+25 more)

### Community 8 - "Architecture — BestaSolar Pro"
Cohesion: 0.08
Nodes (23): 1. Architecture du système, 2. Structure des fichiers, 3. Schéma de base de données, 4.1 — API distante (Supabase, auto-générée), 4.2 — API interne (couche d'actions `DataContext`), 4.3 — Moteur de synchronisation (`useRemoteSync`), 4. Endpoints / Couche d'API, 5. Architecture de l'interface (+15 more)

### Community 9 - "dependencies"
Cohesion: 0.10
Nodes (21): @capacitor/android, @capacitor/cli, @capacitor/core, @capacitor/ios, jspdf-autotable, lucide-react, dependencies, @capacitor/android (+13 more)

### Community 10 - "AppDelegate"
Cohesion: 0.13
Nodes (13): Any, Bool, Capacitor, AppDelegate, NSUserActivity, UIApplication, UIApplicationDelegate, UIKit (+5 more)

### Community 11 - "SCALING.md — Architecture de montée en charge"
Cohesion: 0.11
Nodes (17): 1. Architecture du système, 2. Structure des composants, 3. Flux de données, 4. Conception d'API, 5. Schéma de base de données (multi-tenant), 6. Stratégie de cache (en couches), 7. Code d'implémentation — référence production-ready, Index — pour des requêtes delta à coût constant (+9 more)

### Community 12 - "schema.sql"
Cohesion: 0.12
Nodes (16): public.commissions, public.companies, public.devis, public.factures, public."formationProgress", public.formations, public.leads, public.orders (+8 more)

### Community 13 - "logoColors.js"
Cohesion: 0.25
Nodes (11): couleursDepuisPixels(), couleursDuLogo(), ecartTeinte(), hexDe(), lisibleSousBlanc(), luminance(), saturation(), teinte() (+3 more)

### Community 14 - "Feuille de route — BestaSolar Pro"
Cohesion: 0.17
Nodes (11): ⚖️ Décisions à prendre avant de coder (bloquantes), Déjà livré (au-delà du CDC sur plusieurs points), Feuille de route — BestaSolar Pro, Phase 1 — Conversion et traçabilité des devis 🎯 P0, Phase 2 — Commissions niveau CDC 💰 P0, Phase 3 — Inscription des techniciens externes 🧑‍🔧 P0 (structurel), Phase 4 — Devis : crédit (si D1 = oui), partage et QR ✍️ P1, Phase 5 — Dimensionnement complet 🔆 P1 (+3 more)

### Community 15 - "proDocPdf.js"
Cohesion: 0.27
Nodes (8): jspdf, jspdf, DARK, fmt(), fmtDate(), generateProPdf(), GRAY, hexToRgb()

### Community 16 - "package.json"
Cohesion: 0.20
Nodes (9): name, private, scripts, build, dev, preview, test, type (+1 more)

### Community 17 - "devisPdf.js"
Cohesion: 0.31
Nodes (8): ACCENT, fmt(), fmtDate(), generateDevisPdf(), GRAY, LIGHT, NAVY, qtyLabel()

### Community 18 - "CLAUDE.md — Guide de l'agent"
Cohesion: 0.25
Nodes (7): Backend (optionnel), CLAUDE.md — Guide de l'agent, Commandes, Conventions, Git / déploiement, Invariants à préserver (ne pas casser), Où vit quoi (loi de dépendance)

### Community 19 - "Bibliothèque de composants — BestaSolar Pro"
Cohesion: 0.29
Nodes (6): Bibliothèque de composants — BestaSolar Pro, Pistes d'amélioration repérées (non appliquées), Règle de cohérence (important), Structure, Synchroniser vers Claude Design (plus tard), Voir les aperçus

### Community 20 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, vite, @vitejs/plugin-react, vitest, vite, @vitejs/plugin-react, vitest

### Community 21 - "BestaSolar Pro"
Cohesion: 0.29
Nodes (6): Architecture, Backend partagé (Supabase), BestaSolar Pro, Comptes de démonstration, Démarrage, Stack

### Community 22 - "StageBadge.jsx"
Cohesion: 0.43
Nodes (7): cache, contraste(), encreDEtape(), hex2rgb(), lumRel(), rgb2hex(), StageBadge()

### Community 23 - "ExampleInstrumentedTest.java"
Cohesion: 0.60
Nodes (3): ExampleInstrumentedTest, Test, RunWith

### Community 24 - "solar.js"
Cohesion: 0.80
Nodes (4): fetchNASA(), fetchPVGIS(), handler(), round1()

### Community 26 - "gradlew"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

### Community 27 - "ensoleillement.js"
Cohesion: 0.67
Nodes (3): DEFAULT_CITY, ENSOLEILLEMENT, pshForCity()

### Community 41 - "solarData.js"
Cohesion: 0.44
Nodes (8): combineSolar(), fetchSolarData(), fromBoth(), fromNASA(), fromPVGIS(), nasaToSolar(), pvgisToSolar(), round1()

### Community 42 - "multitenant.sql"
Cohesion: 0.50
Nodes (4): public.auth_org_id(), public.orgs, public.signup_create_org(), public.profiles

## Knowledge Gaps
- **199 isolated node(s):** `github`, `UIKit`, `Capacitor`, `PackageDescription`, `name` (+194 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useData()` connect `useData` to `solarSizing.js`, `ProDashboard.jsx`, `App.jsx`, `FormationSection.jsx`, `commissionDocs.js`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `jspdf` connect `proDocPdf.js` to `dependencies`, `devisPdf.js`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`, `proDocPdf.js`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **What connects `github`, `UIKit`, `Capacitor` to the rest of the system?**
  _199 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useData` be split into smaller, more focused modules?**
  _Cohesion score 0.06735537190082645 - nodes in this community are weakly interconnected._
- **Should `solarSizing.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06526806526806526 - nodes in this community are weakly interconnected._
- **Should `ProDashboard.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09717514124293786 - nodes in this community are weakly interconnected._