// Fiche de dimensionnement — VERSION PDF.
//
// Pourquoi un PDF et plus un onglet HTML : la fiche est ce que le technicien
// laisse au client. En HTML elle s'imprime (Ctrl+P), mais elle ne s'envoie pas
// — or ici tout passe par WhatsApp. Un PDF s'ouvre dans le lecteur du
// navigateur (pages, zoom, télécharger, imprimer, partager), et c'est un
// fichier que l'on transmet tel quel.
//
// La mise en page n'est pas redessinée : le document HTML est rendu tel quel,
// page par page. Les blocs `.page` font déjà exactement 794 × 1123 px, soit le
// rapport A4 au pixel près — une page HTML donne une page PDF, sans découpe.
// Assemblage direct (calculs + mise en page) plutôt qu'un passage par
// `index.js`, qui réexporte ce module : le cycle d'imports serait inutile.
import { computeSheet } from './compute';
import { renderSheet } from './layout';

const LARGEUR_PAGE = 794;   // px CSS — A4 à 96 dpi
const HAUTEUR_PAGE = 1123;

// Budget accordé à la police distante (IBM Plex Sans, Google Fonts). Au-delà,
// la fiche est composée avec la police système. Ce n'est pas un détail de
// confort : l'app doit rester utilisable hors ligne, et sans cette limite un
// technicien sans réseau attend le document une minute (mesuré ci-dessous).
const BUDGET_POLICE = 1500;
const BUDGET_PAGES = 4000;

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * La police de la fiche est-elle RÉELLEMENT disponible dans ce document ?
 *
 * `document.fonts.check()` ne sert à rien ici : il répond « oui » quand la
 * famille n'est même pas déclarée, le repli système comptant comme
 * disponible. `document.styleSheets` ne sert pas davantage — Chrome y laisse
 * la feuille dont le téléchargement a échoué. Reste la mesure : si le texte
 * composé en IBM Plex Sans occupe exactement la largeur du repli demandé,
 * c'est que la police n'est pas là.
 */
