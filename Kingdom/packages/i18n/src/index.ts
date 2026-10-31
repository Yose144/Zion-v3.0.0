import type { Locale } from '@zion/contract';

/**
 * @zion/i18n — jediná implementace překladů.
 *
 * Server-first: texty se překládají při renderu na serveru, do prohlížeče
 * nejde žádný slovník. Když bude potřeba klientský text, přidá se hook
 * do tohohle balíčku — ne vedle něj.
 */

const cs = {
  brand: 'Království srdce',
  entry: 'Vstup',
  enter: 'Vejdi dovnitř',
  gateSub: 'Mainnet Beta · 3.2.0',
  roomLead: 'Portály jsou okna do živých služeb. Otevři to, co právě potřebuješ.',
  roomScene: 'Nová Země · prstenec Issobelly · Brána. Klikni na prstenec a otevře se portál.',
  gateWhy: 'Co je ZION',
  gatePaths: 'Tři cesty na palubu',
  gateLayers: 'Vrstvy ekosystému',
  gateLive: 'Živá síť',
  gateVerify: 'Ověřitelné, ne slíbené. Tohle jsou čísla z hlavního uzlu právě teď.',
  gatePreview: 'OASIS preview',
  gateExplorer: 'eXplorer',
  blockTime: 'Block time',
  github: 'GitHub',
  market: 'Trh',
  pool: 'Pool',
  room: 'Místnost',
  gate: 'Brána',
  portals: 'Portály',
  open: 'Otevřít',
  back: 'Zpět do Místnosti',
  loading: 'Načítám…',
  unavailable: 'Data teď nejsou dostupná',
  noData: 'Zatím žádná data',
  layer: 'Vrstva',
  source: 'Zdroj',
  live: 'živé',
  placeholder: 'připravujeme',
  docs: 'Knihovna',
  ops: 'Dashboard',
  language: 'Jazyk',
  signedOut: 'Nepřihlášen',
  signedIn: 'Přihlášen',
  signIn: 'Přihlásit se',
  chainTitle: 'Řetěz',
  poolTitle: 'Kovárna',
  marketTitle: 'Tržiště',
  height: 'Výška',
  difficulty: 'Obtížnost',
  peers: 'Peers',
  mempool: 'Mempool',
  coins: 'Mince',
  miners: 'Těžaři',
  hashrate: 'Hashrate',
  products: 'Produkty',
  payout: 'Výplata',
  connected: 'připojeno',
  inStock: 'skladem',
  price: 'Cena',
} as const;

export type TranslationKey = keyof typeof cs;

const en: Record<TranslationKey, string> = {
  brand: 'Kingdom of the Heart',
  entry: 'Entry',
  enter: 'Enter',
  gateSub: 'Mainnet Beta · 3.2.0',
  roomLead: 'Portals are windows into live services. Open what you need right now.',
  roomScene: 'New Earth · Issobella ring · Gate. Click a ring to open its portal.',
  gateWhy: 'What ZION is',
  gatePaths: 'Three ways on board',
  gateLayers: 'Ecosystem layers',
  gateLive: 'Live network',
  gateVerify: 'Verifiable, not promised. These are numbers from the primary node right now.',
  gatePreview: 'OASIS preview',
  gateExplorer: 'eXplorer',
  blockTime: 'Block time',
  github: 'GitHub',
  market: 'Market',
  pool: 'Pool',
  room: 'Room',
  gate: 'Gate',
  portals: 'Portals',
  open: 'Open',
  back: 'Back to the Room',
  loading: 'Loading…',
  unavailable: 'Data is not available right now',
  noData: 'No data yet',
  layer: 'Layer',
  source: 'Source',
  live: 'live',
  placeholder: 'in preparation',
  docs: 'Library',
  ops: 'Dashboard',
  language: 'Language',
  signedOut: 'Signed out',
  signedIn: 'Signed in',
  signIn: 'Sign in',
  chainTitle: 'Chain',
  poolTitle: 'Forge',
  marketTitle: 'Market',
  height: 'Height',
  difficulty: 'Difficulty',
  peers: 'Peers',
  mempool: 'Mempool',
  coins: 'Coins',
  miners: 'Miners',
  hashrate: 'Hashrate',
  products: 'Products',
  payout: 'Payout',
  connected: 'connected',
  inStock: 'in stock',
  price: 'Price',
};

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { cs, en };

export function resolveLocale(value: string | undefined | null): Locale {
  return value === 'en' ? 'en' : 'cs';
}

export function t(locale: Locale, key: TranslationKey): string {
  return dictionaries[locale][key];
}

/** Lokální tvary (tisíce, desetinná místa) bez Intl závislosti na ICU datech. */
export function fmtNumber(locale: Locale, value: number, digits = 0): string {
  const fixed = value.toFixed(digits);
  const [whole, frac] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, locale === 'cs' ? ' ' : ',');
  return frac ? `${grouped}${locale === 'cs' ? ',' : '.'}${frac}` : grouped;
}

export function fmtCompact(locale: Locale, value: number): string {
  const units: Array<[number, string]> = [
    [1e12, 'T'],
    [1e9, 'G'],
    [1e6, 'M'],
    [1e3, 'k'],
  ];
  for (const [limit, suffix] of units) {
    if (Math.abs(value) >= limit) {
      return `${fmtNumber(locale, value / limit, 1)} ${suffix}`;
    }
  }
  return fmtNumber(locale, value, 0);
}
