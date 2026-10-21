import { describe, it, expect } from 'vitest';
import { reglementDe, phraseArretee, montantInsecable, paginerFacture, signataireDe } from '../docTemplates/reglement';
import { buildDocHtml } from '../docTemplates';
import { donneesDeFacture, paginer } from '../docTemplates/shared';
import { CSS_SOBRE, COULEURS_SOBRE } from '../docTemplates/sobre';
import { donneesDeRecu, buildRecuHtml } from '../docTemplates/recu';
import { recuEnvoiMessage } from '../facturePaiements';
import { factureEnvoiMessage, relanceMessage } from '../paiement';
import { PAYS } from '../../data/pays';

const TOGO = PAYS.find((p) => p.id === 'tg');
const ENTREPRISE = {
  id: 'comp-u1', userId: 'u1', nomEntreprise: 'Lumière Sans Facture', pays: 'tg', telephone: '+228 79 98 02 09',
  rccm: 'TG-LFW-01-2025-A10-01086', ifu: '1002023475', cnss: '180065',
  banque: 'Banque Démo', compteBancaire: 'TG116 0001', momo: '+228 90 00 00 00', momoOperateur: TOGO.mobileMoney[0], momoNom: 'LSF',
  modesPaiement: ['Virement bancaire', TOGO.mobileMoney[0], 'Espèces'],
  mentionFiscale: 'Entreprise non assujettie à la TVA — montants nets.',
  signataireTitre: 'Le Directeur Général', signataireNom: 'Prénom Nom', cachet: 'data:image/png;base64,iVBORw0KGgo=',
};
// La facture de référence : 66 876 000 F, acompte de 11 000 000 F le 23/09/2026.
const FACTURE = {
  id: 'f1', userId: 'u1', numero: 'FAC-2026-016', clientName: 'Client Démo SARL', clientPhone: '+228 90 00 00 00',
  createdAt: '2026-09-21T09:00:00.000Z', totalHT: 66876000, totalTTC: 66876000, tva: 0, tvaActive: false, statut: 'emise',
  objet: 'Fourniture et installation d’une centrale solaire hybride',
  lignes: [{ designation: 'Centrale solaire hybride 153 kWc', qty: 1, pu: 66876000 }],
  echeancier: [
    { id: 'e1', libelle: 'Acompte', type: 'date', date: '2026-09-23', montant: 11000000 },
    { id: 'e2', libelle: 'Complément d’acompte', type: 'periode', date: '2026-10-12', dateFin: '2026-10-16', montant: 30000000 },
    { id: 'e3', libelle: 'Solde', type: 'condition', condition: 'À la réception / mise en service', montant: 25876000 },
  ],
  paiements: [{ id: 'p1', montant: 11000000, date: '2026-09-23', mode: 'virement', reference: 'VIR-0001', createdAt: '2026-09-23T10:00:00.000Z', majLe: '2026-09-23T10:00:00.000Z' }],
};

describe('règlement imprimé sur la facture', () => {
  const r = reglementDe(FACTURE, ENTREPRISE, TOGO, '2026-10-14');

  it('acompte versé, reste à payer et statut de chaque échéance au 14/10', () => {
    expect(r).toMatchObject({ total: 66876000, paye: 11000000, reste: 55876000, tropPercu: 0 });
    expect(r.versements).toEqual([{ libelle: 'Acompte versé le 23/09/2026', detail: 'Virement bancaire · VIR-0001', montant: 11000000 }]);
    expect(r.echeances.map((x) => `${x.libelle} ${x.statutLabel}`)).toEqual(['Acompte Reçu', 'Complément d’acompte Attendu', 'Solde À venir']);
    expect(r.echeances[1].quand).toBe('Du 12 au 16/10/2026');
  });

  it('le total et le reste en toutes lettres', () => {
    expect(r.enLettres).toBe('SOIXANTE-SIX MILLIONS HUIT CENT SOIXANTE-SEIZE MILLE (66 876 000) FRANCS CFA');
    expect(r.resteEnLettres).toBe('CINQUANTE-CINQ MILLIONS HUIT CENT SOIXANTE-SEIZE MILLE (55 876 000) FRANCS CFA');
    expect(phraseArretee(r).map(([a]) => a)).toEqual(['Arrêtée la présente facture à la somme de ', 'Dont reste à payer : ']);
    // Rien de payé : pas de « dont reste à payer ».
    expect(reglementDe({ ...FACTURE, paiements: [] }, ENTREPRISE, TOGO).resteEnLettres).toBe('');
  });

  it('le paiement qui termine la facture s’appelle « Solde »', () => {
    const solde = { id: 'p2', montant: 55876000, date: '2026-11-02', mode: 'momo', operateur: 'Flooz' };
    const fin = reglementDe({ ...FACTURE, paiements: [...FACTURE.paiements, solde] }, ENTREPRISE, TOGO, '2026-11-02');
    expect(fin.versements.map((v) => v.libelle)).toEqual(['Acompte versé le 23/09/2026', 'Solde versé le 02/11/2026']);
    expect(fin.versements[1].detail).toBe('Mobile Money (Flooz)');
    expect(fin.reste).toBe(0);
  });

  it('modes de paiement avec leurs coordonnées, mention fiscale, signataire', () => {
    expect(r.modes).toEqual([
      { nom: 'Virement bancaire', detail: 'Banque Démo — compte TG116 0001' },
      { nom: TOGO.mobileMoney[0], detail: '+228 90 00 00 00 (LSF)' },
      { nom: 'Espèces', detail: '' },
    ]);
    expect(r.mention).toBe('Entreprise non assujettie à la TVA — montants nets.');
    expect(r.signataire).toEqual({ titre: 'Le Directeur Général', nom: 'Prénom Nom', cachet: ENTREPRISE.cachet });
    expect(signataireDe({ nomEntreprise: 'X' })).toBeNull();
  });

  it('le nombre entre parenthèses ne se coupe jamais en fin de ligne', () => {
    expect(montantInsecable(r.enLettres)).toContain('<span class="insecable">(66 876 000)</span>');
    expect(montantInsecable('A <b> (1 000)')).toBe('A &lt;b&gt; <span class="insecable">(1 000)</span>');
  });
});

