'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  Atom,
  Brain,
  Building2,
  Compass,
  Diamond,
  Droplets,
  Landmark,
  Orbit,
  Sparkles,
  Sprout,
  Sun,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';
import { EKAM_GOLDEN_EGG_IMAGE, EKAM_SOURCE_URL } from '@/lib/site';

const halls = [
  { title: 'hall_1_title', body: 'hall_1_body', Icon: Atom },
  { title: 'hall_2_title', body: 'hall_2_body', Icon: Sprout },
  { title: 'hall_3_title', body: 'hall_3_body', Icon: Brain },
  { title: 'hall_4_title', body: 'hall_4_body', Icon: Landmark },
] as const;

const archFacts = [
  { key: 'arch_platform', Icon: Building2 },
  { key: 'arch_hall', Icon: Compass },
  { key: 'arch_floors', Icon: Landmark },
  { key: 'arch_moat', Icon: Droplets },
] as const;

const geoFacts = [
  { key: 'geo_yantra', Icon: Sun },
  { key: 'geo_chakra', Icon: Diamond },
  { key: 'geo_golden', Icon: Orbit },
  { key: 'geo_vastu', Icon: Compass },
] as const;

export default function EkamMuseumLanding() {
  const { lang } = useLang();

  return (
    <div className="relative overflow-hidden">
      {/* ── Background ── */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.16),_transparent_28%),radial-gradient(circle_at_85%_20%,_rgba(14,165,233,0.10),_transparent_24%),linear-gradient(180deg,_rgba(6,10,18,0.98),_rgba(8,12,26,0.94))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" />

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative px-6 pt-20 pb-12 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-100/88">
              <Sparkles className="h-3.5 w-3.5 text-zion-gold" />
              {tr('ekamPage', 'badge', lang)}
            </span>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              {tr('ekamPage', 'title', lang)}
            </h1>
            <p className="max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              {tr('ekamPage', 'subtitle', lang)}
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-amber-300/20 via-transparent to-sky-400/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-amber-200/20 bg-slate-950/60 p-3 shadow-[0_24px_80px_rgba(2,6,23,0.5)] backdrop-blur">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] border border-white/10">
                <Image
                  src={EKAM_GOLDEN_EGG_IMAGE}
                  alt="EKAM — Hiranyagarbha Golden Egg"
                  fill
                  sizes="(min-width: 1024px) 30rem, 100vw"
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-4 p-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.26em] text-amber-100/70">EKAM</p>
                    <p className="mt-1 text-sm text-white/90">Hiranyagarbha · Golden Egg</p>
                  </div>
                  <a
                    href={EKAM_SOURCE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white transition hover:border-amber-200/40"
                  >
                    Source
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ SACRED ARCHITECTURE ═══════════ */}
      <section className="relative px-6 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-7 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/60">{tr('ekamPage', 'arch_label', lang)}</p>
            <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{tr('ekamPage', 'arch_title', lang)}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{tr('ekamPage', 'arch_subtitle', lang)}</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {archFacts.map(({ key, Icon }) => (
                <article key={key} className="rounded-3xl border border-white/10 bg-slate-950/35 p-5 transition hover:border-amber-200/24">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-300/10 text-amber-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-white">{tr('ekamPage', `${key}_title`, lang)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{tr('ekamPage', `${key}_body`, lang)}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ SACRED GEOMETRY ═══════════ */}
      <section className="relative px-6 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[2rem] border border-amber-200/12 bg-[linear-gradient(135deg,rgba(255,215,120,0.06),rgba(255,255,255,0.02))] p-7 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/60">{tr('ekamPage', 'geo_label', lang)}</p>
            <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{tr('ekamPage', 'geo_title', lang)}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{tr('ekamPage', 'geo_subtitle', lang)}</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {geoFacts.map(({ key, Icon }) => (
                <article key={key} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-300/10 text-amber-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-white">{tr('ekamPage', `${key}_title`, lang)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{tr('ekamPage', `${key}_body`, lang)}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ DEEKSHA ═══════════ */}
      <section className="relative px-6 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-7 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/60">{tr('ekamPage', 'deeksha_label', lang)}</p>
              <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{tr('ekamPage', 'deeksha_title', lang)}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{tr('ekamPage', 'deeksha_body', lang)}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <article className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-100/70">{tr('ekamPage', 'deeksha_sparsha_label', lang)}</p>
                <h3 className="mt-3 text-base font-semibold text-white">{tr('ekamPage', 'deeksha_sparsha_title', lang)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{tr('ekamPage', 'deeksha_sparsha_body', lang)}</p>
              </article>
              <article className="rounded-3xl border border-white/10 bg-slate-950/35 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-100/70">{tr('ekamPage', 'deeksha_smarana_label', lang)}</p>
                <h3 className="mt-3 text-base font-semibold text-white">{tr('ekamPage', 'deeksha_smarana_title', lang)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{tr('ekamPage', 'deeksha_smarana_body', lang)}</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ VISITOR PATH ═══════════ */}
      <section className="relative px-6 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-7 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-200/20 bg-sky-300/10 text-sky-100">
                <Orbit className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white">{tr('ekamPage', 'hall_title', lang)}</h2>
                <p className="mt-1 text-sm text-slate-300">{tr('ekamPage', 'hall_subtitle', lang)}</p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {halls.map(({ title, body, Icon }, index) => (
                <article
                  key={title}
                  className="relative rounded-3xl border border-white/10 bg-slate-950/35 p-5 transition hover:border-amber-200/24 hover:bg-slate-950/50"
                >
                  <span className="absolute right-4 top-4 text-[11px] font-semibold text-amber-100/40">{index + 1}/4</span>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-300/10 text-amber-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-white">{tr('ekamPage', title, lang)}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{tr('ekamPage', body, lang)}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ CTAs ═══════════ */}
      <section className="relative px-6 pt-4 pb-20 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:border-amber-200/30 hover:bg-white/14"
          >
            {tr('ekamPage', 'cta_home', lang)}
          </Link>
          <Link
            href="/#tree-of-life"
            className="inline-flex items-center justify-center rounded-full border border-sky-200/15 bg-sky-300/10 px-6 py-3 text-sm font-semibold text-sky-50 transition hover:border-sky-200/30"
          >
            {tr('ekamPage', 'cta_tree', lang)}
          </Link>
          <a
            href={EKAM_SOURCE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-amber-200/15 bg-amber-300/8 px-6 py-3 text-sm font-semibold text-amber-50 transition hover:border-amber-200/30"
          >
            {tr('ekamPage', 'cta_source', lang)}
          </a>
        </div>
      </section>
    </div>
  );
}