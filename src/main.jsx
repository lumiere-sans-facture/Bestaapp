// Compte supprimé à la session précédente : ses données locales partent
// AVANT que quoi que ce soit ne les relise — d'où ce premier import.
import './purgeDemarrage'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { CHEMIN_TELECHARGEMENT, URL_APK } from './config/android'
import './index.css'

// Lien de téléchargement de l'APK sur notre domaine. En production, Vercel
// le redirige avant même de servir l'app (vercel.json) ; ici, le renvoi de
// secours, pour un serveur qui servirait l'app à sa place.
if (location.pathname === CHEMIN_TELECHARGEMENT) location.replace(URL_APK)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Cache applicatif : permet d'OUVRIR l'app sans réseau (voir public/sw.js).
// Uniquement en production servie par HTTP(S) : en développement il masquerait
// le rechargement à chaud, et dans l'APK Capacitor les fichiers sont déjà locaux.
if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* cache indisponible : l'app fonctionne, simplement sans mode hors-ligne */
    });
  });
}
