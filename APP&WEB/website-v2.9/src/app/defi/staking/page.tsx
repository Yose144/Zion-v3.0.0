'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowLeft,
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
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { CONTRACTS_SEPOLIA, STAKING_ABI } from '@/lib/defi-contracts';

export default function StakingPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [amount, setAmount] = useState('');
  const [tab, setTab] = useState<'stake' | 'unstake'>('stake');

  const apy = 12;
  const cooldownDays = 7;
  const totalStaked = '—';
  const rewardPool = '—';

  return (
    <div className="pt-28 md:pt-32 pb-24 overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-emerald-500/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-gold/6" />
      </div>

      <div className="relative z-10 zion-container max-w-5xl space-y-14">
        {/* Back */}
        <Link href="/defi" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {cs ? 'Zpět do DeFi Hub' : 'Back to DeFi Hub'}
        </Link>

        {/* HERO */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="zion-panel rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-emerald-300 uppercase mb-4">
            <PiggyBank className="h-4 w-4" />
            {cs ? 'DeFi' : 'DeFi'} · Staking
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
            {cs ? 'ZION Staking' : 'ZION Staking'}
          </h1>
          <p className="mt-4 text-lg text-gray-300 max-w-2xl">
            {cs
              ? 'Stakujte wZION a získejte fixní 12% APR. 7denní cooldown pro bezpečný unstake. Odměny z bridge poplatků a ekosystémové alokace.'
              : 'Stake wZION and earn a fixed 12% APR. 7-day cooldown for safe unstaking. Rewards from bridge fees and ecosystem allocation.'}
          </p>

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
          </div>
        </motion.section>

        {/* Stats */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: cs ? 'Celkem stakováno' : 'Total Staked', value: totalStaked, icon: Lock, color: 'text-emerald-400' },
              { label: cs ? 'Odměnový fond' : 'Reward Pool', value: rewardPool, icon: PiggyBank, color: 'text-zion-gold' },
              { label: cs ? 'APR' : 'APR', value: `${apy}%`, icon: TrendingUp, color: 'text-emerald-400' },
              { label: cs ? 'Cooldown' : 'Cooldown', value: `${cooldownDays}d`, icon: Calendar, color: 'text-zion-cyan' },
            ].map((card) => (
              <div key={card.label} className="rounded-3xl border border-white/8 bg-black/60 backdrop-blur-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">{card.label}</span>
                </div>
                <p className={`text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Stake / Unstake UI */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-4xl border border-white/8 bg-black/60 backdrop-blur-xl p-6 md:p-8">
          <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1 w-fit mb-6">
            {([
              { key: 'stake', label: cs ? 'Stake' : 'Stake', icon: Lock },
              { key: 'unstake', label: cs ? 'Unstake' : 'Unstake', icon: Unlock },
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

          <div className="space-y-4 max-w-md">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
                {tab === 'stake' ? (cs ? 'Částka k stake' : 'Amount to stake') : (cs ? 'Částka k unstake' : 'Amount to unstake')}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/40 font-mono"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500">wZION</span>
              </div>
            </div>

            <button
              disabled
              className="w-full rounded-2xl bg-emerald-500/20 border border-emerald-500/30 px-6 py-3 text-sm font-semibold text-emerald-300 cursor-not-allowed opacity-60"
            >
              {tab === 'stake' ? (cs ? 'Stake wZION' : 'Stake wZION') : (cs ? 'Unstake wZION' : 'Unstake wZION')}
            </button>
            <p className="text-[11px] text-gray-500 text-center">
              {cs
                ? 'Staking je aktivní na Base Sepolia testnetu. Mainnet launch připravujeme.'
                : 'Staking is active on Base Sepolia testnet. Mainnet launch is being prepared.'}
            </p>
          </div>
        </motion.section>

        {/* How it works */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
            <Zap className="h-6 w-6 text-zion-gold" />
            {cs ? 'Jak to funguje' : 'How it works'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { step: '1', title: cs ? 'Zamkni wZION' : 'Lock wZION', desc: cs ? 'Schval wZION a stakuj do smlouvy ZIONStaking.' : 'Approve wZION and stake into the ZIONStaking contract.', icon: Lock },
              { step: '2', title: cs ? 'Sbírej odměny' : 'Earn Rewards', desc: cs ? 'Automaticky narůstající odměny s fixním 12% APR.' : 'Auto-compounding rewards at a fixed 12% APR.', icon: Flame },
              { step: '3', title: cs ? 'Unstake' : 'Unstake', desc: cs ? 'Požádej o unstake, počkej 7 dní a vybírej původní částku + odměny.' : 'Request unstake, wait 7 days, withdraw principal + rewards.', icon: Unlock },
            ].map((s) => (
              <div key={s.step} className="rounded-2xl border border-white/6 bg-white/3 p-5">
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
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="rounded-2xl border border-white/8 bg-black/60 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-4 w-4 text-gray-400" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">{cs ? 'Kontrakt' : 'Contract'}</span>
          </div>
          <p className="font-mono text-sm text-gray-300 break-all">{CONTRACTS_SEPOLIA.ZIONStaking}</p>
          <p className="text-[10px] text-gray-500 mt-1">Base Sepolia · ZIONStaking.sol</p>
        </motion.section>

        <p className="text-center text-xs text-gray-600">
          ZION TerraNova · Staking
        </p>
      </div>
    </div>
  );
}
