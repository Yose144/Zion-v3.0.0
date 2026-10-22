'use client';

import { motion } from 'framer-motion';
import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { ethers } from 'ethers';
import {
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

const FarmingPanelCopy = {
  deployPending: { cs: `Deploy pending`, en: `Deploy pending` },
  yieldFarming: { cs: `Yield Farming`, en: `Yield Farming` },
  depositLpTokensIntoZionfarmAnd: { cs: `Vložte LP tokeny do ZIONFarm a získávejte odměny ve wZION. MasterChef-style distribuce s dynamickým allocPoint a 90denním halvingem.`, en: `Deposit LP tokens into ZIONFarm and earn wZION rewards. MasterChef-style distribution with dynamic allocPoint and 90-day halving.` },
  farmingContractHasNotYetBeenDe: { cs: `Farming kontrakt ještě nebyl nasazen na Base Mainnet. Deploy proběhne po pool seeding.`, en: `Farming contract has not yet been deployed to Base Mainnet. Deploy will happen after pool seeding.` },
  farmingIsCurrentlyPaused: { cs: `Farming je momentálně pozastaven (paused).`, en: `Farming is currently paused.` },
  k90DayHalving: { cs: `Halving každých 90 dní`, en: `90-day halving` },
  paused: { cs: `Pozastaveno`, en: `Paused` },
  active: { cs: `Aktivní`, en: `Active` },
  rewardS: { cs: `Odměna / s`, en: `Reward / s` },
  pools: { cs: `Počet poolů`, en: `Pools` },
  totalAlloc: { cs: `Celkem alloc`, en: `Total Alloc` },
  contract: { cs: `Stav kontraktu`, en: `Contract` },
  deposited: { cs: `Vloženo`, en: `Deposited` },
  pendingReward: { cs: `Čekající odměna`, en: `Pending Reward` },
  wallet: { cs: `Wallet balance`, en: `Wallet` },
  farmPools: { cs: `Farm pooly`, en: `Farm Pools` },
  noPoolsFound: { cs: `Žádné pooly nebyly nalezeny.`, en: `No pools found.` },
  pending: { cs: `Odměna`, en: `Pending` },
  connectWalletToFarm: { cs: `Připojte peněženku pro farming`, en: `Connect wallet to farm` },
  connectMetamask: { cs: `Připojit MetaMask`, en: `Connect MetaMask` },
  switchToBaseMainnet: { cs: `Přepněte na Base Mainnet`, en: `Switch to Base Mainnet` },
  switchToBase: { cs: `Přepnout síť`, en: `Switch to Base` },
  contractAwaitingDeploymentOnBa: { cs: `Farming kontrakt čeká na deploy na Base Mainnet.`, en: `Contract awaiting deployment on Base Mainnet.` },
  noPoolsAvailable: { cs: `Žádné pooly nejsou dostupné.`, en: `No pools available.` },
  depositLpTokens: { cs: `Vložit LP tokeny`, en: `Deposit LP Tokens` },
  available: { cs: `Dostupno`, en: `Available` },
  approvingWzion: { cs: `Schvaluji wZION...`, en: `Approving wZION...` },
  depositing: { cs: `Vkládám...`, en: `Depositing...` },
  withdrawLpTokens: { cs: `Vybrat LP tokeny`, en: `Withdraw LP Tokens` },
  withdraw: { cs: `Vybrat`, en: `Withdraw` },
  emergencyWithdrawForfeitsRewar: { cs: `Nouzové vybrání (bez odměn)`, en: `Emergency withdraw (forfeits rewards)` },
  emergency: { cs: `Nouzově`, en: `Emergency` },
  claimReward: { cs: `Nárokovat odměnu`, en: `Claim Reward` },
  pending_2: { cs: `Čekající`, en: `Pending` },
  claimReward_2: { cs: `Vybírat odměnu`, en: `Claim Reward` },
  howItWorks: { cs: `Jak to funguje`, en: `How it works` },
  approveDeposit: { cs: `Schval & vlož`, en: `Approve & Deposit` },
  approveWzionForTheFarmContract: { cs: `Schval wZION pro farm kontrakt a vlož LP tokeny do vybraného poolu.`, en: `Approve wZION for the farm contract and deposit LP tokens into the selected pool.` },
  earnRewards: { cs: `Sbírej odměny`, en: `Earn Rewards` },
  wzionRewardsAccrueAutomaticall: { cs: `Odměny ve wZION narůstají automaticky podle allocPoint poolu.`, en: `wZION rewards accrue automatically based on the pool allocPoint.` },
  claimWithdraw: { cs: `Claim & Withdraw`, en: `Claim & Withdraw` },
  claimRewardsAnytimeWithdrawLpT: { cs: `Nárokovuj odměny kdykoliv. Vyber LP tokeny nebo použij emergency withdraw.`, en: `Claim rewards anytime. Withdraw LP tokens or use emergency withdraw.` },
  contract_2: { cs: `Kontrakt`, en: `Contract` },
  awaitingDeployment: { cs: `Čeká na deploy`, en: `Awaiting deployment` },
};

const RPC_URL = 'https://mainnet.base.org';
const EXPLORER = 'https://basescan.org';
const SECONDS_PER_YEAR = 365 * 24 * 3600;
const MAX_POOLS = 5;

const EMERALD_RAINBOW: CSSProperties = { '--rc': '6, 105, 40' } as CSSProperties;

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
  if (t === CONTRACTS.UniV3PoolUSDT.toLowerCase()) return 'wZION/USDT LP';
  if (t === CONTRACTS.UniV3PoolWETH.toLowerCase()) return 'wZION/WETH LP';
  if (t === CONTRACTS.WETH.toLowerCase()) return 'WETH Pool';
  return `Pool #${pid}`;
}

