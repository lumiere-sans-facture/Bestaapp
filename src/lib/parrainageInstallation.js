// Code partenaire transmis à l'application Android, au premier lancement.
//
// L'APK se télécharge hors Play Store : rien ne relie l'application installée
// au lien de parrainage qui l'a fait télécharger. La page de téléchargement
// (/telecharger?ref=CODE → public/telecharger.html) copie donc « Code
// partenaire BestaSolar : CODE » dans le presse-papiers ; l'application le lit
// ICI, une seule fois, et le retient comme un lien de parrainage : son écran
// d'accueil devient l'inscription, code partenaire prérempli.
//
// Garde-fous (utils/referral.js → doitChercherCodeInstallation) : APK Android
// seulement, installation neuve seulement, une seule lecture dans la vie de
// l'installation. Du presse-papiers, seul un texte à ce format exact est
// retenu ; rien d'autre n'est gardé ni envoyé. Et jamais bloquant : au-delà
// de DELAI_MAX_MS, l'application démarre sans.
//
// Importé par main.jsx AVANT l'application : le constat « installation
// neuve » doit précéder tout ce qu'elle écrit dans le stockage.
import { Capacitor } from '@capacitor/core';
import { codeParrainageDepuisTexte, doitChercherCodeInstallation, enregistrerRef, getActiveRef } from '../utils/referral';

const CLE_FAIT = 'bestasolar_parrainage_installation';
const DELAI_MAX_MS = 2000;
// Au tout premier instant, Android peut refuser le presse-papiers : une
// application n'y a accès qu'une fois sa fenêtre au premier plan.
const NOUVEL_ESSAI_MS = 700;

let codeRetenu = null;
// Figé quand l'application démarre : un code arrivé après coup reste retenu
// (30 jours, comme un lien), mais ne fait plus basculer l'écran affiché.
let codeAuDemarrage = null;

/** Code partenaire repris du téléchargement à CE lancement, ou null. */
export const codeParrainageInstallation = () => codeAuDemarrage;

const attendre = (ms) => new Promise((ok) => { setTimeout(ok, ms); });

const lireTexte = async () => {
  const { Clipboard } = await import('@capacitor/clipboard');
  // Presse-papiers vide, ou pas encore accessible : le module rejette.
  try { return (await Clipboard.read())?.value || ''; } catch { return ''; }
};

const chercher = async () => {
  let texte = await lireTexte();
  if (!texte) {
    await attendre(NOUVEL_ESSAI_MS);
    texte = await lireTexte();
  }
  const code = codeParrainageDepuisTexte(texte);
  if (code) codeRetenu = enregistrerRef(code);
};

const demarrer = () => {
  try {
    const cles = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
    const lire = doitChercherCodeInstallation({
      plateforme: Capacitor.getPlatform(),
      dejaFait: localStorage.getItem(CLE_FAIT) !== null,
      clesStockage: cles,
      refActive: Boolean(getActiveRef()),
    });
    // Marqué AVANT de lire : réussie ou non, la lecture ne se refait jamais.
    if (!lire) return Promise.resolve();
    localStorage.setItem(CLE_FAIT, new Date().toISOString());
    return chercher().catch(() => { /* sans code, l'inscription reste à la main */ });
  } catch {
    return Promise.resolve();
  }
};

const recherche = demarrer();

/** Résolue quand la recherche est finie — ou au bout de DELAI_MAX_MS. */
export const attendreParrainageInstallation = () => Promise.race([recherche, attendre(DELAI_MAX_MS)])
  .then(() => { codeAuDemarrage = codeRetenu; });
