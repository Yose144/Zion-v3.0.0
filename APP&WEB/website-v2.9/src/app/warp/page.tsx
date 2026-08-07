'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLang } from '@/contexts/LanguageContext';
import {
  Activity,
  ArrowRight,
  ArrowLeftRight,
  CheckCircle2,
  CircuitBoard,
  CloudLightning,
  Copy,
  Globe2,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
  Bitcoin,
  Coins,
  Droplets,
  Clock,
} from 'lucide-react';

const WarpCopy = {
  chainFamilies: { cs: `Chain rodiny`, en: `Chain Families` },
  evm6BtcSolTrxXlmCosmosCardanoL: { cs: `EVM (6) · BTC · SOL · TRX · XLM · Cosmos · Cardano · Lightning · Aptos · NEAR · Sui · TON`, en: `EVM (6) · BTC · SOL · TRX · XLM · Cosmos · Cardano · Lightning · Aptos · NEAR · Sui · TON` },
  liveCorridors: { cs: `Živé koridory`, en: `Live Corridors` },
  evmLockMintBaseMainnet6Chains: { cs: `EVM Lock/Mint — Base Mainnet (6 chainů)`, en: `EVM Lock/Mint — Base Mainnet (6 chains)` },
  guardianRuntime: { cs: `Guardian runtime`, en: `Guardian Runtime` },
  k5ValidatorsActiveQuorum25: { cs: `5 validatorů aktivních · quorum 2/5`, en: `5 validators active · quorum 2/5` },
  tests: { cs: `Testy`, en: `Tests` },
  k499WarpTestsPass0Failures: { cs: `499 WARP testů prošlo · 0 chyb`, en: `499 WARP tests pass · 0 failures` },
  evmLockMint: { cs: `EVM Lock/Mint`, en: `EVM Lock/Mint` },
  wzionErc206ChainsBaseMainnet: { cs: `wZION ERC-20 · 6 chainů · Base Mainnet`, en: `wZION ERC-20 · 6 chains · Base Mainnet` },
  validators: { cs: `Validátoři`, en: `Validators` },
  k55GuardianValidatorsActiveQuor: { cs: `5/5 Guardian validators aktivních · quorum 2/5 · replay-safe`, en: `5/5 Guardian validators active · quorum 2/5 · replay-safe` },
  chains: { cs: `Chainy`, en: `Chains` },
  status: { cs: `Stav`, en: `Status` },
  liveOnBase8453WzionUsdtOnUnisw: { cs: `Živě na Base (8453) · wZION/USDT na Uniswap V4 + PancakeSwap V3 · 6-chain bridge relay`, en: `Live on Base (8453) · wZION/USDT on Uniswap V4 + PancakeSwap V3 · 6-chain bridge relay` },
  integration: { cs: `Integrace`, en: `Integration` },
  evmWalletsDefiSwapDaoTreasuryL: { cs: `EVM peněženky, Multichain swap, DAO treasury, LP stakes, CEX listings`, en: `EVM wallets, Multichain swap, DAO treasury, LP stakes, CEX listings` },
  bitcoinHtlcBridge: { cs: `Bitcoin HTLC most`, en: `Bitcoin HTLC Bridge` },
  securityModel: { cs: `Bezpečnostní model`, en: `Security Model` },
  adapterImplementedBolt11LndRes: { cs: `Adaptér implementován (BOLT11 + LND REST) · čeká na LND node deploy`, en: `Adapter implemented (BOLT11 + LND REST) · awaiting LND node deploy` },
  useCases: { cs: `Use case`, en: `Use cases` },
  trustlessSwapsLightningExitsOt: { cs: `Trustless swapy, Lightning exity, OTC bridging`, en: `Trustless swaps, Lightning exits, OTC bridging` },
  solanaSplProgram: { cs: `Solana SPL program`, en: `Solana SPL Program` },
  finality: { cs: `Finalita`, en: `Finality` },
  towerBftIntegrationPlanned: { cs: `Tower BFT integrace plánována`, en: `Tower BFT integration planned` },
  adapterImplementedSplMintWithP: { cs: `Adaptér implementován · SPL mint s PDA · čeká na deploy`, en: `Adapter implemented · SPL mint with PDA · awaiting deploy` },
  utility: { cs: `Využití`, en: `Utility` },
  gameAssetsLiquidityRoutingWarp: { cs: `Game assety, routing likvidity, warp swapy`, en: `Game assets, liquidity routing, warp swaps` },
  nonEvmChains: { cs: `Non-EVM chainy`, en: `Non-EVM Chains` },
  zionNative10Families: { cs: `ZION nativní · 10 rodin`, en: `ZION native · 10 families` },
  implemented: { cs: `Implementováno`, en: `Implemented` },
  adaptersSignersReady499TestsAw: { cs: `Adaptéry + signery hotové (499 testů) · čeká na kontrakt deploy per chain`, en: `Adapters + signers ready (499 tests) · awaiting contract deploy per chain` },
  token: { cs: `Token`, en: `Token` },
  zionNotWzionNativeRepresentati: { cs: `ZION (ne wZION) — nativní reprezentace na non-EVM chainech`, en: `ZION (not wZION) — native representation on non-EVM chains` },
  k1ProvisionAccess: { cs: `1 · Zřízení přístupu`, en: `1 · Provision access` },
  whitelistValidatorsOrFetchPubl: { cs: `Whitelist validátorů nebo převzetí veřejných endpointů`, en: `Whitelist validators or fetch public endpoints` },
  generateApiTokensReadTransferS: { cs: `Vygenerujte API tokeny (read/transfer scopes)`, en: `Generate API tokens (read/transfer scopes)` },
  downloadSdkFromOfficialGithub: { cs: `Stáhněte SDK z oficiálního GitHubu`, en: `Download SDK from official GitHub` },
  k2WireLiquidity: { cs: `2 · Zapojení likvidity`, en: `2 · Wire liquidity` },
  lockAssetsIntoChosenCorridorPo: { cs: `Uzamkněte aktiva do vybraného corridor poolu`, en: `Lock assets into chosen corridor pool` },
  setValidatorQuorumAlertWebhook: { cs: `Nastavte validator quorum + alert webhooky`, en: `Set validator quorum + alert webhooks` },
  runSmokeTestUsingSandboxChainP: { cs: `Spusťte smoke test na sandbox chain páru`, en: `Run smoke test using sandbox chain pairs` },
  k3MonitorOptimize: { cs: `3 · Monitorovat + optimalizovat`, en: `3 · Monitor + optimize` },
  subscribeToValidatorDashboardS: { cs: `Odebírat streamy validator dashboardu`, en: `Subscribe to validator dashboard streams` },
  enableCompactBlockRelayMetrics: { cs: `Zapnout compact block relay metriky`, en: `Enable compact block relay metrics` },
  scheduleWeeklyFailoverIncident: { cs: `Naplánovat týdenní failover + incident drills`, en: `Schedule weekly failover + incident drills` },
  bitcoinHtlcBridgeTrustlessBtcZ: { cs: `Bitcoin HTLC most — trustless swapy BTC ↔ ZION přes 2-of-3 multi-sig · Lightning exity`, en: `Bitcoin HTLC bridge — trustless BTC ↔ ZION swaps via 2-of-3 multi-sig · Lightning exits` },
  adapterReadyAwaitingLndNode: { cs: `Adaptér hotov · čeká na LND node`, en: `Adapter ready · awaiting LND node` },
  uniswapV4PancakeswapV3OnBaseWz: { cs: `Uniswap V4 + PancakeSwap V3 na Base — wZION/USDT (0.3% + 0.25% fee) · 6-chain bridge`, en: `Uniswap V4 + PancakeSwap V3 on Base — wZION/USDT (0.3% + 0.25% fee) · 6-chain bridge` },
  availableNow: { cs: `Dostupné nyní`, en: `Available now` },
  solanaSplProgramPdaSecuredZion: { cs: `Solana SPL program — PDA-secured ZION mint, Tower BFT finalita`, en: `Solana SPL program — PDA-secured ZION mint, Tower BFT finality` },
  adapterReadyAwaitingDeploy: { cs: `Adaptér hotov · čeká na deploy`, en: `Adapter ready · awaiting deploy` },
  nativeL1L2BridgeLockZionOnL1Mi: { cs: `Nativní L1 ↔ L2 bridge — lock ZION na L1, mint wZION na EVM chainech (1:1 peg)`, en: `Native L1 ↔ L2 bridge — lock ZION on L1, mint wZION on EVM chains (1:1 peg)` },
  phase1Done: { cs: `Fáze 1 (Hotovo)`, en: `Phase 1 (Done)` },
  evmCorridor6Chains: { cs: `EVM Corridor — 6 chainů`, en: `EVM Corridor — 6 chains` },
  wzionErc20OnBaseBscPolygonArbi: { cs: `wZION ERC-20 na Base, BSC, Polygon, Arbitrum, Optimism, Avalanche · Uniswap V4 + PancakeSwap V3 · 5/5 Guardian validators · bridge relay live`, en: `wZION ERC-20 on Base, BSC, Polygon, Arbitrum, Optimism, Avalanche · Uniswap V4 + PancakeSwap V3 · 5/5 Guardian validators · bridge relay live` },
  phase2Done: { cs: `Fáze 2 (Hotovo)`, en: `Phase 2 (Done)` },
  dexLiquidityCcaAuction: { cs: `DEX Liquidity + CCA Auction`, en: `DEX Liquidity + CCA Auction` },
  wzionUsdtOnUniswapV403Pancakes: { cs: `wZION/USDT na Uniswap V4 (0.3%) + PancakeSwap V3 (0.25%) · Uniswap CCA aukce (66.47M wZION za USDC) · LiFi agregátor (30+ DEX) · DexScreener integrace`, en: `wZION/USDT on Uniswap V4 (0.3%) + PancakeSwap V3 (0.25%) · Uniswap CCA auction (66.47M wZION for USDC) · LiFi aggregator (30+ DEX) · DexScreener integration` },
  phase3Done: { cs: `Fáze 3 (Hotovo)`, en: `Phase 3 (Done)` },
  k13ChainFamilyAdapters: { cs: `13 Chain Family Adaptéry`, en: `13 Chain Family Adapters` },
  warpAdaptersSignersForAll13Cha: { cs: `WARP adaptéry + signery pro všech 13 chain rodin: EVM (6), BTC, Solana, Tron, Stellar, Cosmos, Cardano, Lightning (BOLT11+LND), Aptos, NEAR, Sui, TON · 499 testů prošlo`, en: `WARP adapters + signers for all 13 chain families: EVM (6), BTC, Solana, Tron, Stellar, Cosmos, Cardano, Lightning (BOLT11+LND), Aptos, NEAR, Sui, TON · 499 tests pass` },
  phase4Active: { cs: `Fáze 4 (Aktivní)`, en: `Phase 4 (Active)` },
  nonEvmDeployBtcLightning: { cs: `Non-EVM Deploy + BTC Lightning`, en: `Non-EVM Deploy + BTC Lightning` },
  deployZionContractsOnNonEvmCha: { cs: `Deploy ZION kontraktů na non-EVM chainech (Solana, Tron, Stellar, Cosmos, Cardano, Aptos, Sui, NEAR, TON) · LND node setup pro Lightning · cross-chain AMM routing`, en: `Deploy ZION contracts on non-EVM chains (Solana, Tron, Stellar, Cosmos, Cardano, Aptos, Sui, NEAR, TON) · LND node setup for Lightning · cross-chain AMM routing` },
  crossChainFlightDeck: { cs: `Cross-chain řídicí panel`, en: `Cross-chain flight deck` },
  liquidityWithoutBorders: { cs: `Likvidita bez hranic`, en: `Liquidity without borders` },
  warpBridgeCovers13ChainFamilie: { cs: `WARP bridge pokrývá 13 chain rodin — EVM (6 chainů), BTC, Solana, Tron, Stellar, Cosmos, Cardano, Lightning, Aptos, NEAR, Sui, TON. EVM corridor je živě (6 chainů, 2 DEX). Non-EVM adaptéry hotové, čekají na kontrakt deploy.`, en: `WARP bridge covers 13 chain families — EVM (6 chains), BTC, Solana, Tron, Stellar, Cosmos, Cardano, Lightning, Aptos, NEAR, Sui, TON. EVM corridor is live (6 chains, 2 DEX). Non-EVM adapters ready, awaiting contract deploy.` },
  openDefiHub: { cs: `Otevřít Multichain Hub`, en: `Open Multichain Hub` },
  bridgeOperations: { cs: `Bridge operace`, en: `Bridge operations` },
  cexListings: { cs: `CEX Listings`, en: `CEX Listings` },
  corridorGrid: { cs: `Síť koridorů`, en: `Corridor grid` },
  validatorBackedBridges: { cs: `Mosty kryté validátory`, en: `Validator-backed bridges` },
  live: { cs: `Živě`, en: `Live` },
  inDevelopment: { cs: `Ve vývoji`, en: `In development` },
  operationsRunbook: { cs: `Operační runbook`, en: `Operations runbook` },
  bringANewCorridorOnline: { cs: `Připojit nový koridór online`, en: `Bring a new corridor online` },
  stage: { cs: `Fáze`, en: `Stage` },
  crossChainSwaps: { cs: `Cross-chain swapy`, en: `Cross-chain swaps` },
  swapBetweenBaseCryptocurrencie: { cs: `Swap mezi základními kryptoměnami`, en: `Swap between base cryptocurrencies` },
  crossChainSwapsBetweenBtcEthSo: { cs: `Cross-chain swapy mezi BTC, ETH, SOL a ZION. EVM corridor je živě (6 chainů, 2 DEX) — non-EVM adaptéry hotové, čekají na deploy.`, en: `Cross-chain swaps between BTC, ETH, SOL, and ZION. EVM corridor is live (6 chains, 2 DEX) — non-EVM adapters ready, awaiting deploy.` },
  planned: { cs: `Plánováno`, en: `Planned` },
  research: { cs: `Výzkum`, en: `Research` },
  openSwap: { cs: `Otevřít swap`, en: `Open swap` },
  roadmap: { cs: `Roadmapa`, en: `Roadmap` },
  multichainPlan: { cs: `Multichain plán`, en: `Multichain plan` },
  warpTransfer: { cs: `WARP transfer`, en: `WARP transfer` },
  initiateWarpTransfer: { cs: `Iniciovat WARP transfer`, en: `Initiate WARP Transfer` },
  buildAMemoForCrossChainTransfe: { cs: `Sestavte memo pro cross-chain transfer a sledujte stav transakce přes WARP daemon API.`, en: `Build a memo for cross-chain transfer and track transaction status via the WARP daemon API.` },
  memoBuilder: { cs: `Memo builder`, en: `Memo Builder` },
  buildTransferMemo: { cs: `Sestavit transfer memo`, en: `Build transfer memo` },
  targetChain: { cs: `Cílový chain`, en: `Target chain` },
  recipientAddress: { cs: `Adresa příjemce`, en: `Recipient address` },
  zion1: { cs: `zion1...`, en: `zion1...` },
  amount: { cs: `Částka`, en: `Amount` },
  generatedMemo: { cs: `Vygenerovaný memo`, en: `Generated memo` },
  copied: { cs: `Zkopírováno`, en: `Copied` },
  copyMemo: { cs: `Kopírovat memo`, en: `Copy Memo` },
  enterRecipientAddress: { cs: `Vyplňte adresu příjemce...`, en: `Enter recipient address...` },
  sendZionToZion1j53677g5k83030x: { cs: `Pošlete ZION na zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7 s tímto memem.`, en: `Send ZION to zion1j53677g5k83030x3s2z2z644e7h07792q0u02t7 with this memo.` },
  statusTracker: { cs: `Sledování stavu`, en: `Status tracker` },
  trackTransferStatus: { cs: `Sledovat stav transferu`, en: `Track transfer status` },
  transferId: { cs: `Transfer ID`, en: `Transfer ID` },
  warp: { cs: `WARP-...`, en: `WARP-...` },
  loading: { cs: `Načítání...`, en: `Loading...` },
  checkStatus: { cs: `Zkontrolovat`, en: `Check Status` },
  response: { cs: `Odpověď`, en: `Response` },
  enterATransferIdToQueryTheTran: { cs: `Zadejte transfer ID pro zobrazení stavu transakce z WARP daemonu.`, en: `Enter a transfer ID to query the transaction status from the WARP daemon.` },
  needCustomRoutingOrInstitution: { cs: `Potřebujete vlastní routing nebo institucionální onboarding?`, en: `Need custom routing or institutional onboarding?` },
  theCoreTeamRunsManagedValidato: { cs: `Core tým provozuje managed validátory a může pomoci s bootstrapem vašeho koridoru, připojením OTC likvidity nebo přidáním nových chainů. Ozvěte se přes oficiální kanály nebo založte issue na veřejném GitHubu.`, en: `The core team runs managed validators and can help bootstrap your corridor, connect OTC liquidity, or add new chains. Reach out via official channels or open an issue on the public GitHub.` },
  openGithubDiscussions: { cs: `Otevřít GitHub diskuse`, en: `Open GitHub discussions` },
  reviewIntegrationDocs: { cs: `Projít integrační docs`, en: `Review integration docs` },
};

