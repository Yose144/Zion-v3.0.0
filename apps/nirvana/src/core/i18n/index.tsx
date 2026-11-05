'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Jazyky Nirvany. Pořadí je zároveň pořadím přepínače (CS → EN → ES).
 *
 * Třetí jazyk (L-10) je **španělština**: nejvyšší krypto adopce v LatAm
 * a jediná volba, kde se potkává trh s kánonem (MariaCaminho, mariánská
 * linie). Když se přidá další, stačí ho dát sem a do `COPY` — typ `Lang`
 * pak donutí doplnit všechny texty (chybějící klíč = chyba překladu).
 */
export const LANGS: Lang[] = ['cs', 'en', 'es'];

export type Lang = 'cs' | 'en' | 'es';

/** Cyklus přepínače. Jeden zdroj pravdy — dřív to bylo natvrdo na třech místech. */
export function nextLang(lang: Lang): Lang {
  const index = LANGS.indexOf(lang);
  return LANGS[(index + 1) % LANGS.length] ?? 'cs';
}

/** Názvy pro čtečku (`aria-label` přepínače). */
export const LANG_NAMES: Record<Lang, string> = {
  cs: 'Čeština',
  en: 'English',
  es: 'Español',
};

/** Krátký štítek do tlačítka (`CS`/`EN`/`ES`). */
export function langLabel(lang: Lang): string {
  return lang.toUpperCase();
}

const STORAGE_KEY = 'nirvana.lang.v1';

/** Jazyk prohlížeče → náš jazyk. Čeština a slovenština mají přednost. */
function detectLang(): Lang {
  if (typeof navigator === 'undefined') return 'cs';
  const tag = (navigator.language || '').toLowerCase();
  if (tag.startsWith('cs') || tag.startsWith('sk')) return 'cs';
  if (tag.startsWith('es')) return 'es';
  return 'en';
}

