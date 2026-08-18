// Protection CAPTCHA de Supabase Auth (dashboard : Authentication → Attack
// Protection → CAPTCHA protection). hCaptcha et Cloudflare Turnstile sont
// pris en charge nativement par supabase-js via l'option `captchaToken`.
//
// Auto-détecté comme isSupabaseConfigured (lib/supabase.js) : aucune clé
// définie → aucun script chargé, zéro octet, comportement identique à avant
// (voir CaptchaWidget.jsx). Les DEUX côtés doivent être activés ensemble —
// une clé ici sans la protection activée côté dashboard ne sert à rien, et
// l'inverse fait échouer connexion/inscription avec « captcha verification
// process failed ». Détail dans supabase/DEPLOIEMENT.md § 3.
const hcaptchaKey = import.meta.env.VITE_HCAPTCHA_SITE_KEY || '';
const turnstileKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

export const captchaProvider = hcaptchaKey ? 'hcaptcha' : turnstileKey ? 'turnstile' : null;
export const captchaSiteKey = hcaptchaKey || turnstileKey || '';
export const isCaptchaConfigured = Boolean(captchaProvider);

export const CAPTCHA_SCRIPT_SRC = {
  hcaptcha: 'https://js.hcaptcha.com/1/api.js?render=explicit',
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/api.js',
};
