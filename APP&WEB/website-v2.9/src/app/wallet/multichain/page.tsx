'use client';

import { useState, useCallback, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useLang } from '@/contexts/LanguageContext';
import {
  useMultichainWallet,
  formatMultichainAmount,
} from '@/contexts/MultichainWalletContext';
import {
  Wallet,
  ArrowLeft,
  ArrowRightLeft,
  Download,
  Send,
  RefreshCw,
  Copy,
  Plus,
  Activity,
  Layers,
  Shield,
  Globe2,
} from 'lucide-react';

const CopyText = {
  title: { cs: `Multichain Wallet`, en: `Multichain Wallet` },
  subtitle: { cs: `Spravuj svá multichain aktiva a swapy na jednom místě.`, en: `Manage your multichain assets and swaps in one place.` },
  back: { cs: `Zpět na L1 Wallet`, en: `Back to L1 Wallet` },
  signIn: { cs: `Přihlaste se`, en: `Sign in` },
  signInPrompt: { cs: `Pro zobrazení multichain peněženky se přihlaste.`, en: `Please sign in to view your multichain wallet.` },
  loading: { cs: `Načítám multichain peněženku…`, en: `Loading multichain wallet…` },
  refresh: { cs: `Obnovit`, en: `Refresh` },
  overview: { cs: `Přehled`, en: `Overview` },
  deposits: { cs: `Vklady`, en: `Deposits` },
  withdrawals: { cs: `Výběry`, en: `Withdrawals` },
  orders: { cs: `Objednávky`, en: `Orders` },
  balances: { cs: `Zůstatky`, en: `Balances` },
  addresses: { cs: `Adresy`, en: `Addresses` },
  noBalances: { cs: `Žádné zůstatky`, en: `No balances` },
  noAddresses: { cs: `Žádné adresy — vygenerujte jednu níže.`, en: `No addresses — generate one below.` },
  noDeposits: { cs: `Žádné vklady`, en: `No deposits` },
  noWithdrawals: { cs: `Žádné výběry`, en: `No withdrawals` },
  noOrders: { cs: `Žádné objednávky`, en: `No orders` },
  depositAddress: { cs: `Vkladová adresa`, en: `Deposit address` },
  deriveAddress: { cs: `Vygenerovat adresu`, en: `Generate address` },
  chain: { cs: `Síť`, en: `Chain` },
  asset: { cs: `Asset`, en: `Asset` },
  amount: { cs: `Částka`, en: `Amount` },
  status: { cs: `Stav`, en: `Status` },
  date: { cs: `Datum`, en: `Date` },
  recipient: { cs: `Příjemce`, en: `Recipient` },
  withdraw: { cs: `Vybrat`, en: `Withdraw` },
  newWithdrawal: { cs: `Nový výběr`, en: `New withdrawal` },
  withdrawAsset: { cs: `Asset`, en: `Asset` },
  withdrawAmount: { cs: `Částka (atomické jednotky)`, en: `Amount (atomic units)` },
  withdrawRecipient: { cs: `Adresa příjemce`, en: `Recipient address` },
  submit: { cs: `Odeslat`, en: `Submit` },
  submitting: { cs: `Odesílám…`, en: `Submitting…` },
  cancel: { cs: `Zrušit`, en: `Cancel` },
  copied: { cs: `Zkopírováno`, en: `Copied` },
  txHash: { cs: `TX hash`, en: `TX hash` },
  deriveSuccess: { cs: `Adresa vygenerována`, en: `Address generated` },
  error: { cs: `Chyba`, en: `Error` },
};

type Tab = 'overview' | 'deposits' | 'withdrawals' | 'orders';

const TABS: { key: Tab; labelCs: string; labelEn: string; icon: typeof Activity }[] = [
  { key: 'overview', labelCs: 'Přehled', labelEn: 'Overview', icon: Shield },
  { key: 'deposits', labelCs: 'Vklady', labelEn: 'Deposits', icon: Download },
  { key: 'withdrawals', labelCs: 'Výběry', labelEn: 'Withdrawals', icon: Send },
  { key: 'orders', labelCs: 'Objednávky', labelEn: 'Orders', icon: ArrowRightLeft },
];

