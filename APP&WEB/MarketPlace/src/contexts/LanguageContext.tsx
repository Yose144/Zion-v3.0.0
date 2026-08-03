'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type Lang = 'cs' | 'en';

interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'cs',
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Default to 'cs' for SSR and the first client render to avoid hydration mismatches.
  const [lang, setLangState] = useState<Lang>('cs');

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('zion-lang') as Lang | null;
      if (stored === 'cs' || stored === 'en') {
        setLangState(stored);
      }
    } catch { /* SSR or privacy mode */ }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('zion-lang', l); } catch {}
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang === 'en' ? 'en' : 'cs';
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
