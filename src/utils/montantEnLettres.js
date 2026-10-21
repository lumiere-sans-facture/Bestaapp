// Montant en toutes lettres, en français — logique pure, sans React.
// Sert à la mention « Arrêtée la présente facture à la somme de … ».
//
// Orthographe traditionnelle, celle des documents comptables :
//  - trait d'union sous cent seulement (« soixante-seize »), « et » sans
//    trait d'union (« vingt et un », « soixante et onze ») ;
//  - « quatre-vingts » et « deux cents » prennent un s en fin de nombre ou
//    devant million / milliard (des noms) — jamais devant « mille », qui est
//    un adjectif : « quatre-vingt mille », « deux cent mille » ;
//  - « mille » est invariable et ne prend jamais « un » : « mille », « deux mille ».
import { formatNombre } from './format';

const UNITES = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
];
const DIZAINES = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

/** 0 à 99. */
function moinsDeCent(n) {
  if (n < 17) return UNITES[n];
  if (n < 20) return `dix-${UNITES[n - 10]}`;
  const d = Math.floor(n / 10);
  const u = n % 10;
  // 70-79 et 90-99 se construisent sur 10-19 : soixante-dix, quatre-vingt-onze.
  if (d === 7 || d === 9) {
    if (d === 7 && u === 1) return 'soixante et onze';
    return `${DIZAINES[d]}-${moinsDeCent(10 + u)}`;
  }
  if (u === 0) return d === 8 ? 'quatre-vingts' : DIZAINES[d];
  if (u === 1 && d !== 8) return `${DIZAINES[d]} et un`;
  return `${DIZAINES[d]}-${UNITES[u]}`;
}

/**
 * 0 à 999. `accord` : le groupe termine le nombre ou précède million /
 * milliard — « cents » et « quatre-vingts » y prennent leur s.
 */
function moinsDeMille(n, accord) {
  const c = Math.floor(n / 100);
  const r = n % 100;
  let texte = '';
  if (c > 0) {
    texte = c === 1 ? 'cent' : `${UNITES[c]} cent`;
    if (c > 1 && r === 0 && accord) texte += 's';
  }
  if (r > 0) {
    let dizaines = moinsDeCent(r);
    if (!accord && dizaines === 'quatre-vingts') dizaines = 'quatre-vingt';
    texte = texte ? `${texte} ${dizaines}` : dizaines;
  }
  return texte;
}

/** Entier positif en lettres minuscules : 66876000 → « soixante-six millions huit cent soixante-seize mille ». */
export function nombreEnLettres(valeur) {
  const n = Math.round(Math.abs(Number(valeur) || 0));
  if (n === 0) return 'zéro';
  const milliards = Math.floor(n / 1e9);
  const millions = Math.floor(n / 1e6) % 1000;
  const milliers = Math.floor(n / 1000) % 1000;
  const reste = n % 1000;
  const morceaux = [];
  if (milliards) {
    morceaux.push(milliards === 1 ? 'un milliard'
      : `${milliards >= 1000 ? nombreEnLettres(milliards) : moinsDeMille(milliards, true)} milliards`);
  }
  if (millions) morceaux.push(millions === 1 ? 'un million' : `${moinsDeMille(millions, true)} millions`);
  if (milliers) morceaux.push(milliers === 1 ? 'mille' : `${moinsDeMille(milliers, false)} mille`);
  if (reste) morceaux.push(moinsDeMille(reste, true));
  return morceaux.join(' ');
}

/**
 * Montant d'une facture, en lettres puis en chiffres, en majuscules :
 * « SOIXANTE-SIX MILLIONS HUIT CENT SOIXANTE-SEIZE MILLE (66 876 000) FRANCS CFA ».
 */
export function montantEnLettres(montant, { devise = 'CFA' } = {}) {
  const n = Math.round(Math.abs(Number(montant) || 0));
  const franc = n > 1 ? 'FRANCS' : 'FRANC';
  return `${nombreEnLettres(n).toUpperCase()} (${formatNombre(n)}) ${franc} ${devise}`.trim();
}
