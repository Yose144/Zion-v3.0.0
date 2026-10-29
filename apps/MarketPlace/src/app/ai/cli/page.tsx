'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, Loader2, Terminal } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

const T = {
  title: { cs: 'Přihlášení Hiran CLI', en: 'Hiran CLI sign-in' },
  subtitle: {
    cs: 'Potvrďte kód z terminálu (`zion hiran login`). Po schválení se vraťte do CLI.',
    en: 'Confirm the code shown in your terminal (`zion hiran login`). Then return to the CLI.',
  },
  codeLabel: { cs: 'Kód zařízení', en: 'Device code' },
  approve: { cs: 'Schválit CLI', en: 'Approve CLI' },
  signIn: {
    cs: 'Nejdřív se přihlaste (Sign In / MetaMask v navigaci).',
    en: 'Sign in first (Sign In / MetaMask in the navigation).',
  },
  done: {
    cs: 'Hotovo — vraťte se do terminálu. Klíč se stáhne automaticky.',
    en: 'Done — return to your terminal. The key will download automatically.',
  },
  back: { cs: 'Zpět na /ai', en: 'Back to /ai' },
};

function CliApproveInner() {
  const { lang: l } = useLang();
  const { authenticated, loading: authLoading } = useAuth();
  const params = useSearchParams();
  const initial = useMemo(
    () => (params.get('code') ?? '').trim().toUpperCase(),
    [params],
  );
  const [code, setCode] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const approve = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/hiran/cli/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_code: code.trim().toUpperCase() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setOk(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setBusy(false);
    }
  }, [code]);

  return (
    <div className="rasta-info-page">
      <section className="rasta-info-hero">
        <div className="rasta-info-hero-inner">
          <span className="rasta-info-version-badge">
            <Terminal className="w-4 h-4 inline-block mr-2" /> CLI
          </span>
          <h1>{T.title[l]}</h1>
          <p className="rasta-info-subtitle">{T.subtitle[l]}</p>
        </div>
      </section>

      <section className="rasta-info-section">
        <div className="rasta-info-content max-w-lg">
          {!authLoading && !authenticated && (
            <p className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {T.signIn[l]}
            </p>
          )}

          <label className="block text-sm text-gray-300 mb-2">{T.codeLabel[l]}</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD-1234"
            className="w-full rounded-lg border border-white/15 bg-black/40 px-4 py-3 font-mono text-lg tracking-widest text-white"
            disabled={ok}
          />

          <button
            type="button"
            onClick={approve}
            disabled={!authenticated || busy || ok || code.trim().length < 4}
            className="mt-4 w-full rounded-lg bg-amber-500/90 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin inline-block" />
            ) : (
              T.approve[l]
            )}
          </button>

          {error && (
            <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          {ok && (
            <p className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              <Check className="w-4 h-4 shrink-0" /> {T.done[l]}
            </p>
          )}

          <p className="mt-8 text-sm text-gray-500">
            <Link href="/ai" className="underline hover:text-gray-300">
              {T.back[l]}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}

export default function AiCliPage() {
  return (
    <Suspense
      fallback={
        <div className="rasta-info-page p-10 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      }
    >
      <CliApproveInner />
    </Suspense>
  );
}
