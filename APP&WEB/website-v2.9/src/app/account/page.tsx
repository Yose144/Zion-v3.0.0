'use client';

/**
 * /account — User's personal dashboard (protected).
 *
 * Tabs: Wallet Overview, Mining Stats, Transaction History, AI Chat
 * Requires authentication via Zion Wallet.
 */

import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Wallet, Pickaxe, ArrowLeftRight, Sparkles, LogOut, Copy, Check,
  User, Activity, Shield, Globe2, Zap, TrendingUp, Bot,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LanguageContext';
import { useRouter } from 'next/navigation';
import WalletOverview from '@/components/dashboard/WalletOverview';
import MiningStats from '@/components/dashboard/MiningStats';
import TransactionHistory from '@/components/dashboard/TransactionHistory';
import DashboardAIChat from '@/components/dashboard/DashboardAIChat';

const AccountCopy = {
  enUs: { cs: `cs-CZ`, en: `en-US` },
  myAccount: { cs: `Můj účet`, en: `My Account` },
  zionL1Dashboard: { cs: `ZION L1 Dashboard`, en: `ZION L1 Dashboard` },
  authenticated: { cs: `Autentizováno`, en: `Authenticated` },
  onChain: { cs: `On-Chain`, en: `On-Chain` },
  accountOverview: { cs: `Rychlý přehled účtu`, en: `Account Overview` },
  logins: { cs: `Přihlášení`, en: `Logins` },
  address: { cs: `Adresa`, en: `Address` },
  created: { cs: `Vytvořeno`, en: `Created` },
  lastLogin: { cs: `Poslední login`, en: `Last Login` },
  logout: { cs: `Odhlásit se`, en: `Logout` },
  telemetry: { cs: `Telemetrie`, en: `Telemetry` },
  accountStatistics: { cs: `Statistiky účtu`, en: `Account Statistics` },
  balance: { cs: `Zůstatek`, en: `Balance` },
  onChain_2: { cs: `on-chain`, en: `on-chain` },
  miningRewards: { cs: `Odměny za těžení`, en: `Mining Rewards` },
  totalEarned: { cs: `celkem vytěženo`, en: `total earned` },
  transactions: { cs: `Transakce`, en: `Transactions` },
  last50: { cs: `posledních 50`, en: `last 50` },
  aiSessions: { cs: `AI relace`, en: `AI Sessions` },
  hiranyagarbha: { cs: `Hiranyagarbha`, en: `Hiranyagarbha` },
  sections: { cs: `Sekce`, en: `Sections` },
  walletOverview: { cs: `Přehled peněženky`, en: `Wallet Overview` },
  miningStats: { cs: `Statistiky těžení`, en: `Mining Stats` },
  transactionHistory: { cs: `Historie transakcí`, en: `Transaction History` },
  hiranyagarbhaAi: { cs: `Hiranyagarbha AI`, en: `Hiranyagarbha AI` },
  continueInTheZionEcosystem: { cs: `Pokračuj ve ZION ekosystému`, en: `Continue in the ZION ecosystem` },
  wallet: { cs: `Peněženka`, en: `Wallet` },
};

type Tab = 'wallet' | 'mining' | 'transactions' | 'ai';

const TABS: { id: Tab; labelCs: string; labelEn: string; icon: typeof Wallet; rc: string }[] = [
  { id: 'wallet', labelCs: 'Peněženka', labelEn: 'Wallet', icon: Wallet, rc: '7, 137, 48' },
  { id: 'mining', labelCs: 'Těžení', labelEn: 'Mining', icon: Pickaxe, rc: '228, 30, 43' },
  { id: 'transactions', labelCs: 'Transakce', labelEn: 'Transactions', icon: ArrowLeftRight, rc: '252, 209, 22' },
  { id: 'ai', labelCs: 'AI Chat', labelEn: 'AI Chat', icon: Sparkles, rc: '7, 137, 48' },
];

interface DashboardStats {
  balance: number | null;
  balanceLoading: boolean;
  miningRewards: number | null;
  miningLoading: boolean;
  txCount: number | null;
  txLoading: boolean;
  aiSessions: number | null;
  aiLoading: boolean;
}

