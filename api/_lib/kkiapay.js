// Interrogation de l'API KkiaPay — CÔTÉ SERVEUR EXCLUSIVEMENT.
// Ce fichier manipule la clé privée et la clé secrète : il ne doit jamais
// être importé depuis src/ (le bundle du navigateur les exposerait à tous).
//
// Contrat repris du SDK officiel @kkiapay-org/nodejs-sdk :
//   POST {base}/api/v1/transactions/status   body { transactionId }
//   en-têtes x-api-key (publique), x-private-key, x-secret-key

const BASES = {
  sandbox: 'https://api-sandbox.kkiapay.me',
  live: 'https://api.kkiapay.me',
};

/** Clés lues dans l'environnement Vercel. Rien n'est codé en dur. */
export const clesKkiapay = () => ({
  publique: process.env.KKIAPAY_PUBLIC_KEY || process.env.VITE_KKIAPAY_PUBLIC_KEY || '',
  privee: process.env.KKIAPAY_PRIVATE_KEY || '',
  secrete: process.env.KKIAPAY_SECRET || '',
});

/** Toutes les clés nécessaires sont-elles présentes ? */
export const clesCompletes = (c = clesKkiapay()) => !!(c.publique && c.privee && c.secrete);

/**
 * Statut réel d'une transaction, tel que l'agrégateur le connaît.
 * @param {string} transactionId
 * @param {{sandbox?: boolean}} options
 * @returns {Promise<object>} réponse brute (status, amount, currency…)
 * @throws si les clés manquent ou si l'agrégateur ne répond pas
 */
export async function statutTransaction(transactionId, { sandbox = true } = {}) {
  const cles = clesKkiapay();
  if (!clesCompletes(cles)) {
    throw new Error('Clés KkiaPay serveur absentes (KKIAPAY_PRIVATE_KEY, KKIAPAY_SECRET).');
  }
  const res = await fetch(`${BASES[sandbox ? 'sandbox' : 'live']}/api/v1/transactions/status`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cles.publique,
      'x-private-key': cles.privee,
      'x-secret-key': cles.secrete,
    },
    body: JSON.stringify({ transactionId }),
  });
  // Une transaction inconnue renvoie une erreur HTTP : ce n'est pas un
  // incident technique, c'est un « non » — il doit remonter tel quel.
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`KkiaPay ${res.status}${detail ? ` — ${detail.slice(0, 200)}` : ''}`);
  }
  return res.json();
}
