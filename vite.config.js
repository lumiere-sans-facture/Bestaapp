import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Expose aussi les variables NEXT_PUBLIC_* (créées par l'intégration
  // Vercel ↔ Supabase) en plus de nos VITE_*. Les clés secrètes
  // (service_role, secret, postgres…) n'ont pas ce préfixe et restent privées.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  server: {
    host: true,
    port: 3000
  }
})
