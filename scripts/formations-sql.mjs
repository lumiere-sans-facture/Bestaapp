// Génère supabase/formations-academie.sql depuis src/data/formationsAcademie.js.
//
// En mode SaaS, les cours ne viennent pas du seed de l'application : ils sont
// l'actif de l'organisation INTERNE, lus en partage par toutes les entreprises
// (policy « formations lecture partagee »). Ajouter un cours au seed ne suffit
// donc pas : il faut l'insérer en base, dans les DEUX projets Supabase.
//
// Un bloc indépendant par formation : chacun se colle et s'exécute seul dans
// le SQL Editor (pratique depuis un téléphone), ou tous ensemble. Une leçon
// par ligne, pour qu'un script relu ou recopié reste lisible.
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

/** JSON d'un cours, une leçon par ligne (le contenu est celui de JSON.stringify). */
const jsonCours = (cours) => {
  const { modules, ...tete } = cours;
  const blocs = modules.map(({ lecons, ...module }) =>
    `${JSON.stringify(module).slice(0, -1)},"lecons":[\n${lecons.map((l) => JSON.stringify(l)).join(',\n')}\n]}`);
  return `${JSON.stringify(tete).slice(0, -1)},"modules":[\n${blocs.join(',\n')}\n]}`;
};

const bloc = (cours, n) => {
  const json = jsonCours(cours);
  if (json.includes(BALISE)) throw new Error(`Le cours ${cours.id} contient la balise ${BALISE}`);
  return `-- ---------------------------------------------------------------------
--  ${n}/${FORMATIONS_ACADEMIE.length} · ${cours.title.replace(/’/g, "'")}
-- ---------------------------------------------------------------------
do $$
declare
  v_org text;
  v_n   int;
begin
  if to_regclass('public.orgs') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'formations' and column_name = 'org_id') then
    raise exception 'Base en retard : multitenant.sql (le socle) n''est pas passé. Rien n''a été modifié.';
  end if;
  if (select count(*) from public.orgs where kind = 'interne') <> 1 then
    raise exception 'Il faut exactement UNE organisation interne : voir organisation-interne.sql. Rien n''a été modifié.';
  end if;
  select id into v_org from public.orgs where kind = 'interne';

  insert into public.formations (org_id, id, data)
  select v_org, c ->> 'id', c
    from (select ${BALISE}${json}${BALISE}::jsonb as c) as cours
   where not exists (
     select 1 from public.tombstones t
      where t.org_id = v_org and t.id = c ->> 'id' and t.collection = 'formations'
   )
  on conflict (org_id, id) do nothing;
  get diagnostics v_n = row_count;
  raise notice '${cours.id} : % ajouté (0 = déjà présent ou supprimé par le gérant).', v_n;
end $$;
`;
};

const sql = `-- =====================================================================
--  Académie BestaSolar — dotation des trois formations
--
--  FICHIER GÉNÉRÉ — ne pas modifier ici. Source : src/data/formationsAcademie.js
--    node scripts/formations-sql.mjs
--
--  À exécuter dans le SQL Editor (Run) des DEUX projets Supabase : la base
--  de recette, puis la base réelle. Tout d'un coup, ou bloc par bloc : chaque
--  formation est un bloc indépendant.
--
--  Rejouable sans risque :
--   - n'ajoute que les cours ABSENTS de l'organisation interne ;
--   - ne modifie jamais un cours déjà là (le gérant a pu le retoucher) ;
--   - ne ressuscite pas un cours que le gérant a supprimé (tombstone).
--  Rien n'est touché dans les autres entreprises : elles lisent les cours de
--  l'organisation interne en partage, sans copie.
-- =====================================================================

${FORMATIONS_ACADEMIE.map((c, i) => bloc(c, i + 1)).join('\n')}
-- ---------------------------------------------------------------------
--  CONTRÔLE — trois lignes attendues, « visible » à oui.
-- ---------------------------------------------------------------------
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
