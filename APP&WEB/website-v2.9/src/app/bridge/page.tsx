'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  ArrowLeftRight,
  Shield,
  Copy,
  ChevronDown,
  Clock,
  ExternalLink,
  Lock,
  Flame,
  ArrowRight,
  Activity,
  Wifi,
  WifiOff,
  HelpCircle,
  ShieldCheck,
  Unlock,
  Wallet,
  TrendingUp,
} from 'lucide-react';
import { useState, useCallback, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import {
  getBridgeStatus,
  formatUptime,
  bridgeEfficiency,
  BRIDGE_CONTRACTS,
  type BridgeStatus,
} from '@/lib/bridge-api';
import { useLang } from '@/contexts/LanguageContext';
import { usePolling } from '@/hooks/usePolling';

const BridgeCopy = {
  howLongDoesItTake: { cs: `Jak dlouho to trvá?`, en: `How long does it take?` },
  zionWzion10Min60L1BlockFinalit: { cs: `ZION → wZION: ~10 min (60 L1 bloků finalita + mint). wZION → ZION: ~5 min (64 EVM bloků + L1 unlock).`, en: `ZION → wZION: ~10 min (60 L1 block finality + mint). wZION → ZION: ~5 min (64 EVM blocks + L1 unlock).` },
  isThereAFee: { cs: `Jaký je poplatek?`, en: `Is there a fee?` },
  noProtocolFeeYouOnlyPayL1TxFee: { cs: `Žádný protokolový poplatek. Platíš jen L1 TX fee (ZION) a EVM gas (ETH na Base).`, en: `No protocol fee. You only pay L1 TX fee (ZION) and EVM gas (ETH on Base).` },
  whatIsTheMinimumAmount: { cs: `Jaký je minimální obnos?`, en: `What is the minimum amount?` },
  minimum100ZionPerTransaction: { cs: `Minimum 100 ZION na transakci.`, en: `Minimum 100 ZION per transaction.` },
  isItSafe: { cs: `Je to bezpečné?`, en: `Is it safe?` },
  yes55GuardianValidators60Block: { cs: `Ano — 5/5 Guardian validátory, 60-block L1 finalita, replay-attack prevence. Bridge kontrakt je na Base Mainnet.`, en: `Yes — 5/5 Guardian validators, 60-block L1 finality, replay-attack prevention. Bridge contract is on Base Mainnet.` },
  bridgeL1Base: { cs: `Bridge · L1 ↔ Base`, en: `Bridge · L1 ↔ Base` },
  zionL1BaseL2: { cs: `ZION L1 ↔ Base L2`, en: `ZION L1 ↔ Base L2` },
  zionBridge: { cs: `Most ZION`, en: `ZION Bridge` },
  lockZionOnL1ReceiveWzionOnBase: { cs: `Zamkni ZION na L1 → přijmi wZION na Base. Nebo spal wZION → přijmi ZION na L1. 1:1 peg, žádné poplatky.`, en: `Lock ZION on L1 → receive wZION on Base. Or burn wZION → receive ZION on L1. 1:1 peg, no fees.` },
  relayOnline: { cs: `Relay Online`, en: `Relay Online` },
  relayOffline: { cs: `Relay Offline`, en: `Relay Offline` },
  checking: { cs: `Kontroluji…`, en: `Checking…` },
  quickOverview: { cs: `Rychlý přehled`, en: `Quick Overview` },
  locked: { cs: `Zamčeno`, en: `Locked` },
  unlocks: { cs: `Unlocky`, en: `Unlocks` },
  validators: { cs: `Validátoři`, en: `Validators` },
  relay: { cs: `Relay`, en: `Relay` },
  online: { cs: `Online`, en: `Online` },
  offline: { cs: `Offline`, en: `Offline` },
  telemetry: { cs: `Telemetrie`, en: `Telemetry` },
  bridgeStatistics: { cs: `Statistiky bridge`, en: `Bridge Statistics` },
  bridgeMetricsAggregatedFromThe: { cs: `Metriky mostu agregované z relayer API v reálném čase.`, en: `Bridge metrics aggregated from the relayer API in real time.` },
  mints: { cs: `Minty`, en: `Mints` },
  l1Base: { cs: `L1 → Base`, en: `L1 → Base` },
  totalWzionMintedOnBaseAfterLoc: { cs: `Celkový počet wZION mintnutých na Base po zamčení ZION na L1.`, en: `Total wZION minted on Base after locking ZION on L1.` },
  burns: { cs: `Burny`, en: `Burns` },
  baseL1: { cs: `Base → L1`, en: `Base → L1` },
  totalWzionBurnEventsDetectedOn: { cs: `Celkový počet burn eventů wZION detekovaných na EVM.`, en: `Total wZION burn events detected on EVM.` },
  confirmed: { cs: `potvrzeno`, en: `confirmed` },
  totalL1UnlocksConfirmedByTheRe: { cs: `Celkový počet L1 unlocků potvrzených relayem.`, en: `Total L1 unlocks confirmed by the relay.` },
  errors: { cs: `Chyby`, en: `Errors` },
  total: { cs: `celkem`, en: `total` },
  totalErrorsLoggedByTheRelayer: { cs: `Celkový počet chyb zaznamenaných relayerem.`, en: `Total errors logged by the relayer.` },
  locks: { cs: `Locky`, en: `Locks` },
  finalized: { cs: `finalizováno`, en: `finalized` },
  l1LocksThatReached60BlockFinal: { cs: `L1 locky dosažené 60-block finality.`, en: `L1 locks that reached 60-block finality.` },
  guardianRelay: { cs: `Guardian relay`, en: `Guardian relay` },
  guardianValidators55Quorum: { cs: `Guardian validátoři — quorum 5/5.`, en: `Guardian validators — 5/5 quorum.` },
  uptime: { cs: `Uptime`, en: `Uptime` },
  relayRunning: { cs: `relay běží`, en: `relay running` },
  efficiency: { cs: `Efektivita`, en: `Efficiency` },
  finalizedDetected: { cs: `finalizováno / detekováno`, en: `finalized / detected` },
  ratioOfFinalizedLocksToDetecte: { cs: `Poměr finalizovaných locků k detekovaným lockům.`, en: `Ratio of finalized locks to detected locks.` },
  bridgeOperations: { cs: `Bridge operace`, en: `Bridge operations` },
  lockZionOnL1: { cs: `Zamkni ZION na L1`, en: `Lock ZION on L1` },
  step1SendZionToBridgeAddress: { cs: `Krok 1 — Pošli ZION na bridge adresu`, en: `Step 1 — Send ZION to bridge address` },
  copied: { cs: `Zkopírováno`, en: `Copied` },
  step2IncludeMemoWithYourEvmAdd: { cs: `Krok 2 — Přidej memo s tvou EVM adresou`, en: `Step 2 — Include memo with your EVM address` },
  wait10MinRelayDetectsLockWaits: { cs: `Počkej ~10 min. Relay detekuje lock, počká na finalitu a mintne wZION na tvou Base adresu.`, en: `Wait ~10 min. Relay detects lock, waits for finality, mints wZION to your Base address.` },
  minimum100ZionMemoFormat: { cs: `Minimum: 100 ZION · Formát memo: `, en: `Minimum: 100 ZION · Memo format: ` },
  howItWorks: { cs: `Jak to funguje`, en: `How it works` },
  sendZionToBridgeEscrowAddressW: { cs: `Pošli ZION na bridge escrow adresu s memo`, en: `Send ZION to bridge escrow address with memo` },
  relayVerifies60BlockFinalityGu: { cs: `Relay ověří 60-block finalitu + Guardian threshold`, en: `Relay verifies 60-block finality + Guardian threshold` },
  zionbridgeMintsWzionToYourBase: { cs: `ZIONBridge mintne wZION na tvou Base adresu`, en: `ZIONBridge mints wZION to your Base address` },
  contracts: { cs: `Kontrakty`, en: `Contracts` },
  pipelineTracker: { cs: `Pipeline tracker`, en: `Pipeline tracker` },
  burnWzionOnBaseBurnAmountL1rec: { cs: `Spal wZION na Base (burn(amount, l1Recipient))`, en: `Burn wZION on Base (burn(amount, l1Recipient))` },
  evmWatcherWaits64BlockFinality: { cs: `EVM watcher čeká 64-block finalitu`, en: `EVM watcher waits 64-block finality` },
  relaySubmitsL1UnlockZionArrive: { cs: `Relay odešle L1 unlock, ZION dorazí na tvou adresu`, en: `Relay submits L1 unlock, ZION arrives to your address` },
  details: { cs: `Detail`, en: `Details` },
  time5Min64EvmBlocksL1Unlock: { cs: `Čas: ~5 min (64 EVM bloků + L1 unlock)`, en: `Time: ~5 min (64 EVM blocks + L1 unlock)` },
  feeOnlyEvmGasEthOnBase: { cs: `Poplatek: jen EVM gas (ETH na Base)`, en: `Fee: only EVM gas (ETH on Base)` },
  minimum100Wzion: { cs: `Minimum: 100 wZION`, en: `Minimum: 100 wZION` },
  l1AddressZion1OrZo: { cs: `L1 adresa: zion1... nebo Zo...`, en: `L1 address: zion1... or Zo...` },
  support: { cs: `Podpora`, en: `Support` },
  faq: { cs: `Časté dotazy`, en: `FAQ` },
};

const BridgeBurnWidget = dynamic(() => import('@/components/BridgeBurnWidget'), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-2xl bg-white/5" />,
});

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'lock' | 'burn';

