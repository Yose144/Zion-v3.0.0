'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/core/i18n';

const BOOK_URL = 'https://market.zionterranova.com/shop?category=books';

type GateState = 'loading' | 'locked' | 'open';
type GateError = 'gateTooMany' | 'gateInvalid' | 'gateVerifyFailed';

/** Portal-level ZION Archive Pass gate — the same ZAP-… code that
 *  unlocks the web Archive and the gated OASIS world. Cookie state is
 *  re-validated by /api/pass on every mount. */
export function PassGate({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, setState] = useState<GateState>('loading');
  /** Kam se vrátit po odemčení (middleware sem poslal `?next=`). */
  const [next, setNext] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<GateError | null>(null);

  useEffect(() => {
    let live = true;
    const check = (attempt: number): void => {
      fetch('/api/pass', { cache: 'no-store' })
        .then((r) => r.json())
        .then((j: { access?: boolean; reason?: string }) => {
          if (!live) return;
          if (j.access === true) {
            setState('open');
            return;
          }
          if (j.reason === 'unreachable' && attempt < 2) {
            // Oracle hiccup (timeout / throttle / EDGE2 deploy) — the cookie
            // is still there, so retry before telling the user anything.
            setTimeout(() => live && check(attempt + 1), 1200);
            return;
          }
          if (j.reason === 'unreachable') setError('gateVerifyFailed');
          setState('locked');
        })
        .catch(() => live && setState('locked'));
    };
    check(0);
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = params.get('next');
    // jen interní cesta — `//evil.com` je protokol-relative URL
    if (target && target.startsWith('/') && !target.startsWith('//')) setNext(target);
  }, []);

  // odemčeno a někdo sem přišel z konkrétní stránky → vrať ho tam
  useEffect(() => {
    if (state === 'open' && next) router.replace(next);
  }, [state, next, router]);

  const submit = async () => {
    const trimmed = code.trim();
    if (trimmed.length < 8 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      });
      if (res.ok) {
        setState('open');
      } else {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        if (j.error === 'too_many_attempts') setError('gateTooMany');
        else if (j.error === 'verify_unavailable') setError('gateVerifyFailed');
        else setError('gateInvalid');
      }
    } catch {
      setError('gateVerifyFailed');
    } finally {
      setBusy(false);
    }
  };

  if (state === 'open') return <>{children}</>;

  return (
    <div className="pass-gate flex min-h-screen items-center justify-center bg-[#02030a] p-4 text-white">
      {state === 'loading' ? (
        <div className="text-center text-white/50">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <p className="text-sm">{t('gateOpening')}</p>
        </div>
      ) : (
        <div className="pass-gate-card w-full max-w-md rounded-2xl border border-amber-400/25 bg-black/60 p-8 text-center shadow-2xl backdrop-blur">
          <div className="text-5xl">🌅</div>
          <h1 className="mt-4 text-xl font-bold tracking-wide text-amber-200">
            {t('gateTitle')}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            {t('gateBodyLead')} <span className="text-amber-300">ZION Archive Pass</span>{' '}
            {t('gateBodyTail')}
          </p>

          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="ZAP-…"
            autoFocus
            className="mt-6 w-full rounded-lg border border-white/15 bg-black/70 px-4 py-3 text-center font-mono text-lg tracking-widest text-amber-200 placeholder:text-white/25 focus:border-amber-400/60 focus:outline-none"
          />
          {error && <p className="mt-2 text-sm text-red-400">{t(error)}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={busy || code.trim().length < 8}
            className="mt-4 w-full rounded-lg bg-amber-500/90 px-4 py-3 font-semibold text-black transition hover:bg-amber-400 disabled:opacity-40"
          >
            {busy ? t('gateVerifying') : t('gateEnter')}
          </button>

          <p className="mt-5 text-xs text-white/40">
            {t('gateNoPass')}{' '}
            <a
              href={BOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-300/80 underline hover:text-amber-300"
            >
              {t('gateBuyBook')}
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
