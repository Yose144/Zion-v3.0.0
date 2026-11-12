'use client';

import Link from 'next/link';
import { ArrowRight, Flame, Hammer, ImagePlus, Package, ShieldCheck, Sparkles } from 'lucide-react';
import { SITE } from '@/data/site';
import { FEATURED_PRODUCTS, PRODUCTS } from '@/data/catalog';
import { FAQ_ITEMS } from '@/data/pages';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import { imageVariant } from '@/lib/images';
import ProductCard from '@/components/product-card';
import SectionHeading from '@/components/section-heading';
import Reveal from '@/components/reveal';
import CollectionGrid from '@/components/collection-grid';
import HomeShowcase from '@/components/home-showcase';
import FaqAccordion from '@/components/faq-accordion';
import NewsletterForm from '@/components/newsletter-form';
import { Price } from '@/components/price';

const TRUST_ICONS = [Hammer, Package, ShieldCheck, Sparkles];

export default function HomePage() {
  const { lang } = useLang();
  const featured = FEATURED_PRODUCTS.map((id) => PRODUCTS.find((product) => product.externalId === id)).filter(
    (product): product is (typeof PRODUCTS)[number] => Boolean(product),
  );

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="container-lumi grid items-center gap-10 py-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-20">
          <div className="max-w-xl">
            <p className="eyebrow">
              <Flame className="h-3.5 w-3.5" /> {pick(SITE.hero.kicker, lang)}
            </p>
            <h1 className="h1 mt-5 text-balance">{pick(SITE.hero.title, lang)}</h1>
            <p className="lead mt-6 text-pretty">{pick(SITE.hero.lead, lang)}</p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/kolekce/lumi-2" className="btn-primary">
                {pick(SITE.hero.ctaPrimary, lang)}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="#nahled-3d" className="btn-outline">
                {pick(SITE.hero.ctaSecondary, lang)}
              </Link>
              <span className="inline-flex items-baseline gap-2 text-sm text-ink-soft">
                <span className="text-[0.7rem] uppercase tracking-[0.14em] text-muted">{pick({ cs: 'od', en: 'from', de: 'ab' }, lang)}</span>
                <Price value={350} className="h-display text-2xl font-semibold text-ink" />
              </span>
            </div>
            <Link href="/pribeh" className="mt-3 inline-flex text-sm text-ink-soft link-underline">
              {pick(SITE.hero.ctaStory, lang)}
            </Link>

            <ul className="mt-9 grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm text-ink-soft">
              {SITE.hero.bullets.map((bullet) => (
                <li key={bullet.cs} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                  {pick(bullet, lang)}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div className="relative overflow-hidden rounded-[2rem] border border-line shadow-warm">
              <img
                src="/images/lumi-b/domu-hero-4x3.webp"
                srcSet={`${imageVariant('/images/lumi-b/domu-hero-4x3.webp', 640)} 640w, /images/lumi-b/domu-hero-4x3.webp 960w`}
                sizes="(min-width: 1024px) 546px, 90vw"
                alt={pick({ cs: 'Rozsvícený dřevěný lampion Lumi na stole', en: 'A lit Lumi wooden lantern on a table', de: 'Eine leuchtende Lumi-Holzlaterne auf einem Tisch' }, lang)}
                width={960}
                height={720}
                className="aspect-[4/3] w-full object-cover"
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/40 via-transparent to-transparent" />
            </div>
            <div className="absolute -bottom-5 left-5 right-5 flex items-center justify-between gap-3 rounded-2xl border border-line bg-card/95 px-5 py-4 shadow-warm backdrop-blur sm:left-8 sm:right-auto sm:max-w-xs">
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted">
                  {pick({ cs: 'Číslovaná edice', en: 'Numbered edition', de: 'Nummerierte Edition' }, lang)}
                </p>
                <p className="mt-1 text-sm font-medium text-ink">
                  {pick({ cs: 'Každý kus projde rukama', en: 'Every piece passes through our hands', de: 'Jedes Stück geht durch unsere Hände' }, lang)}
                </p>
              </div>
              <Sparkles className="h-6 w-6 shrink-0 text-amber-600" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust strip ──────────────────────────────────────────────── */}
      <section className="border-y border-line bg-parchment-deep/60">
        <div className="container-lumi grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {SITE.trust.map((item, index) => {
            const Icon = TRUST_ICONS[index] ?? Sparkles;
            return (
              <div key={item.title.cs} className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-amber-700">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{pick(item.title, lang)}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{pick(item.text, lang)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 3D — naše eso (model se načítá sám, s přepínačem motivů) ──── */}
      <HomeShowcase />

      {/* ── Produkty ─────────────────────────────────────────────────── */}
      <section className="container-lumi py-16 lg:py-24">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading kicker={SITE.productsSection.kicker} title={SITE.productsSection.title} lead={SITE.productsSection.lead} lang={lang} />
          <Link href="/kolekce" className="btn-outline shrink-0">
            {pick(SITE.productsSection.cta, lang)}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((product, index) => (
            <Reveal key={product.externalId} delay={index * 90}>
              <ProductCard product={product} priority={index === 0} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Šest motivových kolekcí (Engine B v2) ────────────────────── */}
      <CollectionGrid />

      {/* ── Příležitosti ─────────────────────────────────────────────── */}
      <section className="border-y border-line bg-parchment-deep/60 py-16 lg:py-24">
        <div className="container-lumi">
          <SectionHeading kicker={SITE.occasions.kicker} title={SITE.occasions.title} lang={lang} />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SITE.occasions.items.map((item, index) => (
              <Reveal key={item.href + item.title.cs} delay={index * 80}>
                <Link href={item.href} className="group block overflow-hidden rounded-2xl border border-line bg-card transition-shadow hover:shadow-warm">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img
                      src={item.image}
                      alt={pick(item.title, lang)}
                      width={640}
                      height={480}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="p-5">
                    <h3 className="h-display text-lg font-semibold text-ink">{pick(item.title, lang)}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{pick(item.text, lang)}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dílna ────────────────────────────────────────────────────── */}
      <section className="container-lumi py-16 lg:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2rem] border border-line">
              <img
                src="/images/lumi-b/dilna-4x3.webp"
                srcSet={`${imageVariant('/images/lumi-b/dilna-4x3.webp', 640)} 640w, /images/lumi-b/dilna-4x3.webp 960w`}
                sizes="(min-width: 1024px) 546px, 90vw"
                alt={pick({ cs: 'Ilustrace dílny a příběhu lampionu', en: 'Illustration of the workshop and the lantern story', de: 'Illustration der Werkstatt und der Laternengeschichte' }, lang)}
                width={640}
                height={480}
                loading="lazy"
                decoding="async"
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
          </Reveal>
          <div>
            <SectionHeading kicker={SITE.craft.kicker} title={SITE.craft.title} lead={SITE.craft.paragraphs[0]} lang={lang} />
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">{pick(SITE.craft.paragraphs[1], lang)}</p>
            <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {SITE.craft.facts.map((fact) => (
                <div key={fact.label.cs} className="border-l border-amber-600/40 pl-3">
                  <dt className="h-display text-2xl font-semibold text-ink">{fact.value}</dt>
                  <dd className="text-[0.68rem] uppercase tracking-[0.12em] text-muted">{pick(fact.label, lang)}</dd>
                </div>
              ))}
            </dl>
            <Link href="/pribeh" className="btn-outline mt-8">
              {pick(SITE.craft.cta, lang)}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Galerie ──────────────────────────────────────────────────── */}
      <section className="container-lumi py-16 lg:py-24">
        <SectionHeading kicker={SITE.gallery.kicker} title={SITE.gallery.title} lang={lang} />
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">{pick(SITE.gallery.note, lang)}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SITE.gallery.items.map((item, index) => (
            <Reveal key={item.src} delay={index * 70}>
              <figure className="overflow-hidden rounded-2xl border border-line bg-card">
                <img
                  src={item.src}
                  alt={pick(item.caption, lang)}
                  width={960}
                  height={720}
                  loading="lazy"
                  decoding="async"
                  className={
                    item.fit === 'contain'
                      ? 'aspect-[4/3] w-full bg-parchment-deep object-contain p-3'
                      : 'aspect-[4/3] w-full object-cover'
                  }
                />
                <figcaption className="px-4 py-3 text-xs uppercase tracking-[0.12em] text-muted">{pick(item.caption, lang)}</figcaption>
              </figure>
            </Reveal>
          ))}
          {[0, 1].map((slot) => (
            <div
              key={`photo-slot-${slot}`}
              className="flex aspect-[4/3] flex-col items-center justify-center rounded-2xl border border-dashed border-ink/20 bg-card/50 p-6 text-center"
            >
              <ImagePlus className="h-8 w-8 text-amber-600/70" />
              <p className="mt-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">
                {pick(SITE.gallery.placeholder, lang)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Citát ────────────────────────────────────────────────────── */}
      <section className="bg-forest py-16 text-parchment">
        <div className="container-lumi max-w-3xl text-center">
          <p className="h-display text-2xl font-medium leading-snug text-parchment sm:text-3xl">„{pick(SITE.quote.text, lang)}“</p>
          <p className="mt-4 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-amber-300/80">{pick(SITE.quote.source, lang)}</p>
        </div>
      </section>

      {/* ── B2B ──────────────────────────────────────────────────────── */}
      <section className="container-lumi py-16 lg:py-24">
        <div className="overflow-hidden rounded-[2rem] border border-line bg-card">
          <div className="grid lg:grid-cols-2">
            <div className="p-8 sm:p-12">
              <p className="eyebrow">{pick(SITE.b2b.kicker, lang)}</p>
              <h2 className="h2 mt-3 text-balance">{pick(SITE.b2b.title, lang)}</h2>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">{pick(SITE.b2b.text, lang)}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/svatby" className="btn-primary">
                  {pick(SITE.b2b.ctaWeddings, lang)}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/firmy" className="btn-outline">
                  {pick(SITE.b2b.ctaCompanies, lang)}
                </Link>
              </div>
            </div>
            <div className="relative min-h-[260px]">
              <img
                src="/images/lumi-b/svatba-hero-1280.webp"
                alt={pick({ cs: 'Lumi 2 na svatebním stole', en: 'Lumi 2 on a wedding table', de: 'Lumi 2 auf einem Hochzeitstisch' }, lang)}
                width={1280}
                height={720}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="container-lumi pb-16 lg:pb-24">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="eyebrow">{pick({ cs: 'Otázky', en: 'Questions', de: 'Fragen' }, lang)}</p>
            <h2 className="h2 mt-3">{pick({ cs: 'Než se zeptáte', en: 'Before you ask', de: 'Bevor Sie fragen' }, lang)}</h2>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              {pick(
                {
                  cs: 'Pokud tu odpověď nenajdete, napište nám. Odpovídáme do jednoho pracovního dne.',
                  en: 'If you cannot find the answer, write to us. We reply within one working day.',
                  de: 'Wenn Sie keine Antwort finden, schreiben Sie uns. Wir antworten innerhalb eines Werktags.',
                },
                lang,
              )}
            </p>
            <Link href="/faq" className="btn-outline mt-6">
              {pick({ cs: 'Všechny otázky', en: 'All questions', de: 'Alle Fragen' }, lang)}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <FaqAccordion items={FAQ_ITEMS.slice(0, 5)} />
        </div>
      </section>

      {/* ── Newsletter ───────────────────────────────────────────────── */}
      <section className="border-t border-line bg-parchment-deep/60 py-16">
        <div className="container-lumi grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="h3">{pick(SITE.newsletter.title, lang)}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">{pick(SITE.newsletter.text, lang)}</p>
          </div>
          <NewsletterForm source="home" />
        </div>
      </section>
    </>
  );
}
