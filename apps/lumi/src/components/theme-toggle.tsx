'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { useLang } from '@/lib/lang-context';
import { pick } from '@/lib/i18n';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const { lang } = useLang();
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={pick(
        dark
          ? { cs: 'Přepnout na světlý motiv', en: 'Switch to light theme', de: 'Zum hellen Design wechseln' }
          : { cs: 'Přepnout na tmavý motiv', en: 'Switch to dark theme', de: 'Zum dunklen Design wechseln' },
        lang,
      )}
      title={pick({ cs: 'Světlý / tmavý motiv', en: 'Light / dark theme', de: 'Helles / dunkles Design' }, lang)}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink/15 bg-card/60 text-ink transition-colors hover:border-ink/40"
      aria-pressed={dark}
    >
      {dark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