export default function FarmingPanel() {
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

  // ── TX state ─────────────────────────────────────────────────────────────
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

  // ── Refresh all farm data ─────────────────────────────────────────────────
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

  // ── Deposit (approve + deposit) ────────────────────────────────────────────
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

  // ── Withdraw ─────────────────────────────────────────────────────────────────
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

  // ── Emergency withdraw ─────────────────────────────────────────────────────
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
    <section className="zion-section relative z-10 max-w-5xl mx-auto space-y-14">
      {/* HERO */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        style={EMERALD_RAINBOW}
        className="zion-rainbow-card rounded-3xl md:rounded-4xl p-6 md:p-10"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/40 bg-zion-cyan/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-cyan uppercase mb-4">
          <Sprout className="h-4 w-4" />
          DeFi · Farming
        </div>
        {FARM_DEPLOYED ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-zion-cyan/30 bg-zion-cyan/10 px-3 py-1 text-[10px] font-semibold tracking-wider text-zion-cyan uppercase mb-4 ml-2">
            <CheckCircle2 className="h-3 w-3" /> Base Mainnet
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-3 py-1 text-[10px] font-semibold tracking-wider text-zion-gold uppercase mb-4 ml-2">
            <Clock className="h-3 w-3" /> {FarmingPanelCopy.deployPending[cs ? 'cs' : 'en']}
          </div>
        )}
        <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
          {FarmingPanelCopy.yieldFarming[cs ? 'cs' : 'en']}
        </h1>
        <p className="mt-4 text-lg text-gray-300 max-w-2xl">
          {FarmingPanelCopy.depositLpTokensIntoZionfarmAnd[cs ? 'cs' : 'en']}
        </p>

        {/* Deploy pending banner */}
        {!FARM_DEPLOYED && (
          <div className="mt-6 rounded-2xl border border-zion-gold/20 bg-zion-gold/5 p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-zion-gold shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-gray-300">
                {FarmingPanelCopy.farmingContractHasNotYetBeenDe[cs ? 'cs' : 'en']}
              </p>
            </div>
          </div>
        )}

        {paused && FARM_DEPLOYED && (
          <div className="mt-6 rounded-2xl border border-zion-purple/20 bg-zion-purple/5 p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-zion-purple shrink-0" />
            <p className="text-sm text-gray-300">
              {FarmingPanelCopy.farmingIsCurrentlyPaused[cs ? 'cs' : 'en']}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
            <Zap className="h-3 w-3 text-zion-cyan" /> {fmt(rewardPerSecond, 4)} wZION/s
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
            <Flame className="h-3 w-3 text-zion-gold" /> MasterChef v2
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
            <TrendingUp className="h-3 w-3 text-zion-cyan" /> {FarmingPanelCopy.k90DayHalving[cs ? 'cs' : 'en']}
          </span>
          <span className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 ${paused ? 'bg-zion-purple/10 text-zion-purple' : 'bg-zion-cyan/10 text-zion-cyan'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${paused ? 'bg-zion-purple' : 'bg-zion-cyan animate-pulse'}`} />
            {paused ? (FarmingPanelCopy.paused[cs ? 'cs' : 'en']) : FarmingPanelCopy.active[cs ? 'cs' : 'en']}
          </span>
        </div>
      </motion.section>

      {/* Stats */}
      <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: FarmingPanelCopy.rewardS[cs ? 'cs' : 'en'], value: `${fmt(rewardPerSecond, 4)} wZION`, icon: Zap, color: 'text-zion-cyan' },
            { label: FarmingPanelCopy.pools[cs ? 'cs' : 'en'], value: String(poolLength), icon: Layers, color: 'text-zion-cyan' },
            { label: FarmingPanelCopy.totalAlloc[cs ? 'cs' : 'en'], value: totalAllocPoint.toLocaleString(), icon: TrendingUp, color: 'text-zion-gold' },
            { label: FarmingPanelCopy.contract[cs ? 'cs' : 'en'], value: paused ? (FarmingPanelCopy.paused[cs ? 'cs' : 'en']) : (FarmingPanelCopy.active[cs ? 'cs' : 'en']), icon: Shield, color: paused ? 'text-zion-purple' : 'text-zion-cyan' },
          ].map((card) => (
            <div key={card.label} className="zion-tile">
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
            <div className="zion-tile">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                {FarmingPanelCopy.deposited[cs ? 'cs' : 'en']} · {selectedPool.name}
              </p>
              <p className="text-xl font-bold text-zion-cyan">{fmt(selectedPool.userDeposited, 4)} LP</p>
            </div>
            <div className="zion-tile">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{FarmingPanelCopy.pendingReward[cs ? 'cs' : 'en']}</p>
              <p className="text-xl font-bold text-zion-gold">{fmt(selectedPool.userPending, 6)} wZION</p>
            </div>
            <div className="zion-tile">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{FarmingPanelCopy.wallet[cs ? 'cs' : 'en']}</p>
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
            {FarmingPanelCopy.farmPools[cs ? 'cs' : 'en']}
          </h2>
          {pools.length === 0 ? (
            <div className="zion-tile p-6 text-center text-gray-500 text-sm">
              {FarmingPanelCopy.noPoolsFound[cs ? 'cs' : 'en']}
            </div>
          ) : (
            <div className="space-y-3">
              {pools.map((p) => (
                <div
                  key={p.pid}
                  onClick={() => setSelectedPid(p.pid)}
                  className={`cursor-pointer zion-tile p-5 ${
                    selectedPid === p.pid ? '!border-zion-cyan/40 !bg-zion-cyan/5' : ''
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-zion-cyan/10 border border-zion-cyan/20">
                      <Sprout className="h-5 w-5 text-zion-cyan" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-white">{p.name}</h3>
                        <span className="rounded-full bg-zion-cyan/10 border border-zion-cyan/30 px-2 py-0.5 text-[10px] text-zion-cyan uppercase tracking-wider">
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
                        <p className="font-bold text-zion-cyan">{p.apr !== null ? `${p.apr.toFixed(2)}%` : '—'}</p>
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
                        <p className="text-[10px] text-gray-500 uppercase">{FarmingPanelCopy.pending[cs ? 'cs' : 'en']}</p>
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
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        style={EMERALD_RAINBOW}
        className="zion-rainbow-card p-6 md:p-8"
      >
        {!connected ? (
          <div className="text-center py-8">
            <Wallet className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">
              {FarmingPanelCopy.connectWalletToFarm[cs ? 'cs' : 'en']}
            </p>
            <button
              onClick={connect}
              className="rounded-2xl bg-zion-cyan/20 border border-zion-cyan/30 px-8 py-3 text-sm font-semibold text-zion-cyan hover:bg-zion-cyan/30 transition-colors"
            >
              {FarmingPanelCopy.connectMetamask[cs ? 'cs' : 'en']}
            </button>
          </div>
        ) : !isBaseMainnet ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-zion-gold mx-auto mb-4" />
            <p className="text-gray-400 mb-4">
              {FarmingPanelCopy.switchToBaseMainnet[cs ? 'cs' : 'en']}
            </p>
            <button
              onClick={switchToBase}
              className="rounded-2xl bg-zion-gold/20 border border-zion-gold/30 px-8 py-3 text-sm font-semibold text-zion-gold hover:bg-zion-gold/30 transition-colors"
            >
              {FarmingPanelCopy.switchToBase[cs ? 'cs' : 'en']}
            </button>
          </div>
        ) : !FARM_DEPLOYED ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-zion-gold mx-auto mb-4" />
            <p className="text-gray-400">
              {FarmingPanelCopy.contractAwaitingDeploymentOnBa[cs ? 'cs' : 'en']}
            </p>
          </div>
        ) : !selectedPool ? (
          <div className="text-center py-8">
            <Sprout className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">
              {FarmingPanelCopy.noPoolsAvailable[cs ? 'cs' : 'en']}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Sprout className="h-5 w-5 text-zion-cyan" />
              <h3 className="text-lg font-semibold text-white">
                {selectedPool.name} <span className="text-gray-500 text-sm">#{selectedPool.pid}</span>
              </h3>
            </div>

            {/* Deposit */}
            <div className="zion-tile">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Lock className="h-4 w-4 text-zion-cyan" />
                {FarmingPanelCopy.depositLpTokens[cs ? 'cs' : 'en']}
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
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-zion-cyan/40 font-mono disabled:opacity-50"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500">LP</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {FarmingPanelCopy.available[cs ? 'cs' : 'en']}: {fmt(userBalance, 2)} wZION
                  </p>
                </div>
                <button
                  onClick={handleDeposit}
                  disabled={busy || !amount || parseFloat(amount) <= 0}
                  className="w-full rounded-2xl bg-zion-cyan/20 border border-zion-cyan/30 px-6 py-3 text-sm font-semibold text-zion-cyan hover:bg-zion-cyan/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {busy && txPhase === 'approving' && <Loader2 className="h-4 w-4 animate-spin" />}
                  {txPhase === 'approving' ? (FarmingPanelCopy.approvingWzion[cs ? 'cs' : 'en']) :
                   txPhase === 'depositing' ? (FarmingPanelCopy.depositing[cs ? 'cs' : 'en']) :
                   FarmingPanelCopy.depositLpTokens[cs ? 'cs' : 'en']}
                </button>
              </div>
            </div>

            {/* Withdraw */}
            <div className="zion-tile">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <Unlock className="h-4 w-4 text-zion-gold" />
                {FarmingPanelCopy.withdrawLpTokens[cs ? 'cs' : 'en']}
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
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-zion-gold/40 font-mono disabled:opacity-50"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500">LP</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {FarmingPanelCopy.deposited[cs ? 'cs' : 'en']}: {fmt(selectedPool.userDeposited, 4)} LP
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleWithdraw}
                    disabled={busy || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                    className="flex-1 rounded-2xl bg-zion-gold/20 border border-zion-gold/30 px-6 py-3 text-sm font-semibold text-zion-gold hover:bg-zion-gold/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {busy && txPhase === 'withdrawing' && <Loader2 className="h-4 w-4 animate-spin" />}
                    {FarmingPanelCopy.withdraw[cs ? 'cs' : 'en']}
                  </button>
                  <button
                    onClick={handleEmergencyWithdraw}
                    disabled={busy || parseFloat(selectedPool.userDeposited) <= 0}
                    className="rounded-2xl bg-zion-purple/20 border border-zion-purple/30 px-4 py-3 text-sm font-semibold text-zion-purple hover:bg-zion-purple/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    title={FarmingPanelCopy.emergencyWithdrawForfeitsRewar[cs ? 'cs' : 'en']}
                  >
                    {busy && txPhase === 'emergency' && <Loader2 className="h-4 w-4 animate-spin" />}
                    {FarmingPanelCopy.emergency[cs ? 'cs' : 'en']}
                  </button>
                </div>
              </div>
            </div>

            {/* Claim */}
            <div className="zion-tile">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-zion-gold" />
                {FarmingPanelCopy.claimReward[cs ? 'cs' : 'en']}
              </h4>
              <div className="flex items-center gap-4 max-w-md">
                <div className="flex-1">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{FarmingPanelCopy.pending_2[cs ? 'cs' : 'en']}</p>
                  <p className="text-2xl font-bold text-zion-gold">{fmt(selectedPool.userPending, 6)} wZION</p>
                </div>
                <button
                  onClick={handleHarvest}
                  disabled={busy || parseFloat(selectedPool.userPending) <= 0}
                  className="rounded-2xl bg-zion-gold/20 border border-zion-gold/30 px-6 py-3 text-sm font-semibold text-zion-gold hover:bg-zion-gold/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {busy && txPhase === 'claiming' && <Loader2 className="h-4 w-4 animate-spin" />}
                  {FarmingPanelCopy.claimReward_2[cs ? 'cs' : 'en']}
                </button>
              </div>
            </div>

            {/* TX status */}
            {txHash && (txPhase === 'success' || busy) && (
              <div className="zion-tile p-3 flex items-center gap-2 text-xs">
                {txPhase === 'success' ? <CheckCircle2 className="h-4 w-4 text-zion-cyan" /> : <Loader2 className="h-4 w-4 animate-spin text-zion-gold" />}
                <a href={`${EXPLORER}/tx/${txHash}`} target="_blank" rel="noopener" className="text-zion-gold hover:underline flex items-center gap-1">
                  {txHash.slice(0, 10)}...{txHash.slice(-8)} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            {txError && (
              <div className="rounded-xl border border-zion-purple/20 bg-zion-purple/5 p-3 flex items-center gap-2 text-xs text-zion-purple">
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
          {FarmingPanelCopy.howItWorks[cs ? 'cs' : 'en']}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { step: '1', title: FarmingPanelCopy.approveDeposit[cs ? 'cs' : 'en'], desc: FarmingPanelCopy.approveWzionForTheFarmContract[cs ? 'cs' : 'en'], icon: Lock },
            { step: '2', title: FarmingPanelCopy.earnRewards[cs ? 'cs' : 'en'], desc: FarmingPanelCopy.wzionRewardsAccrueAutomaticall[cs ? 'cs' : 'en'], icon: Coins },
            { step: '3', title: FarmingPanelCopy.claimWithdraw[cs ? 'cs' : 'en'], desc: FarmingPanelCopy.claimRewardsAnytimeWithdrawLpT[cs ? 'cs' : 'en'], icon: Unlock },
          ].map((s) => (
            <div key={s.step} className="zion-tile">
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
      <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="zion-tile p-5">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-gray-400" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">{FarmingPanelCopy.contract_2[cs ? 'cs' : 'en']}</span>
          </div>
          <p className="font-mono text-sm text-gray-300 break-all">
            {FARM_DEPLOYED ? CONTRACTS.ZIONFarm : FarmingPanelCopy.awaitingDeployment[cs ? 'cs' : 'en']}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">Base Mainnet · ZIONFarm.sol · MasterChef v2</p>
        </div>
      </motion.section>

      <p className="text-center text-xs text-gray-600">ZION TerraNova · Yield Farming</p>
    </section>
  );
}
