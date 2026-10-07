import { describe, expect, it } from 'vitest';
import { NATIVE_OAUTH_CALLBACK, parseNativeOAuthCallback } from '../nativeOAuth';

describe('retour OAuth natif', () => {
  it('lit les jetons du flux implicite Supabase', () => {
    expect(parseNativeOAuthCallback(
      `${NATIVE_OAUTH_CALLBACK}#access_token=acces&refresh_token=rafraichissement&expires_in=3600`
    )).toEqual({ accessToken: 'acces', refreshToken: 'rafraichissement' });
  });

  it('accepte le code du flux PKCE', () => {
    expect(parseNativeOAuthCallback(`${NATIVE_OAUTH_CALLBACK}?code=abc123`))
      .toEqual({ code: 'abc123' });
  });

  it('remonte une erreur Google lisible', () => {
    expect(parseNativeOAuthCallback(
      `${NATIVE_OAUTH_CALLBACK}#error=access_denied&error_description=Acc%C3%A8s%20refus%C3%A9`
    )).toEqual({ error: 'Accès refusé' });
  });

  it('ignore un lien qui ne concerne pas la connexion', () => {
    expect(parseNativeOAuthCallback('https://app.bestasolar.com/connexion')).toBeNull();
  });
});