function StatCard({
  icon,
  colorClass,
  bgClass,
  label,
  value,
  sub,
  loading,
  rc = '228, 30, 43',
}: {
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  label: string;
  value: string;
  sub?: string;
  loading?: boolean;
  rc?: string;
}) {
  return (
    <div className="zion-rainbow-card p-4 transition-colors" style={{ '--rc': rc } as CSSProperties}>
      <div className={`flex items-center justify-center h-8 w-8 rounded-xl ${bgClass} mb-3 ${colorClass} [&>svg]:h-4 [&>svg]:w-4`}>
        {icon}
      </div>
      <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
      {loading ? (
        <div className="mt-2 space-y-2 animate-pulse">
          <div className="h-5 w-20 bg-white/5 rounded" />
          {sub && <div className="h-3 w-12 bg-white/5 rounded" />}
        </div>
      ) : (
        <>
          <p className="text-lg font-bold text-white font-mono mt-0.5">{value}</p>
          {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
        </>
      )}
    </div>
  );
}

export default function AccountPage() {
  const { user, logout, loading } = useAuth();
  const { lang } = useLang();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('wallet');
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    balance: null,
    balanceLoading: true,
    miningRewards: null,
    miningLoading: true,
    txCount: null,
    txLoading: true,
    aiSessions: null,
    aiLoading: true,
  });

  const cs = lang === 'cs';

  const fetchStats = useCallback(async () => {
    if (!user?.address) return;
    const address = user.address;

    setStats((s) => ({
      ...s,
      balanceLoading: true,
      miningLoading: true,
      txLoading: true,
      aiLoading: true,
    }));

    // Balance
    try {
      const res = await fetch(`/api/blockchain/address/${address}`);
      if (res.ok) {
        const data = await res.json();
        setStats((s) => ({
          ...s,
          balance: data.balance_zion ?? data.balance ?? 0,
          balanceLoading: false,
        }));
      } else {
        setStats((s) => ({ ...s, balanceLoading: false }));
      }
    } catch {
      setStats((s) => ({ ...s, balanceLoading: false }));
    }

    // Mining rewards
    try {
      const res = await fetch(`/api/miner/${address}`);
      if (res.ok) {
        const data = await res.json();
        const miner = data.miner ?? data;
        setStats((s) => ({
          ...s,
          miningRewards: miner?.total_earned ?? 0,
          miningLoading: false,
        }));
      } else {
        setStats((s) => ({ ...s, miningLoading: false, miningRewards: 0 }));
      }
    } catch {
      setStats((s) => ({ ...s, miningLoading: false, miningRewards: 0 }));
    }

    // Transactions
    try {
      const res = await fetch(`/api/blockchain/transactions?address=${address}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        const list = data.transactions ?? data.txs ?? data ?? [];
        setStats((s) => ({
          ...s,
          txCount: Array.isArray(list) ? list.length : 0,
          txLoading: false,
        }));
      } else {
        setStats((s) => ({ ...s, txLoading: false, txCount: 0 }));
      }
    } catch {
      setStats((s) => ({ ...s, txLoading: false, txCount: 0 }));
    }

    // AI sessions — no backend counter available yet, show placeholder
    setStats((s) => ({ ...s, aiSessions: 0, aiLoading: false }));
  }, [user?.address]);

  useEffect(() => {
    if (user?.address) {
      void fetchStats();
    }
  }, [fetchStats, user?.address]);

  if (loading) {
    return (
      <div className="zion-page text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-36 -left-28 h-[520px] w-[520px] rounded-full bg-zion-purple/18 blur-3xl" />
          <div className="absolute top-40 -right-24 h-[420px] w-[420px] rounded-full bg-zion-cyan/14 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-[420px] w-[620px] rounded-full bg-zion-gold/10 blur-3xl" />
        </div>
        <div className="zion-container relative z-10 flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-zion-cyan/30 border-t-zion-cyan animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  const copyAddress = () => {
    navigator.clipboard.writeText(user.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedCreated = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(AccountCopy.enUs[cs ? 'cs' : 'en'])
    : '—';
  const formattedLastLogin = user.lastLogin
    ? new Date(user.lastLogin).toLocaleDateString(AccountCopy.enUs[cs ? 'cs' : 'en'])
    : '—';

  return (
    <div className="zion-page text-white">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-36 -left-28 h-[520px] w-[520px] rounded-full bg-zion-purple/18 blur-3xl" />
        <div className="absolute top-40 -right-24 h-[420px] w-[420px] rounded-full bg-zion-cyan/14 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[420px] w-[620px] rounded-full bg-zion-gold/10 blur-3xl" />
      </div>

      <div className="zion-container relative z-10 space-y-10">

        {/* ── HERO / HEADER ── */}
        <section className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="zion-rainbow-card p-6 md:p-10"
            style={{ '--rc': '228, 30, 43' } as CSSProperties}
          >
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-5">
                <div className="zion-badge-gold">
                  <User className="h-4 w-4" />
                  {AccountCopy.myAccount[cs ? 'cs' : 'en']}
                </div>

                <div>
                  <p className="text-sm uppercase tracking-[0.4em] text-gray-400">
                    {AccountCopy.zionL1Dashboard[cs ? 'cs' : 'en']}
                  </p>
                  <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold text-gradient leading-tight">
                    {user.displayName || (AccountCopy.myAccount[cs ? 'cs' : 'en'])}
                  </h1>
                </div>

                <button
                  onClick={copyAddress}
                  className="zion-button-secondary rounded-full px-4 py-2 text-xs font-mono"
                >
                  {user.address}
                  {copied ? <Check className="h-3 w-3 text-zion-cyan-400" /> : <Copy className="h-3 w-3" />}
                </button>

                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="zion-badge-green">
                    <Shield className="h-3 w-3" /> {AccountCopy.authenticated[cs ? 'cs' : 'en']}
                  </span>
                  <span className="zion-badge-cyan">
                    <Zap className="h-3 w-3" /> ZION L1
                  </span>
                  <span className="zion-badge">
                    <Globe2 className="h-3 w-3" /> {AccountCopy.onChain[cs ? 'cs' : 'en']}
                  </span>
                </div>
              </div>

              {/* Quick info side card */}
              <div className="w-full lg:max-w-md space-y-3">
                <div className="zion-rainbow-sub p-5" style={{ '--rc': '228, 30, 43' } as CSSProperties}>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">
                    {AccountCopy.accountOverview[cs ? 'cs' : 'en']}
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Activity className="h-4 w-4 text-zion-gold" />
                        {AccountCopy.logins[cs ? 'cs' : 'en']}
                      </div>
                      <span className="font-mono text-white">{user.loginCount ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Wallet className="h-4 w-4 text-zion-cyan" />
                        {AccountCopy.address[cs ? 'cs' : 'en']}
                      </div>
                      <span className="font-mono text-white text-xs">
                        {user.address.slice(0, 10)}…{user.address.slice(-6)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <TrendingUp className="h-4 w-4 text-zion-cyan-400" />
                        {AccountCopy.created[cs ? 'cs' : 'en']}
                      </div>
                      <span className="font-mono text-white">{formattedCreated}</span>
                    </div>
                    <div className="flex items-center justify-between zion-rainbow-sub p-3" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <Sparkles className="h-4 w-4 text-zion-cyan" />
                        {AccountCopy.lastLogin[cs ? 'cs' : 'en']}
                      </div>
                      <span className="font-mono text-white">{formattedLastLogin}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    await logout();
                    router.push('/');
                  }}
                  className="zion-button-secondary w-full items-center justify-center gap-2 text-zion-purple-400 hover:text-zion-purple-300"
                >
                  <LogOut className="h-3.5 w-3.5" /> {AccountCopy.logout[cs ? 'cs' : 'en']}
                </button>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ── QUICK STATS ── */}
        <section className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
          >
            <div className="flex flex-col gap-2 mb-6">
              <p className="text-sm uppercase tracking-[0.4em] text-gray-500">{AccountCopy.telemetry[cs ? 'cs' : 'en']}</p>
              <h2 className="text-3xl font-semibold text-white flex items-center gap-3">
                <Activity className="h-7 w-7 text-zion-cyan-400" />
                {AccountCopy.accountStatistics[cs ? 'cs' : 'en']}
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                icon={<Wallet className="h-5 w-5" />}
                colorClass="text-zion-cyan"
                bgClass="bg-zion-cyan/10"
                rc="7, 137, 48"
                label={AccountCopy.balance[cs ? 'cs' : 'en']}
                value={stats.balance !== null ? `${stats.balance.toFixed(8)} ZION` : '—'}
                sub={AccountCopy.onChain_2[cs ? 'cs' : 'en']}
                loading={stats.balanceLoading}
              />
              <StatCard
                icon={<Pickaxe className="h-5 w-5" />}
                colorClass="text-zion-gold"
                bgClass="bg-zion-gold/10"
                rc="252, 209, 22"
                label={AccountCopy.miningRewards[cs ? 'cs' : 'en']}
                value={stats.miningRewards !== null ? `${stats.miningRewards.toFixed(8)} ZION` : '—'}
                sub={AccountCopy.totalEarned[cs ? 'cs' : 'en']}
                loading={stats.miningLoading}
              />
              <StatCard
                icon={<ArrowLeftRight className="h-5 w-5" />}
                colorClass="text-zion-cyan-400"
                bgClass="bg-zion-cyan-400/10"
                rc="7, 137, 48"
                label={AccountCopy.transactions[cs ? 'cs' : 'en']}
                value={stats.txCount !== null ? String(stats.txCount) : '—'}
                sub={AccountCopy.last50[cs ? 'cs' : 'en']}
                loading={stats.txLoading}
              />
              <StatCard
                icon={<Bot className="h-5 w-5" />}
                colorClass="text-zion-cyan"
                bgClass="bg-zion-cyan/10"
                rc="7, 137, 48"
                label={AccountCopy.aiSessions[cs ? 'cs' : 'en']}
                value={stats.aiSessions !== null ? String(stats.aiSessions) : '—'}
                sub={AccountCopy.hiranyagarbha[cs ? 'cs' : 'en']}
                loading={stats.aiLoading}
              />
            </div>
          </motion.div>
        </section>

        {/* ── TAB BAR ── */}
        <section className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.02 }}
            className="zion-rainbow-card p-4 md:p-5"
            style={{ '--rc': '228, 30, 43' } as CSSProperties}
          >
            <div className="flex flex-wrap items-center gap-2 md:gap-3">
              <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mr-1 hidden sm:inline">
                {AccountCopy.sections[cs ? 'cs' : 'en']}
              </span>
              {TABS.map((t) => {
                const Icon = t.icon;
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`inline-flex items-center gap-2 rounded-xl px-3 md:px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'zion-rainbow-sub'
                        : 'border border-white/10 bg-white/5 text-gray-300 hover:border-white/25 hover:text-white'
                    }`}
                    style={isActive ? ({ '--rc': t.rc } as CSSProperties) : undefined}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {cs ? t.labelCs : t.labelEn}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </section>

        {/* ── TAB CONTENT ── */}
        <section className="relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === 'wallet' && (
                <div className="zion-rainbow-card p-6" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
                  <div className="flex items-center gap-2 mb-6">
                    <Wallet className="h-5 w-5 text-zion-cyan" />
                    <h2 className="text-lg font-bold text-white">{AccountCopy.walletOverview[cs ? 'cs' : 'en']}</h2>
                  </div>
                  <WalletOverview address={user.address} />
                </div>
              )}
              {activeTab === 'mining' && (
                <div className="zion-rainbow-card p-6" style={{ '--rc': '228, 30, 43' } as CSSProperties}>
                  <div className="flex items-center gap-2 mb-6">
                    <Pickaxe className="h-5 w-5 text-zion-purple-400" />
                    <h2 className="text-lg font-bold text-white">{AccountCopy.miningStats[cs ? 'cs' : 'en']}</h2>
                  </div>
                  <MiningStats address={user.address} />
                </div>
              )}
              {activeTab === 'transactions' && (
                <div className="zion-rainbow-card p-6" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
                  <div className="flex items-center gap-2 mb-6">
                    <ArrowLeftRight className="h-5 w-5 text-zion-gold" />
                    <h2 className="text-lg font-bold text-white">{AccountCopy.transactionHistory[cs ? 'cs' : 'en']}</h2>
                  </div>
                  <TransactionHistory address={user.address} />
                </div>
              )}
              {activeTab === 'ai' && (
                <div className="zion-rainbow-card p-6" style={{ '--rc': '7, 137, 48' } as CSSProperties}>
                  <div className="flex items-center gap-2 mb-6">
                    <Sparkles className="h-5 w-5 text-zion-cyan" />
                    <h2 className="text-lg font-bold text-white">{AccountCopy.hiranyagarbhaAi[cs ? 'cs' : 'en']}</h2>
                  </div>
                  <DashboardAIChat />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </section>

        {/* ── CTA BANNER ── */}
        <section className="relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="zion-cta-banner"
          >
            <h2 className="text-2xl font-semibold text-white text-center mb-6">
              {AccountCopy.continueInTheZionEcosystem[cs ? 'cs' : 'en']}
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/wallet" className="zion-button-primary">
                <Wallet className="h-4 w-4" /> {AccountCopy.wallet[cs ? 'cs' : 'en']}
              </Link>
              <Link href="/explorer" className="zion-button-secondary">
                <Globe2 className="h-4 w-4" /> Explorer
              </Link>
              <Link href="/defi" className="zion-button-secondary">
                <TrendingUp className="h-4 w-4" /> Multichain
              </Link>
            </div>
          </motion.div>
        </section>

      </div>
    </div>
  );
}
