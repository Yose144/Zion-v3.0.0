'use client';

import { LanguageMenu } from '../../../shared/ui/LanguageMenu';
import { useLang } from '@/lib/i18n';

export default function LanguageSwitcher() {
  const { lang, setLang } = useLang();
  return <LanguageMenu lang={lang} setLang={setLang} />;
}
