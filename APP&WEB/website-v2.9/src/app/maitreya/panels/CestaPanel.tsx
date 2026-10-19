'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, Atom, BookOpen, Compass, Egg, Flag, Flame, Globe, MapPin, Mountain, Ship, Sun } from 'lucide-react';
import { MAIN_BOOKS } from '../library';
import { Panel, PanelHeader, type Lang } from './shared';

const Copy = {
  kicker: { cs: 'Cesta knih', en: 'The path of the books' },
  title: { cs: 'Knihy a pořadí', en: 'Books & reading order' },
  sub: {
    cs: 'Šest knih — šest bran jedné cesty. Mantra Srdeční sútry je čte postupně, šesti slovy: gate, gate, pāragate, pārasaṃgate, bodhi, svāhā — odešlá, až na druhý břeh, „ať se stane".',
    en: 'Six books — six gates of one path. The Heart Sutra mantra walks them one by one, in six words: gate, gate, pāragate, pārasaṃgate, bodhi, svāhā — gone, all the way to the other shore, “so be it”.',
  },
  read: { cs: 'Číst', en: 'Read' },
  about: { cs: 'O knize', en: 'About the book' },
  open: { cs: 'Otevřít knihu', en: 'Open the book' },
  here: { cs: 'jste zde', en: 'you are here' },
  goal: { cs: 'cíl cesty', en: 'the destination' },
  mantraNote: {
    cs: 'Přiřazení slov mantry ke knihám je literární mapa cesty — netvrdíme žádnou tradiční buddhistickou korespondenci.',
    en: 'The mantra-to-book mapping is a literary navigation device — we claim no traditional Buddhist correspondence.',
  },
  compassKicker: { cs: 'Kompas knih', en: 'The compass of the books' },
  compassTitle: { cs: 'Čtyři strany a posvátný střed', en: 'Four directions and a sacred center' },
  compassSub: {
    cs: 'Kompas ZION má čtyři světové strany — a Západ je jediný bod: Terra Nova & Nirvana. Maitreya není bod, je to loď, která tam pluje.',
    en: 'The ZION Compass has four cardinal points — and the West is a single one: Terra Nova & Nirvana. Maitreya is not a point — it is the ship sailing there.',
  },
  north: { cs: 'Sever · Genesis', en: 'North · Genesis' },
  east: { cs: 'Východ · Quantum Revolution', en: 'East · Quantum Revolution' },
  south: { cs: 'Jih · Ekam Deeksha', en: 'South · Ekam Deeksha' },
  west: { cs: 'Západ · Terra Nova & Nirvana', en: 'West · Terra Nova & Nirvana' },
  center: { cs: 'Střed · Sůl této země', en: 'Center · The Salt of this Earth' },
  ship: { cs: 'Maitreya — loď plující Západem', en: 'Maitreya — the ship sailing West' },
};

const COMPASS = [
  { dir: Copy.north, icon: Egg, href: '/genesis', enHref: '/genesis', rc: '252, 209, 22' },
  { dir: Copy.east, icon: Atom, href: '/quantum-revolution', enHref: '/quantum-revolution', rc: '6, 182, 212' },
  { dir: Copy.south, icon: Flame, href: '/ekam', enHref: '/ekam', rc: '168, 85, 247' },
  { dir: Copy.west, icon: Sun, href: '/nirvana/cist', enHref: '/nirvana/cist', rc: '251, 146, 60' },
  {
    dir: Copy.center,
    icon: Mountain,
    href: '/docs/view/korpus/SulZeme/00-README.md',
    enHref: '/docs/view/korpus/SulZeme/00-README_EN.md',
    rc: '52, 211, 153',
  },
];

