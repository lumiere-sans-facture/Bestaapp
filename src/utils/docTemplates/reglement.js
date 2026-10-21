// Règlement imprimé sur une facture Pro : acomptes déjà versés, reste à
// payer, montant en toutes lettres, échéancier et son statut, modes de
// paiement, mention fiscale, signataire. Données seulement : chaque modèle
// (studio, vague, sobre) les met en page à sa façon.
import { montantEnLettres } from '../montantEnLettres';
import { STATUTS_ECHEANCE, quandEcheance } from '../echeancier';
import { etatPaiementFacture, jourDuPaiement, dateMiseAJour, libelleModePaiement } from '../facturePaiements';
import { modesPaiementAffiches } from '../facture';
import { jourFr, jourLocal } from '../date';
import { esc } from './shared';

/** Coordonnée imprimée à côté d'un mode de paiement (compte, numéro…). */
function detailDuMode(mode, source, pays) {
  if (mode === 'Virement bancaire') {
    return [source.banque, source.compteBancaire ? `compte ${source.compteBancaire}` : ''].filter(Boolean).join(' — ');
  }
  if (mode === 'Chèque') return source.nomEntreprise ? `à l’ordre de ${source.nomEntreprise}` : '';
  if (mode === 'Espèces') return '';
  // Mobile Money : le numéro saisi vaut pour l'opérateur choisi (ou le seul
  // opérateur coché, quand l'entreprise n'en a pas précisé).
  const operateurs = pays?.mobileMoney || [];
  const sonOperateur = source.momoOperateur || (operateurs.includes(mode) ? mode : '');
  if (!source.momo || sonOperateur !== mode) return '';
  return `${source.momo}${source.momoNom ? ` (${source.momoNom})` : ''}`;
}

/** Signataire des factures et reçus (« Mon entreprise ») ; null s'il n'est pas renseigné. */
export const signataireDe = (source = {}) => (source.signataireTitre || source.signataireNom || source.cachet
  ? { titre: source.signataireTitre || '', nom: source.signataireNom || '', cachet: source.cachet || '' }
  : null);

/**
 * @param {object} facture  facture AVEC ses paiements (joindrePaiements)
 * @param {object} source   entreprise émettrice (champs bruts de « Mon entreprise »)
 * @param {object} pays     pays de l'entreprise (data/pays.js)
 * @param {string} [aujourdhui] « AAAA-MM-JJ » : statut des échéances à ce jour
 */
export function reglementDe(facture = {}, source = {}, pays = {}, aujourdhui = jourLocal()) {
  const etat = etatPaiementFacture(facture, aujourdhui);
  // Versements dans l'ordre : « Acompte » tant qu'il reste à payer, « Solde »
  // pour celui qui termine la facture.
  let cumul = 0;
  const versements = [...(facture.paiements || [])]
    .filter((p) => Number(p?.montant) > 0)
    .map((p) => {
      cumul += Math.round(Number(p.montant) || 0);
      const jour = jourDuPaiement(p);
      const nature = cumul >= etat.total && etat.total > 0 ? 'Solde' : 'Acompte';
      return {
        libelle: `${nature} versé${jour ? ` le ${jourFr(jour)}` : ''}`,
        detail: [libelleModePaiement(p), p.reference].filter(Boolean).join(' · '),
        montant: Math.round(Number(p.montant) || 0),
      };
    });
  const modes = modesPaiementAffiches(source, pays).map((nom) => ({ nom, detail: detailDuMode(nom, source, pays) }));
  const signataire = signataireDe(source);
  return {
    total: etat.total,
    paye: etat.paye,
    reste: etat.reste,
    tropPercu: etat.tropPercu,
    versements,
    echeances: etat.lignes.map((l) => ({
      libelle: l.libelle || 'Échéance',
      quand: quandEcheance(l),
      montant: l.montant,
      statut: l.statut,
      statutLabel: STATUTS_ECHEANCE[l.statut] || '',
    })),
    enLettres: montantEnLettres(etat.total),
    // Le reste en lettres n'a de sens qu'après un premier versement.
    resteEnLettres: etat.paye > 0 && etat.reste > 0 ? montantEnLettres(etat.reste) : '',
    modes,
    mention: String(source.mentionFiscale || '').trim(),
    signataire,
    miseAJour: dateMiseAJour(facture),
  };
}

// Couleurs des statuts d'échéance (Studio, Vague) : texte foncé sur fond
// pâle, lisibles imprimés. Sobre, en noir et blanc, a les siens.
export const COULEURS_STATUT = {
  recu: ['#e6f4ea', '#1e6b34'], partiel: ['#e8f0fe', '#1a4fa0'], en_retard: ['#fdecea', '#a8261d'],
  attendu: ['#fff3dc', '#8a4b00'], a_venir: ['#f1f3f5', '#55595f'],
};
export const cssStatuts = () => Object.entries(COULEURS_STATUT)
  .map(([k, [fond, texte]]) => `.statut-${k} { background: ${fond}; color: ${texte}; }`).join('\n  ');

