'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  ExternalLink,
  Gem,
  KeyRound,
  Library,
  Lock,
  LogIn,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { LIBRARY_STATS, READER_BOOKS } from '@/app/zion-archive/library-index';

const SHOP_URL = 'https://market.zionterranova.com/shop?category=books';
// CTA „Získat ZION Pass" vede na detail produktu — tam je vysvětlené, co kód
// otevře, co je v ceně a jak to funguje. Na výpisu obchodu se člověk proklikává.
const PASS_URL = 'https://market.zionterranova.com/vanoce/zion-pass';

const Copy = {
  kicker: { cs: 'Zion Archive · Nirvana Hub', en: 'Zion Archive · Nirvana Hub' },
  title: { cs: 'Zion Archive', en: 'Zion Archive' },
  sub: {
    cs: 'Nirvana Hub — knihovna cesty · všechny knihy na jednom místě',
    en: 'Nirvana Hub — the library of the path · all books in one place',
  },
  badge: { cs: 'Vstup přes ZION Pass', en: 'Access with a ZION Pass' },
  lede: {
    cs: 'Archiv je otevřený držitelům ZION Passu. Kód ZAP-… přichází s digitální knihou v marketplace — a hráči OASIS mají vstup zdarma po přihlášení přes ZIS.',
    en: 'The archive is open to ZION Pass holders. A ZAP-… code comes with a digital book in the marketplace — and OASIS players get in free after signing in with ZIS.',
  },
  buyPass: { cs: 'Získat ZION Pass', en: 'Get a ZION Pass' },
  haveCode: { cs: 'Mám přístupový kód', en: 'I have an access code' },
  unlockTitle: { cs: 'Odemknout archiv', en: 'Unlock the archive' },
  unlockSub: {
    cs: 'Zadej kód ZAP-… z nákupu nebo od týmu. Kód se ověří na serveru a uloží do tvého prohlížeče.',
    en: 'Enter the ZAP-… code from your purchase or from the team. The code is verified on the server and stored in your browser.',
  },
  codePlaceholder: { cs: 'Archive Pass kód', en: 'Archive Pass code' },
  codeSubmit: { cs: 'Odemknout archiv', en: 'Unlock the archive' },
  codeWorking: { cs: 'Ověřuji…', en: 'Verifying…' },
  codeInvalid: { cs: 'Neplatný kód', en: 'Invalid code' },
  codeThrottled: { cs: 'Příliš mnoho pokusů — zkus to za chvíli', en: 'Too many attempts — try again shortly' },
  codeError: { cs: 'Ověření selhalo — zkus to znovu', en: 'Verification failed — try again' },
  codeBound: { cs: 'Pass navázán na tvůj ZIS účet', en: 'Pass bound to your ZIS account' },
  loginCta: { cs: 'Přihlásit se přes ZIS', en: 'Sign in with ZIS' },
  loginHint: {
    cs: 'OASIS hráče pustíme dovnitř zdarma — kód není potřeba.',
    en: 'OASIS players get in free — no code needed.',
  },
  loggedInAs: { cs: 'Přihlášen jako', en: 'Signed in as' },
  statsBooks: { cs: 'knih', en: 'books' },
  statsGroups: { cs: 'skupin', en: 'groups' },
  statsLanguages: { cs: 'jazyky', en: 'languages' },
  statsReader: { cs: 'čtečka', en: 'reader' },
  insideTitle: { cs: 'Co uvnitř', en: 'What is inside' },
  insideBlurb: {
    cs: 'Osmnáct knih v pěti skupinách — hlavní osa od Genesis po Nirvanu i doprovodné příběhy. Jedna knihovna, jeden reader.',
    en: 'Eighteen books in five groups — the main axis from Genesis to Nirvana and the companion stories. One library, one reader.',
  },
  accessTitle: { cs: 'Tři cesty dovnitř', en: 'Three ways in' },
  passTitle: { cs: 'ZION Pass', en: 'ZION Pass' },
  passBody: {
    cs: 'Kód ZAP-… k digitální knize nebo samostatnému passu v marketplace — okamžité doručení a 90denní přístup.',
    en: 'A ZAP-… code with a digital book or a standalone pass in the marketplace — instant delivery and 90-day access.',
  },
  passCta: { cs: 'Otevřít marketplace', en: 'Open the marketplace' },
  // CTA u seznamu „co je součástí" vede na detail produktu, ne na výpis
  passDetailCta: { cs: 'Detail ZION Passu', en: 'ZION Pass details' },
  b2bCta: { cs: 'Napsat týmu', en: 'Email the team' },
  oasisTitle: { cs: 'OASIS bonus', en: 'OASIS bonus' },
  oasisBody: {
    cs: 'Hráči OASIS mají archiv zdarma — stačí se přihlásit přes ZIS s propojeným OASIS účtem.',
    en: 'OASIS players get the archive free — just sign in with ZIS and a linked OASIS account.',
  },
  b2bTitle: { cs: 'B2B a partneři', en: 'B2B & partners' },
  b2bBody: {
    cs: 'Institucionální a partnerský přístup přes kód od týmu; kód jde navázat na firemní ZIS účet.',
    en: 'Institutional and partner access via a team-issued code; the code can be bound to a company ZIS account.',
  },
  stepsTitle: { cs: 'Jak to funguje', en: 'How it works' },
  steps: {
    cs: [
      { title: 'Získej kód', body: 'Kup digitální knihu nebo ZION Pass v marketplace — kód ZAP-… přijde s objednávkou. Hráči OASIS kód nepotřebují.' },
      { title: 'Uplatni kód', body: 'Vlož kód do formuláře výše. Ověří se na serveru a přístup se uloží do prohlížeče na 90 dní.' },
      { title: 'Čti celou knihovnu', body: 'Otevře se všech 18 knih, reader si pamatuje poslední kapitolu a nové texty přicházejí bez dalšího placení.' },
    ],
    en: [
      { title: 'Get a code', body: 'Buy a digital book or a ZION Pass in the marketplace — the ZAP-… code arrives with the order. OASIS players need no code.' },
      { title: 'Redeem the code', body: 'Paste the code into the form above. It is verified on the server and access is stored in your browser for 90 days.' },
      { title: 'Read the whole library', body: 'All 18 books open, the reader remembers your last chapter, and new texts arrive without another payment.' },
    ],
  },
  includedTitle: { cs: 'Co pass odemyká', en: 'What the pass unlocks' },
  included: {
    cs: [
      'Všech 18 knih v jednom readeru',
      'Pokračování ve čtení a poslední kapitola',
      'Anglické kapitoly tam, kde existují',
      'Nové kapitoly bez dalšího placení',
      'Kód platí 90 dní a jde navázat na ZIS',
    ],
    en: [
      'All 18 books in one reader',
      'Continue reading and your last chapter',
      'English chapters wherever they exist',
      'New chapters without another payment',
      'The code lasts 90 days and can be bound to ZIS',
    ],
  },
  publicNote: {
    cs: 'Veřejná dokumentace zůstává otevřená — whitepapery, /docs, Genesis i Terra Nova. Archiv Pass chrání knihovnu, ne přístup k projektu.',
    en: 'Public documentation stays open — whitepapers, /docs, Genesis and Terra Nova. The Archive Pass protects the library, not access to the project.',
  },
  docs: { cs: 'Veřejná dokumentace', en: 'Public documentation' },
  home: { cs: 'Zpět na homepage', en: 'Back to homepage' },
  secure: { cs: 'Ověřeno serverem · žádné cookies třetích stran', en: 'Server-verified · no third-party cookies' },
};

