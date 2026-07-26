// Fiche technique de dimensionnement — moteur v2.
//
// Document HTML autonome et imprimable, construit à partir du résultat de
// dimensionner(). Deux versions issues du même code :
//   • CLIENT (défaut) : désignations techniques et quantités uniquement.
//     AUCUNE marque, AUCUN modèle, AUCUNE référence SKU. Règle absolue.
//   • INTERNE (interne: true) : la même fiche augmentée des marques, modèles
//     et références, réservée à l'équipe.
//
// Règles de rendu : libellés issus de LIBELLES (ne jamais réécrire « rendement
// des panneaux »), helpers fmt partout (4,9 kWc et non 4 889 Wc), format
// francophone (virgule décimale, milliers séparés par des espaces).
import { LIBELLES, REFERENCES, fmt } from './dimensionnementV2';
import { documentShell, openHtmlDocument, esc } from './docShell';

const SYSTEME_LABEL = {
  'off-grid': 'Autonome (off-grid)',
  hybrid: 'Hybride (réseau + batteries)',
  'on-grid': 'Raccordé réseau (on-grid)',
};
const BASE_AUTONOMIE_LABEL = {
  nuit: 'Consommation nocturne (offre hybride)',
  'journee-complete': 'Journée complète, 24 h (site isolé)',
};

const kv = (label, valeur) => `<div class="kv-row"><span class="kv-label">${label}</span><span class="kv-value">${valeur}</span></div>`;
const oui = (ok) => `<span class="verdict ${ok ? 'ok' : 'ko'}">${ok ? 'Conforme' : 'À corriger'}</span>`;

/**
 * @param {object} o
 * @param {object} o.dim                 résultat de dimensionner()
 * @param {{name?:string, phone?:string, ville?:string}} [o.client]
 * @param {{name:string, code?:string}|null} [o.apporteur]
 * @param {string} [o.systemType]        type de système retenu au devis
 * @param {boolean} [o.interne]          version équipe (marques et références)
 * @param {Array<{ref:string, qty:number, marque?:string, modele?:string, reference?:string, unite?:string}>} [o.materielDetaille]
 *        matériel réel du devis (version interne) ; à défaut, dim.materiel
 */
