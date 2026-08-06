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
} from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { useLang } from '@/contexts/LanguageContext';
import DAOStats from '@/components/dao/DAOStats';
import ProposalCard from '@/components/dao/ProposalCard';
import GuardiansTreeClient from '@/components/GuardiansTreeClient';
import {
  getDAOStats,
  getDAOTreasuryOverview,
  getGovernanceProposals,
  castGovernanceVote,
  createGovernanceProposal,
  type GovernanceProposal,
  type DAOStats as DAOStatsType,
  type DAOTreasuryOverview,
} from '@/lib/dao-api';

const DaoCopy = {
  phase1Stewardship2025: { cs: `Fáze 1 · Stewardship (2025)`, en: `Phase 1 · Stewardship (2025)` },
  phase2HybridDao2026: { cs: `Fáze 2 · Hybridní DAO (2026)`, en: `Phase 2 · Hybrid DAO (2026)` },
  phase3FullDao2026: { cs: `Fáze 3 · Plné DAO (2026+)`, en: `Phase 3 · Full DAO (2026+)` },
  governanceDocs: { cs: `Governance dokumentace`, en: `Governance docs` },
  proposalFlowVotingPowerEmergen: { cs: `Proposal flow, hlasovací síla, nouzové klauzule.`, en: `Proposal flow, voting power, emergency clauses.` },
  treasuryDashboard: { cs: `Treasury dashboard`, en: `Treasury dashboard` },
  realTimeBalancesAllocationOver: { cs: `Real-time zůstatky, přehled alokací, tithe.`, en: `Real-time balances, allocation overview, tithe.` },
  defiHub: { cs: `Multichain Hub`, en: `Multichain Hub` },
  swapBridgeAndPortfolioOnBaseMa: { cs: `Swap, bridge a portfolio na Base Mainnet.`, en: `Swap, bridge and portfolio on Base Mainnet.` },
  howDoIBecomeADaoGuardian: { cs: `Jak se stát DAO guardianem?`, en: `How do I become a DAO guardian?` },
  guardiansAreSelectedBasedOnVer: { cs: `Guardians jsou vybíráni na základě prověřené identity, technického příspěvku a consciousness level. Proces začíná nominací v komunitě, následuje peer review a schválení Round Table.`, en: `Guardians are selected based on verified identity, technical contribution, and consciousness level. The process begins with community nomination, followed by peer review and Round Table approval.` },
  howDoesVotingPowerWork: { cs: `Jak funguje hlasovací síla?`, en: `How does voting power work?` },
  everyZionHolderHasBaseVotingPo: { cs: `Každý držitel ZION má základní hlasovací sílu úměrnou zůstatku. Consciousness level a staking mohou sílu navyšovat. Quadratic voting se testuje ve fázi 3.`, en: `Every ZION holder has base voting power proportional to their balance. Consciousness level and staking can increase it. Quadratic voting is being tested in Phase 3.` },
  whatIsTheHumanitarianTithe: { cs: `Co je Humanitarian Tithe?`, en: `What is the Humanitarian Tithe?` },
  k10OfMiningRewardsGoIntoTheDaoH: { cs: `10 % z mining odměn jde do humanitárního fondu DAO. Projekty čisté vody, potravinové bezpečnosti a vzdělávání se schvalují přes governance návrhy.`, en: `10% of mining rewards go into the DAO humanitarian fund. Clean water, food security, and education projects are approved through governance proposals.` },
  whenWillTheDaoBeFullyOnChain: { cs: `Kdy bude plně on-chain DAO?`, en: `When will the DAO be fully on-chain?` },
  theHybridDaoPhaseBeginsInQ2202: { cs: `Hybridní DAO fáze začne v Q2 2026 s on-chain proposal lifecycle. Plné DAO řízené stakery je naplánováno na 2026+.`, en: `The Hybrid DAO phase begins in Q2 2026 with an on-chain proposal lifecycle. Full DAO control by stakers is planned for 2026+.` },
  pleaseEnterATitleAndDescriptio: { cs: `Vyplňte název a popis.`, en: `Please enter a title and description.` },
  failedToCreateProposal: { cs: `Nepodařilo se vytvořit návrh.`, en: `Failed to create proposal.` },
  governance: { cs: `Správa`, en: `Governance` },
  treasuryProposalsVoting: { cs: `Treasury · návrhy · hlasování`, en: `Treasury · proposals · voting` },
  shapeZionSFutureTogether: { cs: `Formuj budoucnost ZION společně`, en: `Shape ZION\'s future together` },
  zionSDaoGovernsTreasuryAllocat: { cs: `DAO ZION řídí alokaci treasury, upgrady protokolu a humanitární iniciativy. Každý držitel ZION má hlasovací sílu — posílenou consciousness level.`, en: `ZION\'s DAO governs treasury allocation, protocol upgrades, and humanitarian initiatives. Every ZION holder has voting power — enhanced by consciousness level.` },
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
  available: { cs: `K dispozici`, en: `Available` },
  proposals: { cs: `Návrhů`, en: `Proposals` },
  guardians: { cs: `Guardians`, en: `Guardians` },
  daoDaemonPhase2HybridDao: { cs: `DAO Daemon — Fáze 2 (Hybridní DAO)`, en: `DAO Daemon — Phase 2 (Hybrid DAO)` },
  theOnChainDaoGovernanceDaemonW: { cs: `On-chain DAO governance daemon bude nasazen s fází Hybrid DAO (Q2 2026). Treasury zůstatky a pravidla jsou aktivní; tvorba návrhů přes UI bude spuštěna s daemonem.`, en: `The on-chain DAO governance daemon will be deployed with the Hybrid DAO phase (Q2 2026). Treasury balance and governance rules are active; proposal creation via UI launches with the daemon.` },
  telemetry: { cs: `Telemetrie`, en: `Telemetry` },
  daoStatistics: { cs: `DAO statistiky`, en: `DAO Statistics` },
  governanceMetricsAggregatedFro: { cs: `Metriky governance agregované z DAO API, treasury a bridge relayeru v reálném čase.`, en: `Governance metrics aggregated from DAO API, treasury, and bridge relayer in real time.` },
  totalBalance: { cs: `celkový zůstatek`, en: `total balance` },
  totalTreasuryBalanceIncludingA: { cs: `Celkový zůstatek treasury včetně alokovaných prostředků.`, en: `Total treasury balance including allocated funds.` },
  available_2: { cs: `Dostupné`, en: `Available` },
  immediatelyUsable: { cs: `k okamžitému použití`, en: `immediately usable` },
  balanceAvailableForGovernanceS: { cs: `Zůstatek dostupný pro governance výdaje bez čekajících operací.`, en: `Balance available for governance spend without pending operations.` },
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
  humanitarianTithe: { cs: `Humanitární desátek`, en: `Humanitarian Tithe` },
  k10OfAllMiningRewardsFundCleanW: { cs: `10 % všech odměn za těžbu financuje projekty čisté vody, potravinové bezpečnosti a vzdělávání.`, en: `10% of all mining rewards fund clean water, food security, and education projects worldwide.` },
  totalProjects: { cs: `Celkem projektů`, en: `Total Projects` },
  activeFunding: { cs: `Aktivní financování`, en: `Active Funding` },
  beneficiaries: { cs: `Příjemci`, en: `Beneficiaries` },
  fundedAmount: { cs: `Financováno`, en: `Funded Amount` },
  multiLayerGovernance: { cs: `Vícevrstvá správa`, en: `Multi-Layer Governance` },
  coAdminSacredTrinity: { cs: `Co-Admin & Posvátná trojice`, en: `Co-Admin & Sacred Trinity` },
  multiLayerDaoGovernanceAcrossL: { cs: `Multi-vrstvá DAO správa přes L1–L6. Co-Admini koordinují cross-layer veta a politiku, Posvátná trojice symbolizuje kosmické archetypy správy.`, en: `Multi-layer DAO governance across L1–L6. Co-Admins coordinate cross-layer vetoes and policy, while the Sacred Trinity embodies cosmic archetypes of stewardship.` },
  coAdminSystem: { cs: `Co-Admin systém`, en: `Co-Admin System` },
  eachLayerL1L6HasACoAdminForTec: { cs: `Každá vrstva (L1–L6) má svého Co-Admina pro technická rozhodnutí a koordinaci. Cross-layer rozhodnutí vyžadují souhlas dotčených Co-Adminů.`, en: `Each layer (L1–L6) has a Co-Admin for technical decisions and coordination. Cross-layer decisions require consent from affected Co-Admins.` },
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
  consentEngine: { cs: `Consent Engine`, en: `Consent Engine` },
  theConsentMechanismEnsuresCros: { cs: `Mechanismus souhlasu zajišťuje, že cross-layer rozhodnutí neprocházejí bez aktivního souhlasu dotčených vrstev. Blokující veto je vyhrazeno pro bezpečnostní incidenty a porušení dohody.`, en: `The consent mechanism ensures cross-layer decisions do not pass without active consent from affected layers. Blocking veto is reserved for security incidents and agreement violations.` },
  propose: { cs: `Návrh`, en: `Propose` },
  anyCoAdmin: { cs: `Jakýkoliv Co-Admin`, en: `Any Co-Admin` },
  consent: { cs: `Souhlas`, en: `Consent` },
  affectedLayers: { cs: `Dotčené vrstvy`, en: `Affected layers` },
  vetoWindow: { cs: `Veto okno`, en: `Veto window` },
  execute: { cs: `Provedení`, en: `Execute` },
  afterConsent: { cs: `Po souhlasu`, en: `After consent` },
  daoCirclesGovernanceTopology: { cs: `DAO kruhy & topologie`, en: `DAO Circles & Governance Topology` },
  treeOfLifeServesAsALivingDaoLe: { cs: `Tree of Life slouží jako živý DAO ledger. Kořeny reprezentují komunitní guildy, srdce vývojové kruhy a koruna správní guardians.`, en: `Tree of Life serves as a living DAO ledger. Roots represent community guilds, the heart development circles, and the crown governance guardians.` },
  liveTopology: { cs: `Živá topologie`, en: `Live topology` },
  crown: { cs: `Koruna`, en: `Crown` },
  guardiansCouncil: { cs: `Rada guardianů`, en: `Guardians Council` },
  topDaoGovernanceLayerTreasuryO: { cs: `Vrchní vrstva správy DAO — dohled nad treasury, bezpečnostní revize a dlouhodobá vize.`, en: `Top DAO governance layer — treasury oversight, security reviews, and long-term vision.` },
  heart: { cs: `Srdce`, en: `Heart` },
  buildersCircle: { cs: `Kruh stavitelů`, en: `Builders Circle` },
  ecosystemHeartProtocolDevelopm: { cs: `Srdce ekosystému — vývoj protokolu, core návrhy a koordinace technických misí.`, en: `Ecosystem heart — protocol development, core proposals, and technical mission coordination.` },
  roots: { cs: `Kořeny`, en: `Roots` },
  communityGuild: { cs: `Komunitní guilda`, en: `Community Guild` },
  daoRootsOpenCommunityContribut: { cs: `Kořeny DAO — otevřená komunita, contribution streamy, komunitní hlasování a růst sítě.`, en: `DAO roots — open community, contribution streams, community votes, and network growth.` },
  dao: { cs: `DAO`, en: `DAO` },
  kabbalahTreeOfLife144kGuardian: { cs: `Kabbalah Tree of Life · 144k Guardians`, en: `Kabbalah Tree of Life · 144k Guardians` },
  k9ConsciousnessLevelsMappedTo10: { cs: `9 vědomostních levelů namapovaných na 10 Sefirot. Každý DAO circle odpovídá různým consciousness levelům.`, en: `9 consciousness levels mapped to 10 Sefirot. Each DAO circle corresponds to different consciousness levels.` },
  realTimeDaoTracking: { cs: `Real-time DAO tracking`, en: `Real-time DAO tracking` },
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
  proposerZion1: { cs: `Proposer (zion1...)`, en: `Proposer (zion1...)` },
  optionalOtherwiseADemoAddressI: { cs: `Volitelně — jinak se použije demo adresa`, en: `Optional — otherwise a demo address is used` },
  cancel: { cs: `Zrušit`, en: `Cancel` },
  creating: { cs: `Vytvářím…`, en: `Creating…` },
};

