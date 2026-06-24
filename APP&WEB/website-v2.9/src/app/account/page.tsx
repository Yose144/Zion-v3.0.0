'use client';

/**
 * /account — User's personal dashboard (protected).
 *
 * Tabs: Wallet Overview, Mining Stats, Transaction History, AI Chat
 * Requires authentication via Zion Wallet.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Pickaxe, ArrowLeftRight, Sparkles, LogOut, Copy, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import WalletOverview from '@/components/dashboard/WalletOverview';
import MiningStats from '@/components/dashboard/MiningStats';
import TransactionHistory from '@/components/dashboard/TransactionHistory';
import DashboardAIChat from '@/components/dashboard/DashboardAIChat';

type Tab = 'wallet' | 'mining' | 'transactions' | 'ai';

const TABS: { id: Tab; label: string; icon: typeof Wallet }[] = [
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'mining', label: 'Mining', icon: Pickaxe },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'ai', label: 'AI Chat', icon: Sparkles },
];

export default function AccountPage() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('wallet');
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-zion-cyan/30 border-t-zion-cyan animate-spin" />
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

  return (
    <div className="zion-container py-8 md:py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">
              {user.displayName || 'My Account'}
            </h1>
            <button
              onClick={copyAddress}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-mono text-gray-400 hover:border-white/20 transition-colors"
            >
              {user.address}
              {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
          <button
            onClick={async () => {
              await logout();
              router.push('/');
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" /> Logout
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-white/10 pb-px">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="active-tab"
                className="absolute inset-x-0 -bottom-px h-0.5 bg-gradient-to-r from-zion-cyan to-zion-purple"
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'wallet' && <WalletOverview address={user.address} />}
          {activeTab === 'mining' && <MiningStats address={user.address} />}
          {activeTab === 'transactions' && <TransactionHistory address={user.address} />}
          {activeTab === 'ai' && <DashboardAIChat />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
