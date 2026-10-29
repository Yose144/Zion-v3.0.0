'use client';

import { Suspense, useCallback, useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  type LucideIcon,
  ArrowRight,
  Boxes,
  Brain,
  Check,
  Copy,
  CreditCard,
  Key,
  Loader2,
  MessageSquare,
  Terminal,
  Wallet,
} from 'lucide-react';
import { erc20Abi, type Hex } from 'viem';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useLang } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

const T = {
  kicker: { cs: 'Inference API', en: 'Inference API' },
  title: { cs: 'Hiranyagarbha API', en: 'Hiranyagarbha API' },
  subtitle: {
    cs: 'OpenAI-kompatibilní inference API hostované v EU. Žádný US cloud — data neopouštějí Evropu a nikdy se nepoužívají k trénování.',
    en: 'OpenAI-compatible inference API hosted in the EU. No US cloud — your data never leaves Europe and is never used for training.',
  },
  signIn: {
    cs: 'Pro vytvoření API klíče se nejdřív přihlaste přes ZIS (tlačítko Sign In v navigaci).',
    en: 'Sign in via ZIS first to mint an API key (Sign In button in the navigation).',
  },
  chipEu: { cs: 'Hostováno v EU', en: 'Hosted in the EU' },
  chipOpenAi: { cs: 'OpenAI-kompatibilní', en: 'OpenAI-compatible' },
  chipNoTrain: { cs: 'Nikdy netrénujeme na vašich datech', en: 'Never trained on your data' },
  stepSign: { cs: 'Přihlaste se přes ZIS', en: 'Sign in via ZIS' },
  stepKey: { cs: 'Vytvořte API klíč', en: 'Mint an API key' },
  stepCall: { cs: 'Zavolejte /v1/chat', en: 'Call /v1/chat' },
  perMonth: { cs: '/ měsíc', en: '/ month' },
  getKey: { cs: 'Vytvořit API klíč', en: 'Create API key' },
  subscribe: { cs: 'Stripe karta', en: 'Stripe card' },
  crypto: { cs: 'MetaMask USDC', en: 'MetaMask USDC' },
  keyOnce: {
    cs: 'Váš nový API klíč — zobrazuje se naposledy, uložte si ho.',
    en: 'Your new API key — shown once, store it safely.',
  },
  copied: { cs: 'Zkopírováno', en: 'Copied' },
  docsTitle: { cs: 'Použití (OpenAI-compatible)', en: 'Usage (OpenAI-compatible)' },
  usage: { cs: 'Využití a limity', en: 'Usage & limits' },
  cryptoOk: {
    cs: 'Platba USDC potvrzena — plán aktivován.',
    en: 'USDC payment confirmed — plan activated.',
  },
  modelsTitle: { cs: 'Modely', en: 'Models' },
  modelsSub: {
    cs: 'Live aliasy z gatewaye — mockupy Trinity se zpřístupní po FT.',
    en: 'Live aliases from the gateway — Trinity mockups unlock after FT.',
  },
  badgeMini: { cs: 'mini', en: 'mini' },
  badgeCoder: { cs: 'coder', en: 'coder' },
  available: { cs: 'live', en: 'live' },
  offline: { cs: 'offline', en: 'offline' },
  mockup: { cs: 'mockup', en: 'mockup' },
  ctx: { cs: 'ctx', en: 'ctx' },
  price: { cs: '$/1M tok', en: '$/1M tok' },
  trialTitle: { cs: 'Trial chat', en: 'Trial chat' },
  trialHint: {
    cs: 'Jeden krátký turn na hiran-mini (vyžaduje Sign In). Rate-limit 8/min.',
    en: 'One short turn on hiran-mini (Sign In required). Rate limit 8/min.',
  },
  trialPlaceholder: {
    cs: 'Zeptejte se Hirana…',
    en: 'Ask Hiran…',
  },
  trialSend: { cs: 'Odeslat', en: 'Send' },
  resCliTitle: { cs: 'Schválit Hiran CLI', en: 'Approve Hiran CLI' },
  resCliSub: {
    cs: 'zion hiran login → potvrdit kód',
    en: 'zion hiran login → confirm code',
  },
  plansTitle: { cs: 'Plány', en: 'Plans' },
  plansSub: {
    cs: 'Zrušitelné kdykoliv. Platba kartou přes Stripe nebo USDC na Base.',
    en: 'Cancel anytime. Pay by card via Stripe or USDC on Base.',
  },
  recommended: { cs: 'Doporučený', en: 'Recommended' },
  docsCli: { cs: 'CLI', en: 'CLI' },
  docsApi: { cs: 'HTTP API', en: 'HTTP API' },
  settlement: {
    cs: 'Settlement ZION/L2 = dry-run; platby dnes = Stripe / Base USDC.',
    en: 'ZION/L2 settlement = dry-run; billing today = Stripe / Base USDC.',
  },
  footer: {
    cs: 'Zrušení kdykoliv přes Stripe zákaznický portál. Crypto = Base USDC. Klíč lze revokovat v ZIS.',
    en: 'Cancel anytime via Stripe customer portal. Crypto = Base USDC. Revoke keys in ZIS.',
  },
};

