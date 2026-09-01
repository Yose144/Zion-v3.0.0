'use client';

/**
 * ZionDex Liquidity — add/remove liquidity page
 * Connected to the V31 multichain DEX API via the Next.js /api/swap proxy.
 * Uses ZIONDexRouter (Base Mainnet) for real on-chain AMM liquidity.
 */

import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { Droplets, Plus, Minus, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import ChainSelector from '@/components/dex/ChainSelector';
import TokenSelector from '@/components/dex/TokenSelector';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import LoginModal from '@/components/LoginModal';
import { usePathname } from 'next/navigation';
import TestingPhaseBanner from '@/components/TestingPhaseBanner';
import {
  fetchPools,
  addLiquidity,
  removeLiquidity,
  getAmmPair,
  toAtomicAmount,
  fromAtomicAmount,
  buildAsset,
  ZIONDEX_FACTORY,
  ZIONDEX_ROUTER,
  type Pool,
} from '@/lib/dex-api';

export default function LiquidityPage() {
  const pathname = usePathname();
  const { authenticated } = useAuth();
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'add' | 'remove' | 'list'>('list');
  const [showLogin, setShowLogin] = useState(false);

  // Add liquidity form state
  const [chain, setChain] = useState('base');
  const [tokenA, setTokenA] = useState('tZION');
  const [tokenB, setTokenB] = useState('tUSDT');
  const [amountA, setAmountA] = useState('');
  const [amountB, setAmountB] = useState('');
  const [recipient, setRecipient] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Remove liquidity form state
  const [rmTokenA, setRmTokenA] = useState('tZION');
  const [rmTokenB, setRmTokenB] = useState('tUSDT');
  const [rmLiquidity, setRmLiquidity] = useState('');
  const [rmRecipient, setRmRecipient] = useState('');
  const [rmSubmitting, setRmSubmitting] = useState(false);
  const [rmResult, setRmResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // AMM pair lookup
  const [pairAddress, setPairAddress] = useState<string | null>(null);
  const [pairLoading, setPairLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchPools();
        setPools(data);
      } catch {
        setPools([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  // Look up AMM pair address when tokens change
  const lookupPair = useCallback(async () => {
    setPairAddress(null);
    if (!tokenA || !tokenB || tokenA === tokenB) return;
    setPairLoading(true);
    try {
      const res = await getAmmPair(chain, ZIONDEX_FACTORY, tokenA, tokenB);
      setPairAddress(res.pair_address);
    } catch {
      setPairAddress(null);
    } finally {
      setPairLoading(false);
    }
  }, [chain, tokenA, tokenB]);

  useEffect(() => {
    const timer = setTimeout(() => void lookupPair(), 400);
    return () => clearTimeout(timer);
  }, [lookupPair]);

  const handleAddLiquidity = async () => {
    if (!authenticated) {
      setShowLogin(true);
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const assetA = buildAsset(chain, tokenA);
      const assetB = buildAsset(chain, tokenB);
      const atomicA = toAtomicAmount(amountA, assetA.decimals);
      const atomicB = toAtomicAmount(amountB, assetB.decimals);
      const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 min

      const res = await addLiquidity({
        chain,
        routerAddress: ZIONDEX_ROUTER,
        tokenA,
        tokenB,
        amountADesired: atomicA,
        amountBDesired: atomicB,
        recipient: recipient.trim() || undefined,
        deadline,
      });

      if (res.ok) {
        const displayA = fromAtomicAmount(res.amount_a || atomicA, assetA.decimals);
        const displayB = fromAtomicAmount(res.amount_b || atomicB, assetB.decimals);
        const lpDisplay = res.lp_tokens ? fromAtomicAmount(res.lp_tokens, 18) : '0';
        setResult({
          ok: true,
          msg: `Liquidity added: ${displayA} ${tokenA} + ${displayB} ${tokenB}. LP tokens: ${lpDisplay}. Tx: ${res.tx_hash?.slice(0, 18)}…`,
        });
      } else {
        setResult({ ok: false, msg: res.error || 'Unknown error' });
      }
    } catch (e: any) {
      setResult({ ok: false, msg: e.message || 'Request failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!authenticated) {
      setShowLogin(true);
      return;
    }
    setRmSubmitting(true);
    setRmResult(null);
    try {
      const assetA = buildAsset(chain, rmTokenA);
      const assetB = buildAsset(chain, rmTokenB);
      const atomicLiq = toAtomicAmount(rmLiquidity, 18);
      const deadline = Math.floor(Date.now() / 1000) + 1200;

      const res = await removeLiquidity({
        chain,
        routerAddress: ZIONDEX_ROUTER,
        tokenA: rmTokenA,
        tokenB: rmTokenB,
        liquidity: atomicLiq,
        recipient: rmRecipient.trim() || undefined,
        deadline,
      });

      if (res.ok) {
        const displayA = fromAtomicAmount(res.amount_a || '0', assetA.decimals);
        const displayB = fromAtomicAmount(res.amount_b || '0', assetB.decimals);
        setRmResult({
          ok: true,
          msg: `Liquidity removed: ${displayA} ${rmTokenA} + ${displayB} ${rmTokenB}. Tx: ${res.tx_hash?.slice(0, 18)}…`,
        });
      } else {
        setRmResult({ ok: false, msg: res.error || 'Unknown error' });
      }
    } catch (e: any) {
      setRmResult({ ok: false, msg: e.message || 'Request failed' });
    } finally {
      setRmSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <Droplets className="w-6 h-6 text-zion-cyan" />
              <h1 className="text-2xl font-bold text-white">Liquidity Pools</h1>
            </div>
            <p className="text-zinc-400 text-sm">Provide liquidity to ZionDex AMM pools on Base and earn LP rewards</p>
          </motion.div>
        </div>
      </div>

      <TestingPhaseBanner type="dex" className="max-w-6xl mx-auto px-6 pt-4" />

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['list', 'add', 'remove'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === t
                  ? 'zion-rainbow-sub text-zion-gold'
                  : 'border border-white/10 bg-white/5 text-gray-400 hover:text-white'
              }`}
              style={tab === t ? { '--rc': '252, 209, 22' } as CSSProperties : undefined}
            >
              {t === 'list' && 'Pool List'}
              {t === 'add' && 'Add Liquidity'}
              {t === 'remove' && 'Remove Liquidity'}
            </button>
          ))}
        </div>

        {/* Pool List */}
        {tab === 'list' && (
          <div className="zion-rainbow-sub overflow-hidden" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">Chain</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">DEX</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">Pair</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">Fee</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">AMM Pair</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-zinc-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : pools.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-zinc-500">No pools found</td>
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
                      <td className="px-4 py-3 text-sm text-zinc-400 font-mono">
                        {pool.amm_pair ? (
                          <span className="text-zion-cyan">{pool.amm_pair.slice(0, 10)}…{pool.amm_pair.slice(-6)}</span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={pool.enabled ? 'zion-badge zion-badge-green' : 'zion-badge'}>
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
            <div className="zion-rainbow-card p-6" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
              <div className="flex items-center gap-2 mb-5">
                <Plus className="w-5 h-5 text-zion-gold" />
                <h2 className="text-lg font-bold text-white">Add Liquidity</h2>
              </div>

              <div className="space-y-4">
                <ChainSelector label="Chain" value={chain} onChange={setChain} />

                <div className="grid grid-cols-2 gap-3">
                  <TokenSelector label="Token A" chain={chain} value={tokenA} onChange={setTokenA} />
                  <TokenSelector label="Token B" chain={chain} value={tokenB} onChange={setTokenB} />
                </div>

                {/* AMM Pair lookup result */}
                <div className="zion-rainbow-sub p-3 text-xs" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
                  {pairLoading ? (
                    <span className="text-zinc-400 flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> Looking up AMM pair…
                    </span>
                  ) : pairAddress ? (
                    <span className="text-zion-cyan flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3" /> AMM Pair: <span className="font-mono">{pairAddress.slice(0, 10)}…{pairAddress.slice(-6)}</span>
                    </span>
                  ) : (
                    <span className="text-zinc-500 flex items-center gap-2">
                      <AlertCircle className="w-3 h-3" /> No AMM pair found for this token pair. A new pair will be created.
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Amount A</label>
                    <input
                      type="number"
                      value={amountA}
                      onChange={e => setAmountA(e.target.value)}
                      placeholder="0.0"
                      className="w-full px-4 py-3 border-white/10 bg-white/5 rounded-xl text-lg font-bold text-white placeholder-zinc-600 focus:border-zion-cyan/50 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Amount B</label>
                    <input
                      type="number"
                      value={amountB}
                      onChange={e => setAmountB(e.target.value)}
                      placeholder="0.0"
                      className="w-full px-4 py-3 border-white/10 bg-white/5 rounded-xl text-lg font-bold text-white placeholder-zinc-600 focus:border-zion-cyan/50 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Recipient (optional)</label>
                  <input
                    type="text"
                    value={recipient}
                    onChange={e => setRecipient(e.target.value)}
                    placeholder="0x... (defaults to signer)"
                    className="w-full px-4 py-2.5 border-white/10 bg-white/5 rounded-xl text-sm text-white font-mono placeholder-zinc-600 focus:border-zion-cyan/50 focus:outline-none"
                  />
                </div>

                <div className="zion-rainbow-sub p-3 text-xs text-zinc-500" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
                  Router: <span className="font-mono text-zinc-400">{ZIONDEX_ROUTER.slice(0, 10)}…{ZIONDEX_ROUTER.slice(-6)}</span>
                  {' · '}
                  Factory: <span className="font-mono text-zinc-400">{ZIONDEX_FACTORY.slice(0, 10)}…{ZIONDEX_FACTORY.slice(-6)}</span>
                </div>

                {result && (
                  <div
                    className="zion-rainbow-sub p-3 text-sm"
                    style={{
                      '--rc': result.ok ? '6, 105, 40' : '228, 30, 43',
                    } as CSSProperties}
                  >
                    <span className={result.ok ? 'text-zion-cyan' : 'text-zion-purple'}>{result.msg}</span>
                  </div>
                )}

                <button
                  onClick={handleAddLiquidity}
                  disabled={!amountA || !amountB || submitting}
                  className="zion-button-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Adding...' : !authenticated ? 'Connect to Add Liquidity' : 'Add Liquidity'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Remove Liquidity */}
        {tab === 'remove' && (
          <div className="max-w-lg mx-auto">
            <div className="zion-rainbow-card p-6" style={{ '--rc': '252, 209, 22' } as CSSProperties}>
              <div className="flex items-center gap-2 mb-5">
                <Minus className="w-5 h-5 text-zion-gold" />
                <h2 className="text-lg font-bold text-white">Remove Liquidity</h2>
              </div>

              <div className="space-y-4">
                <ChainSelector label="Chain" value={chain} onChange={setChain} />

                <div className="grid grid-cols-2 gap-3">
                  <TokenSelector label="Token A" chain={chain} value={rmTokenA} onChange={setRmTokenA} />
                  <TokenSelector label="Token B" chain={chain} value={rmTokenB} onChange={setRmTokenB} />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">LP Token Amount</label>
                  <input
                    type="number"
                    value={rmLiquidity}
                    onChange={e => setRmLiquidity(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-4 py-3 border-white/10 bg-white/5 rounded-xl text-lg font-bold text-white placeholder-zinc-600 focus:border-zion-cyan/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Recipient (optional)</label>
                  <input
                    type="text"
                    value={rmRecipient}
                    onChange={e => setRmRecipient(e.target.value)}
                    placeholder="0x... (defaults to signer)"
                    className="w-full px-4 py-2.5 border-white/10 bg-white/5 rounded-xl text-sm text-white font-mono placeholder-zinc-600 focus:border-zion-cyan/50 focus:outline-none"
                  />
                </div>

                <div className="zion-rainbow-sub p-3 text-xs text-zinc-500" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
                  Router: <span className="font-mono text-zinc-400">{ZIONDEX_ROUTER.slice(0, 10)}…{ZIONDEX_ROUTER.slice(-6)}</span>
                </div>

                {rmResult && (
                  <div
                    className="zion-rainbow-sub p-3 text-sm"
                    style={{
                      '--rc': rmResult.ok ? '6, 105, 40' : '228, 30, 43',
                    } as CSSProperties}
                  >
                    <span className={rmResult.ok ? 'text-zion-cyan' : 'text-zion-purple'}>{rmResult.msg}</span>
                  </div>
                )}

                <button
                  onClick={handleRemoveLiquidity}
                  disabled={!rmLiquidity || rmSubmitting}
                  className="zion-button-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {rmSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {rmSubmitting ? 'Removing...' : !authenticated ? 'Connect to Remove Liquidity' : 'Remove Liquidity'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link href="/dex" className="text-sm text-zinc-400 hover:text-zion-gold transition-colors">
            ← Back to Swap
          </Link>
        </div>
      </div>

      <LoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        redirectTo={pathname}
      />
    </div>
  );
}
