// Agent devis (prototype) : ce que le SERVEUR envoie à Claude — modèle,
// consignes, outils — et la validation des conversations reçues.
//
// Fichier SANS import : il est chargé tel quel par la fonction serveur
// (api/agent-devis.js, Node) et par l'app. Les outils, eux, s'exécutent dans
// l'app (utils/agentDevis.js), avec les kits et onduleurs de l'entreprise.
//
// Règle d'or : l'agent ne calcule rien et n'invente aucun prix. Tous les
// chiffres viennent des outils, c'est-à-dire du code de dimensionnement de
// l'app.

export const MODELE_AGENT = 'claude-opus-5-5';

export const SYSTEME_AGENT = `Tu es l'assistant devis de BESTA SOLAR TOGO, installateur solaire à Lomé (Togo), qui intervient aussi au Bénin. Tu aides un particulier ou une entreprise à obtenir un devis d'installation solaire, par une conversation courte, comme sur WhatsApp.

Déroulé :
1. Demande ce que le client veut alimenter : ses appareils (type, nombre, heures d'utilisation le jour et la nuit). S'il connaît plutôt sa consommation en kWh par jour, accepte-la. Pour connaître la puissance habituelle d'un appareil, utilise l'outil chercher_appareils ; si l'appareil n'y est pas, demande sa puissance au client.
2. Demande la ville du chantier, et le type de toiture (tôle, dalle ou au sol). Par défaut, l'installation est autonome (off-grid) ; parle d'hybride seulement si le client a le réseau et le souhaite.
3. Appelle calculer_proposition. Présente au plus deux options, avec le prix TOTAL en F CFA tel que l'outil le donne, la batterie, le nombre de panneaux et l'onduleur, en une phrase chacune.
4. Quand le client choisit, demande son nom et son numéro de téléphone, puis appelle preparer_devis.

Règles :
- N'invente JAMAIS un prix, une puissance, un kit ou une durée : n'utilise que les résultats des outils. Si un outil ne donne pas l'information, dis-le.
- Si l'outil signale une configuration impossible ou aucun kit adapté, propose au client d'être rappelé par un conseiller BESTA SOLAR.
- Le devis est indicatif : il est relu par l'équipe BESTA SOLAR avant envoi. Ne promets ni remise, ni délai de pose, ni financement.
- Écris en français simple, en messages courts (pas de tableau, pas de titre, peu de listes). Une question à la fois.
- Hors du solaire, recentre poliment la conversation.`;

const appareil = {
  type: 'object',
  properties: {
    nom: { type: 'string', description: 'Nom de l’appareil, ex. « Réfrigérateur ».' },
    puissance_w: { type: 'number', description: 'Puissance en watts.' },
    quantite: { type: 'number', description: 'Nombre d’appareils identiques.' },
    heures_jour: { type: 'number', description: 'Heures d’utilisation par jour, entre 6 h et 18 h.' },
    heures_nuit: { type: 'number', description: 'Heures d’utilisation par nuit, entre 18 h et 6 h.' },
  },
  required: ['nom', 'puissance_w', 'quantite', 'heures_jour', 'heures_nuit'],
  additionalProperties: false,
};

export const OUTILS_AGENT = [
  {
    name: 'chercher_appareils',
    description: 'Cherche des appareils dans le catalogue de BESTA SOLAR et renvoie leur puissance habituelle (W) et leurs heures d’utilisation typiques. À utiliser avant de supposer la puissance d’un appareil.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        requete: { type: 'string', description: 'Mot-clé, ex. « frigo », « clim », « ventilateur ».' },
      },
      required: ['requete'],
      additionalProperties: false,
    },
  },
  {
    name: 'calculer_proposition',
    description: 'Dimensionne l’installation et chiffre les kits BESTA SOLAR adaptés, avec les prix exacts du devis (main-d’œuvre et ajustements compris). Donner soit la liste des appareils, soit la consommation en kWh (laisser l’autre vide ou à 0).',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        appareils: { type: 'array', items: appareil, description: 'Appareils du client ; liste vide si la consommation est donnée en kWh.' },
        conso_jour_kwh: { type: 'number', description: 'Consommation de jour en kWh, si connue ; sinon 0.' },
        conso_nuit_kwh: { type: 'number', description: 'Consommation de nuit en kWh, si connue ; sinon 0.' },
        ville: { type: 'string', description: 'Ville du chantier, ex. « Lomé », « Cotonou ».' },
        telephone: { type: 'string', description: 'Téléphone du client s’il est déjà connu, sinon chaîne vide.' },
        type_systeme: { type: 'string', enum: ['off-grid', 'hybrid', 'on-grid'] },
        support: { type: 'string', enum: ['tole', 'dalle', 'sol'], description: 'Toiture : tôle, dalle, ou pose au sol.' },
      },
      required: ['appareils', 'conso_jour_kwh', 'conso_nuit_kwh', 'ville', 'telephone', 'type_systeme', 'support'],
      additionalProperties: false,
    },
  },
  {
    name: 'preparer_devis',
    description: 'Prépare le devis du kit choisi par le client, pour relecture par l’équipe BESTA SOLAR. À appeler une fois le kit choisi et le nom et le téléphone du client connus.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        kit_id: { type: 'string', description: 'Identifiant du kit choisi, tel que renvoyé par calculer_proposition.' },
        client_nom: { type: 'string' },
        client_telephone: { type: 'string' },
        client_ville: { type: 'string' },
      },
      required: ['kit_id', 'client_nom', 'client_telephone', 'client_ville'],
      additionalProperties: false,
    },
  },
];

// Garde-fous de la conversation transmise au serveur : le prototype ne doit
// pas pouvoir servir de relais gratuit vers Claude.
export const LIMITES_AGENT = {
  messagesMax: 80,           // messages par conversation
  octetsMax: 200_000,        // taille de la conversation envoyée
  toursOutilsMax: 6,         // appels d'outils enchaînés pour UN message client
};

/**
 * Conversation acceptable ? Rôles user/assistant uniquement, contenu texte ou
 * blocs, premier message du client, taille bornée.
 * @returns {string|null} motif du refus, ou null si elle est valide
 */
export function validerConversation(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return 'conversation vide';
  if (messages.length > LIMITES_AGENT.messagesMax) return 'conversation trop longue';
  if (JSON.stringify(messages).length > LIMITES_AGENT.octetsMax) return 'conversation trop volumineuse';
  if (messages[0]?.role !== 'user') return 'le premier message doit venir du client';
  for (const m of messages) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return 'rôle de message inconnu';
    if (typeof m.content !== 'string' && !Array.isArray(m.content)) return 'contenu de message invalide';
  }
  return null;
}
