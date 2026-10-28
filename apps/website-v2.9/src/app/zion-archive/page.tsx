'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Compass,
  Egg,
  Library,
  ListChecks,
  Route,
  ScrollText,
  Sun,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import BookNav from '@/components/books/BookNav';
import CestaPanel from './panels/CestaPanel';
import KnihaPanel from './panels/KnihaPanel';
import NirvanaPanel from './panels/NirvanaPanel';
import PlanPanel from './panels/PlanPanel';
import SpolecniciPanel from './panels/SpolecniciPanel';
import SouvislostiPanel from './panels/SouvislostiPanel';
import type { Lang } from './panels/shared';

type SectionId = 'cesta' | 'kniha' | 'nirvana' | 'plan-v33' | 'spolecnici' | 'souvislosti';

const SECTIONS: {
  id: SectionId;
  label: { cs: string; en: string };
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  rc: string;
}[] = [
  { id: 'cesta', label: { cs: 'Knihy a pořadí', en: 'Books & reading order' }, icon: Compass, rc: '6, 182, 212' },
  { id: 'kniha', label: { cs: 'Maitreya', en: 'Maitreya' }, icon: BookOpen, rc: '252, 209, 22' },
  { id: 'nirvana', label: { cs: 'Nirvana', en: 'Nirvana' }, icon: Sun, rc: '251, 146, 60' },
  { id: 'plan-v33', label: { cs: 'Plán v3.3', en: 'v3.3 plan' }, icon: ListChecks, rc: '168, 85, 247' },
  { id: 'spolecnici', label: { cs: 'Knihovna', en: 'Library' }, icon: Library, rc: '236, 72, 153' },
  { id: 'souvislosti', label: { cs: 'Příběh a tradice', en: 'Story & tradition' }, icon: ScrollText, rc: '148, 163, 184' },
];

const SECTION_IDS = new Set<string>(SECTIONS.map((s) => s.id));

const Copy = {
  kicker: { cs: 'Nirvana Hub · ZION Terra Nova', en: 'Nirvana Hub · ZION Terra Nova' },
  title: { cs: 'Zion Archive', en: 'Zion Archive' },
  subtitle: { cs: 'Nirvana Hub · knihovna cesty · všechny knihy na jednom místě', en: 'Nirvana Hub · the library of the path · all books in one place' },
  tagline: {
    cs: '„Ten, kdo přijde — vždy, když podmínky dozrají."',
    en: '“The one who comes — whenever the conditions ripen.”',
  },
  lede: {
    cs: 'Všechny knihy cesty, jejich souvislosti a plán 3.3 Nirvana — jedna knihovna, jeden reader, jeden plán.',
    en: 'All the books of the path, their connections, and the way to 3.3 Nirvana — one library, one reader, one plan.',
  },
  read: { cs: 'Číst knihu', en: 'Read the book' },
  plan: { cs: 'Plán 3.3', en: 'The 3.3 plan' },
  navLabel: { cs: 'Sekce knihovny', en: 'Library sections' },
  libraryLabel: { cs: 'Knihovna', en: 'Library' },
  heroAlt: {
    cs: 'Oasis — jedna rodina pod Stromem života: Maitreya, Krišna s flétnou, tesař a děti nové země · One World, One Family',
    en: 'Oasis — one family under the Tree of Life: Maitreya, Krishna with his flute, the carpenter and the children of the new earth · One World, One Family',
  },
};

