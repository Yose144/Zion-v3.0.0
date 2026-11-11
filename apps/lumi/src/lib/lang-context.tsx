'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isLang, type Lang } from '@/lib/i18n';

const STORAGE_KEY = 'lumi_lang';
const COOKIE = 'lumi_lang';

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageContextValue>({ lang: 'cs', setLang: () => {} });

function readCookie(): Lang | null {
  if (typeof document === 'undefined') return null;
  const hit = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`));
  const value = hit?.split('=')[1];
  return isLang(value) ? value : null;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // SSR i první klientský render musí být shodné (hydratace) — proto výchozí
  // 'cs' a skutečný jazyk až v efektu.
  const [lang, setLangState] = useState<Lang>('cs');

  useEffect(() => {
    let next: Lang | null = null;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isLang(stored)) next = stored;
    } catch {
      /* soukromý režim */
    }
    if (!next) next = readCookie();
    if (next && next !== lang) setLangState(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    if (!isLang(next)) return;
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    document.cookie = `${COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang(): LanguageContextValue {
  return useContext(LanguageContext);
}
