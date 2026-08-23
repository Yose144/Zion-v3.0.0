'use client';

/**
 * BridgeBurnWidget — interactive wZION → ZION burn widget.
 * Uses the shared WalletContext (MetaMask/EIP-6963) for signing
 * and calls burn(amount, l1Recipient) on the wZION ERC-20 contract on Base Mainnet.
 */

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Flame, Wallet, RefreshCw, ExternalLink, CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useWallet } from '@/contexts/WalletContext';
import { BRIDGE_CONTRACTS, WZION_ABI } from '@/lib/bridge-api';

const BridgeBurnWidgetCopy = {
  enUs: { cs: `cs-CZ`, en: `en-US` },
  enterAValidWzionAmount: { cs: `Zadejte platne mnozstvi wZION`, en: `Enter a valid wZION amount` },
  l1AddressMustStartWithZion1OrZ: { cs: `L1 adresa musi zacinat na zion1 nebo Zo…`, en: `L1 address must start with zion1 or Zo…` },
  pleaseSwitchToBaseInMetamask: { cs: `Přepněte prosím v MetaMask na Base`, en: `Please switch to Base in MetaMask` },
  burnWzionReceiveZionOnL1: { cs: `Spalit wZION → prijmout ZION na L1`, en: `Burn wZION → receive ZION on L1` },
  connectMetamaskOnBaseToBurnYou: { cs: `Připojte MetaMask na Base, spalte své wZION a přijměte ZION na L1.`, en: `Connect MetaMask on Base to burn your wZION and receive ZION on L1.` },
  metamaskNotDetectedInstall: { cs: `MetaMask nebyl detekovan. Nainstalujte `, en: `MetaMask not detected. Install ` },
  toUseThisWidget: { cs: `pro pouziti tohoto widgetu.`, en: `to use this widget.` },
  requestingAccount: { cs: `Žádám účet…`, en: `Requesting account…` },
  switchingToBase: { cs: `Přepínám na Base…`, en: `Switching to Base…` },
  connectMetamask: { cs: `Připojit MetaMask`, en: `Connect MetaMask` },
  burnSubmitted: { cs: `Burn odeslan!`, en: `Burn submitted!` },
  amountBurned: { cs: `Spalene mnozstvi`, en: `Amount burned` },
  l1Recipient: { cs: `L1 prijemce`, en: `L1 recipient` },
  copied: { cs: `Zkopirovano`, en: `Copied` },
  theRelayWillDetectThe: { cs: `Relay detekuje event `, en: `The relay will detect the ` },
  eventAfter64EvmBlockConfirmati: { cs: ` po 64 potvrzeních EVM bloků (~2 min), pak odešle L1 unlock. Vaše ZION dorazí do ~5 minut.`, en: ` event after 64 EVM block confirmations (~2 min), then submit an L1 unlock. Your ZION will arrive within ~5 minutes.` },
  burnMore: { cs: `Spalit vice`, en: `Burn more` },
  burnWzionZionOnL1: { cs: `Spalit wZION → ZION na L1`, en: `Burn wZION → ZION on L1` },
  refreshBalance: { cs: `Obnovit zustatek`, en: `Refresh balance` },
  connectedWallet: { cs: `Pripojena penezenka`, en: `Connected wallet` },
  wzionBalance: { cs: `wZION zustatek`, en: `wZION balance` },
  amountWzion: { cs: `Mnozstvi (wZION)`, en: `Amount (wZION)` },
  eG100: { cs: `napr. 100`, en: `e.g. 100` },
  wei: { cs: `wei`, en: `wei` },
  zionL1RecipientAddress: { cs: `Adresa prijemce ZION na L1`, en: `ZION L1 recipient address` },
  wzionContract: { cs: `wZION kontrakt:`, en: `wZION contract:` },
  network: { cs: `Síť`, en: `Network` },
  decimals: { cs: `desetinných míst`, en: `decimals` },
  noProtocolFee: { cs: `žádný protokolový poplatek`, en: `no protocol fee` },
  confirmInMetamask: { cs: `Potvrdte v MetaMask…`, en: `Confirm in MetaMask…` },
  broadcastingTx: { cs: `Odesilam TX…`, en: `Broadcasting TX…` },
  loading: { cs: `Nacitam…`, en: `Loading…` },
  burn: { cs: `Spalit `, en: `Burn ` },
  zionArrivesOnL1Within5MinAfter: { cs: `ZION dorazi na L1 do ~5 minut po potvrzeni EVM burnu.`, en: `ZION arrives on L1 within ~5 min after EVM burn confirmation.` },
};

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
  const { connected, account, signer, provider, isBaseMainnet, connect, switchToBase } = useWallet();

  const [phase, setPhase] = useState<Phase>('idle');
  const [balance, setBalance] = useState<string>('0');
  const [amount, setAmount] = useState('');
  const [l1Address, setL1Address] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [txInfo, setTxInfo] = useState<TxInfo | null>(null);
  const [copied, setCopied] = useState(false);

  const hasWallet = typeof window !== 'undefined';

  // ── helpers ─────────────────────────────────────────────────────────────────

  const refreshBalance = useCallback(async () => {
    if (!account) return;
    try {
      setPhase(p => (p === 'idle' ? 'loading-balance' : p));
      const readProvider = provider ?? new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
      const contract = new ethers.Contract(BRIDGE_CONTRACTS.wzion_address, WZION_ABI, readProvider);
      const raw: ethers.BigNumber = await contract.balanceOf(account);
      const formatted = ethers.utils.formatUnits(raw, WZION_DECIMALS);
      setBalance(parseFloat(formatted).toLocaleString(BridgeBurnWidgetCopy.enUs[cs ? 'cs' : 'en'], { maximumFractionDigits: 8 }));
      setPhase('ready');
    } catch (e) {
      setBalance('—');
      setPhase('ready');
      console.error('balance fetch error', e);
    }
  }, [account, provider, cs]);

  // Sync phase with wallet state
  useEffect(() => {
    if (connected && isBaseMainnet) {
      void refreshBalance();
    } else if (connected && !isBaseMainnet) {
      setPhase('switching-chain');
    } else {
      setPhase('idle');
      setBalance('0');
    }
  }, [connected, isBaseMainnet, refreshBalance]);

  // ── connect wallet ───────────────────────────────────────────────────────────

  async function handleConnect() {
    setError(null);
    setPhase('connecting');
    try {
      await connect();
      if (!connected) {
        throw new Error('No wallet connected');
      }
      if (!isBaseMainnet) {
        setPhase('switching-chain');
        await switchToBase();
      }
      setPhase('ready');
    } catch (e: unknown) {
      setError((e as Error).message ?? String(e));
      setPhase('idle');
    }
  }

  // listen for account/chain changes are now handled by WalletContext; just refresh on account change
  useEffect(() => {
    if (connected && isBaseMainnet && account) {
      void refreshBalance();
    }
  }, [account, connected, isBaseMainnet, refreshBalance]);

  // ── burn ─────────────────────────────────────────────────────────────────────

  async function burn() {
    setError(null);
    if (!signer || !account) {
      setError('Wallet not connected');
      return;
    }

    const amountFloat = parseFloat(amount);
    if (isNaN(amountFloat) || amountFloat <= 0) {
      setError(BridgeBurnWidgetCopy.enterAValidWzionAmount[cs ? 'cs' : 'en']);
      return;
    }
    if (!l1Address.trim().startsWith('zion1') && !l1Address.trim().startsWith('Zo')) {
      setError(BridgeBurnWidgetCopy.l1AddressMustStartWithZion1OrZ[cs ? 'cs' : 'en']);
      return;
    }

    setPhase('confirming');
    try {
      if (!isBaseMainnet) {
        await switchToBase();
      }

      const contract = new ethers.Contract(BRIDGE_CONTRACTS.wzion_address, WZION_ABI, signer);
      const amountAtomic = ethers.utils.parseUnits(amount, WZION_DECIMALS);

      setPhase('pending');
      const tx: ethers.ContractTransaction = await contract.burn(amountAtomic, l1Address.trim());
      setTxInfo({ hash: tx.hash, amount: amountFloat.toString(), l1Recipient: l1Address.trim() });
      setPhase('success');

      // refresh balance after confirmation
      tx.wait(1).then(() => refreshBalance()).catch(() => {});
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
  if (phase === 'idle' || phase === 'connecting' || phase === 'switching-chain' || !connected) {
    return (
      <div className="zion-rainbow-card p-6 space-y-4" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-zion-gold" />
          <h3 className="font-semibold text-white text-sm">{BridgeBurnWidgetCopy.burnWzionReceiveZionOnL1[cs ? 'cs' : 'en']}</h3>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">
          {BridgeBurnWidgetCopy.connectMetamaskOnBaseToBurnYou[cs ? 'cs' : 'en']}
        </p>

        {!hasWallet && (
          <div className="flex items-start gap-2 rounded-xl border border-zion-gold/30 bg-zion-gold/10 p-3">
            <AlertCircle className="h-4 w-4 text-zion-gold shrink-0 mt-0.5" />
            <p className="text-xs text-zion-gold">
              {BridgeBurnWidgetCopy.metamaskNotDetectedInstall[cs ? 'cs' : 'en']}
              <a href="https://metamask.io" target="_blank" rel="noreferrer" className="underline">
                metamask.io
              </a>{' '}
              {BridgeBurnWidgetCopy.toUseThisWidget[cs ? 'cs' : 'en']}
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-zion-purple/30 bg-zion-purple/10 p-3">
            <AlertCircle className="h-4 w-4 text-zion-purple shrink-0 mt-0.5" />
            <p className="text-xs text-zion-purple wrap-break-word">{error}</p>
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={phase === 'connecting' || phase === 'switching-chain'}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-zion-gold/40 bg-zion-gold/20 px-5 py-3 text-sm font-semibold text-zion-gold hover:bg-zion-gold/30 disabled:opacity-50 transition-colors"
        >
          {phase === 'connecting' && <RefreshCw className="h-4 w-4 animate-spin" />}
          {phase === 'switching-chain' && <RefreshCw className="h-4 w-4 animate-spin" />}
          {phase === 'idle' && <Wallet className="h-4 w-4" />}
          {phase === 'connecting' ? (BridgeBurnWidgetCopy.requestingAccount[cs ? 'cs' : 'en']) : phase === 'switching-chain' ? (BridgeBurnWidgetCopy.switchingToBase[cs ? 'cs' : 'en']) : (BridgeBurnWidgetCopy.connectMetamask[cs ? 'cs' : 'en'])}
        </button>
      </div>
    );
  }

  // Success state
  if (phase === 'success' && txInfo) {
    return (
      <div className="zion-rainbow-card p-6 space-y-4" style={{ '--rc': '6, 105, 40' } as React.CSSProperties}>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-zion-cyan" />
          <h3 className="font-semibold text-white text-sm">{BridgeBurnWidgetCopy.burnSubmitted[cs ? 'cs' : 'en']}</h3>
        </div>

        <div className="space-y-2 text-xs text-gray-300">
          <div className="flex justify-between">
            <span className="text-gray-500">{BridgeBurnWidgetCopy.amountBurned[cs ? 'cs' : 'en']}</span>
            <span className="font-semibold text-white">{txInfo.amount} wZION</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{BridgeBurnWidgetCopy.l1Recipient[cs ? 'cs' : 'en']}</span>
            <span className="font-mono text-white break-all">{txInfo.l1Recipient}</span>
          </div>
          <div>
            <span className="text-gray-500 block mb-1">TX hash</span>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
              <code className="flex-1 font-mono text-xs text-zion-cyan break-all">{txInfo.hash}</code>
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
            {copied && <p className="text-xs text-zion-cyan mt-1">✓ {BridgeBurnWidgetCopy.copied[cs ? 'cs' : 'en']}</p>}
          </div>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed">
          {BridgeBurnWidgetCopy.theRelayWillDetectThe[cs ? 'cs' : 'en']}<code className="text-zion-gold">BurnForBridge</code>{BridgeBurnWidgetCopy.eventAfter64EvmBlockConfirmati[cs ? 'cs' : 'en']}
        </p>

        <button
          onClick={() => {
            setPhase('ready');
            setTxInfo(null);
            setAmount('');
            setL1Address('');
            void refreshBalance();
          }}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          {BridgeBurnWidgetCopy.burnMore[cs ? 'cs' : 'en']}
        </button>
      </div>
    );
  }

  // Ready / confirming / pending states — main form
  const isBusy = phase === 'confirming' || phase === 'pending' || phase === 'loading-balance';
  const amountFloat = parseFloat(amount) || 0;
  const amountAtomicDisplay = amountFloat > 0 ? ethers.utils.parseUnits(amountFloat.toString(), WZION_DECIMALS).toString() : '0';

  return (
    <div className="zion-rainbow-card p-6 space-y-4" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-zion-gold" />
          <h3 className="font-semibold text-white text-sm">{BridgeBurnWidgetCopy.burnWzionZionOnL1[cs ? 'cs' : 'en']}</h3>
        </div>
        <button
          onClick={refreshBalance}
          disabled={isBusy}
          className="rounded-xl border border-white/10 bg-white/5 p-1.5 hover:bg-white/10 disabled:opacity-50 transition-colors"
          title={BridgeBurnWidgetCopy.refreshBalance[cs ? 'cs' : 'en']}
        >
          <RefreshCw className={`h-3 w-3 text-gray-400 ${phase === 'loading-balance' ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Wallet info */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2">
        <div>
          <p className="text-xs text-gray-500">{BridgeBurnWidgetCopy.connectedWallet[cs ? 'cs' : 'en']}</p>
          <p className="font-mono text-xs text-white">
            {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : '—'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">{BridgeBurnWidgetCopy.wzionBalance[cs ? 'cs' : 'en']}</p>
          <p className="font-mono text-sm font-semibold text-zion-gold">
            {phase === 'loading-balance' ? '…' : balance}
          </p>
        </div>
      </div>

      {/* Amount input */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {BridgeBurnWidgetCopy.amountWzion[cs ? 'cs' : 'en']}
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={BridgeBurnWidgetCopy.eG100[cs ? 'cs' : 'en']}
          disabled={isBusy}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-mono text-sm text-white placeholder:text-gray-600 disabled:opacity-50"
        />
        {amountFloat > 0 && (
          <p className="text-xs text-gray-500">
            = <span className="text-white font-mono">{amountAtomicDisplay}</span> {BridgeBurnWidgetCopy.wei[cs ? 'cs' : 'en']} (×10<sup>18</sup>)
          </p>
        )}
      </div>

      {/* L1 recipient */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {BridgeBurnWidgetCopy.zionL1RecipientAddress[cs ? 'cs' : 'en']}
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
        <div className="flex items-start gap-2 rounded-xl border border-zion-purple/30 bg-zion-purple/10 p-3">
          <AlertCircle className="h-4 w-4 text-zion-purple shrink-0 mt-0.5" />
          <p className="text-xs text-zion-purple wrap-break-word">{error}</p>
        </div>
      )}

      {/* Contract details */}
      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 space-y-1">
        <p className="text-xs text-gray-500">
          {BridgeBurnWidgetCopy.wzionContract[cs ? 'cs' : 'en']}{' '}
          <code className="text-gray-300 font-mono text-[11px]">
            {BRIDGE_CONTRACTS.wzion_address.slice(0, 10)}…{BRIDGE_CONTRACTS.wzion_address.slice(-6)}
          </code>
          {' · '}
          <a
            href={`${BRIDGE_CONTRACTS.explorer_base}${BRIDGE_CONTRACTS.wzion_address}`}
            target="_blank"
            rel="noreferrer"
            className="text-zion-cyan hover:text-zion-cyan inline-flex items-center gap-1"
          >
            BaseScan <ExternalLink className="h-3 w-3" />
          </a>
        </p>
        <p className="text-xs text-gray-500">{BridgeBurnWidgetCopy.network[cs ? 'cs' : 'en']}: Base Mainnet (chain 8453) · 18 {BridgeBurnWidgetCopy.decimals[cs ? 'cs' : 'en']} · {BridgeBurnWidgetCopy.noProtocolFee[cs ? 'cs' : 'en']}</p>
      </div>

      <button
        onClick={burn}
        disabled={isBusy || !amount || !l1Address || amountFloat <= 0}
        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-zion-gold/40 bg-zion-gold/20 px-5 py-3 text-sm font-semibold text-zion-gold hover:bg-zion-gold/30 disabled:opacity-40 transition-colors"
      >
        {isBusy ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            {phase === 'confirming' ? (BridgeBurnWidgetCopy.confirmInMetamask[cs ? 'cs' : 'en']) : phase === 'loading-balance' ? (BridgeBurnWidgetCopy.loading[cs ? 'cs' : 'en']) : (BridgeBurnWidgetCopy.broadcastingTx[cs ? 'cs' : 'en'])}
          </>
        ) : (
          <>
            <Flame className="h-4 w-4" />
            {BridgeBurnWidgetCopy.burn[cs ? 'cs' : 'en']}{amountFloat > 0 ? amountFloat.toFixed(4) : ''} wZION
          </>
        )}
      </button>

      <p className="text-[10px] text-gray-500 leading-relaxed">
        {BridgeBurnWidgetCopy.zionArrivesOnL1Within5MinAfter[cs ? 'cs' : 'en']}
      </p>
    </div>
  );
}
