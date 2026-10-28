'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Building2,
  Gem,
  KeyRound,
  Lock,
  LogIn,
  Sparkles,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { BOOK_NAV } from '@/lib/books/registry';

const Copy = {
  kicker: { cs: 'Zion Archive · Nirvana Hub', en: 'Zion Archive · Nirvana Hub' },
  title: { cs: 'Zion Archive', en: 'Zion Archive' },
  sub: {
    cs: 'Nirvana Hub — knihovna cesty · všechny knihy na jednom místě',
    en: 'Nirvana Hub — the library of the path · all books in one place',
  },
  badge: { cs: 'Otevírá se brzy', en: 'Opening soon' },
  lede: {
    cs: 'Archiv se připravuje. Přístup do knihovny bude placený přes Archive Pass — s bonusy v OASIS a na marketplace. Veřejná dokumentace zůstává otevřená.',
    en: 'The archive is being prepared. Library access will be paid via an Archive Pass — with bonuses in OASIS and on the marketplace. Public documentation stays open.',
  },
  insideTitle: { cs: 'Co uvnitř', en: 'What is inside' },
  insideBlurb: {
    cs: 'Osmnáct knih v pěti skupinách — jedna knihovna, jeden reader.',
    en: 'Eighteen books in five groups — one library, one reader.',
  },
  accessTitle: { cs: 'Model přístupu', en: 'Access model' },
  passTitle: { cs: 'Archive Pass', en: 'Archive Pass' },
  passBody: {
    cs: 'Placený přístup do celé knihovny — v přípravě na marketplace.',
    en: 'Paid access to the whole library — being prepared on the marketplace.',
  },
  oasisTitle: { cs: 'OASIS bonusy', en: 'OASIS bonuses' },
  oasisBody: {
    cs: 'Hráči OASIS mají přístup do archivu zdarma — stačí se přihlásit přes ZIS.',
    en: 'OASIS players get free archive access — just sign in with ZIS.',
  },
  b2bTitle: { cs: 'B2B licence', en: 'B2B licence' },
  b2bBody: {
    cs: 'Institucionální a partnerský přístup k archivu — v jednání.',
    en: 'Institutional and partner access to the archive — in discussion.',
  },
  market: { cs: 'Marketplace', en: 'Marketplace' },
  docs: { cs: 'Veřejná dokumentace', en: 'Public documentation' },
  home: { cs: 'Zpět na homepage', en: 'Back to homepage' },
  haveCode: { cs: 'Mám přístupový kód', en: 'I have an access code' },
  codePlaceholder: { cs: 'Archive Pass kód', en: 'Archive Pass code' },
  codeSubmit: { cs: 'Odemknout archiv', en: 'Unlock the archive' },
  codeWorking: { cs: 'Ověřuji…', en: 'Verifying…' },
  codeInvalid: { cs: 'Neplatný kód', en: 'Invalid code' },
  codeThrottled: { cs: 'Příliš mnoho pokusů — zkus to za chvíli', en: 'Too many attempts — try again shortly' },
  codeError: { cs: 'Ověření selhalo — zkus to znovu', en: 'Verification failed — try again' },
  codeBound: {
    cs: 'Pass navázán na tvůj ZIS účet',
    en: 'Pass bound to your ZIS account',
  },
  loginCta: {
    cs: 'Přihlásit se přes ZIS',
    en: 'Sign in with ZIS',
  },
  loginHint: {
    cs: 'OASIS hráče pustíme dovnitř zdarma — kód není potřeba.',
    en: 'OASIS players get in free — no code needed.',
  },
  loggedInAs: {
    cs: 'Přihlášen jako',
    en: 'Signed in as',
  },
};