type ModelRow = {
  id: string;
  'x-context'?: number;
  'x-price-1m-usd'?: number;
  'x-role'?: string;
  'x-available'?: boolean;
  'x-mockup'?: boolean;
  'x-degraded'?: boolean;
};

type ModelsPayload = {
  gateway_ok?: boolean;
  badge?: { mini?: string; coder?: string };
  models?: ModelRow[];
  settlement_note?: string;
};

const PLANS: {
  id: 'free' | 'pro' | 'team';
  name: string;
  price: string;
  features: { cs: string[]; en: string[] };
}[] = [
  {
    id: 'free',
    name: 'Free',
    price: '0 €',
    features: {
      cs: ['Model hiran-mini', '20 požadavků/min', '200k tokenů/den', 'Bez karty'],
      en: ['hiran-mini model', '20 requests/min', '200k tokens/day', 'No card required'],
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '19 €',
    features: {
      cs: ['Všechny modely', '120 požadavků/min', '5M tokenů/měs v ceně', 'Pak 0,60 €/1M tokenů'],
      en: ['All models', '120 requests/min', '5M tokens/mo included', 'Then €0.60/1M tokens'],
    },
  },
  {
    id: 'team',
    name: 'Team',
    price: '99 €',
    features: {
      cs: ['5 API klíčů', '25M tokenů/měs', 'Prioritní fronta', 'SLA e-mail podpora'],
      en: ['5 API keys', '25M tokens/mo', 'Priority queue', 'SLA email support'],
    },
  },
];

interface SubscribeResult {
  plan: string;
  apiKey?: string;
  url?: string | null;
  upgraded?: boolean;
}

function SectionHead({
  icon: Icon,
  title,
  sub,
}: {
  icon: LucideIcon;
  title: string;
  sub?: string;
}) {
  return (
    <div className="mt-12 mb-6">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 shrink-0 text-rasta-gold" />
        <h2 className="text-xl font-black font-display text-gradient">{title}</h2>
        <div className="section-line flex-1" />
      </div>
      {sub && <p className="mt-2 text-sm text-gray-400">{sub}</p>}
    </div>
  );
}

function AiPricingInner() {
  const { lang: l } = useLang();
  const { authenticated, loading: authLoading } = useAuth();
  const params = useSearchParams();
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<SubscribeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [cryptoOk, setCryptoOk] = useState(false);
  const [pendingTx, setPendingTx] = useState<Hex | null>(null);
  const [pendingIntent, setPendingIntent] = useState<string | null>(null);
  const [modelsInfo, setModelsInfo] = useState<ModelsPayload | null>(null);
  const [trialPrompt, setTrialPrompt] = useState('');
  const [trialOut, setTrialOut] = useState<string | null>(null);
  const [trialErr, setTrialErr] = useState<string | null>(null);

  const receipt = useWaitForTransactionReceipt({ hash: pendingTx ?? undefined });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/hiran/models', { cache: 'no-store' });
        const body = (await res.json()) as { success?: boolean; data?: ModelsPayload };
        if (!cancelled && body.success && body.data) setModelsInfo(body.data);
      } catch {
        /* badge stays empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runTrial = useCallback(async () => {
    setBusy('trial');
    setTrialErr(null);
    setTrialOut(null);
    try {
      const res = await fetch('/api/hiran/trial-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trialPrompt, model: 'hiran-mini' }),
      });
      const body = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: { content?: string };
      };
      if (!res.ok || !body.success) {
        setTrialErr(body.error || `HTTP ${res.status}`);
      } else {
        setTrialOut(body.data?.content || '(empty)');
      }
    } catch (e) {
      setTrialErr(e instanceof Error ? e.message : 'trial failed');
    } finally {
      setBusy(null);
    }
  }, [trialPrompt]);

  const subscribeStripe = useCallback(async (plan: string) => {
    setBusy(`stripe-${plan}`);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/stripe/hiran-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      const data = json.data as SubscribeResult;
      setResult(data);
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(null);
    }
  }, []);

  const payCrypto = useCallback(
    async (plan: 'pro' | 'team') => {
      setBusy(`crypto-${plan}`);
      setError(null);
      setCryptoOk(false);
      try {
        if (!isConnected || !address) {
          throw new Error(
            l === 'cs'
              ? 'Připojte MetaMask (Connect v navigaci).'
              : 'Connect MetaMask first (Connect in navigation).',
          );
        }
        const res = await fetch('/api/hiran/crypto/intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }
        const data = json.data as {
          intentId: string;
          amount: string;
          token: string;
          to: string;
          apiKey?: string;
        };
        if (data.apiKey) {
          setResult({ plan, apiKey: data.apiKey });
        }
        const hash = await writeContractAsync({
          address: data.token as `0x${string}`,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [data.to as `0x${string}`, BigInt(data.amount)],
        });
        setPendingIntent(data.intentId);
        setPendingTx(hash);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Crypto pay failed');
        setBusy(null);
      }
    },
    [address, isConnected, l, writeContractAsync],
  );

  useEffect(() => {
    if (!receipt.isSuccess || !pendingTx || !pendingIntent) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/hiran/crypto/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intentId: pendingIntent, txHash: pendingTx }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }
        if (!cancelled) {
          setCryptoOk(true);
          setPendingIntent(null);
          setPendingTx(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Confirm failed');
        }
      } finally {
        if (!cancelled) setBusy(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [receipt.isSuccess, pendingTx, pendingIntent]);

  // Deep-link from CLI: /ai?plan=pro&pay=stripe|crypto
  useEffect(() => {
    const plan = params.get('plan');
    const pay = params.get('pay');
    if (!authenticated || !plan) return;
    if (plan !== 'free' && plan !== 'pro' && plan !== 'team') return;
    if (pay === 'crypto' && (plan === 'pro' || plan === 'team')) {
      void payCrypto(plan);
    } else if (pay === 'stripe' || plan === 'free') {
      void subscribeStripe(plan);
    }
    // run once when auth ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  const copyKey = () => {
    if (result?.apiKey) {
      navigator.clipboard.writeText(result.apiKey).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rasta-info-page">
      <section className="rasta-hero" aria-label="Hiranyagarbha">
        <div className="rasta-hero-inner">
          <div className="rasta-hero-kicker">
            <span className="dot" />
            {T.kicker[l]}
          </div>
          <h1 className="rasta-hero-title">{T.title[l]}</h1>
          <p className="rasta-hero-desc mx-auto max-w-2xl">{T.subtitle[l]}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {[T.chipEu[l], T.chipOpenAi[l], T.chipNoTrain[l]].map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-rasta-gold/30 bg-black/50 px-3.5 py-1.5 text-xs font-semibold text-rasta-gold backdrop-blur-sm"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-16">
        <div>
          {!authLoading && !authenticated && (
            <p className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {T.signIn[l]}
            </p>
          )}

          <div className="mb-8 grid gap-3 sm:grid-cols-3">
            {[T.stepSign[l], T.stepKey[l], T.stepCall[l]].map((step, i) => (
              <div key={step} className="zion-tile flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rasta-gold/30 bg-rasta-gold/15 text-sm font-black text-rasta-gold">
                  {i + 1}
                </span>
                <p className="text-sm font-medium text-gray-300">{step}</p>
              </div>
            ))}
          </div>

          <div className="mb-8 rounded-xl border border-rasta-gold/25 bg-black/40 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rasta-gold">
              {l === 'cs' ? 'Instalace CLI' : 'Install the CLI'}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">Zion Hiran</h2>
            <p className="mt-2 text-sm text-gray-400">
              {l === 'cs'
                ? 'Jeden příkaz. Po startu uvidíš strom Genesis a menu (chat, login, účet, modely).'
                : 'One command. On start you get the Genesis tree and a menu (chat, login, account, models).'}
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-black/60 p-3 text-xs text-amber-200">{`curl -fsSL https://market.zionterranova.com/install-hiran.sh | bash
zion-hiran`}</pre>
          </div>

          <div className="grid gap-3">
            <Link
              href="/ai/cli"
              className="zion-tile group flex items-center gap-3 hover:border-rasta-gold/40"
            >
              <Terminal className="w-5 h-5 shrink-0 text-rasta-gold" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white transition-colors group-hover:text-rasta-gold">
                  {T.resCliTitle[l]}
                </p>
                <p className="truncate font-mono text-xs text-gray-500">{T.resCliSub[l]}</p>
              </div>
              <ArrowRight className="ml-auto w-4 h-4 shrink-0 text-gray-600 transition-transform group-hover:translate-x-1 group-hover:text-rasta-gold" />
            </Link>
          </div>

          {modelsInfo?.badge && (
            <div className="mt-6 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-500">gateway</span>
              <span
                className={`rounded-full px-2.5 py-1 font-mono ${
                  modelsInfo.badge.mini === 'live'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-red-500/20 text-red-300'
                }`}
              >
                {T.badgeMini[l]}: {modelsInfo.badge.mini}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 font-mono ${
                  modelsInfo.badge.coder === 'live'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-white/10 text-gray-400'
                }`}
              >
                {T.badgeCoder[l]}: {modelsInfo.badge.coder}
              </span>
            </div>
          )}

          <SectionHead icon={Boxes} title={T.modelsTitle[l]} sub={T.modelsSub[l]} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(modelsInfo?.models ?? []).map((m) => {
              const status = m['x-mockup']
                ? T.mockup[l]
                : m['x-available']
                  ? T.available[l]
                  : T.offline[l];
              const statusClass = m['x-mockup']
                ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                : m['x-available']
                  ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                  : 'border-white/10 bg-white/5 text-gray-500';
              const rc = m['x-mockup']
                ? '252, 209, 22'
                : m['x-available']
                  ? '7, 137, 48'
                  : '148, 163, 184';
              return (
                <div
                  key={m.id}
                  className="zion-rainbow-card p-5"
                  style={{ '--rc': rc } as CSSProperties}
                >
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-sm font-bold text-white">{m.id}</code>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider ${statusClass}`}
                    >
                      {status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    {m['x-role'] || '—'} · {T.ctx[l]} {m['x-context'] ?? '—'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-amber-200/90">
                    {T.price[l]}{' '}
                    {typeof m['x-price-1m-usd'] === 'number'
                      ? m['x-price-1m-usd'].toFixed(2)
                      : '—'}
                  </p>
                </div>
              );
            })}
          </div>

          <SectionHead icon={MessageSquare} title={T.trialTitle[l]} sub={T.trialHint[l]} />
          <div
            className="zion-rainbow-card p-5"
            style={{ '--rc': '252, 209, 22' } as CSSProperties}
          >
            {trialOut && (
              <div className="mb-4 flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rasta-gold/30 bg-rasta-gold/15">
                  <Brain className="w-4 h-4 text-rasta-gold" />
                </div>
                <div className="flex-1 rounded-xl rounded-tl-sm border border-white/10 bg-black/40 p-4 text-sm leading-relaxed text-gray-200 whitespace-pre-wrap">
                  {trialOut}
                </div>
              </div>
            )}
            {trialErr && (
              <p className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {trialErr}
              </p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={trialPrompt}
                onChange={(e) => setTrialPrompt(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder={T.trialPlaceholder[l]}
                className="flex-1 resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-rasta-gold/40 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void runTrial()}
                disabled={!authenticated || busy !== null || !trialPrompt.trim()}
                className="zion-button-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy === 'trial' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  T.trialSend[l]
                )}
              </button>
            </div>
          </div>

          <SectionHead icon={CreditCard} title={T.plansTitle[l]} sub={T.plansSub[l]} />
          <div className="grid gap-5 md:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.id}
                className={`zion-rainbow-card flex flex-col p-6 ${
                  p.id === 'pro'
                    ? 'md:-translate-y-1 shadow-[0_0_60px_-15px_rgba(252,209,22,0.45)]'
                    : ''
                }`}
                style={
                  {
                    '--rc':
                      p.id === 'free'
                        ? '7, 137, 48'
                        : p.id === 'pro'
                          ? '252, 209, 22'
                          : '56, 189, 248',
                  } as CSSProperties
                }
              >
                {p.id === 'pro' && (
                  <span className="absolute -top-px right-5 rounded-b-lg bg-rasta-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-black">
                    {T.recommended[l]}
                  </span>
                )}
                <h3 className="text-lg font-bold font-display text-white">{p.name}</h3>
                <p className="mt-1 text-3xl font-black text-gradient-gold">
                  {p.price}
                  <span className="text-sm font-normal text-gray-400">{T.perMonth[l]}</span>
                </p>
                <ul className="mt-3 flex-1 space-y-1.5 text-sm text-gray-300">
                  {p.features[l].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => subscribeStripe(p.id)}
                  disabled={!authenticated || busy !== null}
                  className={
                    p.id === 'pro'
                      ? 'zion-button-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-40'
                      : 'mt-5 w-full rounded-xl border border-rasta-gold/40 px-4 py-2.5 text-sm font-bold text-rasta-gold transition hover:bg-rasta-gold/10 disabled:cursor-not-allowed disabled:opacity-40'
                  }
                >
                  {busy === `stripe-${p.id}` ? (
                    <Loader2 className="w-4 h-4 animate-spin inline-block" />
                  ) : p.id === 'free' ? (
                    T.getKey[l]
                  ) : (
                    T.subscribe[l]
                  )}
                </button>
                {(p.id === 'pro' || p.id === 'team') && (
                  <button
                    onClick={() => void payCrypto(p.id === 'team' ? 'team' : 'pro')}
                    disabled={!authenticated || busy !== null}
                    className="mt-2 w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy === `crypto-${p.id}` ? (
                      <Loader2 className="w-4 h-4 animate-spin inline-block" />
                    ) : (
                      <span className="inline-flex items-center gap-1.5 justify-center">
                        <Wallet className="w-4 h-4" /> {T.crypto[l]}
                      </span>
                    )}
                  </button>
                )}
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          {cryptoOk && (
            <p className="mt-5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {T.cryptoOk[l]}
            </p>
          )}

          {result?.apiKey && (
            <div className="mt-5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                <Key className="w-4 h-4" /> {T.keyOnce[l]}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded bg-black/40 px-3 py-2 text-xs text-emerald-100">
                  {result.apiKey}
                </code>
                <button
                  onClick={copyKey}
                  className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/20"
                >
                  {copied ? T.copied[l] : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <SectionHead icon={Terminal} title={T.docsTitle[l]} />
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {T.docsCli[l]}
              </p>
              <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/50 p-4 text-xs leading-relaxed text-gray-200">{`zion hiran login
zion hiran whoami
zion hiran agent -p "…"`}</pre>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {T.docsApi[l]}
              </p>
              <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/50 p-4 text-xs leading-relaxed text-gray-200">{`curl https://market.zionterranova.com/v1/chat/completions \\
  -H "X-API-Key: zis_…" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "hiran-mini",
      "messages": [{"role": "user", "content": "Hello"}]}'

GET /v1/models · ${T.usage[l]} → /v1/usage`}</pre>
            </div>
          </div>

          <p className="mt-6 text-sm text-gray-400">{T.footer[l]}</p>
          <p className="mt-2 text-sm text-gray-500">
            <Link href="/terms" className="underline hover:text-gray-300">
              {l === 'cs' ? 'Podmínky služby' : 'Terms of service'}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}

export default function AiPricingPage() {
  return (
    <Suspense
      fallback={
        <div className="rasta-info-page p-10 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      }
    >
      <AiPricingInner />
    </Suspense>
  );
}
