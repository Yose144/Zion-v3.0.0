'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowRight,
  Crown,
  ShieldCheck,
  Plus,
  Heart,
  TreeDeciduous,
  Star,
  Sparkles,
  Users,
  Info,
  Link2,
  ArrowLeftRight,
  Activity,
  Gavel,
  Wallet,
  ChevronDown,
  HelpCircle,
  Scale,
  Landmark,
  Route,
  CheckCircle2,
  Globe2,
} from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { useLang, type Lang } from '@/contexts/LanguageContext';
import { tx5, t5 } from '@/lib/i18n-tx';
import { useAuth } from '@/contexts/AuthContext';
import DAOStats from '@/components/dao/DAOStats';
import ProposalCard from '@/components/dao/ProposalCard';
import TreasuryOpsPanel from '@/components/dao/TreasuryOpsPanel';
import GuardianRegisterCard from '@/components/dao/GuardianRegisterCard';
import DelegateMemoCard from '@/components/dao/DelegateMemoCard';
import ParliamentVision from '@/components/dao/ParliamentVision';
import {
  getDAOStats,
  getDAOHealth,
  getDAOTreasuryOverview,
  getGovernanceProposals,
  getTreasuryOps,
  getGuardians,
  castGovernanceVote,
  createGovernanceProposal,
  type GovernanceProposal,
  type DAOStats as DAOStatsType,
  type DAOTreasuryOverview,
  type ProposalTypeInput,
  type TreasuryOp,
  type GuardianRegistry,
} from '@/lib/dao-api';

