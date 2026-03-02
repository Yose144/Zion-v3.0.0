'use client';

/**
 * BridgeBurnWidget — interactive wZION → ZION burn widget.
 * Uses MetaMask (window.ethereum) + ethers v5 to call burn(amount, l1Recipient)
 * on the wZION ERC-20 contract on Base Sepolia.
 */

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Flame, Wallet, RefreshCw, ExternalLink, CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import {
  BRIDGE_CONTRACTS,
  WZION_ABI,
  BASE_SEPOLIA_CHAIN_ID,
  switchToBaseSepolia,
} from '@/lib/bridge-api';

// wZION has 8 decimals (same as native ZION satoshis)
const WZION_DECIMALS = 8;

type Phase =
  | 'idle'
  | 'connecting'
  | 'switching-chain'
  | 'loading-balance'
  | 'ready'
  | 'confirming'
  | 'pending'
  | 'success'
  | 'error';

interface TxInfo {
  hash: string;
  amount: string;
  l1Recipient: string;
}

export default function BridgeBurnWidget() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [amount, setAmount] = useState('');
  const [l1Address, setL1Address] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [txInfo, setTxInfo] = useState<TxInfo | null>(null);
  const [copied, setCopied] = useState(false);

  const hasMetaMask = typeof window !== 'undefined' && !!(window as Window & { ethereum?: unknown }).ethereum;

  // ── helpers ─────────────────────────────────────────────────────────────────

  function getProvider() {
    const eth = (window as Window & { ethereum?: unknown }).ethereum;
    if (!eth) throw new Error('MetaMask not found');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new ethers.providers.Web3Provider(eth as any);
  }

  const refreshBalance = useCallback(async (addr: string) => {
    try {
      setPhase('loading-balance');
      const provider = getProvider();
      const contract = new ethers.Contract(BRIDGE_CONTRACTS.wzion_address, WZION_ABI, provider);
      const raw: ethers.BigNumber = await contract.balanceOf(addr);
      const formatted = ethers.utils.formatUnits(raw, WZION_DECIMALS);
      setBalance(parseFloat(formatted).toLocaleString('en-US', { maximumFractionDigits: 8 }));
      setPhase('ready');
    } catch (e) {
      setBalance('—');
      setPhase('ready');
      console.error('balance fetch error', e);
    }
  }, []);

  // ── connect wallet ───────────────────────────────────────────────────────────

  async function connect() {
    setError(null);
    setPhase('connecting');
    try {
      const provider = getProvider();
      const accounts = await provider.send('eth_requestAccounts', []);
      if (!accounts[0]) throw new Error('No account returned');

      setPhase('switching-chain');
      await switchToBaseSepolia();

      const network = await provider.getNetwork();
      if (network.chainId !== BASE_SEPOLIA_CHAIN_ID) {
        throw new Error(`Wrong network: expected Base Sepolia (${BASE_SEPOLIA_CHAIN_ID}), got ${network.chainId}`);
      }

      setAccount(accounts[0] as string);
      await refreshBalance(accounts[0] as string);
    } catch (e: unknown) {
      setError((e as Error).message ?? String(e));
      setPhase('idle');
    }
  }

  // listen for account/chain changes
  useEffect(() => {
    if (!hasMetaMask) return;
    const eth = (window as Window & { ethereum?: {
      on: (event: string, cb: (...args: unknown[]) => void) => void;
      removeListener: (event: string, cb: (...args: unknown[]) => void) => void;
    } }).ethereum!;

    const onAccounts = (accounts: unknown) => {
      const accs = accounts as string[];
      if (accs.length === 0) {
        setAccount(null);
        setPhase('idle');
      } else {
        setAccount(accs[0]);
        refreshBalance(accs[0]);
      }
    };

    const onChain = () => {
      if (account) refreshBalance(account);
    };

    eth.on('accountsChanged', onAccounts);
    eth.on('chainChanged', onChain);
    return () => {
      eth.removeListener('accountsChanged', onAccounts);
      eth.removeListener('chainChanged', onChain);
    };
  }, [account, refreshBalance, hasMetaMask]);

  // ── burn ─────────────────────────────────────────────────────────────────────

  async function burn() {
    setError(null);
    if (!account) return;

    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      setError('Enter a valid wZION amount');
      return;
    }
    if (!l1Address.trim().startsWith('zion1') && !l1Address.trim().startsWith('Zo')) {
      setError('L1 address must start with zion1 or Zo…');
      return;
    }

    setPhase('confirming');
    try {
      const provider = getProvider();
      await switchToBaseSepolia();
      const signer = provider.getSigner();

      // ensure still on right network
      const network = await provider.getNetwork();
      if (network.chainId !== BASE_SEPOLIA_CHAIN_ID) {
        throw new Error('Please switch to Base Sepolia in MetaMask');
      }

      const contract = new ethers.Contract(BRIDGE_CONTRACTS.wzion_address, WZION_ABI, signer);
      const amountAtomic = ethers.utils.parseUnits(amount, WZION_DECIMALS);

      setPhase('pending');
      const tx: ethers.ContractTransaction = await contract.burn(amountAtomic, l1Address.trim());
      setTxInfo({ hash: tx.hash, amount: amountFloat.toString(), l1Recipient: l1Address.trim() });
      setPhase('success');

      // refresh balance after confirmation
      tx.wait(1).then(() => refreshBalance(account)).catch(() => {});
    } catch (e: unknown) {
      const msg = (e as { reason?: string; message?: string }).reason ?? (e as Error).message ?? String(e);
      setError(msg);
      setPhase('ready');
    }
  }

  function copyHash() {
    if (!txInfo) return;
    navigator.clipboard.writeText(txInfo.hash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── render ───────────────────────────────────────────────────────────────────

  // Not connected — show connect button
  if (phase === 'idle' || phase === 'connecting' || phase === 'switching-chain') {
    return (
      <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-b from-orange-500/10 to-black/60 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-400" />
          <h3 className="font-semibold text-white text-sm">Burn wZION → receive ZION on L1</h3>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">
          Connect MetaMask on Base Sepolia to burn your wZION and receive ZION on L1.
        </p>

        {!hasMetaMask && (
          <div className="flex items-start gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3">
            <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-300">
              MetaMask not detected. Install{' '}
              <a href="https://metamask.io" target="_blank" rel="noreferrer" className="underline">
                metamask.io
              </a>{' '}
              to use this widget.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 break-words">{error}</p>
          </div>
        )}

        <button
          onClick={connect}
          disabled={!hasMetaMask || phase !== 'idle'}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-500/40 bg-orange-500/20 px-5 py-3 text-sm font-semibold text-orange-300 hover:bg-orange-500/30 disabled:opacity-50 transition-colors"
        >
          {phase === 'connecting' && <RefreshCw className="h-4 w-4 animate-spin" />}
          {phase === 'switching-chain' && <RefreshCw className="h-4 w-4 animate-spin" />}
          {phase === 'idle' && <Wallet className="h-4 w-4" />}
          {phase === 'connecting' ? 'Requesting account…' : phase === 'switching-chain' ? 'Switching to Base Sepolia…' : 'Connect MetaMask'}
        </button>
      </div>
    );
  }

  // Success state
  if (phase === 'success' && txInfo) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-black/60 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <h3 className="font-semibold text-white text-sm">Burn submitted!</h3>
        </div>

        <div className="space-y-2 text-xs text-gray-300">
          <div className="flex justify-between">
            <span className="text-gray-500">Amount burned</span>
            <span className="font-semibold text-white">{txInfo.amount} wZION</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">L1 recipient</span>
            <span className="font-mono text-white break-all">{txInfo.l1Recipient}</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">TX hash</span>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
              <code className="flex-1 font-mono text-xs text-emerald-300 break-all">{txInfo.hash}</code>
              <button onClick={copyHash} className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-1.5 hover:bg-white/10 transition-colors">
                <Copy className="h-3 w-3 text-gray-400" />
              </button>
              <a
                href={`https://sepolia.basescan.org/tx/${txInfo.hash}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-1.5 hover:bg-white/10 transition-colors"
              >
                <ExternalLink className="h-3 w-3 text-gray-400" />
              </a>
            </div>
            {copied && <p className="text-xs text-emerald-400 mt-1">✓ Copied</p>}
          </div>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">
          The relay will detect the <code className="text-orange-300">BurnForBridge</code> event after 64 EVM block confirmations (~2 min on Sepolia), then submit an L1 unlock. Your ZION will arrive within ~5 minutes.
        </p>

        <button
          onClick={() => {
            setPhase('ready');
            setTxInfo(null);
            setAmount('');
            setL1Address('');
            refreshBalance(account!);
          }}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Burn more
        </button>
      </div>
    );
  }

  // Ready / confirming / pending states — main form
  const isBusy = phase === 'confirming' || phase === 'pending' || phase === 'loading-balance';
  const amountFloat = parseFloat(amount) || 0;
  const amountAtomicDisplay = amountFloat > 0 ? (amountFloat * 1e8).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '0';

  return (
    <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-b from-orange-500/10 to-black/60 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-400" />
          <h3 className="font-semibold text-white text-sm">Burn wZION → ZION on L1</h3>
        </div>
        <button
          onClick={() => account && refreshBalance(account)}
          disabled={isBusy}
          className="rounded-xl border border-white/10 bg-white/5 p-1.5 hover:bg-white/10 disabled:opacity-50 transition-colors"
          title="Refresh balance"
        >
          <RefreshCw className={`h-3 w-3 text-gray-400 ${phase === 'loading-balance' ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Wallet info */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2">
        <div>
          <p className="text-xs text-gray-500">Connected wallet</p>
          <p className="font-mono text-xs text-white">
            {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : '—'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">wZION balance</p>
          <p className="font-mono text-sm font-semibold text-orange-300">
            {phase === 'loading-balance' ? '…' : balance}
          </p>
        </div>
      </div>

      {/* Amount input */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Amount (wZION)
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 100"
          disabled={isBusy}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-sm text-white placeholder:text-gray-600 disabled:opacity-50"
        />
        {amountFloat > 0 && (
          <p className="text-xs text-gray-500">
            = <span className="text-white font-mono">{amountAtomicDisplay}</span> atomic units (×10<sup>8</sup>)
          </p>
        )}
      </div>

      {/* L1 recipient */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          ZION L1 recipient address
        </label>
        <input
          type="text"
          value={l1Address}
          onChange={(e) => setL1Address(e.target.value)}
          placeholder="zion1…"
          disabled={isBusy}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-sm text-white placeholder:text-gray-600 disabled:opacity-50"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300 break-words">{error}</p>
        </div>
      )}

      {/* Contract details */}
      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 space-y-1">
        <p className="text-xs text-gray-500">
          wZION contract:{' '}
          <code className="text-gray-300 font-mono text-[11px]">
            {BRIDGE_CONTRACTS.wzion_address.slice(0, 10)}…{BRIDGE_CONTRACTS.wzion_address.slice(-6)}
          </code>
          {' · '}
          <a
            href={`${BRIDGE_CONTRACTS.explorer_base}${BRIDGE_CONTRACTS.wzion_address}`}
            target="_blank"
            rel="noreferrer"
            className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
          >
            BaseScan <ExternalLink className="h-3 w-3" />
          </a>
        </p>
        <p className="text-xs text-gray-500">Network: Base Sepolia (chain 84532) · 8 decimals · no protocol fee</p>
      </div>

      <button
        onClick={burn}
        disabled={isBusy || !amount || !l1Address || amountFloat <= 0}
        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-500/40 bg-orange-500/20 px-5 py-3 text-sm font-semibold text-orange-300 hover:bg-orange-500/30 disabled:opacity-40 transition-colors"
      >
        {isBusy ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            {phase === 'confirming' ? 'Confirm in MetaMask…' : phase === 'pending' ? 'Broadcasting TX…' : 'Loading…'}
          </>
        ) : (
          <>
            <Flame className="h-4 w-4" />
            Burn {amountFloat > 0 ? `${amountFloat} ` : ''}wZION → ZION on L1
          </>
        )}
      </button>

      <p className="text-xs text-gray-500 text-center">
        ZION arrives on L1 within ~5 min after EVM burn confirmation.
      </p>
    </div>
  );
}
