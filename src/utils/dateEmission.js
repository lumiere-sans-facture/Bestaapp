// Date d'ÉMISSION d'un devis — celle qui figure sur le document, fait courir
// sa validité et compte pour les relances.
//
// Elle est distincte de `createdAt`, la date technique de saisie : un devis
// rédigé aujourd'hui pour une visite de la semaine dernière doit pouvoir
// porter la date de la visite, sans fausser l'activité du tableau de bord
// (devis saisis ce mois-ci), qui continue de lire `createdAt`.
//
// Le numéro BS-AAAAMMJJ-0001 n'est pas recalculé : c'est l'identité du
// devis, déjà communiquée au client et reprise dans les commissions.

/** Date d'émission effective : celle choisie, sinon la date de création.
 *  `date` est l'ancien nom du champ, lu pour les devis qui le portent. */
export const dateEmissionDevis = (devis) => devis?.dateEmission || devis?.date || devis?.createdAt || null;

const deuxChiffres = (n) => String(n).padStart(2, '0');

/** Valeur d'un champ <input type="date"> (AAAA-MM-JJ, jour LOCAL). */
export const versChampDate = (iso) => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}`;
};

/**
 * AAAA-MM-JJ → ISO, fixé à MIDI heure locale : à minuit, un fuseau décalé
 * ferait basculer le document sur la veille.
 */
export const depuisChampDate = (valeur) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valeur || ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  // new Date(2026, 1, 31) glisse au 3 mars : on refuse plutôt que de dater faux.
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
  return d.toISOString();
};

/**
 * Problème d'une date saisie, en clair — ou null si elle convient.
 * Pas de date dans le futur : un devis ne peut pas avoir été émis demain.
 */
export const problemeDateEmission = (valeur, maintenant = new Date()) => {
  const iso = depuisChampDate(valeur);
  if (!iso) return 'Date invalide.';
  if (versChampDate(iso) > versChampDate(maintenant)) return 'La date d’émission ne peut pas être dans le futur.';
  if (new Date(iso).getFullYear() < 2000) return 'Date invalide.';
  return null;
};
