/* Cache applicatif de BestaSolar Pro.
 *
 * Objectif : l'app doit S'OUVRIR sans réseau. Elle est « local-first » (les
 * données vivent dans le navigateur), mais sans ce cache le navigateur ne
 * pouvait même pas charger les fichiers de l'app : écran blanc dès que la
 * connexion tombait — inacceptable sur le terrain.
 *
 * Stratégie, choisie pour ne JAMAIS servir une version périmée :
 *  - navigation (index.html) : le réseau d'abord, le cache en secours.
 *    C'est ce qui garantit qu'un appareil récupère la dernière version dès
 *    qu'il a du réseau (le problème inverse — rester bloqué sur une vieille
 *    version — est tout aussi grave).
 *  - /assets/* : le cache d'abord. Ces fichiers portent un hachage dans leur
 *    nom : un contenu différent = une URL différente, donc jamais de périmé.
 *  - tout le reste (API Supabase, images externes) : non intercepté.
 */
const CACHE = 'bestasolar-v1';

self.addEventListener('install', (e) => {
  // La nouvelle version prend la main sans attendre la fermeture des onglets.
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/index.html'])).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

const enCache = async (req, reponse) => {
  if (reponse && reponse.ok && reponse.type === 'basic') {
    const c = await caches.open(CACHE);
    c.put(req, reponse.clone());
  }
  return reponse;
};

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase & co : jamais interceptés

  // Page de l'app : réseau d'abord (fraîcheur), cache en secours (hors-ligne).
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((r) => enCache(request, r))
        .catch(() => caches.match(request).then((r) => r || caches.match('/index.html')))
    );
    return;
  }

  // Fichiers hachés : cache d'abord, c'est immuable.
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(request).then((r) => r || fetch(request).then((res) => enCache(request, res)))
    );
    return;
  }

  // Reste du même domaine (icône, images du catalogue…) : réseau puis cache.
  e.respondWith(
    fetch(request)
      .then((r) => enCache(request, r))
      .catch(() => caches.match(request))
  );
});
