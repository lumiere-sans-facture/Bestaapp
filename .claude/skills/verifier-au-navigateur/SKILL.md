---
name: verifier-au-navigateur
description: Vérifier un changement visible de BestaSolar Pro dans un vrai navigateur (Playwright/Chromium), avec les comptes de démonstration. À utiliser dès qu'une modification touche un écran, un bouton, un document imprimé ou un comportement du navigateur — ouverture d'onglet, téléchargement, impression.
---

# Vérifier dans un navigateur

Les tests unitaires couvrent la logique pure. Ils ne voient pas : un bouton
masqué par un rôle, une règle CSS sans effet à cause d'une autre déclarée plus
bas, une fenêtre bloquée par le navigateur, un envoi réseau parti en double.
Ces quatre cas se sont réellement produits sur ce projet.

## Le serveur

```bash
npm run dev            # http://localhost:3000 — mode local, sans backend
```

Attendre qu'il réponde avant de lancer le navigateur.

## Le navigateur

Chromium est préinstallé. Deux exécutables, selon le besoin :

```
/opt/pw-browsers/chromium-1194/chrome-linux/chrome                  # complet
/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
```

Playwright s'importe depuis le dépôt — un script placé **à la racine du
projet** peut faire `import { chromium } from '@playwright/test'`. Depuis un
dossier extérieur, importer `node_modules/playwright-core/index.mjs` par son
chemin absolu.

## Entrer dans l'application

Le plus rapide : écrire l'utilisateur directement dans `localStorage`, sans
passer par l'écran de connexion.

```js
const GERANT = { id: 'u1', email: 'boss@bestasolar.bj', name: 'Adam',
                 role: 'gerant', phone: '+229', avatar: 'A' };
await page.goto('http://localhost:3000');
await page.evaluate((u) => localStorage.setItem('bestasolar_user', JSON.stringify(u)), GERANT);
await page.goto('http://localhost:3000/plus');
```

Le rôle compte : `gerant` voit des écrans qu'un `technicien` ne voit pas.
Par le formulaire : `adam@bestasolar.tg` / `demo123`.

Les scripts existants de `e2e/` montrent la mécanique complète (assertions,
lecture de `bestasolar_data`). S'en inspirer plutôt que repartir de zéro.

## Ce qu'il faut regarder

- `page.on('pageerror')` — une erreur JavaScript invalide la vérification.
- Le **texte réellement affiché** (`innerText`), pas le HTML. Attention aux
  libellés mis en majuscules par le CSS : chercher `DIAGNOSTIC`, pas
  `Diagnostic`.
- Les **requêtes émises** (`page.on('request')`) quand le changement touche un
  envoi réseau : c'est ainsi qu'un envoi parti en triple a été découvert.
- Une **capture d'écran**, et la regarder. Un rendu se juge à l'œil.

## Nettoyer

Supprimer les scripts temporaires laissés à la racine et arrêter le serveur de
développement avant de conclure.