export default function CestaPanel({ lang }: { lang: Lang }) {
  const l = lang;
  return (
    <Panel id="cesta">
      <div className="space-y-8">
        <PanelHeader
          id="cesta"
          rc="6, 182, 212"
          kicker={Copy.kicker[l]}
          title={Copy.title[l]}
          sub={Copy.sub[l]}
        />

        {/* ordered spine */}
        <ol className="space-y-3">
          {MAIN_BOOKS.map((b) => (
            <li key={b.id}>
              <div
                className={`flex flex-wrap items-start gap-4 rounded-2xl border p-4 sm:p-5 ${
                  b.marker === 'here'
                    ? 'border-zion-gold/40 bg-zion-gold/[0.06]'
                    : b.marker === 'goal'
                      ? 'border-dashed border-amber-400/30 bg-amber-500/[0.03]'
                      : 'border-white/8 bg-white/[0.02]'
                }`}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold"
                  style={{
                    borderColor: `rgba(${b.rc}, 0.4)`,
                    backgroundColor: `rgba(${b.rc}, 0.12)`,
                    color: `rgb(${b.rc})`,
                  }}
                >
                  {b.position}
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-lg border px-2 py-0.5 font-mono text-[11px] italic"
                      style={{ borderColor: `rgba(${b.rc}, 0.35)`, color: `rgb(${b.rc})` }}
                    >
                      {b.mantra}
                    </span>
                    {b.marker === 'here' && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-zion-gold/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-zion-gold">
                        <MapPin className="h-3 w-3" />
                        {Copy.here[l]}
                      </span>
                    )}
                    {b.marker === 'goal' && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-amber-300">
                        <Flag className="h-3 w-3" />
                        {Copy.goal[l]}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-white">{b.title[l]}</h3>
                  <p className="text-sm leading-relaxed text-gray-500">{b.role[l]}</p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Link
                      href={b.readHref}
                      className="group inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
                      style={{
                        borderColor: `rgba(${b.rc}, 0.4)`,
                        color: `rgb(${b.rc})`,
                        backgroundColor: `rgba(${b.rc}, 0.08)`,
                      }}
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      {b.id === 'terranova' ? Copy.open[l] : Copy.read[l]}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                    {b.aboutHref && (
                      <Link
                        href={b.aboutHref}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-400 transition-colors hover:border-white/25 hover:text-gray-200"
                      >
                        {Copy.about[l]}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-xs italic leading-relaxed text-gray-500">{Copy.mantraNote[l]}</p>

        {/* compact compass */}
        <div
          className="zion-rainbow-sub space-y-4 p-5 sm:p-6"
          style={{ '--rc': '6, 182, 212' } as CSSProperties}
        >
          <div className="space-y-1.5">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-zion-cyan">
              <Compass className="h-3.5 w-3.5" />
              {Copy.compassKicker[l]}
            </p>
            <h3 className="text-lg font-bold text-white">{Copy.compassTitle[l]}</h3>
            <p className="text-sm leading-relaxed text-gray-400">{Copy.compassSub[l]}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {COMPASS.map((c) => {
              const Icon = c.icon;
              return (
                <Link
                  key={c.dir.cs}
                  href={l === 'en' ? c.enHref : c.href}
                  className="group flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-3 transition-colors hover:border-white/25"
                >
                  <Icon
                    className="h-4 w-4 shrink-0"
                    style={{ color: `rgb(${c.rc})` } as CSSProperties}
                  />
                  <span className="min-w-0 text-xs font-semibold leading-snug text-gray-300 transition-colors group-hover:text-white">
                    {c.dir[l]}
                  </span>
                </Link>
              );
            })}
          </div>
          <a
            href="#kniha"
            className="group flex items-center gap-3 rounded-xl border border-zion-gold/30 bg-zion-gold/[0.05] p-3.5 transition-colors hover:border-zion-gold/50"
          >
            <Ship className="h-5 w-5 shrink-0 text-zion-gold" />
            <p className="flex-1 text-sm font-semibold text-white">{Copy.ship[l]}</p>
            <ArrowRight className="h-4 w-4 text-zion-gold transition-transform group-hover:translate-x-1" />
          </a>
        </div>
      </div>
    </Panel>
  );
}
