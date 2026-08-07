# Historique des changements

> Journal des évolutions notables du dépôt, par session de travail. Les détails
> complets restent dans les messages de commit (`git log`) ; ce fichier sert de
> vue d'ensemble rapide, groupée par thème plutôt que par ordre chronologique brut.

---

## Session du 7 août 2026 — branche `claude/kit-selection-preconfigured-ixj6o0`

### Dimensionnement solaire — autonomie batterie

- Ajout d'un sélecteur **autonomie batterie** (1 / 1,5 / 2 nuits, 1 par défaut)
  à l'étape 3 du devis solaire (public et Pro), sous forme de chips discrets.
- Les **panneaux grandissent avec l'autonomie choisie** : le dimensionnement
  panneaux se base sur jour + nuit × nuits d'autonomie (pas seulement jour +
  nuit), pour qu'un parc batterie plus gros puisse se recharger en une journée
  même après une nuit blanche. Comportement par défaut inchangé (1 nuit).
- `src/utils/solarSizing.js` (`calculateSystemSize`, `AUTONOMY_OPTIONS`),
  `SolarWizard.jsx`, `ProSolarWizard.jsx`.

### Devis solaire — kit suggéré, panneaux, support, onduleur

- **Suggestion de kit** : ne considère plus que les kits dont la batterie
  **couvre** le besoin calculé (jamais un kit sous-dimensionné même si plus
  proche en valeur absolue). Plus de choix manuel d'un autre kit — un seul
  kit, toujours le bon, est proposé à l'étape 4.
- **Complétion automatique des panneaux** : si le kit suggéré (choisi sur sa
  batterie) a moins de panneaux que ce que le besoin exige à sa puissance
  crête, la quantité est complétée dans le devis — jamais réduite en dessous
  du nombre de panneaux du kit.
- **Type de support des panneaux** (page 4) : tôle (10 000 F/panneau, défaut),
  dalle (27 000 F/panneau), au sol (32 000 F/panneau) — recalcule la ligne
  « Structure de montage » au panneau. Option pour **ne pas inclure** la
  structure (client qui fait fabriquer chez son soudeur).
- `src/utils/solarSizing.js` (`suggestKitForBattery`, `buildKitQuotation`,
  `MOUNTING_TYPES`), `data/kits.js`.

### Onduleurs — nouvel onglet et suggestion automatique

- Nouvel écran **Plus › Onduleurs** (gérant), même modèle que « Mes kits » :
  marque, modèle, capacité (kVA), **puissance PV max (Wc)**, prix, rendement.
- Si l'onduleur prévu dans un kit n'a pas une puissance PV max suffisante pour
  le nombre de panneaux calculé (+ marge de sécurité), le devis le remplace
  automatiquement par le plus petit onduleur configuré qui convient — jamais
  un plus faible.
- Liste de départ reprise des onduleurs **réellement utilisés** dans les kits
  officiels (HZ 3/6 kVA, Itel 3 kVA, Deye 6 kVA), pas une gamme générique.
  ⚠️ Puissance PV max **estimée** (capacité × 1,3) — à corriger avec les vraies
  fiches techniques depuis l'écran.
- `src/data/inverters.js`, `src/utils/inverters.js`,
  `src/context/actions/inverters.js`, `src/screens/plus/InvertersSection.jsx`,
  `AppLayout.jsx` (barre latérale desktop), `solarSizing.js`
  (`suggestInverterForPower`), sync Supabase (`schema.sql`, `multitenant.sql`).

### Cohérence des prix — marge publique, Boutique, devis, kits

- Marge prix public (`PUBLIC_MARKUP`, `utils/price.js`) ramenée de **15 % à
  10 %**.
- **Boutique et tous les devis** (manuel, Pro, Pro solaire, kit) affichent
  désormais **toujours le prix public**, peu importe le rôle du créateur —
  avant, un technicien pouvait voir/facturer le prix technicien brut (coût de
  gros BestaSolar) sur un document remis à son propre client.
- **Synchronisation Mes kits ↔ Boutique** : une ligne de kit peut être liée à
  un produit boutique (nouveau champ, avec **moteur de recherche** par nom).
  Son prix suit alors le prix public **actuel** du produit — changer un prix
  en Boutique se répercute automatiquement dans « Mes kits » et sur tout
  nouveau devis, sans ressaisie.
- `src/utils/price.js`, `src/utils/kits.js` (`resolveLignePrice`),
  `src/utils/solarSizing.js` (`buildKitQuotation` + catalogue),
  `Boutique.jsx`, `ManualWizard.jsx`, `ProDevisBuilder.jsx`,
  `ProSolarWizard.jsx`, `KitsSection.jsx`.

---

*Convention : un paragraphe par lot de changements liés, fichiers clés en fin
de paragraphe. Le détail exact (avant/après, tests touchés) reste dans les
commits — `git log --oneline <base>..<branche>`.*
