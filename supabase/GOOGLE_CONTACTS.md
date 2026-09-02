# Google Contacts — installation

Cette intégration synchronise les **clients** et les **partenaires** vers le compte Google Contacts choisi par le gérant de chaque organisation.

## 1. Google Cloud

1. Activez **People API** dans le projet Google Cloud.
2. Créez un client OAuth 2.0 de type **Application Web**.
3. Ajoutez exactement l'URL de rappel :
   `https://<project-ref>.supabase.co/functions/v1/google-contacts-oauth?action=callback`
4. Ajoutez l'écran de consentement et le scope `https://www.googleapis.com/auth/contacts`.

## 2. Base et Edge Functions

1. Exécutez, dans cet ordre, `supabase/migrations/20260829_google_contacts.sql`,
   `supabase/migrations/20260830_google_contacts_leads.sql` puis
   `supabase/migrations/20260902_google_contacts_all_clients.sql` dans le SQL Editor.
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

Programmez un appel sécurisé toutes les 5 minutes vers `google-contacts-sync` avec le corps `{"action":"retry-pending"}` et l'en-tête `x-google-contacts-cron-secret`. La fonction reprend les jobs `pending` / `failed` arrivés à échéance ; sans réseau, le contact reste enregistré dans BestaSolar. Cette planification est nécessaire : la base sait mettre chaque client en file, mais seul le serveur peut utiliser le jeton Google sécurisé.

Les entrées créées depuis **Clients** (collection `leads`), **Devis Pro** (collection `proClients`) et **Partenaires** sont synchronisées. Tout membre actif de l'organisation est traité de la même manière, quelle que soit son inscription. Le compte Google connecté par le gérant reste le destinataire central. La migration du 2 septembre met aussi les anciens clients en file.

Le gérant connecte ensuite son compte depuis **Plus → Paramètres → Synchronisation Google Contacts**. Ce compte est unique pour toute l'organisation : un client créé par n'importe quel membre est envoyé vers le compte Google du gérant, sans que les membres aient à connecter leur propre compte.

Après le changement de format des codes, exécutez aussi `migrations/20260831_partner_code_format.sql`. Les codes deviennent `NOM-XXXXXX` et les anciennes références de parrainage sont remappées.

## Sécurité

- Les refresh tokens sont uniquement dans `google_contacts_configs`, sans policy RLS publique ; les Edge Functions utilisent la clé service_role.
- Le navigateur ne reçoit jamais un token Google, seulement l'adresse e-mail du compte connecté et son état.
- Les doublons sont évités par téléphone normalisé **ou** e-mail, avec un verrou SQL par organisation juste avant `people.createContact` / `people.updateContact`.
- Chaque fiche conserve l'auteur initial et l'historique des utilisateurs ou partenaires qui l'ont ajoutée. Google Contacts reçoit une note de traçabilité, sans exposer de jeton au navigateur.
