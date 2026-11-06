'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import type { Locale } from '@zion/contract';
import { LOCALE_COOKIE } from '@/core/locale';

/**
 * Jediné klientské tlačítko v Místnosti. Jazyk je cookie, texty se
 * překládají na serveru — do prohlížeče nejde žádný slovník.
 */
export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    const host = location.hostname;
    const domain =
      host === 'zionterranova.com' || host.endsWith('.zionterranova.com')
        ? '; domain=.zionterranova.com'
        : '';
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax${domain}`;
    try {
      localStorage.setItem('zion-lang', next);
    } catch {
      /* private mode */
    }
    startTransition(() => router.refresh());
  }

  const short: Record<Locale, string> = { cs: 'CZ', en: 'EN', es: 'ES', pt: 'PT', fr: 'FR' };

  return (
    <div className="k-row" style={{ gap: 4, flexWrap: 'wrap' }} data-pending={pending}>
      {(['cs', 'en', 'es', 'pt', 'fr'] as const).map((code) => (
        <button
          key={code}
          type="button"
          className="k-ghost"
          onClick={() => choose(code)}
          aria-pressed={code === locale}
          style={
            code === locale
              ? { color: 'var(--k-text)', borderColor: 'var(--k-accent)' }
              : undefined
          }
        >
          {short[code]}
        </button>
      ))}
    </div>
  );
}
