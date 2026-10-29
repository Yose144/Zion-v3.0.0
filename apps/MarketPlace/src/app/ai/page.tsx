'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Brain, Check, Copy, Key, Loader2, Terminal, Wallet } from 'lucide-react';
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
  cliLink: {
    cs: 'CLI: zion hiran login → schválit na /ai/cli',
    en: 'CLI: zion hiran login → approve at /ai/cli',
  },
  vastLink: {
    cs: 'Vast Coding Agent — spouštěj coding joby na GPU fleetu (/vast-rigs/#ai)',
    en: 'Vast Coding Agent — run coding jobs on the GPU fleet (/vast-rigs/#ai)',
  },
  vastCli: {
    cs: 'zion hiran agent -p "…" --remote vast',
    en: 'zion hiran agent -p "…" --remote vast',
  },
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
    price: '29 €',
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
      <section className="rasta-info-hero">
        <div className="rasta-info-hero-inner">
          <span className="rasta-info-version-badge">
            <Brain className="w-4 h-4 inline-block mr-2" /> {T.kicker[l]}
          </span>
          <h1>{T.title[l]}</h1>
          <p className="rasta-info-subtitle">{T.subtitle[l]}</p>
        </div>
      </section>

      <section className="rasta-info-section">
        <div className="rasta-info-content">
          {!authLoading && !authenticated && (
            <p className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {T.signIn[l]}
            </p>
          )}

          <p className="mb-5 text-sm text-gray-400 space-y-1">
            <span className="block">
              <Link href="/ai/cli" className="underline hover:text-gray-200">
                {T.cliLink[l]}
              </Link>
            </span>
            <span className="block">
              <a
                href="https://zionterranova.com/vast-rigs/#ai"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-gray-200"
              >
                {T.vastLink[l]}
              </a>
              <span className="ml-2 font-mono text-xs text-gray-500">{T.vastCli[l]}</span>
            </span>
          </p>

          {modelsInfo?.badge && (
            <div className="mb-6 flex flex-wrap items-center gap-2 text-xs">
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

          <h2 className="mb-2 text-xl font-semibold text-white">{T.modelsTitle[l]}</h2>
          <p className="mb-4 text-sm text-gray-400">{T.modelsSub[l]}</p>
          <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(modelsInfo?.models ?? []).map((m) => {
              const status = m['x-mockup']
                ? T.mockup[l]
                : m['x-available']
                  ? T.available[l]
                  : T.offline[l];
              const statusClass = m['x-mockup']
                ? 'text-amber-300'
                : m['x-available']
                  ? 'text-emerald-300'
                  : 'text-gray-500';
              return (
                <div
                  key={m.id}
                  className="rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-sm font-semibold text-white">{m.id}</code>
                    <span className={`text-[11px] font-mono uppercase ${statusClass}`}>
                      {status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    {m['x-role'] || '—'} · {T.ctx[l]} {m['x-context'] ?? '—'}
                  </p>
                  <p className="mt-1 text-sm text-amber-200/90">
                    {T.price[l]}{' '}
                    {typeof m['x-price-1m-usd'] === 'number'
                      ? m['x-price-1m-usd'].toFixed(2)
                      : '—'}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mb-10 rounded-xl border border-white/10 bg-white/5 p-5">
            <h2 className="text-lg font-semibold text-white">{T.trialTitle[l]}</h2>
            <p className="mt-1 text-sm text-gray-400">{T.trialHint[l]}</p>
            <textarea
              value={trialPrompt}
              onChange={(e) => setTrialPrompt(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={T.trialPlaceholder[l]}
              className="mt-3 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-gray-600"
            />
            <button
              type="button"
              onClick={() => void runTrial()}
              disabled={!authenticated || busy !== null || !trialPrompt.trim()}
              className="mt-3 rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy === 'trial' ? (
                <Loader2 className="w-4 h-4 animate-spin inline-block" />
              ) : (
                T.trialSend[l]
              )}
            </button>
            {trialErr && (
              <p className="mt-3 text-sm text-red-300">{trialErr}</p>
            )}
            {trialOut && (
              <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-black/50 p-3 text-xs text-gray-200 whitespace-pre-wrap">
                {trialOut}
              </pre>
            )}
          </div>

          <p className="mb-6 text-xs text-gray-500">
            {modelsInfo?.settlement_note || T.settlement[l]}
          </p>

          <div className="grid gap-5 md:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col"
              >
                <h3 className="text-lg font-semibold text-white">{p.name}</h3>
                <p className="mt-1 text-2xl font-bold text-amber-300">
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
                  className="mt-4 w-full rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
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

          <h2 className="mt-10 flex items-center gap-2 text-xl font-semibold text-white">
            <Terminal className="w-5 h-5" /> {T.docsTitle[l]}
          </h2>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-black/50 p-4 text-xs text-gray-200">{`zion hiran login
zion hiran whoami
zion agent -p "…"
# remote GPU fleet (ops token):
zion hiran agent -p "…" --remote vast

curl https://market.zionterranova.com/v1/chat/completions \\
  -H "X-API-Key: zis_…" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "hiran-mini", "messages": [{"role": "user", "content": "Hello"}]}'

GET /v1/models · `}{T.usage[l]}{` → /v1/usage`}</pre>

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
