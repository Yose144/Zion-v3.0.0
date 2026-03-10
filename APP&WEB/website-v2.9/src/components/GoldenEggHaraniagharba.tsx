'use client';

import Link from 'next/link';
import { ArrowRight, Atom, Brain, Landmark, Orbit, Sparkles, Sprout, Stars } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { EKAM_GOLDEN_EGG_IMAGE, EKAM_SOURCE_URL } from '@/lib/site';
import { tr } from '@/lib/translations';

export default function GoldenEggHaraniagharba() {
  const { lang } = useLang();

  const museumPath = [
    {
      label: tr('goldenEgg', 'mini_bigbang', lang),
      description: tr('goldenEgg', 'mini_bigbang_desc', lang),
      Icon: Atom,
    },
    {
      label: tr('goldenEgg', 'mini_life', lang),
      description: tr('goldenEgg', 'mini_life_desc', lang),
      Icon: Sprout,
    },
    {
      label: tr('goldenEgg', 'mini_consciousness', lang),
      description: tr('goldenEgg', 'mini_consciousness_desc', lang),
      Icon: Brain,
    },
    {
      label: tr('goldenEgg', 'mini_ekam', lang),
      description: tr('goldenEgg', 'mini_ekam_desc', lang),
      Icon: Landmark,
    },
  ];

  return (
    <section className="relative px-4 py-12 md:py-16">
      <div className="zion-container">
        <div className="relative overflow-hidden rounded-4xl border border-amber-300/20 bg-[radial-gradient(circle_at_top,rgba(255,214,102,0.18),rgba(18,12,6,0.94)_55%,rgba(4,4,8,0.98)_100%)] p-6 shadow-[0_24px_120px_rgba(0,0,0,0.45)] md:p-8">
          <div className="absolute -right-10 top-[-60px] h-44 w-44 rounded-full bg-amber-300/15 blur-3xl" />
          <div className="absolute -bottom-20 -left-5 h-52 w-52 rounded-full bg-zion-purple/10 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-[28px] border border-amber-200/20 bg-black/30 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
                <img
                  src={EKAM_GOLDEN_EGG_IMAGE}
                  alt="Ekam visual used as Golden Egg inspiration"
                  className="aspect-4/5 w-full object-cover object-center"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100">
                    <Sparkles className="h-3.5 w-3.5 text-zion-gold" />
                    {tr('goldenEgg', 'visual_badge', lang)}
                  </div>
                  <p className="mt-3 max-w-sm text-sm leading-relaxed text-gray-200">
                    {tr('goldenEgg', 'visual_text', lang)}
                  </p>
                </div>
              </div>
              <a
                href={EKAM_SOURCE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-amber-100/70 transition hover:text-amber-100"
              >
                {tr('goldenEgg', 'source', lang)}
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-200/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.32em] text-amber-200">
                <Orbit className="h-4 w-4" />
                {tr('goldenEgg', 'badge', lang)}
              </div>

              <div>
                <p className="text-sm uppercase tracking-[0.4em] text-amber-100/60">{tr('goldenEgg', 'signal', lang)}</p>
                <h2 className="mt-3 text-3xl font-semibold text-white md:text-5xl">
                  {tr('goldenEgg', 'title', lang)}
                  <span className="block bg-linear-to-r from-amber-200 via-zion-gold to-orange-300 bg-clip-text text-transparent">
                    {tr('goldenEgg', 'title_emphasis', lang)}
                  </span>
                </h2>
              </div>

              <p className="max-w-2xl text-base leading-relaxed text-gray-300 md:text-lg">
                {tr('goldenEgg', 'lead', lang)}
              </p>

              <p className="max-w-2xl text-sm leading-relaxed text-gray-400 md:text-base">
                {tr('goldenEgg', 'support', lang)}
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-black/20 p-5 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.28em] text-amber-100/60">{tr('goldenEgg', 'what_title', lang)}</p>
                  <p className="mt-3 text-base font-semibold text-white">{tr('goldenEgg', 'what_head', lang)}</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">
                    {tr('goldenEgg', 'what_body', lang)}
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-black/20 p-5 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.28em] text-amber-100/60">{tr('goldenEgg', 'ekam_title', lang)}</p>
                  <p className="mt-3 text-base font-semibold text-white">{tr('goldenEgg', 'ekam_head', lang)}</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400">
                    {tr('goldenEgg', 'ekam_body', lang)}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500">{tr('goldenEgg', 'card_signal_label', lang)}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{tr('goldenEgg', 'card_signal_title', lang)}</p>
                  <p className="text-sm text-gray-400">{tr('goldenEgg', 'card_signal_body', lang)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500">{tr('goldenEgg', 'card_visual_label', lang)}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{tr('goldenEgg', 'card_visual_title', lang)}</p>
                  <p className="text-sm text-gray-400">{tr('goldenEgg', 'card_visual_body', lang)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500">{tr('goldenEgg', 'card_perf_label', lang)}</p>
                  <p className="mt-2 text-lg font-semibold text-white">{tr('goldenEgg', 'card_perf_title', lang)}</p>
                  <p className="text-sm text-gray-400">{tr('goldenEgg', 'card_perf_body', lang)}</p>
                </div>
              </div>

              <div className="rounded-[28px] border border-amber-200/15 bg-[linear-gradient(135deg,rgba(255,215,120,0.10),rgba(255,255,255,0.02))] p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-amber-100/70">
                  <Stars className="h-4 w-4 text-zion-gold" />
                  {tr('goldenEgg', 'path_badge', lang)}
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{tr('goldenEgg', 'path_symbol', lang)}</p>
                    <p className="mt-2 text-sm leading-relaxed text-gray-400">
                      {tr('goldenEgg', 'path_symbol_body', lang)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{tr('goldenEgg', 'path_sanctuary', lang)}</p>
                    <p className="mt-2 text-sm leading-relaxed text-gray-400">
                      {tr('goldenEgg', 'path_sanctuary_body', lang)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{tr('goldenEgg', 'path_museum', lang)}</p>
                    <p className="mt-2 text-sm leading-relaxed text-gray-400">
                      {tr('goldenEgg', 'path_museum_body', lang)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/60">
                    {tr('goldenEgg', 'mini_label', lang)}
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-4">
                    {museumPath.map(({ label, description, Icon }, index) => (
                      <div key={label} className="relative rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-200/30 bg-amber-200/10 text-xs font-semibold text-amber-100">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">{label}</p>
                            <p className="mt-1 text-xs leading-relaxed text-gray-400">{description}</p>
                          </div>
                        </div>
                        {index < museumPath.length - 1 ? (
                          <div className="pointer-events-none absolute -right-2.5 top-1/2 hidden h-px w-5 -translate-y-1/2 bg-linear-to-r from-amber-200/50 to-transparent md:block" />
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-gray-400">
                    {tr('goldenEgg', 'mini_caption', lang)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="#tree-of-life"
                  className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-amber-300 via-zion-gold to-orange-400 px-6 py-3 text-sm font-semibold text-black"
                >
                  <Stars className="h-4 w-4" />
                  {tr('goldenEgg', 'cta_tree', lang)}
                </Link>
                <Link
                  href="/ekam"
                  className="inline-flex items-center gap-2 rounded-2xl border border-amber-200/20 bg-amber-200/10 px-6 py-3 text-sm font-semibold text-amber-50 hover:border-amber-200/35"
                >
                  {tr('goldenEgg', 'cta_museum', lang)}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/network"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:border-white/30"
                >
                  {tr('goldenEgg', 'cta_network', lang)}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