const getWarpStats = (cs: boolean) => [
  { label: WarpCopy.chainFamilies[cs ? 'cs' : 'en'], value: '13', detail: WarpCopy.evm6BtcSolTrxXlmCosmosCardanoL[cs ? 'cs' : 'en'], icon: Globe2 },
  { label: WarpCopy.liveCorridors[cs ? 'cs' : 'en'], value: '1', detail: WarpCopy.evmLockMintBaseMainnet6Chains[cs ? 'cs' : 'en'], icon: CheckCircle2 },
  { label: WarpCopy.guardianRuntime[cs ? 'cs' : 'en'], value: '5/5', detail: WarpCopy.k5ValidatorsActiveQuorum25[cs ? 'cs' : 'en'], icon: ShieldCheck },
  { label: WarpCopy.tests[cs ? 'cs' : 'en'], value: '499', detail: WarpCopy.k499WarpTestsPass0Failures[cs ? 'cs' : 'en'], icon: ShieldCheck },
];

const getCorridorRows = (cs: boolean): { title: string; subtitle: string; live: boolean; entries: { label: string; value: string }[] }[] => [
  {
    title: WarpCopy.evmLockMint[cs ? 'cs' : 'en'],
    subtitle: WarpCopy.wzionErc206ChainsBaseMainnet[cs ? 'cs' : 'en'],
    live: true,
    entries: [
      { label: WarpCopy.validators[cs ? 'cs' : 'en'], value: WarpCopy.k55GuardianValidatorsActiveQuor[cs ? 'cs' : 'en'] },
      { label: WarpCopy.chains[cs ? 'cs' : 'en'], value: 'Base · BSC · Polygon · Arbitrum · Optimism · Avalanche' },
      { label: WarpCopy.status[cs ? 'cs' : 'en'], value: WarpCopy.liveOnBase8453WzionUsdtOnUnisw[cs ? 'cs' : 'en'] },
      { label: WarpCopy.integration[cs ? 'cs' : 'en'], value: WarpCopy.evmWalletsDefiSwapDaoTreasuryL[cs ? 'cs' : 'en'] },
    ],
  },
  {
    title: WarpCopy.bitcoinHtlcBridge[cs ? 'cs' : 'en'],
    subtitle: 'SegWit + Taproot · Lightning',
    live: false,
    entries: [
      { label: WarpCopy.securityModel[cs ? 'cs' : 'en'], value: 'HTLC · 2-of-3 multi-sig · 24h timelock' },
      { label: WarpCopy.status[cs ? 'cs' : 'en'], value: WarpCopy.adapterImplementedBolt11LndRes[cs ? 'cs' : 'en'] },
      { label: WarpCopy.useCases[cs ? 'cs' : 'en'], value: WarpCopy.trustlessSwapsLightningExitsOt[cs ? 'cs' : 'en'] },
    ],
  },
  {
    title: WarpCopy.solanaSplProgram[cs ? 'cs' : 'en'],
    subtitle: 'PDA-secured · ZION SPL',
    live: false,
    entries: [
      { label: WarpCopy.finality[cs ? 'cs' : 'en'], value: WarpCopy.towerBftIntegrationPlanned[cs ? 'cs' : 'en'] },
      { label: WarpCopy.status[cs ? 'cs' : 'en'], value: WarpCopy.adapterImplementedSplMintWithP[cs ? 'cs' : 'en'] },
      { label: WarpCopy.utility[cs ? 'cs' : 'en'], value: WarpCopy.gameAssetsLiquidityRoutingWarp[cs ? 'cs' : 'en'] },
    ],
  },
  {
    title: WarpCopy.nonEvmChains[cs ? 'cs' : 'en'],
    subtitle: WarpCopy.zionNative10Families[cs ? 'cs' : 'en'],
    live: false,
    entries: [
      { label: WarpCopy.implemented[cs ? 'cs' : 'en'], value: 'Tron · Stellar · Cosmos · Cardano · Aptos · Sui · NEAR · TON' },
      { label: WarpCopy.status[cs ? 'cs' : 'en'], value: WarpCopy.adaptersSignersReady499TestsAw[cs ? 'cs' : 'en'] },
      { label: WarpCopy.token[cs ? 'cs' : 'en'], value: WarpCopy.zionNotWzionNativeRepresentati[cs ? 'cs' : 'en'] },
    ],
  },
];

