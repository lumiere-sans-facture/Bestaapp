# SCALING.md — Architecture de montée en charge

> Conception système pour faire évoluer **BestaSolar Pro** de l'app mono-entreprise
> actuelle vers un **SaaS multi-tenant** capable de servir des milliers d'entreprises
> solaires. Chaque section est ancrée dans le code réel (`src/lib/remoteSync.js`,
> `src/context/useRemoteSync.js`, `supabase/schema.sql`, la couche `context/actions/`).
>
> ⚠️ **Statut** : ce document est une **conception + code de référence**. Les changements
> de schéma (RLS multi-tenant), de protocole (sync incrémentale) et de confiance (RPC
> serveur) **modifient le comportement** et exigent une validation sur un vrai projet
> Supabase avec ≥ 2 appareils. Ils ne sont **pas** câblés dans l'app tant que ce test
> n'est pas fait. Voir la matrice « Shippable maintenant ? » en fin de document.

---

## 1. Architecture du système

Cible : **local-first préservé**, backend qui passe de « réplication d'équipe » à
« plateforme multi-tenant ».

```
                         ┌───────────────────────────────────────────┐
   Clients (1 codebase)  │  Web (Vercel/CDN)   Android   iOS (Capacitor)│
                         └───────────────┬───────────────────────────┘
                                         │  L1 cache = localStorage (offline, instant)
                                         │  Façade unique : src/lib/remoteSync.js
                         ┌───────────────▼───────────────────────────┐
                         │                EDGE                         │
                         │  CDN assets · Service Worker (app shell)    │
                         └───────────────┬───────────────────────────┘
                                         │  REST + Realtime + RPC (Supabase)
                         ┌───────────────▼───────────────────────────┐
                         │              SUPABASE                       │
                         │  Postgres (RLS par org_id)                  │
                         │  Realtime (canaux scopés par org)           │
                         │  Edge Functions / RPC (opérations validées) │
                         │  Read replicas (lecture analytique)         │
                         └─────────────────────────────────────────────┘
```

**Invariant conservé** : `localStorage` reste la source de vérité côté client ; le
backend est une réplication. Aucun écran ne dépend du réseau (cf. `CLAUDE.md`).

**Ce qui change pour l'échelle** : isolation par `org_id` (sécurité + scalabilité des
requêtes), sync incrémentale (coût constant quand les données croissent), et opérations
monétaires validées côté serveur (confiance multi-tenant).

---

## 2. Structure des composants

La structure actuelle est déjà la bonne ; l'évolution est **additive**, pas une réécriture.

| Couche | Aujourd'hui | Évolution multi-tenant |
|---|---|---|
| UI (`screens/`, `components/`) | inchangée | inchangée |
| État (`context/dataState.js`) | `org_id` absent | l'état porte l'`org` de l'utilisateur connecté |
| Actions (`context/actions/*`) | calculs côté client | les opérations monétaires délèguent à des RPC |
| Sync (`context/useRemoteSync.js`) | pull complet | pull **delta** + curseur `lastSyncAt` |
| I/O (`lib/remoteSync.js`) | `pullAll`/`push*` | + `pullDelta(since)` + `rpc(...)` |
| Backend (`supabase/schema.sql`) | RLS « tout authentifié » | RLS **par `org_id`** + index `(org_id, updated_at)` |

