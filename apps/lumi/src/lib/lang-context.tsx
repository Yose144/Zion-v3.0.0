'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { isLang, type Lang } from '@/lib/i18n';

const STORAGE_KEY = 'lumi_lang';
const COOKIE = 'lumi_lang';
/** Událost pro změnu jazyka v tom samém tabu (`storage` chodí jen mezi taby). */
const CHANGE_EVENT = 'lumi:langchange';

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

function readLang(): Lang {
  if (typeof window === 'undefined') return 'cs';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    /* soukromý režim */
  }
  return readCookie() ?? 'cs';
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Server nezná uloženou volbu, takže první render je vždy `cs`
  // (`getServerSnapshot`). Po hydrataci se `useSyncExternalStore` zeptá
  // prohlížeče — bez efektu a bez zbytečného překreslení navíc.
  const lang = useSyncExternalStore(subscribe, readLang, () => 'cs' as Lang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    if (!isLang(next)) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    document.cookie = `${COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang(): LanguageContextValue {
  return useContext(LanguageContext);
}
