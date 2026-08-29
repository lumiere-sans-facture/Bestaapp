// Formule d'abonnement choisie sur la page publique d'accueil, mémorisée le
// temps de traverser l'inscription.
//
// Le client clique « Choisir Pro Premium », puis crée son compte : entre les
// deux, l'app se recharge (nouvelle session, nouveau rendu). Sans cette
// mémoire, son choix se perdait et il retombait sur l'offre mensuelle — après
// avoir cliqué sur l'annuelle.
//
// Logique pure : ni React, ni réseau. Le stockage peut être indisponible
// (navigation privée, quota) — dans ce cas l'inscription continue sans le
// choix, jamais avec une erreur.
import { formuleValide } from './subscription.js';

const CLE = 'bestasolar_formule_choisie';

/** Formule mémorisée, ou null. Une valeur hors catalogue est ignorée. */
export const lireFormuleChoisie = () => {
  try {
    const id = localStorage.getItem(CLE);
    return formuleValide(id) ? id : null;
  } catch {
    return null;
  }
};

/** Mémorise un choix. Un identifiant hors catalogue efface, il n'écrit pas. */
export const ecrireFormuleChoisie = (id) => {
  try {
    if (formuleValide(id)) localStorage.setItem(CLE, id);
    else localStorage.removeItem(CLE);
  } catch {
    // stockage indisponible : le parcours continue sans mémoire du choix
  }
};

/** Oublie le choix — une fois l'abonnement pris, ou la formule abandonnée. */
export const oublierFormuleChoisie = () => {
  try {
    localStorage.removeItem(CLE);
  } catch {
    // rien à faire : il n'y avait rien à oublier
  }
};

/**
 * Capture `?formule=` au chargement, puis NETTOIE l'adresse — comme la
 * capture d'affiliation. Sans ce nettoyage, un rechargement ou un partage de
 * lien réimposerait le choix, longtemps après qu'il ait été abandonné.
 *
 * @returns {string|null} la formule captée sur CE chargement de page.
 */
export const capturerFormuleUrl = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('formule');
    if (!id) return null;
    if (!formuleValide(id)) return null;
    ecrireFormuleChoisie(id);
    const url = new URL(window.location.href);
    url.searchParams.delete('formule');
    window.history.replaceState({}, '', url);
    return id;
  } catch {
    return null;
  }
};
