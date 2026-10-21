// Aperçu d'un modèle de document Pro (réglages de « Mon entreprise »), montré
// DANS l'application (components/ApercuDocument). Les devis et factures
// eux-mêmes : voir useDocumentsPro.

/** Document d'exemple dans un modèle, aux réglages de l'entreprise (HTML). */
export async function htmlApercuModele(company, modele, lignes, kind = 'facture') {
  const [{ buildDocHtml, normaliserModel }, { emetteurDe, totauxDe }, { reglementDe }, { paysDeLEntreprise }, { jourLocal }] = await Promise.all([
    import('../../../utils/docTemplates'),
    import('../../../utils/docTemplates/shared'),
    import('../../../utils/docTemplates/reglement'),
    import('../../../data/pays'),
    import('../../../utils/date'),
  ]);
  const maintenant = new Date();
  const totaux = totauxDe(lignes, { tva: 0, tvaActive: false });
  // Facture d'exemple : un acompte de moitié déjà versé, le solde à la mise
  // en service — l'aperçu montre ainsi l'échéancier, le reste à payer, les
  // modes de paiement et le signataire réglés ci-dessus.
  const jour = jourLocal(maintenant);
  const acompte = Math.round(totaux.totalTTC / 2000) * 1000;
  const exemple = {
    totalTTC: totaux.totalTTC,
    createdAt: maintenant.toISOString(),
    echeancier: [
      { id: 'apercu-1', libelle: 'Acompte', type: 'date', date: jour, montant: acompte },
      { id: 'apercu-2', libelle: 'Solde', type: 'condition', condition: 'À la mise en service', montant: totaux.totalTTC - acompte },
    ],
    paiements: [{ id: 'apercu-p', montant: acompte, date: jour, mode: 'virement' }],
  };
  return buildDocHtml({
    kind,
    model: normaliserModel(modele),
    data: {
      numero: kind === 'facture' ? 'FAC-APERCU' : 'BS-APERCU',
      date: maintenant.toISOString(),
      dateSecondaire: new Date(maintenant.getTime() + 30 * 86400000).toISOString(),
      emetteur: emetteurDe(company || {}),
      client: { name: 'Client exemple', societe: '', phone: '+228 00 00 00 00', adresse: 'Lomé' },
      lignes,
      totaux,
      apporteur: null,
      reglement: kind === 'facture' ? reglementDe(exemple, company || {}, paysDeLEntreprise(company || {}), jour) : undefined,
    },
  });
}
