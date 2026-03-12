'use client';

import Link from 'next/link';
import { ArrowRight, Orbit, Sparkles, Stars } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { EKAM_GOLDEN_EGG_IMAGE, EKAM_SOURCE_URL } from '@/lib/site';
import { tr } from '@/lib/translations';

export default function GoldenEggHaraniagharba() {
  const { lang } = useLang();

  return (
    <section className="relative px-4 py-12 md:py-16">
      <div className="zion-container">
        <div className="relative overflow-hidden rounded-4xl border border-amber-300/20 bg-[radial-gradient(circle_at_top,rgba(255,214,102,0.18),rgba(18,12,6,0.94)_55%,rgba(4,4,8,0.98)_100%)] p-6 shadow-[0_24px_120px_rgba(0,0,0,0.45)] md:p-8">
          <div className="absolute -right-10 top-[-60px] h-44 w-44 rounded-full bg-amber-300/15 blur-3xl" />
          <div className="absolute -bottom-20 -left-5 h-52 w-52 rounded-full bg-zion-purple/10 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            {/* ── Left: Image ── */}
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

            {/* ── Right: Content ── */}
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

              {/* ── Knowledge cards ── */}
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

              {/* ── Virtual Tour teaser ── */}
              <Link
                href="/ekam"
                className="group block rounded-[28px] border border-amber-200/15 bg-[linear-gradient(135deg,rgba(255,215,120,0.10),rgba(255,255,255,0.02))] p-5 transition hover:border-amber-200/30 md:p-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-200/25 bg-amber-200/10">
                      <Stars className="h-5 w-5 text-zion-gold" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-100/70">
                        {tr('goldenEgg', 'tour_badge', lang)}
                      </p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {tr('goldenEgg', 'tour_title', lang)}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-amber-200/50 transition group-hover:translate-x-1 group-hover:text-amber-200" />
                </div>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-400">
                  {tr('goldenEgg', 'tour_body', lang)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['Sacred Architecture', 'Deeksha', 'Sri Chakra', 'Hiranyagarbha'].map((tag) => (
                    <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-gray-300">
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>

              {/* ── CTAs ── */}
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/ekam"
                  className="inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-amber-300 via-zion-gold to-orange-400 px-6 py-3 text-sm font-semibold text-black"
                >
                  <Stars className="h-4 w-4" />
                  {tr('goldenEgg', 'cta_museum', lang)}
                </Link>
                <Link
                  href="#tree-of-life"
                  className="inline-flex items-center gap-2 rounded-2xl border border-amber-200/20 bg-amber-200/10 px-6 py-3 text-sm font-semibold text-amber-50 hover:border-amber-200/35"
                >
                  {tr('goldenEgg', 'cta_tree', lang)}
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
