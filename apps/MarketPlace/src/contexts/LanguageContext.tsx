'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import {
  isPublicLang,
  readPublicLang,
  writePublicLang,
  type PublicLang,
} from '../../../shared/i18n/persist';

export type Lang = PublicLang;

interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'cs',
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('cs');

  useEffect(() => {
    const stored = readPublicLang();
    if (stored) setLangState(stored);
  }, []);

  const setLang = (l: Lang) => {
    if (!isPublicLang(l)) return;
    setLangState(l);
    writePublicLang(l);
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang;
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
