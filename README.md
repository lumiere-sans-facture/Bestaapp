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

Les données (pistes, devis créés, changements d'étape) sont conservées dans le `localStorage` du navigateur. Pour repartir de zéro, videz le stockage du site.

## Stack

- [React 18](https://react.dev) + [Vite 5](https://vitejs.dev)
- [React Router 6](https://reactrouter.com)
- [Lucide](https://lucide.dev) pour les icônes
- CSS natif (variables, grid, flexbox) — aucun framework CSS
