import { describe, it, expect } from 'vitest';
import { estRefusRls, MESSAGE_REFUS_RLS, messageLignesRefusees } from '../erreurSync';

describe('estRefusRls', () => {
  it('reconnaît le refus de la sécurité au niveau ligne', () => {
    expect(estRefusRls('new row violates row-level security policy for table "leads"')).toBe(true);
  });

  it('tolère les variantes de casse et d’orthographe de PostgreSQL', () => {
    expect(estRefusRls('violates row level security policy')).toBe(true);
    expect(estRefusRls('NEW ROW VIOLATES ROW-LEVEL SECURITY')).toBe(true);
  });

  it('reconnaît le code SQLSTATE, quelle que soit la formulation', () => {
    expect(estRefusRls({ code: '42501', message: 'insufficient privilege' })).toBe(true);
  });

  it('accepte aussi bien une erreur qu’un message', () => {
    expect(estRefusRls(new Error('new row violates row-level security policy'))).toBe(true);
  });

  it('laisse passer les autres erreurs', () => {
    expect(estRefusRls('Failed to fetch')).toBe(false);
    expect(estRefusRls('relation "public.kits" does not exist')).toBe(false);
    expect(estRefusRls('')).toBe(false);
    expect(estRefusRls(undefined)).toBe(false);
    expect(estRefusRls({ code: '42P01', message: 'relation does not exist' })).toBe(false);
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

describe('messageLignesRefusees', () => {
  it('ne dit rien quand rien n’est refusé', () => {
    expect(messageLignesRefusees({})).toBeNull();
    expect(messageLignesRefusees({ leads: 0 })).toBeNull();
    expect(messageLignesRefusees()).toBeNull();
  });

  it('parle métier, pas base de données', () => {
    const m = messageLignesRefusees({ leads: 3 });
    expect(m).toMatch(/^3 clients /);
    expect(m).not.toMatch(/leads/);
  });

  it('accorde le singulier', () => {
    expect(messageLignesRefusees({ leads: 1 })).toMatch(/^1 client /);
  });

  it('n’envoie pas le gérant chercher un fichier : il lit ça sur son '
    + 'téléphone', () => {
    const m = messageLignesRefusees({ leads: 32 });
    expect(m).not.toMatch(/\.sql/);
    expect(m).not.toMatch(/supabase\//);
    expect(m).toMatch(/Plus › Diagnostic/);
  });

  it('n’affirme pas ce que l’app ne peut pas vérifier : ces clients étant '
    + 'illisibles pour ce compte, on ignore s’ils sont déjà sur le serveur', () => {
    const m = messageLignesRefusees({ leads: 32 });
    expect(m).not.toMatch(/rien n.est perdu/i);
    expect(m).not.toMatch(/déjà (sur le|au) serveur/i);
    expect(m).toMatch(/restent consultables ici/);
  });

  it('cumule les collections', () => {
    expect(messageLignesRefusees({ leads: 2, partners: 1 })).toMatch(/2 clients, 1 partenaire/);
  });
});
