import { useEffect, useRef } from 'react';

const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';
let googleIdentityPromise = null;

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

const createNonce = () => {
  if (!window.crypto?.getRandomValues) return null;
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
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

  useEffect(() => { onCredentialRef.current = onCredential; }, [onCredential]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    let cancelled = false;
    const nonce = createNonce();
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
            Promise.resolve(onCredentialRef.current?.({ credential: response.credential, nonce }))
              .catch(() => onErrorRef.current?.('Connexion avec Google impossible.'));
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          context: 'signin',
          ...(nonce ? { nonce } : {}),
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
  }, [clientId]);

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
