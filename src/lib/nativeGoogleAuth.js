import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from './supabase';
import { NATIVE_OAUTH_CALLBACK, parseNativeOAuthCallback } from '../utils/nativeOAuth';

export const isNativeGoogleAuth = () => Capacitor.isNativePlatform();

const fermerNavigateur = () => Browser.close().catch(() => {});

const etablirSessionDepuisUrl = async (url) => {
  const retour = parseNativeOAuthCallback(url);
  if (!retour) return null;
  if (retour.error) return { data: null, error: new Error(retour.error) };

  return retour.code
    ? supabase.auth.exchangeCodeForSession(retour.code)
    : supabase.auth.setSession({
        access_token: retour.accessToken,
        refresh_token: retour.refreshToken,
      });
};

/** Récupère aussi un callback ayant relancé l'app après arrêt par Android. */
export const reprendreGoogleNatifAuDemarrage = async () => {
  if (!isNativeGoogleAuth()) return null;
  const lancement = await App.getLaunchUrl();
  if (!lancement?.url) return null;
  const result = await etablirSessionDepuisUrl(lancement.url);
  if (result) await fermerNavigateur();
  return result;
};

/**
 * Google Identity Services refuse officiellement les WebView Android. Dans
 * l'APK, l'autorisation passe donc par Chrome Custom Tabs puis revient dans
 * BestaSolar par un deep link. Le site web conserve le bouton GIS habituel.
 */
export const signInWithGoogleNative = async () => {
  const { data: oauth, error: startError } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: NATIVE_OAUTH_CALLBACK,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });

  if (startError || !oauth?.url) {
    return { data: null, error: startError || new Error('Adresse de connexion Google absente.') };
  }

  let listener;
  let timer;
  let termine = false;
  let resolveCallback;
  const callback = new Promise((resolve) => {
    resolveCallback = resolve;
  });

  const finir = async (result) => {
    if (termine) return;
    termine = true;
    clearTimeout(timer);
    await listener?.remove();
    await fermerNavigateur();
    resolveCallback(result);
  };

  listener = await App.addListener('appUrlOpen', async ({ url }) => {
    try {
      const result = await etablirSessionDepuisUrl(url);
      if (result) await finir(result);
    } catch (error) {
      await finir({ data: null, error });
    }
  });

  timer = setTimeout(() => {
    finir({ data: null, error: new Error('Connexion Google expirée. Réessayez.') });
  }, 5 * 60 * 1000);

  try {
    await Browser.open({ url: oauth.url, presentationStyle: 'popover' });
  } catch (error) {
    await finir({ data: null, error });
  }

  return callback;
};
