// La copie embarquée du script de réparation ne doit jamais diverger de celle
// qu'on exécute réellement : un gérant qui colle une version périmée croit
// avoir réparé.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SQL_REPARATION_CLIENTS, EMAIL_MODELE, sqlReparationPour } from '../../data/sqlReparationClients';

const fichier = readFileSync(new URL('../../../supabase/reparer-clients-publics.sql', import.meta.url), 'utf8');

describe('SQL de réparation embarqué', () => {
  it('est identique au fichier exécuté dans Supabase', () => {
    expect(SQL_REPARATION_CLIENTS).toBe(fichier);
  });

  it('contient bien la règle qui débloque le gérant', () => {
    expect(SQL_REPARATION_CLIENTS).toMatch(/create policy "manager client access" on public\.leads/);
    expect(SQL_REPARATION_CLIENTS).toContain(EMAIL_MODELE);
  });
});

describe('sqlReparationPour', () => {
  it('remplit l’adresse de la session : rien à éditer avant de coller', () => {
    const sql = sqlReparationPour('Boss@BestaSolar.TG');
    expect(sql).toContain("lower('boss@bestasolar.tg')");
    expect(sql).not.toContain(EMAIL_MODELE);
  });

  it('ne laisse pas une apostrophe casser le script', () => {
    expect(sqlReparationPour("o'brien@exemple.com")).toContain("lower('obrien@exemple.com')");
  });

  it('garde le modèle quand la session n’a pas d’adresse', () => {
    expect(sqlReparationPour(null)).toContain(EMAIL_MODELE);
    expect(sqlReparationPour('  ')).toContain(EMAIL_MODELE);
  });
});