const getOnboarding = (cs: boolean) => [
  {
    title: WarpCopy.k1ProvisionAccess[cs ? 'cs' : 'en'],
    items: [
      WarpCopy.whitelistValidatorsOrFetchPubl[cs ? 'cs' : 'en'],
      WarpCopy.generateApiTokensReadTransferS[cs ? 'cs' : 'en'],
      WarpCopy.downloadSdkFromOfficialGithub[cs ? 'cs' : 'en'],
    ],
  },
  {
    title: WarpCopy.k2WireLiquidity[cs ? 'cs' : 'en'],
    items: [
      WarpCopy.lockAssetsIntoChosenCorridorPo[cs ? 'cs' : 'en'],
      WarpCopy.setValidatorQuorumAlertWebhook[cs ? 'cs' : 'en'],
      WarpCopy.runSmokeTestUsingSandboxChainP[cs ? 'cs' : 'en'],
    ],
  },
  {
    title: WarpCopy.k3MonitorOptimize[cs ? 'cs' : 'en'],
    items: [
      WarpCopy.subscribeToValidatorDashboardS[cs ? 'cs' : 'en'],
      WarpCopy.enableCompactBlockRelayMetrics[cs ? 'cs' : 'en'],
      WarpCopy.scheduleWeeklyFailoverIncident[cs ? 'cs' : 'en'],
    ],
  },
];

