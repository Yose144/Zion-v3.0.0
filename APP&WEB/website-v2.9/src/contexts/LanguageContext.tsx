'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

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
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'cs';
    try {
      const stored = window.localStorage.getItem('zion-lang') as Lang | null;
      return stored === 'cs' || stored === 'en' ? stored : 'cs';
    } catch {
      return 'cs';
    }
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('zion-lang', l); } catch {}
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
