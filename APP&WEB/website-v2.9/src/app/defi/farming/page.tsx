'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState } from 'react';
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
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { CONTRACTS_SEPOLIA, FARM_ABI } from '@/lib/defi-contracts';
import { tr } from '@/lib/translations';

interface FarmPool {
  id: number;
  name: string;
  nameCs: string;
  lpToken: string;
  allocPoint: number;
  apr: number;
  tvl: string;
  rewardToken: string;
  status: 'active' | 'upcoming';
}

const MOCK_POOLS: FarmPool[] = [
  {
    id: 0,
    name: 'wZION/WETH LP',
    nameCs: 'wZION/WETH LP',
    lpToken: CONTRACTS_SEPOLIA.UniV3Pool,
    allocPoint: 1000,
    apr: 45,
    tvl: '0.05',
    rewardToken: 'wZION',
    status: 'active',
  },
  {
    id: 1,
    name: 'wZION Staking LP',
    nameCs: 'wZION Staking LP',
    lpToken: CONTRACTS_SEPOLIA.ZIONStaking,
    allocPoint: 500,
    apr: 25,
    tvl: '—',
    rewardToken: 'wZION',
    status: 'upcoming',
  },
];

export default function FarmingPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [amount, setAmount] = useState('');
  const [selectedPool, setSelectedPool] = useState(0);

  const rewardPerSecond = 3; // wZION/s from docs
  const pool = MOCK_POOLS[selectedPool];

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
          {tr('APP_WEB_website_v2_9_src_app_defi_farmin', 'back_to_defi_hub', lang)}
        </Link>

        {/* HERO */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="zion-panel rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-green-500/40 bg-green-500/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-green-300 uppercase mb-4">
            <Sprout className="h-4 w-4" />
            {tr('APP_WEB_website_v2_9_src_app_defi_farmin', 'defi', lang)} · Farming
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
            {tr('APP_WEB_website_v2_9_src_app_defi_farmin', 'yield_farming', lang)}
          </h1>
          <p className="mt-4 text-lg text-gray-300 max-w-2xl">
            {cs
              ? 'Vložte LP tokeny do ZIONFarm a získávejte odměny ve wZION. MasterChef-style distribuce s dynamickým allocPoint.'
              : 'Deposit LP tokens into ZIONFarm and earn wZION rewards. MasterChef-style distribution with dynamic allocPoint.'}
          </p>

          <div className="mt-6 flex flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
              <Zap className="h-3 w-3 text-green-400" /> {rewardPerSecond} wZION/s
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
              <Flame className="h-3 w-3 text-zion-gold" /> MasterChef v2
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-gray-200">
              <TrendingUp className="h-3 w-3 text-zion-cyan" /> {tr('APP_WEB_website_v2_9_src_app_defi_farmin', '90_day_halving', lang)}
            </span>
          </div>
        </motion.section>

        {/* Stats */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: tr('APP_WEB_website_v2_9_src_app_defi_farmin', 'reward_s', lang), value: `${rewardPerSecond} wZION`, icon: Zap, color: 'text-green-400' },
              { label: tr('APP_WEB_website_v2_9_src_app_defi_farmin', 'pools', lang), value: MOCK_POOLS.length.toString(), icon: Layers, color: 'text-zion-cyan' },
              { label: tr('APP_WEB_website_v2_9_src_app_defi_farmin', 'total_alloc', lang), value: '1500', icon: TrendingUp, color: 'text-zion-gold' },
              { label: tr('APP_WEB_website_v2_9_src_app_defi_farmin', 'contract', lang), value: 'ZIONFarm', icon: Wallet, color: 'text-purple-400' },
            ].map((card) => (
              <div key={card.label} className="rounded-3xl border border-white/8 bg-black/60 backdrop-blur-xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500">{card.label}</span>
                </div>
                <p className={`text-xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Pool Cards */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
            <Layers className="h-6 w-6 text-zion-cyan" />
            {tr('APP_WEB_website_v2_9_src_app_defi_farmin', 'farm_pools', lang)}
          </h2>
          <div className="space-y-3">
            {MOCK_POOLS.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedPool(p.id)}
                className={`cursor-pointer rounded-2xl border p-5 transition-colors ${
                  selectedPool === p.id ? 'border-green-500/30 bg-green-500/5' : 'border-white/6 bg-white/3 hover:border-white/12'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-green-500/10 border border-green-500/20">
                    <Sprout className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-white">{cs ? p.nameCs : p.name}</h3>
                      {p.status === 'active' ? (
                        <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-400 uppercase tracking-wider">
                          {tr('APP_WEB_website_v2_9_src_app_defi_farmin', 'active', lang)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-500/10 border border-gray-500/30 px-2 py-0.5 text-[10px] text-gray-400 uppercase tracking-wider">
                          {tr('APP_WEB_website_v2_9_src_app_defi_farmin', 'upcoming', lang)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">LP: {p.lpToken.slice(0, 12)}…{p.lpToken.slice(-6)}</p>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 uppercase">APR</p>
                      <p className="font-bold text-emerald-400">{p.apr}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 uppercase">TVL</p>
                      <p className="font-bold text-white">{p.tvl} {p.rewardToken}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 uppercase">Alloc</p>
                      <p className="font-bold text-zion-gold">{p.allocPoint}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Deposit UI */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="rounded-4xl border border-white/8 bg-black/60 backdrop-blur-xl p-6 md:p-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Lock className="h-5 w-5 text-green-400" />
            {tr('APP_WEB_website_v2_9_src_app_defi_farmin', 'deposit_to_farm', lang)}
          </h3>
          <div className="space-y-4 max-w-md">
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wider mb-2 block">
                {tr('APP_WEB_website_v2_9_src_app_defi_farmin', 'lp_token_amount', lang)}
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-green-500/40 font-mono"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                  {tr('APP_WEB_website_v2_9_src_app_defi_farmin', 'lp', lang)} {pool.id}
                </span>
              </div>
            </div>
            <button
              disabled
              className="w-full rounded-2xl bg-green-500/20 border border-green-500/30 px-6 py-3 text-sm font-semibold text-green-300 cursor-not-allowed opacity-60"
            >
              {tr('APP_WEB_website_v2_9_src_app_defi_farmin', 'deposit_lp_tokens', lang)}
            </button>
            <p className="text-[11px] text-gray-500 text-center">
              {cs
                ? 'Farming je aktivní na Base Sepolia testnetu. Mainnet launch připravujeme.'
                : 'Farming is active on Base Sepolia testnet. Mainnet launch is being prepared.'}
            </p>
          </div>
        </motion.section>

        {/* Contract */}
        <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="rounded-2xl border border-white/8 bg-black/60 p-5">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="h-4 w-4 text-gray-400" />
            <span className="text-xs text-gray-400 uppercase tracking-wider">{tr('APP_WEB_website_v2_9_src_app_defi_farmin', 'contract', lang)}</span>
          </div>
          <p className="font-mono text-sm text-gray-300 break-all">{CONTRACTS_SEPOLIA.ZIONFarm}</p>
          <p className="text-[10px] text-gray-500 mt-1">Base Sepolia · ZIONFarm.sol · MasterChef v2</p>
        </motion.section>

        <p className="text-center text-xs text-gray-600">
          ZION TerraNova · Yield Farming
        </p>
      </div>
    </div>
  );
}
