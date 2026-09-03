-- Les clients Pro restent privés : seul leur créateur peut les consulter.
-- Le gérant conserve l'accès global aux leads classiques uniquement.
drop policy if exists "manager client access" on public."proClients";
