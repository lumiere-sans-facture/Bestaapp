// Agrégateurs de paiement configurables depuis l'espace gérant.
// Logique pure, sans React ni réseau.
//
// RÈGLE ABSOLUE, tenue par ce module : seules des valeurs PUBLIQUES vivent
// ici. Tout ce qui est saisi dans l'app finit dans localStorage puis, par
// réplication, dans Supabase — lisible par tout membre de l'organisation.
// Une clé privée ou secrète y serait donc exposée, alors qu'elle autorise
// remboursements et versements. Elle reste côté serveur, en variable
// d'environnement Vercel : ce module se contente d'en rappeler le nom.

/**
 * Agrégateurs connus. `pret` distingue ceux dont l'encaissement est réellement
 * branché de ceux qui sont seulement configurables — mentir sur ce point
 * ferait croire à un paiement qui n'arriverait jamais.
 */
export const PROVIDERS = [
  {
    id: 'kkiapay',
    nom: 'KkiaPay',
    zone: 'Bénin, Togo, Côte d’Ivoire, Sénégal',
    integration: 'Widget dans l’app',
    pret: true,
    // Champs PUBLICS, saisis dans l'app et répliqués.
    champs: [{ cle: 'publicKey', label: 'Clé publique', exemple: 'ex. 1a2b3c4d-…' }],
    // Variables d'environnement SERVEUR — jamais saisies dans l'app.
    secrets: ['KKIAPAY_PRIVATE_KEY', 'KKIAPAY_SECRET'],
  },
  {
    id: 'cinetpay',
    nom: 'CinetPay',
    zone: 'Afrique de l’Ouest et Centrale',
    integration: 'Redirection (à brancher)',
    pret: false,
    champs: [{ cle: 'siteId', label: 'Site ID', exemple: 'ex. 5872314' }],
    secrets: ['CINETPAY_API_KEY'],
  },
  {
    id: 'fedapay',
    nom: 'FedaPay',
    zone: 'Bénin, Togo, Côte d’Ivoire, Sénégal, Niger',
    integration: 'Redirection (à brancher)',
    pret: false,
    champs: [{ cle: 'publicKey', label: 'Clé publique', exemple: 'ex. pk_live_…' }],
    secrets: ['FEDAPAY_SECRET_KEY'],
  },
];

export const providerById = (id) => PROVIDERS.find((p) => p.id === id) || null;

export const MODES = [['test', 'Test (bac à sable)'], ['live', 'Réel (production)']];
export const MODE_LABEL = Object.fromEntries(MODES);

// Marqueurs d'une clé qui n'a RIEN à faire dans l'app. Ils ne couvrent pas
// tous les agrégateurs — KkiaPay délivre des clés publiques et privées de
// forme identique — mais ils attrapent les cas les plus courants, et une
// alerte tardive vaut mieux qu'un secret répliqué.
const MOTIFS_SECRET = [/^sk_/i, /^wsk_/i, /^tk_/i, /secret/i, /private/i, /priv[ée]e/i];

/** Cette valeur ressemble-t-elle à une clé secrète ou privée ? */
export const ressembleAUnSecret = (valeur) => {
  const v = String(valeur || '').trim();
  return !!v && MOTIFS_SECRET.some((m) => m.test(v));
};

/**
 * Ce qui empêche d'enregistrer cette configuration, en français, ou null.
 * @param {{provider?: string, mode?: string, champs?: object}} config
 */
export const problemeConfig = (config) => {
  const provider = providerById(config?.provider);
  if (!provider) return 'Choisissez un agrégateur de paiement.';
  for (const champ of provider.champs) {
    const valeur = String(config?.champs?.[champ.cle] || '').trim();
    if (!valeur) return `Renseignez « ${champ.label} » (${provider.nom}).`;
    if (ressembleAUnSecret(valeur))
      return `Cette valeur ressemble à une clé SECRÈTE. Seule la clé publique se saisit ici — une clé secrète doit rester sur le serveur.`;
  }
  if (config.mode !== 'test' && config.mode !== 'live') return 'Choisissez le mode test ou réel.';
  return null;
};

/** Affichage tronqué d'une clé publique : lisible, sans étaler la valeur. */
export const masquerCle = (valeur) => {
  const v = String(valeur || '').trim();
  if (!v) return '';
  if (v.length <= 8) return v;
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
};

/**
 * Configuration à utiliser pour encaisser : l'unique entrée activée.
 * Deux agrégateurs actifs en même temps n'ont pas de sens (un paiement part
 * chez un seul) : la plus récemment modifiée gagne, faute de mieux.
 */
export const configActive = (configs = []) => {
  const actives = (configs || []).filter((c) => c?.actif);
  if (!actives.length) return null;
  return actives.slice().sort((a, b) =>
    String(b.majLe || '').localeCompare(String(a.majLe || '')))[0];
};

/** Valeur d'un champ public de la config active (ex. la clé publique KkiaPay). */
export const champConfig = (config, cle) => String(config?.champs?.[cle] || '').trim();
