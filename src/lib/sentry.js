// Sentry — suivi des plantages avec piles d'appel lisibles.
//
// DEUX CHOIX DE CONCEPTION, tous deux dictés par le contenu de l'app (les
// clients de chaque installateur : noms, téléphones, adresses).
//
// 1. AUCUNE INSTRUMENTATION AUTOMATIQUE. Sentry sait capturer tout seul les
//    clics, les requêtes réseau et la console pour en faire un « fil
//    d'Ariane » (breadcrumbs). C'est précisément là que fuiraient les
//    données : le texte d'un bouton, l'URL d'une requête, un console.log.
//    Toutes ces intégrations sont désactivées. Sentry ne voit QUE ce que nous
//    lui donnons explicitement, après nettoyage.
//
// 2. CHARGEMENT À LA DEMANDE. Le SDK n'est téléchargé qu'au premier plantage.
//    Sur une app qui fonctionne, il ne coûte pas un octet — ce qui compte
//    quand la connexion se paie au mégaoctet.
//
// Sans VITE_SENTRY_DSN, ce module ne fait rien du tout : le journal maison
// (/api/erreur) reste seul en service.
import { dsnValide, nettoyerEvenementSentry } from '../utils/journalErreurs';

const DSN_BRUT = String(import.meta.env.VITE_SENTRY_DSN || '').trim();
// Un DSN mal collé (tronqué, avec une espace, entre guillemets) ne fait rien
// échouer : les plantages cesseraient juste d'arriver. On le refuse plutôt,
// en le disant — et sans télécharger le SDK pour rien.
const DSN = dsnValide(DSN_BRUT) ? DSN_BRUT : '';
if (DSN_BRUT && !DSN) {
  // eslint-disable-next-line no-console
  console.warn(
    '[BestaSolar] VITE_SENTRY_DSN mal formé — Sentry est désactivé. '
    + 'Attendu : https://<clé>@<organisation>.ingest.<région>.sentry.io/<projet>'
  );
}
export const sentryConfigure = () => !!DSN;

let promesse = null;

/** Charge et initialise le SDK une seule fois. */
function charger() {
  // Garde de COMPILATION : `import.meta.env.VITE_SENTRY_DSN` est remplacé par
  // sa valeur au build. Sans DSN, la condition devient constante, la suite
  // devient inatteignable, et le SDK disparaît entièrement du bundle. Tester
  // `DSN` (issu d'un appel de fonction) ne le permettrait pas : le chunk
  // serait livré même sans Sentry configuré.
  if (!import.meta.env.VITE_SENTRY_DSN) return Promise.resolve(null);
  if (!DSN) return Promise.resolve(null); // DSN présent mais mal formé
  if (promesse) return promesse;
  promesse = import('./sentryCore')
    .then((Sentry) => {
      Sentry.init({
        dsn: DSN,
        // La version fait le lien avec les source maps envoyées au build :
        // sans elle, les piles restent minifiées et illisibles.
        release: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev',
        environment: typeof __APP_ENV__ === 'string' ? __APP_ENV__ : 'test',
        // Aucune intégration par défaut : ni fil d'Ariane, ni capture
        // automatique. Nous restons la seule source d'événements.
        defaultIntegrations: false,
        integrations: [],
        // Pas de mesure de performance : elle enverrait des données en
        // continu, y compris quand tout va bien.
        tracesSampleRate: 0,
        sendDefaultPii: false,
        // Dernier rempart : même un événement inattendu repart nettoyé, et
        // sans fil d'Ariane.
        beforeSend: nettoyerEvenementSentry,
      });
      return Sentry;
    })
    .catch(() => null); // réseau coupé, bloqueur de publicité : on s'en passe
  return promesse;
}

/**
 * Transmet un plantage à Sentry.
 *
 * @param {Error|null} erreur   l'objet Error d'origine, si on l'a : sa pile
 *   est structurée, donc traduisible par les source maps. À défaut, le
 *   rapport nettoyé suffit à faire un événement.
 * @param {object} rapport      rapport déjà nettoyé (utils/journalErreurs)
 */
export async function envoyerASentry(erreur, rapport) {
  const Sentry = await charger();
  if (!Sentry) return false;
  try {
    Sentry.withScope((scope) => {
      // Identifiants internes uniquement — jamais un nom ni un téléphone.
      scope.setUser(rapport.userId ? { id: rapport.userId } : null);
      scope.setTag('code', rapport.code);
      scope.setTag('ecran', rapport.ecran || 'inconnu');
      scope.setTag('origine', rapport.origine);
      scope.setTag('appareil', rapport.appareil);
      scope.setTag('org', rapport.orgId || 'aucune');
      scope.setTag('role', rapport.role || 'aucun');
      scope.setContext('contexte', { enLigne: rapport.enLigne, survenuLe: rapport.date });
      // Le code court regroupe les occurrences du même bug — le même
      // regroupement que celui montré à l'utilisateur.
      scope.setFingerprint([rapport.code]);
      if (erreur instanceof Error) Sentry.captureException(erreur);
      else Sentry.captureMessage(rapport.message, 'error');
    });
    return true;
  } catch {
    return false;
  }
}
