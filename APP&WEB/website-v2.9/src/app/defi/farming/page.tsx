'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  ArrowLeft,
  Flame,
  Layers,
  Lock,
  PiggyBank,
  Sprout,
  TrendingUp,
  Unlock,
  Wallet,
  Zap,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Clock,
  Shield,
  Coins,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useWallet } from '@/contexts/WalletContext';
import { CONTRACTS, FARM_ABI, WZION_ABI, FARM_DEPLOYED } from '@/lib/defi-contracts';

const RPC_URL = 'https://mainnet.base.org';
const EXPLORER = 'https://basescan.org';
const SECONDS_PER_YEAR = 365 * 24 * 3600;
const MAX_POOLS = 5;

interface PoolData {
  pid: number;
  lpToken: string;
  allocPoints: number;
  lastRewardTime: number;
  accRewardPerShare: ethers.BigNumber;
  totalStaked: number;
  active: boolean;
  name: string;
  tvl: string; // formatted ether string
  tvlRaw: number; // numeric
  apr: number | null; // estimated APR %
  userDeposited: string; // formatted
  userPending: string; // formatted
  userRewardDebt: ethers.BigNumber;
}

/** Derive a human-readable pool name from its lpToken address. */
function poolName(lpToken: string, pid: number, onChainName?: string): string {
  if (onChainName && onChainName.length > 0) return onChainName;
  const t = lpToken.toLowerCase();
  if (t === CONTRACTS.wZION.toLowerCase()) return 'wZION Single';
  if (t === CONTRACTS.UniV3Pool.toLowerCase()) return 'wZION/WETH LP';
  if (t === CONTRACTS.WETH.toLowerCase()) return 'WETH Pool';
  return `Pool #${pid}`;
}

