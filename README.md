# BestaSolar Pro

CRM solaire pour la gestion des pistes commerciales, de la boutique, des devis et des commissions de parrainage — Parakou, Bénin.

Application **web et mobile** (une seule base de code) :
- **Grand écran** : barre latérale fixe, contenu pleine page (kanban, grilles de produits, tableau de bord en colonnes).
- **Mobile** : barre d'onglets en bas, panneaux montants (bottom sheets), défilement tactile.

## Démarrage

```bash
npm install
npm run dev       # serveur de développement (port 3000)
npm run build     # build de production dans dist/
npm run preview   # prévisualisation du build
```

## Comptes de démonstration

| Rôle | Email | Mot de passe |
|---|---|---|
| Gérant | adam@bestasolar.bj | demo123 |
| Technicien | fatou@bestasolar.bj | demo123 |

## Architecture

```
src/
├── context/        # AuthContext (session) et DataContext (données + actions, persistées en localStorage)
├── components/     # AppLayout (sidebar/tab bar), PageHeader, Sheet (bottom sheet mobile / fenêtre desktop)
├── screens/        # Login, Dashboard, Pipeline, Boutique, Devis, Plus
├── data/seed.js    # Données de démonstration
├── utils/format.js # Formatage F CFA, dates, initiales
└── index.css       # Design system (variables CSS, mobile-first, breakpoints 640px / 1024px)
```

## Backend partagé (Supabase)

Sans configuration, l'app fonctionne en **mode local** : les données restent sur l'appareil (`localStorage`). Pour partager les données entre tous les appareils en temps réel :

1. Créez un projet sur [supabase.com](https://supabase.com) (gratuit)
2. Dans **SQL Editor**, collez et exécutez le contenu de [`supabase/schema.sql`](supabase/schema.sql)
3. Dans **Authentication → Users**, créez les comptes de l'équipe (mêmes emails que les profils : `adam@bestasolar.bj`, `fatou@bestasolar.bj`, `ibrahim@bestasolar.bj`)
4. Récupérez l'URL du projet et la clé `anon` dans **Settings → API**, puis renseignez-les :
   - **Vercel** : Settings → Environment Variables → `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`, puis redéployez
   - **APK Android** : mêmes noms dans GitHub → Settings → Secrets and variables → Actions
   - **En local** : copiez `.env.example` en `.env.local`

Au premier démarrage connecté, l'app **pousse automatiquement son catalogue et ses données vers la base** ; ensuite tous les appareils lisent et écrivent les mêmes données, mises à jour en temps réel (pastille de statut à côté du nom de l'utilisateur).

## Stack

- [React 18](https://react.dev) + [Vite 5](https://vitejs.dev)
- [React Router 6](https://reactrouter.com)
- [Lucide](https://lucide.dev) pour les icônes
- CSS natif (variables, grid, flexbox) — aucun framework CSS

<!-- Déploiement : 2026-06-12T23:21 -->
<!-- Déploiement : 2026-06-12T23:27 -->
<!-- Déploiement : 2026-06-12T23:47 -->
