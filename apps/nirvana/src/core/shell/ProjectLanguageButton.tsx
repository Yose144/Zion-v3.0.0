'use client';

import { LANG_NAMES, langLabel, nextLang, useI18n } from '@/core/i18n';

export function ProjectLanguageButton() {
  const { lang, cycleLang } = useI18n();
  const next = nextLang(lang);
  return <button
    type="button"
    className="present-back"
    aria-label={`Přepnout do jazyka: ${LANG_NAMES[next]}`}
    onClick={cycleLang}
  >
    {langLabel(next)}
  </button>;
}