const TABS: { key: Tab; labelCs: string; labelEn: string; icon: typeof Lock }[] = [
  { key: 'lock', labelCs: 'ZION → wZION', labelEn: 'ZION → wZION', icon: Lock },
  { key: 'burn', labelCs: 'wZION → ZION', labelEn: 'wZION → ZION', icon: Flame },
];

// ─── Stat Card (matches /defi & /pool) ─────────────────────────────────────────

function StatCard({
  icon,
  colorClass,
  bgClass,
  label,
  value,
  sub,
  tip,
  rc = '228, 30, 43',
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
    <div
      className="zion-rainbow-sub p-4 transition-colors"
      style={{ '--rc': rc } as CSSProperties}
    >
      <div
        className={`flex items-center justify-center h-8 w-8 rounded-xl ${bgClass} mb-3 ${colorClass} [&>svg]:h-4 [&>svg]:w-4`}
      >
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

// ─── FAQ (only 4 key questions) ──────────────────────────────────────────────

const getFaqs = (cs: boolean) => [
  {
    q: BridgeCopy.howLongDoesItTake[cs ? 'cs' : 'en'],
    a: BridgeCopy.zionWzion10Min60L1BlockFinalit[cs ? 'cs' : 'en'],
  },
  {
    q: BridgeCopy.isThereAFee[cs ? 'cs' : 'en'],
    a: BridgeCopy.noProtocolFeeYouOnlyPayL1TxFee[cs ? 'cs' : 'en'],
  },
  {
    q: BridgeCopy.whatIsTheMinimumAmount[cs ? 'cs' : 'en'],
    a: BridgeCopy.minimum100ZionPerTransaction[cs ? 'cs' : 'en'],
  },
  {
    q: BridgeCopy.isItSafe[cs ? 'cs' : 'en'],
    a: BridgeCopy.yes55GuardianValidators60Block[cs ? 'cs' : 'en'],
  },
];

// ─── Main Component ────────────────────────────────────────────────────────────

export default function BridgePage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('lock');
  const [memoAddr, setMemoAddr] = useState('');

  const faqs = getFaqs(cs);

  const load = useCallback(async () => {
    setLoading(true);
    const s = await getBridgeStatus();
    setStatus(s);
    setLoading(false);
  }, []);

  usePolling(load, 15_000);

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const memoString = `BRIDGE:base:${memoAddr || '0xYourEvmAddress'}`;
  const totalBridged = status ? status.evm_mints_confirmed : 0;

  return (
    <div className="zion-page text-white">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-36 -left-28 h-[520px] w-[520px] rounded-full bg-zion-purple/18 blur-3xl" />
        <div className="absolute top-40 -right-24 h-[420px] w-[420px] rounded-full bg-zion-cyan/14 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[420px] w-[620px] rounded-full bg-zion-gold/10 blur-3xl" />
      </div>

      {/* ── Hero ── */}
      <section className="zion-container relative z-10 mb-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="zion-rainbow-card p-6 md:p-10"
          style={{ '--rc': '6, 105, 40' } as CSSProperties}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
                <ArrowLeftRight className="h-4 w-4 text-zion-cyan" />
                {BridgeCopy.bridgeL1Base[cs ? 'cs' : 'en']}
              </div>

              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                  {BridgeCopy.zionL1BaseL2[cs ? 'cs' : 'en']}
                </p>
                <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                  {BridgeCopy.zionBridge[cs ? 'cs' : 'en']}
                </h1>
              </div>

              <p className="text-lg text-gray-300 max-w-2xl">
                {BridgeCopy.lockZionOnL1ReceiveWzionOnBase[cs ? 'cs' : 'en']}
              </p>

              {/* Status badges */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {status ? (
                  <span
                    className={`zion-badge ${
                      status.online
                        ? 'zion-badge-green'
                        : 'border-zion-purple/30 bg-zion-purple/10 text-zion-purple'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        status.online ? 'bg-zion-cyan animate-pulse' : 'bg-zion-purple'
                      }`}
                    />
                    {status.online
                      ? (BridgeCopy.relayOnline[cs ? 'cs' : 'en'])
                      : (BridgeCopy.relayOffline[cs ? 'cs' : 'en'])}
                  </span>
                ) : (
                  <span className="zion-badge">
                    <span className="h-2 w-2 rounded-full bg-gray-500 animate-pulse" />
                    {BridgeCopy.checking[cs ? 'cs' : 'en']}
                  </span>
                )}

                {status?.online && (
                  <span className="zion-badge">
                    {status.online ? (
                      <Wifi className="h-3.5 w-3.5 text-zion-cyan" />
                    ) : (
                      <WifiOff className="h-3.5 w-3.5 text-zion-gold" />
                    )}
                    <span className="text-gray-300">Uptime:</span>
                    <span className="font-mono text-white">{formatUptime(status.uptime_seconds)}</span>
                  </span>
                )}

                {status?.online && (
                  <span className="zion-badge">
                    <Activity className="h-3.5 w-3.5 text-zion-gold" />
                    <span className="text-gray-300">L1:</span>
                    <span className="font-mono text-white">{status.last_l1_height.toLocaleString()}</span>
                  </span>
                )}

                {status?.online && (
                  <span className="zion-badge">
                    <Activity className="h-3.5 w-3.5 text-zion-cyan" />
                    <span className="text-gray-300">EVM:</span>
                    <span className="font-mono text-white">{status.last_evm_block.toLocaleString()}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Quick info side card */}
            <div className="w-full lg:max-w-md space-y-3">
              <div
                className="zion-rainbow-sub p-5"
                style={{ '--rc': '6, 105, 40' } as CSSProperties}
              >
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                  {BridgeCopy.quickOverview[cs ? 'cs' : 'en']}
                </p>
                <div className="space-y-3">
                  <div
                    className="flex items-center justify-between zion-rainbow-sub p-3"
                    style={{ '--rc': '252, 209, 22' } as CSSProperties}
                  >
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Wallet className="h-4 w-4 text-zion-gold" />
                      {BridgeCopy.locked[cs ? 'cs' : 'en']}
                    </div>
                    <span className="font-mono text-white">{totalBridged.toLocaleString()} ZION</span>
                  </div>
                  <div
                    className="flex items-center justify-between zion-rainbow-sub p-3"
                    style={{ '--rc': '6, 105, 40' } as CSSProperties}
                  >
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Unlock className="h-4 w-4 text-zion-cyan" />
                      {BridgeCopy.unlocks[cs ? 'cs' : 'en']}
                    </div>
                    <span className="font-mono text-white">{(status?.l1_unlocks_confirmed ?? 0).toLocaleString()}</span>
                  </div>
                  <div
                    className="flex items-center justify-between zion-rainbow-sub p-3"
                    style={{ '--rc': '6, 105, 40' } as CSSProperties}
                  >
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <ShieldCheck className="h-4 w-4 text-zion-cyan" />
                      {BridgeCopy.validators[cs ? 'cs' : 'en']}
                    </div>
                    <span className="font-mono text-white">5/5</span>
                  </div>
                  <div
                    className="flex items-center justify-between zion-rainbow-sub p-3"
                    style={{ '--rc': status?.online ? '6, 105, 40' : '228, 30, 43' } as CSSProperties}
                  >
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <Activity className={`h-4 w-4 ${status?.online ? 'text-zion-cyan' : 'text-zion-purple'}`} />
                      {BridgeCopy.relay[cs ? 'cs' : 'en']}
                    </div>
                    <span className={`font-mono ${status?.online ? 'text-zion-cyan' : 'text-zion-purple'}`}>
                      {status?.online ? (BridgeCopy.online[cs ? 'cs' : 'en']) : (BridgeCopy.offline[cs ? 'cs' : 'en'])}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Quick Stats ── */}
      <section className="zion-container relative z-10 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{BridgeCopy.telemetry[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <Activity className="h-7 w-7 text-zion-cyan" />
              {BridgeCopy.bridgeStatistics[cs ? 'cs' : 'en']}
            </h2>
            <p className="text-sm text-gray-400">
              {BridgeCopy.bridgeMetricsAggregatedFromThe[cs ? 'cs' : 'en']}
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="zion-rainbow-sub p-4 animate-pulse"
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
                icon={<Lock className="h-5 w-5" />}
                colorClass="text-zion-cyan"
                bgClass="bg-zion-cyan/10"
                rc="6, 105, 40"
                label={BridgeCopy.mints[cs ? 'cs' : 'en']}
                value={(status?.evm_mints_confirmed ?? 0).toLocaleString()}
                sub={BridgeCopy.l1Base[cs ? 'cs' : 'en']}
                tip={BridgeCopy.totalWzionMintedOnBaseAfterLoc[cs ? 'cs' : 'en']}
              />
              <StatCard
                icon={<Flame className="h-5 w-5" />}
                colorClass="text-zion-gold"
                bgClass="bg-zion-gold/10"
                rc="252, 209, 22"
                label={BridgeCopy.burns[cs ? 'cs' : 'en']}
                value={(status?.evm_burns_detected ?? 0).toLocaleString()}
                sub={BridgeCopy.baseL1[cs ? 'cs' : 'en']}
                tip={BridgeCopy.totalWzionBurnEventsDetectedOn[cs ? 'cs' : 'en']}
              />
              <StatCard
                icon={<Unlock className="h-5 w-5" />}
                colorClass="text-zion-gold"
                bgClass="bg-zion-gold/10"
                rc="252, 209, 22"
                label={BridgeCopy.unlocks[cs ? 'cs' : 'en']}
                value={(status?.l1_unlocks_confirmed ?? 0).toLocaleString()}
                sub={BridgeCopy.confirmed[cs ? 'cs' : 'en']}
                tip={BridgeCopy.totalL1UnlocksConfirmedByTheRe[cs ? 'cs' : 'en']}
              />
              <StatCard
                icon={<Activity className="h-5 w-5" />}
                colorClass="text-zion-purple"
                bgClass="bg-zion-purple/10"
                rc="59, 130, 246"
                label={BridgeCopy.errors[cs ? 'cs' : 'en']}
                value={(status?.errors_total ?? 0).toLocaleString()}
                sub={BridgeCopy.total[cs ? 'cs' : 'en']}
                tip={BridgeCopy.totalErrorsLoggedByTheRelayer[cs ? 'cs' : 'en']}
              />
              <StatCard
                icon={<Lock className="h-5 w-5" />}
                colorClass="text-zion-cyan"
                bgClass="bg-zion-cyan/10"
                rc="6, 105, 40"
                label={BridgeCopy.locks[cs ? 'cs' : 'en']}
                value={(status?.l1_locks_finalized ?? 0).toLocaleString()}
                sub={BridgeCopy.finalized[cs ? 'cs' : 'en']}
                tip={BridgeCopy.l1LocksThatReached60BlockFinal[cs ? 'cs' : 'en']}
              />
              <StatCard
                icon={<ShieldCheck className="h-5 w-5" />}
                colorClass="text-zion-purple"
                bgClass="bg-zion-purple/10"
                rc="228, 30, 43"
                label={BridgeCopy.validators[cs ? 'cs' : 'en']}
                value="5/5"
                sub={BridgeCopy.guardianRelay[cs ? 'cs' : 'en']}
                tip={BridgeCopy.guardianValidators55Quorum[cs ? 'cs' : 'en']}
              />
              <StatCard
                icon={<Clock className="h-5 w-5" />}
                colorClass="text-zion-cyan"
                bgClass="bg-zion-cyan/10"
                rc="6, 105, 40"
                label={BridgeCopy.uptime[cs ? 'cs' : 'en']}
                value={status ? formatUptime(status.uptime_seconds) : '—'}
                sub={BridgeCopy.relayRunning[cs ? 'cs' : 'en']}
              />
              <StatCard
                icon={<TrendingUp className="h-5 w-5" />}
                colorClass="text-zion-gold"
                bgClass="bg-zion-gold/10"
                rc="252, 209, 22"
                label={BridgeCopy.efficiency[cs ? 'cs' : 'en']}
                value={`${status ? bridgeEfficiency(status) : 0}%`}
                sub={BridgeCopy.finalizedDetected[cs ? 'cs' : 'en']}
                tip={BridgeCopy.ratioOfFinalizedLocksToDetecte[cs ? 'cs' : 'en']}
              />
            </div>
          )}
        </motion.div>
      </section>

      {/* ── Tab Navigation ── */}
      <section className="zion-container relative z-10 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.02 }}
          className="zion-rainbow-card p-4 md:p-5"
          style={{ '--rc': '6, 105, 40' } as CSSProperties}
        >
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mr-1 hidden sm:inline">
              {BridgeCopy.bridgeOperations[cs ? 'cs' : 'en']}
            </span>
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`inline-flex items-center gap-2 !px-4 !py-2 text-sm font-medium transition ${
                    active
                      ? 'zion-rainbow-sub text-zion-cyan'
                      : 'zion-panel-soft text-gray-300 hover:text-white'
                  }`}
                  style={active ? ({ '--rc': '6, 105, 40' } as CSSProperties) : undefined}
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
      <section className="zion-container relative z-10 mb-8">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {tab === 'lock' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Lock & Mint widget */}
              <div
                className="zion-rainbow-card p-6"
                style={{ '--rc': '6, 105, 40' } as CSSProperties}
              >
                <div className="flex items-center gap-2 mb-6">
                  <Lock className="h-5 w-5 text-zion-cyan" />
                  <h2 className="text-lg font-bold text-white">
                    {BridgeCopy.lockZionOnL1[cs ? 'cs' : 'en']}
                  </h2>
                </div>

                {/* Step 1: Bridge address */}
                <div className="mb-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zion-cyan mb-2">
                    {BridgeCopy.step1SendZionToBridgeAddress[cs ? 'cs' : 'en']}
                  </p>
                  <div
                    className="flex items-center gap-3 zion-rainbow-sub p-3"
                    style={{ '--rc': '6, 105, 40' } as CSSProperties}
                  >
                    <code className="flex-1 font-mono text-sm text-zion-cyan break-all">
                      {BRIDGE_CONTRACTS.l1_bridge_address}
                    </code>
                    <button
                      onClick={() => copyText(BRIDGE_CONTRACTS.l1_bridge_address, 'l1addr')}
                      className="zion-button-secondary shrink-0 !p-2"
                    >
                      <Copy className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                  {copied === 'l1addr' && (
                    <p className="text-xs text-zion-cyan mt-1">✓ {BridgeCopy.copied[cs ? 'cs' : 'en']}</p>
                  )}
                </div>

                {/* Step 2: Memo */}
                <div className="mb-5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zion-cyan mb-2">
                    {BridgeCopy.step2IncludeMemoWithYourEvmAdd[cs ? 'cs' : 'en']}
                  </p>
                  <div
                    className="zion-rainbow-sub p-1 mb-3"
                    style={{ '--rc': '6, 105, 40' } as CSSProperties}
                  >
                    <input
                      type="text"
                      value={memoAddr}
                      onChange={(e) => setMemoAddr(e.target.value)}
                      placeholder="0xYourEvmAddress"
                      className="w-full rounded-lg border-0 bg-transparent px-3 py-2.5 font-mono text-sm text-white placeholder:text-gray-600 outline-none"
                    />
                  </div>
                  <div
                    className="flex items-center gap-3 zion-rainbow-sub p-3"
                    style={{ '--rc': '6, 105, 40' } as CSSProperties}
                  >
                    <code className="flex-1 font-mono text-sm text-zion-cyan break-all">{memoString}</code>
                    <button
                      onClick={() => copyText(memoString, 'memo')}
                      className="zion-button-secondary shrink-0 !p-2"
                    >
                      <Copy className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                  {copied === 'memo' && (
                    <p className="text-xs text-zion-cyan mt-1">✓ {BridgeCopy.copied[cs ? 'cs' : 'en']}</p>
                  )}
                </div>

                {/* Step 3: Wait */}
                <div
                  className="flex items-start gap-3 zion-rainbow-sub p-4 mb-4"
                  style={{ '--rc': '6, 105, 40' } as CSSProperties}
                >
                  <Clock className="h-4 w-4 text-zion-cyan shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-300">
                    {BridgeCopy.wait10MinRelayDetectsLockWaits[cs ? 'cs' : 'en']}
                  </p>
                </div>

                <p className="text-xs text-gray-500">
                  {BridgeCopy.minimum100ZionMemoFormat[cs ? 'cs' : 'en']}
                  <code className="text-gray-400">BRIDGE:base:0x...</code>
                </p>
              </div>

              {/* Side info */}
              <div className="space-y-6">
                <div
                  className="zion-rainbow-card p-6"
                  style={{ '--rc': '6, 105, 40' } as CSSProperties}
                >
                  <h3 className="text-sm font-semibold text-white mb-4">
                    {BridgeCopy.howItWorks[cs ? 'cs' : 'en']}
                  </h3>
                  <div className="space-y-3">
                    {[
                      {
                        icon: Lock,
                        text: BridgeCopy.sendZionToBridgeEscrowAddressW[cs ? 'cs' : 'en'],
                        rc: '6, 105, 40',
                        color: 'text-zion-cyan',
                      },
                      {
                        icon: Shield,
                        text: BridgeCopy.relayVerifies60BlockFinalityGu[cs ? 'cs' : 'en'],
                        rc: '252, 209, 22',
                        color: 'text-zion-gold',
                      },
                      {
                        icon: ArrowRight,
                        text: BridgeCopy.zionbridgeMintsWzionToYourBase[cs ? 'cs' : 'en'],
                        rc: '6, 105, 40',
                        color: 'text-zion-cyan',
                      },
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg zion-rainbow-sub"
                          style={{ '--rc': step.rc } as CSSProperties}
                        >
                          <step.icon className={`h-3.5 w-3.5 ${step.color}`} />
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed pt-1">{step.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="zion-rainbow-card p-6"
                  style={{ '--rc': '6, 105, 40' } as CSSProperties}
                >
                  <h3 className="text-sm font-semibold text-white mb-3">
                    {BridgeCopy.contracts[cs ? 'cs' : 'en']}
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div
                      className="flex items-center justify-between zion-rainbow-sub p-3"
                      style={{ '--rc': '6, 105, 40' } as CSSProperties}
                    >
                      <span className="text-gray-400">wZION</span>
                      <Link
                        href={`${BRIDGE_CONTRACTS.explorer_base}${BRIDGE_CONTRACTS.wzion_address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-zion-cyan hover:text-zion-cyan"
                      >
                        BaseScan <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <div
                      className="flex items-center justify-between zion-rainbow-sub p-3"
                      style={{ '--rc': '6, 105, 40' } as CSSProperties}
                    >
                      <span className="text-gray-400">ZIONBridge</span>
                      <Link
                        href={`${BRIDGE_CONTRACTS.explorer_base}${BRIDGE_CONTRACTS.bridge_address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-zion-cyan hover:text-zion-cyan"
                      >
                        BaseScan <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <div
                      className="flex items-center justify-between zion-rainbow-sub p-3"
                      style={{ '--rc': '228, 30, 43' } as CSSProperties}
                    >
                      <span className="text-gray-400">{BridgeCopy.pipelineTracker[cs ? 'cs' : 'en']}</span>
                      <Link href="/explorer/bridge" className="inline-flex items-center gap-1 text-gray-400 hover:text-white">
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/5">
                    <p className="text-[10px] text-gray-500">
                      {BRIDGE_CONTRACTS.network} · Chain {BRIDGE_CONTRACTS.chain_id} · 5/5 Guardians
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'burn' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div
                className="zion-rainbow-card p-5"
                style={{ '--rc': '252, 209, 22' } as CSSProperties}
              >
                <BridgeBurnWidget />
              </div>
              <div className="space-y-6">
                <div
                  className="zion-rainbow-card p-6"
                  style={{ '--rc': '252, 209, 22' } as CSSProperties}
                >
                  <h3 className="text-sm font-semibold text-white mb-4">
                    {BridgeCopy.howItWorks[cs ? 'cs' : 'en']}
                  </h3>
                  <div className="space-y-3">
                    {[
                      {
                        icon: Flame,
                        text: BridgeCopy.burnWzionOnBaseBurnAmountL1rec[cs ? 'cs' : 'en'],
                        rc: '252, 209, 22',
                        color: 'text-zion-gold',
                      },
                      {
                        icon: Shield,
                        text: BridgeCopy.evmWatcherWaits64BlockFinality[cs ? 'cs' : 'en'],
                        rc: '252, 209, 22',
                        color: 'text-zion-gold',
                      },
                      {
                        icon: ArrowRight,
                        text: BridgeCopy.relaySubmitsL1UnlockZionArrive[cs ? 'cs' : 'en'],
                        rc: '6, 105, 40',
                        color: 'text-zion-cyan',
                      },
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg zion-rainbow-sub"
                          style={{ '--rc': step.rc } as CSSProperties}
                        >
                          <step.icon className={`h-3.5 w-3.5 ${step.color}`} />
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed pt-1">{step.text}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="zion-rainbow-card p-6"
                  style={{ '--rc': '6, 105, 40' } as CSSProperties}
                >
                  <h3 className="text-sm font-semibold text-white mb-3">{BridgeCopy.details[cs ? 'cs' : 'en']}</h3>
                  <div className="space-y-2 text-xs text-gray-300">
                    <p>{BridgeCopy.time5Min64EvmBlocksL1Unlock[cs ? 'cs' : 'en']}</p>
                    <p>{BridgeCopy.feeOnlyEvmGasEthOnBase[cs ? 'cs' : 'en']}</p>
                    <p>{BridgeCopy.minimum100Wzion[cs ? 'cs' : 'en']}</p>
                    <p>{BridgeCopy.l1AddressZion1OrZo[cs ? 'cs' : 'en']}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </section>

      {/* ── FAQ ── */}
      <section className="zion-container relative z-10 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="zion-section"
        >
          <div className="flex flex-col gap-2 mb-6">
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{BridgeCopy.support[cs ? 'cs' : 'en']}</p>
            <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
              <HelpCircle className="h-7 w-7 text-zion-purple" />
              {BridgeCopy.faq[cs ? 'cs' : 'en']}
            </h2>
          </div>
          <div className="space-y-3 max-w-3xl">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="zion-rainbow-card overflow-hidden"
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
    </div>
  );
}
