'use client';

/**
 * WarpBtcSwapWidget — native WARP atomic swap UI (BTC ↔ ZION L1).
 *
 * Talks to /api/swap/btc/* → /v1/multichain/swaps/btc/* on the multichain
 * daemon. While the flow is operator-disabled the widget degrades to an
 * honest status panel instead of hiding the section.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftRight,
  Zap,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Shield,
  RefreshCw,
  ExternalLink,
  KeyRound,
  ChevronDown,
  HelpCircle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha2.js';
import { useLang } from '@/contexts/LanguageContext';
import {
  getBtcSwapList,
  getBtcSwapMetrics,
  requestBtcQuote,
  submitBtcOffer,
  type BtcSwapDirection,
  type BtcSwapMetrics,
  type BtcSwapQuote,
  type BtcSwapRecord,
} from '@/lib/warp-btc-api';
import { submitClaim } from '@/lib/swap-api';
import { generateZionKeypair, bytesToHex, type ZionKeypair } from '@/lib/swap-helpers';

const Copy_map = {
  warpBtcZionAtomicSwap: { cs: `WARP BTC/ZION Atomic Swap`, en: `WARP BTC/ZION Atomic Swap` },
  trustlessHtlcSwapBetweenBitcoin: { cs: `Trustless HTLC swap mezi Bitcoinem a ZION L1 — bez custodiana, bez prostředníka. Buď proběhne celý, nebo se prostředky vrátí.`, en: `Trustless HTLC swap between Bitcoin and ZION L1 — no custodian, no middleman. Either completes fully or refunds both sides.` },
  pilotPending: { cs: `Pilot se připravuje`, en: `Pilot pending` },
  live: { cs: `Live`, en: `Live` },
  offline: { cs: `API nedostupné`, en: `API offline` },
  warpIsCurrentlyDisabled: { cs: `WARP swap je momentálně vypnutý — probíhá příprava capped pilotu. Stav můžete sledovat níže.`, en: `WARP swap is currently disabled — a capped pilot is being prepared. You can watch the status below.` },
  direction: { cs: `Směr`, en: `Direction` },
  btcToZion: { cs: `BTC → ZION`, en: `BTC → ZION` },
  zionToBtc: { cs: `ZION → BTC`, en: `ZION → BTC` },
  amountSats: { cs: `Částka (sats)`, en: `Amount (sats)` },
  getQuote: { cs: `Získat nabídku`, en: `Get quote` },
  youReceive: { cs: `Dostanete`, en: `You receive` },
  expiresIn: { cs: `Nabídka vyprší za`, en: `Quote expires in` },
  startSwap: { cs: `Zahájit swap`, en: `Start swap` },
  startingSwap: { cs: `Vytvářím swap…`, en: `Creating swap…` },
  sendBtcToThisAddress: { cs: `Pošlete BTC na tuto HTLC adresu`, en: `Send BTC to this HTLC address` },
  yourSwaps: { cs: `Vaše swapy`, en: `Your swaps` },
  claimZion: { cs: `Vyzvednout ZION`, en: `Claim ZION` },
  claiming: { cs: `Claimuji…`, en: `Claiming…` },
  waitingForYourBtcLock: { cs: `Čeká na váš BTC lock`, en: `Waiting for your BTC lock` },
  bothLegsLocked: { cs: `Oba legy zamčeny — můžete claimnout`, en: `Both legs locked — you can claim` },
  settled: { cs: `Settled`, en: `Settled` },
  refunded: { cs: `Refunded`, en: `Refunded` },
  failed: { cs: `Failed`, en: `Failed` },
  saveTheseSecrets: { cs: `Uložte si tato tajemství — bez nich swap nedokončíte`, en: `Save these secrets — you cannot finish the swap without them` },
  preimage: { cs: `Preimage (tajemství pro claim)`, en: `Preimage (claim secret)` },
  zionSecret: { cs: `ZION klíč (claim wallet)`, en: `ZION key (claim wallet)` },
  btcRefundKey: { cs: `BTC klíč (refund cesta)`, en: `BTC key (refund path)` },
  secretsStoredInBrowser: { cs: `Tajemství jsou uložená v tomto prohlížeči (localStorage). Nečištěte data prohlížeče do dokončení swapu.`, en: `Secrets are stored in this browser (localStorage). Do not clear browser data until the swap completes.` },
  advancedZionToBtc: { cs: `ZION → BTC vyžaduje, abyste nejdřív zamkli ZION přes L1 HTLC a BTC si claimli vlastní BTC peněženkou — pokročilý flow.`, en: `ZION → BTC requires locking ZION via an L1 HTLC first and claiming BTC with your own BTC wallet — advanced flow.` },
  zionLockTxid: { cs: `TXID vašeho ZION locku`, en: `Your ZION lock txid` },
  status: { cs: `Stav`, en: `Status` },
  activeSwaps: { cs: `Aktivní swapy`, en: `Active swaps` },
  totalSwaps: { cs: `Swapy celkem`, en: `Total swaps` },
  nearDeadline: { cs: `Blízko deadline`, en: `Near deadline` },
  refresh: { cs: `Obnovit`, en: `Refresh` },
  howItWorks: { cs: `Jak to funguje`, en: `How it works` },
  step1: { cs: `Vygenerujete tajemství a pošlete BTC na HTLC adresu`, en: `You generate a secret and send BTC to an HTLC address` },
  step2: { cs: `Operátor proti-zamkne ZION na vaši adresu`, en: `Operator counter-locks ZION to your address` },
  step3: { cs: `Vy claimnete ZION odhalením tajemství → operátor si vezme BTC`, en: `You claim ZION by revealing the secret → operator takes the BTC` },
  step4: { cs: `Pokud něco selže, po timeoutu se vše vrátí`, en: `If anything fails, everything refunds after the timeout` },
  quoteExpired: { cs: `Nabídka vypršela — vyžádejte novou`, en: `Quote expired — request a new one` },
  satsTooLow: { cs: `Min. 10 000 sats`, en: `Min. 10,000 sats` },
  faq: { cs: `Časté otázky`, en: `FAQ` },
  qWhatIsWarp: { cs: `Co je WARP BTC/ZION swap?`, en: `What is the WARP BTC/ZION swap?` },
  aWhatIsWarp: { cs: `Atomický swap mezi Bitcoinem a ZION L1 postavený na HTLC (Hash Time-Locked Contract). Žádný custodian ani prostředník — směna buď proběhne celá, nebo se prostředky po timeoutu vrátí oběma stranám.`, en: `An atomic swap between Bitcoin and ZION L1 built on HTLCs (Hash Time-Locked Contracts). No custodian, no middleman — either the swap completes fully or both sides get refunded after the timeout.` },
  qHowLong: { cs: `Jak dlouho swap trvá?`, en: `How long does a swap take?` },
  aHowLong: { cs: `Váš BTC lock potřebuje 3 konfirmace (~30 min). Operátor pak okamžitě zamkne ZION a vy ho claimnete odhalením tajemství — celkem řádově pod hodinu.`, en: `Your BTC lock needs 3 confirmations (~30 min). The operator then counter-locks ZION and you claim it by revealing the secret — roughly under an hour total.` },
  qLimits: { cs: `Jaké jsou limity?`, en: `What are the limits?` },
  aLimits: { cs: `Pilot běží s nízkými stropy: 10 000–100 000 sats na swap a max. 4 aktivní swapy současně. Kurz je fixní podle serverem podepsané nabídky.`, en: `The pilot runs with low caps: 10,000–100,000 sats per swap, max 4 active swaps at once. The rate is fixed by a server-signed quote.` },
  qSafe: { cs: `Je to bezpečné?`, en: `Is it safe?` },
  aSafe: { cs: `Swap chrání SHA-256 hashlock + časový zámek (CLTV). Kurz nemůžete přepsat — nabídka je podepsaná operátorem a vázaná na přesné částky. Kód prošel regtest E2E všemi směry včetně refundů.`, en: `The swap is protected by a SHA-256 hashlock and a timelock (CLTV). The rate can't be tampered with — quotes are operator-signed and bound to exact amounts. The code passed regtest E2E in both directions including refunds.` },
  qLostSecret: { cs: `Co když ztratím tajemství nebo zavřu prohlížeč?`, en: `What if I lose the secret or close the browser?` },
  aLostSecret: { cs: `Tajemství (preimage + klíče) se ukládají do localStorage tohoto prohlížeče — nečištěte data do dokončení swapu. Pokud tajemství ztratíte, nedokončíte claim, ale po vypršení timelocku se vám BTC vrátí. Nikdy nemůžete přijít o obě strany.`, en: `Secrets (preimage + keys) are stored in this browser's localStorage — don't clear browser data until the swap completes. If you lose the secret you can't claim, but your BTC refunds after the timelock expires. You can never lose both sides.` },
  qDisabled: { cs: `Proč je swap teď vypnutý?`, en: `Why is the swap disabled right now?` },
  aDisabled: { cs: `Probíhá příprava capped pilotu — provisioned konfigurace, audit a operační kontroly. Sekce už ukazuje živý stav; jakmile pilot startuje, formulář se aktivuje sám.`, en: `A capped pilot is being prepared — provisioned config, audit, and operational checks. This section already shows live status; once the pilot starts, the form activates automatically.` },
  qWallet: { cs: `Co potřebuju?`, en: `What do I need?` },
  aWallet: { cs: `Pro BTC → ZION stačí BTC peněženka na odeslání depositu — ZION claim adresu vám vygenerujeme dočasně (klíč si uložte). Pro ZION → BTC potřebujete L1 HTLC lock (viz /swap fallback) a vlastní BTC peněženku pro claim.`, en: `For BTC → ZION you only need a BTC wallet for the deposit — we generate a temporary ZION claim address (save the key). For ZION → BTC you need an L1 HTLC lock (see the /swap fallback) and your own BTC wallet to claim.` },
};

type FlowState = 'idle' | 'quoting' | 'quoted' | 'creating' | 'created';

interface SwapSecrets {
  preimageHex: string;
  zion: ZionKeypair;
  btcPrivHex: string;
  direction: BtcSwapDirection;
}

const VAULT_KEY = 'warp-btc-vault-v1';

function loadVault(): Record<string, SwapSecrets> {
  try {
    return JSON.parse(localStorage.getItem(VAULT_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveVault(v: Record<string, SwapSecrets>) {
  localStorage.setItem(VAULT_KEY, JSON.stringify(v));
}

function normPhase(phase: unknown): string {
  if (phase && typeof phase === 'object' && 'Failed' in (phase as object)) return 'failed';
  const s = String(phase || '');
  return s.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}

function phaseLabel(phase: string, cs: boolean): { text: string; cls: string } {
  switch (phase) {
    case 'awaiting_user_lock':
      return { text: cs ? 'Čeká na BTC lock' : 'Awaiting BTC lock', cls: 'text-amber-400 border-amber-500/30 bg-amber-500/10' };
    case 'locked':
      return { text: cs ? 'Zamčeno — claim možný' : 'Locked — claimable', cls: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' };
    case 'settled':
      return { text: 'Settled', cls: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' };
    case 'refunded':
      return { text: 'Refunded', cls: 'text-zinc-400 border-zinc-500/30 bg-zinc-500/10' };
    case 'failed':
      return { text: 'Failed', cls: 'text-red-400 border-red-500/30 bg-red-500/10' };
    default:
      return { text: phase, cls: 'text-zinc-400 border-zinc-500/30 bg-zinc-500/10' };
  }
}

function fmtSats(sats: number): string {
  return `${sats.toLocaleString()} sats (${(sats / 1e8).toFixed(8)} BTC)`;
}

function fmtZion(flowers: number): string {
  return `${(flowers / 1e6).toLocaleString(undefined, { maximumFractionDigits: 6 })} ZION`;
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 rounded-lg p-1.5 text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function WarpBtcSwapWidget() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const t = (k: keyof typeof Copy_map) => Copy_map[k][cs ? 'cs' : 'en'];

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [swaps, setSwaps] = useState<BtcSwapRecord[]>([]);
  const [metrics, setMetrics] = useState<BtcSwapMetrics | null>(null);
  const [apiOffline, setApiOffline] = useState(false);

  const [direction, setDirection] = useState<BtcSwapDirection>('btc_to_zion');
  const [sats, setSats] = useState('10000');
  const [quote, setQuote] = useState<BtcSwapQuote | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [flow, setFlow] = useState<FlowState>('idle');
  const [created, setCreated] = useState<BtcSwapRecord | null>(null);
  const [secrets, setSecrets] = useState<SwapSecrets | null>(null);
  const [zionLockTxid, setZionLockTxid] = useState('');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const [list, m] = await Promise.all([getBtcSwapList(), getBtcSwapMetrics()]);
    if (!list && !m) {
      setApiOffline(true);
      setEnabled(null);
      return;
    }
    setApiOffline(false);
    setEnabled(list?.enabled ?? m?.enabled ?? false);
    setSwaps(list?.swaps ?? []);
    setMetrics(m ?? null);
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 30_000);
    const tick = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => { clearInterval(iv); clearInterval(tick); };
  }, [refresh]);

  const vault = useMemo(() => (typeof window === 'undefined' ? {} : loadVault()), [created]);
  const mySwaps = useMemo(
    () => swaps.filter((s) => vault[s.swap_id]),
    [swaps, vault],
  );

  const quoteSecsLeft = quote ? Math.max(0, quote.expires_at - now) : 0;

  async function handleQuote() {
    const s = parseInt(sats, 10);
    if (!Number.isFinite(s) || s < 10_000) {
      setQuoteErr(t('satsTooLow'));
      return;
    }
    setFlow('quoting');
    setQuoteErr(null);
    setQuote(null);
    const r = await requestBtcQuote(direction, s);
    if (!r.ok || !r.quote) {
      setQuoteErr(r.error || 'Quote failed');
      setFlow('idle');
      return;
    }
    setQuote(r.quote);
    setFlow('quoted');
  }

  async function handleCreate() {
    if (!quote) return;
    setFlow('creating');
    setQuoteErr(null);
    try {
      const preimage = crypto.getRandomValues(new Uint8Array(32));
      const hashHex = bytesToHex(sha256(preimage));
      const zion = await generateZionKeypair();
      const btcPriv = secp256k1.utils.randomPrivateKey();
      const btcPub = secp256k1.getPublicKey(btcPriv, true);
      const zionTimeoutTs = Math.floor(Date.now() / 1000) + 24 * 3600;
      const r = await submitBtcOffer({
        direction,
        hashHex,
        btcSats: quote.btc_sats,
        zionFlowers: quote.zion_flowers,
        userBtcPubkeyHex: bytesToHex(btcPub),
        userZionPubkeyHex: zion.publicKeyHex,
        userZionAddress: zion.address,
        zionTimeoutTs,
        quote,
        userZionLockTxid: direction === 'zion_to_btc' ? zionLockTxid : undefined,
      });
      if (!r.ok || !r.record) {
        setQuoteErr(r.error || 'Offer failed');
        setFlow('quoted');
        return;
      }
      const sec: SwapSecrets = {
        preimageHex: bytesToHex(preimage),
        zion,
        btcPrivHex: bytesToHex(btcPriv),
        direction,
      };
      const v = loadVault();
      v[r.record.swap_id] = sec;
      saveVault(v);
      setCreated(r.record);
      setSecrets(sec);
      setFlow('created');
      refresh();
    } catch (e: any) {
      setQuoteErr(e?.message || 'Offer failed');
      setFlow('quoted');
    }
  }

  async function handleClaim(rec: BtcSwapRecord) {
    const sec = vault[rec.swap_id];
    if (!sec) return;
    setClaimingId(rec.swap_id);
    const r = await submitClaim({
      hashHex: rec.hashlock,
      preimageHex: sec.preimageHex,
      recipient: rec.user_zion_address || sec.zion.address,
    });
    setClaimingId(null);
    if (!r.success) setQuoteErr(r.message);
    refresh();
  }

  return (
    <div className="space-y-5">
      {/* ── Header / status ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zion-gold/10 border border-zion-gold/25">
            <Zap className="h-5 w-5 text-zion-gold" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{t('warpBtcZionAtomicSwap')}</h3>
            <p className="text-[11px] text-zinc-500">{t('trustlessHtlcSwapBetweenBitcoin')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} title={t('refresh')} className="rounded-lg p-1.5 text-zinc-500 hover:text-white hover:bg-white/5 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${
            apiOffline
              ? 'border-red-500/30 bg-red-500/10 text-red-400'
              : enabled
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${apiOffline ? 'bg-red-400' : enabled ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {apiOffline ? t('offline') : enabled ? t('live') : t('pilotPending')}
          </span>
        </div>
      </div>

      {/* ── Disabled banner ─────────────────────────────────────────── */}
      {enabled === false && (
        <div className="flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <Shield className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
          <p className="text-xs leading-relaxed text-zinc-300">{t('warpIsCurrentlyDisabled')}</p>
        </div>
      )}

      {/* ── Metrics strip ───────────────────────────────────────────── */}
      {metrics?.enabled && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: t('totalSwaps'), value: metrics.total ?? 0 },
            { label: t('activeSwaps'), value: metrics.active ?? 0 },
            { label: t('nearDeadline'), value: metrics.swaps_near_deadline ?? 0 },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-center">
              <div className="text-lg font-semibold text-white">{s.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Quote / offer form (enabled only) ───────────────────────── */}
      {enabled === true && flow !== 'created' && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
          {/* Direction */}
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-zinc-500">{t('direction')}</label>
            <div className="grid grid-cols-2 gap-2">
              {(['btc_to_zion', 'zion_to_btc'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => { setDirection(d); setQuote(null); setFlow('idle'); }}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                    direction === d
                      ? 'border-zion-gold/40 bg-zion-gold/10 text-zion-gold'
                      : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:text-white'
                  }`}
                >
                  {d === 'btc_to_zion' ? t('btcToZion') : t('zionToBtc')}
                </button>
              ))}
            </div>
          </div>

          {direction === 'zion_to_btc' && (
            <div className="space-y-2">
              <div className="flex gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                <AlertCircle className="h-4 w-4 shrink-0 text-cyan-400 mt-0.5" />
                <p className="text-[11px] leading-relaxed text-zinc-300">{t('advancedZionToBtc')}</p>
              </div>
              <input
                value={zionLockTxid}
                onChange={(e) => setZionLockTxid(e.target.value.trim())}
                placeholder={t('zionLockTxid')}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-zion-gold/40 font-mono"
              />
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-wider text-zinc-500">{t('amountSats')}</label>
            <input
              value={sats}
              onChange={(e) => { setSats(e.target.value.replace(/\D/g, '')); setQuote(null); setFlow('idle'); }}
              inputMode="numeric"
              placeholder="10000"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-zion-gold/40 font-mono"
            />
          </div>

          {quoteErr && (
            <div className="flex gap-2 rounded-lg border border-red-500/25 bg-red-500/5 p-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <p className="text-[11px] text-red-300">{quoteErr}</p>
            </div>
          )}

          {/* Quote result */}
          {quote && flow !== 'creating' && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-zion-gold/25 bg-zion-gold/5 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">{fmtSats(quote.btc_sats)}</span>
                <ArrowLeftRight className="h-3.5 w-3.5 text-zinc-500" />
                <span className="font-semibold text-zion-gold">{fmtZion(quote.zion_flowers)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-500">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{t('expiresIn')} {Math.floor(quoteSecsLeft / 60)}:{String(quoteSecsLeft % 60).padStart(2, '0')}</span>
                <span className="font-mono">#{quote.quote_id.slice(0, 8)}</span>
              </div>
              {quoteSecsLeft === 0 && <p className="text-[11px] text-amber-400">{t('quoteExpired')}</p>}
            </motion.div>
          )}

          {/* Actions */}
          {(!quote || flow === 'idle' || flow === 'quoting') && (
            <button
              onClick={handleQuote}
              disabled={flow === 'quoting' || (direction === 'zion_to_btc' && !zionLockTxid)}
              className="w-full rounded-xl bg-zion-gold/15 border border-zion-gold/30 px-4 py-3 text-sm font-semibold text-zion-gold hover:bg-zion-gold/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {flow === 'quoting' && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('getQuote')}
            </button>
          )}
          {quote && flow === 'quoted' && (
            <button
              onClick={handleCreate}
              disabled={quoteSecsLeft === 0}
              className="w-full rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-4 py-3 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {t('startSwap')}
            </button>
          )}
          {flow === 'creating' && (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('startingSwap')}
            </div>
          )}
        </div>
      )}

      {/* ── Created swap — deposit address + secrets ────────────────── */}
      {flow === 'created' && created && secrets && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {created.direction === 'btc_to_zion' && (
            <div className="rounded-xl border border-zion-gold/25 bg-zinc-900/60 p-4 text-center space-y-3">
              <p className="text-xs text-zinc-400">{t('sendBtcToThisAddress')}</p>
              <div className="flex justify-center">
                <div className="rounded-xl bg-white p-2">
                  <QRCodeSVG value={`bitcoin:${created.btc_htlc_address}?amount=${created.btc_sats / 1e8}`} size={140} />
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2">
                <code className="flex-1 truncate font-mono text-xs text-zion-gold">{created.btc_htlc_address}</code>
                <CopyBtn value={created.btc_htlc_address} />
              </div>
              <p className="font-mono text-sm text-white">{fmtSats(created.btc_sats)}</p>
            </div>
          )}

          {/* Secrets — must be saved */}
          <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4 space-y-3">
            <div className="flex gap-2">
              <KeyRound className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-300">{t('saveTheseSecrets')}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{t('secretsStoredInBrowser')}</p>
              </div>
            </div>
            {[
              { label: t('preimage'), value: secrets.preimageHex },
              { label: t('zionSecret'), value: secrets.zion.secretKeyHex },
              { label: t('btcRefundKey'), value: secrets.btcPrivHex },
            ].map((s) => (
              <div key={s.label}>
                <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">{s.label}</p>
                <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/80 px-2.5 py-1.5">
                  <code className="flex-1 truncate font-mono text-[11px] text-zinc-300">{s.value}</code>
                  <CopyBtn value={s.value} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── My swaps list ───────────────────────────────────────────── */}
      {mySwaps.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">{t('yourSwaps')}</p>
          {mySwaps.map((s) => {
            const ph = normPhase(s.phase);
            const lbl = phaseLabel(ph, cs);
            return (
              <div key={s.swap_id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-zinc-400 truncate">{s.swap_id.slice(0, 16)}…</span>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${lbl.cls}`}>{lbl.text}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-zinc-500">
                  <span>{s.direction === 'btc_to_zion' ? 'BTC → ZION' : 'ZION → BTC'}</span>
                  <span>{fmtSats(s.btc_sats)} · {fmtZion(s.zion_flowers)}</span>
                </div>
                {ph === 'locked' && s.direction === 'btc_to_zion' && (
                  <button
                    onClick={() => handleClaim(s)}
                    disabled={claimingId === s.swap_id}
                    className="w-full rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    {claimingId === s.swap_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {claimingId === s.swap_id ? t('claiming') : t('claimZion')}
                  </button>
                )}
                {s.btc_settle_tx && (
                  <a href={`https://mempool.space/tx/${s.btc_settle_tx}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-cyan-400 transition-colors">
                    <ExternalLink className="h-3 w-3" /> BTC tx
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── How it works ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <p className="mb-2.5 text-[10px] uppercase tracking-wider text-zinc-500">{t('howItWorks')}</p>
        <div className="space-y-2">
          {[t('step1'), t('step2'), t('step3'), t('step4')].map((s, i) => (
            <div key={i} className="flex gap-2.5 text-[11px] text-zinc-400">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zion-gold/15 border border-zion-gold/30 text-[9px] font-bold text-zion-gold">{i + 1}</span>
              <span className="leading-relaxed">{s}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── FAQ ─────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
          <HelpCircle className="h-3.5 w-3.5" /> {t('faq')}
        </p>
        {([
          ['qWhatIsWarp', 'aWhatIsWarp'],
          ['qHowLong', 'aHowLong'],
          ['qLimits', 'aLimits'],
          ['qSafe', 'aSafe'],
          ['qLostSecret', 'aLostSecret'],
          ['qWallet', 'aWallet'],
          ['qDisabled', 'aDisabled'],
        ] as const).map(([qk, ak], i) => (
          <div key={qk} className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <button
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-xs font-medium text-zinc-200">{t(qk)}</span>
              <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {openFaq === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <p className="px-4 pb-3.5 text-[11px] leading-relaxed text-zinc-400">{t(ak)}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
