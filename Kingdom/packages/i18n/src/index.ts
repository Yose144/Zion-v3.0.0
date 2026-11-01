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
  worlds: 'Světy OASIS',
  fund: 'Fond',
  grants: 'Granty',
  projects: 'Projekty',
  accumulated: 'Nashromážděno',
  disbursed: 'Vyplaceno',
  budget: 'Rozpočet',
  lastBlock: 'Poslední blok',
  approved: 'schváleno',
  guardians: 'Strážci',
  proposals: 'Návrhy',
  active: 'aktivní',
  circulatingSupply: 'V oběhu',
  papers: 'Papers',
  available: 'Dostupné',
  model: 'Model',
  comingSoon: 'Připravujeme',
  books: 'Knihy',
  signOut: 'Odhlásit',
  mnemonic: 'Dvanáct slov',
  mnemonicHint: 'Fráze se odvodí v prohlížeči a hned se smaže. Do sítě jde jen podpis — klíč nikam neposíláme.',
  signingIn: 'Přihlašuji…',
  primaryAddress: 'Hlavní adresa',
  displayName: 'Jméno',
  worldsLead: 'Třináct míst, která existují jako scéna — ne jako obrázek.',
  worldBack: 'Zpět do Místnosti',
  worldHint: 'Táhni pro otočení · kolečko pro přiblížení',
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
  openShop: 'Otevřít e-shop',
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
  acceptRate: 'Přijato',
  lastShare: 'Poslední share',
  openOps: 'Ovládání poolu',
  opsBehindLogin:
    'Operátorský povrch za přihlášením. Restart, drain a výplaty patří operátorovi — klient je neumí a Kingdom je nedělá.',
  openGovernance: 'Otevřít správu protokolu',
  voteNote:
    'Hlas se podepisuje peněženkou v DAO. Kingdom ho neodesílá — nedrží tvůj klíč a nezná tvůj zůstatek.',
  blocks: 'Poslední bloky',
  transactions: 'Poslední transakce',
  openExplorer: 'Otevřít eXplorer',
  explorerNote:
    'Do bloku se dá kliknout hloub, ale adresy a historii drží eXplorer. Kingdom ukazuje okno, ne celý archiv.',
  block: 'Blok',
  txs: 'transakcí',
  checkAddress: 'Najít adresu',
  addressPlaceholder: 'zion1…',
  addressHint: 'Zadej adresu a Enter. Hledá se na serveru, klíč žádný — je to jen čtení.',
  balance: 'Zůstatek',
  received: 'Přijato',
  sent: 'Odesláno',
  utxo: 'UTXO',
  pending: 'Čeká',
  history: 'Historie poolu',
  lastHour: 'poslední hodina',
  samples: 'vzorků',
} as const;

export type TranslationKey = keyof typeof cs;

const en: Record<TranslationKey, string> = {
  brand: 'Kingdom of the Heart',
  entry: 'Entry',
  enter: 'Enter',
  gateSub: 'Mainnet Beta · 3.2.0',
  roomLead: 'Portals are windows into live services. Open what you need right now.',
  roomScene: 'New Earth · Issobella ring · Gate. Click a ring to open its portal.',
  worlds: 'OASIS worlds',
  fund: 'Fund',
  grants: 'Grants',
  projects: 'Projects',
  accumulated: 'Accumulated',
  disbursed: 'Disbursed',
  budget: 'Budget',
  lastBlock: 'Last block',
  approved: 'approved',
  guardians: 'Guardians',
  proposals: 'Proposals',
  active: 'active',
  circulatingSupply: 'Circulating',
  papers: 'Papers',
  available: 'Available',
  model: 'Model',
  comingSoon: 'Coming soon',
  books: 'Books',
  signOut: 'Sign out',
  mnemonic: 'Twelve words',
  mnemonicHint: 'The phrase is derived in your browser and cleared right after. Only the signature leaves — the key never does.',
  signingIn: 'Signing in…',
  primaryAddress: 'Primary address',
  displayName: 'Name',
  worldsLead: 'Thirteen places that exist as a scene — not as an image.',
  worldBack: 'Back to the Room',
  worldHint: 'Drag to rotate · scroll to zoom',
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
  openShop: 'Open shop',
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
  acceptRate: 'Accept',
  lastShare: 'Last share',
  openOps: 'Pool operations',
  opsBehindLogin:
    'Operator surface behind a login. Restart, drain and payouts belong to the operator — a client cannot do them and Kingdom does not try.',
  openGovernance: 'Open protocol governance',
  voteNote:
    'A vote is signed by your wallet in the DAO. Kingdom does not send it — it holds no key and does not know your balance.',
  blocks: 'Latest blocks',
  transactions: 'Latest transactions',
  openExplorer: 'Open eXplorer',
  explorerNote:
    'You can dig into a block, but addresses and history live in eXplorer. Kingdom shows a window, not the whole archive.',
  block: 'Block',
  txs: 'txs',
  checkAddress: 'Look up address',
  addressPlaceholder: 'zion1…',
  addressHint: 'Type an address and press Enter. The lookup runs on the server — read only, no key.',
  balance: 'Balance',
  received: 'Received',
  sent: 'Sent',
  utxo: 'UTXOs',
  pending: 'Pending',
  history: 'Pool history',
  lastHour: 'last hour',
  samples: 'samples',
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
