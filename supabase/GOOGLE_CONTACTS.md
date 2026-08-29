# Google Contacts — installation

Cette intégration synchronise les **partenaires** vers le compte Google Contacts choisi par le gérant de chaque organisation.

## 1. Google Cloud

1. Activez **People API** dans le projet Google Cloud.
2. Créez un client OAuth 2.0 de type **Application Web**.
3. Ajoutez exactement l'URL de rappel :
   `https://<project-ref>.supabase.co/functions/v1/google-contacts-oauth?action=callback`
4. Ajoutez l'écran de consentement et le scope `https://www.googleapis.com/auth/contacts`.

## 2. Base et Edge Functions

1. Exécutez `supabase/migrations/20260829_google_contacts.sql` dans le SQL Editor.
2. Déployez les deux fonctions :
   `supabase functions deploy google-contacts-oauth --no-verify-jwt`
   et `supabase functions deploy google-contacts-sync --no-verify-jwt`.
3. Ajoutez les secrets Supabase (jamais dans une variable `VITE_`) :

```bash
supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... \\
  GOOGLE_OAUTH_REDIRECT_URI=https://<project-ref>.supabase.co/functions/v1/google-contacts-oauth?action=callback \\
  SITE_URL=https://bestaapp.vercel.app GOOGLE_CONTACTS_CRON_SECRET=<secret-long-et-aleatoire>
```

## 3. Reprise automatique

Programmez un appel sécurisé toutes les 5 minutes vers `google-contacts-sync` avec le corps `{"action":"retry-pending"}` et l'en-tête `x-google-contacts-cron-secret`. La fonction reprend les jobs `pending` / `failed` arrivés à échéance ; sans réseau, le contact reste enregistré dans BestaSolar.

Le gérant connecte ensuite son compte depuis **Plus → Paramètres → Synchronisation Google Contacts**.

## Sécurité

- Les refresh tokens sont uniquement dans `google_contacts_configs`, sans policy RLS publique ; les Edge Functions utilisent la clé service_role.
- Le navigateur ne reçoit jamais un token Google, seulement l'adresse e-mail du compte connecté et son état.
- Les doublons sont évités par numéro Bénin normalisé et un verrou SQL `(org_id, normalized_phone)` juste avant `people.createContact`.
