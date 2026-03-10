'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Atom, Brain, Landmark, Orbit, Sprout, Trees } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { tr } from '@/lib/translations';
import { EKAM_GOLDEN_EGG_IMAGE, EKAM_SOURCE_URL } from '@/lib/site';

const halls = [
  { title: 'hall_1_title', body: 'hall_1_body', Icon: Atom },
  { title: 'hall_2_title', body: 'hall_2_body', Icon: Sprout },
  { title: 'hall_3_title', body: 'hall_3_body', Icon: Brain },
  { title: 'hall_4_title', body: 'hall_4_body', Icon: Landmark },
] as const;

const practicalSteps = ['practical_1', 'practical_2', 'practical_3', 'practical_4'] as const;

export default function EkamMuseumLanding() {
  const { lang } = useLang();

  return (
    <section className="relative overflow-hidden px-6 py-20 sm:px-8 lg:px-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.16),_transparent_28%),radial-gradient(circle_at_85%_20%,_rgba(14,165,233,0.14),_transparent_24%),linear-gradient(180deg,_rgba(6,10,18,0.98),_rgba(8,12,26,0.94))]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" />

      <div className="relative mx-auto flex max-w-6xl flex-col gap-14">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-100/88">
              {tr('ekamPage', 'badge', lang)}
            </span>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                {tr('ekamPage', 'title', lang)}
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                {tr('ekamPage', 'subtitle', lang)}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <article className="rounded-3xl border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-sky-200/70">
                  {tr('ekamPage', 'card_origin_label', lang)}
                </p>
                <h2 className="mt-3 text-lg font-semibold text-white">
                  {tr('ekamPage', 'card_origin_title', lang)}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {tr('ekamPage', 'card_origin_body', lang)}
                </p>
              </article>

              <article className="rounded-3xl border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-sky-200/70">
                  {tr('ekamPage', 'card_format_label', lang)}
                </p>
                <h2 className="mt-3 text-lg font-semibold text-white">
                  {tr('ekamPage', 'card_format_title', lang)}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {tr('ekamPage', 'card_format_body', lang)}
                </p>
              </article>

              <article className="rounded-3xl border border-white/10 bg-white/6 p-5 backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-sky-200/70">
                  {tr('ekamPage', 'card_constraint_label', lang)}
                </p>
                <h2 className="mt-3 text-lg font-semibold text-white">
                  {tr('ekamPage', 'card_constraint_title', lang)}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {tr('ekamPage', 'card_constraint_body', lang)}
                </p>
              </article>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-amber-300/20 via-transparent to-sky-400/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-amber-200/20 bg-slate-950/60 p-3 shadow-[0_24px_80px_rgba(2,6,23,0.5)] backdrop-blur">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] border border-white/10">
                <Image
                  src={EKAM_GOLDEN_EGG_IMAGE}
                  alt="EKAM Golden Egg"
                  fill
                  sizes="(min-width: 1024px) 30rem, 100vw"
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-4 p-5 text-xs text-slate-200/88">
                  <div>
                    <p className="font-semibold uppercase tracking-[0.26em] text-amber-100/70">EKAM</p>
                    <p className="mt-1 text-sm text-white/90">Hiranyagarbha · Golden Egg</p>
                  </div>
                  <a
                    href={EKAM_SOURCE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white transition hover:border-amber-200/40 hover:bg-white/14"
                  >
                    Source
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
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

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {halls.map(({ title, body, Icon }) => (
                <article
                  key={title}
                  className="rounded-3xl border border-white/10 bg-slate-950/35 p-5 transition hover:border-amber-200/24 hover:bg-slate-950/50"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-300/10 text-amber-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-white">{tr('ekamPage', title, lang)}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-300">{tr('ekamPage', body, lang)}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-7 backdrop-blur-sm">
              <h2 className="text-2xl font-semibold text-white">{tr('ekamPage', 'practical_title', lang)}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{tr('ekamPage', 'practical_subtitle', lang)}</p>

              <div className="mt-6 space-y-3">
                {practicalSteps.map((step, index) => (
                  <div
                    key={step}
                    className="flex items-start gap-4 rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-4"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-200/20 bg-amber-300/10 text-sm font-semibold text-amber-100">
                      {index + 1}
                    </span>
                    <p className="pt-0.5 text-sm leading-7 text-slate-200">{tr('ekamPage', step, lang)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-7 backdrop-blur-sm">
              <h2 className="text-2xl font-semibold text-white">{tr('ekamPage', 'stack_title', lang)}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{tr('ekamPage', 'stack_body', lang)}</p>

              <div className="mt-6 rounded-3xl border border-sky-200/12 bg-sky-300/8 p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-200/20 bg-sky-300/10 text-sky-100">
                    <Trees className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{tr('ekamPage', 'source_title', lang)}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-300">{tr('ekamPage', 'source_body', lang)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:border-amber-200/30 hover:bg-white/14"
          >
            {tr('ekamPage', 'cta_home', lang)}
          </Link>
          <Link
            href="/#tree-of-life"
            className="inline-flex items-center justify-center rounded-full border border-sky-200/15 bg-sky-300/10 px-6 py-3 text-sm font-semibold text-sky-50 transition hover:border-sky-200/30 hover:bg-sky-300/16"
          >
            {tr('ekamPage', 'cta_tree', lang)}
          </Link>
        </div>
      </div>
    </section>
  );
}