type SectionTab = 'proposals' | 'treasury' | 'guardians' | 'roadmap';

const TABS: { key: SectionTab; labelCs: string; labelEn: string; icon: typeof Gavel }[] = [
  { key: 'proposals', labelCs: 'Návrhy', labelEn: 'Proposals', icon: Gavel },
  { key: 'treasury', labelCs: 'Treasury', labelEn: 'Treasury', icon: Landmark },
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
  rc = '7, 137, 48',
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
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/tooltip:block w-44 rounded-lg border border-white/10 bg-black/90 backdrop-blur-xl px-2 py-1.5 text-[10px] text-gray-300 shadow-xl z-20">
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

const getPhases = (cs: boolean) => [
  {
    title: DaoCopy.phase1Stewardship2025[cs ? 'cs' : 'en'],
    bullets: cs
      ? ['Maitreya Buddha + Round Table guardians zajišťují uptime', 'Emergency intervence + schválení rozpočtu roadmapy', '90denní reporting publikovaný v docs']
      : ['Maitreya Buddha + Round Table guardians ensure uptime', 'Emergency intervention + roadmap budget approvals', '90-day reporting cadence published in docs'],
  },
  {
    title: DaoCopy.phase2HybridDao2026[cs ? 'cs' : 'en'],
    bullets: cs
      ? ['Validator council + guardians · 5-of-7 treasury', 'On-chain proposal lifecycle (create → vote → execute)', 'Golden Egg incentivy + community matching pooly']
      : ['Validator council joins guardians · 5-of-7 treasury', 'On-chain proposal lifecycle (create → vote → execute)', 'Golden Egg incentives + community matching pools'],
  },
  {
    title: DaoCopy.phase3FullDao2026[cs ? 'cs' : 'en'],
    bullets: cs
      ? ['Treasury + roadmapa plně řízeny stakery', 'Kvadratické nebo consciousness-weighted hlasování', 'Transparentní granty + investiční komise ekosystému']
      : ['Treasury + roadmap fully controlled by stakers', 'Quadratic or consciousness-weighted voting experiments', 'Transparent grants + ecosystem investment committee'],
  },
];

const getQuickLinks = (cs: boolean) => [
  { label: DaoCopy.governanceDocs[cs ? 'cs' : 'en'], href: '/docs', description: DaoCopy.proposalFlowVotingPowerEmergen[cs ? 'cs' : 'en'] },
  { label: DaoCopy.treasuryDashboard[cs ? 'cs' : 'en'], href: '/dashboard', description: DaoCopy.realTimeBalancesAllocationOver[cs ? 'cs' : 'en'] },
  { label: DaoCopy.defiHub[cs ? 'cs' : 'en'], href: '/defi', description: DaoCopy.swapBridgeAndPortfolioOnBaseMa[cs ? 'cs' : 'en'] },
];

const getFaqs = (cs: boolean) => [
  {
    q: DaoCopy.howDoIBecomeADaoGuardian[cs ? 'cs' : 'en'],
    a: DaoCopy.guardiansAreSelectedBasedOnVer[cs ? 'cs' : 'en'],
  },
  {
    q: DaoCopy.howDoesVotingPowerWork[cs ? 'cs' : 'en'],
    a: DaoCopy.everyZionHolderHasBaseVotingPo[cs ? 'cs' : 'en'],
  },
  {
    q: DaoCopy.whatIsTheHumanitarianTithe[cs ? 'cs' : 'en'],
    a: DaoCopy.k10OfMiningRewardsGoIntoTheDaoH[cs ? 'cs' : 'en'],
  },
  {
    q: DaoCopy.whenWillTheDaoBeFullyOnChain[cs ? 'cs' : 'en'],
    a: DaoCopy.theHybridDaoPhaseBeginsInQ2202[cs ? 'cs' : 'en'],
  },
];

export default function DaoPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [stats, setStats] = useState<DAOStatsType | null>(null);
  const [treasury, setTreasury] = useState<DAOTreasuryOverview | null>(null);
  const [proposals, setProposals] = useState<GovernanceProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [daemonOnline, setDaemonOnline] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<SectionTab>('proposals');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createProposer, setCreateProposer] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<{
    online: boolean;
    l1_locks_detected: number;
    l1_locks_finalized: number;
    evm_mints_confirmed: number;
    last_l1_height: number;
    errors_total: number;
  } | null>(null);

  const phases = getPhases(cs);
  const quickLinks = getQuickLinks(cs);
  const faqs = getFaqs(cs);

  useEffect(() => { loadDAOData(); }, []);

  async function loadDAOData() {
    try {
      setLoading(true);
      const [statsData, proposalsData, treasuryData, bridgeData] = await Promise.all([
        getDAOStats(),
        getGovernanceProposals(),
        getDAOTreasuryOverview(),
        fetch('/api/bridge/status', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
      ]);
      setStats(statsData);
      setProposals(proposalsData);
      setTreasury(treasuryData);
      setDaemonOnline(proposalsData.length > 0 || statsData.governance.total_proposals > 0);
      if (bridgeData) setBridgeStatus(bridgeData);
    } catch {
      setDaemonOnline(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleVote(proposalId: string, voteType: string) {
    try {
      const demoWallet = 'zion1demo' + Math.random().toString(36).substring(2, 10);
      await castGovernanceVote(parseInt(proposalId, 10), demoWallet, voteType as 'for' | 'against');
      await loadDAOData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Vote failed');
    }
  }

  async function handleCreateProposal(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!createTitle.trim() || !createDesc.trim()) {
      setCreateError(DaoCopy.pleaseEnterATitleAndDescriptio[cs ? 'cs' : 'en']);
      return;
    }
    setCreateBusy(true);
    try {
      const proposer = createProposer.trim() || 'zion1demo' + Math.random().toString(36).substring(2, 10);
      await createGovernanceProposal({
        proposer,
        title: createTitle.trim(),
        description: createDesc.trim(),
      });
      setCreateOpen(false);
      setCreateTitle('');
      setCreateDesc('');
      setCreateProposer('');
      await loadDAOData();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : (DaoCopy.failedToCreateProposal[cs ? 'cs' : 'en']));
    } finally {
      setCreateBusy(false);
    }
  }

  const totalProposals = stats?.governance.total_proposals ?? 0;
  const activeProposals = stats?.active ?? 0;
  const guardiansCount = 5;

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
          style={{ '--rc': '7, 137, 48' } as CSSProperties}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
                <Crown className="h-4 w-4" />
                DAO 2.0 · {DaoCopy.governance[cs ? 'cs' : 'en']}
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">{DaoCopy.treasuryProposalsVoting[cs ? 'cs' : 'en']}</p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {DaoCopy.shapeZionSFutureTogether[cs ? 'cs' : 'en']}
                </h1>
              </div>
              <p className="text-lg text-gray-300 max-w-2xl">
                {DaoCopy.zionSDaoGovernsTreasuryAllocat[cs ? 'cs' : 'en']}
              </p>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className={`zion-badge ${daemonOnline === false ? 'border-zion-purple/30 bg-zion-purple/10 text-zion-purple' : daemonOnline === true ? 'zion-badge-green' : ''}`}>
                  <span className={`h-2 w-2 rounded-full ${daemonOnline === false ? 'bg-zion-purple' : daemonOnline === true ? 'bg-zion-cyan animate-pulse' : 'bg-gray-500 animate-pulse'}`} />
                  {daemonOnline === false ? (DaoCopy.daemonOffline[cs ? 'cs' : 'en']) : daemonOnline === true ? (DaoCopy.daemonOnline[cs ? 'cs' : 'en']) : (DaoCopy.checking[cs ? 'cs' : 'en'])}
                </span>
                {stats && (
                  <span className="zion-badge">
                    <Scale className="h-3.5 w-3.5 text-zion-gold" />
                    <span className="text-gray-300">{DaoCopy.quorum[cs ? 'cs' : 'en']}</span>
                    <span className="font-mono text-white">{stats.quorum_percent}%</span>
                  </span>
                )}
                {stats && (
                  <span className="zion-badge">
                    <Activity className="h-3.5 w-3.5 text-zion-cyan" />
                    <span className="text-gray-300">{DaoCopy.period[cs ? 'cs' : 'en']}</span>
                    <span className="font-mono text-white">{stats.voting_period_days}d</span>
                  </span>
                )}
                {bridgeStatus && (
                  <span className={`zion-badge ${bridgeStatus.online ? 'zion-badge-green' : 'border-zion-purple/30 bg-zion-purple/10 text-zion-purple'}`}>
                    <ArrowLeftRight className="h-3.5 w-3.5 text-zion-cyan" />
                    <span className="text-gray-300">Bridge:</span>
                    <span className={bridgeStatus.online ? 'text-zion-cyan' : 'text-zion-purple'}>{bridgeStatus.online ? (DaoCopy.online[cs ? 'cs' : 'en']) : (DaoCopy.offline[cs ? 'cs' : 'en'])}</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-4">
                <button onClick={loadDAOData} disabled={loading} className="zion-button-primary disabled:opacity-50">
                  {loading ? (DaoCopy.loading[cs ? 'cs' : 'en']) : (DaoCopy.refreshData[cs ? 'cs' : 'en'])}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <Link href="/docs" className="zion-rainbow-sub inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                  {DaoCopy.governanceDocs_2[cs ? 'cs' : 'en']}
                </Link>
              </div>
            </div>

            {/* Quick info side card */}
            <div className="w-full lg:max-w-md space-y-3">
              <div className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">{DaoCopy.quickOverview[cs ? 'cs' : 'en']}</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Landmark className="h-4 w-4 text-zion-gold" />
                      {DaoCopy.treasury[cs ? 'cs' : 'en']}
                    </div>
                    <span className="font-mono text-white">{(treasury?.total_zion ?? 0).toLocaleString()} ZION</span>
                  </div>
                  <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Wallet className="h-4 w-4 text-zion-cyan" />
                      {DaoCopy.available[cs ? 'cs' : 'en']}
                    </div>
                    <span className="font-mono text-white">{(treasury?.available_zion ?? 0).toLocaleString()} ZION</span>
                  </div>
                  <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Gavel className="h-4 w-4 text-zion-cyan" />
                      {DaoCopy.proposals[cs ? 'cs' : 'en']}
                    </div>
                    <span className="font-mono text-white">{totalProposals.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <ShieldCheck className="h-4 w-4 text-zion-gold" />
                      {DaoCopy.guardians[cs ? 'cs' : 'en']}
                    </div>
                    <span className="font-mono text-white">{guardiansCount}/5</span>
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
                <p className="font-semibold text-zion-purple">{DaoCopy.daoDaemonPhase2HybridDao[cs ? 'cs' : 'en']}</p>
                <p className="text-sm text-blue-200/80 mt-1">
                  {DaoCopy.theOnChainDaoGovernanceDaemonW[cs ? 'cs' : 'en']}
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
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DaoCopy.telemetry[cs ? 'cs' : 'en']}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <Activity className="h-7 w-7 text-zion-cyan" />
                {DaoCopy.daoStatistics[cs ? 'cs' : 'en']}
              </h2>
              <p className="text-sm text-gray-400">
                {DaoCopy.governanceMetricsAggregatedFro[cs ? 'cs' : 'en']}
              </p>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="zion-rainbow-card p-4 animate-pulse"
                    style={{ '--rc': '7, 137, 48' } as CSSProperties}
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
                  label={DaoCopy.treasury[cs ? 'cs' : 'en']}
                  value={`${(treasury?.total_zion ?? 0).toLocaleString()} ZION`}
                  sub={DaoCopy.totalBalance[cs ? 'cs' : 'en']}
                  tip={DaoCopy.totalTreasuryBalanceIncludingA[cs ? 'cs' : 'en']}
                />
                <StatCard
                  icon={<Wallet className="h-5 w-5" />}
                  colorClass="text-zion-cyan"
                  bgClass="bg-zion-cyan/10"
                  rc="7, 137, 48"
                  label={DaoCopy.available_2[cs ? 'cs' : 'en']}
                  value={`${(treasury?.available_zion ?? 0).toLocaleString()} ZION`}
                  sub={DaoCopy.immediatelyUsable[cs ? 'cs' : 'en']}
                  tip={DaoCopy.balanceAvailableForGovernanceS[cs ? 'cs' : 'en']}
                />
                <StatCard
                  icon={<Gavel className="h-5 w-5" />}
                  colorClass="text-zion-cyan"
                  bgClass="bg-zion-cyan/10"
                  rc="7, 137, 48"
                  label={DaoCopy.proposals[cs ? 'cs' : 'en']}
                  value={totalProposals.toLocaleString()}
                  sub={DaoCopy.createdTotal[cs ? 'cs' : 'en']}
                />
                <StatCard
                  icon={<Activity className="h-5 w-5" />}
                  colorClass="text-zion-cyan"
                  bgClass="bg-zion-cyan/10"
                  rc="7, 137, 48"
                  label={DaoCopy.active[cs ? 'cs' : 'en']}
                  value={activeProposals.toLocaleString()}
                  sub={DaoCopy.ongoingVotes[cs ? 'cs' : 'en']}
                />
                <StatCard
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  colorClass="text-zion-gold"
                  bgClass="bg-zion-gold/10"
                  rc="252, 209, 22"
                  label={DaoCopy.passed[cs ? 'cs' : 'en']}
                  value={(stats?.passed ?? 0).toLocaleString()}
                  sub={DaoCopy.successfulProposals[cs ? 'cs' : 'en']}
                />
                <StatCard
                  icon={<Users className="h-5 w-5" />}
                  colorClass="text-zion-gold"
                  bgClass="bg-zion-gold/10"
                  rc="252, 209, 22"
                  label={DaoCopy.voters[cs ? 'cs' : 'en']}
                  value={(stats?.governance.active_voters ?? 0).toLocaleString()}
                  sub={DaoCopy.activeParticipants[cs ? 'cs' : 'en']}
                />
                <StatCard
                  icon={<ArrowLeftRight className="h-5 w-5" />}
                  colorClass="text-zion-cyan"
                  bgClass="bg-zion-cyan/10"
                  rc="7, 137, 48"
                  label={DaoCopy.bridge[cs ? 'cs' : 'en']}
                  value={bridgeStatus?.online ? (DaoCopy.online[cs ? 'cs' : 'en']) : (DaoCopy.offline[cs ? 'cs' : 'en'])}
                  sub={DaoCopy.l2Relay[cs ? 'cs' : 'en']}
                  tip={DaoCopy.statusOfTheCrossChainRelayConn[cs ? 'cs' : 'en']}
                />
                <StatCard
                  icon={<Link2 className="h-5 w-5" />}
                  colorClass="text-zion-gold"
                  bgClass="bg-zion-gold/10"
                  rc="252, 209, 22"
                  label="wZION Mints"
                  value={bridgeStatus?.evm_mints_confirmed?.toLocaleString() ?? '—'}
                  sub={DaoCopy.confirmedOnBase[cs ? 'cs' : 'en']}
                  tip={DaoCopy.numberOfWzionMintedOnBaseAfter[cs ? 'cs' : 'en']}
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
            style={{ '--rc': '7, 137, 48' } as CSSProperties}
          >
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mr-1 hidden sm:inline">
                {DaoCopy.daoSections[cs ? 'cs' : 'en']}
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
                    <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DaoCopy.governanceProposals[cs ? 'cs' : 'en']}</p>
                    <h2 className="text-3xl font-semibold text-white">{DaoCopy.voteOnProtocolDecisions[cs ? 'cs' : 'en']}</h2>
                  </div>
                  <button
                    onClick={() => setCreateOpen(true)}
                    className="zion-button-primary"
                  >
                    <Plus className="h-4 w-4" />
                    {DaoCopy.createProposal[cs ? 'cs' : 'en']}
                  </button>
                </div>
                {loading ? (
                  <div className="text-center py-12">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-zion-gold border-r-transparent" />
                    <p className="mt-4 text-gray-400">{DaoCopy.loadingProposals[cs ? 'cs' : 'en']}</p>
                  </div>
                ) : proposals.length === 0 ? (
                  <div className="zion-rainbow-card p-12 text-center" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
                    <Crown className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                    <p className="text-lg font-semibold text-white mb-2">{DaoCopy.noProposalsYet[cs ? 'cs' : 'en']}</p>
                    <p className="text-gray-400">{DaoCopy.beTheFirstToCreateAGovernanceP[cs ? 'cs' : 'en']}</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {proposals.map((proposal) => (
                      <ProposalCard key={proposal.id} proposal={proposal} onVote={handleVote} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'treasury' && (
            <div className="space-y-12">
              {treasury && (
                <motion.section
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="zion-rainbow-card p-8"
                  style={{ '--rc': '7, 137, 48' } as CSSProperties}
                >
                  <div className="mb-6">
                    <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Treasury</p>
                    <h2 className="text-3xl font-semibold text-white">{DaoCopy.treasuryOverview[cs ? 'cs' : 'en']}</h2>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="zion-rainbow-sub p-4" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                      <p className="text-xs uppercase tracking-wider text-gray-400">Multisig</p>
                      <p className="text-lg font-semibold text-white mt-1">{treasury.multisig}</p>
                    </div>
                    <div className="zion-rainbow-sub p-4" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
                      <p className="text-xs uppercase tracking-wider text-gray-400">{DaoCopy.available[cs ? 'cs' : 'en']}</p>
                      <p className="text-lg font-semibold text-white mt-1">{treasury.available_zion.toLocaleString()} ZION</p>
                    </div>
                    <div className="zion-rainbow-sub p-4" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
                      <p className="text-xs uppercase tracking-wider text-gray-400">{DaoCopy.pendingOps[cs ? 'cs' : 'en']}</p>
                      <p className="text-lg font-semibold text-white mt-1">{treasury.pending_operations}</p>
                    </div>
                    <div className="zion-rainbow-sub p-4" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                      <p className="text-xs uppercase tracking-wider text-gray-400">{DaoCopy.dailyLimit[cs ? 'cs' : 'en']}</p>
                      <p className="text-lg font-semibold text-white mt-1">{treasury.daily_spend_limit_zion.toLocaleString()} ZION</p>
                    </div>
                  </div>
                </motion.section>
              )}

              <motion.section
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="zion-rainbow-card p-8"
                style={{ '--rc': '7, 137, 48' } as CSSProperties}
              >
                <div className="flex flex-col gap-2 mb-6">
                  <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DaoCopy.bridgeVault[cs ? 'cs' : 'en']}</p>
                  <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                    <ArrowLeftRight className="h-7 w-7 text-zion-gold" />
                    {DaoCopy.k100mZionBaseMainnet[cs ? 'cs' : 'en']}
                  </h2>
                  <p className="text-gray-300 max-w-2xl mt-2">
                    {DaoCopy.k6UtxoLockTransactions1667mZion[cs ? 'cs' : 'en']}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
                    <p className="text-xs uppercase tracking-wider text-gray-400">{DaoCopy.lockedZion[cs ? 'cs' : 'en']}</p>
                    <p className="text-lg font-semibold text-white mt-1">~100,000,000</p>
                    <p className="text-xs text-gray-500">6 UTXO locks</p>
                  </div>
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                    <p className="text-xs uppercase tracking-wider text-gray-400">{DaoCopy.relayStatus[cs ? 'cs' : 'en']}</p>
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
                    <p className="text-xs text-gray-500">{DaoCopy.l2CrossChainRelay[cs ? 'cs' : 'en']}</p>
                  </div>
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                    <p className="text-xs uppercase tracking-wider text-gray-400">{DaoCopy.wzionMints[cs ? 'cs' : 'en']}</p>
                    <p className="text-lg font-semibold text-white mt-1">{bridgeStatus?.evm_mints_confirmed ?? '—'}</p>
                    <p className="text-xs text-gray-500">{DaoCopy.confirmedOnBase[cs ? 'cs' : 'en']}</p>
                  </div>
                  <div className="zion-rainbow-sub p-4" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
                    <p className="text-xs uppercase tracking-wider text-gray-400">{DaoCopy.l1Block[cs ? 'cs' : 'en']}</p>
                    <p className="text-lg font-semibold text-white mt-1">{bridgeStatus?.last_l1_height ?? '—'}</p>
                    <p className="text-xs text-gray-500">{DaoCopy.lastScan[cs ? 'cs' : 'en']}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5" />
                    wZION: <span className="text-gray-400 font-mono">0x0c49…2bb6</span>
                  </span>
                  <span className="text-gray-600">·</span>
                  <span>{DaoCopy.vault[cs ? 'cs' : 'en']} <span className="text-gray-400 font-mono">zion1w0r0…w0t0</span></span>
                  <span className="text-gray-600">·</span>
                  <span>{DaoCopy.finality60Blocks[cs ? 'cs' : 'en']}</span>
                </div>
              </motion.section>

              <motion.section
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="zion-rainbow-card p-10"
                style={{ '--rc': '7, 137, 48' } as CSSProperties}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Heart className="h-8 w-8 text-zion-cyan" />
                  <h2 className="text-3xl font-semibold text-white">{DaoCopy.humanitarianTithe[cs ? 'cs' : 'en']}</h2>
                </div>
                <p className="text-lg text-gray-300 mb-6">
                  {DaoCopy.k10OfAllMiningRewardsFundCleanW[cs ? 'cs' : 'en']}
                </p>
                {stats && (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { label: DaoCopy.totalProjects[cs ? 'cs' : 'en'], value: stats.humanitarian.total_proposals },
                      { label: DaoCopy.activeFunding[cs ? 'cs' : 'en'], value: stats.humanitarian.active_proposals },
                      { label: DaoCopy.beneficiaries[cs ? 'cs' : 'en'], value: stats.humanitarian.total_beneficiaries.toLocaleString() },
                      { label: DaoCopy.fundedAmount[cs ? 'cs' : 'en'], value: stats.humanitarian.total_funded.toLocaleString() },
                    ].map((s) => (
                      <div key={s.label} className="zion-rainbow-sub p-4" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
                        <p className="text-xs uppercase tracking-wider text-gray-400">{s.label}</p>
                        <p className="text-3xl font-bold text-white">{s.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.section>
            </div>
          )}

          {activeTab === 'guardians' && (
            <div className="space-y-12">
              <motion.section
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="zion-rainbow-card p-8"
                style={{ '--rc': '7, 137, 48' } as CSSProperties}
              >
                <div className="flex flex-col gap-2 mb-6">
                  <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DaoCopy.multiLayerGovernance[cs ? 'cs' : 'en']}</p>
                  <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                    <Crown className="h-7 w-7 text-zion-gold" />
                    {DaoCopy.coAdminSacredTrinity[cs ? 'cs' : 'en']}
                  </h2>
                  <p className="text-sm text-gray-400 max-w-3xl">
                    {DaoCopy.multiLayerDaoGovernanceAcrossL[cs ? 'cs' : 'en']}
                  </p>
                </div>
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div className="zion-rainbow-sub p-5" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck className="h-5 w-5 text-zion-cyan" />
                      <h3 className="font-semibold text-white">{DaoCopy.coAdminSystem[cs ? 'cs' : 'en']}</h3>
                    </div>
                    <p className="text-sm text-gray-400 mb-3">
                      {DaoCopy.eachLayerL1L6HasACoAdminForTec[cs ? 'cs' : 'en']}
                    </p>
                    <div className="space-y-1.5 text-xs">
                      {(['L1 Consensus', 'L2 DAO/Bridge', 'L3 WARP', 'L4 Oasis', 'L5 Free World', 'L6 Issobella'] as const).map((layer) => (
                        <div key={layer} className="flex items-center justify-between zion-rainbow-sub px-3 py-1.5" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
                          <span className="text-gray-300 font-mono">{layer}</span>
                          <span className="text-gray-500">{DaoCopy.coAdmin[cs ? 'cs' : 'en']} · {DaoCopy.daoAuthority[cs ? 'cs' : 'en']}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                    <div className="flex items-center gap-2 mb-3">
                      <Star className="h-5 w-5 text-zion-gold" />
                      <h3 className="font-semibold text-white">{DaoCopy.sacredTrinity[cs ? 'cs' : 'en']}</h3>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">
                      {DaoCopy.cosmicArchetypesOfDaoGovernanc[cs ? 'cs' : 'en']}
                    </p>
                    <div className="space-y-3">
                      {[
                        { name: 'Rama', role: DaoCopy.stewardConsensusL1[cs ? 'cs' : 'en'], color: 'text-zion-cyan', desc: DaoCopy.chainDharmaFairMiningProtocolI[cs ? 'cs' : 'en'] },
                        { name: 'Síta', role: DaoCopy.heartCommunityL5[cs ? 'cs' : 'en'], color: 'text-zion-purple', desc: DaoCopy.humanitarianFundPhysicalCommun[cs ? 'cs' : 'en'] },
                        { name: 'Hanuman', role: DaoCopy.guardianBridgeL2[cs ? 'cs' : 'en'], color: 'text-zion-gold', desc: DaoCopy.bridgingWorldsProtectionFaithf[cs ? 'cs' : 'en'] },
                      ].map((archetype) => (
                        <div key={archetype.name} className="zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-bold text-sm ${archetype.color}`}>{archetype.name}</span>
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">{archetype.role}</span>
                          </div>
                          <p className="text-xs text-gray-400">{archetype.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="zion-rainbow-sub p-5" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
                  <div className="flex items-center gap-3 mb-3">
                    <Sparkles className="h-5 w-5 text-zion-cyan" />
                    <h3 className="font-semibold text-white">{DaoCopy.consentEngine[cs ? 'cs' : 'en']}</h3>
                    <span className="text-[10px] uppercase tracking-widest border border-zion-cyan/30 bg-zion-cyan/10 text-zion-cyan px-2 py-0.5 rounded-full font-semibold">L2 DAO</span>
                  </div>
                  <p className="text-sm text-gray-400 max-w-3xl">
                    {DaoCopy.theConsentMechanismEnsuresCros[cs ? 'cs' : 'en']}
                  </p>
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                    {[
                      { label: DaoCopy.propose[cs ? 'cs' : 'en'], detail: DaoCopy.anyCoAdmin[cs ? 'cs' : 'en'] },
                      { label: DaoCopy.consent[cs ? 'cs' : 'en'], detail: DaoCopy.affectedLayers[cs ? 'cs' : 'en'] },
                      { label: DaoCopy.vetoWindow[cs ? 'cs' : 'en'], detail: '72h' },
                      { label: DaoCopy.execute[cs ? 'cs' : 'en'], detail: DaoCopy.afterConsent[cs ? 'cs' : 'en'] },
                    ].map((step) => (
                      <div key={step.label} className="zion-rainbow-sub p-2.5 text-center" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
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
                style={{ '--rc': '7, 137, 48' } as CSSProperties}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
                  <div>
                    <p className="text-sm uppercase tracking-[0.4em] text-gray-500">Tree of Life</p>
                    <h2 className="text-3xl font-semibold text-white">{DaoCopy.daoCirclesGovernanceTopology[cs ? 'cs' : 'en']}</h2>
                    <p className="text-gray-300 max-w-2xl mt-2">
                      {DaoCopy.treeOfLifeServesAsALivingDaoLe[cs ? 'cs' : 'en']}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 zion-rainbow-sub px-4 py-2 text-sm" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
                    <TreeDeciduous className="h-5 w-5 text-zion-cyan" />
                    <span className="text-gray-300">{DaoCopy.liveTopology[cs ? 'cs' : 'en']}</span>
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-3">
                  {[
                    {
                      level: DaoCopy.crown[cs ? 'cs' : 'en'],
                      title: DaoCopy.guardiansCouncil[cs ? 'cs' : 'en'],
                      description: DaoCopy.topDaoGovernanceLayerTreasuryO[cs ? 'cs' : 'en'],
                      Icon: Crown,
                      iconColor: 'text-zion-gold',
                    },
                    {
                      level: DaoCopy.heart[cs ? 'cs' : 'en'],
                      title: DaoCopy.buildersCircle[cs ? 'cs' : 'en'],
                      description: DaoCopy.ecosystemHeartProtocolDevelopm[cs ? 'cs' : 'en'],
                      Icon: Sparkles,
                      iconColor: 'text-zion-cyan',
                    },
                    {
                      level: DaoCopy.roots[cs ? 'cs' : 'en'],
                      title: DaoCopy.communityGuild[cs ? 'cs' : 'en'],
                      description: DaoCopy.daoRootsOpenCommunityContribut[cs ? 'cs' : 'en'],
                      Icon: Users,
                      iconColor: 'text-zion-gold',
                    },
                  ].map((node) => (
                    <div key={node.level} className="zion-rainbow-sub p-5" style={{ '--rc': node.level === 'Koruna' || node.level === 'Crown' ? '252, 209, 22' : node.level === 'Srdce' || node.level === 'Heart' ? '7, 137, 48' : '252, 209, 22' } as CSSProperties}>
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

              <motion.section
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="zion-rainbow-card p-8"
                style={{ '--rc': '7, 137, 48' } as CSSProperties}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
                  <div>
                    <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DaoCopy.dao[cs ? 'cs' : 'en']}</p>
                    <h2 className="text-3xl font-semibold text-white">{DaoCopy.kabbalahTreeOfLife144kGuardian[cs ? 'cs' : 'en']}</h2>
                    <p className="text-gray-300 max-w-2xl mt-2">
                      {DaoCopy.k9ConsciousnessLevelsMappedTo10[cs ? 'cs' : 'en']}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 zion-rainbow-sub px-4 py-2 text-sm" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                    <Star className="h-5 w-5 text-zion-gold" />
                    <span className="text-gray-300">{DaoCopy.realTimeDaoTracking[cs ? 'cs' : 'en']}</span>
                  </div>
                </div>
                <GuardiansTreeClient />
              </motion.section>
            </div>
          )}

          {activeTab === 'roadmap' && (
            <motion.section
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="zion-rainbow-card p-8"
              style={{ '--rc': '7, 137, 48' } as CSSProperties}
            >
              <div className="flex flex-col gap-2 mb-6">
                <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DaoCopy.governancePhases[cs ? 'cs' : 'en']}</p>
                <h2 className="text-3xl font-semibold text-white">{DaoCopy.roadToFullDecentralization[cs ? 'cs' : 'en']}</h2>
              </div>
              <div className="grid gap-6 md:grid-cols-3">
                {phases.map((phase) => (
                  <div key={phase.title} className="zion-rainbow-sub p-6" style={{ '--rc': phase.title.includes('Fáze 1') || phase.title.includes('Phase 1') ? '252, 209, 22' : phase.title.includes('Fáze 2') || phase.title.includes('Phase 2') ? '7, 137, 48' : '252, 209, 22' } as CSSProperties}>
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
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{DaoCopy.support[cs ? 'cs' : 'en']}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <HelpCircle className="h-7 w-7 text-zion-purple" />
                {DaoCopy.faq[cs ? 'cs' : 'en']}
              </h2>
            </div>
            <div className="space-y-3 max-w-3xl">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className="zion-rainbow-sub overflow-hidden"
                  style={{ '--rc': '7, 137, 48' } as CSSProperties}
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
            {DaoCopy.exploreTheZionEcosystem[cs ? 'cs' : 'en']}
          </h2>
          <p className="text-gray-100 text-center max-w-2xl mx-auto mb-8">
            {DaoCopy.daoIsTheBridgeBetweenL1Consens[cs ? 'cs' : 'en']}
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link
              href="/defi"
              className="zion-button-primary"
            >
              DeFi
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
          style={{ '--rc': '7, 137, 48' } as CSSProperties}
        >
          <h2 className="text-3xl font-semibold text-white text-center mb-8">{DaoCopy.helpfulLinks[cs ? 'cs' : 'en']}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {quickLinks.map((link) => (
              <div key={link.label} className="zion-rainbow-sub p-5 hover:bg-white/5 transition-colors" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                <p className="text-sm font-semibold text-white">{link.label}</p>
                <p className="mt-2 text-sm text-gray-300">{link.description}</p>
                <Link href={link.href} target={link.href.startsWith('http') ? '_blank' : undefined} rel={link.href.startsWith('http') ? 'noreferrer' : undefined} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-zion-gold hover:text-zion-gold/80 transition-colors">
                  {DaoCopy.open[cs ? 'cs' : 'en']}
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
                <h3 className="text-xl font-semibold text-white">{DaoCopy.newGovernanceProposal[cs ? 'cs' : 'en']}</h3>
                <button onClick={() => setCreateOpen(false)} className="text-gray-400 hover:text-white">✕</button>
              </div>
              <form onSubmit={handleCreateProposal} className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">{DaoCopy.title[cs ? 'cs' : 'en']}</label>
                  <input
                    type="text"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                    placeholder={DaoCopy.eGIncreaseBridgeValidatorThres[cs ? 'cs' : 'en']}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">{DaoCopy.description[cs ? 'cs' : 'en']}</label>
                  <textarea
                    value={createDesc}
                    onChange={(e) => setCreateDesc(e.target.value)}
                    rows={4}
                    placeholder={DaoCopy.detailedDescriptionOfThePropos[cs ? 'cs' : 'en']}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">{DaoCopy.proposerZion1[cs ? 'cs' : 'en']}</label>
                  <input
                    type="text"
                    value={createProposer}
                    onChange={(e) => setCreateProposer(e.target.value)}
                    placeholder={DaoCopy.optionalOtherwiseADemoAddressI[cs ? 'cs' : 'en']}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold focus:outline-none"
                  />
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
                    {DaoCopy.cancel[cs ? 'cs' : 'en']}
                  </button>
                  <button
                    type="submit"
                    disabled={createBusy}
                    className="zion-button-primary flex-1 !px-4 !py-2 !text-sm disabled:opacity-50"
                  >
                    {createBusy ? (DaoCopy.creating[cs ? 'cs' : 'en']) : (DaoCopy.createProposal[cs ? 'cs' : 'en'])}
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
