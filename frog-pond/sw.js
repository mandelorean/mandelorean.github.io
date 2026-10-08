// Frog Pond service worker.
// App files are fetched from the network first so a Home Screen app always gets the latest
// version when online, and fall back to the cached copy when offline. It never touches
// localStorage, where the frog and progress live.
const VERSION = '2026-10-08.1'; // keep in step with version.json and app.js (bump-version.sh does all three)
const CACHE = 'frogpond-' + VERSION;
const CORE = ['./', './index.html', './app.css', './app.js', './sound.js', './learn.js', './frog-engine.js', './three.min.js', './manifest.json', './icon-192.png', './icon-512.png'];
const NETWORK_TIMEOUT = 4000; // on a very slow connection, use the cached copy rather than wait

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('frogpond') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function fromNetwork(req) {
  // navigations can't be re-created with options, so fetch them by URL
  const p = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(req, { cache: 'no-cache' });
  return p.then(res => {
    if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req.mode === 'navigate' ? './index.html' : req, cp)); }
    return res;
  });
}
function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
}
function networkFirst(req) {
  return new Promise(resolve => {
    let settled = false;
    const done = r => { if (!settled && r) { settled = true; resolve(r); } };
    const timer = setTimeout(() => fromCache(req).then(done), NETWORK_TIMEOUT);
    fromNetwork(req)
      .then(res => { clearTimeout(timer); if (res && res.ok) done(res); else fromCache(req).then(hit => done(hit || res)); })
      .catch(() => { clearTimeout(timer); fromCache(req).then(hit => done(hit || Response.error())); });
  });
}
function staleWhileRevalidate(req) {
  return caches.match(req).then(hit => {
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return res; }).catch(() => hit);
    return hit || net;
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname.endsWith('/version.json')) return; // always straight to the network
    e.respondWith(networkFirst(req));
  } else {
    if (url.hostname === 'api.open-meteo.com') return; // live weather, never from the cache
    if (/(^|\.)(googletagmanager|google-analytics)\.com$/.test(url.hostname) || url.hostname.endsWith('.g.doubleclick.net')) return; // analytics: leave to the browser
    e.respondWith(staleWhileRevalidate(req)); // Google Fonts: cached is fine, they never change
  }
});
