// Paiements des factures Pro — logique pure, sans React.
//
// Un paiement est une fiche à part (collection `facturePaiements`), rattachée
// à sa facture par `factureId` : deux appareils qui encaissent la même facture
// ajoutent chacun SA fiche, sans réécrire celle de l'autre.
//   { id, factureId, userId, montant, date: 'AAAA-MM-JJ', mode, operateur,
//     reference, note, createdAt, majLe }
//
// Les factures enregistrées avant cette collection gardent leurs paiements
// dans `facture.paiements` : ils sont recopiés UNE fois dans la collection
// (même identifiant), et lus en attendant. Les écrans, eux, ne voient qu'une
// chose : `facture.paiements`, rempli par `joindrePaiements`.
import { jourLocal } from './date';
import { etatEcheancier } from './echeancier';
import { montantPaye } from './paiement';

const entier = (v) => Math.max(0, Math.round(Number(v) || 0));

/** Jour d'un paiement « AAAA-MM-JJ », qu'il soit daté d'un jour ou d'un instant (anciens paiements). */
export const jourDuPaiement = (p) => {
  const d = p?.date;
  if (!d) return p?.createdAt ? jourLocal(new Date(p.createdAt)) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : jourLocal(new Date(d));
};

const parJour = (a, b) => jourDuPaiement(a).localeCompare(jourDuPaiement(b))
  || String(a.createdAt || '').localeCompare(String(b.createdAt || ''));

/**
 * Factures avec leurs paiements (`paiements`), du plus ancien au plus récent :
 * ceux de la collection, plus les anciens encore rangés dans la facture et
 * pas encore recopiés. Une facture sans paiement est rendue telle quelle.
 */
export function joindrePaiements(factures = [], facturePaiements = []) {
  const parFacture = new Map();
  for (const p of facturePaiements) {
    if (!p?.factureId) continue;
    if (!parFacture.has(p.factureId)) parFacture.set(p.factureId, []);
    parFacture.get(p.factureId).push(p);
  }
  return factures.map((f) => {
    const recus = parFacture.get(f.id) || [];
    const ids = new Set(recus.map((p) => p.id));
    const anciens = (f.paiements || []).filter((p) => p && !ids.has(p.id));
    if (!recus.length && !anciens.length) return f;
    return { ...f, paiements: [...anciens, ...recus].sort(parJour) };
  });
}

/**
 * Paiements encore rangés DANS une facture et absents de la collection :
 * les fiches à créer, une seule fois, avec le même identifiant.
 */
export function paiementsARecopier(factures = [], facturePaiements = []) {
  const connus = new Set(facturePaiements.map((p) => p.id));
  const aCreer = [];
  for (const f of factures) {
    for (const p of f.paiements || []) {
      if (!p?.id || connus.has(p.id)) continue;
      connus.add(p.id);
      aCreer.push({
        id: p.id,
        factureId: f.id,
        userId: f.userId,
        montant: entier(p.montant),
        date: jourDuPaiement(p),
        mode: p.mode || 'momo',
        operateur: p.operateur || '',
        reference: p.reference || '',
        note: p.note || '',
        createdAt: p.createdAt || p.date || f.createdAt || null,
        majLe: p.majLe || p.date || null,
      });
    }
  }
  return aCreer;
}

/** Nouvelle fiche de paiement, prête à ranger dans la collection. */
export function nouveauPaiement(facture, { montant, date, mode = 'momo', operateur = '', reference = '', note = '' } = {}, maintenant = new Date()) {
  const instant = maintenant.toISOString();
  return {
    id: crypto.randomUUID(),
    factureId: facture.id,
    userId: facture.userId,
    montant: entier(montant),
    date: date || jourLocal(maintenant),
    mode,
    operateur: String(operateur || '').trim(),
    reference: String(reference || '').trim(),
    note: String(note || '').trim(),
    createdAt: instant,
    majLe: instant,
  };
}

/**
 * Champs de la facture à tenir à jour après un changement de paiements :
 * montant encaissé (repli des versions précédentes de l'app) et statut
 * « payee » quand le reste tombe à zéro — ou retour à « emise » s'il remonte.
 * Brouillons et factures annulées gardent leur statut.
 * @param {object} facture   facture AVEC ses paiements à jour (joindrePaiements)
 */
export function champsApresPaiement(facture) {
  // La somme des paiements eux-mêmes, jamais le champ `montantPaye` déjà
  // stocké : après suppression du dernier paiement, il serait périmé.
  const paye = (facture.paiements || []).reduce((s, p) => s + entier(p.montant), 0);
  const total = entier(facture.totalTTC);
  let { statut } = facture;
  if (statut !== 'brouillon' && statut !== 'annulee') {
    if (paye >= total && total > 0) statut = 'payee';
    else if (statut === 'payee') statut = 'emise';
  }
  return { montantPaye: paye, statut };
}

/**
 * État de paiement d'une facture au jour dit : total, payé, reste,
 * trop-perçu, échéances couvertes et prochaine échéance due.
 */
export const etatPaiementFacture = (facture, aujourdhui = jourLocal()) =>
  etatEcheancier(facture, montantPaye(facture), aujourdhui);

/**
 * Date de « Mise à jour » imprimée sur la facture : dernière modification d'un
 * paiement ou de l'échéancier, en jour « AAAA-MM-JJ ». Vide si rien n'a bougé
 * depuis l'émission.
 */
export function dateMiseAJour(facture) {
  const instants = [
    facture?.echeancierMajLe,
    ...(facture?.paiements || []).map((p) => p.majLe || p.createdAt),
  ].filter(Boolean).map((i) => new Date(i).getTime()).filter(Number.isFinite);
  if (!instants.length) return '';
  const jour = jourLocal(new Date(Math.max(...instants)));
  const emission = facture?.createdAt ? jourLocal(new Date(facture.createdAt)) : '';
  return jour > emission ? jour : '';
}
