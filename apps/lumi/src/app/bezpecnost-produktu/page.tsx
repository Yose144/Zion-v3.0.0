'use client';

import { ShieldCheck } from 'lucide-react';
import { PRODUCT_SAFETY } from '@/data/shop-legal';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import PageHero from '@/components/page-hero';
import FireSafetyBlock from '@/components/fire-safety-block';

export default function ProductSafetyPage() {
  const { lang } = useLang();

  return (
    <>
      <PageHero kicker={PRODUCT_SAFETY.kicker} title={PRODUCT_SAFETY.title} lead={PRODUCT_SAFETY.lead} compact />

      <section className="container-lumi py-14">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="overflow-hidden rounded-2xl border border-line bg-card">
            <div className="flex items-center gap-2 border-b border-line bg-parchment-deep/60 px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-muted">
              <ShieldCheck className="h-4 w-4 text-forest" />
              {pick({ cs: 'Identifikace výrobku', en: 'Product identification', de: 'Produktidentifikation' }, lang)}
            </div>
            <dl className="divide-y divide-line">
              {PRODUCT_SAFETY.rows.map((row) => (
                <div key={row.label.cs} className="grid gap-1 px-5 py-4 sm:grid-cols-[130px_1fr]">
                  <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{pick(row.label, lang)}</dt>
                  <dd className="text-sm leading-relaxed text-ink">{pick(row.value, lang)}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="space-y-5">
            {PRODUCT_SAFETY.sections.map((section) => (
              <section key={section.heading.cs} className="rounded-2xl border border-line bg-card p-6">
                <h2 className="h3">{pick(section.heading, lang)}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{pick(section.body, lang)}</p>
              </section>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <FireSafetyBlock />
        </div>
      </section>
    </>
  );
}
