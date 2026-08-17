# Recette avant mise en production

Liste de vérification à dérouler **sur l'aperçu Vercel de la branche**, avant
de fusionner vers `main`. L'ordre n'est pas décoratif : il va du plus risqué
(ce qui peut empêcher un utilisateur d'entrer) au plus visible mais réparable.

Cocher au fur et à mesure ; noter à côté ce qui cloche plutôt que de corriger
en passant — une liste interrompue ne se termine jamais.

## 0. Trouver l'aperçu

Vercel → *Deployments* → le déploiement le plus récent de la branche
`claude/kit-selection-preconfigured-ixj6o0`. Il a sa propre adresse, séparée
de la production.

⚠️ **Avant tout essai de connexion** : ajouter cette adresse dans Supabase →
*Authentication → URL Configuration → Redirect URLs*. Sans elle, les liens
reçus par e-mail arrivent mais sont refusés à l'atterrissage.

## 1. Entrer dans l'app — le plus critique

Ces écrans n'existent pas en production aujourd'hui : tout est neuf.

- [ ] **Inscription** d'un compte d'essai (adresse réelle) → l'e-mail de
      confirmation arrive, et le lien ouvre l'app connectée.
- [ ] **Mot de passe oublié** → l'e-mail arrive, le lien mène à la saisie du
      nouveau mot de passe, et le nouveau mot de passe fonctionne.
- [ ] Brevo → *Transactional → Logs* : les deux envois en `delivered`.
- [ ] **Connexion** avec un compte existant.

Si l'e-mail n'apparaît pas du tout dans les logs Brevo, c'est le SMTP de
Supabase qui n'est pas pris en compte — voir `supabase/DEPLOIEMENT.md` § 10.

## 2. Devis — le cœur du métier

- [ ] Créer un **devis solaire** : la liste d'appareils, le kit proposé, le total.
- [ ] Le devis apparaît badgé **« En cours »**.
- [ ] Ouvrir le devis → **« Revoir le dimensionnement »** : les appareils
      saisis sont là, on peut en ajouter un et enregistrer. Le **numéro du
      devis ne change pas** et il n'y a pas de second devis dans la liste.
- [ ] **« Convertir en vente »** (gérant) : l'affaire passe en gagné et la
      commission de l'apporteur apparaît dans *Commissions*.
- [ ] Créer un **devis manuel** depuis le panier de la boutique.

## 3. Documents — ce que le client reçoit

- [ ] **Devis imprimable (PDF)** : la police est bien IBM Plex Sans (pas la
      police du système), le logo et les couleurs sont là.
- [ ] **Fiche de dimensionnement (PDF)** : elle s'ouvre dans le lecteur PDF
      du navigateur, 3 pages, le graphique de couverture est correct.
- [ ] Sur **téléphone** : la fiche s'ouvre bien (c'est là que le blocage de
      fenêtre se produisait) et se partage sur WhatsApp.
- [ ] **Facture** depuis l'espace Pro : même contrôle de police et d'identité.

## 4. Paiement en ligne

À faire en **bac à sable** (`Plus → Moyens de paiement`), avec les numéros de
test KkiaPay affichés à l'écran.

- [ ] Boutique → panier → **Commander en ligne** → le widget s'ouvre.
- [ ] Paiement de test réussi → la commande passe payée.
- [ ] Paiement de test refusé → l'app le dit clairement, rien n'est crédité.
- [ ] **Abonnement Devis Pro** : même parcours, l'espace Pro s'ouvre après
      vérification serveur.

Sans les variables Vercel (`KKIAPAY_PRIVATE_KEY`, `KKIAPAY_SECRET`,
`SUPABASE_SERVICE_ROLE_KEY`), la vérification répond 503 et l'abonnement
retombe sur la validation manuelle : c'est prévu, pas une panne.

## 5. Surveillance — Plus → Diagnostic (gérant)

- [ ] La carte affiche la version, l'état de Sentry et celui de PostHog.
- [ ] **« Envoyer une erreur de test »** → le code `ERR-XXXX` apparaît, puis
      l'erreur se retrouve dans Sentry (onglet *Issues*).
- [ ] **« Tester l'envoi analytique »** → réponse `200`.
- [ ] Aucune ligne rouge « Analytique à corriger dans Vercel ».

## 6. Étanchéité et rôles

- [ ] Se connecter en **technicien** : ni *Équipe*, ni *Commissions*, ni
      *Abonnements Pro*, ni *Diagnostic*.
- [ ] Basculer en **mode Pro** puis revenir : aucune donnée de l'un ne
      s'affiche dans l'autre.

## 7. Hors ligne — l'invariant du projet

- [ ] Couper le réseau (mode avion) et rouvrir l'app : les écrans, les devis
      et les clients restent accessibles.
- [ ] Créer un devis hors ligne, puis rétablir le réseau : il remonte tout
      seul, sans doublon.
- [ ] La **fiche de dimensionnement** se génère aussi hors ligne, avec la
      bonne police (elle est embarquée depuis peu).

## 8. Le tour du propriétaire

Cinq minutes à cliquer partout, sur téléphone de préférence :

- [ ] Tableau de bord, Suivi clients, Clients, Boutique, Formation.
- [ ] Aucun écran blanc, aucun montant à `NaN`, aucun libellé en anglais.

---

Quand tout est coché : fusion vers `main`, et Vercel déploie la production.
En cas de doute sur un point, mieux vaut le signaler que le laisser passer —
c'est plus facile à corriger avant qu'après.