export default function ArchiveLock() {
  const { lang } = useLang();
  const l = lang === 'cs' ? 'cs' : 'en';
  const router = useRouter();
  const { user } = useAuth();
  const total = BOOK_NAV.reduce((n, g) => n + g.books.length, 0);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bound, setBound] = useState(false);

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/archive/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        try {
          const data = (await res.json()) as { bound?: boolean };
          if (data.bound) setBound(true);
        } catch {
          /* bound flag is cosmetic */
        }
        router.refresh();
        return;
      }
      setError(res.status === 429 ? Copy.codeThrottled[l] : Copy.codeInvalid[l]);
    } catch {
      setError(Copy.codeError[l]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(252,209,22,0.08),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(168,85,247,0.08),transparent_55%)]" />
      <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-24 sm:px-6 md:pt-32">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-zion-gold">{Copy.kicker[l]}</p>
          <div className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-zion-gold/30 bg-zion-gold/10">
            <Lock className="h-7 w-7 text-zion-gold" />
          </div>
          <h1 className="text-gradient mt-6 text-4xl font-black tracking-tight sm:text-5xl">
            {Copy.title[l]}
          </h1>
          <p className="mt-3 text-base font-semibold text-gray-300">{Copy.sub[l]}</p>
          <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-zion-gold">
            <Sparkles className="h-3.5 w-3.5" />
            {Copy.badge[l]}
          </span>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base">
            {Copy.lede[l]}
          </p>

          <form onSubmit={submitCode} className="mx-auto mt-7 max-w-md">
            <label htmlFor="archive-code" className="sr-only">
              {Copy.haveCode[l]}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <input
                  id="archive-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={Copy.codePlaceholder[l]}
                  autoComplete="off"
                  className="w-full rounded-xl border border-white/15 bg-white/[0.04] py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold/50 focus:outline-none focus:ring-2 focus:ring-zion-gold/30"
                />
              </div>
              <button
                type="submit"
                disabled={busy || !code.trim()}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-zion-gold/40 bg-zion-gold/10 px-4 py-2.5 text-sm font-bold text-zion-gold transition-colors hover:bg-zion-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? Copy.codeWorking[l] : Copy.codeSubmit[l]}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-xs font-semibold text-red-400" role="alert">
                {error}
              </p>
            )}
            {bound && (
              <p className="mt-2 text-xs font-semibold text-emerald-400" role="status">
                {Copy.codeBound[l]}
              </p>
            )}
            {user ? (
              <p className="mt-3 text-xs text-gray-500">
                {Copy.loggedInAs[l]}{' '}
                <span className="font-semibold text-gray-300">
                  {user.displayName || user.primaryAddress.slice(0, 10) + '…'}
                </span>
              </p>
            ) : (
              <div className="mt-4">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/20"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  {Copy.loginCta[l]}
                </Link>
                <p className="mt-2 text-[11px] text-gray-600">{Copy.loginHint[l]}</p>
              </div>
            )}
          </form>
        </div>

        <div className="mt-12 grid gap-3 sm:grid-cols-3">
          {[
            { icon: BookOpen, title: Copy.passTitle[l], body: Copy.passBody[l] },
            { icon: Gem, title: Copy.oasisTitle[l], body: Copy.oasisBody[l] },
            { icon: Building2, title: Copy.b2bTitle[l], body: Copy.b2bBody[l] },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-500">
                {Copy.accessTitle[l]}
              </p>
              <h2 className="mt-2 flex items-center gap-2 text-sm font-bold text-white">
                <Icon className="h-4 w-4 text-zion-gold" />
                {title}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-gray-400">{body}</p>
            </div>
          ))}
        </div>

        <div className="zion-rainbow-card mt-10 p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-200">
              {Copy.insideTitle[l]}
            </h2>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600">
              {total} {l === 'cs' ? 'knih' : 'books'} · {BOOK_NAV.length} {l === 'cs' ? 'skupin' : 'groups'}
            </span>
            <p className="w-full text-xs text-gray-500">{Copy.insideBlurb[l]}</p>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {BOOK_NAV.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5"
              >
                <span className="text-xs font-semibold text-gray-300">{g.label[l]}</span>
                <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600">
                  {g.books.length}
                  <Lock className="h-3 w-3" />
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/market"
            className="inline-flex items-center gap-2 rounded-xl border border-zion-gold/40 bg-zion-gold/10 px-5 py-2.5 text-sm font-bold text-zion-gold transition-colors hover:bg-zion-gold/20"
          >
            <Gem className="h-4 w-4" />
            {Copy.market[l]}
          </Link>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-gray-300 transition-colors hover:border-white/30 hover:text-white"
          >
            <BookOpen className="h-4 w-4" />
            {Copy.docs[l]}
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-200"
          >
            {Copy.home[l]}
          </Link>
        </div>
      </div>
    </main>
  );
}
