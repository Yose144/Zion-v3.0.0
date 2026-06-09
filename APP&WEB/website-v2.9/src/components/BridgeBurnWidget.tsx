'use client';

/**
 * BridgeBurnWidget — interactive wZION → ZION burn widget.
 * Uses MetaMask (window.ethereum) + ethers v5 to call burn(amount, l1Recipient)
 * on the wZION ERC-20 contract on Base Mainnet.
 */

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Flame, Wallet, RefreshCw, ExternalLink, CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import {
  BRIDGE_CONTRACTS,
  WZION_ABI,
  BASE_MAINNET_CHAIN_ID,
  switchToBaseMainnet,
} from '@/lib/bridge-api';

// wZION on Base Mainnet has 18 decimals (standard ERC-20)
const WZION_DECIMALS = 18;

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
  const { lang } = useLang();
  const cs = lang === 'cs';
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
    return new ethers.providers.Web3Provider(eth as ethers.providers.ExternalProvider);
  }

  const refreshBalance = useCallback(async (addr: string) => {
    try {
      setPhase('loading-balance');
      const provider = getProvider();
      const contract = new ethers.Contract(BRIDGE_CONTRACTS.wzion_address, WZION_ABI, provider);
      const raw: ethers.BigNumber = await contract.balanceOf(addr);
      const formatted = ethers.utils.formatUnits(raw, WZION_DECIMALS);
      setBalance(parseFloat(formatted).toLocaleString(tr('bridgeBurn', 'en_us', lang), { maximumFractionDigits: 8 }));
      setPhase('ready');
    } catch (e) {
      setBalance('—');
      setPhase('ready');
      console.error('balance fetch error', e);
    }
  }, [cs]);

  // ── connect wallet ───────────────────────────────────────────────────────────

  async function connect() {
    setError(null);
    setPhase('connecting');
    try {
      const provider = getProvider();
      const accounts = await provider.send('eth_requestAccounts', []);
      if (!accounts[0]) throw new Error('No account returned');

      setPhase('switching-chain');
      await switchToBaseMainnet();

      const network = await provider.getNetwork();
      if (network.chainId !== BASE_MAINNET_CHAIN_ID) {
        throw new Error(`Wrong network: expected Base Mainnet (${BASE_MAINNET_CHAIN_ID}), got ${network.chainId}`);
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
      setError(tr('bridgeBurn', 'enter_a_valid_wzion_amount', lang));
      return;
    }
    if (!l1Address.trim().startsWith('zion1') && !l1Address.trim().startsWith('Zo')) {
      setError(tr('bridgeBurn', 'l1_address_must_start_with_zion1_or_zo', lang));
      return;
    }

    setPhase('confirming');
    try {
      const provider = getProvider();
      await switchToBaseMainnet();
      const signer = provider.getSigner();

      // ensure still on right network
      const network = await provider.getNetwork();
      if (network.chainId !== BASE_MAINNET_CHAIN_ID) {
        throw new Error(tr('bridgeBurn', 'please_switch_to_base_in_metamask', lang));
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
      <div className="rounded-2xl border border-orange-500/30 bg-linear-to-b from-orange-500/10 to-black/60 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-400" />
          <h3 className="font-semibold text-white text-sm">{tr('bridgeBurn', 'burn_wzion_receive_zion_on_l1', lang)}</h3>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">
          {tr('bridgeBurn', 'connect_metamask_on_base_to_burn_your_wzion_a', lang)}
        </p>

        {!hasMetaMask && (
          <div className="flex items-start gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3">
            <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-300">
              {tr('bridgeBurn', 'metamask_not_detected_install', lang)}
              <a href="https://metamask.io" target="_blank" rel="noreferrer" className="underline">
                metamask.io
              </a>{' '}
              {tr('bridgeBurn', 'to_use_this_widget', lang)}
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 wrap-break-word">{error}</p>
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
          {phase === 'connecting' ? (tr('bridgeBurn', 'requesting_account', lang)) : phase === 'switching-chain' ? (tr('bridgeBurn', 'switching_to_base', lang)) : (tr('bridgeBurn', 'connect_metamask', lang))}
        </button>
      </div>
    );
  }

  // Success state
  if (phase === 'success' && txInfo) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-linear-to-b from-emerald-500/10 to-black/60 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <h3 className="font-semibold text-white text-sm">{tr('bridgeBurn', 'burn_submitted', lang)}</h3>
        </div>

        <div className="space-y-2 text-xs text-gray-300">
          <div className="flex justify-between">
            <span className="text-gray-500">{tr('bridgeBurn', 'amount_burned', lang)}</span>
            <span className="font-semibold text-white">{txInfo.amount} wZION</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{tr('bridgeBurn', 'l1_recipient', lang)}</span>
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
                href={`https://basescan.org/tx/${txInfo.hash}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-1.5 hover:bg-white/10 transition-colors"
              >
                <ExternalLink className="h-3 w-3 text-gray-400" />
              </a>
            </div>
            {copied && <p className="text-xs text-emerald-400 mt-1">✓ {tr('bridgeBurn', 'copied', lang)}</p>}
          </div>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">
          {tr('bridgeBurn', 'the_relay_will_detect_the', lang)}<code className="text-orange-300">BurnForBridge</code>{tr('bridgeBurn', 'event_after_64_evm_block_confirmations_2_min_', lang)}
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
          {tr('bridgeBurn', 'burn_more', lang)}
        </button>
      </div>
    );
  }

  // Ready / confirming / pending states — main form
  const isBusy = phase === 'confirming' || phase === 'pending' || phase === 'loading-balance';
  const amountFloat = parseFloat(amount) || 0;
  const amountAtomicDisplay = amountFloat > 0 ? ethers.utils.parseUnits(amountFloat.toString(), WZION_DECIMALS).toString() : '0';

  return (
    <div className="rounded-2xl border border-orange-500/30 bg-linear-to-b from-orange-500/10 to-black/60 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-400" />
          <h3 className="font-semibold text-white text-sm">{tr('bridgeBurn', 'burn_wzion_zion_on_l1', lang)}</h3>
        </div>
        <button
          onClick={() => account && refreshBalance(account)}
          disabled={isBusy}
          className="rounded-xl border border-white/10 bg-white/5 p-1.5 hover:bg-white/10 disabled:opacity-50 transition-colors"
          title={tr('bridgeBurn', 'refresh_balance', lang)}
        >
          <RefreshCw className={`h-3 w-3 text-gray-400 ${phase === 'loading-balance' ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Wallet info */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2">
        <div>
          <p className="text-xs text-gray-500">{tr('bridgeBurn', 'connected_wallet', lang)}</p>
          <p className="font-mono text-xs text-white">
            {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : '—'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">{tr('bridgeBurn', 'wzion_balance', lang)}</p>
          <p className="font-mono text-sm font-semibold text-orange-300">
            {phase === 'loading-balance' ? '…' : balance}
          </p>
        </div>
      </div>

      {/* Amount input */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {tr('bridgeBurn', 'amount_wzion', lang)}
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={tr('bridgeBurn', 'e_g_100', lang)}
          disabled={isBusy}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-sm text-white placeholder:text-gray-600 disabled:opacity-50"
        />
        {amountFloat > 0 && (
          <p className="text-xs text-gray-500">
            = <span className="text-white font-mono">{amountAtomicDisplay}</span> {tr('bridgeBurn', 'wei', lang)} (×10<sup>18</sup>)
          </p>
        )}
      </div>

      {/* L1 recipient */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {tr('bridgeBurn', 'zion_l1_recipient_address', lang)}
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
          <p className="text-xs text-red-300 wrap-break-word">{error}</p>
        </div>
      )}

      {/* Contract details */}
      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 space-y-1">
        <p className="text-xs text-gray-500">
          {tr('bridgeBurn', 'wzion_contract', lang)}{' '}
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
        <p className="text-xs text-gray-500">{tr('bridgeBurn', 'network', lang)}: Base Mainnet (chain 8453) · 18 {tr('bridgeBurn', 'decimals', lang)} · {tr('bridgeBurn', 'no_protocol_fee', lang)}</p>
      </div>

      <button
        onClick={burn}
        disabled={isBusy || !amount || !l1Address || amountFloat <= 0}
        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-500/40 bg-orange-500/20 px-5 py-3 text-sm font-semibold text-orange-300 hover:bg-orange-500/30 disabled:opacity-40 transition-colors"
      >
        {isBusy ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            {phase === 'confirming' ? (tr('bridgeBurn', 'confirm_in_metamask', lang)) : phase === 'pending' ? (tr('bridgeBurn', 'broadcasting_tx', lang)) : (tr('bridgeBurn', 'loading', lang))}
          </>
        ) : (
          <>
            <Flame className="h-4 w-4" />
            {tr('bridgeBurn', 'burn', lang)}{amountFloat > 0 ? `${amountFloat} ` : ''}wZION → ZION on L1
          </>
        )}
      </button>

      <p className="text-xs text-gray-500 text-center">
        {tr('bridgeBurn', 'zion_arrives_on_l1_within_5_min_after_evm_bur', lang)}
      </p>
    </div>
  );
}
