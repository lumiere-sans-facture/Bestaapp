// Le script de dotation Supabase (supabase/formations-academie.sql) est GÉNÉRÉ
// depuis src/data/formationsAcademie.js. Ce test garantit que les deux ne
// divergent jamais : un cours corrigé dans l'application mais pas dans le
// script, ce serait une version en local et une autre en production.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FORMATIONS_ACADEMIE } from '../../data/formationsAcademie';

const SQL = readFileSync(new URL('../../../supabase/formations-academie.sql', import.meta.url), 'utf8');
const coursDuScript = () => {
  const m = /\$academie\$([\s\S]*?)\$academie\$::jsonb/.exec(SQL);
  return m ? JSON.parse(m[1]) : null;
};

describe('supabase/formations-academie.sql', () => {
  it('embarque exactement les cours de l’application (sinon : node scripts/formations-sql.mjs)', () => {
    expect(coursDuScript()).toEqual(JSON.parse(JSON.stringify(FORMATIONS_ACADEMIE)));
  });

  it('est rejouable : il n’écrase rien et ne ressuscite rien', () => {
    expect(SQL).toMatch(/on conflict \(org_id, id\) do nothing/);
    expect(SQL).toMatch(/not exists \(\s*select 1 from public\.tombstones/);
    expect(SQL).not.toMatch(/\bdelete\s+from\b|\bdrop\s+(table|policy)\b|\bupdate\s+public\./i);
  });

  it('n’écrit que dans l’organisation interne, et s’arrête si elle est ambiguë', () => {
    expect(SQL).toMatch(/where kind = 'interne'/);
    expect(SQL).toMatch(/if v_internes <> 1 then\s+raise exception/);
  });
});
