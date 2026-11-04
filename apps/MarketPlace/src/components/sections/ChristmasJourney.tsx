'use client';

import Link from 'next/link';
import { ArrowRight, ChevronDown, HelpCircle, ListOrdered, Snowflake } from 'lucide-react';
import { christmasFaq, christmasJourney, type XmasText } from '@/data/christmasProducts';
import { useLangT } from '@/lib/useTranslation';
import RichText from '@/components/xmas/RichText';

/**
 * Spodní část vánoční novinky na homepage: společná cesta nákupem a otázky,
 * které se ptají všichni bez ohledu na to, který ze tří darů si vybrali.
 *
 * Proč zvlášť: karty výš mají vlastní „co dostanu" a čísla, ale nevešlo by se
 * do nich, co se stane po zaplacení ani jak je to s vrácením. Detail produktu
 * má plné FAQ; tady je průřez, aby člověk nemusel nikam klikat.
 */
export default function ChristmasJourneySection() {
  const { t, lang } = useLangT();
  const pick = (x: XmasText) => (lang === 'cs' ? x.cs : x.en);
  const steps = lang === 'cs' ? christmasJourney.cs : christmasJourney.en;

  return (
    <section className="space-y-8">
      <div className="zion-section">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-2xl md:text-3xl font-black font-display flex items-center gap-2">
            <ListOrdered className="w-6 h-6 text-rasta-gold" />
            <span className="text-gradient-gold">
              {lang === 'cs' ? 'Jak to funguje' : 'How it works'}
            </span>
          </h2>
          <span className="zion-kicker inline-flex items-center gap-1.5">
            <Snowflake className="w-3.5 h-3.5" /> {t('xmas.badge')}
          </span>
        </div>

        <ol className="mt-6 grid gap-4 md:grid-cols-5">
          {steps.map((step, i) => (
            <li key={i} className="relative rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-rasta-gold/15 border border-rasta-gold/40 text-[12px] font-bold text-rasta-gold">
                {i + 1}
              </span>
              <p className="text-[13px] leading-relaxed text-gray-300">
                <RichText text={step} />
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div className="zion-section">
        <h2 className="text-2xl md:text-3xl font-black font-display flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-rasta-gold" />
          <span className="text-gradient-gold">
            {lang === 'cs' ? 'Časté otázky k vánočním darům' : 'Christmas gift questions'}
          </span>
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-gray-400">
          {lang === 'cs'
            ? 'Šest věcí, na které se ptá skoro každý. Celé FAQ je u každého produktu zvlášť.'
            : 'Six things almost everyone asks. The full FAQ lives on each product page.'}
        </p>

        <div className="mt-5 space-y-2.5">
          {christmasFaq.map((item, i) => (
            <details key={i} className="group zion-section !p-0 overflow-hidden [&_summary]:list-none">
              <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-5 py-3.5 text-sm font-semibold text-gray-200 transition-colors hover:text-rasta-gold">
                {pick(item.q)}
                <ChevronDown className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180" />
              </summary>
              <p className="px-5 pb-4 text-sm leading-relaxed text-gray-400">
                <RichText text={pick(item.a)} />
              </p>
            </details>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-4 text-sm">
          <Link href="/vanoce/zion-pass" className="inline-flex items-center gap-1 text-rasta-gold hover:underline">
            ZION Pass <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link href="/vanoce/kniha-kralovstvi-srdce" className="inline-flex items-center gap-1 text-rasta-gold hover:underline">
            {lang === 'cs' ? 'Kniha' : 'The book'} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link href="/vanoce/lampion" className="inline-flex items-center gap-1 text-rasta-gold hover:underline">
            {lang === 'cs' ? 'Lampion' : 'The lantern'} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
