// Aperçu imprimable d'un modèle de document Pro (réglages de « Mon
// entreprise »). Les devis et factures eux-mêmes se produisent en PDF dans
// l'application : voir useDocumentsPro.

/** Aperçu d'un modèle avec un jeu d'exemple (réglages de l'entreprise). */
export async function previewDocument(company, modele, lignes, kind = 'facture') {
  const [{ openDoc, normaliserModel }, { emetteurDe, totauxDe }] = await Promise.all([
    import('../../../utils/docTemplates'),
    import('../../../utils/docTemplates/shared'),
  ]);
  const maintenant = new Date();
  openDoc({
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
