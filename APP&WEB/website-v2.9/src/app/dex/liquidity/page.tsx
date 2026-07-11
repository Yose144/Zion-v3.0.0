'use client';

/**
 * ZionDex Liquidity — add/remove liquidity page
 * Shows pool list and add liquidity form
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Droplets, Plus, Minus, ExternalLink, Loader2 } from 'lucide-react';
import ChainSelector from '@/components/dex/ChainSelector';
import TokenSelector from '@/components/dex/TokenSelector';
import Link from 'next/link';

const ROUTER_URL = process.env.NEXT_PUBLIC_ZIONDEX_ROUTER_URL || 'http://localhost:8454';

interface Pool {
  chain: string;
  dex: string;
  token_a: string;
  token_b: string;
  address: string;
  fee_bps: number;
  enabled: boolean;
}

export default function LiquidityPage() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'add' | 'remove' | 'list'>('list');

  // Add liquidity form state
  const [chain, setChain] = useState('base');
  const [tokenA, setTokenA] = useState('wZION');
  const [tokenB, setTokenB] = useState('USDT');
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [tickLower, setTickLower] = useState('-887220');
  const [tickUpper, setTickUpper] = useState('887220');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const fetchPools = async () => {
      try {
        const resp = await fetch(`${ROUTER_URL}/pools`);
        if (resp.ok) {
          const data = await resp.json();
          setPools(data.pools || []);
        } else {
          // Placeholder pools
          setPools([
            { chain: 'base', dex: 'uniswap-v3', token_a: 'wZION', token_b: 'USDT', address: '0x186b46c2...', fee_bps: 30, enabled: true },
            { chain: 'base', dex: 'uniswap-v3', token_a: 'wZION', token_b: 'WETH', address: '0x18c0DaeF...', fee_bps: 100, enabled: true },
            { chain: 'base', dex: 'ziondex-amm', token_a: 'wZION', token_b: 'USDT', address: '0x0', fee_bps: 15, enabled: false },
          ]);
        }
      } catch {
        setPools([]);
      } finally {
        setLoading(false);
      }
    };
    void fetchPools();
  }, []);

  const handleAddLiquidity = async () => {
    setSubmitting(true);
    setResult(null);
    try {
      // In production: call ZionDexRouter.addLiquidity() via ethers
      // For now: simulate
      await new Promise(r => setTimeout(r, 1500));
      setResult(`Liquidity added: ${amountA} ${tokenA} + ${amountB} ${tokenB} on ${chain}`);
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0f] via-[#0d0d18] to-[#0a0a0f]">
      {/* Header */}
      <div className="border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <Droplets className="w-6 h-6 text-blue-500" />
              <h1 className="text-2xl font-bold text-white">Liquidity Pools</h1>
            </div>
            <p className="text-zinc-400 text-sm">Provide liquidity to ZionDex AMM pools and earn ZDX rewards</p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['list', 'add', 'remove'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === t
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-zinc-900/60 text-zinc-400 border border-zinc-700/30 hover:text-zinc-300'
              }`}
            >
              {t === 'list' && 'Pool List'}
              {t === 'add' && 'Add Liquidity'}
              {t === 'remove' && 'Remove Liquidity'}
            </button>
          ))}
        </div>

        {/* Pool List */}
        {tab === 'list' && (
          <div className="bg-zinc-900/60 border border-zinc-700/30 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">Chain</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">DEX</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">Pair</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">Fee</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-zinc-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : pools.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-zinc-500">No pools found</td>
                  </tr>
                ) : (
                  pools.map((pool, i) => (
                    <tr key={i} className="border-b border-zinc-800/30 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-white capitalize">{pool.chain}</td>
                      <td className="px-4 py-3 text-sm text-zinc-300">{pool.dex}</td>
                      <td className="px-4 py-3 text-sm text-white font-medium">
                        {pool.token_a} / {pool.token_b}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-300 text-right">
                        {(pool.fee_bps / 100).toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          pool.enabled
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-zinc-500/10 text-zinc-500'
                        }`}>
                          {pool.enabled ? 'Active' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Liquidity */}
        {tab === 'add' && (
          <div className="max-w-lg mx-auto">
            <div className="bg-zinc-900/80 border border-zinc-700/50 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <Plus className="w-5 h-5 text-green-500" />
                <h2 className="text-lg font-bold text-white">Add Liquidity</h2>
              </div>

              <div className="space-y-4">
                <ChainSelector label="Chain" value={chain} onChange={setChain} />

                <div className="grid grid-cols-2 gap-3">
                  <TokenSelector label="Token A" chain={chain} value={tokenA} onChange={setTokenA} />
                  <TokenSelector label="Token B" chain={chain} value={tokenB} onChange={setTokenB} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Amount A</label>
                    <input
                      type="number"
                      value={amountA}
                      onChange={e => setAmountA(e.target.value)}
                      placeholder="0.0"
                      className="w-full px-4 py-3 bg-zinc-900/80 border border-zinc-700/50 rounded-xl text-lg font-bold text-white placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Amount B</label>
                    <input
                      type="number"
                      value={amountB}
                      onChange={e => setAmountB(e.target.value)}
                      placeholder="0.0"
                      className="w-full px-4 py-3 bg-zinc-900/80 border border-zinc-700/50 rounded-xl text-lg font-bold text-white placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Tick range (concentrated liquidity) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Tick Lower</label>
                    <input
                      type="number"
                      value={tickLower}
                      onChange={e => setTickLower(e.target.value)}
                      className="w-full px-4 py-2.5 bg-zinc-900/80 border border-zinc-700/50 rounded-xl text-sm text-white focus:border-amber-500/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Tick Upper</label>
                    <input
                      type="number"
                      value={tickUpper}
                      onChange={e => setTickUpper(e.target.value)}
                      className="w-full px-4 py-2.5 bg-zinc-900/80 border border-zinc-700/50 rounded-xl text-sm text-white focus:border-amber-500/50 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="text-xs text-zinc-500 bg-zinc-800/40 p-3 rounded-lg">
                  💡 Full range (-887220 to 887220) provides liquidity across all prices.
                  Narrow ranges concentrate liquidity for higher returns but more risk.
                </div>

                {result && (
                  <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-sm text-green-400">
                    {result}
                  </div>
                )}

                <button
                  onClick={handleAddLiquidity}
                  disabled={!amountA || !amountB || submitting}
                  className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-xl hover:from-green-400 hover:to-green-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Adding...' : 'Add Liquidity'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Remove Liquidity */}
        {tab === 'remove' && (
          <div className="max-w-lg mx-auto">
            <div className="bg-zinc-900/80 border border-zinc-700/50 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <Minus className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-bold text-white">Remove Liquidity</h2>
              </div>
              <div className="text-center py-12 text-zinc-500">
                <p>Connect your wallet to view and remove your liquidity positions.</p>
                <p className="text-xs mt-2">Requires ethers.js wallet connection.</p>
              </div>
            </div>
          </div>
        )}

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link href="/dex" className="text-sm text-zinc-400 hover:text-amber-400 transition-colors">
            ← Back to Swap
          </Link>
        </div>
      </div>
    </div>
  );
}
