export const dynamic = 'force-dynamic';

const KILL_SWITCH_JS = `/* Service worker kill-switch — immediately clears caches, claims clients, and unregisters. */

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

// Pass every request straight to the network until activation/unregistration completes.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
`;

export async function GET() {
  return new Response(KILL_SWITCH_JS, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=UTF-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
