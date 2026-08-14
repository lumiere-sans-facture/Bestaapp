// Surface MINIMALE du SDK Sentry.
//
// Ce fichier n'existe que pour permettre l'élagage (tree-shaking). Un
// `import('@sentry/browser')` dynamique ramène le paquet ENTIER — rejeu de
// session, mesures de performance, formulaire de retour — parce que le
// bundler ne peut pas deviner quelles propriétés de l'objet importé seront
// lues. En ré-exportant statiquement les quatre seules fonctions utilisées,
// il sait au contraire exactement quoi garder.
export { init, withScope, captureException, captureMessage } from '@sentry/browser';
