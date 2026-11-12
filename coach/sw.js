/* Service worker for LIFT Coach.
 *
 * Caches the app shell so it opens with no connection. Bump CACHE when any
 * shell file changes, or browsers will keep serving the old one.
 */

const CACHE = 'coach-v46';

const SHELL = [
  '/coach/',
  '/coach/index.html',
  '/coach/style.css',
  '/coach/fonts/source-sans-3-latin.woff2',
  '/coach/fonts/source-sans-3-latin-ext.woff2',
  '/coach/parser.js',
  '/coach/recipe-import.js',
  '/coach/recipe-link.js',
  '/coach/appearance.js',
  '/coach/route.js',
  '/coach/nutrients.js',
  '/coach/sides.js',
  '/coach/prescriptions.js',
  '/coach/recipe-nutrition.js',
  '/coach/recipe-catalogue.js',
  '/coach/share-import.js',
  '/coach/client-removal.js',
  '/coach/road-picks.js',
  '/coach/chart-dates.js',
  '/coach/plan-log.js',
  '/coach/printout.js',
  // The street map's own script and styles are small, so they install with the
  // shell. MapLibre itself (1 MB, 276 KB on the wire) is not here: it is
  // fetched the first time a map is wanted and kept, like foods.json.
  '/coach/street-offer.js',
  '/coach/map/map.js',
  '/coach/map/style-light.json',
  '/coach/map/style-dark.json',
  '/coach/app.js',
  '/coach/foods.js',
  '/coach/exercises.json',
  // 4.7 KB, and Cook's "Send recipes from your browser" shows it, so it is in
  // the install bundle rather than fetched on first use like the big three.
  '/coach/bookmarklets.json',
  '/coach/manifest.webmanifest',
  '/coach/icon-180.png',
  '/coach/icon-192.png',
  '/coach/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// Every old shell cache goes on an update. The street map's tiles do not:
// `coach-map-tiles` holds what a coach downloaded on purpose, and losing it to
// a shell bump would mean downloading again.
function cachesToDelete(keys, current) {
  return keys.filter((k) => k !== current && !k.startsWith('coach-map-'));
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        cachesToDelete(keys, CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only ever handle our own shell.
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/coach/')) {
    return;
  }

  // The ingredient database is 634 KB, so it is not in the install bundle —
  // but it is cached the first time it is actually used, which is what makes
  // the lookup work in a gym with no signal.
  // Road Food's menus are the same story, at 37 KB: fetched the first time
  // the Road section is opened, then kept. The recipe catalogue too, at 1 MB
  // (200 KB on the wire): fetched the first time the catalogue is opened,
  // never at install, since most coaches write their own recipes and should
  // not pay for 622 they never browse. All three are cache-first, so a new
  // copy of any reaches a coach only with a CACHE bump.
  if (url.pathname === '/coach/foods.json' || url.pathname === '/coach/road-food.json'
      || url.pathname === '/coach/recipes.json') {
    event.respondWith(
      caches.match(event.request).then((hit) => hit || fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }))
    );
    return;
  }

  // The map's files (MapLibre, the CSS, the glyph ranges) are cache-first and
  // kept the first time they are used. A miss with no connection is a 404 for
  // that one file, never the app's page: MapLibre would read the page as a
  // style or a font and the map would fail in a way that looks like a bug.
  if (url.pathname.startsWith('/coach/map/')) {
    event.respondWith(
      caches.match(event.request).then((hit) => hit || fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => new Response('', { status: 404 })))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((hit) => {
      if (hit) return hit;
      return fetch(event.request).catch(() => caches.match('/coach/index.html'));
    })
  );
});
