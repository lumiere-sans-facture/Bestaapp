// Redimensionne et compresse une image en data URL JPEG.
// Les photos de téléphone font plusieurs Mo ; on les ramène à une taille
// raisonnable pour le stockage local et l'affichage en vignette.
export const fileToResizedDataUrl = (file, maxDim = 640, quality = 0.75) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });

/**
 * Logo importé dans « Mon entreprise » : rogné de ses marges vides (fond
 * transparent ou uni — voir utils/logo.js#cadreUtile), ramené à `maxDim` px
 * au plus grand côté, en PNG pour garder la transparence. (La conversion
 * JPEG des photos noircissait ou blanchissait le fond d'un logo détouré.)
 */
export const logoDepuisFichier = (file, maxDim = 480) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      URL.revokeObjectURL(url);
      try {
        const { cadreUtile } = await import('./logo');
        // Analyse sur une copie de 1 200 px au plus : assez fin pour le
        // rognage, raisonnable en mémoire sur un téléphone d'entrée de gamme.
        const echelle = Math.min(1, 1200 / Math.max(img.width, img.height));
        const l = Math.max(1, Math.round(img.width * echelle));
        const h = Math.max(1, Math.round(img.height * echelle));
        const source = document.createElement('canvas');
        source.width = l; source.height = h;
        const ctx = source.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, l, h);
        const cadre = cadreUtile(ctx.getImageData(0, 0, l, h).data, l, h) || { x: 0, y: 0, largeur: l, hauteur: h };
        // Un liseré de 3 % autour du dessin : rogné, pas étouffé.
        const marge = Math.round(Math.max(cadre.largeur, cadre.hauteur) * 0.03);
        const x = Math.max(0, cadre.x - marge);
        const y = Math.max(0, cadre.y - marge);
        const cl = Math.min(l - x, cadre.largeur + 2 * marge);
        const ch = Math.min(h - y, cadre.hauteur + 2 * marge);
        const reduction = Math.min(1, maxDim / Math.max(cl, ch));
        const sortie = document.createElement('canvas');
        sortie.width = Math.max(1, Math.round(cl * reduction));
        sortie.height = Math.max(1, Math.round(ch * reduction));
        sortie.getContext('2d').drawImage(source, x, y, cl, ch, 0, 0, sortie.width, sortie.height);
        resolve(sortie.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