const getSwapPairs = (cs: boolean) => [
  {
    from: 'BTC',
    to: 'ZION',
    icon: Bitcoin,
    color: 'text-zion-gold',
    bg: 'bg-zion-gold/10',
    border: 'border-zion-gold/20',
    status: 'planned',
    desc: WarpCopy.bitcoinHtlcBridgeTrustlessBtcZ[cs ? 'cs' : 'en'],
    eta: WarpCopy.adapterReadyAwaitingLndNode[cs ? 'cs' : 'en'],
  },
  {
    from: 'ETH',
    to: 'wZION',
    icon: Droplets,
    color: 'text-zion-cyan',
    bg: 'bg-zion-cyan/10',
    border: 'border-zion-cyan/20',
    status: 'live',
    desc: WarpCopy.uniswapV4PancakeswapV3OnBaseWz[cs ? 'cs' : 'en'],
    eta: WarpCopy.availableNow[cs ? 'cs' : 'en'],
  },
  {
    from: 'SOL',
    to: 'ZION',
    icon: Coins,
    color: 'text-zion-purple',
    bg: 'bg-zion-purple/10',
    border: 'border-zion-purple/20',
    status: 'research',
    desc: WarpCopy.solanaSplProgramPdaSecuredZion[cs ? 'cs' : 'en'],
    eta: WarpCopy.adapterReadyAwaitingDeploy[cs ? 'cs' : 'en'],
  },
  {
    from: 'ZION L1',
    to: 'wZION',
    icon: ArrowLeftRight,
    color: 'text-zion-cyan',
    bg: 'bg-zion-cyan/10',
    border: 'border-zion-cyan/20',
    status: 'live',
    desc: WarpCopy.nativeL1L2BridgeLockZionOnL1Mi[cs ? 'cs' : 'en'],
    eta: WarpCopy.availableNow[cs ? 'cs' : 'en'],
  },
];

