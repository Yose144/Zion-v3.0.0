'use client';

import { LanguageMenu } from '../../../shared/ui/LanguageMenu';
import { useLang } from '@/contexts/LanguageContext';

export default function LanguageSwitcher(_props: { variant?: 'zion' | 'rasta' }) {
  const { lang, setLang } = useLang();
  return <LanguageMenu lang={lang} setLang={setLang} />;
}
