# Bibliothèque de composants — BestaSolar Pro

Référence visuelle vivante du design system : **tokens** (couleurs, typographie,
rayons/ombres) et **primitives** (boutons, badges, champs, cartes, mini-stats,
anneaux, pipeline, alertes, panneau). Chaque aperçu est un fichier HTML autonome
qui pointe vers `theme.css`.

But : disposer d'une **source de vérité visuelle unique** pour garder une cohérence
globale entre le web et les apps natives, et pouvoir **synchroniser vers Claude
Design** quand on veut.

## Voir les aperçus

Ouvrir `design-system/index.html` dans un navigateur. Pour un rendu fidèle des
liens relatifs, servir le dossier (au choix) :

```bash
npx serve design-system     # puis ouvrir l'URL affichée
# ou
python3 -m http.server -d design-system 8080
```

## Structure

```
design-system/
  theme.css                  # tokens :root + primitives (miroir de src/index.css)
  index.html                 # galerie de navigation
  tokens/
    colors.html
    typography.html
    spacing-radius-shadow.html
  components/
    buttons.html  badges.html  inputs.html  cards.html
    stat-pills.html  rings.html  pipeline.html  alerts.html  sheet.html
```

## Règle de cohérence (important)

`theme.css` est un **miroir documentaire** des primitives de `src/index.css` —
la véritable source reste `src/index.css` (consommée par l'app). Quand on modifie
une primitive partagée dans `src/index.css`, répercuter le changement ici pour que
la bibliothèque reste juste. Ne pas faire diverger les deux.

Les marqueurs `<!-- @dsCard group="…" name="…" -->` en première ligne de chaque
aperçu servent à l'indexation des cartes côté Claude Design.

## Synchroniser vers Claude Design (plus tard)

La synchro directe **n'est pas possible depuis une session Claude Code sur le web**
(elle exige `/design-login`, qui requiert un terminal interactif). Deux options :

1. **Depuis Claude Design** : utiliser « Send to Claude Code Web » pour relier un
   projet design-system au workspace, puis lancer la synchro.
2. **Depuis Claude Code en local** (desktop / CLI) : `/design-login`, puis la skill
   `/design-sync` qui poussera ce dossier, un composant à la fois.

### Pistes d'amélioration repérées (non appliquées)

L'aperçu `tokens/colors.html` signale des **couleurs sémantiques codées en dur**
dans `src/index.css` (`#047857`, `#92400e`, `#2563eb`…) qui gagneraient à devenir
des tokens (`--success-dark`, `--warning-dark`, `--info`). À traiter dans une passe
de cohérence dédiée si souhaité.
