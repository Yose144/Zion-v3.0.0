'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, BookOpen, Shield, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useLang } from '@/contexts/LanguageContext';
import ZlatyKompas, { DIRECTIONS } from '@/components/ZlatyKompas';

const KompasKompasPageClientCopy = {
  clickADirectionForDetail: { cs: `Klikni na směr pro detail`, en: `Click a direction for detail` },
  close: { cs: `Zavřít`, en: `Close` },
  question: { cs: `Otázka`, en: `Question` },
  selectADirectionOnTheCompass: { cs: `Vyber směr na kompasu →`, en: `Select a direction on the compass →` },
  allSevenDirections: { cs: `Všech sedm směrů`, en: `All seven directions` },
  inner: { cs: `Vnitřní`, en: `Inner` },
  outer: { cs: `Vnější`, en: `Outer` },
};

/* ═══════════════════════════════════════════════════════════
   /kompas — Zlatý Kompas TerraNova
   Seven directions for orientation, not decoration
   ═══════════════════════════════════════════════════════════ */

const copy = {
  badge: { cs: 'TerraNova · Část VII', en: 'TerraNova · Part VII' },
  heading: { cs: 'Zlatý Kompas', en: 'Golden Compass' },
  subtitle: {
    cs: 'Sedm směrů pro orientaci — ne jako seznam KPI, ale jako forma orientace pro lidi, kteří chtějí vědět, kde je začátek.',
    en: 'Seven directions for orientation — not as a KPI list, but as a form of guidance for those who want to know where the beginning is.',
  },
  intro: {
    cs: 'Kompas není určen k obdivu. Má být nošen, obracen, zpochybňován, znovu čten a čas od času i opraven, pokud se ukáže, že některá z jeho ručiček začala ukazovat na přání místo na sever.',
    en: 'The Compass is not meant for admiration. It is meant to be carried, turned, questioned, re-read, and occasionally corrected if one of its hands starts pointing toward wishes instead of north.',
  },
  north_label: { cs: 'Sever TerraNova', en: 'TerraNova\'s North' },
  north: {
    cs: 'Sever TerraNova není moc. Je jím vědomí, které se učí být pravdivé, sdílející a stavební zároveň.',
    en: 'TerraNova\'s north is not power. It is consciousness learning to be truthful, sharing, and constructive at the same time.',
  },
  guardian_title: { cs: 'Kdo je Guardian', en: 'Who is a Guardian' },
  guardian: {
    cs: 'Guardian není třída, kasta ani heroický titul. Je to člověk, který se rozhodl nést část světa vědoměji než dřív. Někdo to dělá v kódu. Někdo v krajině. Někdo v péči. Někdo v překladu idejí.',
    en: 'A Guardian is not a class, a caste, or a heroic title. It is a person who has decided to carry a part of the world more consciously than before. Some do it in code. Some in landscape. Some in care. Some in the translation of ideas.',
  },
  success_title: { cs: 'Co bude znamenat úspěch', en: 'What success will mean' },
  success: {
    cs: 'Úspěch bude spočívat v tom, že jednotlivé vrstvy přestanou být od sebe oddělené. Že člověk, který čte o hvězdách, zároveň chápe půdu. Že komunita není v opozici vůči technologii. Že AI není v opozici vůči lidskosti.',
    en: 'Success will lie in the fact that individual layers will stop being separated from each other. That a person reading about stars also understands the soil. That community is not opposed to technology. That AI is not opposed to humanity.',
  },
  movement_title: { cs: 'Dvojí pohyb', en: 'Dual Movement' },
  movement_inner: {
    cs: 'Vnitřní: zpřesnění motivu, vztahu, role a míry.',
    en: 'Inner: refinement of motive, relationship, role, and measure.',
  },
  movement_outer: {
    cs: 'Vnější: runtime disciplína, komunitní piloty, infrastruktura, dokumentace, péče, iterace.',
    en: 'Outer: runtime discipline, community pilots, infrastructure, documentation, care, iteration.',
  },
  docs_link: { cs: 'Číst celou knihu TerraNova', en: 'Read the full TerraNova book' },
} as const;

function t(key: keyof typeof copy, lang: string): string {
  const entry = copy[key] as { cs: string; en: string };
  return lang === 'cs' ? entry.cs : entry.en;
}

