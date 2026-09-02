import { describe, expect, it } from 'vitest';
import { estRefusRls, MESSAGE_REFUS_RLS } from '../erreurSync';

describe('estRefusRls', () => {
  it('reconnaît le refus RLS de PostgreSQL', () => {
    expect(estRefusRls('new row violates row-level security policy for table "leads"')).toBe(true);
  });

  it('reconnaît les variantes d’écriture du message', () => {
    expect(estRefusRls('violates row level security policy')).toBe(true);
    expect(estRefusRls('NEW ROW VIOLATES ROW-LEVEL SECURITY')).toBe(true);
  });

  it('ne confond pas avec une panne réseau ou une table absente', () => {
    // Ces deux-là ont leurs propres reprises : les traiter comme un refus RLS
    // relancerait une relecture d'organisation pour rien.
    expect(estRefusRls('Failed to fetch')).toBe(false);
    expect(estRefusRls('relation "public.kits" does not exist')).toBe(false);
    expect(estRefusRls('')).toBe(false);
    expect(estRefusRls(undefined)).toBe(false);
  });

  it('propose une conduite à tenir, pas le message brut de la base', () => {
    expect(MESSAGE_REFUS_RLS).toMatch(/reconnectez-vous/i);
    expect(MESSAGE_REFUS_RLS).not.toMatch(/row-level/i);
  });
});