/** « Arrêtée la présente facture… » : la phrase, en morceaux (texte, montant en gras). */
export const phraseArretee = (r) => [
  ['Arrêtée la présente facture à la somme de ', r.enLettres],
  ...(r.resteEnLettres ? [['Dont reste à payer : ', r.resteEnLettres]] : []),
];

/** Montant en lettres échappé, le nombre entre parenthèses jamais coupé en fin de ligne. */
export const montantInsecable = (texte) => esc(texte).replace(/\([\d\s\u00a0\u202f]+\)/g, (m) => `<span class="insecable">${m}</span>`);

/** Nombre de lignes qu'occupe un texte à `parLigne` caractères par ligne (estimation prudente). */
export const lignesTexte = (texte, parLigne) => Math.max(1, Math.ceil(String(texte || '').length / parLigne));

// Marge de sécurité ajoutée à l'estimation du règlement (px).
const MARGE = 24;

/**
 * Longueur « pondérée » d'un texte : une majuscule ou un chiffre est plus
 * large qu'une minuscule, une espace plus étroite. Compter ainsi évite de
 * prévoir trois lignes pour une désignation qui en prend deux — et l'inverse
 * pour une désignation tout en capitales.
 */
export const longueurPonderee = (texte) => [...String(texte || '')].reduce((t, c) => t
  + (c === ' ' ? 0.6 : /[A-Z0-9ÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŒ]/.test(c) ? 1.3 : /[mwMW@%]/.test(c) ? 1.4 : 1), 0);

/** Hauteur estimée d'une ligne d'article (px) : `base` + une hauteur de texte par ligne de désignation. */
export const hauteurLigneArticle = ({ base, texte, parLigne, min = 0 }) => (l) =>
  Math.max(min, base + texte * Math.max(1, Math.ceil(longueurPonderee(l?.designation) / parLigne)));

/**
 * Découpe des lignes d'une facture, À LA HAUTEUR : chaque ligne compte selon
 * la longueur de sa désignation (une désignation longue passe à la ligne),
 * chaque page selon sa place réelle (`aire`, px sous l'en-tête du tableau,
 * mesurée dans le navigateur), le règlement selon son estimation (`place` :
 * haut — en plus sur la 1ʳᵉ page —, totaux, bloc).
 * Le règlement n'est jamais coupé, et jamais seul sur une page : il part avec
 * au moins une ligne. Seule exception, quand c'est impossible (une seule
 * ligne, ou un règlement presque aussi haut qu'une page) : sa fin —
 * signature et conditions — passe sur la page suivante (`scinder`), en un bloc.
 * @returns {{ pages: object[][], scinder: boolean }}
 */
export function paginerFacture(lignes, place, { aire, hauteurLigne }) {
  const h = lignes.map(hauteurLigne);
  const budget = (k) => (k === 0 ? aire.premiere - place.haut : aire.suite) - MARGE;
  const somme = (a, b) => h.slice(a, b).reduce((t, x) => t + x, 0);
  const decouper = (bloc) => {
    if (somme(0, h.length) + bloc <= budget(0)) return { pages: [[0, h.length]], ok: true };
    // Pages remplies l'une après l'autre (au moins une ligne chacune)…
    const pages = [];
    for (let debut = 0, k = 0; debut < h.length; k += 1) {
      let fin = debut + 1;
      while (fin < h.length && somme(debut, fin + 1) <= budget(k)) fin += 1;
      pages.push([debut, fin]);
      debut = fin;
    }
    // … puis le règlement sur la dernière, ou avec la toute dernière ligne
    // sur une page de plus.
    const k = pages.length - 1;
    const [d, f] = pages[k];
    if (somme(d, f) + bloc <= budget(k)) return { pages, ok: true };
    if (f - d >= 2 && h[f - 1] + bloc <= budget(k + 1)) {
      pages[k] = [d, f - 1];
      pages.push([f - 1, f]);
      return { pages, ok: true };
    }
    return { pages, ok: false };
  };
  let decoupe = decouper(place.bloc);
  const scinder = !decoupe.ok;
  if (scinder) {
    decoupe = decouper(place.totaux);
    // Même les totaux ne tiennent pas avec une ligne : seuls sur leur page,
    // plutôt que coupés par le bas de la feuille.
    if (!decoupe.ok) decoupe.pages.push([h.length, h.length]);
  }
  return { pages: decoupe.pages.map(([a, b]) => lignes.slice(a, b)), scinder };
}
