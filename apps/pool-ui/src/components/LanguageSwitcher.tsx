'use client';

import { Globe } from 'lucide-react';
import { useLang } from '@/lib/i18n';

// Same engine as MarketPlace LanguageSwitcher: single pill toggling cs↔en,
// shared .rasta-lang-switch styles from apps/shared/ui/rasta-nav.css.
export default function LanguageSwitcher() {
  const { lang, setLang, t } = useLang();
  const label = t('Přepnout do angličtiny', 'Switch to Czech');

  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'cs' ? 'en' : 'cs')}
      className="rasta-lang-switch"
      title={label}
      aria-label={label}
    >
      <Globe aria-hidden />
      <span>{lang === 'cs' ? 'CS' : 'EN'}</span>
    </button>
  );
}