const COPY = {
  title: { cs: 'Království srdce', en: 'Kingdom of Hearts', es: 'Reino del Corazón' },
  subtitle: { cs: 'Nová Země · jeden svět', en: 'New Earth · one world', es: 'Nueva Tierra · un mundo' },
  gate: { cs: 'Brána', en: 'Gate', es: 'Puerta' },
  gateStub: { cs: 'Brána se otevře — vstupní portál ve stavbě.', en: 'The gate is opening — the entry portal is under construction.', es: 'La puerta se abre — el portal de entrada está en construcción.' },
  gateOpening: { cs: 'Nirvana se otevírá…', en: 'Nirvana is opening…', es: 'Nirvana se está abriendo…' },
  gateTitle: { cs: 'NIRVANA — První svět', en: 'NIRVANA — The First World', es: 'NIRVANA — El Primer Mundo' },
  gateBodyLead: { cs: 'Vstup vyžaduje', en: 'Entry requires', es: 'La entrada requiere' },
  gateBodyTail: { cs: '— získáš ho ke knize Království srdce v eshopu.', en: '— it comes with the book Kingdom of Hearts in the e-shop.', es: '— viene con el libro Reino del Corazón en la tienda.' },
  gateVerifying: { cs: 'Ověřuji…', en: 'Verifying…', es: 'Verificando…' },
  gateEnter: { cs: 'Vstoupit do Nirvany', en: 'Enter Nirvana', es: 'Entrar en Nirvana' },
  gateNoPass: { cs: 'Nemáš pass?', en: 'No pass yet?', es: '¿Aún no tienes pase?' },
  gateBuyBook: { cs: 'Koupit knihu v eshopu ↗', en: 'Buy the book in the e-shop ↗', es: 'Comprar el libro en la tienda ↗' },
  gateTooMany: { cs: 'Příliš mnoho pokusů — zkus to za minutu.', en: 'Too many attempts — try again in a minute.', es: 'Demasiados intentos — prueba en un minuto.' },
  gateInvalid: { cs: 'Neplatný nebo expirovaný pass kód.', en: 'Invalid or expired pass code.', es: 'Código de pase inválido o caducado.' },
  gateVerifyFailed: { cs: 'Ověření selhalo — zkus to znovu.', en: 'Verification failed — try again.', es: 'La verificación falló — inténtalo de nuevo.' },
  close: { cs: 'Zavřít', en: 'Close', es: 'Cerrar' },
  worlds: { cs: 'světů', en: 'worlds', es: 'mundos' },
  worldsEmpty: { cs: 'Katalog světů se nepodařilo načíst. Brána zůstává.', en: 'World catalog failed to load. The gate stays.', es: 'No se pudo cargar el catálogo de mundos. La puerta permanece.' },
  layer: { cs: 'vrstva', en: 'layer', es: 'capa' },
  signedOut: { cs: 'Nepřihlášen', en: 'Signed out', es: 'Sin sesión' },
  signIn: { cs: 'Přihlásit', en: 'Sign in', es: 'Entrar' },
  signOut: { cs: 'Odhlásit', en: 'Sign out', es: 'Salir' },
  phrase: { cs: 'Dvanáct slov peněženky. Zůstanou jen v tomto okně, dokud se nepřihlásíš.', en: 'Twelve wallet words. They stay in this window until you sign in.', es: 'Doce palabras de la cartera. Solo quedan en esta ventana hasta que entres.' },
  signInFailed: { cs: 'Přihlášení se nepovedlo.', en: 'Sign-in did not succeed.', es: 'El inicio de sesión no funcionó.' },
  session: { cs: 'Session zion_session', en: 'zion_session', es: 'Sesión zion_session' },
  pool: { cs: 'Těžba', en: 'Mining', es: 'Minería' },
  poolEmpty: { cs: 'Pool API teď neodpovědělo.', en: 'The pool API did not answer.', es: 'La API del pool no respondió.' },
  miners: { cs: 'těžařů', en: 'miners', es: 'mineros' },
  loading: { cs: 'Připravuji plátno…', en: 'Preparing the canvas…', es: 'Preparando el lienzo…' },
  chainEmpty: { cs: 'Explorer teď neodpověděl.', en: 'The explorer did not answer.', es: 'El explorador no respondió.' },
  height: { cs: 'výška', en: 'height', es: 'altura' },
  peers: { cs: 'peerů', en: 'peers', es: 'pares' },
  harborEmpty: { cs: 'Free World teď neodpověděl.', en: 'Free World did not answer.', es: 'Free World no respondió.' },
  fund: { cs: 'Fond', en: 'Fund', es: 'Fondo' },
  grants: { cs: 'Otevřené granty', en: 'Open grants', es: 'Subvenciones abiertas' },
  booksEmpty: { cs: 'Knihy se nepodařilo přečíst.', en: 'The books could not be read.', es: 'No se pudieron leer los libros.' },
  marketShelf: { cs: 'Výloha: název a cena.', en: 'A shelf: name and price.', es: 'Escaparate: nombre y precio.' },
  marketEmpty: { cs: 'Trh teď neodpověděl.', en: 'The market did not answer.', es: 'El mercado no respondió.' },
  enterVr: { cs: 'Vstoupit do VR', en: 'Enter VR', es: 'Entrar en VR' },
  vrUnsupported: { cs: 'VR není na tomto zařízení dostupné.', en: 'VR is not available on this device.', es: 'VR no está disponible en este dispositivo.' },
  computeStub: { cs: 'Strojovna — zion-compute sloty (hash/care/scene). Zatím jen místo.', en: 'Engine room — zion-compute lanes (hash/care/scene). Just a place for now.', es: 'Sala de máquinas — carriles zion-compute (hash/care/scene). Por ahora solo un lugar.' },
  issobellaStub: { cs: 'Issobella — orbitální věda. Tracker se připojuje.', en: 'Issobella — orbital science. The tracker is being connected.', es: 'Issobella — ciencia orbital. El rastreador se está conectando.' },
  hiran: { cs: 'Hiran', en: 'Hiran', es: 'Hiran' },
  hiranOnline: { cs: 'online', en: 'online', es: 'en línea' },
  hiranOfflineShort: { cs: 'offline', en: 'offline', es: 'sin conexión' },
  hiranEmpty: { cs: 'Zatím nic. Zeptej se na řetěz, těžbu nebo OASIS.', en: 'Nothing yet. Ask about the chain, mining or OASIS.', es: 'Nada todavía. Pregunta por la cadena, la minería u OASIS.' },
  hiranThinking: { cs: 'Hiran přemýšlí…', en: 'Hiran is thinking…', es: 'Hiran está pensando…' },
  hiranOffline: { cs: 'Hiran teď nemluví — inferenční uzel není dostupný. Slunce svítí dál.', en: 'Hiran is not speaking right now — the inference node is unreachable. The sun keeps shining.', es: 'Hiran no habla ahora — el nodo de inferencia no está disponible. El sol sigue brillando.' },
  hiranError: { cs: 'Spojení s Hiranem selhalo. Zkus to znovu.', en: 'The connection to Hiran failed. Try again.', es: 'La conexión con Hiran falló. Inténtalo de nuevo.' },
  hiranDisclaimer: { cs: 'Informační pomocník — odpovídá na otázky, nevykonává žádné akce.', en: 'Informational helper — answers questions, performs no actions.', es: 'Ayudante informativo — responde preguntas, no realiza acciones.' },
  hiranPlaceholder: { cs: 'Napiš otázku…', en: 'Ask a question…', es: 'Escribe una pregunta…' },
  hiranSend: { cs: 'Odeslat', en: 'Send', es: 'Enviar' },
  hiranFocusSun: { cs: 'Přiblížit ke Slunci', en: 'Fly to the Sun', es: 'Volar al Sol' },
  hiranBackToEarth: { cs: 'Zpět k Zemi', en: 'Back to Earth', es: 'Volver a la Tierra' },
  chat: { cs: 'Chat', en: 'Chat', es: 'Chat' },
  chatOnline: { cs: 'online', en: 'online', es: 'en línea' },
  chatConnecting: { cs: 'připojuji…', en: 'connecting…', es: 'conectando…' },
  chatOffline: { cs: 'offline', en: 'offline', es: 'sin conexión' },
  chatEmpty: { cs: 'Zatím ticho. Napiš první zprávu.', en: 'Quiet so far. Say something.', es: 'Silencio por ahora. Escribe el primer mensaje.' },
  chatPlaceholder: { cs: 'Napiš zprávu…', en: 'Write a message…', es: 'Escribe un mensaje…' },
  chatSend: { cs: 'Odeslat', en: 'Send', es: 'Enviar' },
  chatGuest: {
    cs: 'Host může psát 1 zprávu za 4 s. Přihlas se pro jméno a avatar.',
    en: 'Guests can send 1 message per 4s. Sign in to get a name and avatar.',
    es: 'Los invitados pueden enviar 1 mensaje cada 4 s. Entra para tener nombre y avatar.',
  },
  chatGuestLink: { cs: 'Přihlásit se', en: 'Sign in', es: 'Entrar' },
} as const;

