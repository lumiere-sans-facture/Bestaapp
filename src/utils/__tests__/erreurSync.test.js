import { describe, it, expect } from 'vitest';
import { estRefusRls, MESSAGE_REFUS_RLS } from '../erreurSync';

describe('estRefusRls', () => {
  it('reconnaît le refus de la sécurité au niveau ligne', () => {
    expect(estRefusRls('new row violates row-level security policy for table "leads"')).toBe(true);
  });

  it('tolère les variantes de casse et d’orthographe de PostgreSQL', () => {
    expect(estRefusRls('violates row level security policy')).toBe(true);
    expect(estRefusRls('NEW ROW VIOLATES ROW-LEVEL SECURITY')).toBe(true);
  });

  it('laisse passer les autres erreurs', () => {
    expect(estRefusRls('Failed to fetch')).toBe(false);
    expect(estRefusRls('relation "public.kits" does not exist')).toBe(false);
    expect(estRefusRls('')).toBe(false);
    expect(estRefusRls(undefined)).toBe(false);
  });

  it('nomme la vraie cause, pas le message brut de la base', () => {
    expect(MESSAGE_REFUS_RLS).toMatch(/autre membre/i);
    expect(MESSAGE_REFUS_RLS).toMatch(/rien n’est perdu/i);
    expect(MESSAGE_REFUS_RLS).not.toMatch(/row-level/i);
  });

  it('n’envoie plus l’utilisateur se reconnecter : le réalignement de '
    + 'l’organisation a DÉJÀ eu lieu quand ce message s’affiche', () => {
    expect(MESSAGE_REFUS_RLS).not.toMatch(/reconnect/i);
  });
});
