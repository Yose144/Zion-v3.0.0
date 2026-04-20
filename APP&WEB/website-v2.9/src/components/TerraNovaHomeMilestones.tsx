'use client';

import Link from 'next/link';
import { ArrowRight, Compass } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const MILESTONES = [
  {
    year: '2026', emoji: '🟡', labelCs: 'L1 Genesis', labelEn: 'L1 Genesis',
    color: '#FFD700', rgb: '255,215,0',
    checks: [
      { done: true,  text: 'Čistý Rust codebase — auditovatelný' },
      { done: true,  text: 'Multi-kontinentální testovací cyklus' },
      { done: true,  text: 'Desktop agent — macOS, Windows, Linux' },
      { done: true,  text: 'Website a dokumentace live' },
      { done: true,  text: 'Base mainnet bridge ověřen, relay aktivní' },
      { done: false, text: 'Finální whitepaper PDF' },
      { done: false, text: 'Genesis freeze + bezpečnostní audit' },
      { done: false, text: '★ VEŘEJNÝ LAUNCH — Q4 2026' },
    ],
  },
  {
    year: '2027', emoji: '🔵', labelCs: 'L2 Ekosystém', labelEn: 'L2 Ecosystem',
    color: '#60A5FA', rgb: '96,165,250',
    checks: [
      { done: false, text: 'Veřejná wZION likvidita na Base' },
      { done: false, text: 'DAO governance — první hlasování' },
      { done: false, text: 'Hiranyagarbha AI v2 s pamětí' },
      { done: false, text: '10+ aktivních Terra Nova komunit' },
    ],
  },
  {
    year: '2028', emoji: '🟢', labelCs: 'L4 OASIS', labelEn: 'L4 OASIS',
    color: '#34D399', rgb: '52,211,153',
    checks: [
      { done: false, text: 'OASIS whitepaper a Unreal Engine 5 prototyp' },
      { done: false, text: 'Golden Egg hunt — 108 indicií' },
      { done: false, text: 'OASIS beta — 10 000 hráčů' },
    ],
  },
  {
    year: '2030', emoji: '🌍', labelCs: 'L5 Svoboda', labelEn: 'L5 Freedom',
    color: '#A78BFA', rgb: '167,139,250',
    checks: [
      { done: false, text: '100 Terra Nova komunit na všech kontinentech' },
      { done: false, text: 'Humanitární fond: $1M+ měsíčně' },
      { done: false, text: 'Zlatá republika — první soběstačná komuna' },
    ],
  },
  {
    year: '2040+', emoji: '🔭', labelCs: 'L6 Issobella', labelEn: 'L6 Issobella',
    color: '#F472B6', rgb: '244,114,182',
    checks: [
      { done: false, text: 'Orbitální studie (NASA/ESA/ISRO)' },
      { done: false, text: 'Station Module 1 — launch na oběžnou dráhu' },
      { done: false, text: 'METI — první poselství lidstva ke hvězdám' },
    ],
  },
];

export default function TerraNovaHomeMilestones() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <section className="relative py-20 px-4 overflow-hidden">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[500px] w-[700px] rounded-full blur-[200px] bg-zion-gold/5" />
      </div>

      <div className="zion-container relative">
        {/* Header */}
        <div className="mb-12 flex flex-col items-start gap-3">
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.4em] text-gray-400">
            <Compass className="w-4 h-4 text-zion-gold" />
            <span>{cs ? 'Zlatý Kompas · Akcelerační mapa' : 'Golden Compass · Acceleration Map'}</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold">
            <span className="text-gradient">Terra Nova</span>
          </h2>
          <p className="text-lg text-gray-300 max-w-2xl">
            {cs
              ? 'Od mainnet genesis ke hvězdám — pět fází, jeden cíl: svobodná, vědomá civilizace.'
              : 'From mainnet genesis to the stars — five phases, one goal: a free, conscious civilisation.'}
          </p>
        </div>

        {/* Timeline strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-10">
          {MILESTONES.map((m) => {
            const total = m.checks.length;
            const done = m.checks.filter((c) => c.done).length;
            const pct = Math.round((done / total) * 100);
            return (
              <div
                key={m.year}
                className="rounded-2xl border p-4 text-center space-y-2 hover:scale-[1.02] transition-transform duration-300"
                style={{ borderColor: `rgba(${m.rgb},0.22)`, backgroundColor: `rgba(${m.rgb},0.04)` }}
              >
                <div className="text-2xl">{m.emoji}</div>
                <p className="text-xs font-bold tracking-wider" style={{ color: m.color }}>{m.year}</p>
                <p className="text-xs font-semibold text-white/80">{cs ? m.labelCs : m.labelEn}</p>
                {/* progress bar */}
                <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: m.color }}
                  />
                </div>
                <p className="text-[10px]" style={{ color: m.color }}>{done}/{total}</p>
              </div>
            );
          })}
        </div>

        {/* Checklist grid */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 mb-10">
          {MILESTONES.map((m) => (
            <div
              key={m.year + '-card'}
              className="rounded-2xl border p-5 space-y-3"
              style={{ borderColor: `rgba(${m.rgb},0.15)`, backgroundColor: `rgba(${m.rgb},0.03)` }}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{m.emoji}</span>
                <span className="text-xs font-bold tracking-widest" style={{ color: m.color }}>{m.year}</span>
                <span className="text-sm font-semibold text-white/80">{cs ? m.labelCs : m.labelEn}</span>
              </div>
              <ul className="space-y-1.5">
                {m.checks.map((c, ci) => (
                  <li key={ci} className="flex items-start gap-2">
                    <span
                      className="shrink-0 mt-0.5 text-sm"
                      style={{ color: c.done ? m.color : 'rgba(255,255,255,0.15)' }}
                    >
                      {c.done ? '✅' : '⬜'}
                    </span>
                    <span
                      className="text-[11px] leading-snug"
                      style={{
                        color: c.done ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)',
                        fontWeight: c.text.startsWith('★') ? 700 : 400,
                      }}
                    >
                      {c.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/terranova"
            className="inline-flex items-center gap-2.5 rounded-2xl border border-zion-gold/30 bg-zion-gold/10 px-8 py-3.5 text-sm font-semibold text-zion-gold hover:bg-zion-gold/20 transition-all duration-300"
          >
            {cs ? 'Číst celou knihu Terra Nova' : 'Read the full Terra Nova book'}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
