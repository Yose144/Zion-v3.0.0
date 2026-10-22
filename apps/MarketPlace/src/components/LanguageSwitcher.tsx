'use client';

import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher({ variant = 'zion' }: { variant?: 'zion' | 'rasta' } = {}) {
  const { lang, setLang } = useLang();
  const isRasta = variant === 'rasta';

  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'cs' ? 'en' : 'cs')}
      className={isRasta ? 'rasta-lang-switch' : 'inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/75 px-2 py-1.5 text-[10px] font-semibold text-gray-300 transition-all hover:border-white/30 hover:bg-black hover:text-white'}
      title={lang === 'cs' ? tr('nav', 'switchToEnglish', lang) : tr('nav', 'switchToCzech', lang)}
      aria-label={lang === 'cs' ? tr('nav', 'switchToEnglish', lang) : tr('nav', 'switchToCzech', lang)}
    >
      <Globe className="w-3.5 h-3.5 text-rasta-gold" />
      <span>{lang === 'cs' ? tr('nav', 'langCs', lang) : tr('nav', 'langEn', lang)}</span>
    </button>
  );
}
