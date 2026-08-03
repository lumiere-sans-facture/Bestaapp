# Vérifications en navigateur réel

Ces scénarios pilotent l'application dans un vrai navigateur, comme un
utilisateur. Ils existent parce que plusieurs défauts n'étaient visibles
qu'à l'usage et invisibles aux tests unitaires :

- un champ de formulaire qui perdait le focus à chaque caractère ;
- un écran blanc causé par une variable supprimée mais encore référencée.

## Lancer

```bash
npm run dev                 # dans un terminal
node e2e/suivi-clients.mjs  # dans un autre
node e2e/commissions.mjs
```

Chaque scénario prépare son propre jeu de données (mode local, sans backend)
puis vérifie ce que l'utilisateur voit réellement à l'écran.

## Ce qui est couvert

| Fichier | Vérifie |
|---|---|
| `suivi-clients.mjs` | Deux devis d'un même client donnent deux cartes distinctes, dans des colonnes différentes, chacune avec son numéro et son montant ; un client sans devis garde sa carte de prospection ; la barre de progression est présente ; déplacer une affaire ne touche pas l'autre. |
| `commissions.mjs` | Une affaire passée à « Gagné » crée la commission **automatiquement**, au bon montant, rattachée au bon devis ; deux affaires gagnées donnent deux commissions sans doublon ; elles apparaissent dans l'écran Commissions. |
