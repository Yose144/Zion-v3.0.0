'use client';

/**
 * MetaMask wallet panel for the multichain wallet page.
 *
 * Allows a ZIS user to:
 *  - Link their MetaMask EVM address to their ZIS account.
 *  - Deposit ERC-20 tokens (wZION, USDT, USDC, WETH) from MetaMask into their
 *    ZIS multichain Base deposit address.
 *  - Withdraw multichain ledger tokens to the linked MetaMask address.
 */

import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { Wallet, ArrowDownLeft, ArrowUpRight, Link2, Loader2, Copy, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { ethers } from 'ethers';
import { useAuth } from '@/contexts/AuthContext';
import { useMultichainWallet } from '@/contexts/MultichainWalletContext';
import { getChallenge, linkAddress } from '@/lib/zis';
import { deriveMultichainAddress, requestMultichainWithdraw } from '@/lib/multichain-api';
import { getEthereumProvider, requestAccount, ensureBaseNetwork, sendErc20Token, sendNativeEth, baseTokenContract } from '@/lib/metamask';
import { CONTRACTS } from '@/lib/defi-contracts';
import { TOKENS_BY_CHAIN } from '@/components/dex/TokenSelector';
import TokenIcon from '@/components/dex/TokenIcon';

const BASE_TOKENS = TOKENS_BY_CHAIN['base'] ?? [];
const NATIVE_SYMBOLS = new Set(['ETH']);

interface Props {
  showTitle?: boolean;
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error';
}

function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

function humanToAtomic(amountHuman: string, decimals: number): string {
  return ethers.utils.parseUnits(amountHuman, decimals).toString();
}

function buildSiweMessage(address: string, nonce: string): string {
  const issuedAt = new Date().toISOString();
  const expirationTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const host = typeof window !== 'undefined' ? window.location.host : 'app.zionterranova.com';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.zionterranova.com';
  return [
    `${host} wants you to sign in with your Ethereum account:`,
    address,
    '',
    'Link your MetaMask wallet to ZION.',
    '',
    `URI: ${origin}/wallet/multichain`,
    'Version: 1',
    'Chain ID: 8453',
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expirationTime}`,
  ].join('\n');
}

export default function MetaMaskWalletPanel({ showTitle = true }: Props) {
  const { user, checkSession } = useAuth();
  const { snapshot, refresh } = useMultichainWallet();

  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositToken, setDepositToken] = useState('wZION');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositSuccess, setDepositSuccess] = useState<string | null>(null);

  const [withdrawToken, setWithdrawToken] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  const linkedEvm = user?.linkedAddresses?.find((la) => la.chainType === 'evm');
  const evmAddress = linkedEvm?.address ?? null;

  // Load the user's Base deposit address on mount.
  useEffect(() => {
    let mounted = true;
    deriveMultichainAddress({ chain: 'base' })
      .then((res) => {
        if (mounted && res?.address) setDepositAddress(res.address);
      })
      .catch(() => {
        // ignore — handled by deposit flow later
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Default withdraw token to first available balance.
  useEffect(() => {
    if (snapshot?.balances && snapshot.balances.length > 0 && !withdrawToken) {
      setWithdrawToken(snapshot.balances[0].asset_key);
    }
  }, [snapshot?.balances, withdrawToken]);

  const handleCopy = async (text: string) => {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleLink = async () => {
    setLinking(true);
    setLinkError(null);
    try {
      const ethereum = getEthereumProvider();
      if (!ethereum) throw new Error('MetaMask not detected');
      const address = await requestAccount(ethereum);
      const { challenge } = await getChallenge(address, 'evm');
      const nonceMatch = challenge.match(/nonce: ([^\n]+)/i);
      const nonce = nonceMatch?.[1];
      if (!nonce) throw new Error('No nonce in challenge');

      const message = buildSiweMessage(address, nonce);
      const signature = (await ethereum.request({
        method: 'personal_sign',
        params: [message, address],
      })) as string;

      await linkAddress({
        address,
        chainType: 'evm',
        chainId: 'base',
        message,
        signature,
      });

      await checkSession();
      await refresh?.();
    } catch (err) {
      setLinkError(formatError(err));
    } finally {
      setLinking(false);
    }
  };

  const handleDeposit = async () => {
    setDepositError(null);
    setDepositSuccess(null);
    if (!depositAmount || Number(depositAmount) <= 0) {
      setDepositError('Enter a positive amount');
      return;
    }

    const ethereum = getEthereumProvider();
    if (!ethereum) {
      setDepositError('MetaMask not detected');
      return;
    }

    let address = depositAddress;
    if (!address) {
      try {
        const res = await deriveMultichainAddress({ chain: 'base' });
        if (!res?.address) throw new Error('Could not derive Base deposit address');
        address = res.address;
        setDepositAddress(address);
      } catch (err) {
        setDepositError(formatError(err));
        return;
      }
    }

    setDepositLoading(true);
    try {
      const account = await requestAccount(ethereum);
      await ensureBaseNetwork(ethereum);

      const token = BASE_TOKENS.find((t) => t.symbol === depositToken);
      if (!token) throw new Error('Unknown token');

      let txHash: string;
      if (token.isNative || NATIVE_SYMBOLS.has(depositToken.toUpperCase())) {
        txHash = await sendNativeEth(ethereum, account, address, depositAmount);
      } else {
        const contract = baseTokenContract(depositToken);
        if (!contract) throw new Error(`No contract for ${depositToken}`);
        txHash = await sendErc20Token(
          ethereum,
          account,
          contract,
          address,
          depositAmount,
          token.decimals,
        );
      }

      setDepositSuccess(`Deposit tx submitted: ${txHash}`);
      setTimeout(() => refresh?.(), 2000);
    } catch (err) {
      setDepositError(formatError(err));
    } finally {
      setDepositLoading(false);
    }
  };

  const handleWithdraw = async () => {
    setWithdrawError(null);
    setWithdrawSuccess(null);
    if (!evmAddress) {
      setWithdrawError('Link MetaMask first');
      return;
    }
    if (!withdrawToken || !withdrawAmount || Number(withdrawAmount) <= 0) {
      setWithdrawError('Select asset and enter amount');
      return;
    }

    const token = getTokenForAssetKey(withdrawToken);
    if (!token) {
      setWithdrawError('Unknown asset decimals');
      return;
    }

    setWithdrawLoading(true);
    try {
      const atomic = humanToAtomic(withdrawAmount, token.decimals);
      const result = await requestMultichainWithdraw({
        asset: withdrawToken,
        amount: atomic,
        recipient: evmAddress,
      });
      if ('error' in result) {
        setWithdrawError(result.error);
      } else {
        setWithdrawSuccess(`Withdrawal requested: ${result.withdrawal_id}`);
        setTimeout(() => refresh?.(), 1000);
      }
    } catch (err) {
      setWithdrawError(formatError(err));
    } finally {
      setWithdrawLoading(false);
    }
  };

  const selectedWithdrawBalance = snapshot?.balances?.find((b) => b.asset_key === withdrawToken);
  const selectedWithdrawToken = withdrawToken ? getTokenForAssetKey(withdrawToken) : null;

  return (
    <div className="zion-rainbow-card p-6" style={{ '--rc': '6, 105, 40' } as CSSProperties}>
      {showTitle && (
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="h-5 w-5 text-zion-cyan" />
          <h2 className="text-lg font-semibold">MetaMask Wallet</h2>
        </div>
      )}

      {evmAddress ? (
        <p className="text-xs text-gray-400 mb-4 font-mono break-all">
          Linked MetaMask: <span className="text-zion-cyan">{evmAddress}</span>
        </p>
      ) : (
        <div className="mb-4">
          <button
            onClick={handleLink}
            disabled={linking}
            className="zion-button-secondary inline-flex items-center gap-2 disabled:opacity-50"
          >
            {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Connect MetaMask
          </button>
          {linkError && <p className="text-xs text-red-400 mt-2">{linkError}</p>}
        </div>
      )}

      {/* Deposit */}
      <div className="space-y-3 mb-6">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <ArrowDownLeft className="h-4 w-4 text-zion-gold" />
          Deposit from MetaMask to ZIS
        </h3>

        {depositAddress ? (
          <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-2">
            <p className="text-[10px] text-gray-500 uppercase">Your Base deposit address</p>
            <div className="flex items-center justify-between gap-3">
              <QRCodeSVG value={depositAddress} size={80} bgColor="transparent" fgColor="#ffffff" level="M" />
              <div className="flex-1 min-w-0 text-right">
                <p className="text-xs font-mono text-gray-300 truncate">{depositAddress}</p>
                <button
                  onClick={() => handleCopy(depositAddress)}
                  className="text-[10px] text-zion-cyan hover:underline inline-flex items-center gap-1 mt-1"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500">Deposit address will be derived on first use.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
            <TokenIcon symbol={depositToken} size={20} />
            <select
              value={depositToken}
              onChange={(e) => setDepositToken(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white focus:outline-none cursor-pointer"
            >
              {BASE_TOKENS.map((t) => (
                <option key={t.symbol} value={t.symbol} className="bg-zinc-900">
                  {t.symbol}
                </option>
              ))}
            </select>
          </div>
          <input
            type="number"
            step="0.000001"
            min="0"
            placeholder="Amount"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white focus:border-zion-gold focus:outline-none"
          />
          <button
            onClick={handleDeposit}
            disabled={depositLoading}
            className="zion-button-primary inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {depositLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownLeft className="h-4 w-4" />}
            Deposit
          </button>
        </div>
        {depositError && <p className="text-xs text-red-400">{depositError}</p>}
        {depositSuccess && <p className="text-xs text-green-400 break-all">{depositSuccess}</p>}
      </div>

      {/* Withdraw */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <ArrowUpRight className="h-4 w-4 text-zion-gold" />
          Withdraw to MetaMask
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
            {withdrawToken && (() => {
              const t = getTokenForAssetKey(withdrawToken);
              return t ? <TokenIcon symbol={t.symbol} size={20} /> : null;
            })()}
            <select
              value={withdrawToken ?? ''}
              onChange={(e) => setWithdrawToken(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white focus:outline-none cursor-pointer"
            >
              <option value="" disabled className="bg-zinc-900">
                Select asset
              </option>
              {snapshot?.balances?.map((b) => (
                <option key={b.asset_key} value={b.asset_key} className="bg-zinc-900">
                  {b.asset_key} — {ethers.utils.formatUnits(b.amount, getTokenForAssetKey(b.asset_key)?.decimals ?? 6)}
                </option>
              ))}
            </select>
          </div>
          <input
            type="number"
            step="0.000001"
            min="0"
            placeholder="Amount"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white focus:border-zion-gold focus:outline-none"
          />
          <button
            onClick={handleWithdraw}
            disabled={withdrawLoading || !evmAddress}
            className="zion-button-primary inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {withdrawLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
            Withdraw
          </button>
        </div>
        {selectedWithdrawBalance && selectedWithdrawToken && (
          <p className="text-xs text-gray-500">
            Available:{' '}
            {ethers.utils.formatUnits(selectedWithdrawBalance.amount, selectedWithdrawToken.decimals)}{' '}
            {selectedWithdrawToken.symbol}
          </p>
        )}
        {withdrawError && <p className="text-xs text-red-400">{withdrawError}</p>}
        {withdrawSuccess && <p className="text-xs text-green-400 break-all">{withdrawSuccess}</p>}
        {!evmAddress && (
          <p className="text-xs text-gray-500">Connect MetaMask above to enable one-click withdrawal.</p>
        )}
      </div>
    </div>
  );
}

function getTokenForAssetKey(assetKey: string): { symbol: string; decimals: number; isNative?: boolean } | null {
  const parts = assetKey.split(':');
  const chain = parts[0] ?? '';
  const symbol = parts[1] ?? '';
  const uiChain = chain.replace(/^zion[-_]l1$/, 'zion');
  const tokens = TOKENS_BY_CHAIN[uiChain];
  if (!tokens) return null;
  return tokens.find((t) => t.symbol === symbol) ?? null;
}
