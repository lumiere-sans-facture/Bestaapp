# CLAUDE.md — Guide de l'agent

Contexte pour Claude Code travaillant sur **BestaSolar Pro** : CRM solaire local-first
(React 18 + Vite 5 + Supabase) pour BestaSolar, Parakou (Bénin). Web responsive + apps
natives Android/iOS (Capacitor) depuis une seule base de code.

> Pour la carte complète du système (flux de données, schéma BDD, paliers de montée en
> charge), voir **`ARCHITECTURE.md`**. Ce fichier-ci ne liste que les règles à respecter.

## Commandes

```bash
npm install
npm run dev       # http://localhost:3000 (mode local, sans backend)
npm run build     # bundle de production -> dist/  (À LANCER avant tout commit)
npm run preview   # prévisualiser le build
npm run test      # tests unitaires (Vitest) sur la logique métier pure
```

Pas de linter configuré. **La vérification, c'est `npm run test` ET `npm run build`
qui passent sans erreur**, plus une relecture du diff. Les tests couvrent les
utilitaires purs de `src/utils/` (devis solaire, totaux facture, affiliation, dates,
abonnement, format, puissance) — y ajouter un test quand on touche à cette logique.

## Invariants à préserver (ne pas casser)

1. **Local-first.** L'app doit rester 100 % fonctionnelle sans backend. `localStorage`
   est la source de vérité ; Supabase est une réplication *optionnelle*, auto-détectée
   via `isSupabaseConfigured`. Ne jamais rendre un écran dépendant de Supabase.
2. **Accès backend uniquement via `src/lib/remoteSync.js`.** Aucun composant ni contexte
   n'appelle `supabase.from(...)` directement (sauf `lib/supabase.js` et l'auth dans
   `context/AuthContext.jsx`). Toute nouvelle I/O distante passe par ce module.
3. **Sync non-destructive.** Les suppressions passent par les *tombstones*
   (`pushTombstone`), jamais par un delete-par-absence. Le merge à la réception
   (`applyRemote`) conserve les items créés hors-ligne. Ne pas « simplifier » ça.
4. **Mode public / Pro étanche.** Une seule arborescence de routes est montée à la fois
   (`App.jsx` → `ModeSwitch`). Aucune donnée publique ne doit fuiter en mode Pro et
   inversement. La bascule Pro est réservée aux abonnés actifs (`ModeContext`).
5. **Identifiants** : `crypto.randomUUID()` pour toute nouvelle entité — jamais
   `Date.now()` ni de compteur global comme id.
6. **Mutations d'état** : toujours via les actions de `context/DataContext.jsx`
   (`useData()`), jamais en mutant `state` directement. La réplication Supabase est
   automatique sur tout changement d'état.

## Où vit quoi (loi de dépendance)

`screens → components → context → lib → (data | utils)` — jamais l'inverse.

- `src/utils/` : **logique métier pure**, sans React. Y mettre tout calcul réutilisable
  (dates → `utils/date.js`, totaux facture → `utils/facture.js`, dimensionnement solaire
  → `utils/solarSizing.js`, affiliation → `utils/referral.js`). C'est le code le plus
  testable : le privilégier.
- `src/context/` : état global (Auth, Data, Mode, Cart). `DataContext` est un
  *composition root* mince qui assemble `dataState.js` (forme/migration/persistance),
  `dataActions.js` (les ~30 actions, `createActions(setState)`) et `useRemoteSync.js`
  (moteur de réplication). Ajouter une action → `dataActions.js`, pas le Provider.
- `src/lib/` : accès Supabase (client + réplication).
- `src/data/` : données de référence (seed, catalogue, ensoleillement).
- `src/screens/` : une page par route ; sous-dossiers `devis/`, `plus/`, `pro/`.
- `src/components/` : UI partagée (`AppLayout`, `Sheet`, `Ring`, `PageHeader`…).

## Conventions

- **Constantes plutôt que littéraux dupliqués** : taux TVA → `config/company.js`
  (`TVA_RATE`), durées en jours → `utils/date.js` (`DAY_MS`), taux de commission →
  `DataContext` (`COMMISSION_RATES`). Réutiliser, ne pas recopier une valeur.
- **Helpers de date** : utiliser `utils/date.js` (`isSameMonth`, `ageInDays`,
  `daysSince`…), ne pas réécrire de calcul de mois/d'âge dans un écran.
- **Styles** : CSS natif dans `src/index.css` (variables `--primary`, `--accent`,
  `--radius`… + primitives `card`, `stat-pill`, `ring`, `sheet`, `alert-feed`).
  Pas de Tailwind, pas de librairie de graphiques — les charts sont faits main en
  SVG/CSS. Réutiliser les primitives existantes avant d'en créer.
- **Langue** : UI, libellés et commentaires en **français**. Montants en F CFA via
  `formatCFA` (`utils/format.js`).
- **Numérotation métier** : devis `BS-AAAAMMJJ-0001`, commandes `CMD-…`,
  factures `FAC-AAAA-001` (compteur par entreprise dans `companies`).

## Backend (optionnel)

Créer `.env` depuis `.env.example` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), puis
exécuter `supabase/schema.sql` dans le SQL Editor Supabase — **y compris le bloc
`tombstones`**, requis avant toute synchronisation multi-appareils.

## Git / déploiement

- Développer sur la branche `claude/mobile-web-app-rebuild-7vdnm7`.
- Vercel déploie automatiquement sur merge vers `main` (squash).
- Ne pas créer de PR sans demande explicite.
