// Noms de fichiers des documents envoyés aux clients (devis, fiche).
// Sans accents ni ponctuation : un nom de fichier voyage mieux ainsi
// (WhatsApp, e-mail, explorateur d'un vieux téléphone).

/** Un morceau de nom de fichier : « Kossi Adjé & fils » → « Kossi-Adje-fils ». */
export const segmentFichier = (texte, max = 40) => String(texte ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  .slice(0, max).replace(/-+$/, '');

/** « Devis », « BS-20261009-0001 », « Kossi Adjé » → « Devis-BS-20261009-0001-Kossi-Adje.pdf ». */
export const nomFichierPdf = (...parties) =>
  `${parties.map((p) => segmentFichier(p)).filter(Boolean).join('-') || 'document'}.pdf`;
