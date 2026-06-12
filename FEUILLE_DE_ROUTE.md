# Feuille de route — BestaSolar Pro

Basée sur l'analyse du cahier des charges « Application Espace Technicien Solaire » (v1.0, mai 2026)
comparé à l'application existante. Couverture actuelle estimée : **75-80 % du CDC**, avec des
fonctionnalités au-delà du brief (CRM pipeline, réseau 2 niveaux, liens d'affiliation, temps réel).

Priorités : **P0** = cœur du CDC, à faire en premier · **P1** = important · **P2** = confort/bonus.

---

## ⚖️ Décisions à prendre avant de coder (bloquantes)

| # | Décision | Référence CDC | Impact |
|---|---|---|---|
| D1 | **Crédit : oui ou non ?** Le CDC le demande (annexe 10.1 : base = prix + 40 000 F installation, acompte 50 %, +10 %/6 mois, +15 %/12 mois, mensualités arrondies à la centaine) mais la direction a demandé « comptant uniquement » | §3.3.1, §10.1 | Phase 4 |
| D2 | **Règles de commission** : taux exact (% du HT), délai de validation (30 j après livraison ?), seuil minimum de paiement | §3.4.2 | Phase 2 |
| D3 | **Validité du devis** : 30 jours (actuel) ou 60 jours (CDC : « devis = apport reconnu ») | §3.4.2 | Phase 1 |
| D4 | **Fournisseur SMS/OTP** pour l'inscription des techniciens externes (coût par SMS au Bénin) — alternative : validation WhatsApp manuelle au démarrage | §3.1 | Phase 3 |
| D5 | **Compte Google Play** (25 $) et calendrier de publication | Livrables | Phase 7 |

---

## Phase 1 — Conversion et traçabilité des devis 🎯 P0

> Le maillon central du CDC : « lors de la vente, l'agent saisit le numéro de devis pour rattacher la vente au bon technicien »

- [ ] Statut sur chaque devis : **En cours / Converti en vente / Expiré**
- [ ] Expiration automatique à la fin de validité (30 ou 60 j — décision D3)
- [ ] Action « **Convertir en vente** » sur un devis (gérant) : passe la piste en Gagné, génère les commissions, fige le montant de vente
- [ ] Recherche d'un devis par numéro au moment de la vente (déjà possible via la recherche — ajouter le bouton de conversion au résultat)
- [ ] Le tableau de bord partenaire liste « devis convertis » avec la commission associée (§3.5.1)

*Effort estimé : 1 session.*

## Phase 2 — Commissions niveau CDC 💰 P0

- [ ] Statuts complets : **En attente → Validée → Payée**, plus **Annulée** (§3.5.1)
- [ ] Délai de validation paramétrable (D2) et seuil minimum de déclenchement du paiement
- [ ] **Export CSV/Excel** des commissions par période (§3.5.2)
- [ ] Filtres par **période** (mois/trimestre) en plus du statut et du partenaire
- [ ] Référence de transaction Mobile Money enregistrée au paiement

*Effort estimé : 1 session.*

## Phase 3 — Inscription des techniciens externes 🧑‍🔧 P0 (structurel)

> Le plus gros écart avec le CDC : passer d'un outil interne à une plateforme ouverte au réseau.

- [ ] Page d'**inscription publique** : nom, prénom, téléphone, ville, email optionnel (§3.1.1)
- [ ] **Choix du code partenaire personnalisé** (ex. KOFFI2024) avec vérification de disponibilité et alternatives ; code **immuable** après validation (§3.4.1)
- [ ] File de **validation par l'administrateur** avant activation du compte
- [ ] Notification d'activation (WhatsApp manuel au début, SMS automatique si D4 tranché)
- [ ] Connexion par **téléphone + mot de passe** (l'email devient optionnel) ; OTP SMS en option selon D4
- [ ] Rôle « technicien partenaire externe » : accès restreint à SON espace (sécurité RLS par utilisateur)
- [ ] Modification du profil par le technicien + photo de profil

*Effort estimé : 1-2 sessions.*

## Phase 4 — Devis : crédit (si D1 = oui), partage et QR ✍️ P1

- [ ] (D1) Réintégration du **crédit** selon la formule officielle §10.1 : frais d'installation 40 000 F, acompte 50 %, +10 %/6 mois ou +15 %/12 mois sur le total, mensualités arrondies à la centaine supérieure — tableau des mensualités sur le PDF
- [ ] **Partage WhatsApp direct du PDF** depuis l'app Android (plugin natif de partage Capacitor)
- [ ] **QR code** sur le PDF (lien boutique / fiche du kit recommandé)
- [ ] Champ « ville » du client sur le devis (actuellement adresse libre)

*Effort estimé : 1 session.*

## Phase 5 — Dimensionnement complet 🔆 P1

- [ ] **Correspondance kits BestaSolar** : proposer automatiquement le kit du catalogue le plus adapté au dimensionnement, avec modèle et prix (§3.2.3)
- [ ] **Autonomie** estimée (jours sans soleil) paramétrable
- [ ] Choix **contrôleur MPPT/PWM** avec ampérage + **sections de câble (mm²)** recommandées
- [ ] **Modèles de charges sauvegardés** (profils fréquents : maison type, boutique, congélateur…)
- [ ] Ajouter les kits congélateurs de l'annexe 10.3 au catalogue (118 L → 318 L) quand les prix seront fournis

*Effort estimé : 1 session.*

## Phase 6 — Notifications 🔔 P1

- [ ] Notifications push (Firebase + plugin Capacitor) : devis converti en vente, commission validée/payée, devis expirant dans 7 jours, annonces/promotions (§4.1)
- [ ] Centre de notifications dans l'app (cloche) pour le web

*Effort estimé : 1 session (+ configuration Firebase).*

## Phase 7 — Boutique enrichie & publication 🛍️ P2

- [ ] **Fiche produit détaillée** (page complète : composants inclus, specs, photos multiples)
- [ ] Filtres **puissance / prix**, section **promotions & nouveautés**
- [ ] Bouton **« Contacter BestaSolar »** (WhatsApp / appel) sur les fiches (§3.6.1)
- [ ] Comparateur côte-à-côte (web) (§3.6.2)
- [ ] **Publication Play Store** (release signée déjà prête — il manque le compte, D5) et build iOS (nécessite un Mac)
- [ ] Domaine personnalisé (app.bestasolar.com sur Vercel)

*Effort estimé : 1-2 sessions.*

## Phase 8 — Qualité, livrables & bonus 📚 P2

- [ ] Documentation **utilisateur** (guide technicien + guide admin, PDF) et **technique** (architecture, API, déploiement) (§6)
- [ ] Journalisation des actions sensibles (connexions, validations de commissions) (§5.2)
- [ ] Environnements séparés recette/production (2ᵉ projet Supabase + branche)
- [ ] **Gamification** : niveaux Bronze/Argent/Or, badges, classement mensuel (§4.5)
- [ ] Espace **formation** : fiches techniques PDF, tutoriels, glossaire solaire (§4.3)
- [ ] Messagerie/support intégré + FAQ (§4.2) — alternative simple : bouton WhatsApp support
- [ ] Géolocalisation des techniciens pour l'admin (§4.4)

---

## Déjà livré (au-delà du CDC sur plusieurs points)

✅ Web responsive + APK Android (CI automatique) · ✅ Pipeline CRM kanban · ✅ Dimensionnement solaire
· ✅ Devis PDF officiel numéroté avec code partenaire et attribution automatique · ✅ Catalogue réel 91 produits
géré par l'admin (photos, prix, stock) · ✅ Panier → devis · ✅ Réseau partenaires 2 niveaux + commissions
automatiques · ✅ Liens d'affiliation trackés · ✅ Espace partenaire personnel · ✅ Backend Supabase temps réel
· ✅ Recherche/tri · ✅ Pipeline de release signée Play Store

*Ordre recommandé : Phases 1-2 (le flux d'argent, court), puis Phase 3 (ouverture du réseau, structurel),
puis 4-6 selon les décisions D1-D4. Total estimé : 7 à 9 sessions de travail.*
