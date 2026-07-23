/* Service worker kill-switch — previous aggressive cache caused blank pages.
   This SW immediately clears all caches, claims clients, and unregisters itself. */

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
  );
});

// Until activation, pass every request straight to the network (no caching).
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
