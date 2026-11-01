import type { EndpointSpec, LocalizedText } from '@zion/contract';

/**
 * Obsah Brány.
 *
 * Texty jsou harvest z `apps/IntroPage` (maintenance.html + intro-tabs.js i18n),
 * přepsané do typovaného tvaru. Obsah je data, ne JSX — díky tomu se dá
 * překládat, testovat a jednou přesunout do CMS bez přepisování komponent.
 */

export const gateReads = {
  chain: {
    id: 'gate-chain-stats',
    service: 'chain',
    path: '/api/blockchain/stats',
    cache: 20,
  } satisfies EndpointSpec,
  pool: {
    id: 'gate-pool-coins',
    service: 'pool',
    path: '/public/v1/coins',
    cache: 30,
  } satisfies EndpointSpec,
} as const;

export const hero = {
  line: { cs: 'TERRA NOVA ∞ OASIS', en: 'TERRA NOVA ∞ OASIS' } satisfies LocalizedText,
  lead: {
    cs: 'Multichain Dharma ekosystém',
    en: 'Multichain Dharma Ecosystem',
  } satisfies LocalizedText,
  note: {
    cs: 'Oficiální veřejný launch: odložen (TBD)',
    en: 'Official public launch: postponed (TBD)',
  } satisfies LocalizedText,
};

/** „Co je ZION" — tři odstavce z původního Intra. `**text**` = zvýraznění. */
export const intro: LocalizedText[] = [
  {
    cs: 'ZION je multichain ekosystém, který se dá ověřit, ne jen slíbit. Nový blok každých ~60 sekund, nativní Rust Proof-of-Work, otevřený kód a fee split zapsaný přímo v pravidlech sítě.',
    en: 'ZION is a multichain ecosystem you can verify, not just promise. A new block every ~60 seconds, native Rust Proof-of-Work, open source code and a fee split written directly into the network rules.',
  },
  {
    cs: 'Každý blok automaticky dělí odměnu: **89 % těžaři, 5 % humanitárnímu fondu, 5 % fondu budoucnosti, 1 % se spálí**. Není to slib firmy — je to matematika ověřitelná v blockchainu.',
    en: 'Every block automatically splits the reward: **89 % to miners, 5 % to the humanitarian fund, 5 % to the future fund, 1 % is burned**. It is not a company promise — it is mathematics verifiable on the blockchain.',
  },
  {
    cs: 'Žádné ICO, žádný předprodej, žádné tajné alokace. Kdo chce ZION, těží ho, provozuje uzel, nebo ho získá na tržišti a v DeFi.',
    en: 'No ICO, no presale, no secret allocations. Whoever wants ZION mines it, runs a node, or gets it on the market and in DeFi.',
  },
];

export interface PathCard {
  id: string;
  index: string;
  title: LocalizedText;
  body: LocalizedText;
  href: string;
  cta: LocalizedText;
}

/** „Tři cesty na palubu" — pozorovatel / hráč / stavitel. */
export const paths: PathCard[] = [
  {
    id: 'observer',
    index: '01',
    title: { cs: 'Pozorovatel', en: 'Observer' },
    body: {
      cs: 'Nic neinstaluj. Podívej se na živou síť v **exploreru**, prolistuj kód na **GitHubu** a přečti si whitepaper.',
      en: 'Install nothing. Look at the live network in the **explorer**, browse the code on **GitHub** and read the whitepaper.',
    },
    href: 'https://app.zionterranova.com/explorer',
    cta: { cs: 'Otevřít explorer', en: 'Open explorer' },
  },
  {
    id: 'player',
    index: '02',
    title: { cs: 'Hráč', en: 'Player' },
    body: {
      cs: 'Vstup do prvního světa OASIS. Vyber si avatara, projdi questy, sbírej XP za skutečné činy a postupuj od CL1 až po CL9 *On The Star*.',
      en: 'Enter the first OASIS world. Choose an avatar, complete quests, collect XP for real actions and progress from CL1 all the way to CL9 *On The Star*.',
    },
    href: '/room',
    cta: { cs: 'Vejdi do Místnosti', en: 'Enter the Room' },
  },
  {
    id: 'builder',
    index: '03',
    title: { cs: 'Stavitel', en: 'Builder' },
    body: {
      cs: 'Tvůj počítač může nést kus mostu. Stáhni **miner**, vytvoř peněženku a spusť uzel nebo těžbu — jedna binárka, interaktivní menu, GPU + CPU Boost.',
      en: 'Your computer can carry a piece of the bridge. Download the **miner**, create a wallet and run a node or mining — one binary, interactive menu, GPU + CPU Boost.',
    },
    href: 'https://app.zionterranova.com/download',
    cta: { cs: 'Stáhnout miner', en: 'Download miner' },
  },
];

export interface LayerRow {
  id: string;
  code: string;
  title: LocalizedText;
  body: LocalizedText;
  href: string;
}

/** Vrstvy ekosystému jako rozcestník — kam z Brány vejít. */
export const layers: LayerRow[] = [
  {
    id: 'l1',
    code: 'L1',
    title: { cs: 'Řetěz', en: 'Chain' },
    body: {
      cs: 'Konsensus, emise a fee split 89/5/5/1 zapsaný v protokolu.',
      en: 'Consensus, emission and the 89/5/5/1 fee split written into the protocol.',
    },
    href: '/portal/chain',
  },
  {
    id: 'l2',
    code: 'L2',
    title: { cs: 'Multichain', en: 'Multichain' },
    body: {
      cs: 'WARP, bridge, DAO a DEX nad Base mainnetem.',
      en: 'WARP, bridge, DAO and DEX on Base mainnet.',
    },
    href: 'https://app.zionterranova.com/network',
  },
  {
    id: 'l3',
    code: 'L3',
    title: { cs: 'Hiran', en: 'Hiran' },
    body: {
      cs: 'AI vrstva — Maestro, inference a nástroje.',
      en: 'AI layer — Maestro, inference and tools.',
    },
    href: 'https://app.zionterranova.com/ai-native',
  },
  {
    id: 'l4',
    code: 'L4',
    title: { cs: 'OASIS', en: 'OASIS' },
    body: {
      cs: 'Světy, avataři a questy. Nirvana je první z nich.',
      en: 'Worlds, avatars and quests. Nirvana is the first.',
    },
    href: '/room',
  },
  {
    id: 'l5',
    code: 'L5',
    title: { cs: 'Free World', en: 'Free World' },
    body: {
      cs: 'Humanitární fond a fyzické komunity na pěti kontinentech.',
      en: 'Humanitarian fund and physical communities on five continents.',
    },
    href: 'https://freeworld.zionterranova.com',
  },
  {
    id: 'l6',
    code: 'L6',
    title: { cs: 'Issobella', en: 'Issobella' },
    body: {
      cs: 'Orbitální stanice, DeSci papers a on-chain kotvy.',
      en: 'Orbital stations, DeSci papers and on-chain anchors.',
    },
    href: 'https://app.zionterranova.com/l6-issobella',
  },
];

export const footerLinks = [
  { key: 'github', href: 'https://github.com/Zion-TerraNova/' },
  { key: 'docs', href: 'https://app.zionterranova.com/whitepapers' },
  { key: 'market', href: 'https://market.zionterranova.com' },
  { key: 'pool', href: 'https://pool.zionterranova.com' },
] as const;
