'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { ArrowRight, Leaf, LoaderCircle, Sparkles } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const TreeOfLifeSwitch = dynamic(() => import('@/components/TreeOfLifeSwitch'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[420px] items-center justify-center zion-rainbow-card text-gray-400" style={{ '--rc': '34, 197, 94' } as React.CSSProperties}>
      <LoaderCircle className="h-5 w-5 animate-spin text-zion-gold" />
    </div>
  ),
});

/* ── Kabbalah Tree of Life — 10 Sephirot ── */
const sephirot = [
  { id: 'keter',     name: 'Keter',     meaning: 'Koruna',       x: 50, y: 8,  color: '255, 255, 255' },
  { id: 'chochmah',  name: 'Chochmah',  meaning: 'Moudrost',     x: 72, y: 22, color: '180, 220, 255' },
  { id: 'binah',     name: 'Binah',     meaning: 'Porozumění',   x: 28, y: 22, color: '147, 51, 234' },
  { id: 'chesed',    name: 'Chesed',    meaning: 'Milosrdenství',x: 72, y: 42, color: '6, 182, 212' },
  { id: 'gevurah',   name: 'Gevurah',   meaning: 'Síla',         x: 28, y: 42, color: '239, 68, 68' },
  { id: 'tiferet',   name: 'Tiferet',   meaning: 'Krása',        x: 50, y: 52, color: '251, 191, 36' },
  { id: 'netzach',   name: 'Netzach',   meaning: 'Věčnost',      x: 72, y: 68, color: '16, 185, 129' },
  { id: 'hod',       name: 'Hod',       meaning: 'Sláva',        x: 28, y: 68, color: '249, 115, 22' },
  { id: 'yesod',     name: 'Yesod',     meaning: 'Základ',       x: 50, y: 80, color: '99, 102, 241' },
  { id: 'malkuth',   name: 'Malkuth',   meaning: 'Království',   x: 50, y: 94, color: '34, 197, 94' },
];

/* 22 connecting paths */
const paths = [
  ['keter','chochmah'], ['keter','binah'], ['keter','tiferet'],
  ['chochmah','binah'], ['chochmah','tiferet'], ['chochmah','chesed'],
  ['binah','tiferet'], ['binah','gevurah'],
  ['chesed','gevurah'], ['chesed','tiferet'], ['chesed','netzach'],
  ['gevurah','tiferet'], ['gevurah','hod'],
  ['tiferet','netzach'], ['tiferet','hod'], ['tiferet','yesod'],
  ['netzach','hod'], ['netzach','yesod'], ['netzach','malkuth'],
  ['hod','yesod'], ['hod','malkuth'],
  ['yesod','malkuth'],
];

function getPos(id: string) {
  return sephirot.find(s => s.id === id)!;
}