Le point d'extension clé existe déjà : **toute I/O distante passe par `remoteSync.js`**
(invariant #2). On fait évoluer ce seul module ; les 20+ écrans ne changent pas.

---

## 3. Flux de données

### Écriture (inchangé dans son principe, scopé par org)
```
Action (context/actions/*) → setState → effet de réplication (useRemoteSync)
  → pushCollections(changed)         (upsert, idempotent par UUID)
  → pushTombstone(table, id)         (suppressions non-destructives)
  Chaque ligne porte org_id ; la RLS rejette toute écriture hors de l'org.
```

### Lecture — passage du **pull complet** au **pull incrémental**
```
1er démarrage (par appareil) : pullAll()                → état complet, lastSyncAt = max(updated_at)
Steady state (réveil Realtime / focus) : pullDelta(lastSyncAt)
  → SELECT … WHERE updated_at > lastSyncAt   (par table)
  → tombstones WHERE deleted_at > lastSyncAt
  → merge non-destructif (logique applyRemote déjà en place)
  → lastSyncAt = max(updated_at vus)
```
**Gain** : le coût d'une synchro devient proportionnel au **nombre de changements**,
plus à la taille totale des données. C'est ce qui débloque la montée en charge.

> Les colonnes nécessaires **existent déjà** : `updated_at` sur chaque collection et
> `deleted_at` sur `tombstones` (`supabase/schema.sql`). Aucune migration de colonne
> requise pour la sync incrémentale — uniquement de la logique applicative + index.

---

## 4. Conception d'API

La façade `remoteSync.js` reste le **seul** point d'I/O. Évolution :

```js
// Lecture
pullAll()                  // bootstrap : tout l'org (1er run)
pullDelta(since)           // steady state : seulement les lignes changées depuis `since`

// Écriture répliquée (CRDT-léger : upsert idempotent par UUID)
pushCollections(changed)   // inchangé, + colonne org_id
pushTombstone(table, id)   // inchangé

// Opérations validées côté serveur (confiance multi-tenant) — NOUVEAU
rpc('confirm_lead_won', { leadId })          // génère les commissions côté serveur
rpc('confirm_order', { orderId })            // décrémente le stock de façon atomique
rpc('confirm_subscription', { paymentId })   // étend l'abonnement (anti-fraude)
```

**Principe** : tout ce qui touche à l'**argent** ou au **stock** ne doit plus être
calculé par le client (il pourrait forger les montants). Ces actions (`updateLeadStage`
qui génère les commissions, `updateOrderStatus` qui modifie le stock,
`confirmSubscriptionPayment`) deviennent des appels RPC ; le client n'envoie que
l'intention, le serveur calcule et applique sous transaction.

### Référence — RPC Postgres (commissions générées côté serveur)
```sql
create or replace function confirm_lead_won(p_lead_id text)
returns void language plpgsql security definer as $$
declare v_org text; v_lead jsonb; v_val numeric; v_l1 text; v_l2 text;
begin
  -- l'org est dérivée du JWT, jamais du client
  v_org := auth_org_id();
  select data into v_lead from leads where id = p_lead_id and org_id = v_org;
  if v_lead is null then raise exception 'lead introuvable'; end if;
  v_val := (v_lead->>'estimatedValue')::numeric;
  v_l1  := v_lead->>'parrainL1';
  v_l2  := v_lead->>'parrainL2';
  -- commissions calculées par le serveur (taux non falsifiables)
  if v_l1 is not null then
    insert into commissions (id, org_id, data) values (
      gen_random_uuid()::text, v_org,
      jsonb_build_object('partnerId', v_l1, 'leadId', p_lead_id, 'level', 1,
                         'amount', round(v_val * 0.03), 'status', 'en_attente'))
    on conflict do nothing;
  end if;
  if v_l2 is not null then
    insert into commissions (id, org_id, data) values (
      gen_random_uuid()::text, v_org,
      jsonb_build_object('partnerId', v_l2, 'leadId', p_lead_id, 'level', 2,
                         'amount', round(v_val * 0.015), 'status', 'en_attente'))
    on conflict do nothing;
  end if;
  update leads set data = jsonb_set(data, '{stage}', '"gagne"'), updated_at = now()
   where id = p_lead_id and org_id = v_org;
end $$;
```

---

## 5. Schéma de base de données (multi-tenant)

### Isolation par organisation
```sql
-- Table des organisations (entreprises clientes du SaaS)
create table if not exists public.orgs (
  id text primary key,
  name text not null,
  plan text not null default 'free',          -- free | pro | enterprise
  created_at timestamptz not null default now()
);

-- Rattachement utilisateur → organisation (+ rôle)
alter table public.profiles add column if not exists org_id text references public.orgs(id);

-- Chaque collection et les tombstones portent l'org
-- (exécuté pour products, leads, partners, commissions, devis, referrals, orders,
--  formations, formationProgress, subscriptions, subscriptionPayments, companies,
--  factures, tombstones)
alter table public.leads add column if not exists org_id text not null;

-- Helper : org de l'utilisateur courant (lue depuis son profil)
create or replace function auth_org_id() returns text language sql stable as $$
  select org_id from public.profiles where id = auth.uid()::text
$$;
```

### RLS — d'« authentifié » à « membre de l'org »
```sql
-- Remplace la policy actuelle « team full access » par un cloisonnement par org :
create policy "org isolation" on public.leads for all to authenticated
  using (org_id = auth_org_id())
  with check (org_id = auth_org_id());
```

### Index — pour des requêtes delta à coût constant
```sql
-- Le pull incrémental scanne (org_id, updated_at) : index composite indispensable.
create index if not exists idx_leads_org_updated on public.leads (org_id, updated_at);
create index if not exists idx_tomb_org_deleted  on public.tombstones (org_id, deleted_at);
-- Idem pour chaque collection synchronisée.
```

> Migration **non rétro-compatible** : ajouter `org_id not null` impose de back-filler
> l'org existante d'abord, et l'app doit envoyer `org_id` sur chaque écriture **avant**
> d'activer la policy stricte (sinon les écritures sont rejetées). À dérouler en
> séquence app + schéma, testée — d'où le statut « non shippable à l'aveugle ».

---

## 6. Stratégie de cache (en couches)

| Couche | Mécanisme | Rôle | Statut |
|---|---|---|---|
| **L1 — client** | `localStorage` (état complet) | lectures instantanées, offline total | ✅ déjà en place |
| **L2 — delta** | `pullDelta(since)` + curseur `lastSyncAt` | ne transférer que les changements | 🔜 conception §3 |
| **L3 — push** | Realtime (`subscribeToChanges`) | invalidation serveur → client | ✅ déjà en place (déclenche un refresh) |
| **Edge** | CDN Vercel (assets hashés) + Service Worker | cold-start web hors-ligne, app shell | 🔜 PWA (precache chunks) |
| **DB** | index `(org_id, updated_at)` + read replicas | requêtes delta rapides, lecture analytique déportée | 🔜 §5 |

**Cohérence** : modèle « last-write-wins » par ligne (déjà le cas via upsert + UUID),
suffisant pour ce domaine (une équipe édite ses propres données). Le merge
non-destructif (`applyRemote`) + tombstones garantit l'absence de perte hors-ligne.

**Anti-thundering-herd** : aujourd'hui, tout changement déclenche un `pullAll` complet
sur chaque appareil. Avec L2, le réveil Realtime ne tire que le delta → le coût ne
dépend plus du nombre d'appareils × taille des données, mais du volume de changements.

---

## 7. Code d'implémentation — référence production-ready

### `pullDelta` (à ajouter dans `src/lib/remoteSync.js`)
```js
/** Pull incrémental : seulement les lignes modifiées/supprimées depuis `since` (ISO).
 *  Conserve la même forme de retour que pullAll pour réutiliser applyRemote. */
export async function pullDelta(since) {
  const fetched = await Promise.all(
    SYNCED_COLLECTIONS.map(async (table) => {
      const { data, error } = await supabase
        .from(table)
        .select('id, data, updated_at')
        .gt('updated_at', since);
      if (error) throw error;
      return [table, data || []];
    })
  );
  const collections = {};
  let maxUpdated = since;
  for (const [table, rows] of fetched) {
    collections[table] = rows.map((r) => ({ ...r.data, id: r.id }));
    for (const r of rows) if (r.updated_at > maxUpdated) maxUpdated = r.updated_at;
  }
  // Suppressions distantes depuis `since`
  const tombstones = new Map();
  const { data: tb } = await supabase
    .from('tombstones').select('id, collection, deleted_at').gt('deleted_at', since);
  for (const row of tb || []) {
    if (!tombstones.has(row.collection)) tombstones.set(row.collection, new Set());
    tombstones.get(row.collection).add(row.id);
  }
  return { collections, tombstones, cursor: maxUpdated };
}
```

### Intégration dans `useRemoteSync` (steady state)
```js
// Au lieu de refreshFromRemote() qui fait pullAll(), en régime établi :
const refreshDelta = async () => {
  try {
    const since = lastSyncAt.current;               // persisté en localStorage
    const { collections, tombstones, cursor } = await pullDelta(since);
    if (!cancelled) { applyRemote(collections, tombstones); lastSyncAt.current = cursor; }
  } catch (e) { console.error('Sync delta impossible :', e.message); }
};
// 1er run : pullAll() pour amorcer, puis bascule sur refreshDelta() au Realtime.
```

> `applyRemote` (merge non-destructif + tombstones) est **réutilisé tel quel** : la sync
> incrémentale ne change que *ce qu'on tire*, pas *comment on fusionne*. C'est ce qui
> rend l'évolution sûre une fois validée sur 2 appareils.

---

## Matrice — shippable maintenant ?

| Changement | Valeur | Risque | Shippable sans backend live ? |
|---|---|---|:--:|
| Index `(org_id, updated_at)` | élevée | nul (SQL additif) | ✅ (dans `schema.sql`, à exécuter) |
| `pullDelta` (code, non câblé) | élevée | nul tant que non utilisé | ✅ (fonction inerte) |
| Bascule sync → delta | élevée | **protocole** | ❌ test 2 appareils requis |
| RLS multi-tenant (`org_id`) | critique SaaS | **sécurité + migration** | ❌ séquence app+schéma testée |
| RPC opérations monétaires | critique SaaS | **confiance** | ❌ Edge Functions + tests |
| PWA / Service Worker | moyenne | moyen (cache offline) | ⚠️ à tester sur appareils réels |

**Recommandation de séquençage** : (1) activer le backend actuel et valider la sync à
2 appareils ; (2) ajouter les index + `pullDelta` et basculer la lecture en delta ;
(3) introduire `org_id` + RLS par org pour ouvrir le multi-tenant ; (4) déplacer les
opérations monétaires en RPC ; (5) PWA. Chaque palier est indépendant et testable seul.
