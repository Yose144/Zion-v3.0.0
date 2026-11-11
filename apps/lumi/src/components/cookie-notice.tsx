'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';

const KEY = 'lumi_cookie_notice';

export default function CookieNotice() {
  const { lang } = useLang();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(KEY) !== '1') setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function accept() {
    try {
      window.localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    document.cookie = `${KEY}=1; path=/; max-age=31536000; samesite=lax`;
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-3 z-[60] sm:inset-x-auto sm:bottom-5 sm:right-5 sm:max-w-md"
      role="dialog"
      aria-live="polite"
      aria-label={pick({ cs: 'Informace o cookies', en: 'Cookie notice', de: 'Cookie-Hinweis' }, lang)}
    >
      <div className="rounded-2xl border border-line bg-card p-5 shadow-warm">
        <p className="flex items-start gap-2 text-sm font-semibold text-ink">
          <Cookie className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          {pick({ cs: 'Jen technické cookies', en: 'Technical cookies only', de: 'Nur technische Cookies' }, lang)}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
          {pick(
            {
              cs: 'Používáme jen cookies pro košík, jazyk a přihlášení. Žádná reklama ani měření. Podrobnosti najdete v dokumentu Cookies.',
              en: 'We use cookies only for the cart, language and login. No advertising or analytics. Details are in our Cookie policy.',
              de: 'Wir verwenden Cookies nur für Warenkorb, Sprache und Anmeldung. Keine Werbung, keine Analyse. Details in unserer Cookie-Richtlinie.',
            },
            lang,
          )}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={accept} className="btn-primary !px-4 !py-2 text-xs">
            {pick({ cs: 'Rozumím', en: 'Got it', de: 'Verstanden' }, lang)}
          </button>
          <Link href="/cookies" className="text-xs link-underline text-ink-soft">
            {pick({ cs: 'Více o cookies', en: 'More about cookies', de: 'Mehr zu Cookies' }, lang)}
          </Link>
        </div>
      </div>
    </div>
  );
}
