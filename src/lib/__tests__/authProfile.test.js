import { describe, expect, it, vi } from 'vitest';
import { fetchAuthProfile } from '../authProfile';

const clientAvec = ({ parId = { data: null, error: null }, parEmail = { data: null, error: null } } = {}) => {
  const appels = [];
  const client = {
    from: vi.fn((table) => {
      expect(table).toBe('profiles');
      return {
        select: () => ({
          eq: (column, value) => {
            appels.push({ column, value });
            return { maybeSingle: async () => parId };
          },
          ilike: (column, value) => {
            appels.push({ column, value });
            return { maybeSingle: async () => parEmail };
          },
        }),
      };
    }),
  };
  return { client, appels };
};

const authUser = { id: 'auth-123', email: 'Client@BestaSolar.com' };

describe('rattachement du compte Auth au profil web/mobile', () => {
  it('retrouve d’abord le profil par uid, sans dépendre de la casse de l’email', async () => {
    const profil = { id: authUser.id, email: 'CLIENT@BESTASOLAR.COM', org_id: 'org-1' };
    const { client, appels } = clientAvec({ parId: { data: profil, error: null } });
    expect(await fetchAuthProfile(client, authUser)).toEqual({ profile: profil, injoignable: false });
    expect(appels).toEqual([{ column: 'id', value: authUser.id }]);
  });

  it('retrouve un ancien profil par email sans distinction de casse', async () => {
    const profil = { id: 'u1', email: 'CLIENT@BESTASOLAR.COM', org_id: 'org-1' };
    const { client, appels } = clientAvec({ parEmail: { data: profil, error: null } });
    expect(await fetchAuthProfile(client, authUser)).toEqual({ profile: profil, injoignable: false });
    expect(appels[1]).toEqual({ column: 'email', value: authUser.email });
  });

  it('échappe les jokers SQL présents dans une adresse email', async () => {
    const { client, appels } = clientAvec();
    await fetchAuthProfile(client, { ...authUser, email: 'nom_1%2@exemple.com' });
    expect(appels[1].value).toBe('nom\\_1\\%2@exemple.com');
  });

  it('ne déclare un profil absent que lorsque les deux recherches répondent sans erreur', async () => {
    const { client } = clientAvec();
    expect(await fetchAuthProfile(client, authUser)).toEqual({ profile: null, injoignable: false });
  });

  it('ne transforme pas un refus RLS ou une panne réseau en inscription incomplète', async () => {
    const { client } = clientAvec({ parEmail: { data: null, error: { code: '42501' } } });
    expect(await fetchAuthProfile(client, authUser)).toEqual({ profile: null, injoignable: true });
  });

  it('garde un profil retrouvé par email même si la recherche par uid a échoué', async () => {
    const profil = { id: 'u1', email: authUser.email };
    const { client } = clientAvec({
      parId: { data: null, error: { code: 'PGRST000' } },
      parEmail: { data: profil, error: null },
    });
    expect(await fetchAuthProfile(client, authUser)).toEqual({ profile: profil, injoignable: false });
  });
});
