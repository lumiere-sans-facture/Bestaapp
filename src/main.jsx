// Compte supprimé à la session précédente : ses données locales partent
// AVANT que quoi que ce soit ne les relise — d'où ce premier import.
import './purgeDemarrage'
// Lien /telecharger servi par l'app (développement) : aiguillé avant qu'elle
// ne retire le code partenaire de l'adresse.
import './aiguillageTelechargement'
// Application Android, premier lancement : code partenaire repris du
// téléchargement. Constat « installation neuve » fait avant que l'app
// n'écrive quoi que ce soit dans le stockage.
import { attendreParrainageInstallation } from './lib/parrainageInstallation'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Le premier écran dépend du code éventuellement repris (inscription, code
// prérempli) : on l'attend — une fraction de seconde, au premier lancement
// de l'APK seulement ; ailleurs, la promesse est déjà résolue.
attendreParrainageInstallation().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})

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
