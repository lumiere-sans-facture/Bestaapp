#!/bin/bash
# Démarrage de session — Claude Code sur le web.
#
# Sans ce script, chaque session commence sur un dépôt sans dépendances : ni
# tests, ni build, ni linter. L'agent le découvre en échouant, puis installe à
# la main. Ici c'est fait une fois, avant qu'il ne commence à travailler, et
# l'état du projet lui est annoncé d'entrée.
set -euo pipefail

# Uniquement en environnement distant : sur la machine du gérant, les
# dépendances sont déjà là et une réinstallation à chaque ouverture serait du
# temps perdu.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# `npm install` plutôt que `npm ci` : l'état du conteneur est mis en cache
# après le hook, et l'installation incrémentale en profite.
echo "→ Installation des dépendances…"
npm install --no-audit --no-fund

echo ""
echo "=== État du projet BestaSolar Pro ==="

# Les deux portes de sortie du projet (voir CLAUDE.md) : les tests et le
# build. Le linter s'y ajoute. Un échec ici n'interrompt PAS la session — il
# est signalé, pour que l'agent sache s'il part d'une base saine ou déjà
# cassée, et ne mette pas sur son dos une panne préexistante.
if npm run test >/tmp/besta-test.log 2>&1; then
  echo "✅ Tests : $(grep -oE 'Tests +[0-9]+ passed' /tmp/besta-test.log | tail -1)"
else
  echo "‼️ Tests EN ÉCHEC avant toute modification — voir /tmp/besta-test.log"
  tail -20 /tmp/besta-test.log
fi

if npx eslint . >/tmp/besta-lint.log 2>&1; then
  echo "✅ Linter : aucun problème"
else
  echo "‼️ Linter : $(tail -3 /tmp/besta-lint.log | tr '\n' ' ')"
fi

echo ""
echo "Rappels (CLAUDE.md) : local-first, accès backend via src/lib/remoteSync.js"
echo "uniquement, UI et commentaires en français. Avant tout commit :"
echo "npm run test ET npm run build."
