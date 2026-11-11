'use client';

import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { SHOPPING_PROCESS } from '@/data/shop-legal';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import PageHero from '@/components/page-hero';

export default function ShoppingProcessPage() {
  const { lang } = useLang();

  return (
    <>
      <PageHero
        kicker={SHOPPING_PROCESS.kicker}
        title={SHOPPING_PROCESS.title}
        lead={SHOPPING_PROCESS.lead}
        compact
      >
        <Link href="/kolekce" className="btn-primary">
          {pick({ cs: 'Přejít do kolekce', en: 'Browse the collection', de: 'Zur Kollektion' }, lang)}
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href="/doprava" className="btn-outline">
          {pick({ cs: 'Doprava a platba', en: 'Shipping & payment', de: 'Versand & Zahlung' }, lang)}
        </Link>
      </PageHero>

      <section className="container-lumi py-14">
        <ol className="grid gap-5 md:grid-cols-2">
          {SHOPPING_PROCESS.steps.map((step, index) => (
            <li key={step.title.cs} className="card-warm flex gap-4 p-5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-sm font-bold text-parchment">
                {index + 1}
              </span>
              <div>
                <h2 className="text-base font-semibold text-ink">{pick(step.title, lang)}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{pick(step.text, lang)}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {SHOPPING_PROCESS.sections.map((section) => (
            <section key={section.heading.cs} className="rounded-2xl border border-line bg-card p-6">
              <h2 className="h3">{pick(section.heading, lang)}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{pick(section.body, lang)}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-line bg-parchment-deep/60 p-6">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-muted">
            {pick({ cs: 'Užitečné odkazy', en: 'Useful links', de: 'Nützliche Links' }, lang)}
          </h2>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {SHOPPING_PROCESS.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="link-underline text-ink">
                  {pick(link.label, lang)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-8 flex items-start gap-2 text-sm leading-relaxed text-muted">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          {pick(
            {
              cs: 'Ceny jsou konečné, nejsme plátci DPH. U zboží se svíčkou je součástí objednávky bezpečnostní prohlášení.',
              en: 'Prices are final; we are not VAT payers. Candle products include a safety statement with every order.',
              de: 'Die Preise sind endgültig; wir sind keine Umsatzsteuerzahler. Bei Kerzenprodukten gehört eine Sicherheitserklärung zur Bestellung.',
            },
            lang,
          )}
        </p>
      </section>
    </>
  );
}