export default function MaitreyaPage() {
  const { lang } = useLang();
  const l: Lang = lang === 'cs' ? 'cs' : 'en';
  const [active, setActive] = useState<SectionId>('cesta');
  const pendingFocus = useRef(false);
  const reducedMotion = useReducedMotion();
  const mobileNavRef = useRef<HTMLElement>(null);

  const syncFromHash = useCallback((scroll: boolean) => {
    const raw = window.location.hash.replace('#', '');
    const id = SECTION_IDS.has(raw) ? (raw as SectionId) : 'cesta';
    pendingFocus.current = scroll && SECTION_IDS.has(raw);
    setActive(id);
  }, []);

  // Initial hash (deep links incl. /cesta and /nirvana redirects) + back/forward.
  useEffect(() => {
    if (window.location.hash) syncFromHash(true);
    const onHash = () => syncFromHash(true);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [syncFromHash]);

  // After an explicit selection, bring the panel heading under the fixed nav.
  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    const panel = document.getElementById(active);
    if (!panel) return;
    panel.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    panel.querySelector('h2')?.focus({ preventScroll: true });
  }, [active, reducedMotion]);

  // Keep the active pill inside the mobile chooser's visible horizontal bounds
  // (scrolls only the chooser — never the page).
  useEffect(() => {
    const nav = mobileNavRef.current;
    if (!nav) return;
    const pill = nav.querySelector(`a[href="#${active}"]`);
    if (!pill) return;
    const el = pill as HTMLElement;
    const target = el.offsetLeft - nav.clientWidth / 2 + el.offsetWidth / 2;
    nav.scrollTo({ left: Math.max(0, target), behavior: reducedMotion ? 'auto' : 'smooth' });
  }, [active, l, reducedMotion]);

  const activeSection = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  const navLinkCls = (isActive: boolean) =>
    `flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zion-gold/60 ${
      isActive ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
    }`;

  return (
    <main className="relative min-h-screen">
      {/* ambient orbs — clipped by their own wrapper so sticky nav keeps working */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-zion-purple/12 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[480px] w-[480px] rounded-full bg-zion-gold/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[420px] w-[420px] rounded-full bg-zion-cyan/8 blur-3xl" />
      </div>

      {/* ─── HERO ─── */}
      <section className="relative z-10 px-4 pt-6 sm:pt-8">
        <div className="zion-container max-w-7xl">
          <motion.header
            initial={reducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="zion-rainbow-card relative overflow-hidden p-6 md:p-8"
            style={{ '--rc': '168, 85, 247' } as React.CSSProperties}
          >
            <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-zion-purple/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-zion-gold/10 blur-3xl" />

            <div className="relative grid items-center gap-6 lg:grid-cols-1">
              <div className="space-y-3 lg:mx-auto lg:w-4/5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="zion-kicker border-zion-gold/30 bg-zion-gold/10 text-zion-gold">
                    <Egg className="h-3.5 w-3.5" />
                    {Copy.kicker[l]}
                  </span>
                </div>
                <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                  <span className="text-gradient">{Copy.title[l]}</span>
                </h1>
                <p className="text-base font-semibold text-zion-gold/90 sm:text-lg">
                  {Copy.subtitle[l]}
                </p>
                <p className="max-w-xl text-sm leading-relaxed text-gray-300 sm:text-base">
                  {Copy.lede[l]}
                </p>
                <p className="max-w-xl text-xs italic text-gray-400 sm:text-sm">
                  {Copy.tagline[l]}
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Link href="/zion-archive/cist#prolog" className="zion-button-primary group">
                    <BookOpen className="h-5 w-5" />
                    {Copy.read[l]}
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <a
                    href="#plan-v33"
                    className="zion-button-secondary border-zion-purple/30 hover:border-zion-purple/60 hover:text-zion-purple"
                  >
                    <Route className="h-4 w-4" />
                    {Copy.plan[l]}
                  </a>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 lg:mx-auto lg:w-4/5">
                <img
                  src="/images/zion-archive/hero.webp"
                  srcSet="/images/zion-archive/hero-m.webp 960w, /images/zion-archive/hero.webp 1536w"
                  sizes="(max-width: 1024px) calc(100vw - 4rem), 1024px"
                  alt={Copy.heroAlt[l]}
                  width={1536}
                  height={1024}
                  fetchPriority="high"
                  className="w-full object-cover"
                />
              </div>
            </div>
          </motion.header>
        </div>
      </section>

      {/* ─── HUB: section nav + one panel ─── */}
      <section className="relative z-10 px-4 pb-16 pt-8 sm:pb-20">
        <div className="zion-container max-w-7xl">
          {/* mobile section nav — sticky single-row pills under the global nav */}
          <nav
            ref={mobileNavRef}
            aria-label={Copy.navLabel[l]}
            className="sticky top-14 z-30 -mx-4 mb-6 overflow-x-auto border-b border-white/10 bg-black/70 px-4 py-2 backdrop-blur-xl lg:hidden"
          >
            <div className="flex w-max gap-2">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const isActive = active === s.id;
                return (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    aria-current={isActive ? 'true' : undefined}
                    className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zion-gold/60 ${
                      isActive
                        ? 'border-zion-gold/50 bg-zion-gold/15 text-zion-gold'
                        : 'border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {s.label[l]}
                  </a>
                );
              })}
            </div>
          </nav>

          {/* mobile library directory — expandable book tree */}
          <details className="zion-rainbow-card group mb-6 lg:hidden">
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
              <Library className="h-4 w-4 text-zion-gold" />
              {Copy.libraryLabel[l]}
              <span className="ml-auto text-xs text-gray-500 transition-transform group-open:rotate-180">▾</span>
            </summary>
            <div className="max-h-[60vh] overflow-y-auto border-t border-white/10 p-3">
              <BookNav lang={l} />
            </div>
          </details>

          <div className="flex gap-8">
            {/* desktop sidebar — sections + whole-library directory */}
            <aside className="hidden w-72 shrink-0 lg:block">
              <div className="sticky top-24 space-y-4">
                <nav
                  aria-label={Copy.navLabel[l]}
                  className="zion-rainbow-card space-y-1 p-3"
                  style={{ '--rc': activeSection.rc } as React.CSSProperties}
                >
                  {SECTIONS.map((s) => {
                    const Icon = s.icon;
                    const isActive = active === s.id;
                    return (
                      <a
                        key={s.id}
                        href={`#${s.id}`}
                        aria-current={isActive ? 'true' : undefined}
                        className={navLinkCls(isActive)}
                      >
                        <Icon
                          className="h-4 w-4 shrink-0"
                          style={isActive ? { color: `rgb(${s.rc})` } : undefined}
                        />
                        {s.label[l]}
                      </a>
                    );
                  })}
                </nav>

                <div
                  aria-label={Copy.libraryLabel[l]}
                  className="zion-rainbow-card max-h-[calc(100vh-420px)] overflow-y-auto p-3"
                >
                  <p className="mb-2 flex items-center gap-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-zion-gold">
                    <Library className="h-3.5 w-3.5" />
                    {Copy.libraryLabel[l]}
                  </p>
                  <BookNav lang={l} expandAll />
                </div>
              </div>
            </aside>

            {/* active panel */}
            <div className="min-w-0 flex-1">
              <motion.div
                key={active}
                initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
              >
                {active === 'cesta' && <CestaPanel lang={l} />}
                {active === 'kniha' && <KnihaPanel lang={l} />}
                {active === 'nirvana' && <NirvanaPanel lang={l} />}
                {active === 'plan-v33' && <PlanPanel lang={l} />}
                {active === 'spolecnici' && <SpolecniciPanel lang={l} />}
                {active === 'souvislosti' && <SouvislostiPanel lang={l} />}
              </motion.div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
