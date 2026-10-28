'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Brain, Check, Copy, Key, Loader2, Terminal } from 'lucide-react';
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
  free: { cs: 'Zdarma', en: 'Free' },
  getKey: { cs: 'Vytvořit API klíč', en: 'Create API key' },
  subscribe: { cs: 'Předplatit', en: 'Subscribe' },
  keyOnce: {
    cs: 'Váš nový API klíč — zobrazuje se naposledy, uložte si ho.',
    en: 'Your new API key — shown once, store it safely.',
  },
  copied: { cs: 'Zkopírováno', en: 'Copied' },
  docsTitle: { cs: 'Použití (OpenAI-compatible)', en: 'Usage (OpenAI-compatible)' },
  usage: { cs: 'Využití a limity', en: 'Usage & limits' },
  footer: {
    cs: 'Zrušení kdykoliv přes Stripe zákaznický portál. Klíč lze kdykoliv revokovat v ZIS účtu.',
    en: 'Cancel anytime via the Stripe customer portal. The key can be revoked in your ZIS account at any time.',
  },
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
  apiKey: string;
  url?: string | null;
}

export default function AiPricingPage() {
  const { lang: l } = useLang();
  const { authenticated, loading: authLoading } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<SubscribeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const subscribe = async (plan: string) => {
    setBusy(plan);
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
  };

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
                  onClick={() => subscribe(p.id)}
                  disabled={!authenticated || busy !== null}
                  className="mt-4 w-full rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy === p.id ? (
                    <Loader2 className="w-4 h-4 animate-spin inline-block" />
                  ) : p.id === 'free' ? (
                    T.getKey[l]
                  ) : (
                    T.subscribe[l]
                  )}
                </button>
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          {result && (
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
          <pre className="mt-3 overflow-x-auto rounded-xl bg-black/50 p-4 text-xs text-gray-200">{`curl https://api.zionterranova.com/v1/chat/completions \\
  -H "X-API-Key: zis_…" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "hiran-mini", "messages": [{"role": "user", "content": "Hello"}]}'

GET https://api.zionterranova.com/v1/models   — `}{T.usage[l]}{` → /v1/usage`}</pre>

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