function policeDisponible(doc) {
  const largeur = (famille) => {
    const sonde = doc.createElement('span');
    sonde.textContent = 'BestaSolar 0123456789';
    sonde.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:600 18px ${famille}`;
    doc.body.appendChild(sonde);
    const l = sonde.offsetWidth;
    sonde.remove();
    return l;
  };
  try { return largeur("'IBM Plex Sans', monospace") !== largeur('monospace'); } catch { return false; }
}

/**
 * Attend l'apparition des pages, sans attendre les ressources distantes.
 *
 * Le document est relu à chaque tour : `contentDocument` désigne d'abord la
 * page blanche initiale de l'iframe, remplacée ensuite par celle de `srcdoc`.
 * Garder la première référence, c'est attendre indéfiniment dans un document
 * qui ne recevra jamais rien.
 */
async function attendrePages(cadre, limite = BUDGET_PAGES) {
  const fin = Date.now() + limite;
  while (Date.now() < fin) {
    const doc = cadre.contentDocument;
    if (doc?.querySelector('.page')) return doc;
    await attendre(30);
  }
  return null;
}

/**
 * Charge le document dans un iframe hors écran et rend la main dès qu'il est
 * composé. L'iframe isole totalement la fiche du CSS de l'application : ce qui
 * est capturé est exactement ce que le document décrit.
 *
 * On n'attend PAS l'événement `load` de l'iframe : il inclut le
 * téléchargement de la police distante, soit 13 s quand le réseau ne répond
 * pas. Même chose côté html2canvas, qui recopie le document dans son propre
 * cadre et relance le téléchargement POUR CHAQUE PAGE. D'où le retrait du
 * lien dès que la police se fait attendre : 52 s → 2 s, mesuré réseau coupé.
 */
async function chargerHorsEcran(html) {
  const cadre = document.createElement('iframe');
  cadre.setAttribute('aria-hidden', 'true');
  cadre.setAttribute('tabindex', '-1');
  // Hors écran plutôt que `display:none` : un iframe masqué n'a aucune mise
  // en page, et html2canvas ne mesurerait que des zéros.
  cadre.style.cssText = `position:fixed;left:-20000px;top:0;border:0;width:${LARGEUR_PAGE}px;height:${HAUTEUR_PAGE}px;`;
  // `srcdoc` AVANT l'insertion : un iframe inséré vide émet d'abord un `load`
  // pour son document blanc, et la capture ne trouverait aucune page.
  cadre.srcdoc = html;
  document.body.appendChild(cadre);

  try {
    const doc = await attendrePages(cadre);
    if (!doc) throw new Error('fiche non composée');

    const fin = Date.now() + BUDGET_POLICE;
    while (Date.now() < fin && !policeDisponible(doc)) await attendre(60);
    if (!policeDisponible(doc)) {
      doc.querySelectorAll('link[href^="http"]').forEach((lien) => lien.remove());
    }
    return { cadre, doc };
  } catch (e) {
    cadre.remove();
    throw e;
  }
}

/**
 * Construit le PDF de la fiche.
 *
 * @param {object} data      mêmes données que buildSizingSheetHtml
 * @param {object} [options]
 * @param {number} [options.echelle]  finesse de rendu (2 = 192 dpi)
 * @param {number} [options.qualite]  compression JPEG (0–1)
 * @returns {Promise<{blob: Blob, url: string, nom: string, pages: number}>}
 */
export async function construireFichePdf(data, options = {}) {
  const client = String(data.client?.name || '').trim();
  return pdfDepuisHtml(renderSheet(data, computeSheet(data)), {
    titre: `Fiche de dimensionnement${client ? ` — ${client}` : ''}`,
    auteur: data.company?.nomEntreprise || 'BestaSolar Pro',
    // Nom de fichier : c'est ce que le client verra dans WhatsApp.
    nom: `Fiche-dimensionnement${nomDeFichier(client)}.pdf`,
    ...options,
  });
}

/** Diacritiques et ponctuation retirés : un nom de fichier voyage mieux ainsi. */
const nomDeFichier = (client) => {
  const s = client.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return s ? `-${s}` : '';
};

/**
 * Convertit un document HTML de fiche (pages `.page`) en PDF.
 *
 * Séparé de construireFichePdf pour que le lecteur intégré, qui n'a que le
 * HTML sous la main, puisse produire le même fichier.
 *
 * @param {string} html
 * @param {object} [options]
 * @param {number} [options.echelle]  finesse de rendu (2 = 192 dpi)
 * @param {number} [options.qualite]  compression, JPEG seulement (0–1)
 * @param {'PNG'|'JPEG'} [options.format]
 * @param {string} [options.titre]    titre affiché par le lecteur PDF
 * @param {string} [options.auteur]
 * @param {string} [options.nom]      nom du fichier
 * @returns {Promise<{blob: Blob, url: string, nom: string, pages: number}>}
 */
export async function pdfDepuisHtml(html, {
  echelle = 2, qualite = 0.92, format = 'PNG',
  titre = 'Fiche de dimensionnement', auteur = 'BestaSolar Pro',
  nom = 'Fiche-dimensionnement.pdf',
} = {}) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const { cadre, doc } = await chargerHorsEcran(html);
  try {
    const pages = [...doc.querySelectorAll('.page')];
    if (!pages.length) throw new Error('fiche vide');

    const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    const largeurPdf = pdf.internal.pageSize.getWidth();
    const hauteurPdf = pdf.internal.pageSize.getHeight();

    for (let i = 0; i < pages.length; i += 1) {
      const canvas = await html2canvas(pages[i], {
        scale: echelle,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        width: LARGEUR_PAGE,
        height: HAUTEUR_PAGE,
        windowWidth: LARGEUR_PAGE,
        windowHeight: HAUTEUR_PAGE,
      });
      if (i) pdf.addPage();
      const image = format === 'PNG'
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', qualite);
      pdf.addImage(image, format, 0, 0, largeurPdf, hauteurPdf, undefined, 'FAST');
    }

    pdf.setProperties({
      title: titre,
      subject: 'Étude technique de dimensionnement solaire',
      creator: auteur,
    });

    const blob = pdf.output('blob');
    return { blob, url: URL.createObjectURL(blob), nom, pages: pages.length };
  } finally {
    cadre.remove();
  }
}

// Page d'attente écrite dans l'onglet le temps du rendu. Sans elle, le
// technicien regarde un onglet blanc pendant plusieurs secondes et croit que
// rien ne s'est passé — c'est le moment où l'on appuie une deuxième fois.
const pageAttente = (message, erreur = false) => `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fiche de dimensionnement</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         font-family: system-ui, sans-serif; color: #3a3a3a; background: #eceef2; padding: 24px; }
  .bloc { text-align: center; max-width: 420px; }
  .titre { font-size: 17px; font-weight: 600; color: ${erreur ? '#c2410c' : '#1b5e20'}; }
  .note { font-size: 14px; color: #6b6b6b; margin-top: 8px; line-height: 1.5; }
</style></head>
<body><div class="bloc">
  <div class="titre">${erreur ? 'La fiche n’a pas pu être produite' : 'Préparation de la fiche…'}</div>
  <div class="note">${message}</div>
</div></body></html>`;

/**
 * Produit la fiche en PDF et l'affiche dans l'onglet fourni.
 *
 * L'onglet doit être ouvert par l'APPELANT, avant tout `await` : passé une
 * opération asynchrone, le navigateur ne rattache plus l'ouverture au clic et
 * la bloque — c'est systématique sur iOS. Sans onglet (blocage malgré tout),
 * la fiche est livrée en téléchargement : le document n'est jamais perdu.
 *
 * @param {object} data            données de la fiche
 * @param {{onglet?: Window|null}} [options]
 * @returns {Promise<{nom: string, pages: number, ongletUtilise: boolean}>}
 */
export async function ouvrirFichePdf(data, { onglet = null } = {}) {
  if (onglet && !onglet.closed) {
    onglet.document.write(pageAttente('Quelques secondes — le document est composé sur votre appareil.'));
    onglet.document.close();
  }
  try {
    const { url, nom, pages } = await construireFichePdf(data);
    if (onglet && !onglet.closed) {
      // `replace` plutôt qu'une affectation : la page d'attente ne reste pas
      // dans l'historique, et « Retour » ramène bien à l'application.
      onglet.location.replace(url);
      return { nom, pages, ongletUtilise: true };
    }
    // L'URL est révoquée après le téléchargement, jamais dans le cas de
    // l'onglet : le lecteur PDF perdrait le document à la première actualisation.
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = nom;
    lien.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { nom, pages, ongletUtilise: false };
  } catch (e) {
    if (onglet && !onglet.closed) {
      onglet.document.write(pageAttente(
        'Fermez cet onglet et réessayez. Si cela se reproduit, signalez-le depuis Plus → Diagnostic.',
        true,
      ));
      onglet.document.close();
    }
    throw e;
  }
}
