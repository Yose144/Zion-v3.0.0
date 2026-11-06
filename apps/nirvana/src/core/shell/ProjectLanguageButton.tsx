'use client';

import { LanguageMenu } from '../../../../shared/ui/LanguageMenu';
import { useI18n } from '@/core/i18n';

export function ProjectLanguageButton() {
  const { lang, setLang } = useI18n();
  return <LanguageMenu lang={lang} setLang={setLang} summaryClassName="present-back" />;
}
