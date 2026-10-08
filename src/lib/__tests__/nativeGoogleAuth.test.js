import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
}));

vi.mock('@capawesome/capacitor-google-sign-in', () => ({
  ErrorCode: {
    SignInCanceled: 'SIGN_IN_CANCELED',
    NoCredentialAvailable: 'NO_CREDENTIAL_AVAILABLE',
    ProviderConfigurationError: 'PROVIDER_CONFIGURATION_ERROR',
  },
  GoogleSignIn: {
    initialize: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock('../supabase', () => ({
  supabase: { auth: { signInWithIdToken: vi.fn() } },
}));

import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { supabase } from '../supabase';
import { creerNonceGoogle, signInWithGoogleNative } from '../nativeGoogleAuth';

const hexadecimal = (bytes) => Array.from(bytes)
  .map((byte) => byte.toString(16).padStart(2, '0'))
  .join('');

describe('creerNonceGoogle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-web.apps.googleusercontent.com');
    GoogleSignIn.initialize.mockResolvedValue();
  });

  it('produit un nonce brut et son SHA-256 au format hexadécimal attendu par Supabase', async () => {
    const { nonce, nonceGoogle } = await creerNonceGoogle();
    const empreinte = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce));

    expect(nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(nonceGoogle).toMatch(/^[a-f0-9]{64}$/);
    expect(nonceGoogle).toBe(hexadecimal(new Uint8Array(empreinte)));
  });

  it('échange le jeton natif contre une session Supabase avec le nonce brut', async () => {
    GoogleSignIn.signIn.mockResolvedValue({ idToken: 'jeton-google' });
    supabase.auth.signInWithIdToken.mockResolvedValue({ data: { session: {} }, error: null });

    const resultat = await signInWithGoogleNative();

    expect(GoogleSignIn.initialize).toHaveBeenCalledWith({
      clientId: 'client-web.apps.googleusercontent.com',
    });
    const { nonce: nonceGoogle } = GoogleSignIn.signIn.mock.calls[0][0];
    const demandeSupabase = supabase.auth.signInWithIdToken.mock.calls[0][0];
    const empreinte = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(demandeSupabase.nonce),
    );
    expect(nonceGoogle).toBe(hexadecimal(new Uint8Array(empreinte)));
    expect(demandeSupabase).toMatchObject({ provider: 'google', token: 'jeton-google' });
    expect(resultat.error).toBeNull();
  });
});