export default function FarmingPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const { connected, account, signer, isBaseMainnet, connect, switchToBase } = useWallet();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [selectedPid, setSelectedPid] = useState(0);
  const [amount, setAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // ── Live contract data ────────────────────────────────────────────────────
  const [rewardPerSecond, setRewardPerSecond] = useState('—');
  const [poolLength, setPoolLength] = useState(0);
  const [totalAllocPoint, setTotalAllocPoint] = useState(0);
  const [paused, setPaused] = useState(false);
  const [pools, setPools] = useState<PoolData[]>([]);
  const [userBalance, setUserBalance] = useState('0');

  // ── TX state ──────────────────────────────────────────────────────────────
  const [txPhase, setTxPhase] = useState<
    | 'idle'
    | 'approving'
    | 'depositing'
    | 'withdrawing'
    | 'claiming'
    | 'emergency'
    | 'success'
    | 'error'
  >('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  // ── Refresh all farm data ──────────────────────────────────────────────────
  const refreshData = useCallback(async () => {
    if (!FARM_DEPLOYED) return;
    try {
      const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
      const farm = new ethers.Contract(CONTRACTS.ZIONFarm, FARM_ABI, provider);
      const wzion = new ethers.Contract(CONTRACTS.wZION, WZION_ABI, provider);

      const [rps, plen, tap, ps] = await Promise.all([
        farm.rewardPerSecond(),
        farm.poolCount(),
        farm.totalAllocPoints(),
        farm.paused(),
      ]);
      setRewardPerSecond(ethers.utils.formatEther(rps));
      const len = Number(plen);
      setPoolLength(len);
      setTotalAllocPoint(Number(tap));
      setPaused(ps);

      // Fetch up to MAX_POOLS pools (or poolCount, whichever is smaller)
      const count = Math.min(MAX_POOLS, len);
      const fetched: PoolData[] = [];
      for (let pid = 0; pid < count; pid++) {
        try {
          const info = await farm.getPool(pid);
          const lpToken = info.lpToken;
          const allocPoints = Number(info.allocPoints);
          const lastRewardTime = Number(info.lastRewardTime);
          const accRewardPerShare = info.accRewardPerShare;
          const poolTotalStaked = Number(info.totalStaked);
          const active = info.active;
          const onChainName = info.name;

          // TVL = LP token balance held by the farm contract
          let tvlRaw = poolTotalStaked;
          let tvl = poolTotalStaked.toString();
          try {
            const lp = new ethers.Contract(lpToken, WZION_ABI, provider);
            const bal = await lp.balanceOf(CONTRACTS.ZIONFarm);
            tvl = ethers.utils.formatEther(bal);
            tvlRaw = parseFloat(tvl);
          } catch {
            // fallback to pool.totalStaked
          }

          // Estimated APR: (rewardPerSecond * allocPoints / totalAlloc) * YEAR / TVL * 100
          let apr: number | null = null;
          const tapNum = Number(tap);
          const rpsNum = parseFloat(ethers.utils.formatEther(rps));
          if (tvlRaw > 0 && tapNum > 0 && allocPoints > 0) {
            const annualReward = rpsNum * (allocPoints / tapNum) * SECONDS_PER_YEAR;
            apr = (annualReward / tvlRaw) * 100;
          }

          // Per-user data
          let userDeposited = '0';
          let userPending = '0';
          let userRewardDebt = ethers.BigNumber.from(0);
          if (account) {
            try {
              const ui = await farm.getUser(pid, account);
              userDeposited = ethers.utils.formatEther(ui.staked);
              userRewardDebt = ui.rewardDebt;
              const pending = await farm.pendingReward(pid, account);
              userPending = ethers.utils.formatEther(pending);
            } catch {
              // silent
            }
          }

          fetched.push({
            pid,
            lpToken,
            allocPoints,
            lastRewardTime,
            accRewardPerShare,
            totalStaked: poolTotalStaked,
            active,
            name: poolName(lpToken, pid, onChainName),
            tvl,
            tvlRaw,
            apr,
            userDeposited,
            userPending,
            userRewardDebt,
          });
        } catch {
          // pool doesn't exist yet — stop fetching further
          break;
        }
      }
      setPools(fetched);

      // Auto-select first valid pool if current selection invalid
      if (fetched.length > 0 && !fetched.find((p) => p.pid === selectedPid)) {
        setSelectedPid(fetched[0].pid);
      }

      // User wZION wallet balance
      if (account) {
        try {
          const bal = await wzion.balanceOf(account);
          setUserBalance(ethers.utils.formatEther(bal));
        } catch {
          // silent
        }
      }
    } catch {
      // silent — reads fail gracefully
    }
  }, [account, selectedPid]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  // Auto-refresh every 30s when connected
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, [connected, refreshData]);

  const selectedPool = pools.find((p) => p.pid === selectedPid) ?? pools[0];

  // ── Deposit (approve + deposit) ─────────────────────────────────────────────
  const handleDeposit = async () => {
    if (!signer || !amount || !selectedPool) return;
    setTxPhase('approving');
    setTxError(null);
    setTxHash(null);
    try {
      const wzion = new ethers.Contract(CONTRACTS.wZION, WZION_ABI, signer);
      const farm = new ethers.Contract(CONTRACTS.ZIONFarm, FARM_ABI, signer);
      const amt = ethers.utils.parseEther(amount);

      // Approve wZION for the farm contract
      const approveTx = await wzion.approve(CONTRACTS.ZIONFarm, amt);
      setTxHash(approveTx.hash);
      setTxPhase('depositing');
      await approveTx.wait();

      // Deposit into selected pool
      const depositTx = await farm.deposit(selectedPool.pid, amt);
      setTxHash(depositTx.hash);
      await depositTx.wait();
      setTxPhase('success');
      setAmount('');
      void refreshData();
    } catch (e: any) {
      setTxError(e?.reason || e?.message || 'Transaction failed');
      setTxPhase('error');
    }
  };

  // ── Withdraw ────────────────────────────────────────────────────────────────
  const handleWithdraw = async () => {
    if (!signer || !withdrawAmount || !selectedPool) return;
    setTxPhase('withdrawing');
    setTxError(null);
    setTxHash(null);
    try {
      const farm = new ethers.Contract(CONTRACTS.ZIONFarm, FARM_ABI, signer);
      const amt = ethers.utils.parseEther(withdrawAmount);
      const tx = await farm.withdraw(selectedPool.pid, amt);
      setTxHash(tx.hash);
      await tx.wait();
      setTxPhase('success');
      setWithdrawAmount('');
      void refreshData();
    } catch (e: any) {
      setTxError(e?.reason || e?.message || 'Transaction failed');
      setTxPhase('error');
    }
  };

  // ── Harvest rewards ────────────────────────────────────────────────────────
  const handleHarvest = async () => {
    if (!signer || !selectedPool) return;
    setTxPhase('claiming');
    setTxError(null);
    setTxHash(null);
    try {
      const farm = new ethers.Contract(CONTRACTS.ZIONFarm, FARM_ABI, signer);
      const tx = await farm.harvest(selectedPool.pid);
      setTxHash(tx.hash);
      await tx.wait();
      setTxPhase('success');
      void refreshData();
    } catch (e: any) {
      setTxError(e?.reason || e?.message || 'Transaction failed');
      setTxPhase('error');
    }
  };

  // ── Emergency withdraw ──────────────────────────────────────────────────────
  const handleEmergencyWithdraw = async () => {
    if (!signer || !selectedPool) return;
    setTxPhase('emergency');
    setTxError(null);
    setTxHash(null);
    try {
      const farm = new ethers.Contract(CONTRACTS.ZIONFarm, FARM_ABI, signer);
      const tx = await farm.emergencyWithdraw(selectedPool.pid);
      setTxHash(tx.hash);
      await tx.wait();
      setTxPhase('success');
      void refreshData();
    } catch (e: any) {
      setTxError(e?.reason || e?.message || 'Transaction failed');
      setTxPhase('error');
    }
  };

  const busy =
    txPhase === 'approving' ||
    txPhase === 'depositing' ||
    txPhase === 'withdrawing' ||
    txPhase === 'claiming' ||
    txPhase === 'emergency';

  const fmt = (v: string, decimals = 4) => {
    const n = parseFloat(v);
    if (isNaN(n)) return '0';
    return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
  };

  return (
    <div className="pt-28 md:pt-32 pb-24 overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-green-500/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-gold/6" />
      </div>

      <div className="relative z-10 zion-container max-w-5xl space-y-14">
        {/* Back */}
        <Link href="/defi" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {cs ? 'Zpět do DeFi Hub' : 'Back to DeFi Hub'}
        </Link>

        {/* HERO */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} style={{ '--rc': '132, 204, 22' } as React.CSSProperties} className="zion-rainbow-card rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-green-500/40 bg-green-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-green-300 uppercase mb-4">
            <Sprout className="h-4 w-4" />
            DeFi · Farming
          </div>
          {FARM_DEPLOYED ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold tracking-wider text-emerald-300 uppercase mb-4 ml-2">
              <CheckCircle2 className="h-3 w-3" /> Base Mainnet
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold tracking-wider text-amber-300 uppercase mb-4 ml-2">
              <Clock className="h-3 w-3" /> {cs ? 'Deploy pending' : 'Deploy pending'}
            </div>
          )}
          <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
            {cs ? 'Yield Farming' : 'Yield Farming'}
          </h1>
          <p className="mt-4 text-lg text-gray-300 max-w-2xl">
            {cs
              ? 'Vložte LP tokeny do ZIONFarm a získávejte odměny ve wZION. MasterChef-style distribuce s dynamickým allocPoint a 90denním halvingem.'
              : 'Deposit LP tokens into ZIONFarm and earn wZION rewards. MasterChef-style distribution with dynamic allocPoint and 90-day halving.'}
          </p>

          {/* Deploy pending banner */}
          {!FARM_DEPLOYED && (
            <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-gray-300">
                  {cs
                    ? 'Farming kontrakt ještě nebyl nasazen na Base Mainnet. Deploy proběhne po pool seeding.'
                    : 'Farming contract has not yet been deployed to Base Mainnet. Deploy will happen after pool seeding.'}
                </p>
              </div>
            </div>
          )}

          {paused && FARM_DEPLOYED && (
            <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
              <p className="text-sm text-gray-300">
                {cs ? 'Farming je momentálně pozastaven (paused).' : 'Farming is currently paused.'}
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
              <Zap className="h-3 w-3 text-green-400" /> {fmt(rewardPerSecond, 4)} wZION/s
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
              <Flame className="h-3 w-3 text-zion-gold" /> MasterChef v2
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
              <TrendingUp className="h-3 w-3 text-zion-cyan" /> {cs ? 'Halving každých 90 dní' : '90-day halving'}
            </span>
            <span className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 ${paused ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${paused ? 'bg-red-400' : 'bg-emerald-400 animate-pulse'}`} />
              {paused ? (cs ? 'Pozastaveno' : 'Paused') : cs ? 'Aktivní' : 'Active'}
            </span>
          </div>
        </motion.section>

        {/* Stats */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: cs ? 'Odměna / s' : 'Reward / s', value: `${fmt(rewardPerSecond, 4)} wZION`, icon: Zap, color: 'text-green-400' },
              { label: cs ? 'Počet poolů' : 'Pools', value: String(poolLength), icon: Layers, color: 'text-zion-cyan' },
              { label: cs ? 'Celkem alloc' : 'Total Alloc', value: totalAllocPoint.toLocaleString(), icon: TrendingUp, color: 'text-zion-gold' },
              { label: cs ? 'Stav kontraktu' : 'Contract', value: paused ? (cs ? 'Pozastaveno' : 'Paused') : (cs ? 'Aktivní' : 'Active'), icon: Shield, color: paused ? 'text-red-400' : 'text-emerald-400' },
            ].map((card) => (
              <div key={card.label} className="zion-rainbow-sub p-5" style={{ '--rc': '132, 204, 22' } as React.CSSProperties}>
                <div className="flex items-center gap-2 mb-2">
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">{card.label}</span>
                </div>
                <p className={`text-xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* User position cards */}
        {connected && FARM_DEPLOYED && selectedPool && (
          <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <div className="grid grid-cols-3 gap-4">
              <div className="zion-rainbow-sub p-4" style={{ '--rc': '132, 204, 22' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                  {cs ? 'Vloženo' : 'Deposited'} · {selectedPool.name}
                </p>
                <p className="text-xl font-bold text-green-400">{fmt(selectedPool.userDeposited, 4)} LP</p>
              </div>
              <div className="zion-rainbow-sub p-4" style={{ '--rc': '132, 204, 22' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{cs ? 'Čekající odměna' : 'Pending Reward'}</p>
                <p className="text-xl font-bold text-zion-gold">{fmt(selectedPool.userPending, 6)} wZION</p>
              </div>
              <div className="zion-rainbow-sub p-4" style={{ '--rc': '132, 204, 22' } as React.CSSProperties}>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{cs ? 'Wallet balance' : 'Wallet'}</p>
                <p className="text-xl font-bold text-white">{fmt(userBalance, 2)} wZION</p>
              </div>
            </div>
          </motion.section>
        )}

        {/* Pool list */}
        {FARM_DEPLOYED && (
          <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
              <Layers className="h-6 w-6 text-zion-cyan" />
              {cs ? 'Farm pooly' : 'Farm Pools'}
            </h2>
            {pools.length === 0 ? (
              <div className="zion-section p-6 text-center text-gray-500 text-sm">
                {cs ? 'Žádné pooly nebyly nalezeny.' : 'No pools found.'}
              </div>
            ) : (
              <div className="space-y-3">
                {pools.map((p) => (
                  <div
                    key={p.pid}
                    onClick={() => setSelectedPid(p.pid)}
                    style={{ '--rc': '132, 204, 22' } as React.CSSProperties}
                    className={`cursor-pointer zion-rainbow-sub p-5 ${
                      selectedPid === p.pid ? '!border-green-500/40 !bg-green-500/5' : ''
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                      <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-green-500/10 border border-green-500/20">
                        <Sprout className="h-5 w-5 text-green-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-white">{p.name}</h3>
                          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-400 uppercase tracking-wider">
                            #{p.pid}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          LP: {p.lpToken.slice(0, 12)}…{p.lpToken.slice(-6)}
                        </p>
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <p className="text-[10px] text-gray-500 uppercase">APR</p>
                          <p className="font-bold text-emerald-400">{p.apr !== null ? `${p.apr.toFixed(2)}%` : '—'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-500 uppercase">TVL</p>
                          <p className="font-bold text-white">{fmt(p.tvl, 2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-500 uppercase">Alloc</p>
                          <p className="font-bold text-zion-gold">{p.allocPoints.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-gray-500 uppercase">{cs ? 'Odměna' : 'Pending'}</p>
                          <p className="font-bold text-zion-gold">{fmt(p.userPending, 4)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.section>
        )}

        {/* Wallet connect / Farm UI */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} style={{ '--rc': '132, 204, 22' } as React.CSSProperties} className="zion-rainbow-card p-6 md:p-8">
          {!connected ? (
            <div className="text-center py-8">
              <Wallet className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">
                {cs ? 'Připojte peněženku pro farming' : 'Connect wallet to farm'}
              </p>
              <button
                onClick={connect}
                className="rounded-2xl bg-green-500/20 border border-green-500/30 px-8 py-3 text-sm font-semibold text-green-300 hover:bg-green-500/30 transition-colors"
              >
                {cs ? 'Připojit MetaMask' : 'Connect MetaMask'}
              </button>
            </div>
          ) : !isBaseMainnet ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">
                {cs ? 'Přepněte na Base Mainnet' : 'Switch to Base Mainnet'}
              </p>
              <button
                onClick={switchToBase}
                className="rounded-2xl bg-zion-gold/20 border border-zion-gold/30 px-8 py-3 text-sm font-semibold text-zion-gold hover:bg-zion-gold/30 transition-colors"
              >
                {cs ? 'Přepnout síť' : 'Switch to Base'}
              </button>
            </div>
          ) : !FARM_DEPLOYED ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-amber-400 mx-auto mb-4" />
              <p className="text-gray-400">
                {cs ? 'Farming kontrakt čeká na deploy na Base Mainnet.' : 'Contract awaiting deployment on Base Mainnet.'}
              </p>
            </div>
          ) : !selectedPool ? (
            <div className="text-center py-8">
              <Sprout className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">
                {cs ? 'Žádné pooly nejsou dostupné.' : 'No pools available.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Sprout className="h-5 w-5 text-green-400" />
                <h3 className="text-lg font-semibold text-white">
                  {selectedPool.name} <span className="text-gray-500 text-sm">#{selectedPool.pid}</span>
                </h3>
              </div>

              {/* Deposit */}
              <div className="zion-rainbow-sub p-5" style={{ '--rc': '132, 204, 22' } as React.CSSProperties}>
                <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-green-400" />
                  {cs ? 'Vložit LP tokeny' : 'Deposit LP Tokens'}
                </h4>
                <div className="space-y-3 max-w-md">
                  <div>
                    <div className="relative">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        disabled={busy}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-green-500/40 font-mono disabled:opacity-50"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500">LP</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">
                      {cs ? 'Dostupno' : 'Available'}: {fmt(userBalance, 2)} wZION
                    </p>
                  </div>
                  <button
                    onClick={handleDeposit}
                    disabled={busy || !amount || parseFloat(amount) <= 0}
                    className="w-full rounded-2xl bg-green-500/20 border border-green-500/30 px-6 py-3 text-sm font-semibold text-green-300 hover:bg-green-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {busy && txPhase === 'approving' && <Loader2 className="h-4 w-4 animate-spin" />}
                    {txPhase === 'approving' ? (cs ? 'Schvaluji wZION...' : 'Approving wZION...') :
                     txPhase === 'depositing' ? (cs ? 'Vkládám...' : 'Depositing...') :
                     cs ? 'Vložit LP tokeny' : 'Deposit LP Tokens'}
                  </button>
                </div>
              </div>

              {/* Withdraw */}
              <div className="zion-rainbow-sub p-5" style={{ '--rc': '132, 204, 22' } as React.CSSProperties}>
                <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <Unlock className="h-4 w-4 text-amber-400" />
                  {cs ? 'Vybrat LP tokeny' : 'Withdraw LP Tokens'}
                </h4>
                <div className="space-y-3 max-w-md">
                  <div>
                    <div className="relative">
                      <input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="0.00"
                        disabled={busy}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-amber-500/40 font-mono disabled:opacity-50"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500">LP</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">
                      {cs ? 'Vloženo' : 'Deposited'}: {fmt(selectedPool.userDeposited, 4)} LP
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleWithdraw}
                      disabled={busy || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                      className="flex-1 rounded-2xl bg-amber-500/20 border border-amber-500/30 px-6 py-3 text-sm font-semibold text-amber-300 hover:bg-amber-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {busy && txPhase === 'withdrawing' && <Loader2 className="h-4 w-4 animate-spin" />}
                      {cs ? 'Vybrat' : 'Withdraw'}
                    </button>
                    <button
                      onClick={handleEmergencyWithdraw}
                      disabled={busy || parseFloat(selectedPool.userDeposited) <= 0}
                      className="rounded-2xl bg-red-500/20 border border-red-500/30 px-4 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      title={cs ? 'Nouzové vybrání (bez odměn)' : 'Emergency withdraw (forfeits rewards)'}
                    >
                      {busy && txPhase === 'emergency' && <Loader2 className="h-4 w-4 animate-spin" />}
                      {cs ? 'Nouzově' : 'Emergency'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Claim */}
              <div className="zion-rainbow-sub p-5" style={{ '--rc': '132, 204, 22' } as React.CSSProperties}>
                <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-zion-gold" />
                  {cs ? 'Nárokovat odměnu' : 'Claim Reward'}
                </h4>
                <div className="flex items-center gap-4 max-w-md">
                  <div className="flex-1">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{cs ? 'Čekající' : 'Pending'}</p>
                    <p className="text-2xl font-bold text-zion-gold">{fmt(selectedPool.userPending, 6)} wZION</p>
                  </div>
                  <button
                    onClick={handleHarvest}
                    disabled={busy || parseFloat(selectedPool.userPending) <= 0}
                    className="rounded-2xl bg-zion-gold/20 border border-zion-gold/30 px-6 py-3 text-sm font-semibold text-zion-gold hover:bg-zion-gold/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {busy && txPhase === 'claiming' && <Loader2 className="h-4 w-4 animate-spin" />}
                    {cs ? 'Vybírat odměnu' : 'Claim Reward'}
                  </button>
                </div>
              </div>

              {/* TX status */}
              {txHash && (txPhase === 'success' || busy) && (
                <div className="zion-tile p-3 flex items-center gap-2 text-xs">
                  {txPhase === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Loader2 className="h-4 w-4 animate-spin text-zion-gold" />}
                  <a href={`${EXPLORER}/tx/${txHash}`} target="_blank" rel="noopener" className="text-zion-gold hover:underline flex items-center gap-1">
                    {txHash.slice(0, 10)}...{txHash.slice(-8)} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {txError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 flex items-center gap-2 text-xs text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{txError}</span>
                </div>
              )}
            </div>
          )}
        </motion.section>

        {/* How it works */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
            <Zap className="h-6 w-6 text-zion-gold" />
            {cs ? 'Jak to funguje' : 'How it works'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { step: '1', title: cs ? 'Schval & vlož' : 'Approve & Deposit', desc: cs ? 'Schval wZION pro farm kontrakt a vlož LP tokeny do vybraného poolu.' : 'Approve wZION for the farm contract and deposit LP tokens into the selected pool.', icon: Lock },
              { step: '2', title: cs ? 'Sbírej odměny' : 'Earn Rewards', desc: cs ? 'Odměny ve wZION narůstají automaticky podle allocPoint poolu.' : 'wZION rewards accrue automatically based on the pool allocPoint.', icon: Coins },
              { step: '3', title: cs ? 'Claim & Withdraw' : 'Claim & Withdraw', desc: cs ? 'Nárokovuj odměny kdykoliv. Vyber LP tokeny nebo použij emergency withdraw.' : 'Claim rewards anytime. Withdraw LP tokens or use emergency withdraw.', icon: Unlock },
            ].map((s) => (
              <div key={s.step} className="zion-rainbow-sub p-5" style={{ '--rc': '132, 204, 22' } as React.CSSProperties}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-zion-gold">{s.step}</span>
                  <s.icon className="h-4 w-4 text-gray-400" />
                </div>
                <h3 className="text-sm font-medium text-white mb-1">{s.title}</h3>
                <p className="text-[11px] text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Contract */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="zion-section p-5">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-gray-400" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">{cs ? 'Kontrakt' : 'Contract'}</span>
          </div>
          <p className="font-mono text-sm text-gray-300 break-all">
            {FARM_DEPLOYED ? CONTRACTS.ZIONFarm : cs ? 'Čeká na deploy' : 'Awaiting deployment'}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">Base Mainnet · ZIONFarm.sol · MasterChef v2</p>
        </motion.section>

        <p className="text-center text-xs text-gray-600">ZION TerraNova · Yield Farming</p>
      </div>
    </div>
  );
}
