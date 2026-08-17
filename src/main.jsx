import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

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
