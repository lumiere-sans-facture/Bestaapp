import { useEffect, useRef } from 'react';
import { isNativeGoogleAuth } from '../lib/nativeGoogleAuth';

const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';
let googleIdentityPromise = null;

const GoogleLogo = () => (
  <svg
    className="google-native-logo"
    viewBox="0 0 18 18"
    aria-hidden="true"
    focusable="false"
  >
    <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.909c1.702-1.567 2.683-3.874 2.683-6.615Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.957-2.18l-2.909-2.259c-.806.54-1.835.859-3.048.859-2.344 0-4.328-1.584-5.037-3.71H.956v2.332A9 9 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.963 10.71A5.41 5.41 0 0 1 3.681 9c0-.593.102-1.17.282-1.71V4.958H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.042l3.007-2.332Z" />
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.582-2.582C13.463.892 11.426 0 9 0A9 9 0 0 0 .956 4.958L3.963 7.29C4.672 5.164 6.656 3.58 9 3.58Z" />
  </svg>
);

// Charge le SDK officiel au premier affichage seulement. Le Client ID est
// public par nature : il identifie l'application auprès de Google, mais ne
// permet pas de se connecter ou d'administrer le projet Google Cloud.
const loadGoogleIdentity = () => {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (googleIdentityPromise) return googleIdentityPromise;

  googleIdentityPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GOOGLE_IDENTITY_SCRIPT;
    script.async = true;
    script.onload = () => {
      if (window.google?.accounts?.id) resolve(window.google);
      else reject(new Error('Le service de connexion Google est indisponible.'));
    };
    script.onerror = () => {
      googleIdentityPromise = null;
      reject(new Error('Impossible de charger le service de connexion Google.'));
    };
    document.head.appendChild(script);
  });

  return googleIdentityPromise;
};

/**
 * Bouton officiel Google Identity Services. Google affiche alors le nom et
 * l'origine de Besta, avant que le jeton ne soit remis à Supabase pour créer
 * la session. Il n'y a donc pas de redirection visible vers *.supabase.co.
 */
export default function GoogleSignInButton({ clientId, disabled = false, onCredential, onError }) {
  const containerRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);
  const native = isNativeGoogleAuth();

  useEffect(() => { onCredentialRef.current = onCredential; }, [onCredential]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    if (native) return undefined;
    let cancelled = false;
    const container = containerRef.current;

    loadGoogleIdentity()
      .then((google) => {
        if (cancelled || !container) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (!response.credential) {
              onErrorRef.current?.('Google n’a pas renvoyé de jeton de connexion.');
              return;
            }
            Promise.resolve(onCredentialRef.current?.({ credential: response.credential }))
              .catch(() => onErrorRef.current?.('Connexion avec Google impossible.'));
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          context: 'signin',
        });

        // Le bouton fourni par Google est préférable à une imitation : il est
        // conforme à leurs règles et ouvre directement le sélecteur de compte.
        const width = Math.max(220, Math.floor(container.getBoundingClientRect().width || 320));
        google.accounts.id.renderButton(container, {
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: 'continue_with',
          logo_alignment: 'left',
          locale: 'fr',
          width,
        });
      })
      .catch((error) => {
        if (!cancelled) onErrorRef.current?.(error.message || 'Connexion avec Google impossible.');
      });

    return () => {
      cancelled = true;
      container?.replaceChildren();
    };
  }, [clientId, native]);

  if (native) {
    return (
      <button
        type="button"
        className="google-native-button"
        disabled={disabled}
        onClick={() => Promise.resolve(onCredential?.({ credential: null }))
          .catch(() => onError?.('Connexion avec Google impossible.'))}
      >
        <GoogleLogo />
        Continuer avec Google
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      className="google-signin-button"
      aria-busy={disabled}
      aria-disabled={disabled}
      style={disabled ? { opacity: 0.65, pointerEvents: 'none' } : undefined}
    />
  );
}
