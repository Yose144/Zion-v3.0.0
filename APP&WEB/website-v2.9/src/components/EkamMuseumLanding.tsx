'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Atom,
  Brain,
  Building2,
  Compass,
  Diamond,
  Droplets,
  ExternalLink,
  Heart,
  Landmark,
  MapPin,
  Orbit,
  Play,
  Quote,
  Sparkles,
  Sprout,
  Sun,
  Users,
  Zap,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';
import {
  EKAM_BANNER_IMAGE,
  EKAM_FOUNDERS_BANNER_IMAGE,
  EKAM_SOURCE_URL,
  EKAM_PREETHAJI_KRISHNAJI_IMAGE,
  EKAM_NORDIC_IMAGE,
  EKAM_TURIYA_IMAGE,
  EKAM_PREETHAJI_KRISHNAJI_URL,
  EKAM_YOUTUBE_CHANNEL,
} from '@/lib/site';

const journeySteps = [
  {
    id: 'bigbang',
    era: '13.8 miliard let',
    label: 'BIG BANG',
    title: 'Počátek vesmíru',
    description:
      'Z jediného bodu nekonečné hustoty vznikl prostor, čas a hmota. Prvotní záblesk — singularita — jež se rozvinula v celý existující kosmos.',
    accent: 'from-violet-500 via-purple-400 to-indigo-500',
    border: 'border-violet-500/30',
    glow: 'bg-violet-500/10',
    dot: 'bg-violet-400',
    symbol: '✦',
  },
  {
    id: 'hiranyagarbha',
    era: 'Védská kosmogonie',
    label: 'HIRANYAGARBHA',
    title: 'Zlaté kosmické vejce',
    description:
      'Prvotní zlaté vejce (Hiranyagarbha) plující v prvotních vodách — zárodek celého stvoření nesoucí Brahmu, duši vesmíru a vědomí.',
    accent: 'from-amber-400 via-yellow-300 to-orange-400',
    border: 'border-amber-400/30',
    glow: 'bg-amber-400/10',
    dot: 'bg-amber-400',
    symbol: '◉',
  },
  {
    id: 'ekam',
    era: 'Srí Lanka · Fyzické místo',
    label: 'EKAM',
    title: 'Posvátné místo vědomí',
    description:
      'Ekam — "jedno" v sanskrtu — je živoucí chrám zasvěcený kolektivnímu osvícení. Centrum Deeksha přenosu, kde se vědomí stýká s formou.',
    accent: 'from-sky-400 via-cyan-300 to-teal-400',
    border: 'border-sky-400/30',
    glow: 'bg-sky-400/10',
    dot: 'bg-sky-400',
    symbol: '🏛',
  },
  {
    id: 'zion',
    era: 'Blockchain · Decentralizace',
    label: 'ZION EKAM PoW',
    title: 'Golden Egg on-chain',
    description:
      'ZION Cosmic Harmony kóduje Deeksha princip do proof-of-work. Každý blok je digitální Hiranyagarbha — zárodek nového řádu vědomí v digitálním prostoru.',
    accent: 'from-emerald-400 via-zion-gold to-amber-400',
    border: 'border-emerald-400/30',
    glow: 'bg-emerald-400/10',
    dot: 'bg-emerald-400',
    symbol: '⬡',
  },
] as const;

