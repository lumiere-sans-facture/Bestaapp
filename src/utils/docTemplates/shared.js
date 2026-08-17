// Socle commun aux modèles de documents (devis / facture).
// Formatage, normalisation des données, primitives de page A4 et pagination.
// Aucun modèle ne réimplémente ces briques : elles garantissent que les trois
// rendus partagent la même grille, la même typographie et les mêmes nombres.
import { COMPANY } from '../../config/company';
import { LOGO_BESTASOLAR } from '../../assets/logoBestaSolar';
import { prixPublic } from '../price';

// ---------------------------------------------------------------------------
// Formatage
// ---------------------------------------------------------------------------

/** Milliers séparés par des espaces insécables normalisées (« 1 200 000 »). */
export const nf = (v, dec = 0) =>
  Number(v || 0).toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
    .replace(/[\u202f\u00a0]/g, ' ');

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 12 mars 2026 */
export const dateFr = (iso) => {
  const d = iso ? new Date(iso) : new Date();
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Date décalée de n jours (validité d'un devis). */
export const dateplusJours = (iso, jours) => {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + jours * 86400000).toISOString();
};

// ---------------------------------------------------------------------------
// Libellés pilotés par le type de document
// ---------------------------------------------------------------------------

/** `kind` ne change que les libellés — jamais la mise en page. */
export const libelles = (kind) => (kind === 'facture'
  ? { titre: 'FACTURE', numeroLabel: 'Facture n°', destinataire: 'Facturé à', dateSecondaireLabel: 'Échéance' }
  : { titre: 'DEVIS', numeroLabel: 'Devis n°', destinataire: 'Devis pour', dateSecondaireLabel: 'Valide jusqu’au' });

/** Conditions générales applicables : la clause de validité ne vaut que pour un devis. */
export const conditionsPour = (kind, emetteur = {}) =>
  emetteur.conditions
  || (kind === 'facture' ? COMPANY.termsFacture : COMPANY.termsDevis);

// ---------------------------------------------------------------------------
// Couleurs de marque
// ---------------------------------------------------------------------------

/** Palette par défaut (identité BestaSolar, espace public). */
export const COULEURS_DEFAUT = { primaire: '#0a2472', secondaire: '#f5a623' };

/** N'accepte qu'un hexadécimal valide — les couleurs sont injectées dans le CSS. */
const hexOu = (valeur, defaut) =>
  (/^#[0-9a-fA-F]{6}$/.test(valeur || '') ? valeur.toLowerCase() : defaut);

/** Teinte éclaircie d'une couleur (mélange vers le blanc), pour les aplats décoratifs. */
export function eclaircir(hex, ratio = 0.22) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * ratio);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ---------------------------------------------------------------------------
// Normalisation des données d'entrée
// ---------------------------------------------------------------------------

/**
 * Émetteur uniforme, qu'il vienne de COMPANY (espace public) ou d'une
 * entreprise abonnée (espace Pro, champs nomEntreprise / telephone / adresse…).
 */
export function emetteurDe(source = {}) {
  const pro = source.nomEntreprise !== undefined;
  return pro
    ? {
        name: source.nomEntreprise || 'Entreprise',
        slogan: source.slogan || '',
        phone: source.telephone || '',
        email: source.email || '',
        website: source.website || '',
        address: source.adresse || '',
        addressShort: source.adresse || '',
        rccm: source.rccm || '',
        ifu: source.ifu || '',
        logo: source.logo || '',
        bank: source.momo ? { name: 'Mobile Money', account: source.momo, swift: source.momoNom || '' } : null,
        conditions: source.conditions || '',
        // Couleurs de l'abonné : les documents Pro portent sa marque, pas la nôtre.
        couleurPrimaire: hexOu(source.couleurPrimaire, COULEURS_DEFAUT.primaire),
        couleurSecondaire: hexOu(source.couleurSecondaire, COULEURS_DEFAUT.secondaire),
      }
    : {
        name: source.name || COMPANY.name,
        slogan: source.slogan ?? COMPANY.slogan,
        phone: source.phone ?? COMPANY.phone,
        email: source.email ?? COMPANY.email,
        website: source.website ?? COMPANY.website,
        address: source.address ?? COMPANY.address,
        addressShort: source.addressShort ?? COMPANY.addressShort,
        rccm: source.rccm ?? COMPANY.rccm,
        ifu: source.ifu ?? COMPANY.ifu,
        logo: source.logo || LOGO_BESTASOLAR,
        bank: source.bank ?? COMPANY.bank,
        conditions: source.conditions || '',
        couleurPrimaire: COULEURS_DEFAUT.primaire,
        couleurSecondaire: COULEURS_DEFAUT.secondaire,
      };
}

/**
 * Lignes d'un devis, quelle que soit son origine : lignes déjà saisies (devis
 * Pro ou devis édité), chiffrage solaire (composants + prestations), ou panier
 * de produits. Même normalisation que l'export PDF historique.
 */
export function lignesDeDevis(devis = {}, products = []) {
  if (Array.isArray(devis.lignes) && devis.lignes.length) {
    return devis.lignes.map((l) => ({ designation: l.designation, qty: Number(l.qty) || 0, pu: Number(l.pu) || 0 }));
  }
  if (devis.quotation) {
    return [...(devis.quotation.components || []), ...(devis.quotation.prestations || [])].map((c) => ({
      designation: c.name, qty: Number(c.quantity) || 0, pu: Number(c.unitPrice) || 0,
    }));
  }
  return (devis.items || []).map(({ productId, qty }) => {
    const produit = products.find((p) => p.id === productId);
    return {
      designation: produit?.name || 'Article',
      qty: Number(qty) || 0,
      pu: Number((devis.unitPrices || {})[productId] ?? (produit ? prixPublic(produit.basePrice) : 0)),
    };
  });
}

/** Totaux cohérents avec les lignes : la somme des lignes fait foi. */
export function totauxDe(lignes, { tva = 0, tvaActive = false, remise = 0 } = {}) {
  const totalHT = lignes.reduce((s, l) => s + l.pu * l.qty, 0);
  const tvaDue = tvaActive ? Math.round(tva) : 0;
  return { totalHT, remise: Math.round(remise) || 0, tva: tvaDue, tvaActive: tvaDue > 0, totalTTC: totalHT - (Math.round(remise) || 0) + tvaDue };
}

/** Données de document depuis un devis (public ou Pro). */
export function donneesDeDevis({ devis, company, lead, partner, products = [] }) {
  const lignes = lignesDeDevis(devis, products);
  const tva = devis.type === 'pro' ? (devis.tva || 0) : (devis.quotation?.tva || 0);
  const client = devis.clientName
    ? { name: devis.clientName, societe: '', phone: devis.clientPhone || '', adresse: devis.clientVille || '' }
    : {
        name: lead?.contact || lead?.name || 'Client',
        societe: lead?.contact && lead?.name !== lead?.contact ? lead.name : '',
        phone: lead?.phone || '',
        adresse: lead?.address || '',
      };
  return {
    numero: devis.devisNumber || '',
    date: devis.createdAt,
    dateSecondaire: dateplusJours(devis.createdAt, 30),
    emetteur: emetteurDe(company || {}),
    client,
    lignes,
    totaux: totauxDe(lignes, { tva, tvaActive: tva > 0 }),
    apporteur: partner ? { name: partner.name, code: partner.code } : null,
  };
}

/** Données de document depuis une facture Pro. */
export function donneesDeFacture({ facture, company }) {
  const lignes = (facture.lignes || []).map((l) => ({ designation: l.designation, qty: Number(l.qty) || 0, pu: Number(l.pu) || 0 }));
  return {
    numero: facture.numero || '',
    date: facture.createdAt,
    dateSecondaire: facture.echeance || null,
    emetteur: emetteurDe(facture.companySnapshot || company || {}),
    client: { name: facture.clientName || 'Client', societe: '', phone: facture.clientPhone || '', adresse: facture.clientVille || '' },
    lignes,
    totaux: totauxDe(lignes, { tva: facture.tva || 0, tvaActive: !!facture.tvaActive }),
    apporteur: null,
  };
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/**
 * Découpe les lignes en pages selon ce que chaque page doit porter en plus :
 *  - `seule`    : document d'une seule page (en-tête + lignes + totaux) ;
 *  - `premiere` : première page d'un document multi-pages (en-tête + lignes) ;
 *  - `suite`    : pages intermédiaires (lignes seules) ;
 *  - `derniere` : dernière page (lignes + totaux + conditions).
 * Les capacités sont mesurées page par page dans le navigateur, modèle par
 * modèle : elles garantissent qu'aucune page ne déborde.
 */
export function paginer(lignes, { seule, premiere, suite, derniere }) {
  if (lignes.length <= seule) return [lignes];
  const pages = [lignes.slice(0, premiere)];
  let reste = lignes.slice(premiere);
  while (reste.length > derniere) {
    pages.push(reste.slice(0, suite));
    reste = reste.slice(suite);
  }
  pages.push(reste);
  return pages;
}

// ---------------------------------------------------------------------------
// Enveloppe du document
// ---------------------------------------------------------------------------

/** Styles communs : page A4 fixe, typographie unique, règles d'impression. */
export // ---------------------------------------------------------------------------
// POLICE DES DOCUMENTS — servie par l'APPLICATION, pas par Google Fonts.
//
// Les devis, factures et fiches de dimensionnement allaient chercher IBM Plex
// Sans sur fonts.googleapis.com au moment de s'ouvrir. Quand cette requête
// n'aboutit pas — réseau lent, coupé, ou Google inaccessible — le document se
// compose en police système : le gérant voit alors « la police qui a changé »,
// sans rien avoir touché, et sans savoir pourquoi.
//
// Les trois graisses sont maintenant dans public/fonts (71 Ko au total, sous-
// ensemble latin). Un document composé hors ligne est identique à celui
// composé en ligne — ce que le local-first exige.
//
// L'origine est explicite : un document écrit dans un onglet vierge
// (window.open + document.write) a « about:blank » pour base, et une adresse
// relative n'y désignerait rien.
// ---------------------------------------------------------------------------
const GRAISSES_DOCUMENT = [400, 500, 600];

export function policeDocument() {
  const origine = (typeof location !== 'undefined' && location.origin && location.origin !== 'null')
    ? location.origin
    : '';
  const face = (poids) => `@font-face{font-family:'IBM Plex Sans';font-style:normal;font-weight:${poids};`
    + `font-display:swap;src:url('${origine}/fonts/ibm-plex-sans-latin-${poids}-normal.woff2') format('woff2')}`;
  return `<style>${GRAISSES_DOCUMENT.map(face).join('')}</style>`;
}

const CSS_BASE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'IBM Plex Sans', system-ui, sans-serif;
    font-size: 13px; line-height: 1.5; background: #eceef2; padding: 32px 0;
  }
  .page {
    width: 794px; height: 1123px; box-sizing: border-box; overflow: hidden;
    background: #fff; margin: 0 auto 32px; position: relative;
    display: flex; flex-direction: column;
    font-variant-numeric: tabular-nums;
  }
  .page:last-of-type { margin-bottom: 0; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  td, th { overflow-wrap: anywhere; }
  .num { text-align: right; white-space: nowrap; }
  .push { margin-top: auto; }
  .print-bar { width: 794px; margin: 32px auto 0; display: flex; justify-content: flex-end; }
  /* Chrome de la page, hors document : gris neutre, pour qu'aucune couleur de
     marque ne s'invite dans un modèle qui n'en emploie pas (Classique). */
  .print-btn {
    font-family: inherit; font-size: 13px; font-weight: 600; color: #fff;
    background: #212529; border: none; border-radius: 4px; padding: 12px 24px; cursor: pointer;
  }
  @page { size: A4; margin: 0; }
  @media print {
    body { background: #fff; padding: 0; }
    .page { margin: 0; }
    .page:not(:last-of-type) { page-break-after: always; }
    .print-bar { display: none; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

/** Assemble le document complet (police, styles, pages, barre d'impression). */
export const documentHtml = ({ titre, css, pages }) => `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titre)}</title>
${policeDocument()}
<style>${CSS_BASE}${css}</style>
</head>
<body>
${pages.join('\n')}
<div class="print-bar"><button class="print-btn" onclick="window.print()">Imprimer / Exporter en PDF</button></div>
</body>
</html>`;
