'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'cs' | 'en';

const COPY = {
  title: { cs: 'Nirvana', en: 'Nirvana' },
  subtitle: { cs: 'jeden svět', en: 'one world' },
  gate: { cs: 'Brána těžby', en: 'Mining gate' },
  close: { cs: 'Zavřít', en: 'Close' },
  worlds: { cs: 'světů', en: 'worlds' },
  worldsEmpty: { cs: 'Katalog světů se nepodařilo načíst. Brána zůstává.', en: 'World catalog failed to load. The gate stays.' },
  layer: { cs: 'vrstva', en: 'layer' },
  signedOut: { cs: 'Nepřihlášen', en: 'Signed out' },
  signIn: { cs: 'Přihlásit', en: 'Sign in' },
  signOut: { cs: 'Odhlásit', en: 'Sign out' },
  phrase: { cs: 'Dvanáct slov peněženky. Zůstanou jen v tomto okně, dokud se nepřihlásíš.', en: 'Twelve wallet words. They stay in this window until you sign in.' },
  signInFailed: { cs: 'Přihlášení se nepovedlo.', en: 'Sign-in did not succeed.' },
  session: { cs: 'Session zion_session', en: 'zion_session' },
  pool: { cs: 'Těžba', en: 'Mining' },
  poolEmpty: { cs: 'Pool API teď neodpovědělo.', en: 'The pool API did not answer.' },
  miners: { cs: 'těžařů', en: 'miners' },
  loading: { cs: 'Připravuji plátno…', en: 'Preparing the canvas…' },
  chainEmpty: { cs: 'Explorer teď neodpověděl.', en: 'The explorer did not answer.' },
  height: { cs: 'výška', en: 'height' },
  peers: { cs: 'peerů', en: 'peers' },
  harborEmpty: { cs: 'Free World teď neodpověděl.', en: 'Free World did not answer.' },
  fund: { cs: 'Fond', en: 'Fund' },
  grants: { cs: 'Otevřené granty', en: 'Open grants' },
  booksEmpty: { cs: 'Knihy se nepodařilo přečíst.', en: 'The books could not be read.' },
  marketShelf: { cs: 'Výloha: název a cena.', en: 'A shelf: name and price.' },
  marketEmpty: { cs: 'Trh teď neodpověděl.', en: 'The market did not answer.' },
} as const;

type CopyKey = keyof typeof COPY;

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: CopyKey) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('cs');
  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      t: (key) => COPY[key][lang],
    }),
    [lang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside I18nProvider');
  return ctx;
}