const getRoadmap = (cs: boolean) => [
  {
    phase: WarpCopy.phase1Done[cs ? 'cs' : 'en'],
    title: WarpCopy.evmCorridor6Chains[cs ? 'cs' : 'en'],
    desc: WarpCopy.wzionErc20OnBaseBscPolygonArbi[cs ? 'cs' : 'en'],
    done: true,
  },
  {
    phase: WarpCopy.phase2Done[cs ? 'cs' : 'en'],
    title: WarpCopy.dexLiquidityCcaAuction[cs ? 'cs' : 'en'],
    desc: WarpCopy.wzionUsdtOnUniswapV403Pancakes[cs ? 'cs' : 'en'],
    done: true,
  },
  {
    phase: WarpCopy.phase3Done[cs ? 'cs' : 'en'],
    title: WarpCopy.k13ChainFamilyAdapters[cs ? 'cs' : 'en'],
    desc: WarpCopy.warpAdaptersSignersForAll13Cha[cs ? 'cs' : 'en'],
    done: true,
  },
  {
    phase: WarpCopy.phase4Active[cs ? 'cs' : 'en'],
    title: WarpCopy.nonEvmDeployBtcLightning[cs ? 'cs' : 'en'],
    desc: WarpCopy.deployZionContractsOnNonEvmCha[cs ? 'cs' : 'en'],
    done: false,
  },
];

