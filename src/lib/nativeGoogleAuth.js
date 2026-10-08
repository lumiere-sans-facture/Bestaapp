import { Capacitor } from '@capacitor/core';
import { ErrorCode, GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { supabase } from './supabase';

export const isNativeGoogleAuth = () => Capacitor.isNativePlatform();

let initialisationGoogle;

const base64Url = (bytes) => btoa(String.fromCharCode(...bytes))
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '');

const hexadecimal = (bytes) => Array.from(bytes)
  .map((byte) => byte.toString(16).padStart(2, '0'))
  .join('');

/**
 * Supabase attend le nonce brut et vérifie que son SHA-256 correspond au
 * nonce contenu dans le jeton Google. Garder les deux valeurs évite les
 * erreurs « Nonces mismatch » tout en empêchant la réutilisation du jeton.
 */
export const creerNonceGoogle = async () => {
  const aleatoire = crypto.getRandomValues(new Uint8Array(32));
  const nonce = base64Url(aleatoire);
  const empreinte = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce));
  // GoTrue compare au nonce Google l'empreinte SHA-256 en hexadécimal.
  // Une base64url est valide pour un JWT mais ne correspond pas à ce format.
  return { nonce, nonceGoogle: hexadecimal(new Uint8Array(empreinte)) };
};

const initialiserGoogle = () => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    return Promise.reject(new Error('Connexion Google non configurée.'));
  }
  if (!initialisationGoogle) {
    // Sur Android, Google exige ici l'ID du client Web. Le client Android
    // séparé sert uniquement à autoriser le package et la signature de l'APK.
    initialisationGoogle = GoogleSignIn.initialize({ clientId }).catch((error) => {
      initialisationGoogle = null;
      throw error;
    });
  }
  return initialisationGoogle;
};

const messageErreurGoogle = (error) => {
  if (error?.code === ErrorCode.SignInCanceled) return 'Connexion Google annulée.';
  if (error?.code === ErrorCode.NoCredentialAvailable) return 'Aucun compte Google disponible sur cet appareil.';
  if (error?.code === ErrorCode.ProviderConfigurationError) {
    return 'Google Play Services est indisponible ou doit être mis à jour.';
  }
  return error?.message || 'Connexion avec Google impossible.';
};

/**
 * Ouvre le sélecteur de compte natif Android. Le jeton Google est ensuite
 * échangé directement contre une session Supabase : aucun navigateur et
 * aucune adresse *.supabase.co ne sont affichés à l'utilisateur.
 */
export const signInWithGoogleNative = async () => {
  try {
    await initialiserGoogle();
    const { nonce, nonceGoogle } = await creerNonceGoogle();
    const resultatGoogle = await GoogleSignIn.signIn({ nonce: nonceGoogle });
    if (!resultatGoogle?.idToken) throw new Error('Google n’a pas renvoyé de jeton de connexion.');

    return supabase.auth.signInWithIdToken({
      provider: 'google',
      token: resultatGoogle.idToken,
      nonce,
    });
  } catch (error) {
    return { data: null, error: new Error(messageErreurGoogle(error)) };
  }
};

/** Efface le compte retenu par Android sans faire échouer la déconnexion. */
export const signOutGoogleNative = async () => {
  if (!isNativeGoogleAuth()) return;
  try {
    await initialiserGoogle();
    await GoogleSignIn.signOut();
  } catch {
    // Supabase reste la source de vérité de la session : sa déconnexion ne
    // doit jamais être bloquée par Google Play Services.
  }
};
