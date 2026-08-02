import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Numéro de version affiché sur l'écran de connexion : le commit court sur
  // Vercel, « dev » en local. Permet de vérifier d'un coup d'œil qu'un
  // appareil n'exécute pas une vieille version en cache.
  define: {
    __APP_VERSION__: JSON.stringify(
      (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || 'dev'
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
