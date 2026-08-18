import { useEffect, useRef } from 'react';
import { captchaProvider, captchaSiteKey, CAPTCHA_SCRIPT_SRC } from '../lib/captcha';

const API_GLOBAL = { hcaptcha: 'hcaptcha', turnstile: 'turnstile' };

const loadScript = (src) => new Promise((resolve, reject) => {
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) {
    if (existing.dataset.loaded === 'true') { resolve(); return; }
    existing.addEventListener('load', () => resolve(), { once: true });
    existing.addEventListener('error', () => reject(new Error('captcha')), { once: true });
    return;
  }
  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  script.defer = true;
  script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
  script.onerror = () => reject(new Error('captcha'));
  document.head.appendChild(script);
});

/**
 * Défi hCaptcha ou Turnstile (selon lib/captcha.js) — vide et sans effet si
 * aucune clé n'est configurée. Pour rejouer un défi (jeton à usage unique
 * côté Supabase, après chaque tentative), le parent change la prop `key` du
 * composant plutôt que d'appeler une méthode : le remontage suffit.
 */
export default function CaptchaWidget({ onVerify, onExpire }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  // Lues depuis l'effet de montage (deps volontairement vides) : évite de
  // réinitialiser le défi à chaque rendu du formulaire parent.
  const callbacksRef = useRef({ onVerify, onExpire });
  callbacksRef.current = { onVerify, onExpire };

  useEffect(() => {
    if (!captchaProvider) return undefined;
    let arrete = false;
    const apiName = API_GLOBAL[captchaProvider];
    loadScript(CAPTCHA_SCRIPT_SRC[captchaProvider]).then(() => {
      if (arrete || !containerRef.current) return;
      const api = window[apiName];
      if (!api) return;
      widgetIdRef.current = api.render(containerRef.current, {
        sitekey: captchaSiteKey,
        callback: (token) => callbacksRef.current.onVerify?.(token),
        'expired-callback': () => callbacksRef.current.onExpire?.(),
        'error-callback': () => callbacksRef.current.onExpire?.(),
      });
    }).catch(() => { /* réseau indisponible : le formulaire reste bloqué sans jeton, pas cassé */ });
    return () => {
      arrete = true;
      const api = window[apiName];
      if (api && widgetIdRef.current != null) {
        try { api.remove(widgetIdRef.current); } catch { /* déjà nettoyé */ }
      }
    };
  }, []);

  if (!captchaProvider) return null;
  return <div ref={containerRef} className="captcha-widget" />;
}