describe('découpe des factures à la hauteur', () => {
  const lignes = (n) => Array.from({ length: n }, (_, i) => ({ designation: `Article ${i + 1}`, qty: 1, pu: 1000 }));
  const opts = { aire: { premiere: 600, suite: 900 }, hauteurLigne: () => 40 };
  const decoupe = (n, place) => paginerFacture(lignes(n), { haut: 0, totaux: 200, bloc: 400, ...place }, opts);

  it('une seule page quand tout tient', () => {
    expect(decoupe(4).pages.map((p) => p.length)).toEqual([4]);
  });

  it('le règlement part toujours avec au moins une ligne, aucune ligne perdue', () => {
    for (let n = 2; n <= 60; n += 1) {
      const { pages, scinder } = decoupe(n);
      expect(scinder).toBe(false);
      expect(pages.flat()).toHaveLength(n);
      expect(pages.every((p) => p.length > 0)).toBe(true);
      // La dernière page porte ses lignes ET le règlement dans sa place.
      const k = pages.length - 1;
      expect(pages[k].length * 40 + 400 + 24).toBeLessThanOrEqual(k === 0 ? 600 : 900);
    }
  });

  it('une seule ligne qui ne tient pas avec tout le règlement : la signature passe à la page suivante', () => {
    const { pages, scinder } = decoupe(1, { bloc: 590 });
    expect(scinder).toBe(true);
    expect(pages.map((p) => p.length)).toEqual([1]);
  });

  it('règlement presque aussi haut qu’une page : sa fin passe à la suivante, d’un bloc', () => {
    const { pages, scinder } = decoupe(20, { bloc: 880 });
    expect(scinder).toBe(true);
    expect(pages.flat()).toHaveLength(20);
    expect(pages.every((p) => p.length > 0)).toBe(true);
  });

  it('découpe des devis : la dernière page n’est plus jamais vide', () => {
    const capacites = { seule: 9, premiere: 11, suite: 16, derniere: 8 };
    for (let n = 1; n <= 60; n += 1) {
      const pages = paginer(lignes(n), capacites);
      expect(pages.flat()).toHaveLength(n);
      expect(pages.every((p) => p.length > 0)).toBe(true);
      if (pages.length > 1) expect(pages[pages.length - 1].length).toBeLessThanOrEqual(capacites.derniere);
      else expect(n).toBeLessThanOrEqual(capacites.seule);
    }
  });
});

