'use client';

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'lumi_theme';
/** Událost, kterou si posíláme sami — `storage` event chodí jen do jiných tabů. */
const CHANGE_EVENT = 'lumi:themechange';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
  toggle: () => {},
});

function readTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function applyTheme(next: Theme) {
  document.documentElement.dataset.theme = next;
  document.documentElement.style.colorScheme = next;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);

  // Bez uložené volby se motiv řídí systémem — když se systém přepne,
  // musíme atribut přepsat sami, jinak by `readTheme()` vrátil starou hodnotu.
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemChange = () => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      return;
    }
    applyTheme(query.matches ? 'dark' : 'light');
    onChange();
  };
  query.addEventListener('change', onSystemChange);

  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
    query.removeEventListener('change', onSystemChange);
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Zdroj pravdy je atribut na <html> — nastaví ho inline skript v layoutu
  // před paintem. `useSyncExternalStore` čte rovnou z DOM, takže po hydrataci
  // sedí ikona i přepínač bez efektu a bez cascading renderu. Na serveru
  // vrací `light`, protože systémovou volbu zná až prohlížeč.
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'light' as Theme);

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* soukromý režim */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const toggle = useCallback(() => {
    setTheme(readTheme() === 'dark' ? 'light' : 'dark');
  }, [setTheme]);

  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