export default function WarpPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const warpStats = getWarpStats(cs);
  const corridorRows = getCorridorRows(cs);
  const onboarding = getOnboarding(cs);
  const swapPairs = getSwapPairs(cs);
  const roadmap = getRoadmap(cs);

  const [warpChain, setWarpChain] = useState('ethereum');
  const [warpRecipient, setWarpRecipient] = useState('');
  const [warpAmount, setWarpAmount] = useState('');
  const [warpMemo, setWarpMemo] = useState('');
  const [warpCopied, setWarpCopied] = useState(false);
  const [warpTransferId, setWarpTransferId] = useState('');
  const [warpTransferStatus, setWarpTransferStatus] = useState<any>(null);
  const [warpLoading, setWarpLoading] = useState(false);

  useEffect(() => {
    if (warpRecipient) {
      setWarpMemo(`WARP:1:${warpChain}:${warpRecipient}`);
    } else {
      setWarpMemo('');
    }
  }, [warpChain, warpRecipient]);

  const copyWarpMemo = async () => {
    if (!warpMemo) return;
    try {
      await navigator.clipboard.writeText(warpMemo);
      setWarpCopied(true);
      setTimeout(() => setWarpCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const checkWarpTransfer = async () => {
    if (!warpTransferId) return;
    setWarpLoading(true);
    try {
      const res = await fetch(`/api/warp/transfers/${encodeURIComponent(warpTransferId)}`);
      const data = await res.json();
      setWarpTransferStatus(data);
    } catch (e: any) {
      setWarpTransferStatus({ error: e.message });
    } finally {
      setWarpLoading(false);
    }
  };

  return (
    <div className="zion-page">
        <div className="zion-container max-w-6xl space-y-16">

        {/* ── Hero ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="zion-rainbow-card p-6 md:p-10" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-purple/40 bg-zion-purple/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
                <Sparkles className="h-4 w-4" />
                Warp 2.0 · Corridor Ops
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{WarpCopy.crossChainFlightDeck[cs ? 'cs' : 'en']}</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {WarpCopy.liquidityWithoutBorders[cs ? 'cs' : 'en']}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {WarpCopy.warpBridgeCovers13ChainFamilie[cs ? 'cs' : 'en']}
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/defi" className="zion-button-primary">
                  {WarpCopy.openDefiHub[cs ? 'cs' : 'en']}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/bridge" className="zion-button-secondary">
                  {WarpCopy.bridgeOperations[cs ? 'cs' : 'en']}
                </Link>
                <Link href="/cex" className="zion-button-secondary">
                  {WarpCopy.cexListings[cs ? 'cs' : 'en']}
                </Link>
              </div>
            </div>
            <div className="grid w-full gap-4 sm:grid-cols-2 lg:w-auto">
              {warpStats.map((chip) => (
                <div key={chip.label} className="zion-rainbow-sub px-5 py-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                  <chip.icon className="h-6 w-6 text-zion-gold" />
                  <p className="mt-3 text-xs uppercase tracking-[0.3em] text-gray-400">{chip.label}</p>
                  <p className="text-3xl font-semibold text-white">{chip.value}</p>
                  <p className="text-sm text-gray-300">{chip.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── Corridor grid ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{WarpCopy.corridorGrid[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white">{WarpCopy.validatorBackedBridges[cs ? 'cs' : 'en']}</h2>
          </div>
          <div className="space-y-6">
            {corridorRows.map((row) => (
              <div key={row.title} className="zion-rainbow-card p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{row.subtitle}</p>
                    <h3 className="text-2xl font-semibold text-white">{row.title}</h3>
                  </div>
                  {row.live ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-zion-cyan/30 bg-zion-cyan/10 px-3 py-1 text-xs font-semibold text-zion-cyan">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {WarpCopy.live[cs ? 'cs' : 'en']}
                    </span>
                  ) : (
                    <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-gray-300">
                      {WarpCopy.inDevelopment[cs ? 'cs' : 'en']}
                    </span>
                  )}
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {row.entries.map((entry) => (
                    <div key={entry.label} className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{entry.label}</p>
                      <p className="mt-2 text-sm text-gray-200 leading-relaxed">{entry.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Onboarding runbook ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{WarpCopy.operationsRunbook[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white">{WarpCopy.bringANewCorridorOnline[cs ? 'cs' : 'en']}</h2>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {onboarding.map((block, idx) => (
              <div key={block.title} className="zion-rainbow-sub p-5" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                <div className="flex items-center gap-3">
                  <CircuitBoard className="h-5 w-5 text-zion-cyan" />
                  <p className="text-xs uppercase tracking-[0.35em] text-gray-400">{WarpCopy.stage[cs ? 'cs' : 'en']} {idx + 1}</p>
                </div>
                <h3 className="mt-3 text-xl font-semibold text-white">{block.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-gray-300">
                  {block.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Lock className="h-4 w-4 text-zion-gold mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Cross-Chain Swap Preview ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{WarpCopy.crossChainSwaps[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white">{WarpCopy.swapBetweenBaseCryptocurrencie[cs ? 'cs' : 'en']}</h2>
            <p className="text-gray-400 max-w-2xl">
              {WarpCopy.crossChainSwapsBetweenBtcEthSo[cs ? 'cs' : 'en']}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {swapPairs.map((pair) => {
              const PairIcon = pair.icon;
              const statusConfig = {
                live: { label: WarpCopy.live[cs ? 'cs' : 'en'], color: 'text-zion-cyan', bg: 'bg-zion-cyan/10', border: 'border-zion-cyan/20', icon: CheckCircle2 },
                planned: { label: WarpCopy.planned[cs ? 'cs' : 'en'], color: 'text-zion-cyan', bg: 'bg-zion-cyan/10', border: 'border-zion-cyan/20', icon: Clock },
                research: { label: WarpCopy.research[cs ? 'cs' : 'en'], color: 'text-zion-gold', bg: 'bg-zion-gold/10', border: 'border-zion-gold/20', icon: Clock },
              }[pair.status as 'live' | 'planned' | 'research'];
              const StatusIcon = statusConfig.icon;
              return (
                <div key={`${pair.from}-${pair.to}`} className="zion-rainbow-card p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${pair.bg} ${pair.border} border`}>
                        <PairIcon className={`h-5 w-5 ${pair.color}`} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-white">{pair.from}</span>
                        <ArrowLeftRight className="h-4 w-4 text-gray-500" />
                        <span className="text-lg font-bold text-white">{pair.to}</span>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full ${statusConfig.bg} ${statusConfig.border} border px-3 py-1 text-[10px] font-semibold ${statusConfig.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed mb-3">{pair.desc}</p>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <Clock className="h-3 w-3" />
                    {pair.eta}
                  </div>
                  {pair.status === 'live' && (
                    <Link href="/defi" className="mt-3 inline-flex items-center gap-1 text-xs text-zion-cyan hover:text-white transition-colors">
                      {WarpCopy.openSwap[cs ? 'cs' : 'en']} <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* ── Roadmap ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{WarpCopy.roadmap[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white">{WarpCopy.multichainPlan[cs ? 'cs' : 'en']}</h2>
          </div>
          <div className="space-y-4">
            {roadmap.map((item, i) => (
              <div key={item.title} className="zion-rainbow-card p-5" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                  <div className="flex items-center gap-3 shrink-0">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${item.done ? 'bg-zion-cyan/20' : 'bg-white/5'}`}>
                      {item.done ? (
                        <CheckCircle2 className="h-4 w-4 text-zion-cyan" />
                      ) : (
                        <Clock className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <span className={`text-xs uppercase tracking-wider font-semibold ${item.done ? 'text-zion-cyan' : 'text-gray-400'}`}>
                      {item.phase}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                    <p className="text-sm text-gray-400 mt-1">{item.desc}</p>
                  </div>
                  {i < roadmap.length - 1 && (
                    <div className="hidden sm:block w-px h-12 bg-white/10" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Onboarding runbook (original) ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-rainbow-card p-8" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{WarpCopy.operationsRunbook[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white">{WarpCopy.bringANewCorridorOnline[cs ? 'cs' : 'en']}</h2>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {onboarding.map((block, idx) => (
              <div key={block.title} className="zion-rainbow-sub p-5" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                <div className="flex items-center gap-3">
                  <CircuitBoard className="h-5 w-5 text-zion-cyan" />
                  <p className="text-xs uppercase tracking-[0.35em] text-gray-400">{WarpCopy.stage[cs ? 'cs' : 'en']} {idx + 1}</p>
                </div>
                <h3 className="mt-3 text-xl font-semibold text-white">{block.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-gray-300">
                  {block.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Lock className="h-4 w-4 text-zion-gold mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Initiate WARP Transfer ── */}
        <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="space-y-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{WarpCopy.warpTransfer[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white">{WarpCopy.initiateWarpTransfer[cs ? 'cs' : 'en']}</h2>
            <p className="text-gray-400 max-w-2xl">
              {WarpCopy.buildAMemoForCrossChainTransfe[cs ? 'cs' : 'en']}
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Memo Builder */}
            <div className="zion-rainbow-card p-6" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zion-purple/10 border border-zion-purple/20">
                  <CircuitBoard className="h-5 w-5 text-zion-purple" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{WarpCopy.memoBuilder[cs ? 'cs' : 'en']}</p>
                  <h3 className="text-xl font-semibold text-white">{WarpCopy.buildTransferMemo[cs ? 'cs' : 'en']}</h3>
                </div>
              </div>

              <div className="space-y-4">
                {/* Chain selector */}
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-gray-400">{WarpCopy.targetChain[cs ? 'cs' : 'en']}</label>
                  <select
                    value={warpChain}
                    onChange={(e) => setWarpChain(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-zion-purple/50 transition-colors"
                  >
                    <option value="ethereum">Ethereum</option>
                    <option value="bitcoin">Bitcoin</option>
                    <option value="solana">Solana</option>
                    <option value="stellar">Stellar</option>
                    <option value="tron">Tron</option>
                  </select>
                </div>

                {/* Recipient address */}
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-gray-400">{WarpCopy.recipientAddress[cs ? 'cs' : 'en']}</label>
                  <input
                    type="text"
                    value={warpRecipient}
                    onChange={(e) => setWarpRecipient(e.target.value)}
                    placeholder={WarpCopy.zion1[cs ? 'cs' : 'en']}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-zion-purple/50 transition-colors"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-gray-400">{WarpCopy.amount[cs ? 'cs' : 'en']} (ZION)</label>
                  <input
                    type="number"
                    value={warpAmount}
                    onChange={(e) => setWarpAmount(e.target.value)}
                    placeholder="0.00"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-zion-purple/50 transition-colors"
                  />
                </div>

                {/* Generated memo */}
                <div className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{WarpCopy.generatedMemo[cs ? 'cs' : 'en']}</p>
                    <button
                      onClick={copyWarpMemo}
                      disabled={!warpMemo}
                      className="zion-button-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {warpCopied ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-zion-cyan" />
                          {WarpCopy.copied[cs ? 'cs' : 'en']}
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          {WarpCopy.copyMemo[cs ? 'cs' : 'en']}
                        </>
                      )}
                    </button>
                  </div>
                  <code className="mt-2 block break-all text-sm text-zion-cyan font-mono">
                    {warpMemo || (WarpCopy.enterRecipientAddress[cs ? 'cs' : 'en'])}
                  </code>
                </div>

                {/* Instructions */}
                <div className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                  <div className="flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-zion-gold mt-0.5 shrink-0" />
                  <p className="text-sm text-gray-300">
                    {WarpCopy.sendZionToZion1j53677g5k83030x[cs ? 'cs' : 'en']}
                  </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Transfer Status Tracker */}
            <div className="zion-rainbow-card p-6" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zion-cyan/10 border border-zion-cyan/20">
                  <Search className="h-5 w-5 text-zion-cyan" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{WarpCopy.statusTracker[cs ? 'cs' : 'en']}</p>
                  <h3 className="text-xl font-semibold text-white">{WarpCopy.trackTransferStatus[cs ? 'cs' : 'en']}</h3>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-[0.3em] text-gray-400">{WarpCopy.transferId[cs ? 'cs' : 'en']}</label>
                  <div className="mt-2 flex gap-3">
                    <input
                      type="text"
                      value={warpTransferId}
                      onChange={(e) => setWarpTransferId(e.target.value)}
                      placeholder={WarpCopy.warp[cs ? 'cs' : 'en']}
                      onKeyDown={(e) => { if (e.key === 'Enter') checkWarpTransfer(); }}
                      className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-gray-600 outline-none focus:border-zion-cyan/50 transition-colors"
                    />
                    <button
                      onClick={checkWarpTransfer}
                      disabled={!warpTransferId || warpLoading}
                      className="zion-button-primary disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {warpLoading ? (
                        <>
                          <Activity className="h-4 w-4 animate-pulse" />
                          {WarpCopy.loading[cs ? 'cs' : 'en']}
                        </>
                      ) : (
                        <>
                          <Search className="h-4 w-4" />
                          {WarpCopy.checkStatus[cs ? 'cs' : 'en']}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Status response */}
                {warpTransferStatus !== null && (
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400 mb-2">{WarpCopy.response[cs ? 'cs' : 'en']}</p>
                    <pre className="overflow-x-auto rounded-lg bg-black/50 p-3 text-xs text-gray-200 font-mono leading-relaxed">
                      <code>{JSON.stringify(warpTransferStatus, null, 2)}</code>
                    </pre>
                  </div>
                )}

                {warpTransferStatus === null && (
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
                    <div className="flex items-start gap-2">
                      <Lock className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-gray-400">
                      {WarpCopy.enterATransferIdToQueryTheTran[cs ? 'cs' : 'en']}
                    </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── Institutional CTA ── */}
        <motion.section initial={{ opacity: 0, scale: 0.98 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="zion-cta-banner">
          <Activity className="mx-auto h-12 w-12 text-zion-gold" />
          <h2 className="mt-6 text-3xl font-semibold text-white">{WarpCopy.needCustomRoutingOrInstitution[cs ? 'cs' : 'en']}</h2>
          <p className="mt-4 text-gray-100 max-w-3xl mx-auto">
            {WarpCopy.theCoreTeamRunsManagedValidato[cs ? 'cs' : 'en']}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="https://github.com/Zion-TerraNova" target="_blank" rel="noreferrer" className="zion-button-secondary">
              {WarpCopy.openGithubDiscussions[cs ? 'cs' : 'en']}
            </Link>
            <Link href="/docs" className="zion-button-primary">
              {WarpCopy.reviewIntegrationDocs[cs ? 'cs' : 'en']}
            </Link>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