function JourneyStep({
  step,
  index,
  isLast,
}: {
  step: (typeof journeySteps)[number];
  index: number;
  isLast: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <div ref={ref} className="relative flex gap-6 sm:gap-10">
      {/* ── Vertical connector line ── */}
      {!isLast && (
        <div className="absolute left-[1.375rem] sm:left-[1.625rem] top-14 bottom-0 w-px">
          <motion.div
            className={`h-full w-full bg-gradient-to-b ${step.accent} opacity-30`}
            initial={{ scaleY: 0 }}
            animate={inView ? { scaleY: 1 } : { scaleY: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
            style={{ transformOrigin: 'top' }}
          />
        </div>
      )}

      {/* ── Timeline dot ── */}
      <div className="relative flex-none pt-1">
        <motion.div
          className={`flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-full border-2 ${step.border} ${step.glow} backdrop-blur-sm shadow-lg`}
          initial={{ scale: 0, opacity: 0 }}
          animate={inView ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
          transition={{ duration: 0.5, delay: index * 0.15 }}
        >
          <span className="text-xl leading-none">{step.symbol}</span>
        </motion.div>
      </div>

      {/* ── Content card ── */}
      <motion.div
        className={`mb-10 flex-1 rounded-[1.5rem] border ${step.border} ${step.glow} p-5 sm:p-6 backdrop-blur-sm`}
        initial={{ opacity: 0, x: 30 }}
        animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
        transition={{ duration: 0.6, delay: index * 0.15 + 0.1 }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/50 mb-1">
          {step.era}
        </p>
        <p
          className={`text-xs font-bold uppercase tracking-[0.26em] bg-gradient-to-r ${step.accent} bg-clip-text text-transparent mb-2`}
        >
          {step.label}
        </p>
        <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">{step.title}</h3>
        <p className="text-sm leading-7 text-slate-300">{step.description}</p>
      </motion.div>
    </div>
  );
}

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

const familyMembers = [
  { key: 'founders_bhagavan', Icon: Zap },
  { key: 'founders_amma', Icon: Heart },
  { key: 'founders_krishnaji', Icon: Sun },
  { key: 'founders_preethaji', Icon: Sparkles },
  { key: 'founders_lokaa', Icon: Sprout },
] as const;

const tourFacts = [
  { key: 'tour_fact_cost', Icon: Diamond },
  { key: 'tour_fact_inaugurated', Icon: Landmark },
  { key: 'tour_fact_architect', Icon: Compass },
  { key: 'tour_fact_location', Icon: MapPin },
] as const;

export default function EkamMuseumLanding() {
  const { lang } = useLang();

  return (
    <div className="relative overflow-hidden">
      {/* ── Background ── */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.16),_transparent_28%),radial-gradient(circle_at_85%_20%,_rgba(14,165,233,0.10),_transparent_24%),linear-gradient(180deg,_rgba(6,10,18,0.98),_rgba(8,12,26,0.94))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" />

      {/* ═══════════ COSMIC JOURNEY ═══════════ */}
      <section className="relative px-6 pt-24 pb-4 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-violet-200/80 mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              Kosmická linie
            </span>
            <h2 className="text-3xl sm:text-4xl font-semibold text-white">
              Od Velkého třesku k&nbsp;Ekamu
            </h2>
            <p className="mt-3 text-base text-slate-400 max-w-xl mx-auto">
              Cesta vědomí — od prvotní singularity přes védskou moudrost ke Golden Egg v digitálním prostoru.
            </p>
          </div>

          <div className="relative">
            {journeySteps.map((step, i) => (
              <JourneyStep
                key={step.id}
                step={step}
                index={i}
                isLast={i === journeySteps.length - 1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative pt-16 pb-16 sm:pt-18 sm:pb-20">
        <div className="relative h-[40vh] overflow-hidden border-y border-white/10 bg-slate-950 sm:h-[48vh] lg:h-[56vh]">
          <Image
            src={EKAM_BANNER_IMAGE}
            alt="EKAM — Oneness Temple"
            fill
            sizes="100vw"
            className="object-cover object-center"
            priority
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,16,0.16),rgba(5,8,16,0.24)_24%,rgba(5,8,16,0.58)_72%,rgba(5,8,16,0.82)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(251,191,36,0.14),transparent_24%),radial-gradient(circle_at_85%_22%,rgba(56,189,248,0.10),transparent_20%)]" />
          <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-6xl items-end justify-between gap-4 px-6 pb-6 sm:px-8 lg:px-10 lg:pb-8">
            <div className="zion-rainbow-sub px-4 py-3" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-amber-100/80">EKAM</p>
              <p className="mt-1 text-sm text-white/92">Varadaiahpalem · Oneness Temple</p>
            </div>
            <a
              href={EKAM_SOURCE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white transition hover:border-amber-200/40"
            >
              {tr('ekamPage', 'cta_source', lang)}
            </a>
          </div>
        </div>

        <div className="relative z-10 mx-auto -mt-10 px-6 sm:-mt-12 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-4xl zion-rainbow-card p-6 shadow-[0_22px_64px_rgba(2,6,23,0.30)] sm:p-8 lg:p-10" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
              <div className="max-w-3xl space-y-5">
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/12 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-100/88">
                  <Sparkles className="h-3.5 w-3.5 text-zion-gold" />
                  {tr('ekamPage', 'badge', lang)}
                </span>
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  {tr('ekamPage', 'title', lang)}
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-200 sm:text-lg">
                  {tr('ekamPage', 'subtitle', lang)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ SACRED ARCHITECTURE ═══════════ */}
      <section className="relative px-6 pt-6 pb-12 sm:px-8 sm:pt-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="zion-rainbow-card p-7" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/60">{tr('ekamPage', 'arch_label', lang)}</p>
            <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{tr('ekamPage', 'arch_title', lang)}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{tr('ekamPage', 'arch_subtitle', lang)}</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {archFacts.map(({ key, Icon }) => (
                <article key={key} className="zion-rainbow-sub p-5 transition hover:border-amber-200/24" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
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
          <div className="zion-rainbow-card p-7" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/60">{tr('ekamPage', 'geo_label', lang)}</p>
            <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{tr('ekamPage', 'geo_title', lang)}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{tr('ekamPage', 'geo_subtitle', lang)}</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {geoFacts.map(({ key, Icon }) => (
                <article key={key} className="zion-rainbow-sub p-5" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
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
            <div className="zion-rainbow-card p-7" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/60">{tr('ekamPage', 'deeksha_label', lang)}</p>
              <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{tr('ekamPage', 'deeksha_title', lang)}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{tr('ekamPage', 'deeksha_body', lang)}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <article className="zion-rainbow-sub p-5" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-100/70">{tr('ekamPage', 'deeksha_sparsha_label', lang)}</p>
                <h3 className="mt-3 text-base font-semibold text-white">{tr('ekamPage', 'deeksha_sparsha_title', lang)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{tr('ekamPage', 'deeksha_sparsha_body', lang)}</p>
              </article>
              <article className="zion-rainbow-sub p-5" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-100/70">{tr('ekamPage', 'deeksha_smarana_label', lang)}</p>
                <h3 className="mt-3 text-base font-semibold text-white">{tr('ekamPage', 'deeksha_smarana_title', lang)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{tr('ekamPage', 'deeksha_smarana_body', lang)}</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ FOUNDERS & FAMILY LINEAGE ═══════════ */}
      <section className="relative px-6 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="zion-rainbow-card p-7" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-300/10 text-amber-100">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/60">{tr('ekamPage', 'founders_label', lang)}</p>
                <h2 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">{tr('ekamPage', 'founders_title', lang)}</h2>
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{tr('ekamPage', 'founders_subtitle', lang)}</p>

            <div className="mt-6 relative overflow-hidden zion-rainbow-sub shadow-[0_18px_60px_rgba(0,0,0,0.35)]" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
              <Image
                src={EKAM_FOUNDERS_BANNER_IMAGE}
                alt="Sri Amma & Sri Bhagavan"
                width={1600}
                height={500}
                sizes="(min-width: 1024px) 1152px, 100vw"
                className="aspect-[16/5] w-full object-cover"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent sm:from-slate-950/75" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/20 to-transparent sm:from-black/40 sm:via-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <div className="inline-flex flex-col rounded-xl border border-white/15 bg-black/35 px-3 py-2 backdrop-blur-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-amber-100/85">{tr('ekamPage', 'founders_banner_label', lang)}</p>
                  <p className="mt-1 text-xs text-white/90">{tr('ekamPage', 'founders_banner_caption', lang)}</p>
                </div>
              </div>
            </div>

            {/* ── Family portrait + quote ── */}
            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
              <div className="space-y-4">
                <div className="relative overflow-hidden zion-rainbow-sub shadow-[0_18px_60px_rgba(0,0,0,0.35)]" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
                  <Image
                    src={EKAM_PREETHAJI_KRISHNAJI_IMAGE}
                    alt="Sri Preethaji & Sri Krishnaji"
                    width={1200}
                    height={750}
                    sizes="(min-width: 1024px) 460px, 100vw"
                    className="aspect-[16/10] w-full object-cover object-top"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <p className="text-xs font-semibold text-amber-100/90">Sri Preethaji & Sri Krishnaji</p>
                    <p className="mt-0.5 text-[10px] text-white/60">Co-founders of Oneness</p>
                  </div>
                </div>
                <a
                  href={EKAM_PREETHAJI_KRISHNAJI_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-amber-100/70 transition hover:text-amber-100"
                >
                  {tr('ekamPage', 'cta_source', lang)}
                  <ExternalLink className="h-3 w-3" />
                </a>

                {/* ── Quote ── */}
                <div className="zion-rainbow-sub p-5" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
                  <Quote className="mb-2 h-5 w-5 text-amber-300/40" />
                  <p className="text-sm italic leading-relaxed text-amber-100/80">
                    {tr('ekamPage', 'founders_quote', lang)}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-amber-200/60">
                    {tr('ekamPage', 'founders_quote_author', lang)}
                  </p>
                </div>
              </div>

              {/* ── Family cards ── */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
                {familyMembers.map(({ key, Icon }) => (
                  <article key={key} className="zion-rainbow-sub p-5 transition hover:border-amber-200/24" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200/20 bg-amber-300/10 text-amber-100">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-white">{tr('ekamPage', `${key}_title`, lang)}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{tr('ekamPage', `${key}_body`, lang)}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ VIRTUAL TOUR / TEMPLE GALLERY ═══════════ */}
      <section className="relative px-6 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="zion-rainbow-card p-7" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-200/20 bg-sky-300/10 text-sky-100">
                <Play className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-100/60">{tr('ekamPage', 'tour_section_label', lang)}</p>
                <h2 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">{tr('ekamPage', 'tour_section_title', lang)}</h2>
              </div>
            </div>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{tr('ekamPage', 'tour_section_subtitle', lang)}</p>

            {/* ── Image gallery ── */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Ekam hero */}
              <div className="relative overflow-hidden zion-rainbow-sub sm:col-span-2 lg:col-span-1 lg:row-span-2" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
                <Image
                  src={EKAM_BANNER_IMAGE}
                  alt="Ekam — Oneness Temple"
                  width={900}
                  height={1000}
                  sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                  className="h-full w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-100/85">{tr('ekamPage', 'tour_gallery_ekam_label', lang)}</p>
                  <p className="mt-1 text-sm text-white/85">{tr('ekamPage', 'tour_gallery_ekam_caption', lang)}</p>
                </div>
              </div>
              {/* Turiya / Sacred space */}
              <div className="relative overflow-hidden zion-rainbow-sub" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
                <Image
                  src={EKAM_TURIYA_IMAGE}
                  alt="Sacred meditation space"
                  width={900}
                  height={560}
                  sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                  className="aspect-[16/10] w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-100/85">{tr('ekamPage', 'tour_gallery_turiya_label', lang)}</p>
                  <p className="mt-1 text-sm text-white/85">{tr('ekamPage', 'tour_gallery_turiya_caption', lang)}</p>
                </div>
              </div>
              {/* Nordic centre */}
              <div className="relative overflow-hidden zion-rainbow-sub" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
                <Image
                  src={EKAM_NORDIC_IMAGE}
                  alt="Oneness Nordic — European Centre"
                  width={900}
                  height={560}
                  sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                  className="aspect-[16/10] w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-100/85">{tr('ekamPage', 'tour_gallery_nordic_label', lang)}</p>
                  <p className="mt-1 text-sm text-white/85">{tr('ekamPage', 'tour_gallery_nordic_caption', lang)}</p>
                </div>
              </div>
            </div>

            {/* ── Facts row ── */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {tourFacts.map(({ key, Icon }) => (
                <div key={key} className="flex items-center gap-3 zion-rainbow-sub p-4" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
                  <Icon className="h-4 w-4 shrink-0 text-amber-200/60" />
                  <p className="text-xs font-medium text-slate-300">{tr('ekamPage', key, lang)}</p>
                </div>
              ))}
            </div>

            {/* ── Nordic description ── */}
            <div className="mt-6 zion-rainbow-sub p-5" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
              <h3 className="text-base font-semibold text-white">{tr('ekamPage', 'tour_nordic_title', lang)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{tr('ekamPage', 'tour_nordic_body', lang)}</p>
            </div>

            {/* ── External links ── */}
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={EKAM_YOUTUBE_CHANNEL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-amber-200/30"
              >
                <Play className="h-4 w-4" />
                {tr('ekamPage', 'tour_cta_youtube', lang)}
              </a>
              <a
                href={EKAM_SOURCE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-amber-200/15 bg-amber-300/8 px-5 py-2.5 text-sm font-semibold text-amber-50 transition hover:border-amber-200/30"
              >
                <ExternalLink className="h-4 w-4" />
                {tr('ekamPage', 'tour_cta_website', lang)}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ VISITOR PATH ═══════════ */}
      <section className="relative px-6 py-12 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="zion-rainbow-card p-7" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}>
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
                  className="relative zion-rainbow-sub p-5 transition hover:border-amber-200/24 hover:bg-slate-950/50" style={{ '--rc': '139, 92, 246' } as React.CSSProperties}
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
            href="/ekam/deeksha"
            className="zion-button-primary text-sm"
            style={{ '--rc': '251, 191, 36' } as CSSProperties}
          >
            O knize Ekam Deeksha
          </Link>
          <Link
            href="/"
            className="zion-button-secondary text-sm"
          >
            {tr('ekamPage', 'cta_home', lang)}
          </Link>
          <Link
            href="/#tree-of-life"
            className="zion-button-primary text-sm"
            style={{ '--rc': '7, 137, 48' } as CSSProperties}
          >
            {tr('ekamPage', 'cta_tree', lang)}
          </Link>
          <a
            href={EKAM_SOURCE_URL}
            target="_blank"
            rel="noreferrer"
            className="zion-button-secondary text-sm"
            style={{ '--rc': '251, 191, 36' } as CSSProperties}
          >
            {tr('ekamPage', 'cta_source', lang)}
          </a>
        </div>
      </section>
    </div>
  );
}