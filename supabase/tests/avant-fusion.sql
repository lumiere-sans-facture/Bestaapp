-- Données exigées par la migration de fusion (20260902) : exactement un
-- gérant plateforme, et Google Contacts configuré. Jouées juste avant elle.
insert into public.profiles (id, email, name, role, org_id, is_platform_admin)
values ('u-gerant', 'gerant@besta.tg', 'Gérant Besta', 'gerant', 'org-bestasolar', true)
on conflict do nothing;
insert into public.google_contacts_configs (org_id, refresh_token, sync_enabled)
values ('org-bestasolar', 'jeton-test', true) on conflict do nothing;