export function buildFicheTechniqueHtml({
  dim, client = {}, apporteur = null, systemType = null, interne = false, materielDetaille = null,
}) {
  const { consommation, irradiation, rendements, energie, pv, batterie, onduleur, verifications, cables, production } = dim;
  const st = systemType || 'off-grid';

  // --- 1. Bilan de consommation ---
  const h = (v) => (v ? fmt.num(v, v % 1 ? 1 : 0) : '—');
  const lignesCharges = consommation.parEquipement.map((e) => `
    <tr>
      <td>${esc(e.nom)}${e.demarrage ? ' <span class="muted">(démarrage moteur)</span>' : ''}</td>
      <td class="num">${fmt.num(e.puissanceW)}</td>
      <td class="num">${fmt.num(e.quantite)}</td>
      <td class="num">${h(e.heuresJour)}</td>
      <td class="num">${h(e.heuresNuit)}</td>
      <td class="num">${fmt.num(e.whJour + e.whNuit)}</td>
    </tr>`).join('');

  const section1 = `
    <section>
      <h2>1 · Bilan de consommation</h2>
      <table>
        <thead>
          <tr>
            <th>Désignation</th><th class="num">Puissance (W)</th><th class="num">Qté</th>
            <th class="num">☀ Jour (h)</th><th class="num">☾ Nuit (h)</th><th class="num">Conso. (Wh/j)</th>
          </tr>
        </thead>
        <tbody>${lignesCharges || '<tr><td colspan="6" class="muted">Aucune charge détaillée.</td></tr>'}</tbody>
        <tfoot>
          <tr class="sous"><td colspan="5">${LIBELLES.consommationJour}</td><td class="num">${fmt.num(consommation.jourKwh * 1000)} Wh</td></tr>
          <tr class="sous"><td colspan="5">${LIBELLES.consommationNuit}</td><td class="num">${fmt.num(consommation.nuitKwh * 1000)} Wh</td></tr>
          <tr class="sous"><td colspan="5">${LIBELLES.puissanceSimultanee} <span class="muted">${consommation.simultaneiteImposee
            ? '(pointe saisie directement)'
            : `(coefficient de simultanéité ${fmt.pct(consommation.coefficientSimultaneite, 0)} sur ${fmt.w(consommation.puissanceCrete)} installés)`}</span></td><td class="num">${fmt.w(consommation.puissanceSimultanee)}</td></tr>
          <tr class="sous"><td colspan="5">${LIBELLES.puissanceAppel} <span class="muted">${consommation.nbMoteurs ? `(appel × ${fmt.num(consommation.facteurDemarrage)} du plus gros moteur, ${fmt.w(consommation.plusGrosMoteur)})` : '(aucun moteur déclaré)'}</span></td><td class="num">${fmt.w(consommation.puissanceAppelDemarrage)}</td></tr>
          <tr><td colspan="5">${LIBELLES.consommationTotale}</td><td class="num">${fmt.kwhJour(consommation.totalKwh)}</td></tr>
        </tfoot>
      </table>
    </section>`;

  // --- 2. Hypothèses de calcul ---
  const chaine = rendements.chaine
    .map((p) => `${esc(p.label)} ${fmt.pct(p.valeur, 0)}${p.nuitUniquement ? ' <span class="muted">(flux nocturne)</span>' : ''}`)
    .join(' × ');

  const section2 = `
    <section>
      <h2>2 · Hypothèses de calcul</h2>
      ${kv('Site retenu', esc(irradiation.siteNom || 'Non précisé'))}
      ${kv(
        irradiation.complet ? `${LIBELLES.productible} — ${LIBELLES.moisDefavorable}` : LIBELLES.productible,
        `${fmt.productible(irradiation.productible)}${irradiation.moisNom ? ` <span class="muted">(${esc(irradiation.moisNom)})</span>` : ''}`
      )}
      ${kv(LIBELLES.strategieIrradiation, irradiation.strategie === 'mois-defavorable' ? 'Mois le plus défavorable' : 'Moyenne annuelle')}
      ${kv('Source des données', esc(irradiation.source || '—'))}
      ${kv(LIBELLES.etaJour, fmt.pct(rendements.etaJour))}
      ${kv(LIBELLES.etaNuit, fmt.pct(rendements.etaNuit))}
      ${kv(LIBELLES.dod, fmt.pct(batterie.dod, 0))}
      ${kv(LIBELLES.tensionSysteme, fmt.v(batterie.tension))}
      ${kv(LIBELLES.baseAutonomie, `${BASE_AUTONOMIE_LABEL[batterie.baseAutonomie] || esc(batterie.baseAutonomie)}${batterie.joursAutonomie > 1 ? ` — ${fmt.num(batterie.joursAutonomie)} jours` : ''}`)}
      ${kv('Type de système', esc(SYSTEME_LABEL[st] || st))}
      <div class="calc">
        <div class="calc-head">${LIBELLES.chaineRendement}</div>
        <div class="calc-formula">${chaine}</div>
        <div class="calc-result">
          Rendement de chaîne en journée <strong>${fmt.pct(rendements.etaJour)}</strong>,
          la nuit <strong>${fmt.pct(rendements.etaNuit)}</strong> — l’énergie consommée la nuit traverse
          en plus le stockage.
        </div>
      </div>
      <div class="mention">${esc(rendements.mention)}</div>
      <div class="mention">${esc(irradiation.mention)}</div>
    </section>`;

  // --- 3. Résultats ---
  const section3 = `
    <section>
      <h2>3 · Résultats du dimensionnement</h2>
      <div class="calc">
        <div class="calc-head">${LIBELLES.energieAProduire}</div>
        <div class="calc-formula">E = (conso. jour ÷ rendement jour) + (conso. nuit ÷ rendement nuit)</div>
        <div class="calc-apply">
          E = (${fmt.kwh(consommation.jourKwh, 2)} ÷ ${fmt.pct(rendements.etaJour)})
          + (${fmt.kwh(consommation.nuitKwh, 2)} ÷ ${fmt.pct(rendements.etaNuit)})
          = ${fmt.kwh(energie.jourAProduire, 2)} + ${fmt.kwh(energie.nuitAProduire, 2)}
          = <strong>${fmt.kwhJour(energie.totalAProduire)}</strong>
        </div>
        <div class="calc-result">Les deux flux sont corrigés séparément : le stockage ne pénalise que la part nocturne.</div>
      </div>
      <div class="calc">
        <div class="calc-head">Champ photovoltaïque</div>
        <div class="calc-formula">P = énergie à produire ÷ productible du mois défavorable</div>
        <div class="calc-apply">
          P = ${fmt.kwhJour(energie.totalAProduire)} ÷ ${fmt.productible(irradiation.productible)}
          = <strong>${fmt.kwc(pv.puissanceMinW)}</strong> — ${LIBELLES.pvMin}
        </div>
        <div class="calc-result">${LIBELLES.pvInstalle} : <strong>${fmt.kwc(pv.puissanceInstalleeW)}</strong> — ${fmt.num(pv.nbPanneaux)} panneaux de ${fmt.num(pv.panneauWc)} Wc</div>
      </div>
      <div class="mention">${esc(pv.justification)}</div>
      ${st === 'on-grid' ? '' : `
      <div class="calc">
        <div class="calc-head">Parc batterie</div>
        <div class="calc-formula">C = base d’autonomie × jours ÷ (DoD × rendement de décharge)</div>
        <div class="calc-apply">${esc(batterie.formule)}</div>
        <div class="calc-result">
          soit <strong>${fmt.ah(batterie.capaciteAh)}</strong> sous ${fmt.v(batterie.tension)}
          ${batterie.nbModules ? ` — ${fmt.num(batterie.nbModules)} module${batterie.nbModules > 1 ? 's' : ''} de ${fmt.kwh(batterie.moduleKwh, batterie.moduleKwh % 1 ? 1 : 0)} (${fmt.kwh(batterie.capaciteInstalleeKwh)} installés)` : ''}
        </div>
      </div>`}
      <div class="calc">
        <div class="calc-head">Onduleur</div>
        <div class="calc-formula">P onduleur = pointe simultanée des charges × marge de sécurité</div>
        <div class="calc-apply">${esc(onduleur.formule)}</div>
        ${onduleur.retenu ? `<div class="calc-result">Calibre retenu : <strong>${fmt.kva(onduleur.retenu.puissanceW / 1000)}</strong> (${fmt.w(onduleur.retenu.puissanceW)} en continu${onduleur.retenu.surgeW ? `, ${fmt.w(onduleur.retenu.surgeW)} au démarrage` : ''})${interne && onduleur.retenu.nom ? ` — ${esc(onduleur.retenu.nom)}` : ''}</div>` : ''}
      </div>
    </section>`;

  // --- 4. Vérifications de compatibilité ---
  const s = verifications.strings || {};
  const section4 = `
    <section>
      <h2>4 · Vérifications de compatibilité</h2>
      ${s.possible
      ? `<table>
          <thead><tr><th>Vérification</th><th class="num">Calculé</th><th class="num">Limite</th><th class="num">Verdict</th></tr></thead>
          <tbody>
            <tr>
              <td>Configuration du champ</td>
              <td class="num">${fmt.num(s.serie)} en série × ${fmt.num(s.parallele)} en parallèle</td>
              <td class="num">${fmt.num(s.serieMin)} à ${fmt.num(s.serieMax)} en série</td>
              <td class="num">${oui(true)}</td>
            </tr>
            <tr>
              <td>${LIBELLES.vocFroid} <span class="muted">(à ${fmt.num(s.temperatures?.min)} °C)</span></td>
              <td class="num">${fmt.v(s.vocStringV)}</td>
              <td class="num">${fmt.v(s.vDcMaxV)} max DC</td>
              <td class="num">${oui(s.tensionOk)}</td>
            </tr>
            <tr>
              <td>${LIBELLES.vmpChaud} <span class="muted">(à ${fmt.num(s.temperatures?.max)} °C)</span></td>
              <td class="num">${fmt.v(s.vmpStringV)}</td>
              <td class="num">${fmt.v(s.vMpptMinV)} min MPPT</td>
              <td class="num">${oui(s.vmpStringV >= s.vMpptMinV)}</td>
            </tr>
            ${s.iMpptA ? `<tr>
              <td>${LIBELLES.courantString}</td>
              <td class="num">${fmt.a(s.courantStringA)}</td>
              <td class="num">${fmt.a(s.iMpptA)} max</td>
              <td class="num">${oui(s.courantOk !== false)}</td>
            </tr>` : ''}
            ${batterie.tauxChargeC != null ? `<tr>
              <td>${LIBELLES.tauxCharge}</td>
              <td class="num">${fmt.cRate(batterie.tauxChargeC)}</td>
              <td class="num">${fmt.cRate(batterie.cRateChargeMax)} max</td>
              <td class="num">${oui(batterie.tauxChargeC <= batterie.cRateChargeMax)}</td>
            </tr>` : ''}
          </tbody>
        </table>`
      : `<div class="mention">
          Vérifications non réalisables : les caractéristiques électriques du module ou de l’onduleur
          (Voc, Vmp, tension DC maximale, plage MPPT, courant d’entrée) ne sont pas encore renseignées
          dans le catalogue. Les compléter permet de valider la configuration série/parallèle avant
          l’installation.
        </div>`}
    </section>`;

  // --- 5. Câblage ---
  const lignesCables = cables.filter((c) => c.sectionMm2).map((c) => `
    <tr>
      <td>${esc(c.liaison)}</td>
      <td class="num">${fmt.m(c.longueurM)}</td>
      <td class="num">${fmt.a(c.courantA)}</td>
      <td class="num">${fmt.mm2(c.sectionMm2)}</td>
      <td class="num">${fmt.pctPoints(c.chuteReellePct, 2)} <span class="muted">/ ${fmt.pct(c.chuteAdmissiblePct, 0)}</span></td>
      <td>${esc(c.critere)}</td>
    </tr>`).join('');

  const section5 = `
    <section>
      <h2>5 · Câblage</h2>
      ${lignesCables
      ? `<table>
          <thead><tr><th>Liaison</th><th class="num">Longueur</th><th class="num">Courant</th><th class="num">${LIBELLES.section}</th><th class="num">${LIBELLES.chuteTension}</th><th>${LIBELLES.critereDimensionnant}</th></tr></thead>
          <tbody>${lignesCables}</tbody>
        </table>
        <div class="mention">
          Sections calculées sur la longueur aller-retour du conducteur (UTE C15-712), cuivre.
          Chute de tension admissible : 3 % côté PV et courant alternatif, 1 % côté batterie.
        </div>`
      : '<div class="mention">Distances de câblage non renseignées : les sections ne sont pas calculées.</div>'}
      ${batterie.consigneCablage ? `<div class="consigne"><strong>Consigne de câblage du parc batterie.</strong> ${esc(batterie.consigneCablage)}</div>` : ''}
    </section>`;

  // --- 6. Récapitulatif matériel ---
  const materiel = materielDetaille || dim.materiel;
  const lignesMateriel = materiel.map((m) => `
    <tr>
      <td>${esc(m.ref)}</td>
      ${interne ? `<td>${esc([m.marque, m.modele, m.reference].filter(Boolean).join(' · ') || '—')}</td>` : ''}
      <td class="num">${fmt.num(m.qty)}${m.unite ? ` ${esc(m.unite)}` : ''}</td>
    </tr>`).join('');

  const section6 = `
    <section>
      <h2>6 · Récapitulatif matériel</h2>
      <table>
        <thead><tr><th>Désignation technique</th>${interne ? '<th>Marque · modèle · référence</th>' : ''}<th class="num">Quantité</th></tr></thead>
        <tbody>${lignesMateriel}</tbody>
      </table>
      ${interne ? '' : '<div class="mention">Désignations techniques et quantités. Les marques et références des équipements retenus figurent au devis.</div>'}
    </section>`;

  // --- 7. Production estimée ---
  const section7 = `
    <section>
      <h2>7 · Production estimée</h2>
      ${kv('Production annuelle', `${fmt.num(production.annuelleKwh)} kWh/an`)}
      ${kv('Productible annuel du site', `${fmt.num(production.productibleAnnuel, 0)} kWh/kWc/an`)}
      ${kv('Puissance installée retenue', fmt.kwc(pv.puissanceInstalleeW))}
      <div class="mention">${esc(production.mention)}</div>
    </section>`;

  // --- 8. Références normatives ---
  const section8 = `
    <section>
      <h2>8 · Références normatives</h2>
      <ul class="refs">${REFERENCES.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
    </section>`;

  // --- En-tête client ---
  const sectionClient = `
    <section>
      <h2>Client</h2>
      <div class="client-grid">
        <div class="client-item"><strong>Nom</strong>${esc(client.name || 'À compléter')}</div>
        <div class="client-item"><strong>Contact</strong>${esc(client.phone || '—')}</div>
        <div class="client-item"><strong>Localisation</strong>${esc(irradiation.siteNom || client.ville || '—')}</div>
        ${apporteur?.name ? `<div class="client-item"><strong>Apporteur d’affaires</strong>${esc(apporteur.name)}${apporteur.code ? ` <span class="muted">(${esc(apporteur.code)})</span>` : ''}</div>` : ''}
      </div>
    </section>`;

  return documentShell({
    titreDocument: 'Fiche de dimensionnement',
    titreOnglet: `Fiche de dimensionnement — ${client.name || 'Client'}`,
    usage: interne ? 'Document interne — équipe BestaSolar' : '',
    piedMention: interne
      ? 'Document interne : marques et références incluses. Ne pas remettre au client.'
      : 'Document technique : ne constitue ni un devis ni une offre de prix.',
    sections: [sectionClient, section1, section2, section3, section4, section5, section6, section7, section8].join('\n'),
  });
}

/** Ouvre la fiche technique (version client par défaut). */
export const openFicheTechnique = (options) =>
  openHtmlDocument(
    buildFicheTechniqueHtml(options),
    options?.interne ? 'fiche-dimensionnement-interne.html' : 'fiche-dimensionnement.html'
  );
