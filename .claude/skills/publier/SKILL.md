---
name: publier
description: Publier une modification de BestaSolar Pro — vérifications, journal, commit et push sur la branche de travail. À utiliser dès qu'un changement est terminé et prêt à partir, ou quand on demande de « publier », « pousser », « committer » ou « envoyer » le travail.
---

# Publier une modification

Ordre imposé. Aucune étape ne se saute : chacune a déjà rattrapé une panne
partie en production.

## 1. Les trois portes

```bash
npm run test     # 554 tests — logique métier pure
npx eslint .     # 0 problème attendu
npm run build    # le build Vite doit passer
```

Un échec ici s'arrête là. On corrige, on relance. On ne publie jamais « en
sachant que ça casse » : le gérant déploie sur Vercel à la fusion.

## 2. Relire son propre diff

`git diff` en entier. On cherche :

- une **donnée client** (nom, téléphone, adresse) interpolée dans un message
  d'erreur — interdit, citer l'identifiant (`client c-4f2a introuvable`) ;
- un `Date.now()` ou un compteur en guise d'identifiant — c'est
  `crypto.randomUUID()` ;
- un appel direct à `supabase.from(...)` hors de `src/lib/remoteSync.js` ;
- un écran rendu dépendant du backend — l'app doit marcher sans réseau ;
- une clé secrète, un jeton, un mot de passe. Jamais dans le dépôt.

## 3. Vérifier pour de vrai

Si le changement se voit à l'écran, il se vérifie **dans un navigateur**, pas
seulement par les tests — voir la procédure `verifier-au-navigateur`. Les
tests ne voient ni une fenêtre bloquée, ni un bouton invisible, ni un CSS sans
effet.

## 4. Journal

Une ligne dans `HISTORY.md`, en haut de la date du jour, en français, qui dit
le bénéfice — pas le fichier touché.

> ✅ `Fiche de dimensionnement : ouverte en vrai PDF, prête à envoyer au client`
> ❌ `Refactor de sizingSheet/index.js`

## 5. Commit

Message en français : un titre court, puis **pourquoi**, pas quoi. Le diff dit
déjà le quoi. Mentionner ce qui a été mesuré ou vérifié.

Pied de message, tel quel :

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: <lien de la session>
```

## 6. Push

```bash
git push -u origin <branche-de-travail>
```

En cas de rejet, quelqu'un a poussé entre-temps : `git fetch`, **lire ses
commits**, rebaser, résoudre en respectant son intention. Ne jamais écraser le
travail d'un autre auteur sans le dire.

Pas de pull request sans demande explicite. Rien ne va sur `main` sans accord.