type CopyKey = keyof typeof COPY;

/**
 * Text ve více jazycích. `es` je **nepovinné** — chybějící překlad spadne
 * na angličtinu, takže jde překládat po částech a aplikace nikdy nezobrazí
 * `undefined` (což se u `Record<Lang, string>` stane snadno a tiše).
 */
export interface Localized {
  cs: string;
  en: string;
  es?: string;
}

/** Vybraný jazyk s fallbackem cs → en (nikdy neprázdno, když text existuje). */
export function tx(text: Localized | null | undefined, lang: Lang, fallback = ''): string {
  if (!text) return fallback;
  if (lang === 'es' && text.es) return text.es;
  if (lang === 'cs') return text.cs ?? text.en ?? fallback;
  return text.en ?? text.cs ?? fallback;
}

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Další jazyk v cyklu — pro tlačítko v chrome. */
  cycleLang: () => void;
  t: (key: CopyKey) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  // `cs` je výchozí pro SSR i první klientský render (jinak hydration mismatch);
  // skutečná volba se dohraje v efektu.
  const [lang, setLangState] = useState<Lang>('cs');

  useEffect(() => {
    // 1) `?lang=es` vyhraje vždy — audity a screenshoty potřebují jistotu.
    const param = new URLSearchParams(window.location.search).get('lang');
    if (param && (LANGS as string[]).includes(param)) {
      setLangState(param as Lang);
      return;
    }
    // 2) uložená volba
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (stored && (LANGS as string[]).includes(stored)) {
        setLangState(stored);
        return;
      }
    } catch {
      /* soukromý režim */
    }
    // 3) jazyk prohlížeče
    const detected = detectLang();
    if (detected !== 'cs') setLangState(detected);
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* volba prostě nepřežije reload */
    }
  }, []);

  const cycleLang = useCallback(() => setLang(nextLang(lang)), [lang, setLang]);

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang,
      cycleLang,
      t: (key) => COPY[key][lang],
    }),
    [lang, setLang, cycleLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside I18nProvider');
  return ctx;
}
