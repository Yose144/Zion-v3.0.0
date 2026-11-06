/** Public language codes. User names: cz, en, sp → es, ptg → pt, fr. */
export const PUBLIC_LANGS = ['cs', 'en', 'es', 'pt', 'fr'] as const;

export type PublicLang = (typeof PUBLIC_LANGS)[number];

export const LANG_MENU: ReadonlyArray<{ code: PublicLang; short: string; label: string }> = [
  { code: 'cs', short: 'CZ', label: 'Čeština' },
  { code: 'en', short: 'EN', label: 'English' },
  { code: 'es', short: 'ES', label: 'Español' },
  { code: 'pt', short: 'PT', label: 'Português' },
  { code: 'fr', short: 'FR', label: 'Français' },
];

export function isPublicLang(value: unknown): value is PublicLang {
  return value === 'cs' || value === 'en' || value === 'es' || value === 'pt' || value === 'fr';
}

/** Cookie is shared across ports on localhost and across *.zionterranova.com in production. */
export function readPublicLang(): PublicLang | null {
  if (typeof document === 'undefined') return null;
  const cookie = document.cookie.match(/(?:^|; )zion_locale=([^;]+)/);
  const fromCookie = cookie ? decodeURIComponent(cookie[1]) : null;
  if (isPublicLang(fromCookie)) return fromCookie;
  try {
    const stored = localStorage.getItem('zion-lang') || localStorage.getItem('zion_lang');
    if (isPublicLang(stored)) return stored;
  } catch {
    /* private mode */
  }
  return null;
}

export function writePublicLang(lang: PublicLang) {
  try {
    localStorage.setItem('zion-lang', lang);
  } catch {
    /* private mode */
  }
  const host = typeof location !== 'undefined' ? location.hostname : '';
  const domain =
    host === 'zionterranova.com' || host.endsWith('.zionterranova.com')
      ? '; domain=.zionterranova.com'
      : '';
  document.cookie = `zion_locale=${lang}; path=/; max-age=31536000; samesite=lax${domain}`;
  window.dispatchEvent(new CustomEvent('zion-lang', { detail: lang }));
}

export function subscribePublicLang(onChange: (lang: PublicLang) => void) {
  const handler = (event: Event) => {
    const lang = (event as CustomEvent).detail;
    if (isPublicLang(lang)) onChange(lang);
  };
  window.addEventListener('zion-lang', handler);
  return () => window.removeEventListener('zion-lang', handler);
}