const DaoCopy = {
  phase1LiveFoundation: { cs: `Fáze 1 · Živý základ`, en: `Phase 1 · Live foundation` },
  phase2DaoParliament: { cs: `Fáze 2 · DAO Parlament`, en: `Phase 2 · DAO Parliament` },
  phase3EarthNetwork: { cs: `Fáze 3 · Síť Země`, en: `Phase 3 · Earth Network` },
  governanceDocs: { cs: `Governance dokumentace`, en: `Governance docs` },
  proposalFlowVotingPowerEmergen: { cs: `Proposal flow, hlasovací síla, nouzové klauzule.`, en: `Proposal flow, voting power, emergency clauses.` },
  treasuryDashboard: { cs: `Treasury dashboard`, en: `Treasury dashboard` },
  realTimeBalancesAllocationOver: { cs: `Real-time zůstatky, přehled alokací, tithe.`, en: `Real-time balances, allocation overview, tithe.` },
  defiHub: { cs: `Multichain Hub`, en: `Multichain Hub` },
  swapBridgeAndPortfolioOnBaseMa: { cs: `Swap, bridge a portfolio na Base Mainnet.`, en: `Swap, bridge and portfolio on Base Mainnet.` },
  howDoIBecomeADaoGuardian: { cs: `Jak se stát DAO guardianem?`, en: `How do I become a DAO guardian?` },
  guardiansAreSelectedBasedOnVer: { cs: `Kandidát se registruje on-chain memo transakcí na L1, pak o něm hlasuje komunita — admission vyžaduje 60 % quorum, expulsion 75 %. Sedm treasury signerů je samostatná operativní role.`, en: `A candidate registers via an on-chain L1 memo transaction, then the community votes — admission requires 60% quorum, expulsion 75%. The seven treasury signers are a separate operational role.` },
  howDoesVotingPowerWork: { cs: `Jak funguje hlasovací síla?`, en: `How does voting power work?` },
  everyZionHolderHasBaseVotingPo: { cs: `Hlasovací síla = zůstatek ZION na L1 ve snapshot bloku návrhu. Žádný consciousness ani staking násobič.`, en: `Voting power equals your L1 ZION balance at the proposal snapshot block. No consciousness or staking multiplier.` },
  whatIsTheHumanitarianTithe: { cs: `Co je humanitární fond?`, en: `What is the humanitarian fund?` },
  k10OfMiningRewardsGoIntoTheDaoH: { cs: `5 % z coinbase odměn míří do L5 humanitárního fondu — ne do DAO treasury. Projekty čisté vody, potravinové bezpečnosti a vzdělávání mají procházet governance návrhy — výplatní cesta zatím není live.`, en: `5% of coinbase rewards are routed to the L5 humanitarian fund — not to the DAO treasury. Clean water, food security, and education projects are intended to go through governance proposals — the disbursement path is not live yet.` },
  whenWillTheDaoBeFullyOnChain: { cs: `Kdy bude plně on-chain DAO?`, en: `When will the DAO be fully on-chain?` },
  theHybridDaoPhaseBeginsInQ2202: { cs: `Hybridní lifecycle návrhů už běží. Consent registry, DAO Parlament a kryptografická exekuce treasury jsou zatím ve fázi návrhu a prototypu.`, en: `The hybrid proposal lifecycle is already live. The consent registry, DAO Parliament, and cryptographic treasury execution remain staged prototype work.` },
  pleaseEnterATitleAndDescriptio: { cs: `Vyplňte název a popis.`, en: `Please enter a title and description.` },
  failedToCreateProposal: { cs: `Nepodařilo se vytvořit návrh.`, en: `Failed to create proposal.` },
  proposalTypeLabel: { cs: `Typ návrhu`, en: `Proposal type` },
  typeParameter: { cs: `Parametr`, en: `Parameter` },
  typeTreasury: { cs: `Treasury výdaj`, en: `Treasury spend` },
  typeGrant: { cs: `Grant`, en: `Grant` },
  typeHumanitarian: { cs: `Humanitární`, en: `Humanitarian` },
  typeEmergency: { cs: `Emergency`, en: `Emergency` },
  typeAdmission: { cs: `Guardian admission`, en: `Guardian admission` },
  typeExpulsion: { cs: `Guardian expulsion`, en: `Guardian expulsion` },
  candidateAddress: { cs: `Adresa kandidáta (zion1…)`, en: `Candidate address (zion1…)` },
  accusedAddress: { cs: `Adresa guardian (zion1…)`, en: `Guardian address (zion1…)` },
  communityLabel: { cs: `Komunita`, en: `Community` },
  offenseCategoryLabel: { cs: `Kategorie přestupku`, en: `Offense category` },
  tierLabel: { cs: `Tier (1–3)`, en: `Tier (1–3)` },
  admissionRequiresOnChainRegistration: { cs: `Kandidát musí být nejdřív registrován on-chain memo transakcí na L1 — jinak exekuce selže.`, en: `The candidate must first be registered via an on-chain L1 memo transaction — otherwise execution fails.` },
  parameterName: { cs: `Název parametru`, en: `Parameter name` },
  currentValue: { cs: `Současná hodnota`, en: `Current value` },
  proposedValue: { cs: `Navrhovaná hodnota`, en: `Proposed value` },
  recipientAddress: { cs: `Adresa příjemce (zion1...)`, en: `Recipient address (zion1...)` },
  amountZion: { cs: `Částka (ZION)`, en: `Amount (ZION)` },
  purpose: { cs: `Účel`, en: `Purpose` },
  durationDays: { cs: `Doba trvání (dní)`, en: `Duration (days)` },
  category: { cs: `Kategorie`, en: `Category` },
  region: { cs: `Region`, en: `Region` },
  emergencyAction: { cs: `Emergency akce`, en: `Emergency action` },
  justification: { cs: `Zdůvodnění`, en: `Justification` },
  proposalThresholdNote: { cs: `Vytvoření návrhu vyžaduje zůstatek alespoň`, en: `Creating a proposal requires a balance of at least` },
  votesAreWeightedByZionBalance: { cs: `Hlasovací síla = zůstatek ZION ve snapshot bloku. Proposer identity = tvůj ZIS účet.`, en: `Voting power = ZION balance at the snapshot block. Proposer identity = your ZIS account.` },
  votingClosedAwaitingTally: { cs: `Hlasování ukončeno — čeká na sčítání`, en: `Voting closed — awaiting tally` },
  multisigOperations: { cs: `Záznamy schválení treasury`, en: `Treasury approval records` },
  approvalRecordsExplainer: { cs: `Tyto záznamy koordinují schválení mezi treasury signery. Samy o sobě nepodepisují ani nevysílají L1 transakci — utracení vyžaduje blok 144 000, on-chain admin odemčení a skutečný multisig spend.`, en: `These records coordinate approvals among the treasury signers. They do not themselves sign or broadcast an L1 transaction — spending requires block 144,000, the on-chain admin unlock, and a real multisig spend.` },
  lockState: { cs: `Stav zámku treasury`, en: `Treasury lock state` },
  currentBlock: { cs: `Aktuální blok`, en: `Current block` },
  unlockBlock: { cs: `Blok odemčení`, en: `Unlock block` },
  timeLockLabel: { cs: `Časový zámek`, en: `Time lock` },
  adminUnlockLabel: { cs: `Admin odemčení`, en: `Admin unlock` },
  spendableNow: { cs: `Utratitelné nyní`, en: `Spendable now` },
  stateUnknown: { cs: `neznámé`, en: `unknown` },
  stateLocked: { cs: `Uzamčeno`, en: `Locked` },
  stateReached: { cs: `Dosaženo`, en: `Reached` },
  stateUnlocked: { cs: `Odemčeno`, en: `Unlocked` },
  stateNotUnlocked: { cs: `Neodemčeno`, en: `Not unlocked` },
  noTreasuryOpsYet: { cs: `Zatím žádné záznamy schválení treasury`, en: `No treasury approval records yet` },
  signatures: { cs: `schválení`, en: `approvals` },
  votersLabel: { cs: `hlasujících`, en: `voters` },
  governance: { cs: `Správa`, en: `Governance` },
  treasuryProposalsVoting: { cs: `Treasury · návrhy · hlasování`, en: `Treasury · proposals · voting` },
  shapeZionSFutureTogether: { cs: `Formuj budoucnost ZION společně`, en: `Shape ZION\'s future together` },
  zionSDaoGovernsTreasuryAllocat: { cs: `DAO ZION řídí alokaci treasury, upgrady protokolu a humanitární iniciativy. Každý oprávněný držitel ZION má hlasovací sílu danou zůstatkem ve snapshot bloku.`, en: `ZION\'s DAO governs treasury allocation, protocol upgrades, and humanitarian initiatives. Every eligible ZION holder has voting power set by their balance at the snapshot block.` },
  daemonOffline: { cs: `Daemon Offline`, en: `Daemon Offline` },
  daemonOnline: { cs: `Daemon Online`, en: `Daemon Online` },
  checking: { cs: `Kontroluji…`, en: `Checking…` },
  quorum: { cs: `Quorum:`, en: `Quorum:` },
  period: { cs: `Období:`, en: `Period:` },
  online: { cs: `Online`, en: `Online` },
  offline: { cs: `Offline`, en: `Offline` },
  loading: { cs: `Načítám…`, en: `Loading…` },
  refreshData: { cs: `Obnovit data`, en: `Refresh Data` },
  governanceDocs_2: { cs: `Dokumentace governance`, en: `Governance docs` },
  quickOverview: { cs: `Rychlý přehled`, en: `Quick Overview` },
  treasury: { cs: `Treasury`, en: `Treasury` },
  proposals: { cs: `Návrhů`, en: `Proposals` },
  guardians: { cs: `Guardians`, en: `Guardians` },
  daoDaemonPhase2HybridDao: { cs: `DAO Daemon — Fáze 2 (Hybridní DAO)`, en: `DAO Daemon — Phase 2 (Hybrid DAO)` },
  theOnChainDaoGovernanceDaemonW: { cs: `DAO governance daemon je momentálně nedostupný — zobrazená data mohou být zastaralá. Hybridní lifecycle návrhů je nasazený; další moduly jsou ve vývoji.`, en: `The DAO governance daemon is currently unreachable — displayed data may be stale. The hybrid proposal lifecycle is deployed; further modules are in development.` },
  telemetry: { cs: `Telemetrie`, en: `Telemetry` },
  daoStatistics: { cs: `DAO statistiky`, en: `DAO Statistics` },
  governanceMetricsAggregatedFro: { cs: `Metriky governance agregované z DAO API, treasury a bridge relayeru v reálném čase.`, en: `Governance metrics aggregated from DAO API, treasury, and bridge relayer in real time.` },
  totalBalance: { cs: `celkový zůstatek`, en: `total balance` },
  totalTreasuryBalanceIncludingA: { cs: `Celkový zůstatek treasury včetně alokovaných prostředků.`, en: `Total treasury balance including allocated funds.` },
  immediatelyUsable: { cs: `po splnění všech zámků`, en: `after every lock is satisfied` },
  balanceAvailableForGovernanceS: { cs: `Částka utratitelná nyní — vyžaduje blok 144 000 a on-chain admin odemčení.`, en: `Amount spendable right now — requires block 144,000 and the on-chain admin unlock.` },
  createdTotal: { cs: `celkem vytvořeno`, en: `created total` },
  active: { cs: `Aktivní`, en: `Active` },
  ongoingVotes: { cs: `probíhající hlasování`, en: `ongoing votes` },
  passed: { cs: `Schváleno`, en: `Passed` },
  successfulProposals: { cs: `úspěšné návrhy`, en: `successful proposals` },
  voters: { cs: `Hlasujících`, en: `Voters` },
  activeParticipants: { cs: `aktivních účastníků`, en: `active participants` },
  bridge: { cs: `Bridge`, en: `Bridge` },
  l2Relay: { cs: `L2 relay`, en: `L2 relay` },
  statusOfTheCrossChainRelayConn: { cs: `Stav cross-chain relay propojujícího L1 ZION a Base.`, en: `Status of the cross-chain relay connecting L1 ZION and Base.` },
  confirmedOnBase: { cs: `potvrzeno na Base`, en: `confirmed on Base` },
  numberOfWzionMintedOnBaseAfter: { cs: `Počet wZION mintnutých na Base po zamčení ZION na L1.`, en: `Number of wZION minted on Base after locking ZION on L1.` },
  daoSections: { cs: `DAO sekce`, en: `DAO sections` },
  governanceProposals: { cs: `Governance návrhy`, en: `Governance proposals` },
  voteOnProtocolDecisions: { cs: `Hlasuj o rozhodnutích`, en: `Vote on protocol decisions` },
  createProposal: { cs: `Vytvořit návrh`, en: `Create Proposal` },
  loadingProposals: { cs: `Načítám návrhy…`, en: `Loading proposals…` },
  signInToVote: { cs: `Pro hlasování a vytváření návrhů se přihlas přes ZIS. Hlasovací síla se počítá z tvého reálného ZION zůstatku.`, en: `Sign in with ZIS to vote and create proposals. Voting power is computed from your real ZION balance.` },
  signInRequired: { cs: `Nejdřív se přihlas přes ZIS účet.`, en: `Please sign in with your ZIS account first.` },
  noProposalsYet: { cs: `Zatím žádné návrhy`, en: `No proposals yet` },
  beTheFirstToCreateAGovernanceP: { cs: `Buď první, kdo vytvoří governance návrh!`, en: `Be the first to create a governance proposal!` },
  treasuryOverview: { cs: `Přehled treasury`, en: `Treasury overview` },
  pendingOps: { cs: `Čekající operace`, en: `Pending Ops` },
  dailyLimit: { cs: `Denní limit`, en: `Daily Limit` },
  bridgeVault: { cs: `Bridge Vault`, en: `Bridge Vault` },
  k100mZionBaseMainnet: { cs: `100M ZION → Base Mainnet`, en: `100M ZION → Base Mainnet` },
  k6UtxoLockTransactions1667mZion: { cs: `6 UTXO lock transakcí (~16.67M ZION každá) odesláno na bridge vault v blocích 11611–11612. Bridge relay mintne wZION na Base mainnet po dosažení finality.`, en: `6 UTXO lock transactions (~16.67M ZION each) sent to the bridge vault in blocks 11611–11612. The bridge relay will mint wZION on Base mainnet after finality.` },
  lockedZion: { cs: `Zamčeno ZION`, en: `Locked ZION` },
  relayStatus: { cs: `Relay status`, en: `Relay status` },
  l2CrossChainRelay: { cs: `L2 Cross-Chain Relay`, en: `L2 Cross-Chain Relay` },
  wzionMints: { cs: `wZION mints`, en: `wZION mints` },
  l1Block: { cs: `L1 blok`, en: `L1 block` },
  lastScan: { cs: `poslední scan`, en: `last scan` },
  vault: { cs: `Vault:`, en: `Vault:` },
  finality60Blocks: { cs: `Finality: 60 bloků`, en: `Finality: 60 blocks` },
  humanitarianTithe: { cs: `Humanitární fond`, en: `Humanitarian Fund` },
  k10OfAllMiningRewardsFundCleanW: { cs: `5 % z každé coinbase odměny míří do L5 humanitárního fondu. Podpora projektů čisté vody, potravinové bezpečnosti a vzdělávání má procházet governance — výplatní cesta zatím není live.`, en: `5% of every coinbase reward is routed to the L5 humanitarian fund. Support for clean water, food security, and education projects is intended to go through governance — the disbursement path is not live yet.` },
  totalProjects: { cs: `Celkem projektů`, en: `Total Projects` },
  activeFunding: { cs: `Aktivní financování`, en: `Active Funding` },
  beneficiaries: { cs: `Příjemci`, en: `Beneficiaries` },
  fundedAmount: { cs: `Financováno`, en: `Funded Amount` },
  multiLayerGovernance: { cs: `Vícevrstvá správa`, en: `Multi-Layer Governance` },
  coAdminSacredTrinity: { cs: `Co-Admin & Posvátná trojice`, en: `Co-Admin & Sacred Trinity` },
  multiLayerDaoGovernanceAcrossL: { cs: `Navržená multi-vrstvá DAO správa přes L1–L6. Co-Admin role a cross-layer veta jsou zatím návrh — Posvátná trojice symbolizuje kosmické archetypy správy.`, en: `Proposed multi-layer DAO governance across L1–L6. Co-Admin roles and cross-layer vetoes are a design so far — the Sacred Trinity embodies cosmic archetypes of stewardship.` },
  coAdminSystem: { cs: `Co-Admin systém (návrh)`, en: `Co-Admin System (proposed)` },
  eachLayerL1L6HasACoAdminForTec: { cs: `Navržený model: každá vrstva (L1–L6) by měla mít Co-Admina pro technická rozhodnutí a koordinaci. Produkční co-admin registry zatím nemá žádné členy.`, en: `Proposed design: each layer (L1–L6) would have a Co-Admin for technical decisions and coordination. The production co-admin registry currently has no populated members.` },
  coAdmin: { cs: `Co-Admin`, en: `Co-Admin` },
  daoAuthority: { cs: `DAO autorita`, en: `DAO authority` },
  sacredTrinity: { cs: `Posvátná trojice`, en: `Sacred Trinity` },
  cosmicArchetypesOfDaoGovernanc: { cs: `Kosmické archetypy DAO governance — Rama (správce, L1), Síta (srdce, L5), Hanuman (ochránce, L2).`, en: `Cosmic archetypes of DAO governance — Rama (steward, L1), Síta (heart, L5), Hanuman (guardian, L2).` },
  stewardConsensusL1: { cs: `Správce · Konsenzus · L1`, en: `Steward · Consensus · L1` },
  chainDharmaFairMiningProtocolI: { cs: `Dharma chainu, fair mining, protokolová integrita`, en: `Chain dharma, fair mining, protocol integrity` },
  heartCommunityL5: { cs: `Srdce · Komunita · L5`, en: `Heart · Community · L5` },
  humanitarianFundPhysicalCommun: { cs: `Humanitární fond, fyzické komunity, péče`, en: `Humanitarian fund, physical communities, care` },
  guardianBridgeL2: { cs: `Ochránce · Bridge · L2`, en: `Guardian · Bridge · L2` },
  bridgingWorldsProtectionFaithf: { cs: `Přemostění světů, ochrana, věrná služba`, en: `Bridging worlds, protection, faithful service` },
  consentEngine: { cs: `Consent Engine (prototyp)`, en: `Consent Engine (prototype)` },
  theConsentMechanismEnsuresCros: { cs: `Navržený mechanismus souhlasu má zajistit, že cross-layer rozhodnutí neprojdou bez aktivního souhlasu dotčených vrstev. Do live runtime návrhů zatím není zapojen. Blokující veto je vyhrazeno pro bezpečnostní incidenty a porušení dohody.`, en: `The proposed consent mechanism is designed to ensure cross-layer decisions do not pass without active consent from affected layers. It is not wired into the live proposal runtime yet. Blocking veto is reserved for security incidents and agreement violations.` },
  propose: { cs: `Návrh`, en: `Propose` },
  anyCoAdmin: { cs: `Jakýkoliv Co-Admin`, en: `Any Co-Admin` },
  consent: { cs: `Souhlas`, en: `Consent` },
  affectedLayers: { cs: `Dotčené vrstvy`, en: `Affected layers` },
  vetoWindow: { cs: `Veto okno`, en: `Veto window` },
  execute: { cs: `Provedení`, en: `Execute` },
  afterConsent: { cs: `Po souhlasu`, en: `After consent` },
  daoCirclesGovernanceTopology: { cs: `DAO kruhy & topologie`, en: `DAO Circles & Governance Topology` },
  treeOfLifeServesAsALivingDaoLe: { cs: `Tree of Life slouží jako symbolická mapa DAO kruhů. Kořeny reprezentují komunitní guildy, srdce vývojové kruhy a koruna správní guardians.`, en: `Tree of Life serves as a symbolic map of DAO circles. Roots represent community guilds, the heart development circles, and the crown governance guardians.` },
  liveTopology: { cs: `Symbolická mapa`, en: `Symbolic map` },
  crown: { cs: `Koruna`, en: `Crown` },
  guardiansCouncil: { cs: `Rada guardianů`, en: `Guardians Council` },
  onChainRegistry: { cs: `On-chain registr`, en: `On-chain registry` },
  liveGuardianRegistry: { cs: `Živý registr guardianů`, en: `Live Guardian Registry` },
  liveGuardianRegistryDesc: { cs: `Aktivní členové rady a kandidáti registrovaní on-chain memo transakcí na L1. Rotace probíhá hlasováním — admission vyžaduje 60 % quorum, expulsion 75 %.`, en: `Active council members and candidates registered via an on-chain L1 memo transaction. Rotation happens by vote — admission requires 60% quorum, expulsion 75%.` },
  activeGuardians: { cs: `Aktivní guardianové`, en: `Active guardians` },
  registeredCandidates: { cs: `Registrovaní kandidáti`, en: `Registered candidates` },
  noGuardiansConfigured: { cs: `Žádní guardianové zatím nenakonfigurováni`, en: `No guardians configured yet` },
  noCandidatesRegistered: { cs: `Žádní kandidáti zatím nejsou registrovaní`, en: `No candidates registered yet` },
  multisigThreshold: { cs: `Multisig práh`, en: `Multisig threshold` },
  candidateAwaitingAdmission: { cs: `čeká na admission hlasování`, en: `awaiting admission vote` },
  topDaoGovernanceLayerTreasuryO: { cs: `Vrchní vrstva správy DAO — dohled nad treasury, bezpečnostní revize a dlouhodobá vize.`, en: `Top DAO governance layer — treasury oversight, security reviews, and long-term vision.` },
  heart: { cs: `Srdce`, en: `Heart` },
  buildersCircle: { cs: `Kruh stavitelů`, en: `Builders Circle` },
  ecosystemHeartProtocolDevelopm: { cs: `Srdce ekosystému — vývoj protokolu, core návrhy a koordinace technických misí.`, en: `Ecosystem heart — protocol development, core proposals, and technical mission coordination.` },
  roots: { cs: `Kořeny`, en: `Roots` },
  communityGuild: { cs: `Komunitní guilda`, en: `Community Guild` },
  daoRootsOpenCommunityContribut: { cs: `Kořeny DAO — otevřená komunita, contribution streamy, komunitní hlasování a růst sítě.`, en: `DAO roots — open community, contribution streams, community votes, and network growth.` },
  dao: { cs: `DAO`, en: `DAO` },
  governancePhases: { cs: `Fáze governance`, en: `Governance phases` },
  roadToFullDecentralization: { cs: `Cesta k plné decentralizaci`, en: `Road to full decentralization` },
  support: { cs: `Podpora`, en: `Support` },
  faq: { cs: `Časté dotazy`, en: `FAQ` },
  exploreTheZionEcosystem: { cs: `Objevuj ZION ekosystém`, en: `Explore the ZION ecosystem` },
  daoIsTheBridgeBetweenL1Consens: { cs: `DAO je spojnicí mezi L1 konsenzem, Multichain na Base a humanitárními iniciativami. Pokračuj do dalších sekcí.`, en: `DAO is the bridge between L1 consensus, Multichain on Base, and humanitarian initiatives. Continue to the next sections.` },
  helpfulLinks: { cs: `Užitečné odkazy`, en: `Helpful links` },
  open: { cs: `Otevřít`, en: `Open` },
  newGovernanceProposal: { cs: `Nový governance návrh`, en: `New governance proposal` },
  title: { cs: `Název`, en: `Title` },
  eGIncreaseBridgeValidatorThres: { cs: `Např. Zvýšit bridge validator threshold`, en: `e.g. Increase bridge validator threshold` },
  description: { cs: `Popis`, en: `Description` },
  detailedDescriptionOfThePropos: { cs: `Detailní popis návrhu a očekávaného dopadu...`, en: `Detailed description of the proposal and expected impact...` },

  cancel: { cs: `Zrušit`, en: `Cancel` },
  creating: { cs: `Vytvářím…`, en: `Creating…` },
};

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