export default function ArchiveLock() {
  const { lang } = useLang();
  const l = lang === 'cs' ? 'cs' : 'en';
  const router = useRouter();
  const { user } = useAuth();
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

  const stats = [
    { value: String(LIBRARY_STATS.books), label: Copy.statsBooks[l] },
    { value: String(LIBRARY_STATS.groups), label: Copy.statsGroups[l] },
    { value: 'CZ + EN', label: Copy.statsLanguages[l] },
    { value: '1', label: Copy.statsReader[l] },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(252,209,22,0.10),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(168,85,247,0.10),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />

      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-20 sm:px-6 md:pt-24">
        {/* ─── hero ─── */}
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-zion-gold">{Copy.kicker[l]}</p>
          <div className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-zion-gold/30 bg-zion-gold/10 shadow-[0_0_40px_rgba(252,209,22,0.18)]">
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

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              href={PASS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-zion-gold/50 bg-zion-gold/15 px-5 py-2.5 text-sm font-bold text-zion-gold transition-colors hover:bg-zion-gold/25"
            >
              <Gem className="h-4 w-4" />
              {Copy.buyPass[l]}
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </a>
            <a
              href="#archive-unlock"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-gray-300 transition-colors hover:border-white/30 hover:text-white"
            >
              <KeyRound className="h-4 w-4" />
              {Copy.haveCode[l]}
            </a>
          </div>

          <dl className="mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  {stat.label}
                </dt>
                <dd className="mt-0.5 font-mono text-sm font-bold text-white">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ─── unlock ─── */}
        <div
          id="archive-unlock"
          className="zion-rainbow-card mx-auto mt-12 max-w-xl scroll-mt-28 p-5 sm:p-6"
          style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zion-gold/30 bg-zion-gold/10">
              <KeyRound className="h-4 w-4 text-zion-gold" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{Copy.unlockTitle[l]}</h2>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">{Copy.unlockSub[l]}</p>
            </div>
          </div>

          <form onSubmit={submitCode} className="mt-4">
            <label htmlFor="archive-code" className="sr-only">
              {Copy.codePlaceholder[l]}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="archive-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={Copy.codePlaceholder[l]}
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 focus:border-zion-gold/50 focus:outline-none focus:ring-2 focus:ring-zion-gold/30"
              />
              <button
                type="submit"
                disabled={busy || !code.trim()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-zion-gold/40 bg-zion-gold/10 px-4 py-2.5 text-sm font-bold text-zion-gold transition-colors hover:bg-zion-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
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
          </form>

          <div className="mt-4 border-t border-white/10 pt-4">
            {user ? (
              <p className="text-xs text-gray-500">
                {Copy.loggedInAs[l]}{' '}
                <span className="font-semibold text-gray-300">
                  {user.displayName || user.primaryAddress.slice(0, 10) + '…'}
                </span>
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-bold text-emerald-300 transition-colors hover:bg-emerald-500/20"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  {Copy.loginCta[l]}
                </Link>
                <p className="text-[11px] text-gray-600">{Copy.loginHint[l]}</p>
              </div>
            )}
          </div>
          <p className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600">
            <ShieldCheck className="h-3 w-3" />
            {Copy.secure[l]}
          </p>
        </div>

        {/* ─── what is inside ─── */}
        <div className="zion-rainbow-card mt-10 p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-200">
              {Copy.insideTitle[l]}
            </h2>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-600">
              {LIBRARY_STATS.books} {l === 'cs' ? 'knih' : 'books'} · {LIBRARY_STATS.groups}{' '}
              {l === 'cs' ? 'skupin' : 'groups'}
            </span>
            <p className="w-full text-xs leading-relaxed text-gray-500">{Copy.insideBlurb[l]}</p>
          </div>

          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {READER_BOOKS.map((book) => {
              const Icon = book.icon;
              return (
                <li
                  key={book.id}
                  className="relative overflow-hidden rounded-xl border p-2.5"
                  style={{
                    borderColor: `rgba(${book.accent}, 0.22)`,
                    background: `linear-gradient(150deg, rgba(${book.accent}, 0.10), rgba(${book.accent}, 0.02))`,
                  }}
                >
                  <Icon
                    aria-hidden
                    className="pointer-events-none absolute -bottom-2 -right-2 h-12 w-12 opacity-15"
                    style={{ color: `rgb(${book.accent})` }}
                  />
                  <Lock
                    aria-hidden
                    className="absolute right-2 top-2 h-3 w-3 text-white/20"
                  />
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                    {book.groupLabel[l]}
                  </p>
                  <p className="mt-1 pr-3 text-[11px] font-bold leading-snug text-white">
                    {book.title[l]}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>

        {/* ─── three ways in ─── */}
        <div className="mt-10">
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-200">
            {Copy.accessTitle[l]}
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { icon: BookOpen, title: Copy.passTitle[l], body: Copy.passBody[l], href: SHOP_URL, label: Copy.passCta[l] },
              { icon: Gem, title: Copy.oasisTitle[l], body: Copy.oasisBody[l], href: '/login', label: Copy.loginCta[l] },
              { icon: Building2, title: Copy.b2bTitle[l], body: Copy.b2bBody[l], href: 'mailto:omnity.company@gmail.com', label: Copy.b2bCta[l] },
            ].map(({ icon: Icon, title, body, href, label }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <Icon className="h-4 w-4 text-zion-gold" />
                  {title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-gray-400">{body}</p>
                <a
                  href={href}
                  {...(href.startsWith('http')
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-zion-gold transition-colors hover:text-amber-200"
                >
                  {label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* ─── how it works ─── */}
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-gray-200">
              {Copy.stepsTitle[l]}
            </h2>
            <ol className="mt-4 space-y-2.5">
              {Copy.steps[l].map((step, i) => (
                <li
                  key={step.title}
                  className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zion-gold/30 bg-zion-gold/10 text-xs font-bold text-zion-gold">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white">{step.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-gray-400">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-white">
              <Library className="h-4 w-4 text-zion-purple" />
              {Copy.includedTitle[l]}
            </h2>
            <ul className="mt-3 space-y-2">
              {Copy.included[l].map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-gray-300">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  {item}
                </li>
              ))}
            </ul>
            <a
              href={PASS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto inline-flex items-center gap-1.5 pt-4 text-xs font-semibold text-zion-gold transition-colors hover:text-amber-200"
            >
              {Copy.passDetailCta[l]}
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* ─── honesty + links ─── */}
        <p className="mx-auto mt-10 max-w-3xl text-center text-xs leading-relaxed text-gray-500">
          {Copy.publicNote[l]}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href={PASS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-zion-gold/40 bg-zion-gold/10 px-5 py-2.5 text-sm font-bold text-zion-gold transition-colors hover:bg-zion-gold/20"
          >
            <Gem className="h-4 w-4" />
            {Copy.buyPass[l]}
          </a>
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
