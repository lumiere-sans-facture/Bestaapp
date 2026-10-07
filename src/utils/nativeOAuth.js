export const NATIVE_OAUTH_CALLBACK = 'com.bestasolar.app://login-callback';

/**
 * Lit le retour Supabase reçu par le deep link Android. Le flux PKCE renvoie
 * un code dans la query ; le fragment est gardé comme repli compatible avec
 * les anciennes sessions Supabase.
 */
export const parseNativeOAuthCallback = (url) => {
  if (!url?.startsWith(NATIVE_OAUTH_CALLBACK)) return null;

  const parsed = new URL(url);
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const error = parsed.searchParams.get('error_description')
    || fragment.get('error_description')
    || parsed.searchParams.get('error')
    || fragment.get('error');

  if (error) return { error };

  const code = parsed.searchParams.get('code');
  if (code) return { code };

  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  if (accessToken && refreshToken) return { accessToken, refreshToken };

  return { error: 'Google n’a pas renvoyé de session utilisable.' };
};
