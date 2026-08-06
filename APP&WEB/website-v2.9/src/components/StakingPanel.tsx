'use client';

import { motion } from 'framer-motion';
import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import {
  Calendar,
  Clock,
  Flame,
  Layers,
  Lock,
  PiggyBank,
  Shield,
  TrendingUp,
  Unlock,
  Wallet,
  Zap,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useWallet } from '@/contexts/WalletContext';
import { CONTRACTS, STAKING_ABI, WZION_ABI, STAKING_DEPLOYED } from '@/lib/defi-contracts';

const StakingPanelCopy = {
  deployPending: { cs: `Deploy pending`, en: `Deploy pending` },
  stakeWzionAndEarnFixedAprCoold: { cs: `Stakujte wZION a získejte fixní APR. Cooldown pro bezpečný unstake. Odměny z bridge poplatků a ekosystémové alokace.`, en: `Stake wZION and earn fixed APR. Cooldown period for safe unstaking. Rewards from bridge fees and ecosystem allocation.` },
  stakingContractHasNotYetBeenDe: { cs: `Staking kontrakt ještě nebyl nasazen na Base Mainnet. Deploy proběhne po pool seeding.`, en: `Staking contract has not yet been deployed to Base Mainnet. Deploy will happen after pool seeding.` },
  stakingIsCurrentlyPaused: { cs: `Staking je momentálně pozastaven (paused).`, en: `Staking is currently paused.` },
  cooldown: { cs: `cooldown`, en: `cooldown` },
  bridgeFeeRewards: { cs: `Bridge fee rewards`, en: `Bridge fee rewards` },
  totalStaked: { cs: `Celkem stakováno`, en: `Total Staked` },
  rewardPool: { cs: `Odměnový fond`, en: `Reward Pool` },
  cooldown_2: { cs: `Cooldown`, en: `Cooldown` },
  myStake: { cs: `Můj stake`, en: `My Stake` },
  earned: { cs: `Odměny`, en: `Earned` },
  wallet: { cs: `Wallet balance`, en: `Wallet` },
  connectWalletToStake: { cs: `Připojte peněženku pro staking`, en: `Connect wallet to stake` },
  connectMetamask: { cs: `Připojit MetaMask`, en: `Connect MetaMask` },
  switchToBaseMainnet: { cs: `Přepněte na Base Mainnet`, en: `Switch to Base Mainnet` },
  switchNetwork: { cs: `Přepnout síť`, en: `Switch Network` },
  stakingContractAwaitingDeploym: { cs: `Staking kontrakt čeká na deploy na Base Mainnet.`, en: `Staking contract awaiting deployment on Base Mainnet.` },
  stake: { cs: `Stake`, en: `Stake` },
  unstake: { cs: `Unstake`, en: `Unstake` },
  claim: { cs: `Claim`, en: `Claim` },
  amountToStake: { cs: `Částka k stake`, en: `Amount to stake` },
  available: { cs: `Dostupno`, en: `Available` },
  approving: { cs: `Schvaluji...`, en: `Approving...` },
  staking: { cs: `Stakuji...`, en: `Staking...` },
  stakeWzion: { cs: `Stake wZION`, en: `Stake wZION` },
  yourStake: { cs: `Váš stake`, en: `Your stake` },
  inCooldown: { cs: `Čeká na cooldown`, en: `In cooldown` },
  amountToUnstake: { cs: `Částka k unstake`, en: `Amount to unstake` },
  queueUnstake: { cs: `Požádat o unstake`, en: `Queue Unstake` },
  withdrawCooldownPassed: { cs: `Vybírat (cooldown vypršel)`, en: `Withdraw (cooldown passed)` },
  cooldownActive: { cs: `Cooldown aktivní`, en: `Cooldown active` },
  earnedRewards: { cs: `Nasbíráno odměn`, en: `Earned rewards` },
  claimRewards: { cs: `Vybírat odměny`, en: `Claim Rewards` },
  howItWorks: { cs: `Jak to funguje`, en: `How it works` },
  lockWzion: { cs: `Zamkni wZION`, en: `Lock wZION` },
  approveWzionAndStakeIntoTheZio: { cs: `Schval wZION a stakuj do ZIONStaking kontraktu.`, en: `Approve wZION and stake into the ZIONStaking contract.` },
  earnRewards: { cs: `Sbírej odměny`, en: `Earn Rewards` },
  autoCompoundingRewardsAtFixedA: { cs: `Automaticky narůstající odměny s fixním APR.`, en: `Auto-compounding rewards at fixed APR.` },
  requestUnstakeWaitCooldownWith: { cs: `Požádej o unstake, počkej cooldown a vybírej.`, en: `Request unstake, wait cooldown, withdraw.` },
  contract: { cs: `Kontrakt`, en: `Contract` },
  awaitingDeployment: { cs: `Čeká na deploy`, en: `Awaiting deployment` },
};

