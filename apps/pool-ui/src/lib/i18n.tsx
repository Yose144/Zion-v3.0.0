'use client';

// Lightweight CS/EN language context — same {cs, en} label convention
// as website-v2.9 pool components.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

export type Lang = 'cs' | 'en';

type LangCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (cs: string, en: string) => string;
};

const Ctx = createContext<LangCtx>({
  lang: 'cs',
  setLang: () => {},
  t: (cs) => cs,
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('cs');

  useEffect(() => {
    const saved = window.localStorage.getItem('pool-lang');
    if (saved === 'cs' || saved === 'en') setLangState(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem('pool-lang', l);
    document.documentElement.lang = l;
  }, []);

  const t = useCallback(
    (cs: string, en: string) => (lang === 'cs' ? cs : en),
    [lang],
  );

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
