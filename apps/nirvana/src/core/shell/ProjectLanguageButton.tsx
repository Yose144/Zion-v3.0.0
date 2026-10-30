'use client';

import { useI18n } from '@/core/i18n';

export function ProjectLanguageButton() {
  const { lang, setLang } = useI18n();
  return <button type="button" className="present-back" aria-label={lang === 'cs' ? 'Switch to English' : 'Přepnout do češtiny'} onClick={() => setLang(lang === 'cs' ? 'en' : 'cs')}>
    {lang === 'cs' ? 'EN' : 'CS'}
  </button>;
}