export default function KompasPageClient() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = useCallback((i: number | null) => setSelected(i), []);

  const dir = selected !== null ? DIRECTIONS[selected] : null;

  return (
    <div className="zion-shell min-h-screen pt-28 md:pt-32 pb-24 overflow-x-hidden">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full blur-[200px] bg-zion-gold/8" />
        <div className="absolute -right-40 top-2/3 h-[400px] w-[400px] rounded-full blur-[200px] bg-zion-purple/6" />
        <div className="absolute left-1/2 top-0 h-48 w-full -translate-x-1/2 bg-linear-to-b from-zion-gold/10 to-transparent" />
      </div>

      <div className="relative z-10 zion-container max-w-6xl space-y-16">
        {/* ═══════ HERO ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-6"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-4 py-1.5 text-xs font-semibold tracking-[0.3em] text-zion-gold uppercase">
            <Compass className="h-4 w-4" />
            {t('badge', lang)}
          </div>

          <h1 className="zion-page-heading text-gradient">
            {t('heading', lang)}
          </h1>

          <p className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
            {t('subtitle', lang)}
          </p>
        </motion.section>

        {/* ═══════ COMPASS + DETAIL SPLIT ═══════ */}
        <motion.section
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative"
        >
          <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
            {/* Compass panel */}
            <div style={{ '--rc': '252, 209, 22' } as React.CSSProperties} className="zion-rainbow-card rounded-3xl md:rounded-4xl p-6 md:p-8 relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(252,209,22,0.15),transparent_70%)]" />
              </div>
              <div className="relative">
                <p className="text-center text-xs uppercase tracking-[0.4em] text-gray-500 mb-4">
                  {KompasKompasPageClientCopy.clickADirectionForDetail[cs ? 'cs' : 'en']}
                </p>
                <ZlatyKompas selected={selected} onSelect={handleSelect} />
              </div>
            </div>

            {/* Detail sidebar (desktop) — collapses below on mobile */}
            <div className="hidden lg:block min-h-[400px]">
              <AnimatePresence mode="wait">
                {dir ? (
                  <motion.div
                    key={dir.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.3 }}
                    className="sticky top-32 zion-section p-6 space-y-5 shadow-[0_20px_80px_rgba(0,0,0,0.5)]"
                    style={{ borderColor: `rgba(${dir.rgb},0.2)` }}
                  >
                    <button
                      onClick={() => setSelected(null)}
                      className="absolute top-4 right-4 p-1.5 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-white transition-colors"
                      aria-label={KompasKompasPageClientCopy.close[cs ? 'cs' : 'en']}
                    >
                      <X className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-3">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl border"
                        style={{
                          borderColor: `rgba(${dir.rgb},0.35)`,
                          backgroundColor: `rgba(${dir.rgb},0.1)`,
                          color: dir.color,
                        }}
                      >
                        {dir.symbol}
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">{cs ? `Směr ${selected! + 1}/7` : `Direction ${selected! + 1}/7`}</p>
                        <h3 className="text-lg font-semibold" style={{ color: dir.color }}>
                          {cs ? dir.titleCs : dir.titleEn}
                        </h3>
                      </div>
                    </div>

                    <div className="h-px w-full" style={{ background: `linear-gradient(to right, rgba(${dir.rgb},0.3), transparent)` }} />

                    <p className="text-gray-300 leading-relaxed text-[15px]">
                      {cs ? dir.descCs : dir.descEn}
                    </p>

                    <div className="zion-tile p-4">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500 mb-1">
                        {KompasKompasPageClientCopy.question[cs ? 'cs' : 'en']}
                      </p>
                      <p className="text-sm text-gray-400 italic">
                        {cs
                          ? `Kde ve svém projektu teď potřebuji více ${dir.titleCs.toLowerCase()}i?`
                          : `Where in your project do you need more ${dir.titleEn.toLowerCase()} right now?`}
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="zion-section flex items-center justify-center h-full min-h-[400px] border-dashed"
                  >
                    <p className="text-gray-600 text-sm text-center px-6">
                      {KompasKompasPageClientCopy.selectADirectionOnTheCompass[cs ? 'cs' : 'en']}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Detail panel — mobile only */}
          <div className="lg:hidden mt-4">
            <AnimatePresence>
              {dir && (
                <motion.div
                  key={dir.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.25 }}
                  className="zion-section p-5 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
                  style={{ borderColor: `rgba(${dir.rgb},0.2)` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl" style={{ color: dir.color }}>{dir.symbol}</span>
                      <h3 className="text-lg font-semibold" style={{ color: dir.color }}>
                        {cs ? dir.titleCs : dir.titleEn}
                      </h3>
                    </div>
                    <button
                      onClick={() => setSelected(null)}
                      className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-gray-300 leading-relaxed">{cs ? dir.descCs : dir.descEn}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.section>

        {/* ═══════ DIRECTION CARDS GRID ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <p className="text-xs uppercase tracking-[0.4em] text-gray-500 mb-5 text-center">
            {KompasKompasPageClientCopy.allSevenDirections[cs ? 'cs' : 'en']}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {DIRECTIONS.map((d, i) => {
              const isActive = selected === i;
              return (
                <button
                  key={d.id}
                  onClick={() => setSelected(isActive ? null : i)}
                  className="group rounded-2xl border p-4 text-left transition-all duration-300"
                  style={{
                    borderColor: isActive ? `rgba(${d.rgb},0.35)` : 'rgba(255,255,255,0.06)',
                    backgroundColor: isActive ? `rgba(${d.rgb},0.06)` : 'rgba(0,0,0,0.3)',
                  }}
                >
                  <span
                    className="text-xl mb-2 block transition-transform duration-300 group-hover:scale-110"
                    style={{ color: isActive ? d.color : 'rgba(255,255,255,0.3)' }}
                  >
                    {d.symbol}
                  </span>
                  <p
                    className="text-sm font-semibold transition-colors"
                    style={{ color: isActive ? d.color : 'rgba(255,255,255,0.6)' }}
                  >
                    {cs ? d.titleCs : d.titleEn}
                  </p>
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* ═══════ TRUE NORTH ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
          className="zion-rainbow-card rounded-3xl p-6 md:p-10 text-center"
        >
          <div className="inline-flex items-center gap-2 text-zion-gold mb-4">
            <Sparkles className="w-5 h-5" />
            <span className="text-xs uppercase tracking-[0.3em] font-semibold">
              {t('north_label', lang)}
            </span>
          </div>
          <blockquote className="text-xl md:text-2xl text-gray-200 leading-relaxed max-w-2xl mx-auto font-light italic">
            &ldquo;{t('north', lang)}&rdquo;
          </blockquote>
        </motion.section>

        {/* ═══════ CONTEXT CARDS ═══════ */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Guardian */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
            className="zion-rainbow-sub rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zion-purple/15 border border-zion-purple/30 flex items-center justify-center">
                <Shield className="w-5 h-5 text-zion-purple" />
              </div>
              <h2 className="text-lg font-semibold text-white">
                {t('guardian_title', lang)}
              </h2>
            </div>
            <p className="text-gray-400 leading-relaxed">
              {t('guardian', lang)}
            </p>
          </motion.div>

          {/* Success */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
            className="zion-rainbow-sub rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-zion-cyan/15 border border-zion-cyan/30 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-zion-cyan" />
              </div>
              <h2 className="text-lg font-semibold text-white">
                {t('success_title', lang)}
              </h2>
            </div>
            <p className="text-gray-400 leading-relaxed">
              {t('success', lang)}
            </p>
          </motion.div>
        </div>

        {/* ═══════ DUAL MOVEMENT ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ '--rc': '252, 209, 22' } as React.CSSProperties}
          className="zion-rainbow-card rounded-3xl p-6 md:p-10"
        >
          <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
            <Compass className="w-5 h-5 text-zion-gold" />
            {t('movement_title', lang)}
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-[0.3em] text-zion-gold mb-2 font-semibold">
                {KompasKompasPageClientCopy.inner[cs ? 'cs' : 'en']}
              </p>
              <p className="text-gray-300 leading-relaxed">
                {t('movement_inner', lang)}
              </p>
            </div>
            <div className="zion-rainbow-sub p-5" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
              <p className="text-xs uppercase tracking-[0.3em] text-zion-cyan mb-2 font-semibold">
                {KompasKompasPageClientCopy.outer[cs ? 'cs' : 'en']}
              </p>
              <p className="text-gray-300 leading-relaxed">
                {t('movement_outer', lang)}
              </p>
            </div>
          </div>
        </motion.section>

        {/* ═══════ CLOSING QUOTE ═══════ */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-6"
        >
          <p className="text-gray-400 leading-relaxed max-w-2xl mx-auto italic">
            {t('intro', lang)}
          </p>
          <Link
            href="/terranova"
            className="inline-flex items-center gap-2 rounded-2xl border border-zion-gold/25 bg-zion-gold/8 px-6 py-3 text-sm font-semibold text-zion-gold hover:bg-zion-gold/15 transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            {t('docs_link', lang)}
          </Link>
        </motion.section>
      </div>
    </div>
  );
}