function StatCard({
  icon,
  colorClass,
  bgClass,
  label,
  value,
  rc = '252, 209, 22',
}: {
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  label: string;
  value: string;
  rc?: string;
}) {
  return (
    <div className="zion-rainbow-sub p-4 transition-colors" style={{ '--rc': rc } as CSSProperties}>
      <div className={`flex items-center justify-center h-8 w-8 rounded-xl ${bgClass} mb-3 ${colorClass} [&>svg]:h-4 [&>svg]:w-4`}>
        {icon}
      </div>
      <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-white font-mono mt-0.5">{value}</p>
    </div>
  );
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function MultichainWalletPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const { authenticated } = useAuth();
  const {
    snapshot,
    loading,
    error,
    refreshing,
    refresh,
    withdraw,
    deriveAddress,
  } = useMultichainWallet();

  const [tab, setTab] = useState<Tab>('overview');
  const [copied, setCopied] = useState<string | null>(null);
  const [deriveChain, setDeriveChain] = useState('zion');
  const [deriveLoading, setDeriveLoading] = useState(false);
  const [deriveMessage, setDeriveMessage] = useState<string | null>(null);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAsset, setWithdrawAsset] = useState('zion');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawRecipient, setWithdrawRecipient] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawMessage, setWithdrawMessage] = useState<{ text: string; success: boolean } | null>(null);

  const t = (key: keyof typeof CopyText) => CopyText[key][cs ? 'cs' : 'en'];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(t('copied'));
    setTimeout(() => setCopied(null), 1500);
  };

  const handleDerive = async () => {
    setDeriveLoading(true);
    setDeriveMessage(null);
    const result = await deriveAddress(deriveChain, 0, 0);
    setDeriveLoading(false);
    if (result?.address) {
      setDeriveMessage(`${t('deriveSuccess')}: ${result.address}`);
    } else {
      setDeriveMessage(t('error'));
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawAsset || !withdrawAmount || !withdrawRecipient) return;
    setWithdrawLoading(true);
    setWithdrawMessage(null);
    const result = await withdraw({
      asset: withdrawAsset,
      amount: withdrawAmount,
      recipient: withdrawRecipient,
    });
    setWithdrawLoading(false);
    if (result.error) {
      setWithdrawMessage({ text: result.error, success: false });
    } else if (result.withdrawal_id) {
      setWithdrawMessage({ text: `${t('withdraw')} ID: ${result.withdrawal_id}`, success: true });
      setShowWithdraw(false);
      setWithdrawAmount('');
      setWithdrawRecipient('');
    }
  };

  const balances = snapshot?.balances ?? [];
  const addresses = snapshot?.addresses ?? [];
  const deposits = snapshot?.deposits ?? [];
  const withdrawals = snapshot?.withdrawals ?? [];
  const orders = snapshot?.orders ?? [];

  if (!authenticated) {
    return (
      <div className="zion-page text-white">
        <div className="zion-container max-w-7xl">
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center max-w-lg">
              <Wallet className="w-12 h-12 mx-auto mb-4 text-zion-gold" />
              <h1 className="text-2xl font-semibold text-gradient mb-3">{t('title')}</h1>
              <p className="text-gray-400 mb-6">{t('signInPrompt')}</p>
              <Link href="/account" className="zion-button-primary inline-flex items-center gap-2">
                {t('signIn')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="zion-page text-white">
        <div className="zion-container max-w-7xl">
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 mx-auto mb-4 text-zion-gold animate-spin" />
              <p className="text-zinc-400">{t('loading')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="zion-page text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-36 -right-28 h-[520px] w-[520px] rounded-full bg-zion-purple/18 blur-3xl" />
        <div className="absolute top-40 -left-24 h-[420px] w-[420px] rounded-full bg-zion-cyan/14 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-[420px] w-[620px] rounded-full bg-zion-gold/10 blur-3xl" />
      </div>

      <div className="zion-container relative z-10 max-w-7xl space-y-8">
        <section>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="zion-rainbow-card p-6 md:p-10"
            style={{ '--rc': '147, 51, 234' } as CSSProperties}
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4">
                <Link href="/wallet" className="inline-flex items-center gap-2 text-sm text-zion-cyan hover:underline">
                  <ArrowLeft className="h-4 w-4" />
                  {t('back')}
                </Link>
                <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/40 bg-zion-gold/10 px-4 py-1 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
                  <Globe2 className="h-4 w-4" />
                  {t('title')}
                </div>
                <h1 className="text-3xl sm:text-5xl font-semibold text-gradient leading-tight">
                  {t('title')}
                </h1>
                <p className="text-lg text-gray-300 max-w-2xl">
                  {t('subtitle')}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => refresh()}
                  disabled={refreshing}
                  className="zion-button-secondary inline-flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {t('refresh')}
                </button>
                <button
                  onClick={() => setShowWithdraw(!showWithdraw)}
                  className="zion-button-primary inline-flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  {t('newWithdrawal')}
                </button>
              </div>
            </div>
          </motion.div>
        </section>

        {showWithdraw && (
          <section className="zion-rainbow-card p-6" style={{ '--rc': '228, 30, 43' } as CSSProperties}>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Send className="h-5 w-5 text-red-400" />
              {t('newWithdrawal')}
            </h2>
            <form onSubmit={handleWithdraw} className="grid gap-4 md:grid-cols-4 items-end">
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t('withdrawAsset')}</label>
                <input
                  type="text"
                  value={withdrawAsset}
                  onChange={(e) => setWithdrawAsset(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white focus:border-zion-gold focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t('withdrawAmount')}</label>
                <input
                  type="text"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white focus:border-zion-gold focus:outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-400 mb-1">{t('withdrawRecipient')}</label>
                <input
                  type="text"
                  value={withdrawRecipient}
                  onChange={(e) => setWithdrawRecipient(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm text-white focus:border-zion-gold focus:outline-none"
                />
              </div>
              <div className="md:col-span-4 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={withdrawLoading}
                  className="zion-button-primary inline-flex items-center gap-2"
                >
                  {withdrawLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {withdrawLoading ? t('submitting') : t('submit')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowWithdraw(false)}
                  className="zion-button-secondary"
                >
                  {t('cancel')}
                </button>
              </div>
            </form>
            {withdrawMessage && (
              <p className={`mt-3 text-sm ${withdrawMessage.success ? 'text-emerald-400' : 'text-red-400'}`}>
                {withdrawMessage.text}
              </p>
            )}
          </section>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            icon={<Layers className="h-4 w-4" />}
            colorClass="text-zion-gold"
            bgClass="bg-zion-gold/10"
            label={t('addresses')}
            value={String(addresses.length)}
            rc="252, 209, 22"
          />
          <StatCard
            icon={<Shield className="h-4 w-4" />}
            colorClass="text-zion-cyan"
            bgClass="bg-zion-cyan/10"
            label={t('balances')}
            value={String(balances.length)}
            rc="6, 182, 212"
          />
          <StatCard
            icon={<Download className="h-4 w-4" />}
            colorClass="text-emerald-400"
            bgClass="bg-emerald-500/10"
            label={t('deposits')}
            value={String(deposits.length)}
            rc="16, 185, 129"
          />
          <StatCard
            icon={<Send className="h-4 w-4" />}
            colorClass="text-zion-purple"
            bgClass="bg-zion-purple/10"
            label={t('withdrawals')}
            value={String(withdrawals.length)}
            rc="147, 51, 234"
          />
        </div>

        <section className="zion-rainbow-card p-6" style={{ '--rc': '6, 182, 212' } as CSSProperties}>
          <div className="flex items-center gap-2 overflow-x-auto pb-3 border-b border-white/5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  tab === t.key
                    ? 'bg-zion-cyan/20 text-zion-cyan border border-zion-cyan/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <t.icon className="h-4 w-4" />
                {cs ? t.labelCs : t.labelEn}
              </button>
            ))}
          </div>

          <div className="mt-6 min-h-[200px]">
            {tab === 'overview' && (
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-zion-cyan" />
                    {t('balances')}
                  </h3>
                  {balances.length === 0 ? (
                    <p className="text-gray-500">{t('noBalances')}</p>
                  ) : (
                    <ul className="space-y-2">
                      {balances.map((b, i) => (
                        <li key={i} className="zion-rainbow-sub p-3 flex items-center justify-between">
                          <span className="font-mono text-sm text-zion-gold">{b.asset_key}</span>
                          <span className="font-mono text-white">{formatMultichainAmount(b.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Layers className="h-5 w-5 text-zion-gold" />
                      {t('addresses')}
                    </h3>
                    <div className="flex items-center gap-2">
                      <select
                        value={deriveChain}
                        onChange={(e) => setDeriveChain(e.target.value)}
                        className="rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-sm text-white"
                      >
                        <option value="zion">zion</option>
                        <option value="bitcoin">bitcoin</option>
                        <option value="evm">evm</option>
                        <option value="solana">solana</option>
                        <option value="cosmos">cosmos</option>
                        <option value="aptos">aptos</option>
                        <option value="sui">sui</option>
                        <option value="cardano">cardano</option>
                        <option value="near">near</option>
                        <option value="stellar">stellar</option>
                      </select>
                      <button
                        onClick={handleDerive}
                        disabled={deriveLoading}
                        className="zion-button-secondary inline-flex items-center gap-1 text-xs"
                      >
                        <Plus className="h-3 w-3" />
                        {t('deriveAddress')}
                      </button>
                    </div>
                  </div>
                  {deriveMessage && (
                    <p className="text-xs text-emerald-400 mb-3 break-all">{deriveMessage}</p>
                  )}
                  {addresses.length === 0 ? (
                    <p className="text-gray-500">{t('noAddresses')}</p>
                  ) : (
                    <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {addresses.map((a, i) => (
                        <li key={i} className="zion-rainbow-sub p-3">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs uppercase tracking-wider text-gray-500">{a.chain}</span>
                            <span className="text-[10px] rounded-full bg-white/10 px-2 py-0.5 text-gray-300">{a.purpose}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="font-mono text-sm text-white break-all flex-1">{a.address.encoded}</p>
                            <button onClick={() => handleCopy(a.address.encoded)} className="text-zion-gold hover:text-white">
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {copied && <p className="text-xs text-zion-gold mt-2">{copied}</p>}
                </div>
              </div>
            )}

            {tab === 'deposits' && (
              <>
                <h3 className="text-lg font-semibold mb-4">{t('deposits')}</h3>
                {deposits.length === 0 ? (
                  <p className="text-gray-500">{t('noDeposits')}</p>
                ) : (
                  <ul className="space-y-2">
                    {deposits.map((d) => (
                      <li key={d.id} className="zion-rainbow-sub p-3">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div>
                            <p className="text-sm text-white">{d.asset_key}: {formatMultichainAmount(d.amount)}</p>
                            <p className="text-xs text-gray-500">{t('chain')}: {d.chain} · {t('status')}: {d.status}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">{formatDate(d.created_at)}</p>
                            <p className="text-xs font-mono text-gray-400">{d.tx_hash}</p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {tab === 'withdrawals' && (
              <>
                <h3 className="text-lg font-semibold mb-4">{t('withdrawals')}</h3>
                {withdrawals.length === 0 ? (
                  <p className="text-gray-500">{t('noWithdrawals')}</p>
                ) : (
                  <ul className="space-y-2">
                    {withdrawals.map((w) => (
                      <li key={w.id} className="zion-rainbow-sub p-3">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div>
                            <p className="text-sm text-white">{w.asset_key}: {formatMultichainAmount(w.amount)}</p>
                            <p className="text-xs text-gray-500">{t('recipient')}: <span className="font-mono">{w.recipient_address}</span></p>
                            <p className="text-xs text-gray-500">{t('status')}: {w.status}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">{formatDate(w.created_at)}</p>
                            {w.tx_hash && <p className="text-xs font-mono text-gray-400">{w.tx_hash}</p>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {tab === 'orders' && (
              <>
                <h3 className="text-lg font-semibold mb-4">{t('orders')}</h3>
                {orders.length === 0 ? (
                  <p className="text-gray-500">{t('noOrders')}</p>
                ) : (
                  <ul className="space-y-2">
                    {orders.map((o) => (
                      <li key={o.id} className="zion-rainbow-sub p-3">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div>
                            <p className="text-sm text-white">
                              {o.from_asset_key} → {o.to_asset_key}
                            </p>
                            <p className="text-xs text-gray-500">
                              {t('amount')}: {formatMultichainAmount(o.amount_in)} → {formatMultichainAmount(o.amount_out)} ({t('status')}: {o.status})
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">{formatDate(o.created_at)}</p>
                            {o.tx_hash && <p className="text-xs font-mono text-gray-400">{t('txHash')}: {o.tx_hash}</p>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-400 border-t border-white/5 pt-3">
              {t('error')}: {error}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