const RPC_URL = 'https://mainnet.base.org';
const EMERALD_RC = '7, 137, 48';

export default function StakingPanel() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const { connected, account, signer, isBaseMainnet, connect, switchToBase } = useWallet();

  const [amount, setAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [tab, setTab] = useState<'stake' | 'unstake' | 'claim'>('stake');
  const [bridgeOnline, setBridgeOnline] = useState(false);

  // Live data
  const [totalStaked, setTotalStaked] = useState('—');
  const [rewardPool, setRewardPool] = useState('—');
  const [aprBps, setAprBps] = useState(1200);
  const [cooldownSecs, setCooldownSecs] = useState(7 * 24 * 3600);
  const [paused, setPaused] = useState(false);
  const [userStaked, setUserStaked] = useState('0');
  const [userEarned, setUserEarned] = useState('0');
  const [userBalance, setUserBalance] = useState('0');
  const [cooldownStarted, setCooldownStarted] = useState(0);
  const [cooldownAmount, setCooldownAmount] = useState(0);
  const [txPhase, setTxPhase] = useState<'idle' | 'approving' | 'staking' | 'unstaking' | 'claiming' | 'success' | 'error'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const apy = aprBps / 100;
  const cooldownDays = Math.round(cooldownSecs / 86400);

  // Fetch bridge status
  useEffect(() => {
    fetch('/api/bridge/status', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setBridgeOnline(d.online ?? false))
      .catch(() => {});
  }, []);

  // Fetch staking contract data
  const refreshData = useCallback(async () => {
    if (!STAKING_DEPLOYED) return;
    try {
      const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
      const staking = new ethers.Contract(CONTRACTS.ZIONStaking, STAKING_ABI, provider);
      const wzion = new ethers.Contract(CONTRACTS.wZION, WZION_ABI, provider);

      const [ts, rp, apr, cd, ps] = await Promise.all([
        staking.totalStaked(),
        staking.rewardPoolBalance(),
        staking.aprBps(),
        staking.cooldownSeconds(),
        staking.paused(),
      ]);
      setTotalStaked(parseFloat(ethers.utils.formatEther(ts)).toLocaleString());
      setRewardPool(parseFloat(ethers.utils.formatEther(rp)).toLocaleString());
      setAprBps(Number(apr));
      setCooldownSecs(Number(cd));
      setPaused(ps);

      if (account) {
        const info = await staking.stakes(account);
        setUserStaked(ethers.utils.formatEther(info.staked));
        const earned = await staking.earned(account);
        setUserEarned(ethers.utils.formatEther(earned));
        const bal = await wzion.balanceOf(account);
        setUserBalance(ethers.utils.formatEther(bal));
        setCooldownStarted(Number(info.cooldownStarted));
        setCooldownAmount(Number(info.cooldownAmount));
      }
    } catch {
      // silent
    }
  }, [account]);

  useEffect(() => { void refreshData(); }, [refreshData]);
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, [connected, refreshData]);

  // Cooldown check
  const now = Math.floor(Date.now() / 1000);
  const cooldownPassed = cooldownStarted > 0 && now >= cooldownStarted + cooldownSecs;
  const cooldownRemaining = cooldownStarted > 0 ? Math.max(0, cooldownStarted + cooldownSecs - now) : 0;

  // ── Stake ──────────────────────────────────────────────────────────────────
  const handleStake = async () => {
    if (!signer || !amount) return;
    setTxPhase('approving');
    setTxError(null);
    setTxHash(null);
    try {
      const wzion = new ethers.Contract(CONTRACTS.wZION, WZION_ABI, signer);
      const staking = new ethers.Contract(CONTRACTS.ZIONStaking, STAKING_ABI, signer);
      const amt = ethers.utils.parseEther(amount);

      // Approve
      const approveTx = await wzion.approve(CONTRACTS.ZIONStaking, amt);
      setTxHash(approveTx.hash);
      setTxPhase('staking');
      await approveTx.wait();

      // Stake
      const stakeTx = await staking.stake(amt);
      setTxHash(stakeTx.hash);
      await stakeTx.wait();
      setTxPhase('success');
      setAmount('');
      void refreshData();
    } catch (e: any) {
      setTxError(e?.reason || e?.message || 'Transaction failed');
      setTxPhase('error');
    }
  };

  // ── Queue Unstake (starts cooldown for specified amount) ──────────────────
  const handleQueueUnstake = async () => {
    if (!signer || !unstakeAmount) return;
    setTxPhase('unstaking');
    setTxError(null);
    try {
      const staking = new ethers.Contract(CONTRACTS.ZIONStaking, STAKING_ABI, signer);
      const amt = ethers.utils.parseEther(unstakeAmount);
      const tx = await staking.queueUnstake(amt);
      setTxHash(tx.hash);
      await tx.wait();
      setTxPhase('success');
      setUnstakeAmount('');
      void refreshData();
    } catch (e: any) {
      setTxError(e?.reason || e?.message || 'Transaction failed');
      setTxPhase('error');
    }
  };

  // ── Unstake (withdraw after cooldown) ───────────────────────────────────────
  const handleUnstake = async () => {
    if (!signer) return;
    setTxPhase('unstaking');
    setTxError(null);
    try {
      const staking = new ethers.Contract(CONTRACTS.ZIONStaking, STAKING_ABI, signer);
      const tx = await staking.unstake();
      setTxHash(tx.hash);
      await tx.wait();
      setTxPhase('success');
      void refreshData();
    } catch (e: any) {
      setTxError(e?.reason || e?.message || 'Transaction failed');
      setTxPhase('error');
    }
  };

  // ── Claim Rewards ───────────────────────────────────────────────────────────
  const handleClaim = async () => {
    if (!signer) return;
    setTxPhase('claiming');
    setTxError(null);
    try {
      const staking = new ethers.Contract(CONTRACTS.ZIONStaking, STAKING_ABI, signer);
      const tx = await staking.claimRewards();
      setTxHash(tx.hash);
      await tx.wait();
      setTxPhase('success');
      void refreshData();
    } catch (e: any) {
      setTxError(e?.reason || e?.message || 'Transaction failed');
      setTxPhase('error');
    }
  };

  const busy = txPhase === 'approving' || txPhase === 'staking' || txPhase === 'unstaking' || txPhase === 'claiming';

  return (
    <section className="zion-section space-y-6">
      {/* HERO */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ '--rc': EMERALD_RC } as React.CSSProperties}
        className="zion-rainbow-card p-6 md:p-8"
      >
        <div className="inline-flex items-center gap-2 rounded-full border border-zion-cyan-500/40 bg-zion-cyan-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-cyan-300 uppercase mb-4">
          <PiggyBank className="h-4 w-4" />
          DeFi · Staking
        </div>
        {STAKING_DEPLOYED ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-zion-cyan-500/30 bg-zion-cyan-500/10 px-3 py-1 text-[10px] font-semibold tracking-wider text-zion-cyan-300 uppercase mb-4 ml-2">
            <CheckCircle2 className="h-3 w-3" /> Base Mainnet
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold-500/30 bg-zion-gold-500/10 px-3 py-1 text-[10px] font-semibold tracking-wider text-zion-gold-300 uppercase mb-4 ml-2">
            <Clock className="h-3 w-3" /> {StakingPanelCopy.deployPending[cs ? 'cs' : 'en']}
          </div>
        )}
        <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
          ZION Staking
        </h1>
        <p className="mt-4 text-lg text-gray-300 max-w-2xl">
          {StakingPanelCopy.stakeWzionAndEarnFixedAprCoold[cs ? 'cs' : 'en']}
        </p>

        {/* Deploy pending banner */}
        {!STAKING_DEPLOYED && (
          <div className="mt-6 rounded-2xl border border-zion-gold-500/20 bg-zion-gold-500/5 p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-zion-gold-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-gray-300">
                {StakingPanelCopy.stakingContractHasNotYetBeenDe[cs ? 'cs' : 'en']}
              </p>
            </div>
          </div>
        )}

        {paused && STAKING_DEPLOYED && (
          <div className="mt-6 rounded-2xl border border-zion-purple-500/20 bg-zion-purple-500/5 p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-zion-purple-400 shrink-0" />
            <p className="text-sm text-gray-300">
              {StakingPanelCopy.stakingIsCurrentlyPaused[cs ? 'cs' : 'en']}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
            <TrendingUp className="h-3 w-3 text-zion-cyan-400" /> {apy}% APR
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
            <Clock className="h-3 w-3 text-zion-gold" /> {cooldownDays}d {StakingPanelCopy.cooldown[cs ? 'cs' : 'en']}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
            <Shield className="h-3 w-3 text-zion-cyan" /> {StakingPanelCopy.bridgeFeeRewards[cs ? 'cs' : 'en']}
          </span>
          <span className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 ${bridgeOnline ? 'bg-zion-cyan-500/10 text-zion-cyan-400' : 'bg-gray-500/10 text-gray-400'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${bridgeOnline ? 'bg-zion-cyan-400 animate-pulse' : 'bg-gray-500'}`} />
            Bridge {bridgeOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: StakingPanelCopy.totalStaked[cs ? 'cs' : 'en'], value: totalStaked, icon: Lock, color: 'text-zion-cyan-400' },
            { label: StakingPanelCopy.rewardPool[cs ? 'cs' : 'en'], value: rewardPool, icon: PiggyBank, color: 'text-zion-gold' },
            { label: 'APR', value: `${apy}%`, icon: TrendingUp, color: 'text-zion-cyan-400' },
            { label: StakingPanelCopy.cooldown_2[cs ? 'cs' : 'en'], value: `${cooldownDays}d`, icon: Calendar, color: 'text-zion-cyan' },
          ].map((card) => (
            <div key={card.label} className="zion-tile p-5">
              <div className="flex items-center gap-2 mb-2">
                <card.icon className={`h-4 w-4 ${card.color}`} />
                <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">{card.label}</span>
              </div>
              <p className={`text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* User positions */}
      {connected && STAKING_DEPLOYED && (
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <div className="grid grid-cols-3 gap-4">
            <div className="zion-tile p-4">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{StakingPanelCopy.myStake[cs ? 'cs' : 'en']}</p>
              <p className="text-xl font-bold text-zion-cyan-400">{parseFloat(userStaked).toFixed(2)} wZION</p>
            </div>
            <div className="zion-tile p-4">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{StakingPanelCopy.earned[cs ? 'cs' : 'en']}</p>
              <p className="text-xl font-bold text-zion-gold">{parseFloat(userEarned).toFixed(4)} wZION</p>
            </div>
            <div className="zion-tile p-4">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{StakingPanelCopy.wallet[cs ? 'cs' : 'en']}</p>
              <p className="text-xl font-bold text-white">{parseFloat(userBalance).toFixed(2)} wZION</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Wallet connect / Stake UI */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{ '--rc': EMERALD_RC } as React.CSSProperties}
        className="zion-rainbow-card p-6 md:p-8"
      >
        {!connected ? (
          <div className="text-center py-8">
            <Wallet className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">
              {StakingPanelCopy.connectWalletToStake[cs ? 'cs' : 'en']}
            </p>
            <button
              onClick={connect}
              className="rounded-2xl bg-zion-cyan-500/20 border border-zion-cyan-500/30 px-8 py-3 text-sm font-semibold text-zion-cyan-300 hover:bg-zion-cyan-500/30 transition-colors"
            >
              {StakingPanelCopy.connectMetamask[cs ? 'cs' : 'en']}
            </button>
          </div>
        ) : !isBaseMainnet ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-zion-gold-400 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">
              {StakingPanelCopy.switchToBaseMainnet[cs ? 'cs' : 'en']}
            </p>
            <button
              onClick={switchToBase}
              className="rounded-2xl bg-zion-gold/20 border border-zion-gold/30 px-8 py-3 text-sm font-semibold text-zion-gold hover:bg-zion-gold/30 transition-colors"
            >
              {StakingPanelCopy.switchNetwork[cs ? 'cs' : 'en']}
            </button>
          </div>
        ) : !STAKING_DEPLOYED ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-zion-gold-400 mx-auto mb-4" />
            <p className="text-gray-400">
              {StakingPanelCopy.stakingContractAwaitingDeploym[cs ? 'cs' : 'en']}
            </p>
          </div>
        ) : (
          <>
            <div className="flex gap-1 zion-tile p-1 w-fit mb-6">
              {([
                { key: 'stake', label: StakingPanelCopy.stake[cs ? 'cs' : 'en'], icon: Lock },
                { key: 'unstake', label: StakingPanelCopy.unstake[cs ? 'cs' : 'en'], icon: Unlock },
                { key: 'claim', label: StakingPanelCopy.claim[cs ? 'cs' : 'en'], icon: PiggyBank },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${
                    tab === t.key ? 'bg-white/10 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Stake tab */}
            {tab === 'stake' && (
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
                    {StakingPanelCopy.amountToStake[cs ? 'cs' : 'en']}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      disabled={busy}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-zion-cyan-500/40 font-mono disabled:opacity-50"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500">wZION</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {StakingPanelCopy.available[cs ? 'cs' : 'en']}: {parseFloat(userBalance).toFixed(2)} wZION
                  </p>
                </div>
                <button
                  onClick={handleStake}
                  disabled={busy || !amount || parseFloat(amount) <= 0}
                  className="w-full rounded-2xl bg-zion-cyan-500/20 border border-zion-cyan-500/30 px-6 py-3 text-sm font-semibold text-zion-cyan-300 hover:bg-zion-cyan-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {txPhase === 'approving' ? (StakingPanelCopy.approving[cs ? 'cs' : 'en']) :
                   txPhase === 'staking' ? (StakingPanelCopy.staking[cs ? 'cs' : 'en']) :
                   StakingPanelCopy.stakeWzion[cs ? 'cs' : 'en']}
                </button>
              </div>
            )}

            {/* Unstake tab */}
            {tab === 'unstake' && (
              <div className="space-y-4 max-w-md">
                <div className="zion-tile p-4">
                  <p className="text-xs text-gray-500 mb-1">{StakingPanelCopy.yourStake[cs ? 'cs' : 'en']}</p>
                  <p className="text-2xl font-bold text-zion-cyan-400">{parseFloat(userStaked).toFixed(2)} wZION</p>
                  {cooldownStarted > 0 && cooldownAmount > 0 && (
                    <p className="text-[10px] text-zion-gold-400 mt-1">
                      {StakingPanelCopy.inCooldown[cs ? 'cs' : 'en']}: {ethers.utils.formatEther(cooldownAmount)} wZION
                    </p>
                  )}
                </div>
                {cooldownStarted === 0 ? (
                  <>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
                        {StakingPanelCopy.amountToUnstake[cs ? 'cs' : 'en']}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={unstakeAmount}
                          onChange={(e) => setUnstakeAmount(e.target.value)}
                          placeholder="0.00"
                          disabled={busy}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-zion-cyan-500/40 font-mono disabled:opacity-50"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500">wZION</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">
                        {StakingPanelCopy.available[cs ? 'cs' : 'en']}: {parseFloat(userStaked).toFixed(2)} wZION
                      </p>
                    </div>
                    <button
                      onClick={handleQueueUnstake}
                      disabled={busy || !unstakeAmount || parseFloat(unstakeAmount) <= 0 || parseFloat(unstakeAmount) > parseFloat(userStaked)}
                      className="w-full rounded-2xl bg-zion-gold-500/20 border border-zion-gold-500/30 px-6 py-3 text-sm font-semibold text-zion-gold-300 hover:bg-zion-gold-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                      {StakingPanelCopy.queueUnstake[cs ? 'cs' : 'en']}
                    </button>
                  </>
                ) : cooldownPassed ? (
                  <button
                    onClick={handleUnstake}
                    disabled={busy}
                    className="w-full rounded-2xl bg-zion-purple-500/20 border border-zion-purple-500/30 px-6 py-3 text-sm font-semibold text-zion-purple-300 hover:bg-zion-purple-500/30 transition-colors flex items-center justify-center gap-2"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {StakingPanelCopy.withdrawCooldownPassed[cs ? 'cs' : 'en']}
                  </button>
                ) : (
                  <div className="rounded-2xl border border-zion-gold-500/20 bg-zion-gold-500/5 p-4 text-center">
                    <Clock className="h-8 w-8 text-zion-gold-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-300">
                      {StakingPanelCopy.cooldownActive[cs ? 'cs' : 'en']}
                    </p>
                    <p className="text-2xl font-bold text-zion-gold-400 mt-1">
                      {Math.floor(cooldownRemaining / 3600)}h {Math.floor((cooldownRemaining % 3600) / 60)}m
                    </p>
                  </div>
                )}
                <p className="text-[11px] text-gray-500 text-center">
                  {cs ? `Cooldown: ${cooldownDays} dní po requestu` : `Cooldown: ${cooldownDays} days after request`}
                </p>
              </div>
            )}

            {/* Claim tab */}
            {tab === 'claim' && (
              <div className="space-y-4 max-w-md">
                <div className="zion-tile p-4">
                  <p className="text-xs text-gray-500 mb-1">{StakingPanelCopy.earnedRewards[cs ? 'cs' : 'en']}</p>
                  <p className="text-2xl font-bold text-zion-gold">{parseFloat(userEarned).toFixed(4)} wZION</p>
                </div>
                <button
                  onClick={handleClaim}
                  disabled={busy || parseFloat(userEarned) <= 0}
                  className="w-full rounded-2xl bg-zion-gold/20 border border-zion-gold/30 px-6 py-3 text-sm font-semibold text-zion-gold hover:bg-zion-gold/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {StakingPanelCopy.claimRewards[cs ? 'cs' : 'en']}
                </button>
              </div>
            )}

            {/* TX status */}
            {txHash && (txPhase === 'success' || busy) && (
              <div className="mt-4 zion-tile p-3 flex items-center gap-2 text-xs">
                {txPhase === 'success' ? <CheckCircle2 className="h-4 w-4 text-zion-cyan-400" /> : <Loader2 className="h-4 w-4 animate-spin text-zion-gold" />}
                <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener" className="text-zion-gold hover:underline flex items-center gap-1">
                  {txHash.slice(0, 10)}...{txHash.slice(-8)} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            {txError && (
              <div className="mt-4 rounded-xl border border-zion-purple-500/20 bg-zion-purple-500/5 p-3 flex items-center gap-2 text-xs text-zion-purple-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{txError}</span>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* How it works */}
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
        <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
          <Zap className="h-6 w-6 text-zion-gold" />
          {StakingPanelCopy.howItWorks[cs ? 'cs' : 'en']}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { step: '1', title: StakingPanelCopy.lockWzion[cs ? 'cs' : 'en'], desc: StakingPanelCopy.approveWzionAndStakeIntoTheZio[cs ? 'cs' : 'en'], icon: Lock },
            { step: '2', title: StakingPanelCopy.earnRewards[cs ? 'cs' : 'en'], desc: StakingPanelCopy.autoCompoundingRewardsAtFixedA[cs ? 'cs' : 'en'], icon: Flame },
            { step: '3', title: StakingPanelCopy.unstake[cs ? 'cs' : 'en'], desc: StakingPanelCopy.requestUnstakeWaitCooldownWith[cs ? 'cs' : 'en'], icon: Unlock },
          ].map((s) => (
            <div key={s.step} className="zion-tile p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-zion-gold">{s.step}</span>
                <s.icon className="h-4 w-4 text-gray-400" />
              </div>
              <h3 className="text-sm font-medium text-white mb-1">{s.title}</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Contract */}
      <div className="zion-tile p-5">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="h-4 w-4 text-gray-400" />
          <span className="text-xs text-gray-400 uppercase tracking-wider">{StakingPanelCopy.contract[cs ? 'cs' : 'en']}</span>
        </div>
        <p className="font-mono text-sm text-gray-300 break-all">
          {STAKING_DEPLOYED ? CONTRACTS.ZIONStaking : StakingPanelCopy.awaitingDeployment[cs ? 'cs' : 'en']}
        </p>
        <p className="text-[10px] text-gray-500 mt-1">Base Mainnet · ZIONStaking.sol</p>
      </div>

      <p className="text-center text-xs text-gray-600">ZION TerraNova · Staking</p>
    </section>
  );
}