type SectionTab = 'proposals' | 'treasury' | 'parliament' | 'guardians' | 'roadmap';

const TABS: { key: SectionTab; labelCs: string; labelEn: string; icon: typeof Gavel }[] = [
  { key: 'proposals', labelCs: 'Návrhy', labelEn: 'Proposals', icon: Gavel },
  { key: 'treasury', labelCs: 'Treasury', labelEn: 'Treasury', icon: Landmark },
  { key: 'parliament', labelCs: 'Parlament', labelEn: 'Parliament', icon: Globe2 },
  { key: 'guardians', labelCs: 'Guardians', labelEn: 'Guardians', icon: ShieldCheck },
  { key: 'roadmap', labelCs: 'Roadmap', labelEn: 'Roadmap', icon: Route },
];

function StatCard({
  icon,
  colorClass,
  bgClass,
  label,
  value,
  sub,
  tip,
  rc = '6, 105, 40',
}: {
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  label: string;
  value: string;
  sub?: string;
  tip?: string;
  rc?: string;
}) {
  return (
    <div className="zion-rainbow-card p-4 transition-colors" style={{ '--rc': rc } as CSSProperties}>
      <div className={`flex items-center justify-center h-8 w-8 rounded-xl ${bgClass} mb-3 ${colorClass} [&>svg]:h-4 [&>svg]:w-4`}>
        {icon}
      </div>
      <div className="flex items-center gap-1 mb-0.5">
        <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
        {tip && (
          <div className="relative group/tooltip">
            <HelpCircle className="h-3 w-3 text-gray-600 cursor-help" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/tooltip:block w-44 rounded-lg border border-white/10 bg-black/90 backdrop-blur-xl px-2 py-1.5 text-[11px] text-gray-300 shadow-xl z-20">
              {tip}
            </div>
          </div>
        )}
      </div>
      <p className="text-lg font-bold text-white font-mono mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

const getPhases = (cs: boolean, lang: Lang) => [
  {
    title: tx5(DaoCopy.phase1LiveFoundation, lang),
    bullets: cs
      ? ['Hybridní lifecycle návrhů běží (vytvořit → hlasovat → sečíst)', 'Hlasovací síla = L1 zůstatek ZION ve snapshot bloku', 'Treasury signer schválení koordinovaná přes approval záznamy']
      : ['Hybrid proposal lifecycle is live (create → vote → tally)', 'Voting power = L1 ZION balance at the snapshot block', 'Treasury signer approvals coordinated via approval records'],
  },
  {
    title: tx5(DaoCopy.phase2DaoParliament, lang),
    bullets: cs
      ? ['DAO Parlament — čtyři komory: Péče, Opravy, Poznání, Horizontu', 'Consent registry a co-admin role — návrh a prototyp', 'Hiran jako zrcadlo a pomocník pro drafty — lidský sponsor povinný']
      : ['DAO Parliament — four chambers: Care, Restoration, Knowledge, Horizon', 'Consent registry and co-admin roles — design and prototype', 'Hiran as a mirror and drafting aid — a human sponsor is required'],
  },
  {
    title: tx5(DaoCopy.phase3EarthNetwork, lang),
    bullets: cs
      ? ['Síť Země — symbolický cíl 144 000 earth guardianů (registry pending)', 'Dobrovolná globální síť lokálních kruhů — žádný cap ani privilegovaná třída', 'Transparentní granty a auditovaná governance']
      : ['Earth Network — symbolic goal of 144,000 earth guardians (registry pending)', 'Voluntary global network of local circles — no cap and no privileged class', 'Transparent grants and auditable governance'],
  },
];

const getQuickLinks = (cs: boolean, lang: Lang) => [
  { label: tx5(DaoCopy.governanceDocs, lang), href: '/docs', description: tx5(DaoCopy.proposalFlowVotingPowerEmergen, lang) },
  { label: tx5(DaoCopy.treasuryDashboard, lang), href: '/dashboard', description: tx5(DaoCopy.realTimeBalancesAllocationOver, lang) },
  { label: tx5(DaoCopy.defiHub, lang), href: '/market', description: tx5(DaoCopy.swapBridgeAndPortfolioOnBaseMa, lang) },
];

const getFaqs = (cs: boolean, lang: Lang) => [
  {
    q: tx5(DaoCopy.howDoIBecomeADaoGuardian, lang),
    a: tx5(DaoCopy.guardiansAreSelectedBasedOnVer, lang),
  },
  {
    q: tx5(DaoCopy.howDoesVotingPowerWork, lang),
    a: tx5(DaoCopy.everyZionHolderHasBaseVotingPo, lang),
  },
  {
    q: tx5(DaoCopy.whatIsTheHumanitarianTithe, lang),
    a: tx5(DaoCopy.k10OfMiningRewardsGoIntoTheDaoH, lang),
  },
  {
    q: tx5(DaoCopy.whenWillTheDaoBeFullyOnChain, lang),
    a: tx5(DaoCopy.theHybridDaoPhaseBeginsInQ2202, lang),
  },
];

export default function DaoPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const { user, authenticated } = useAuth();
  const zionAddress = user?.linkedAddresses?.find((a) => a.chainType === 'zion-l1')?.address ?? user?.address ?? '';

  const [stats, setStats] = useState<DAOStatsType | null>(null);
  const [treasury, setTreasury] = useState<DAOTreasuryOverview | null>(null);
  const [treasuryOps, setTreasuryOps] = useState<TreasuryOp[]>([]);
  const [proposals, setProposals] = useState<GovernanceProposal[]>([]);
  const [proposalFilter, setProposalFilter] = useState<'all' | 'open' | 'awaiting' | 'passed' | 'executed' | 'failed'>('all');
  const [loading, setLoading] = useState(true);
  const [daemonOnline, setDaemonOnline] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<SectionTab>('proposals');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createType, setCreateType] = useState<string>('Parameter');
  const [paramName, setParamName] = useState('');
  const [paramCurrent, setParamCurrent] = useState('');
  const [paramProposed, setParamProposed] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amountZion, setAmountZion] = useState('');
  const [purpose, setPurpose] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [category, setCategory] = useState('');
  const [region, setRegion] = useState('');
  const [emergencyAction, setEmergencyAction] = useState('');
  const [justification, setJustification] = useState('');
  const [candidateAddress, setCandidateAddress] = useState('');
  const [communityName, setCommunityName] = useState('');
  const [offenseCategory, setOffenseCategory] = useState('');
  const [expulsionTier, setExpulsionTier] = useState('1');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [guardianRegistry, setGuardianRegistry] = useState<GuardianRegistry | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<{
    online: boolean;
    l1_locks_detected: number;
    l1_locks_finalized: number;
    evm_mints_confirmed: number;
    last_l1_height: number;
    errors_total: number;
  } | null>(null);

  const phases = getPhases(cs, lang);
  const quickLinks = getQuickLinks(cs, lang);
  const faqs = getFaqs(cs, lang);

  useEffect(() => { loadDAOData(); }, []);

  async function loadDAOData() {
    try {
      setLoading(true);
      const [health, statsData, proposalsData, treasuryData, opsData, guardiansData, bridgeData] = await Promise.all([
        getDAOHealth(),
        getDAOStats(),
        getGovernanceProposals(),
        getDAOTreasuryOverview(),
        getTreasuryOps(),
        getGuardians(),
        fetch('/api/bridge/status', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
      ]);
      setStats(statsData);
      setProposals(proposalsData);
      setTreasury(treasuryData);
      setTreasuryOps(opsData);
      setGuardianRegistry(guardiansData);
      setDaemonOnline(health.status === 'ok' || health.status === 'online');
      if (bridgeData) setBridgeStatus(bridgeData);
    } catch {
      setDaemonOnline(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleVote(proposalId: string, voteType: string) {
    if (!authenticated) {
      alert(tx5(DaoCopy.signInRequired, lang));
      return;
    }
    try {
      // Voter + weight are resolved server-side from the ZIS session and the
      // L1 balance at the proposal snapshot block — the address passed here is
      // only a hint; the API replaces it with the authenticated identity.
      await castGovernanceVote(parseInt(proposalId, 10), zionAddress, voteType as 'for' | 'against' | 'abstain');
      await loadDAOData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Vote failed');
    }
  }

  async function handleCreateProposal(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!authenticated) {
      setCreateError(tx5(DaoCopy.signInRequired, lang));
      return;
    }
    if (!createTitle.trim() || !createDesc.trim()) {
      setCreateError(tx5(DaoCopy.pleaseEnterATitleAndDescriptio, lang));
      return;
    }
    setCreateBusy(true);
    try {
      const zionAmount = Math.floor(parseFloat(amountZion) || 0);
      // Only the guardian-rotation types carry a hash commitment field.
      const descHash = (createType === 'Admission' || createType === 'Expulsion')
        ? await sha256Hex(createDesc.trim())
        : '';
      const proposalType: ProposalTypeInput = (() => {
        switch (createType) {
          case 'Treasury':
            return { kind: 'Treasury', data: { recipient: recipient.trim(), amount: zionAmount * 1_000_000, purpose: purpose.trim() } };
          case 'Grant':
            return { kind: 'Grant', data: { recipient: recipient.trim(), amount: zionAmount * 1_000_000, milestones: [], duration_days: parseInt(durationDays, 10) || 30 } };
          case 'Humanitarian':
            return { kind: 'Humanitarian', data: { category: category.trim(), amount: zionAmount * 1_000_000, region: region.trim(), description: createDesc.trim() } };
          case 'Emergency':
            return { kind: 'Emergency', data: { action: emergencyAction.trim(), justification: justification.trim() } };
          case 'Admission':
            return { kind: 'Admission', data: { candidate_id: candidateAddress.trim(), gate_scores_hash: descHash, sponsoring_guardians: [], community: communityName.trim() || 'zion' } };
          case 'Expulsion':
            return { kind: 'Expulsion', data: { accused_id: candidateAddress.trim(), offense_category: offenseCategory.trim() || 'conduct', investigation_hash: descHash, defense_hash: null, tier: Math.min(3, Math.max(1, parseInt(expulsionTier, 10) || 1)) } };
          default:
            return { kind: 'Parameter', data: { parameter_name: paramName.trim() || 'general', current_value: paramCurrent.trim(), proposed_value: paramProposed.trim() } };
        }
      })();
      await createGovernanceProposal({
        proposer: zionAddress,
        title: createTitle.trim(),
        description: createDesc.trim(),
        proposal_type: proposalType,
      });
      setCreateOpen(false);
      setCreateTitle('');
      setCreateDesc('');
      setCreateType('Parameter');
      setParamName(''); setParamCurrent(''); setParamProposed('');
      setRecipient(''); setAmountZion(''); setPurpose('');
      setDurationDays(''); setCategory(''); setRegion('');
      setEmergencyAction(''); setJustification('');
      setCandidateAddress(''); setCommunityName(''); setOffenseCategory(''); setExpulsionTier('1');
      await loadDAOData();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : (tx5(DaoCopy.failedToCreateProposal, lang)));
    } finally {
      setCreateBusy(false);
    }
  }

  const totalProposals = stats?.governance.total_proposals ?? 0;
  const activeProposals = stats?.active ?? 0;
  const guardiansCount = daemonOnline === true ? stats?.guardian_count ?? 0 : 0;
  const spendableZion = treasury?.spendable === true ? treasury.spendable_zion ?? 0 : 0;
  const multisigLabel = daemonOnline === true ? stats?.multisig ?? treasury?.multisig ?? '—' : '—';
  const filteredProposals = proposals.filter((p) => {
    const s = p.state.toUpperCase();
    switch (proposalFilter) {
      case 'open': return p.is_voting_open;
      case 'awaiting': return s === 'ACTIVE' && !p.is_voting_open;
      case 'passed': return s === 'PASSED' || s === 'TIMELOCKED';
      case 'executed': return s === 'EXECUTED';
      case 'failed': return s === 'FAILED' || s === 'REJECTED' || s === 'CANCELLED' || s === 'EXPIRED';
      default: return true;
    }
  });

  return (
    <div className="zion-page text-white relative">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-36 -left-28 h-[520px] w-[520px] rounded-full bg-zion-purple/18 blur-3xl" />
        <div className="absolute top-40 -right-24 h-[420px] w-[420px] rounded-full bg-zion-cyan/14 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[420px] w-[620px] rounded-full bg-zion-gold/10 blur-3xl" />
      </div>

      <div className="zion-container max-w-7xl relative z-10 space-y-16 pb-24">

        {/* ── HERO ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="zion-rainbow-card p-6 md:p-10"
          style={{ '--rc': '6, 105, 40' } as CSSProperties}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
                <Crown className="h-4 w-4" />
                DAO 2.0 · {tx5(DaoCopy.governance, lang)}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{tx5(DaoCopy.treasuryProposalsVoting, lang)}</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {tx5(DaoCopy.shapeZionSFutureTogether, lang)}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {tx5(DaoCopy.zionSDaoGovernsTreasuryAllocat, lang)}
              </p>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className={`zion-badge ${daemonOnline === false ? 'border-zion-purple/30 bg-zion-purple/10 text-zion-purple' : daemonOnline === true ? 'zion-badge-green' : ''}`}>
                  <span className={`h-2 w-2 rounded-full ${daemonOnline === false ? 'bg-zion-purple' : daemonOnline === true ? 'bg-zion-cyan animate-pulse' : 'bg-gray-500 animate-pulse'}`} />
                  {daemonOnline === false ? (tx5(DaoCopy.daemonOffline, lang)) : daemonOnline === true ? (tx5(DaoCopy.daemonOnline, lang)) : (tx5(DaoCopy.checking, lang))}
                </span>
                {stats && (
                  <span className="zion-badge">
                    <Scale className="h-3.5 w-3.5 text-zion-gold" />
                    <span className="text-gray-300">{tx5(DaoCopy.quorum, lang)}</span>
                    <span className="font-mono text-white">{stats.quorum_percent}%</span>
                  </span>
                )}
                {stats && (
                  <span className="zion-badge">
                    <Activity className="h-3.5 w-3.5 text-zion-cyan" />
                    <span className="text-gray-300">{tx5(DaoCopy.period, lang)}</span>
                    <span className="font-mono text-white">{stats.voting_period_days}d</span>
                  </span>
                )}
                {bridgeStatus && (
                  <span className={`zion-badge ${bridgeStatus.online ? 'zion-badge-green' : 'border-zion-purple/30 bg-zion-purple/10 text-zion-purple'}`}>
                    <ArrowLeftRight className="h-3.5 w-3.5 text-zion-cyan" />
                    <span className="text-gray-300">Bridge:</span>
                    <span className={bridgeStatus.online ? 'text-zion-cyan' : 'text-zion-purple'}>{bridgeStatus.online ? (tx5(DaoCopy.online, lang)) : (tx5(DaoCopy.offline, lang))}</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-4">
                <button onClick={loadDAOData} disabled={loading} className="zion-button-primary disabled:opacity-50">
                  {loading ? (tx5(DaoCopy.loading, lang)) : (tx5(DaoCopy.refreshData, lang))}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <Link href="/docs" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                  {tx5(DaoCopy.governanceDocs_2, lang)}
                </Link>
              </div>
            </div>

            {/* Quick info side card */}
            <div className="w-full lg:max-w-md space-y-3">
              <div className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{tx5(DaoCopy.quickOverview, lang)}</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Landmark className="h-4 w-4 text-zion-gold" />
                      {tx5(DaoCopy.treasury, lang)}
                    </div>
                    <span className="font-mono text-white">{(treasury?.total_zion ?? 0).toLocaleString()} ZION</span>
                  </div>
                  <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Wallet className="h-4 w-4 text-zion-cyan" />
                      {tx5(DaoCopy.spendableNow, lang)}
                    </div>
                    <span className="font-mono text-white">{spendableZion.toLocaleString()} ZION</span>
                  </div>
                  <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Gavel className="h-4 w-4 text-zion-cyan" />
                      {tx5(DaoCopy.proposals, lang)}
                    </div>
                    <span className="font-mono text-white">{totalProposals.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <ShieldCheck className="h-4 w-4 text-zion-gold" />
                      {tx5(DaoCopy.guardians, lang)}
                    </div>
                    <span className="font-mono text-white">{multisigLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── Daemon status ── */}
        {!loading && daemonOnline === false && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="zion-section p-6">
            <div className="flex items-start gap-3">
              <Info className="h-6 w-6 text-zion-purple mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-zion-purple">{tx5(DaoCopy.daoDaemonPhase2HybridDao, lang)}</p>
                <p className="text-sm text-blue-200/80 mt-1">
                  {tx5(DaoCopy.theOnChainDaoGovernanceDaemonW, lang)}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Quick Stats ── */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="zion-section"
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(DaoCopy.telemetry, lang)}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <Activity className="h-7 w-7 text-zion-cyan" />
                {tx5(DaoCopy.daoStatistics, lang)}
              </h2>
              <p className="text-sm text-gray-400">
                {tx5(DaoCopy.governanceMetricsAggregatedFro, lang)}
              </p>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="zion-rainbow-card p-4 animate-pulse"
                    style={{ '--rc': '6, 105, 40' } as CSSProperties}
                  >
                    <div className="h-8 w-8 bg-white/5 rounded-xl mb-3" />
                    <div className="h-3 w-16 bg-white/5 rounded mb-2" />
                    <div className="h-6 w-20 bg-white/5 rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <StatCard
                  icon={<Landmark className="h-5 w-5" />}
                  colorClass="text-zion-gold"
                  bgClass="bg-zion-gold/10"
                  rc="252, 209, 22"
                  label={tx5(DaoCopy.treasury, lang)}
                  value={`${(treasury?.total_zion ?? 0).toLocaleString()} ZION`}
                  sub={tx5(DaoCopy.totalBalance, lang)}
                  tip={tx5(DaoCopy.totalTreasuryBalanceIncludingA, lang)}
                />
                <StatCard
                  icon={<Wallet className="h-5 w-5" />}
                  colorClass="text-zion-cyan"
                  bgClass="bg-zion-cyan/10"
                  rc="6, 105, 40"
                  label={tx5(DaoCopy.spendableNow, lang)}
                  value={`${spendableZion.toLocaleString()} ZION`}
                  sub={tx5(DaoCopy.immediatelyUsable, lang)}
                  tip={tx5(DaoCopy.balanceAvailableForGovernanceS, lang)}
                />
                <StatCard
                  icon={<Gavel className="h-5 w-5" />}
                  colorClass="text-zion-cyan"
                  bgClass="bg-zion-cyan/10"
                  rc="6, 105, 40"
                  label={tx5(DaoCopy.proposals, lang)}
                  value={totalProposals.toLocaleString()}
                  sub={tx5(DaoCopy.createdTotal, lang)}
                />
                <StatCard
                  icon={<Activity className="h-5 w-5" />}
                  colorClass="text-zion-cyan"
                  bgClass="bg-zion-cyan/10"
                  rc="6, 105, 40"
                  label={tx5(DaoCopy.active, lang)}
                  value={activeProposals.toLocaleString()}
                  sub={(stats?.awaiting_tally ?? 0) > 0 ? `${stats?.awaiting_tally} ${tx5(DaoCopy.votingClosedAwaitingTally, lang)}` : tx5(DaoCopy.ongoingVotes, lang)}
                />
                <StatCard
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  colorClass="text-zion-gold"
                  bgClass="bg-zion-gold/10"
                  rc="252, 209, 22"
                  label={tx5(DaoCopy.passed, lang)}
                  value={(stats?.passed ?? 0).toLocaleString()}
                  sub={tx5(DaoCopy.successfulProposals, lang)}
                />
                <StatCard
                  icon={<Users className="h-5 w-5" />}
                  colorClass="text-zion-gold"
                  bgClass="bg-zion-gold/10"
                  rc="252, 209, 22"
                  label={tx5(DaoCopy.voters, lang)}
                  value={(stats?.unique_voters ?? 0).toLocaleString()}
                  sub={`${stats?.total_votes_cast ?? 0} ${cs ? 'hlasů celkem' : t5('votes cast', lang)}`}
                />
                <StatCard
                  icon={<ArrowLeftRight className="h-5 w-5" />}
                  colorClass="text-zion-cyan"
                  bgClass="bg-zion-cyan/10"
                  rc="6, 105, 40"
                  label={tx5(DaoCopy.bridge, lang)}
                  value={bridgeStatus?.online ? (tx5(DaoCopy.online, lang)) : (tx5(DaoCopy.offline, lang))}
                  sub={tx5(DaoCopy.l2Relay, lang)}
                  tip={tx5(DaoCopy.statusOfTheCrossChainRelayConn, lang)}
                />
                <StatCard
                  icon={<Link2 className="h-5 w-5" />}
                  colorClass="text-zion-gold"
                  bgClass="bg-zion-gold/10"
                  rc="252, 209, 22"
                  label="wZION Mints"
                  value={bridgeStatus?.evm_mints_confirmed?.toLocaleString() ?? '—'}
                  sub={tx5(DaoCopy.confirmedOnBase, lang)}
                  tip={tx5(DaoCopy.numberOfWzionMintedOnBaseAfter, lang)}
                />
              </div>
            )}
          </motion.div>
        </section>

        {/* ── Tab Navigation ── */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.02 }}
            className="zion-rainbow-card p-4 md:p-5"
            style={{ '--rc': '6, 105, 40' } as CSSProperties}
          >
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <span className="text-[11px] uppercase tracking-[0.3em] text-gray-500 mr-1 hidden sm:inline">
                {tx5(DaoCopy.daoSections, lang)}
              </span>
              {TABS.map((t) => {
                const Icon = t.icon;
                const isActive = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3 md:px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'zion-rainbow-sub text-white'
                        : 'border border-white/10 bg-black/40 text-gray-300 hover:border-white/25 hover:text-white'
                    }`}
                    style={isActive ? { '--rc': '252, 209, 22' } as CSSProperties : undefined}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {cs ? t.labelCs : t.labelEn}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </section>

        {/* ── Active Tab Content ── */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'proposals' && (
            <div className="space-y-12">
              {stats && (
                <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="zion-section">
                  <DAOStats stats={stats} />
                </motion.section>
              )}

              <section className="zion-section">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(DaoCopy.governanceProposals, lang)}</p>
                    <h2 className="text-3xl font-semibold text-white">{tx5(DaoCopy.voteOnProtocolDecisions, lang)}</h2>
                  </div>
                  <button
                    onClick={() => authenticated ? setCreateOpen(true) : alert(tx5(DaoCopy.signInRequired, lang))}
                    className="zion-button-primary"
                  >
                    <Plus className="h-4 w-4" />
                    {tx5(DaoCopy.createProposal, lang)}
                  </button>
                </div>
                {!authenticated && (
                  <div className="zion-rainbow-card p-4 mb-6 flex items-center gap-3" style={{ '--rc': '147, 51, 234' } as CSSProperties}>
                    <Info className="h-5 w-5 text-zion-purple shrink-0" />
                    <p className="text-sm text-gray-300">{tx5(DaoCopy.signInToVote, lang)}</p>
                  </div>
                )}
                {/* Status filter — 'Awaiting tally' is derived (Active + voting closed) */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {(['all', 'open', 'awaiting', 'passed', 'executed', 'failed'] as const).map((f) => {
                    const labels = {
                      all: cs ? 'Vše' : t5('All', lang),
                      open: cs ? 'Hlasování' : t5('Voting', lang),
                      awaiting: cs ? 'Čeká na sčítání' : t5('Awaiting tally', lang),
                      passed: cs ? 'Schváleno' : t5('Passed', lang),
                      executed: cs ? 'Exekutováno' : t5('Executed', lang),
                      failed: cs ? 'Neúspěšné' : t5('Failed', lang),
                    };
                    const active = proposalFilter === f;
                    return (
                      <button
                        key={f}
                        onClick={() => setProposalFilter(f)}
                        className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-wider border transition ${
                          active ? 'border-zion-gold/40 bg-zion-gold/10 text-zion-gold' : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'
                        }`}
                      >
                        {labels[f]}
                      </button>
                    );
                  })}
                </div>
                {loading ? (
                  <div className="text-center py-12">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-zion-gold border-r-transparent" />
                    <p className="mt-4 text-gray-400">{tx5(DaoCopy.loadingProposals, lang)}</p>
                  </div>
                ) : filteredProposals.length === 0 && proposals.length > 0 ? (
                  <p className="text-sm text-gray-500 py-8 text-center">{cs ? 'Žádné návrhy v této kategorii.' : t5('No proposals in this category.', lang)}</p>
                ) : proposals.length === 0 ? (
                  <div className="zion-rainbow-card p-12 text-center" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
                    <Crown className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                    <p className="text-lg font-semibold text-white mb-2">{tx5(DaoCopy.noProposalsYet, lang)}</p>
                    <p className="text-gray-400">{tx5(DaoCopy.beTheFirstToCreateAGovernanceP, lang)}</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {filteredProposals.map((proposal) => (
                      <ProposalCard key={proposal.id} proposal={proposal} onVote={handleVote} />
                    ))}
                  </div>
                )}
                {/* D6: on-chain vote delegation memo generator */}
                <div className="mt-6">
                  <DelegateMemoCard />
                </div>
              </section>
            </div>
          )}

          {activeTab === 'treasury' && (
            <div className="space-y-12">
              <motion.section
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="zion-rainbow-card p-8"
                style={{ '--rc': '6, 105, 40' } as CSSProperties}
              >
                <div className="mb-6">
                  <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Treasury</p>
                  <h2 className="text-3xl font-semibold text-white">{tx5(DaoCopy.treasuryOverview, lang)}</h2>
                </div>
                {treasury && (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                    <div className="zion-rainbow-sub p-4" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                      <p className="text-xs uppercase tracking-wider text-gray-400">Multisig</p>
                      <p className="text-lg font-semibold text-white mt-1">{treasury.multisig}</p>
                    </div>
                    <div className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
                      <p className="text-xs uppercase tracking-wider text-gray-400">{tx5(DaoCopy.spendableNow, lang)}</p>
                      <p className="text-lg font-semibold text-white mt-1">{spendableZion.toLocaleString()} ZION</p>
                    </div>
                    <div className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
                      <p className="text-xs uppercase tracking-wider text-gray-400">{tx5(DaoCopy.pendingOps, lang)}</p>
                      <p className="text-lg font-semibold text-white mt-1">{treasury.pending_operations}</p>
                    </div>
                    <div className="zion-rainbow-sub p-4" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                      <p className="text-xs uppercase tracking-wider text-gray-400">{tx5(DaoCopy.dailyLimit, lang)}</p>
                      <p className="text-lg font-semibold text-white mt-1">{treasury.daily_spend_limit_zion.toLocaleString()} ZION</p>
                    </div>
                  </div>
                )}
                <div className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                  <p className="text-xs uppercase tracking-wider text-gray-400 mb-4">{tx5(DaoCopy.lockState, lang)}</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-sm">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-gray-500">{tx5(DaoCopy.currentBlock, lang)}</p>
                      <p className="font-mono text-white mt-0.5">{treasury?.chain_height != null ? treasury.chain_height.toLocaleString() : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-gray-500">{tx5(DaoCopy.unlockBlock, lang)}</p>
                      <p className="font-mono text-white mt-0.5">{treasury?.unlock_height != null ? treasury.unlock_height.toLocaleString() : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-gray-500">{tx5(DaoCopy.timeLockLabel, lang)}</p>
                      <p className="font-mono text-white mt-0.5">
                        {treasury?.time_locked == null
                          ? tx5(DaoCopy.stateUnknown, lang)
                          : treasury.time_locked
                            ? tx5(DaoCopy.stateLocked, lang)
                            : tx5(DaoCopy.stateReached, lang)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-gray-500">{tx5(DaoCopy.adminUnlockLabel, lang)}</p>
                      <p className="font-mono text-white mt-0.5">
                        {treasury?.admin_unlock_known !== true
                          ? tx5(DaoCopy.stateUnknown, lang)
                          : treasury.admin_unlocked === true
                            ? tx5(DaoCopy.stateUnlocked, lang)
                            : tx5(DaoCopy.stateNotUnlocked, lang)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-gray-500">{tx5(DaoCopy.spendableNow, lang)}</p>
                      <p className="font-mono text-white mt-0.5">{spendableZion.toLocaleString()} ZION</p>
                    </div>
                  </div>
                </div>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="zion-rainbow-card p-8"
                style={{ '--rc': '6, 105, 40' } as CSSProperties}
              >
                <div className="flex flex-col gap-2 mb-6">
                  <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{multisigLabel}</p>
                  <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                    <ShieldCheck className="h-7 w-7 text-zion-gold" />
                    {tx5(DaoCopy.multisigOperations, lang)}
                  </h2>
                  <p className="text-sm text-gray-400 max-w-3xl">
                    {tx5(DaoCopy.approvalRecordsExplainer, lang)}
                  </p>
                </div>
                <TreasuryOpsPanel
                  ops={treasuryOps}
                  emptyLabel={tx5(DaoCopy.noTreasuryOpsYet, lang)}
                  onChanged={() => { void loadDAOData(); }}
                />
              </motion.section>

              <motion.section
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="zion-rainbow-card p-8"
                style={{ '--rc': '6, 105, 40' } as CSSProperties}
              >
                <div className="flex flex-col gap-2 mb-6">
                  <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(DaoCopy.bridgeVault, lang)}</p>
                  <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                    <ArrowLeftRight className="h-7 w-7 text-zion-gold" />
                    {tx5(DaoCopy.k100mZionBaseMainnet, lang)}
                  </h2>
                  <p className="text-gray-300 max-w-2xl mt-2">
                    {tx5(DaoCopy.k6UtxoLockTransactions1667mZion, lang)}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
                    <p className="text-xs uppercase tracking-wider text-gray-400">{tx5(DaoCopy.lockedZion, lang)}</p>
                    <p className="text-lg font-semibold text-white mt-1">~100,000,000</p>
                    <p className="text-xs text-gray-500">6 UTXO locks</p>
                  </div>
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                    <p className="text-xs uppercase tracking-wider text-gray-400">{tx5(DaoCopy.relayStatus, lang)}</p>
                    <p className="text-lg font-semibold mt-1 flex items-center gap-2">
                      {bridgeStatus?.online ? (
                        <>
                          <span className="h-2 w-2 rounded-full bg-zion-cyan animate-pulse" />
                          <span className="text-zion-cyan">Online</span>
                        </>
                      ) : (
                        <>
                          <span className="h-2 w-2 rounded-full bg-gray-500" />
                          <span className="text-gray-400">Offline</span>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{tx5(DaoCopy.l2CrossChainRelay, lang)}</p>
                  </div>
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                    <p className="text-xs uppercase tracking-wider text-gray-400">{tx5(DaoCopy.wzionMints, lang)}</p>
                    <p className="text-lg font-semibold text-white mt-1">{bridgeStatus?.evm_mints_confirmed ?? '—'}</p>
                    <p className="text-xs text-gray-500">{tx5(DaoCopy.confirmedOnBase, lang)}</p>
                  </div>
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
                    <p className="text-xs uppercase tracking-wider text-gray-400">{tx5(DaoCopy.l1Block, lang)}</p>
                    <p className="text-lg font-semibold text-white mt-1">{bridgeStatus?.last_l1_height ?? '—'}</p>
                    <p className="text-xs text-gray-500">{tx5(DaoCopy.lastScan, lang)}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5" />
                    wZION: <span className="text-gray-400 font-mono">0x0c49…2bb6</span>
                  </span>
                  <span className="text-gray-600">·</span>
                  <span>{tx5(DaoCopy.vault, lang)} <span className="text-gray-400 font-mono">zion1w0r0…w0t0</span></span>
                  <span className="text-gray-600">·</span>
                  <span>{tx5(DaoCopy.finality60Blocks, lang)}</span>
                </div>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="zion-rainbow-card p-10"
                style={{ '--rc': '6, 105, 40' } as CSSProperties}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Heart className="h-8 w-8 text-zion-cyan" />
                  <h2 className="text-3xl font-semibold text-white">{tx5(DaoCopy.humanitarianTithe, lang)}</h2>
                </div>
                <p className="text-lg text-gray-300 mb-6">
                  {tx5(DaoCopy.k10OfAllMiningRewardsFundCleanW, lang)}
                </p>
                {stats && (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { label: tx5(DaoCopy.totalProjects, lang), value: stats.humanitarian.total_proposals },
                      { label: tx5(DaoCopy.activeFunding, lang), value: stats.humanitarian.active_proposals },
                      { label: tx5(DaoCopy.beneficiaries, lang), value: stats.humanitarian.total_beneficiaries.toLocaleString() },
                      { label: tx5(DaoCopy.fundedAmount, lang), value: stats.humanitarian.total_funded.toLocaleString() },
                    ].map((s) => (
                      <div key={s.label} className="zion-rainbow-sub p-4" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
                        <p className="text-xs uppercase tracking-wider text-gray-400">{s.label}</p>
                        <p className="text-3xl font-bold text-white">{s.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.section>
            </div>
          )}

          {activeTab === 'parliament' && (
            <ParliamentVision
              lang={cs ? 'cs' : 'en'}
              treasuryGuardians={guardiansCount}
              multisig={multisigLabel}
            />
          )}

          {activeTab === 'guardians' && (
            <div className="space-y-12">
              {/* Live guardian registry — D3 on-chain rotation data */}
              <motion.section
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="zion-rainbow-card p-8"
                style={{ '--rc': '252, 209, 22' } as CSSProperties}
              >
                <div className="flex flex-col gap-2 mb-6">
                  <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(DaoCopy.onChainRegistry, lang)}</p>
                  <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                    <ShieldCheck className="h-7 w-7 text-zion-gold" />
                    {tx5(DaoCopy.liveGuardianRegistry, lang)}
                  </h2>
                  <p className="text-sm text-gray-400 max-w-3xl">
                    {tx5(DaoCopy.liveGuardianRegistryDesc, lang)}
                  </p>
                </div>
                {guardianRegistry ? (
                  <div className="space-y-5">
                    <div className="flex items-center gap-3 zion-rainbow-sub px-4 py-2.5 text-sm w-fit" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                      <Users className="h-4 w-4 text-zion-gold" />
                      <span className="text-gray-400">{tx5(DaoCopy.multisigThreshold, lang)}:</span>
                      <span className="font-mono font-semibold text-zion-gold">{guardianRegistry.threshold}-of-{guardianRegistry.total}</span>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                          <Crown className="h-4 w-4 text-zion-gold" />
                          {tx5(DaoCopy.activeGuardians, lang)}
                          <span className="text-xs text-gray-500 font-normal">({guardianRegistry.guardians.length})</span>
                        </h3>
                        {guardianRegistry.guardians.length === 0 ? (
                          <p className="text-xs text-gray-500">{tx5(DaoCopy.noGuardiansConfigured, lang)}</p>
                        ) : (
                          <div className="space-y-2">
                            {guardianRegistry.guardians.map((g) => (
                              <div key={g.address} className="zion-rainbow-sub px-3 py-2.5" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium text-white truncate">{g.name || g.address}</span>
                                  <span className="zion-badge-green text-[11px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider shrink-0">active</span>
                                </div>
                                {g.name && <p className="text-[11px] text-gray-500 font-mono truncate mt-0.5">{g.address}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="zion-rainbow-sub p-5" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
                        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-zion-cyan" />
                          {tx5(DaoCopy.registeredCandidates, lang)}
                          <span className="text-xs text-gray-500 font-normal">({guardianRegistry.candidates.length})</span>
                        </h3>
                        {guardianRegistry.candidates.length === 0 ? (
                          <p className="text-xs text-gray-500">{tx5(DaoCopy.noCandidatesRegistered, lang)}</p>
                        ) : (
                          <div className="space-y-2">
                            {guardianRegistry.candidates.map((c) => (
                              <div key={c.address} className="zion-rainbow-sub px-3 py-2.5" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-mono text-gray-200 truncate">{c.address}</span>
                                </div>
                                <p className="text-[11px] text-gray-500 mt-0.5">{tx5(DaoCopy.candidateAwaitingAdmission, lang)}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <GuardianRegisterCard />
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="zion-rainbow-sub p-5 text-sm text-gray-500" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                      {daemonOnline === false ? tx5(DaoCopy.noGuardiansConfigured, lang) : '…'}
                    </div>
                    <GuardianRegisterCard />
                  </div>
                )}
              </motion.section>

              <motion.section
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="zion-rainbow-card p-8"
                style={{ '--rc': '6, 105, 40' } as CSSProperties}
              >
                <div className="flex flex-col gap-2 mb-6">
                  <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(DaoCopy.multiLayerGovernance, lang)}</p>
                  <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                    <Crown className="h-7 w-7 text-zion-gold" />
                    {tx5(DaoCopy.coAdminSacredTrinity, lang)}
                  </h2>
                  <p className="text-sm text-gray-400 max-w-3xl">
                    {tx5(DaoCopy.multiLayerDaoGovernanceAcrossL, lang)}
                  </p>
                </div>
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div className="zion-rainbow-sub p-5" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck className="h-5 w-5 text-zion-cyan" />
                      <h3 className="font-semibold text-white">{tx5(DaoCopy.coAdminSystem, lang)}</h3>
                    </div>
                    <p className="text-sm text-gray-400 mb-3">
                      {tx5(DaoCopy.eachLayerL1L6HasACoAdminForTec, lang)}
                    </p>
                    <div className="space-y-1.5 text-xs">
                      {(['L1 Consensus', 'L2 DAO/Bridge', 'L3 WARP', 'L4 Oasis', 'L5 Free World', 'L6 Issobella'] as const).map((layer) => (
                        <div key={layer} className="flex items-center justify-between zion-rainbow-sub px-3 py-1.5" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
                          <span className="text-gray-300 font-mono">{layer}</span>
                          <span className="text-gray-500">{tx5(DaoCopy.coAdmin, lang)} · {tx5(DaoCopy.daoAuthority, lang)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="h-5 w-5 text-zion-gold" />
                      <h3 className="font-semibold text-white">{tx5(DaoCopy.sacredTrinity, lang)}</h3>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">
                      {tx5(DaoCopy.cosmicArchetypesOfDaoGovernanc, lang)}
                    </p>
                    <div className="space-y-3">
                      {[
                        { name: 'Rama', role: tx5(DaoCopy.stewardConsensusL1, lang), color: 'text-zion-cyan', desc: tx5(DaoCopy.chainDharmaFairMiningProtocolI, lang) },
                        { name: 'Síta', role: tx5(DaoCopy.heartCommunityL5, lang), color: 'text-zion-purple', desc: tx5(DaoCopy.humanitarianFundPhysicalCommun, lang) },
                        { name: 'Hanuman', role: tx5(DaoCopy.guardianBridgeL2, lang), color: 'text-zion-gold', desc: tx5(DaoCopy.bridgingWorldsProtectionFaithf, lang) },
                      ].map((archetype) => (
                        <div key={archetype.name} className="zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-bold text-sm ${archetype.color}`}>{archetype.name}</span>
                            <span className="text-[11px] text-gray-500 uppercase tracking-wider">{archetype.role}</span>
                          </div>
                          <p className="text-xs text-gray-400">{archetype.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="zion-rainbow-sub p-5" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
                  <div className="flex items-center gap-3 mb-3">
                    <Sparkles className="h-5 w-5 text-zion-cyan" />
                    <h3 className="font-semibold text-white">{tx5(DaoCopy.consentEngine, lang)}</h3>
                    <span className="text-[11px] uppercase tracking-widest border border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan px-2 py-0.5 rounded-full font-semibold">L2 DAO</span>
                  </div>
                  <p className="text-sm text-gray-400 max-w-3xl">
                    {tx5(DaoCopy.theConsentMechanismEnsuresCros, lang)}
                  </p>
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                    {[
                      { label: tx5(DaoCopy.propose, lang), detail: tx5(DaoCopy.anyCoAdmin, lang) },
                      { label: tx5(DaoCopy.consent, lang), detail: tx5(DaoCopy.affectedLayers, lang) },
                      { label: tx5(DaoCopy.vetoWindow, lang), detail: '72h' },
                      { label: tx5(DaoCopy.execute, lang), detail: tx5(DaoCopy.afterConsent, lang) },
                    ].map((step) => (
                      <div key={step.label} className="zion-rainbow-sub p-2.5 text-center" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
                        <p className="font-semibold text-zion-cyan text-xs">{step.label}</p>
                        <p className="text-gray-500 mt-0.5">{step.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="zion-rainbow-card p-8"
                style={{ '--rc': '6, 105, 40' } as CSSProperties}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
                  <div>
                    <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Tree of Life</p>
                    <h2 className="text-3xl font-semibold text-white">{tx5(DaoCopy.daoCirclesGovernanceTopology, lang)}</h2>
                    <p className="text-gray-300 max-w-2xl mt-2">
                      {tx5(DaoCopy.treeOfLifeServesAsALivingDaoLe, lang)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 zion-rainbow-sub px-4 py-2 text-sm" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
                    <TreeDeciduous className="h-5 w-5 text-zion-cyan" />
                    <span className="text-gray-300">{tx5(DaoCopy.liveTopology, lang)}</span>
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-3">
                  {[
                    {
                      level: tx5(DaoCopy.crown, lang),
                      title: tx5(DaoCopy.guardiansCouncil, lang),
                      description: tx5(DaoCopy.topDaoGovernanceLayerTreasuryO, lang),
                      Icon: Crown,
                      iconColor: 'text-zion-gold',
                    },
                    {
                      level: tx5(DaoCopy.heart, lang),
                      title: tx5(DaoCopy.buildersCircle, lang),
                      description: tx5(DaoCopy.ecosystemHeartProtocolDevelopm, lang),
                      Icon: Sparkles,
                      iconColor: 'text-zion-cyan',
                    },
                    {
                      level: tx5(DaoCopy.roots, lang),
                      title: tx5(DaoCopy.communityGuild, lang),
                      description: tx5(DaoCopy.daoRootsOpenCommunityContribut, lang),
                      Icon: Users,
                      iconColor: 'text-zion-gold',
                    },
                  ].map((node) => (
                    <div key={node.level} className="zion-rainbow-sub p-5" style={{ '--rc': node.level === 'Koruna' || node.level === 'Crown' ? '252, 209, 22' : node.level === 'Srdce' || node.level === 'Heart' ? '6, 105, 40' : '252, 209, 22' } as CSSProperties}>
                      <div className="flex items-center gap-3">
                        <node.Icon className={`h-5 w-5 ${node.iconColor}`} />
                        <div>
                          <p className="text-xs uppercase tracking-[0.4em] text-gray-100">{node.level}</p>
                          <h3 className="text-xl font-semibold text-white">{node.title}</h3>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-gray-50/90">{node.description}</p>
                    </div>
                  ))}
                </div>
              </motion.section>

            </div>
          )}

          {activeTab === 'roadmap' && (
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="zion-rainbow-card p-8"
              style={{ '--rc': '6, 105, 40' } as CSSProperties}
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(DaoCopy.governancePhases, lang)}</p>
                <h2 className="text-3xl font-semibold text-white">{tx5(DaoCopy.roadToFullDecentralization, lang)}</h2>
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                {phases.map((phase) => (
                  <div key={phase.title} className="zion-rainbow-sub p-6" style={{ '--rc': phase.title.includes('Fáze 1') || phase.title.includes('Phase 1') ? '252, 209, 22' : phase.title.includes('Fáze 2') || phase.title.includes('Phase 2') ? '6, 105, 40' : '252, 209, 22' } as CSSProperties}>
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400">{phase.title}</p>
                    <ul className="mt-4 space-y-2 text-sm text-gray-300">
                      {phase.bullets.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <ShieldCheck className="h-4 w-4 text-zion-gold mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.section>
          )}
        </motion.div>

        {/* ── FAQ ── */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="zion-section"
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{tx5(DaoCopy.support, lang)}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <HelpCircle className="h-7 w-7 text-zion-purple" />
                {tx5(DaoCopy.faq, lang)}
              </h2>
            </div>
            <div className="space-y-3 max-w-3xl">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className="zion-rainbow-sub overflow-hidden"
                  style={{ '--rc': '6, 105, 40' } as CSSProperties}
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="flex w-full items-center justify-between gap-4 p-4 text-left"
                  >
                    <span className="text-sm font-medium text-white">{faq.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${
                        openFaq === i ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="px-4 pb-4 text-xs text-gray-300 leading-relaxed">{faq.a}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── CTA Banner ── */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="zion-cta-banner p-10"
        >
          <h2 className="text-3xl font-semibold text-white text-center mb-3">
            {tx5(DaoCopy.exploreTheZionEcosystem, lang)}
          </h2>
          <p className="text-gray-100 text-center max-w-2xl mx-auto mb-8">
            {tx5(DaoCopy.daoIsTheBridgeBetweenL1Consens, lang)}
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link
              href="/market"
              className="zion-button-primary"
            >
              {tx5(DaoCopy.defiHub, lang)}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/bridge"
              className="zion-button-secondary"
            >
              Bridge
              <ArrowLeftRight className="h-4 w-4" />
            </Link>
            <Link
              href="/docs"
              className="zion-button-secondary"
            >
              Docs
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.section>

        {/* ── Quick links ── */}
        <motion.section
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="zion-rainbow-card p-8"
          style={{ '--rc': '6, 105, 40' } as CSSProperties}
        >
          <h2 className="text-3xl font-semibold text-white text-center mb-8">{tx5(DaoCopy.helpfulLinks, lang)}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {quickLinks.map((link) => (
              <div key={link.label} className="zion-rainbow-sub p-5 hover:bg-white/5 transition-colors" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                <p className="text-sm font-semibold text-white">{link.label}</p>
                <p className="mt-2 text-sm text-gray-300">{link.description}</p>
                <Link href={link.href} target={link.href.startsWith('http') ? '_blank' : undefined} rel={link.href.startsWith('http') ? 'noreferrer' : undefined} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-zion-gold hover:text-zion-gold/80 transition-colors">
                  {tx5(DaoCopy.open, lang)}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Create Proposal Modal ── */}
        {createOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg zion-section p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">{tx5(DaoCopy.newGovernanceProposal, lang)}</h3>
                <button onClick={() => setCreateOpen(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>
              <form onSubmit={handleCreateProposal} className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">{tx5(DaoCopy.proposalTypeLabel, lang)}</label>
                  <select
                    value={createType}
                    onChange={(e) => setCreateType(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-zion-gold focus:outline-none"
                  >
                    <option value="Parameter">{tx5(DaoCopy.typeParameter, lang)}</option>
                    <option value="Treasury">{tx5(DaoCopy.typeTreasury, lang)}</option>
                    <option value="Grant">{tx5(DaoCopy.typeGrant, lang)}</option>
                    <option value="Humanitarian">{tx5(DaoCopy.typeHumanitarian, lang)}</option>
                    <option value="Emergency">{tx5(DaoCopy.typeEmergency, lang)}</option>
                    <option value="Admission">{tx5(DaoCopy.typeAdmission, lang)}</option>
                    <option value="Expulsion">{tx5(DaoCopy.typeExpulsion, lang)}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">{tx5(DaoCopy.title, lang)}</label>
                  <input
                    type="text"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    placeholder={tx5(DaoCopy.eGIncreaseBridgeValidatorThres, lang)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">{tx5(DaoCopy.description, lang)}</label>
                  <textarea
                    value={createDesc}
                    onChange={(e) => setCreateDesc(e.target.value)}
                    rows={4}
                    placeholder={tx5(DaoCopy.detailedDescriptionOfThePropos, lang)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none"
                  />
                </div>

                {createType === 'Parameter' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input type="text" value={paramName} onChange={(e) => setParamName(e.target.value)} placeholder={tx5(DaoCopy.parameterName, lang)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none" />
                    <input type="text" value={paramCurrent} onChange={(e) => setParamCurrent(e.target.value)} placeholder={tx5(DaoCopy.currentValue, lang)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none" />
                    <input type="text" value={paramProposed} onChange={(e) => setParamProposed(e.target.value)} placeholder={tx5(DaoCopy.proposedValue, lang)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none" />
                  </div>
                )}

                {(createType === 'Treasury' || createType === 'Grant') && (
                  <div className="space-y-3">
                    <input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder={tx5(DaoCopy.recipientAddress, lang)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none" />
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" min="0" value={amountZion} onChange={(e) => setAmountZion(e.target.value)} placeholder={tx5(DaoCopy.amountZion, lang)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none" />
                      {createType === 'Grant' ? (
                        <input type="number" min="1" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} placeholder={tx5(DaoCopy.durationDays, lang)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none" />
                      ) : (
                        <input type="text" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={tx5(DaoCopy.purpose, lang)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none" />
                      )}
                    </div>
                  </div>
                )}

                {createType === 'Humanitarian' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder={tx5(DaoCopy.category, lang)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none" />
                    <input type="number" min="0" value={amountZion} onChange={(e) => setAmountZion(e.target.value)} placeholder={tx5(DaoCopy.amountZion, lang)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none" />
                    <input type="text" value={region} onChange={(e) => setRegion(e.target.value)} placeholder={tx5(DaoCopy.region, lang)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none" />
                  </div>
                )}

                {createType === 'Emergency' && (
                  <div className="space-y-3">
                    <input type="text" value={emergencyAction} onChange={(e) => setEmergencyAction(e.target.value)} placeholder={tx5(DaoCopy.emergencyAction, lang)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none" />
                    <input type="text" value={justification} onChange={(e) => setJustification(e.target.value)} placeholder={tx5(DaoCopy.justification, lang)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none" />
                  </div>
                )}

                {(createType === 'Admission' || createType === 'Expulsion') && (
                  <div className="space-y-3">
                    <input type="text" value={candidateAddress} onChange={(e) => setCandidateAddress(e.target.value)} placeholder={createType === 'Admission' ? tx5(DaoCopy.candidateAddress, lang) : tx5(DaoCopy.accusedAddress, lang)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none" />
                    {createType === 'Admission' ? (
                      <>
                        <input type="text" value={communityName} onChange={(e) => setCommunityName(e.target.value)} placeholder={tx5(DaoCopy.communityLabel, lang)} className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none" />
                        <p className="text-[11px] text-gray-500">{tx5(DaoCopy.admissionRequiresOnChainRegistration, lang)}</p>
                      </>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <input type="text" value={offenseCategory} onChange={(e) => setOffenseCategory(e.target.value)} placeholder={tx5(DaoCopy.offenseCategoryLabel, lang)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none" />
                        <input type="number" min="1" max="3" value={expulsionTier} onChange={(e) => setExpulsionTier(e.target.value)} placeholder={tx5(DaoCopy.tierLabel, lang)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none" />
                      </div>
                    )}
                  </div>
                )}

                <div className="zion-rainbow-sub p-3 text-[11px] text-gray-400" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
                  {tx5(DaoCopy.proposalThresholdNote, lang)}{' '}
                  <span className="font-mono text-zion-gold">{((stats?.proposal_threshold ?? 0) / 1_000_000).toLocaleString()} ZION</span>
                  {' · '}{tx5(DaoCopy.votesAreWeightedByZionBalance, lang)}
                </div>

                {createError && (
                  <div className="zion-rainbow-sub p-3 text-sm text-zion-purple" style={{ '--rc': '228, 30, 43' } as CSSProperties}>
                    {createError}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCreateOpen(false)}
                    className="zion-button-secondary flex-1 !px-4 !py-2 !text-sm"
                  >
                    {tx5(DaoCopy.cancel, lang)}
                  </button>
                  <button
                    type="submit"
                    disabled={createBusy}
                    className="zion-button-primary flex-1 !px-4 !py-2 !text-sm disabled:opacity-50"
                  >
                    {createBusy ? (tx5(DaoCopy.creating, lang)) : (tx5(DaoCopy.createProposal, lang))}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
