// Aperçu d'un modèle de document Pro (réglages de « Mon entreprise »), montré
// DANS l'application (components/ApercuDocument). Les devis et factures
// eux-mêmes : voir useDocumentsPro.

/** Document d'exemple dans un modèle, aux réglages de l'entreprise (HTML). */
export async function htmlApercuModele(company, modele, lignes, kind = 'facture') {
  const [{ buildDocHtml, normaliserModel }, { emetteurDe, totauxDe }] = await Promise.all([
    import('../../../utils/docTemplates'),
    import('../../../utils/docTemplates/shared'),
  ]);
  const maintenant = new Date();
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
      totaux: totauxDe(lignes, { tva: 0, tvaActive: false }),
      apporteur: null,
    },
  });
}