export default function HomeTreePortal() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [revealed, setRevealed] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <section id="tree-of-life" className="px-4 py-14 sm:py-16 scroll-mt-28">
      <div className="zion-container space-y-6">
        {/* Header — unified with StoryTriptych style */}
        <div className="text-center space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.36em] text-emerald-400">
            {cs ? 'Kabala · 10 Sephirot · 22 cest' : 'Kabbalah · 10 Sephirot · 22 paths'}
          </p>
          <h2 className="text-3xl font-bold leading-tight text-white sm:text-4xl">
            {cs ? 'Strom života' : 'Tree of Life'}
          </h2>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-gray-400 sm:text-base">
            {cs
              ? 'Deset sfér, jimiž proudí světlo od Keteru k Malkuth. Architektura všeho — od kvantového pole po tvou duši, od blokchainu po strom sám.'
              : 'Ten spheres through which light flows from Keter to Malkuth. The architecture of everything — from the quantum field to your soul, from blockchain to the tree itself.'}
          </p>
        </div>

        {!revealed ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="zion-rainbow-card relative overflow-hidden p-6 md:p-8" style={{ '--rc': '34, 197, 94' } as React.CSSProperties}>
              <div className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center">
                {/* Left: text */}
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-emerald-300">
                    <Sparkles className="h-4 w-4" />
                    {cs ? 'Rychlý náhled' : 'Quick preview'}
                  </div>
                  <p className="text-base leading-relaxed text-gray-300">
                    {cs
                      ? 'Kabalistický Strom života mapuje deset archetypálních sfér — od čistého světla (Keter) až po hmotný svět (Malkuth). Každá sféra je frekvence, atribut i brána. Spojení mezi nimi tvoří 22 cest, jimiž proudí vědomí.'
                      : 'The Kabbalistic Tree of Life maps ten archetypal spheres — from pure light (Keter) to the material world (Malkuth). Each sphere is a frequency, an attribute, a gateway. The connections between them form 22 paths through which consciousness flows.'}
                  </p>
                  <p className="text-sm leading-relaxed text-gray-400">
                    {cs
                      ? 'Stejná struktura se opakuje v 144 000 Guardians, v 10% tithe, v devíti úrovních vědomí. ZION je Strom života přeložený do kódu.'
                      : 'The same structure repeats in 144 000 Guardians, in the 10% tithe, in nine levels of consciousness. ZION is the Tree of Life translated into code.'}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="zion-rainbow-sub p-3" style={{ '--rc': '34, 197, 94' } as React.CSSProperties}>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">{cs ? 'Sfér' : 'Spheres'}</p>
                      <p className="mt-1 text-lg font-bold text-white">10</p>
                    </div>
                    <div className="zion-rainbow-sub p-3" style={{ '--rc': '34, 197, 94' } as React.CSSProperties}>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">{cs ? 'Cest' : 'Paths'}</p>
                      <p className="mt-1 text-lg font-bold text-white">22</p>
                    </div>
                    <div className="zion-rainbow-sub p-3" style={{ '--rc': '34, 197, 94' } as React.CSSProperties}>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">{cs ? 'Pilířů' : 'Pillars'}</p>
                      <p className="mt-1 text-lg font-bold text-white">3</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRevealed(true)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-emerald-500 via-zion-gold to-zion-cyan px-6 py-3 text-sm font-semibold text-white shadow-[0_0_40px_rgba(34,197,94,0.25)] transition-all hover:shadow-[0_0_60px_rgba(34,197,94,0.4)]"
                  >
                    <Leaf className="h-4 w-4" />
                    {cs ? 'Načíst interaktivní scénu' : 'Load interactive scene'}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Right: Kabbalah Tree visualization */}
                <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-2xl border border-emerald-500/15 bg-[radial-gradient(circle_at_50%_15%,rgba(34,197,94,0.15),rgba(10,12,24,0.04)_30%,rgba(1,3,6,0.98)_75%)]">
                  {/* SVG paths */}
                  <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {paths.map(([from, to], i) => {
                      const a = getPos(from);
                      const b = getPos(to);
                      const isHovered = hovered === from || hovered === to;
                      return (
                        <line
                          key={i}
                          x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                          stroke={isHovered ? 'rgba(251,191,36,0.6)' : 'rgba(255,255,255,0.12)'}
                          strokeWidth={isHovered ? 0.5 : 0.25}
                          vectorEffect="non-scaling-stroke"
                          className="transition-all duration-300"
                        />
                      );
                    })}
                  </svg>

                  {/* Sephirot nodes */}
                  {sephirot.map((s, i) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, scale: 0 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: i * 0.08 }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                      style={{ left: `${s.x}%`, top: `${s.y}%` }}
                      onMouseEnter={() => setHovered(s.id)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <div
                        className="flex items-center justify-center rounded-full border-2 transition-all"
                        style={{
                          width: hovered === s.id ? '44px' : '36px',
                          height: hovered === s.id ? '44px' : '36px',
                          borderColor: `rgba(${s.color}, 0.5)`,
                          backgroundColor: `rgba(${s.color}, 0.12)`,
                          boxShadow: hovered === s.id ? `0 0 20px rgba(${s.color}, 0.5)` : `0 0 8px rgba(${s.color}, 0.2)`,
                        }}
                      >
                        <span
                          className="text-[9px] font-bold"
                          style={{ color: `rgb(${s.color})` }}
                        >
                          {i + 1}
                        </span>
                      </div>
                      {/* Label on hover */}
                      {hovered === s.id && (
                        <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/15 bg-black/95 px-2.5 py-1.5 text-center z-20">
                          <p className="text-[10px] font-bold text-white">{s.name}</p>
                          <p className="text-[8px] text-gray-400">{s.meaning}</p>
                        </div>
                      )}
                    </motion.div>
                  ))}

                  {/* Pillar labels */}
                  <div className="absolute bottom-1 left-[28%] -translate-x-1/2 text-[7px] uppercase tracking-wider text-gray-600">Severity</div>
                  <div className="absolute bottom-1 left-[50%] -translate-x-1/2 text-[7px] uppercase tracking-wider text-gray-600">Equilibrium</div>
                  <div className="absolute bottom-1 left-[72%] -translate-x-1/2 text-[7px] uppercase tracking-wider text-gray-600">Mercy</div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <TreeOfLifeSwitch />
        )}
      </div>
    </section>
  );
}
