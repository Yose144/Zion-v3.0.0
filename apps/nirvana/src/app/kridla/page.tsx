'use client';

/**
 * Stará adresa světa — `Křídla` se od 2026-11-05 jmenuje **Lumi**.
 *
 * Routa zůstává jen jako přesměrování: kdyby měl někdo odkaz v historii
 * nebo v chatu, nemá skončit na 404. `replace` (ne `push`), aby se stará
 * adresa nevrátila tlačítkem Zpět.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function KridlaRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/lumi');
  }, [router]);
  return null;
}
