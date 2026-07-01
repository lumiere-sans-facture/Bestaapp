// Export PDF des documents Pro (devis / facture) à l'identité du technicien.
// jsPDF est chargé à la demande pour ne pas alourdir le bundle initial.

/** Devis à l'identité Pro. La TVA n'est affichée que si elle est réellement due
 *  (les devis kit solaires ont une TVA à 0 → ne pas imprimer « TVA 18 % · 0 F »). */
export async function exportDevisProPdf(d, modele, { company, lead, products, markDevisPro }) {
  const { generateProPdf, devisToLignes } = await import('../../../utils/proDocPdf');
  markDevisPro(d.id, { modele, companySnapshot: company });
  const solarTva = d.type === 'solar' ? (d.quotation?.tva || 0) : 0;
  generateProPdf({
    kind: 'devis',
    company,
    modele,
    doc: {
      numero: d.devisNumber,
      date: d.createdAt,
      client: { name: lead?.contact || lead?.name || 'Client', phone: lead?.phone, ville: lead?.address },
      lignes: devisToLignes(d, products),
      totalHT: d.type === 'solar' ? d.quotation?.subtotalHT : d.subtotal,
      tvaActive: solarTva > 0,
      tva: solarTva,
      totalTTC: d.total,
      validiteJours: 30,
    },
  });
}

/** Facture à l'identité Pro (utilise le snapshot d'entreprise figé à la création). */
export async function exportFacturePdf(f, modele, { company, modeleDefaut }) {
  const { generateProPdf } = await import('../../../utils/proDocPdf');
  generateProPdf({
    kind: 'facture',
    company: f.companySnapshot || company,
    modele: modele || f.modele || modeleDefaut,
    doc: {
      numero: f.numero,
      date: f.createdAt,
      client: { name: f.clientName, phone: f.clientPhone, ville: f.clientVille },
      lignes: f.lignes,
      totalHT: f.totalHT,
      tvaActive: f.tvaActive,
      tva: f.tva,
      totalTTC: f.totalTTC,
      statut: f.statut,
    },
  });
}
