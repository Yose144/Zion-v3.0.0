'use client';

import { useLang, type Lang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';

export function useT() {
  const { lang } = useLang();

  return (path: string, params?: Record<string, string | number>): string => {
    const [section, key] = path.split('.');
    if (!section || !key) return path;
    return tr(section, key, lang, params);
  };
}

export function useLangT() {
  const { lang, setLang } = useLang();

  const t = (path: string, params?: Record<string, string | number>): string => {
    const [section, key] = path.split('.');
    if (!section || !key) return path;
    return tr(section, key, lang, params);
  };

  return { lang, setLang, t };
}
