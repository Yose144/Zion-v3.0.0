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

const RPC_URL = 'https://mainnet.base.org';
const EMERALD_RC = '16, 185, 129';

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
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-emerald-300 uppercase mb-4">
          <PiggyBank className="h-4 w-4" />
          DeFi · Staking
        </div>
        {STAKING_DEPLOYED ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold tracking-wider text-emerald-300 uppercase mb-4 ml-2">
            <CheckCircle2 className="h-3 w-3" /> Base Mainnet
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-semibold tracking-wider text-amber-300 uppercase mb-4 ml-2">
            <Clock className="h-3 w-3" /> {cs ? 'Deploy pending' : 'Deploy pending'}
          </div>
        )}
        <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
          ZION Staking
        </h1>
        <p className="mt-4 text-lg text-gray-300 max-w-2xl">
          {cs
            ? 'Stakujte wZION a získejte fixní APR. Cooldown pro bezpečný unstake. Odměny z bridge poplatků a ekosystémové alokace.'
            : 'Stake wZION and earn fixed APR. Cooldown period for safe unstaking. Rewards from bridge fees and ecosystem allocation.'}
        </p>

        {/* Deploy pending banner */}
        {!STAKING_DEPLOYED && (
          <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-gray-300">
                {cs
                  ? 'Staking kontrakt ještě nebyl nasazen na Base Mainnet. Deploy proběhne po pool seeding.'
                  : 'Staking contract has not yet been deployed to Base Mainnet. Deploy will happen after pool seeding.'}
              </p>
            </div>
          </div>
        )}

        {paused && STAKING_DEPLOYED && (
          <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            <p className="text-sm text-gray-300">
              {cs ? 'Staking je momentálně pozastaven (paused).' : 'Staking is currently paused.'}
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
            <TrendingUp className="h-3 w-3 text-emerald-400" /> {apy}% APR
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
            <Clock className="h-3 w-3 text-zion-gold" /> {cooldownDays}d {cs ? 'cooldown' : 'cooldown'}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
            <Shield className="h-3 w-3 text-zion-cyan" /> {cs ? 'Bridge fee rewards' : 'Bridge fee rewards'}
          </span>
          <span className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 ${bridgeOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${bridgeOnline ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
            Bridge {bridgeOnline ? 'Online' : 'Offline'}
          </span>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: cs ? 'Celkem stakováno' : 'Total Staked', value: totalStaked, icon: Lock, color: 'text-emerald-400' },
            { label: cs ? 'Odměnový fond' : 'Reward Pool', value: rewardPool, icon: PiggyBank, color: 'text-zion-gold' },
            { label: 'APR', value: `${apy}%`, icon: TrendingUp, color: 'text-emerald-400' },
            { label: cs ? 'Cooldown' : 'Cooldown', value: `${cooldownDays}d`, icon: Calendar, color: 'text-zion-cyan' },
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
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{cs ? 'Můj stake' : 'My Stake'}</p>
              <p className="text-xl font-bold text-emerald-400">{parseFloat(userStaked).toFixed(2)} wZION</p>
            </div>
            <div className="zion-tile p-4">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{cs ? 'Odměny' : 'Earned'}</p>
              <p className="text-xl font-bold text-zion-gold">{parseFloat(userEarned).toFixed(4)} wZION</p>
            </div>
            <div className="zion-tile p-4">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{cs ? 'Wallet balance' : 'Wallet'}</p>
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
              {cs ? 'Připojte peněženku pro staking' : 'Connect wallet to stake'}
            </p>
            <button
              onClick={connect}
              className="rounded-2xl bg-emerald-500/20 border border-emerald-500/30 px-8 py-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors"
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
              {cs ? 'Přepnout síť' : 'Switch Network'}
            </button>
          </div>
        ) : !STAKING_DEPLOYED ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-amber-400 mx-auto mb-4" />
            <p className="text-gray-400">
              {cs ? 'Staking kontrakt čeká na deploy na Base Mainnet.' : 'Staking contract awaiting deployment on Base Mainnet.'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex gap-1 zion-tile p-1 w-fit mb-6">
              {([
                { key: 'stake', label: cs ? 'Stake' : 'Stake', icon: Lock },
                { key: 'unstake', label: cs ? 'Unstake' : 'Unstake', icon: Unlock },
                { key: 'claim', label: cs ? 'Claim' : 'Claim', icon: PiggyBank },
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
                    {cs ? 'Částka k stake' : 'Amount to stake'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      disabled={busy}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/40 font-mono disabled:opacity-50"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500">wZION</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {cs ? 'Dostupno' : 'Available'}: {parseFloat(userBalance).toFixed(2)} wZION
                  </p>
                </div>
                <button
                  onClick={handleStake}
                  disabled={busy || !amount || parseFloat(amount) <= 0}
                  className="w-full rounded-2xl bg-emerald-500/20 border border-emerald-500/30 px-6 py-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {txPhase === 'approving' ? (cs ? 'Schvaluji...' : 'Approving...') :
                   txPhase === 'staking' ? (cs ? 'Stakuji...' : 'Staking...') :
                   cs ? 'Stake wZION' : 'Stake wZION'}
                </button>
              </div>
            )}

            {/* Unstake tab */}
            {tab === 'unstake' && (
              <div className="space-y-4 max-w-md">
                <div className="zion-tile p-4">
                  <p className="text-xs text-gray-500 mb-1">{cs ? 'Váš stake' : 'Your stake'}</p>
                  <p className="text-2xl font-bold text-emerald-400">{parseFloat(userStaked).toFixed(2)} wZION</p>
                  {cooldownStarted > 0 && cooldownAmount > 0 && (
                    <p className="text-[10px] text-amber-400 mt-1">
                      {cs ? 'Čeká na cooldown' : 'In cooldown'}: {ethers.utils.formatEther(cooldownAmount)} wZION
                    </p>
                  )}
                </div>
                {cooldownStarted === 0 ? (
                  <>
                    <div>
                      <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
                        {cs ? 'Částka k unstake' : 'Amount to unstake'}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={unstakeAmount}
                          onChange={(e) => setUnstakeAmount(e.target.value)}
                          placeholder="0.00"
                          disabled={busy}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/40 font-mono disabled:opacity-50"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500">wZION</span>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1">
                        {cs ? 'Dostupno' : 'Available'}: {parseFloat(userStaked).toFixed(2)} wZION
                      </p>
                    </div>
                    <button
                      onClick={handleQueueUnstake}
                      disabled={busy || !unstakeAmount || parseFloat(unstakeAmount) <= 0 || parseFloat(unstakeAmount) > parseFloat(userStaked)}
                      className="w-full rounded-2xl bg-amber-500/20 border border-amber-500/30 px-6 py-3 text-sm font-semibold text-amber-300 hover:bg-amber-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                      {cs ? 'Požádat o unstake' : 'Queue Unstake'}
                    </button>
                  </>
                ) : cooldownPassed ? (
                  <button
                    onClick={handleUnstake}
                    disabled={busy}
                    className="w-full rounded-2xl bg-red-500/20 border border-red-500/30 px-6 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {cs ? 'Vybírat (cooldown vypršel)' : 'Withdraw (cooldown passed)'}
                  </button>
                ) : (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                    <Clock className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-300">
                      {cs ? 'Cooldown aktivní' : 'Cooldown active'}
                    </p>
                    <p className="text-2xl font-bold text-amber-400 mt-1">
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
                  <p className="text-xs text-gray-500 mb-1">{cs ? 'Nasbíráno odměn' : 'Earned rewards'}</p>
                  <p className="text-2xl font-bold text-zion-gold">{parseFloat(userEarned).toFixed(4)} wZION</p>
                </div>
                <button
                  onClick={handleClaim}
                  disabled={busy || parseFloat(userEarned) <= 0}
                  className="w-full rounded-2xl bg-zion-gold/20 border border-zion-gold/30 px-6 py-3 text-sm font-semibold text-zion-gold hover:bg-zion-gold/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {cs ? 'Vybírat odměny' : 'Claim Rewards'}
                </button>
              </div>
            )}

            {/* TX status */}
            {txHash && (txPhase === 'success' || busy) && (
              <div className="mt-4 zion-tile p-3 flex items-center gap-2 text-xs">
                {txPhase === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Loader2 className="h-4 w-4 animate-spin text-zion-gold" />}
                <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener" className="text-zion-gold hover:underline flex items-center gap-1">
                  {txHash.slice(0, 10)}...{txHash.slice(-8)} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            {txError && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-3 flex items-center gap-2 text-xs text-red-400">
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
          {cs ? 'Jak to funguje' : 'How it works'}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { step: '1', title: cs ? 'Zamkni wZION' : 'Lock wZION', desc: cs ? 'Schval wZION a stakuj do ZIONStaking kontraktu.' : 'Approve wZION and stake into the ZIONStaking contract.', icon: Lock },
            { step: '2', title: cs ? 'Sbírej odměny' : 'Earn Rewards', desc: cs ? 'Automaticky narůstající odměny s fixním APR.' : 'Auto-compounding rewards at fixed APR.', icon: Flame },
            { step: '3', title: cs ? 'Unstake' : 'Unstake', desc: cs ? 'Požádej o unstake, počkej cooldown a vybírej.' : 'Request unstake, wait cooldown, withdraw.', icon: Unlock },
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
          <span className="text-xs text-gray-400 uppercase tracking-wider">{cs ? 'Kontrakt' : 'Contract'}</span>
        </div>
        <p className="font-mono text-sm text-gray-300 break-all">
          {STAKING_DEPLOYED ? CONTRACTS.ZIONStaking : cs ? 'Čeká na deploy' : 'Awaiting deployment'}
        </p>
        <p className="text-[10px] text-gray-500 mt-1">Base Mainnet · ZIONStaking.sol</p>
      </div>

      <p className="text-center text-xs text-gray-600">ZION TerraNova · Staking</p>
    </section>
  );
}
