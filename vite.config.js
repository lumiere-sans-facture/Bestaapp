import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// Envoi des source maps à Sentry. SANS ELLES, une pile d'appel reste
// minifiée — « a.b is not a function at index-a3f9.js:1:4821 » — et Sentry
// perd l'essentiel de son intérêt.
//
// Actif uniquement si SENTRY_AUTH_TOKEN est présent (variable Vercel, jamais
// dans le dépôt) : un build sans le jeton passe exactement comme avant.
const sentry = process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
  ? [sentryVitePlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      release: { name: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'dev' },
      // Les source maps sont téléversées puis SUPPRIMÉES du bundle livré :
      // les laisser publierait le code source de l'app à qui la visite.
      sourcemaps: { filesToDeleteAfterUpload: ['dist/assets/*.map'] },
      telemetry: false,
    })]
  : [];

export default defineConfig({
  // La génération des source maps n'a de sens que si on les téléverse.
  build: { sourcemap: sentry.length > 0 },
  plugins: [react(), ...sentry],
  // Numéro de version affiché sur l'écran de connexion : le commit court sur
  // Vercel, « dev » en local. Permet de vérifier d'un coup d'œil qu'un
  // appareil n'exécute pas une vieille version en cache.
  define: {
    // Drapeaux de compilation Sentry : retirent le code de débogage et de
    // mesure de performance, dont nous n'utilisons rien.
    __SENTRY_DEBUG__: false,
    __SENTRY_TRACING__: false,
    __APP_VERSION__: JSON.stringify(
      (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'dev'
    ),
    // Environnement affiché à côté de la version : « production » seulement
    // pour un build de la branche main, « test » partout ailleurs (projet
    // Vercel de test, previews, développement local). Lève toute ambiguïté
    // quand les deux versions cohabitent.
    __APP_ENV__: JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_REF === 'main' ? 'production' : 'test'
    ),
  },
  // Expose aussi les variables NEXT_PUBLIC_* (créées par l'intégration
  // Vercel ↔ Supabase) en plus de nos VITE_*. Les clés secrètes
  // (service_role, secret, postgres…) n'ont pas ce préfixe et restent privées.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  server: {
    host: true,
    port: 3000
  }
})
