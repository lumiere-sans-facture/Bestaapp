// Modèles de documents (devis / facture) — HTML imprimable autonome.
//
// Un document = un type (`kind`) + un modèle (`model`) + des données (`data`).
// `kind` ne pilote que les libellés (titre, série du numéro, date secondaire,
// conditions) ; `model` pilote toute la mise en page.
//
// Répartition : l'espace public n'utilise que « studio » (aucun sélecteur) ;
// l'espace Pro propose les trois modèles, le défaut étant réglé par entreprise.
// « Sobre » a remplacé « Classique » : un document ou une entreprise réglés
// sur « classique » s'ouvrent désormais en Sobre (voir ALIAS).
import { renderStudio } from './studio';
import { renderVague } from './vague';
import { renderSobre } from './sobre';

export const MODELS = [
  { id: 'studio', label: 'Studio', scope: ['public', 'pro'], desc: 'Navy et orange, pavé de titre et pastilles — le modèle par défaut.' },
  { id: 'vague', label: 'Vague', scope: ['pro'], desc: 'Bandeaux ondulés bleus, en-tête de tableau clair, total en orange.' },
  { id: 'sobre', label: 'Sobre', scope: ['pro'], desc: 'Noir, blanc et gris, sans logo : s’imprime à l’identique en noir et blanc.' },
];

const RENDUS = { studio: renderStudio, vague: renderVague, sobre: renderSobre };
// Modèles retirés, et celui qui les remplace.
const ALIAS = { classique: 'sobre' };

export const MODEL_DEFAUT = 'studio';

/** Modèles proposés dans un espace donné ('public' | 'pro'). */
export const modelsPour = (scope) => MODELS.filter((m) => m.scope.includes(scope));

/** Ramène tout identifiant inconnu ou hérité (couleur, sobre…) sur le défaut. */
export const normaliserModel = (model) => (RENDUS[model] ? model : (ALIAS[model] || MODEL_DEFAUT));

/**
 * Construit le document HTML complet.
 * @param {object} o
 * @param {'devis'|'facture'} o.kind
 * @param {'studio'|'vague'|'sobre'} o.model
 * @param {object} o.data  voir donneesDeDevis / donneesDeFacture (shared.js)
 * @returns {string} HTML autonome
 */
export function buildDocHtml({ kind = 'devis', model = MODEL_DEFAUT, data }) {
  const rendu = RENDUS[normaliserModel(model)];
  return rendu({ kind: kind === 'facture' ? 'facture' : 'devis', data });
}

/** Ouvre le document dans un onglet imprimable (repli : téléchargement). */
export function openDoc({ kind, model, data }) {
  const html = buildDocHtml({ kind, model, data });
  const fenetre = window.open('', '_blank');
  if (fenetre) {
    fenetre.document.write(html);
    fenetre.document.close();
    return;
  }
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${kind === 'facture' ? 'facture' : 'devis'}-${data?.numero || ''}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export { donneesDeDevis, donneesDeFacture, lignesDeDevis, emetteurDe } from './shared';