describe('facture imprimée : les trois modèles', () => {
  const data = donneesDeFacture({ facture: FACTURE, company: ENTREPRISE, aujourdhui: '2026-10-14' });

  for (const model of ['studio', 'vague', 'sobre']) {
    it(`${model} : acompte, reste à payer, montant en lettres, échéancier, modes, signataire, CNSS`, () => {
      const html = buildDocHtml({ kind: 'facture', model, data });
      expect(html).toContain('Arrêtée la présente facture à la somme de ');
      expect(html).toContain('SOIXANTE-SIX MILLIONS HUIT CENT SOIXANTE-SEIZE MILLE');
      expect(html).toMatch(/Reste à payer|RESTE À PAYER/);
      expect(html).toContain('55 876 000');
      expect(html).toContain('Acompte versé le 23/09/2026');
      expect(html).toContain('statut-recu');
      expect(html).toContain('statut-attendu');
      expect(html).toContain('statut-a_venir');
      expect(html).toContain('Banque Démo — compte TG116 0001');
      expect(html).toContain('Le Directeur Général');
      expect(html).toContain('CNSS 180065');
      expect(html).toContain('Entreprise non assujettie à la TVA');
    });
  }

  it('Studio et Vague impriment l’image de la signature ; Sobre, jamais d’image ni de couleur', () => {
    expect(buildDocHtml({ kind: "facture", model: "studio", data })).toContain(`<img src="${ENTREPRISE.cachet}"`);
    expect(buildDocHtml({ kind: 'facture', model: 'vague', data })).toContain(`<img src="${ENTREPRISE.cachet}"`);
    const sobre = buildDocHtml({ kind: 'facture', model: 'sobre', data });
    expect(sobre).not.toContain('<img');
    const pages = (sobre.match(/<section class="page[^"]*">[\s\S]*?<\/section>/g) || []).join('');
    const couleurs = [...new Set([...(CSS_SOBRE + pages).matchAll(/#[0-9a-f]{3,6}\b/gi)].map((m) => m[0].toLowerCase()))];
    expect(couleurs.filter((c) => !COULEURS_SOBRE.includes(c))).toEqual([]);
  });

  it('identité figée à l’émission : elle prime, les réglages apparus depuis la complètent', () => {
    const ancienne = { ...FACTURE, companySnapshot: { nomEntreprise: 'Ancien Nom', pays: 'tg', ifu: '999' } };
    const d = donneesDeFacture({ facture: ancienne, company: ENTREPRISE });
    expect(d.emetteur.name).toBe('Ancien Nom');
    expect(d.emetteur.ifu).toBe('999');
    expect(d.emetteur.cnss).toBe('180065');
    expect(d.reglement.signataire.titre).toBe('Le Directeur Général');
  });
});

describe('reçu de paiement', () => {
  const seconde = { id: 'p2', montant: 30000000, date: '2026-10-14', mode: 'momo', operateur: 'Flooz', reference: 'TX-42' };
  const facture = { ...FACTURE, paiements: [...FACTURE.paiements, seconde] };

  it('numéroté dans l’ordre des paiements, situation de la facture APRÈS ce paiement', () => {
    const premier = donneesDeRecu({ facture, paiement: FACTURE.paiements[0], company: ENTREPRISE });
    expect(premier).toMatchObject({ numero: 'FAC-2026-016-R1', nature: 'Acompte', montant: 11000000, paye: 11000000, reste: 55876000 });
    expect(premier.enLettres).toBe('ONZE MILLIONS (11 000 000) FRANCS CFA');
    expect(premier.prochaine).toMatchObject({ libelle: 'Complément d’acompte', montant: 30000000 });
    const second = donneesDeRecu({ facture, paiement: seconde, company: ENTREPRISE });
    expect(second).toMatchObject({ numero: 'FAC-2026-016-R2', nature: 'Versement', paye: 41000000, reste: 25876000, mode: 'Mobile Money (Flooz)' });
  });

  it('une page, le montant en lettres et le reste ; Sobre sans image', () => {
    const data = donneesDeRecu({ facture, paiement: seconde, company: ENTREPRISE });
    const html = buildRecuHtml({ data, model: 'studio' });
    expect(html.match(/<section class="page">/g)).toHaveLength(1);
    expect(html).toContain('REÇU DE PAIEMENT');
    expect(html).toContain('TRENTE MILLIONS');
    expect(html).toContain('25 876 000 F CFA');
    expect(html).toContain('TX-42');
    expect(html).toContain('<img');
    expect(buildRecuHtml({ data, model: 'sobre' })).not.toContain('<img');
  });

  it('le message WhatsApp du reçu : montant, reste, prochaine échéance', () => {
    const texte = recuEnvoiMessage(facture, FACTURE.paiements[0], ENTREPRISE);
    expect(texte).toContain('paiement de 11 000 000 F CFA pour la facture FAC-2026-016');
    expect(texte).toContain('Reste à payer : 55 876 000 F CFA.');
    expect(texte).toContain('Prochaine échéance : Complément d’acompte de 30 000 000 F CFA');
    expect(texte.split('\n').at(-1)).toBe('Lumière Sans Facture');
  });
});

describe('messages WhatsApp d’une facture à échéancier', () => {
  it('annoncent la prochaine échéance plutôt qu’une date unique', () => {
    const f = { ...FACTURE, echeance: '2026-10-21' };
    expect(factureEnvoiMessage(f, ENTREPRISE)).toContain('Reste à régler : 55 876 000 F CFA.');
    expect(factureEnvoiMessage(f, ENTREPRISE)).toMatch(/Prochaine échéance : Complément d’acompte de 30 000 000 F CFA \(Du 12 au 16\/10\/2026\)\./);
    expect(factureEnvoiMessage(f, ENTREPRISE)).not.toContain('À régler avant le');
    expect(relanceMessage(f, ENTREPRISE)).toContain('Prochaine échéance : Complément d’acompte');
  });
});
