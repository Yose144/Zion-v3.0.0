import type { BookChapter } from '../bookMetaPublic';

const chapter: BookChapter = {
  id: 'architektura',
  number: 'VII',
  titleCs: 'Technická Architektura L1–L4',
  titleEn: 'Technical Architecture L1–L4',
  epigraphCs: '„Kód je zákon. Zákon je kód. A oba musí sloužit životu." — ZION Mainnet Constitution',
  epigraphEn: '"Code is law. Law is code. And both must serve life." — ZION Mainnet Constitution',
  color: '#22D3EE',
  rgb: '34,211,238',
  sectionsCs: [
    {
      heading: 'L1: Cosmic Harmony Proof of Work',
      body: 'ZION blockchain je L1 PoW chain s algoritmem Ekam Deeksha — vlastním hashovacím algoritmem navrženým specificky pro ZION.\n\nCosmic Harmony v3 (CHv3): čtyřfázový algoritmus: Phase 1 — transformace vstupu přes kosmické konstanty (π, φ, √2). Phase 2 — nelineární mixing inspirovaný kvantovou mechanikou. Phase 3 — wave function simulace. Phase 4 — finální Avalanche difuze.\n\nCosmic Harmony v4 (CHv4): rozšíření o GPU-friendly variantu + ASIC-rezistentní memory-hard fázi.\n\nBlocková odměna: 5 400.067 ZION (záměrně nekupatá, symbolická). Decade Decay — odměna klesá po dekádách, nikoliv halvingem jako Bitcoin.\n\nCelkový zásobník: 144 000 000 000 ZION = 144 miliard = symbolika 144 000.',
    },
    {
      heading: 'Distribuce blokové odměny',
      body: 'Každý nalezený blok automaticky distribuuje:\n\n89% → Miner (MINER_PCT)\n5% → Humanitarian Tithe (HUMANITARIAN_PCT)\n5% → Issobella Fund (ISSOBELLA_PCT)\n1% → Pool Fee (POOL_FEE_PCT)\n\nToto rozdělení je hard-coded v Genesis. Nemůže být změněno bez hard forku — a hard fork vyžaduje konsensus sítě.\n\nHumanitarian Tithe jde automaticky do multi-sig walletu řízeného DAO. Issobella Fund jde do dedikovaného fondu pro orbitální program. Pool Fee udržuje infrastrukturu.\n\nŽádné VC, žádný premine, žádný ICO. 100% fair launch.',
    },
    {
      heading: 'UTXO model a transakční design',
      body: 'ZION používá UTXO (Unspent Transaction Output) model — stejný princip jako Bitcoin:\n\nKaždá transakce spotřebovává předchozí výstupy a vytváří nové. Žádné „účty" — jen vstupy a výstupy. Výhody: lepší soukromí (každý výstup je unikátní), paralelní validace, jednodušší audit.\n\nTransakční formát: verze, inputs (prev_tx_hash + index + signature), outputs (amount + public_key_hash), locktime. Podpisy: Ed25519 (rychlejší než ECDSA, bezpečnější proti side-channel attackům).',
    },
    {
      heading: 'L2: wZION Bridge a DeFi Stack',
      body: 'L2 přináší ZION do DeFi ekosystému:\n\nwZION Bridge: bi-directional bridge mezi ZION L1 a EVM-compatible chainy (Ethereum, Polygon, BSC). Mechanismus: lock-and-mint / burn-and-release. Multi-sig validátoři. Atomic swaps pro trustless přechod.\n\nDeFi Stack: DEX (Automated Market Maker) pro wZION/ETH, wZION/USDC páry. Staking pool — lock ZION, earn rewards. Lending protocol — půjčování a vypůjčování wZION. Yield farming — LP tokeny pro poskytovatele likvidity.\n\nDAO Governance: každý ZION holder má hlasovací právo proporcionální holdingu. Proposals, voting, execution — vše on-chain.',
    },
    {
      heading: 'L3: Neural Compute Layer + WARP',
      body: 'L3 je neuronální vrstva sítě:\n\nNCL (Neural Compute Layer): distribuovaný AI inference přes ZION nody. Miners = AI inference providers. GPU pooling pro velké modely. Odměna za inference se přičítá k mining odměně.\n\nWARP Bridge: cross-chain komunikační protokol. Propojení ZION s ostatními blockchainy na sémantické úrovni (ne jen token bridging, ale data bridging). WARP L3 = inter-blockchain AI komunikace.\n\nAI Native integrace: L3 umožňuje Hiranyagarbha systému běžet distribuovaně přes celou ZION síť. Každý node je neuron. Síť je mozek.',
    },
    {
      heading: 'L4: OASIS — Hra Života',
      body: 'OASIS je gamifikovaná vrstva ZION ekosystému:\n\nGolden Egg — centrální economic engine: 1 miliarda ZION alokována do Golden Egg poolu při Genezi. Odměny za: vzdělávání, komunitní službu, environmentální akce, duchovní praxi.\n\nConsciousness Level (CL) systém: CL 1–12 (Seeker → Guardian → Master → Sage...). CL ovlivňuje: XP multiplikátor, governance váhu, přístup k pokročilým funkcím. CL se zvyšuje: aktivní participací, komunitní službou, vzdělávacími questy.\n\nSacred Avatars: digitální identity propojené s CL. Customizace přes herní mechaniky. NFT avatary s evolučními vlastnostmi.\n\nPlay-to-Evolve (ne Play-to-Earn): motivace není zisk, ale růst.',
    },
  ],
  sectionsEn: [
    {
      heading: 'L1: Cosmic Harmony Proof of Work',
      body: 'ZION blockchain is an L1 PoW chain with the Ekam Deeksha algorithm — a custom hashing algorithm designed specifically for ZION.\n\nCosmic Harmony v3 (CHv3): four-phase algorithm. Phase 1 — input transformation via cosmic constants (π, φ, √2). Phase 2 — nonlinear mixing inspired by quantum mechanics. Phase 3 — wave function simulation. Phase 4 — final Avalanche diffusion.\n\nCHv4: extension with GPU-friendly variant + ASIC-resistant memory-hard phase.\n\nBlock reward: 5,400.067 ZION (deliberately non-round, symbolic). Decade Decay — reward decreases by decades, not halving like Bitcoin.\n\nTotal supply: 144,000,000,000 ZION = 144 billion = symbolism of 144,000.',
    },
    {
      heading: 'Block reward distribution',
      body: 'Every found block automatically distributes:\n\n89% → Miner (MINER_PCT)\n5% → Humanitarian Tithe (HUMANITARIAN_PCT)\n5% → Issobella Fund (ISSOBELLA_PCT)\n1% → Pool Fee (POOL_FEE_PCT)\n\nThis split is hard-coded in Genesis. Cannot be changed without a hard fork — and a hard fork requires network consensus.\n\nNo VC, no premine, no ICO. 100% fair launch.',
    },
    {
      heading: 'UTXO model and transaction design',
      body: 'ZION uses the UTXO (Unspent Transaction Output) model — same principle as Bitcoin:\n\nEach transaction consumes previous outputs and creates new ones. No "accounts" — only inputs and outputs. Advantages: better privacy, parallel validation, simpler audit.\n\nTransaction format: version, inputs (prev_tx_hash + index + signature), outputs (amount + public_key_hash), locktime. Signatures: Ed25519 (faster than ECDSA, more secure against side-channel attacks).',
    },
    {
      heading: 'L2: wZION Bridge and DeFi Stack',
      body: 'L2 brings ZION into the DeFi ecosystem:\n\nwZION Bridge: bi-directional bridge between ZION L1 and EVM-compatible chains. Mechanism: lock-and-mint / burn-and-release. Multi-sig validators. Atomic swaps for trustless crossing.\n\nDeFi Stack: DEX (AMM) for wZION/ETH, wZION/USDC pairs. Staking pool. Lending protocol. Yield farming.\n\nDAO Governance: every ZION holder has voting rights proportional to holdings. Proposals, voting, execution — all on-chain.',
    },
    {
      heading: 'L3: Neural Compute Layer + WARP',
      body: 'L3 is the neural layer of the network:\n\nNCL (Neural Compute Layer): distributed AI inference across ZION nodes. Miners = AI inference providers. GPU pooling for large models.\n\nWARP Bridge: cross-chain communication protocol. Connecting ZION with other blockchains at the semantic level — not just token bridging, but data bridging.\n\nAI Native integration: L3 enables Hiranyagarbha to run distributed across the entire ZION network. Every node is a neuron. The network is the brain.',
    },
    {
      heading: 'L4: OASIS — Game of Life',
      body: 'OASIS is the gamified layer of the ZION ecosystem:\n\nGolden Egg — central economic engine: 1 billion ZION allocated at Genesis. Rewards for: education, community service, environmental action, spiritual practice.\n\nConsciousness Level (CL) system: CL 1–12. CL influences: XP multiplier, governance weight, access to advanced features. CL increases through: active participation, community service, educational quests.\n\nSacred Avatars: digital identities linked to CL. NFT avatars with evolutionary properties.\n\nPlay-to-Evolve (not Play-to-Earn): motivation is growth, not profit.',
    },
  ],
};

export default chapter;
