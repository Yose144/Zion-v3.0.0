"use client";

import type { CSSProperties } from 'react';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Activity, TrendingUp, Award, Zap, Clock, Users } from 'lucide-react';

interface MinerStats {
  wallet_address: string;
  workers: string[];
  is_active: boolean;
  stats: {
    total_shares: number;
    accepted_shares: number;
    rejected_shares: number;
    blocks_found: number;
    current_hashrate: number;
    first_seen: number;
    last_seen: number;
    last_share_time: number;
    time_since_last_share: number;
  };
  balance: {
    pending: number;
    total_earned: number;
  };
  payments: Array<{
    amount: number;
    timestamp: number;
    txid: string;
  }>;
  efficiency: {
    acceptance_rate: number;
    rejection_rate: number;
  };
}

export default function MinerStatsClient() {
  const [address, setAddress] = useState('');
  const [stats, setStats] = useState<MinerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlAddress = params.get('address') || params.get('addr');
    if (urlAddress) {
      setAddress(urlAddress);
      fetchStats(urlAddress);
    }
  }, []);

  const fetchStats = async (addr: string) => {
    if (!addr || addr.trim().length === 0) {
      setError('Please enter a ZION address');
      return;
    }

    setLoading(true);
    setError('');
    setStats(null);

    try {
      const response = await fetch(`/api/miner/${addr.trim()}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setStats(data);
      
      // Update URL without reload
      const newUrl = `${window.location.pathname}?address=${encodeURIComponent(addr.trim())}`;
      window.history.pushState({}, '', newUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch miner stats');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStats(address);
  };

  const formatHashrate = (hashrate: number) => {
    if (hashrate >= 1e9) return `${(hashrate / 1e9).toFixed(2)} GH/s`;
    if (hashrate >= 1e6) return `${(hashrate / 1e6).toFixed(2)} MH/s`;
    if (hashrate >= 1e3) return `${(hashrate / 1e3).toFixed(2)} KH/s`;
    return `${hashrate.toFixed(2)} H/s`;
  };

  const formatTimestamp = (timestamp: number) => {
    return timestamp ? new Date(timestamp * 1000).toLocaleString() : '—';
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="zion-shell min-h-screen text-white relative overflow-x-hidden">
      
      <div className="zion-container py-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-zion-purple via-zion-purple to-zion-cyan bg-clip-text text-transparent">
            Miner Statistics
          </h1>
          <p className="text-gray-400 text-lg">
            Track your mining performance on ZION blockchain
          </p>
        </motion.div>

        {/* Search Form */}
        <motion.form
          onSubmit={handleSearch}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-2xl mx-auto mb-12"
        >
          <div className="relative">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter ZION address (e.g., zion1test)"
              className="w-full px-6 py-4 pl-14 bg-black/60 border border-zion-purple/30 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-zion-purple transition-colors"
            />
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zion-purple" />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 zion-button-primary text-sm disabled:opacity-50"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </motion.form>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto mb-8 p-4 bg-red-900/20 border border-zion-purple/50 rounded-xl text-zion-purple text-center"
          >
            {error}
          </motion.div>
        )}

        {/* Stats Grid */}
        {stats && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {/* Activity Status */}
            <div className="max-w-2xl mx-auto mb-6 flex items-center justify-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                stats.is_active
                  ? 'bg-zion-cyan animate-pulse'
                  : stats.balance.pending > 0
                    ? 'bg-zion-gold'
                    : 'bg-gray-500'
              }`} />
              <span className="text-gray-400">
                {stats.is_active
                  ? 'Active Mining'
                  : stats.balance.pending > 0
                    ? 'Inactive · pending balance'
                    : 'Inactive'} · Last seen {formatDuration(stats.stats.time_since_last_share)}
              </span>
            </div>

            {/* Inactive but pending balance banner */}
            {!stats.is_active && stats.balance.pending > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl mx-auto mb-8 p-4 bg-amber-900/20 border border-zion-gold/50 rounded-xl text-amber-200 text-center"
              >
                This payout address is registered with the pool but has no active worker right now.
                <br />
                Pending balance: <span className="font-semibold">{stats.balance.pending.toFixed(6)} ZION</span>
              </motion.div>
            )}

            {/* Stats Cards Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {/* Hashrate */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-zion-purple/30 rounded-xl p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Zap className="w-8 h-8 text-zion-purple" />
                  <h3 className="text-xl font-semibold">Hashrate</h3>
                </div>
                <div className="text-3xl font-bold text-zion-purple">
                  {formatHashrate(stats.stats.current_hashrate)}
                </div>
                <p className="text-gray-400 text-sm mt-2">Current mining power</p>
              </motion.div>

              {/* Total Shares */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="bg-gradient-to-br from-blue-900/20 to-cyan-900/20 border border-zion-purple/30 rounded-xl p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Activity className="w-8 h-8 text-zion-purple" />
                  <h3 className="text-xl font-semibold">Shares</h3>
                </div>
                <div className="text-3xl font-bold text-zion-purple">
                  {stats.stats?.total_shares ? stats.stats.total_shares.toLocaleString() : '0'}
                </div>
                <p className="text-gray-400 text-sm mt-2">
                  {stats.stats?.accepted_shares ? stats.stats.accepted_shares.toLocaleString() : '0'} accepted · {stats.stats?.rejected_shares ? stats.stats.rejected_shares.toLocaleString() : '0'} rejected
                </p>
              </motion.div>

              {/* Efficiency */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-gradient-to-br from-cyan-900/20 to-teal-900/20 border border-zion-cyan/30 rounded-xl p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <TrendingUp className="w-8 h-8 text-zion-cyan" />
                  <h3 className="text-xl font-semibold">Efficiency</h3>
                </div>
                <div className="text-3xl font-bold text-zion-cyan">
                  {stats.efficiency.acceptance_rate.toFixed(2)}%
                </div>
                <p className="text-gray-400 text-sm mt-2">Share acceptance rate</p>
              </motion.div>

              {/* Blocks Found */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border border-zion-gold/30 rounded-xl p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Award className="w-8 h-8 text-zion-gold" />
                  <h3 className="text-xl font-semibold">Blocks</h3>
                </div>
                <div className="text-3xl font-bold text-zion-gold">
                  {stats.stats?.blocks_found ? stats.stats.blocks_found.toLocaleString() : '0'}
                </div>
                <p className="text-gray-400 text-sm mt-2">Blocks found</p>
              </motion.div>

              {/* Balance */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-gradient-to-br from-green-900/20 to-emerald-900/20 border border-zion-cyan/30 rounded-xl p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Activity className="w-8 h-8 text-zion-cyan" />
                  <h3 className="text-xl font-semibold">Balance</h3>
                </div>
                <div className="text-3xl font-bold text-zion-cyan">
                  {stats.balance.pending.toFixed(2)} ZION
                </div>
                <p className="text-gray-400 text-sm mt-2">Pending payout</p>
              </motion.div>

              {/* Mining Since */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="bg-gradient-to-br from-pink-900/20 to-purple-900/20 border border-zion-purple/30 rounded-xl p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Clock className="w-8 h-8 text-zion-purple" />
                  <h3 className="text-xl font-semibold">Mining Since</h3>
                </div>
                <div className="text-lg font-bold text-zion-purple">
                  {formatTimestamp(stats.stats.first_seen)}
                </div>
                <p className="text-gray-400 text-sm mt-2">First share submitted</p>
              </motion.div>
            </div>

            {/* Workers List */}
            {stats.workers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-black/60 border border-zion-purple/30 rounded-xl p-6 mb-8"
              >
                <div className="flex items-center gap-3 mb-4">
                  <Users className="w-6 h-6 text-zion-purple" />
                  <h3 className="text-xl font-semibold">Active Workers ({stats.workers.length})</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {stats.workers.map((worker, i) => (
                    <span
                      key={i}
                      className="px-4 py-2 bg-purple-900/30 border border-zion-purple/50 rounded-lg text-zion-purple"
                    >
                      {worker}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Payment History */}
            {stats.payments.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-black/60 border border-zion-cyan/30 rounded-xl p-6"
              >
                <h3 className="text-xl font-semibold mb-4">Payment History</h3>
                <div className="space-y-3">
                  {stats.payments.map((payment, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-cyan-900/20 rounded-lg">
                      <div>
                        <div className="font-semibold text-zion-cyan">{payment.amount.toFixed(2)} ZION</div>
                        <div className="text-sm text-gray-400">{formatTimestamp(payment.timestamp)}</div>
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {payment.txid.substring(0, 12)}...
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Back to Dashboard */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-12"
        >
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-900/30 border border-zion-purple/50 rounded-xl hover:bg-purple-900/50 transition-colors"
          >
            ← Back to Dashboard
          </a>
        </motion.div>
      </div>
    </div>
  );
}
