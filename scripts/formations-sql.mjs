// Génère supabase/formations-academie.sql depuis src/data/formationsAcademie.js.
//
// En mode SaaS, les cours ne viennent pas du seed de l'application : ils sont
// l'actif de l'organisation INTERNE, lus en partage par toutes les entreprises
// (policy « formations lecture partagee »). Ajouter un cours au seed ne suffit
// donc pas : il faut l'insérer en base, dans les DEUX projets Supabase.
//
// Le fichier JS reste la source de vérité ; le .sql en est la copie à
// exécuter. Un test vérifie que les deux ne divergent jamais
// (src/utils/__tests__/formationsAcademieSql.test.js).
//
//   node scripts/formations-sql.mjs
import { writeFileSync } from 'node:fs';
import { FORMATIONS_ACADEMIE } from '../src/data/formationsAcademie.js';

const CIBLE = 'supabase/formations-academie.sql';
const BALISE = '$academie$';

// Un cours par ligne : le diff d'une régénération reste lisible.
const json = `[\n${FORMATIONS_ACADEMIE.map((c) => JSON.stringify(c)).join(',\n')}\n]`;
if (json.includes(BALISE)) throw new Error(`Le contenu des cours contient la balise ${BALISE}`);

const sql = `-- =====================================================================
--  Académie BestaSolar — dotation des trois formations
--  « Démarrer avec BestaSolar Pro », « Créer des devis qui signent »,
--  « Gagner de l'argent avec BestaSolar Pro ».
--
--  FICHIER GÉNÉRÉ — ne pas modifier ici. Source : src/data/formationsAcademie.js
--    node scripts/formations-sql.mjs
--
--  À exécuter dans le SQL Editor (Run), en entier, dans les DEUX projets
--  Supabase : la base de recette, puis la base réelle.
--
--  Rejouable sans risque :
--   - n'ajoute que les cours ABSENTS de l'organisation interne ;
--   - ne modifie jamais un cours déjà là (le gérant a pu le retoucher) ;
--   - ne ressuscite pas un cours que le gérant a supprimé (tombstone).
--  Rien n'est touché dans les autres entreprises : elles lisent les cours de
--  l'organisation interne en partage, sans copie.
-- =====================================================================

do $$
declare
  v_internes int;
  v_org      text;
  v_ajoutes  int;
begin
  if to_regclass('public.orgs') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'formations' and column_name = 'org_id') then
    raise exception 'Base en retard : multitenant.sql (le socle) n''est pas passé. Rien n''a été modifié.';
  end if;

  select count(*) into v_internes from public.orgs where kind = 'interne';
  if v_internes <> 1 then
    raise exception '% organisation(s) interne(s) au lieu d''une : voir organisation-interne.sql. Rien n''a été modifié.', v_internes;
  end if;
  select id into v_org from public.orgs where kind = 'interne';

  insert into public.formations (org_id, id, data)
  select v_org, c ->> 'id', c
    from jsonb_array_elements(${BALISE}${json}${BALISE}::jsonb) as c
   where not exists (
     select 1 from public.tombstones t
      where t.org_id = v_org and t.id = c ->> 'id' and t.collection = 'formations'
   )
  on conflict (org_id, id) do nothing;
  get diagnostics v_ajoutes = row_count;

  raise notice 'Académie BestaSolar : % cours ajouté(s) à l''organisation %.', v_ajoutes, v_org;
end $$;

-- CONTRÔLE — trois lignes attendues, « visible » à oui.
select f.id,
       f.data ->> 'title'                                         as titre,
       jsonb_array_length(f.data -> 'modules')                    as modules,
       case when coalesce(f.data ->> 'masque', 'false') = 'true'
            then 'non (masqué)' else 'oui' end                    as visible,
       f.updated_at
  from public.formations f
  join public.orgs o on o.id = f.org_id and o.kind = 'interne'
 where f.id in (${FORMATIONS_ACADEMIE.map((c) => `'${c.id}'`).join(', ')})
 order by f.id;
`;

writeFileSync(CIBLE, sql);
console.log(`${CIBLE} régénéré : ${FORMATIONS_ACADEMIE.length} cours, ${sql.length} caractères.`);
