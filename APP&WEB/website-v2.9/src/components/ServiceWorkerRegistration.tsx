'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .getRegistrations()
      .then(async (registrations) => {
        if (registrations.length === 0) return;

        // Prevent reload loops: only force a reload once per session/tab.
        let alreadyCleared = false;
        try {
          alreadyCleared = sessionStorage.getItem('zion-sw-cleared') === '1';
        } catch { /* privacy mode */ }

        if (alreadyCleared) {
          for (const registration of registrations) {
            await registration.unregister();
          }
          return;
        }

        try {
          sessionStorage.setItem('zion-sw-cleared', '1');
        } catch { /* privacy mode */ }

        for (const registration of registrations) {
          await registration.unregister();
        }

        if (typeof caches !== 'undefined') {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }

        // Hard reload to guarantee the next paint is not served by a stale SW.
        window.location.reload();
      })
      .catch((err) => console.error('SW cleanup failed:', err));
  }, []);

  return null;
}
