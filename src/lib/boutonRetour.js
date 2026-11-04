// Bouton « retour » de l'application Android (Capacitor). Sur le web : rien,
// le navigateur garde son propre bouton.
//
// Sans écouteur, Android fermait l'application à la première pression, sur
// n'importe quel écran. Ce qu'il faut faire est décidé par
// utils/boutonRetour.js ; ici, on l'exécute : fermer la fenêtre ouverte (par
// la touche Échap, que toutes les fenêtres de l'app écoutent déjà), aller à
// la page d'accueil, ou quitter.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { actionRetour } from '../utils/boutonRetour';

/**
 * @param {() => { chemin: string, connecte: boolean }} lireEtat  situation au moment de la pression
 * @param {(vers: string) => void} aller                          navigation (remplace l'adresse)
 * @returns {() => void} désinstallation
 */
export function installerBoutonRetour(lireEtat, aller) {
  if (typeof window === 'undefined' || !Capacitor.isNativePlatform()) return () => {};
  // Fenêtre qui n'a pas obéi à la dernière pression : la suivante passe
  // outre, sinon le bouton resterait sans effet.
  let fenetreTentee = null;
  const surRetour = () => {
    const fenetre = document.querySelector('[aria-modal="true"]');
    if (!fenetre) fenetreTentee = null;
    const action = actionRetour({ ...lireEtat(), fenetreOuverte: !!fenetre && fenetre !== fenetreTentee });
    if (action.type === 'fermer') {
      fenetreTentee = fenetre;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      return;
    }
    fenetreTentee = null;
    if (action.type === 'aller') { aller(action.vers); return; }
    // Comme toute application Android depuis la version 12 : l'app passe en
    // arrière-plan, sans être détruite — elle rouvre là où on l'a laissée.
    App.minimizeApp().catch(() => App.exitApp());
  };
  const ecouteur = App.addListener('backButton', surRetour);
  return () => { ecouteur.then((e) => e.remove()).catch(() => {}); };
}
