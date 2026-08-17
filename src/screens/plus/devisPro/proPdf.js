// Ouverture des documents Pro (devis / facture) à l'identité de l'abonné.
// Les documents sont des pages HTML autonomes imprimables (export PDF par
// Ctrl+P) construites par src/utils/docTemplates ; le modèle est celui choisi
// pour le document, à défaut celui réglé sur l'entreprise.

/** Devis à l'identité Pro. */
export async function exportDevisProPdf(d, modele, { company, lead, products, markDevisPro }) {
  const [{ openDoc, normaliserModel }, { donneesDeDevis }] = await Promise.all([
    import('../../../utils/docTemplates'),
    import('../../../utils/docTemplates/shared'),
  ]);
  const model = normaliserModel(modele);
  markDevisPro(d.id, { modele: model, companySnapshot: company });
  openDoc({
    kind: 'devis',
    model,
    data: donneesDeDevis({ devis: d, company, lead, products }),
  });
}

/** Facture à l'identité Pro (snapshot d'entreprise figé à la création). */
export async function exportFacturePdf(f, modele, { company, modeleDefaut }) {
  const [{ openDoc, normaliserModel }, { donneesDeFacture }] = await Promise.all([
    import('../../../utils/docTemplates'),
    import('../../../utils/docTemplates/shared'),
  ]);
  openDoc({
    kind: 'facture',
    model: normaliserModel(modele || f.modele || modeleDefaut),
    data: donneesDeFacture({ facture: f, company }),
  });
}

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
