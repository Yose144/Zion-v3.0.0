'use client';

import { LANG_SHORT, LANGS, type Lang } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import { cn } from '@/lib/utils';

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLang();

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border border-ink/15 bg-card/50 p-0.5',
        compact ? 'text-[11px]' : 'text-xs',
      )}
      role="group"
      aria-label="Jazyk / Language / Sprache"
    >
      {LANGS.map((code: Lang) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          data-lang={code}
          className={cn(
            'rounded-full px-2.5 py-1 font-semibold tracking-wide transition-colors',
            lang === code ? 'bg-forest text-parchment' : 'text-ink-soft hover:bg-ink/5',
          )}
        >
          {LANG_SHORT[code]}
        </button>
      ))}
    </div>
  );
}
