'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  Coins,
  KeyRound,
  Layers,
  ListOrdered,
  Mail,
  Milestone,
  Flame,
  Package,
  Quote,
  ShoppingCart,
  Snowflake,
  Sparkles,
} from 'lucide-react';
import type { XmasProduct } from '@/data/christmasProducts';
import { useLangT } from '@/lib/useTranslation';
import ExperimentalNotice from '@/components/xmas/ExperimentalNotice';
import FactsStrip from '@/components/xmas/FactsStrip';
import Lantern3D from '@/components/xmas/Lantern3D';
import { FIRE_SAFETY, requiresFireConsent } from '@/lib/fire-safety';

/** Lehký renderer **tučného** inline markdownu v detailních odstavcích. */
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} className="text-white font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

export default function XmasProductPage({ product }: { product: XmasProduct }) {
  const { t, lang } = useLangT();
  const pick = <T extends { cs: string; en: string }>(x: T) => (lang === 'cs' ? x.cs : x.en);
  const bonus = product.bonus.toLocaleString(lang === 'cs' ? 'cs-CZ' : 'en-US');
  const price = t('common.price', { price: product.priceCzk, symbol: t('common.kcSymbol') });
  /** Svíčkové zboží = detail ukazuje i bezpečnostní blok (stejný text jako pokladna). */
  const needsFireSafety = requiresFireConsent([{ externalId: product.externalId }]);

  return (
    <div className="space-y-8">
      {/* Back */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-rasta-gold transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> {t('xmasPage.back')}
      </Link>

      {/* Hero band */}
      <div className="zion-section overflow-hidden !p-0">
        {/* Poměr se řídí zdrojem: ultraširoký banner je 2,5:1, běžný obrázek 16:9.
            Dřív tu byl aspect-[21/9] + max-h-[420px], což banner (2,5:1) ořezávalo
            shora i zdola — „uříznutý" hero. */}
        <div className={`relative ${product.heroWide ? 'aspect-[5/2]' : 'aspect-[16/9]'}`}>
          <img
            src={product.heroWide ?? product.image}
            alt={pick(product.imageAlt)}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute top-4 left-4">
            <span className="rarity-badge rarity-legendary inline-flex items-center gap-1.5">
              <Snowflake className="w-3 h-3" /> {t('xmas.badge')}
            </span>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <div className="zion-kicker inline-flex items-center gap-2">{pick(product.kicker)}</div>
            <h1 className="text-3xl md:text-4xl font-black font-display mt-2">
              <span className="text-gradient-gold">{pick(product.title)}</span>
            </h1>
            <p className="text-sm md:text-base text-gray-300 italic mt-1 max-w-2xl">
              {pick(product.subtitle)}
            </p>
          </div>
        </div>
      </div>

      {/* Numbers */}
      {product.facts && product.facts.length > 0 && (
        <FactsStrip facts={product.facts} />
      )}

      {/* Galerie — doplňkové snímky od 👤 (1672×941) */}
      {product.gallery && product.gallery.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {product.gallery.map((shot) => (
            <figure
              key={shot.src}
              className="relative aspect-[16/9] overflow-hidden rounded-xl ring-1 ring-white/10"
            >
              <img
                src={shot.src}
                alt={pick(shot.alt)}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </figure>
          ))}
        </div>
      )}

      {/* Body grid */}
      <div className="grid lg:grid-cols-[1fr_minmax(0,340px)] gap-8">
        {/* Content */}
        <div className="space-y-6 min-w-0">
          <p className="text-base md:text-lg text-gray-200 leading-relaxed">{pick(product.intro)}</p>

          {product.details.map((d, i) => (
            <p key={i} className="text-sm md:text-[15px] text-gray-300 leading-relaxed">
              {renderInline(pick(d))}
            </p>
          ))}

          {/* Features */}
          <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px]">
            {product.features.map((f) => (
              <span
                key={f.en}
                className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-gray-300 px-2.5 py-1 rounded-full"
              >
                <Sparkles className="w-3.5 h-3.5 text-rasta-gold" /> {pick(f)}
              </span>
            ))}
          </div>

          {/* Příběh k výrobku — proč je udělaný tak, jak je (ne prodejní text) */}
          {product.story && (
            <div id="pribeh" className="pt-6 space-y-4 scroll-mt-24">
              <div className="space-y-1">
                <div className="zion-kicker">{pick(product.story.kicker)}</div>
                <h2 className="text-xl font-bold font-display flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-rasta-gold" />
                  {pick(product.story.title)}
                </h2>
                {product.story.lead && (
                  <p className="text-sm text-gray-400 leading-relaxed">{pick(product.story.lead)}</p>
                )}
              </div>

              <div className="rounded-2xl border border-rasta-gold/25 bg-gradient-to-b from-rasta-gold/[0.07] to-transparent p-5 md:p-6 space-y-4">
                {product.story.paragraphs.map((paragraph, i) => (
                  <p key={i} className="font-serif text-[15px] md:text-base leading-[1.85] text-gray-200">
                    {renderInline(pick(paragraph))}
                  </p>
                ))}
              </div>

              {product.story.message && product.story.message.length > 0 && (
                <div className="space-y-3 border-l-2 border-rasta-gold/60 pl-4">
                  {product.story.message.map((line, i) => (
                    <figure key={i} className="space-y-1">
                      <blockquote className="text-sm md:text-[15px] italic leading-relaxed text-gray-200">
                        {pick(line.text)}
                      </blockquote>
                      <figcaption className="text-xs text-gray-500">
                        — {pick(line.speaker)}
                        {line.source ? ` · ${pick(line.source)}` : ''}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}

              {product.story.closing && (
                <p className="text-sm italic leading-relaxed text-gray-300">{pick(product.story.closing)}</p>
              )}

              {/* Šest stěn = šest krátkých kapitol, v pořadí cesty */}
              {product.story.faces && product.story.faces.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-rasta-gold/90">
                    {pick(product.story.facesTitle ?? { cs: 'Šest stěn, šest kapitol', en: 'Six walls, six chapters' })}
                  </h3>
                  <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {product.story.faces.map((face, i) => (
                      <li
                        key={i}
                        className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-rasta-gold/80">
                            {pick(face.tag)}
                          </span>
                          <span className="text-sm font-semibold text-white">{pick(face.name)}</span>
                        </div>
                        <p className="text-[13px] leading-relaxed text-gray-300">{pick(face.line)}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* Jak výrobek složit + bezpečnost (jen fyzické zboží se svíčkou) */}
          {product.guide && (
            <div id="slozeni" className="pt-6 space-y-4 scroll-mt-24">
              <h2 className="text-xl font-bold font-display flex items-center gap-2">
                <ListOrdered className="w-5 h-5 text-rasta-gold" />
                {pick(product.guide.title)}
              </h2>
              <p className="text-sm md:text-[15px] text-gray-300 leading-relaxed">{pick(product.guide.intro)}</p>
              <ol className="space-y-3">
                {product.guide.steps.map((step, index) => (
                  <li
                    key={index}
                    className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rasta-gold/15 text-xs font-bold text-rasta-gold">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white">{pick(step.title)}</div>
                      <p className="mt-1 text-sm text-gray-300 leading-relaxed">{renderInline(pick(step.body))}</p>
                    </div>
                  </li>
                ))}
              </ol>

              {needsFireSafety && (
                <div className="rounded-xl border border-rasta-red/40 bg-rasta-red/5 p-4">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-wider text-rasta-gold">
                    <Flame className="h-4 w-4" />
                    {pick(FIRE_SAFETY.title)}
                  </h3>
                  <p className="mb-3 text-sm text-gray-300 leading-relaxed">{pick(FIRE_SAFETY.lead)}</p>
                  <ol className="space-y-2 text-sm text-gray-300">
                    {FIRE_SAFETY.points.map((point, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="shrink-0 font-bold text-rasta-gold">{index + 1}.</span>
                        <span>{renderInline(pick(point))}</span>
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3 text-xs leading-relaxed text-gray-400">{pick(FIRE_SAFETY.disclaimer)}</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                    {lang === 'cs'
                      ? 'Před dokončením objednávky u pokladny tento text odsouhlasíte a podepíšete se jménem — podpis se uloží k objednávce i s časem.'
                      : 'Before completing the order at checkout you will accept this text and sign it with your name — the signature is stored with the order along with the time.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 3D slot — model se načte až po kliknutí, když je nahraný */}
          {product.model3d && (
            <div className="pt-6">
              <Lantern3D
                modelUrl={product.model3d}
                poster={product.gallery?.[1]?.src ?? product.image}
                posterAlt={product.gallery?.[1] ? pick(product.gallery[1].alt) : pick(product.title)}
              />
            </div>
          )}

          {/* Samples — real text from the manuscript */}
          {product.samples && product.samples.length > 0 && (
            <div id="ukazky" className="pt-6 space-y-5 scroll-mt-24">
              <div className="space-y-1">
                <h2 className="text-xl font-bold font-display flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-rasta-gold" />
                  {lang === 'cs' ? 'Ukázky z knihy' : 'Samples from the book'}
                </h2>
                <p className="text-sm text-gray-400">
                  {lang === 'cs'
                    ? 'Skutečné odstavce z rukopisu — ne shrnutí. Takhle zní kniha, kterou si kupujete.'
                    : 'Real paragraphs from the manuscript — not a summary. This is how the book you are buying reads.'}
                </p>
              </div>

              {product.samples.map((sample, i) => (
                <article
                  key={i}
                  className="rounded-2xl bg-[#f6f1e4] text-[#221d16] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.8)] ring-1 ring-black/10 overflow-hidden"
                >
                  {sample.image && (
                    <div className="relative aspect-[16/9] overflow-hidden">
                      <img
                        src={sample.image}
                        alt={pick(sample.title)}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                    </div>
                  )}
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-black/10 px-6 py-3">
                    <span className="text-[11px] uppercase tracking-[0.22em] text-[#8a6b28]">
                      {pick(sample.label)}
                    </span>
                    <span className="text-[11px] text-[#6b6152]">
                      {pick(sample.source)}
                    </span>
                  </div>
                  <div className="px-6 py-5 space-y-3">
                    <h3 className="font-serif text-lg font-semibold text-[#2b2117]">
                      {pick(sample.title)}
                    </h3>
                    {sample.paragraphs.map((p, j) => (
                      <p
                        key={j}
                        className={`font-serif text-[15px] leading-[1.8] text-[#332a20] ${
                          j === 0 ? 'first-letter:float-left first-letter:mr-2 first-letter:text-4xl first-letter:font-bold first-letter:leading-[0.9] first-letter:text-[#8a6b28]' : ''
                        }`}
                      >
                        {pick(p)}
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Editions — eight tellings of one story */}
          {product.editions && product.editions.length > 0 && (
            <div className="pt-6 space-y-4">
              <div className="space-y-1">
                <h2 className="text-xl font-bold font-display flex items-center gap-2">
                  <Layers className="w-5 h-5 text-rasta-gold" />
                  {lang === 'cs' ? 'Osm edic jednoho příběhu' : 'Eight editions of one story'}
                </h2>
                <p className="text-sm text-gray-400">
                  {lang === 'cs'
                    ? 'Každá edice je samostatná kniha — jiná délka, jiný úhel, stejný kýl. Všechny jsou v sadě a všechny v pěti jazycích.'
                    : 'Each edition is a book of its own — another length, another angle, the same keel. All are included, all in five languages.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mobile-keep-cols">
                {product.editions.map((edition) => (
                  <figure key={edition.slug} className="space-y-2">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg ring-1 ring-white/10">
                      <img
                        src={edition.cover}
                        alt={pick(edition.name)}
                        className="h-full w-full object-cover"
                      />
                      {edition.flagship && (
                        <span className="absolute left-2 top-2 rounded-full bg-rasta-gold/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                          {lang === 'cs' ? 'vlajková' : 'flagship'}
                        </span>
                      )}
                    </div>
                    <figcaption className="space-y-0.5">
                      <div className="text-[13px] font-semibold text-white">{pick(edition.name)}</div>
                      <p className="text-[11px] leading-snug text-gray-500">{pick(edition.line)}</p>
                      <p className="text-[10px] text-gray-600">
                        {lang === 'cs'
                          ? `${edition.words.cz.toLocaleString('cs-CZ')} slov`
                          : `${edition.words.en.toLocaleString('en-US')} words`}
                      </p>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}

          {/* How it works — steps */}
          <div className="pt-4 space-y-4">
            <h2 className="text-xl font-bold font-display flex items-center gap-2">
              <ListOrdered className="w-5 h-5 text-rasta-gold" />
              {t('xmasPage.howTitle')}
            </h2>
            <ol className="space-y-3">
              {(lang === 'cs' ? product.steps.cs : product.steps.en).map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-rasta-gold/15 border border-rasta-gold/40 text-rasta-gold text-[11px] font-bold inline-flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm md:text-[15px] text-gray-300 leading-relaxed">
                    {renderInline(step)}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {/* Wallet e-mail note */}
          <div className="zion-section !p-5 border-rasta-green/30 bg-rasta-green/[0.04] space-y-2.5">
            <h3 className="font-display font-bold text-base flex items-center gap-2 text-rasta-green">
              <Mail className="w-4 h-4" /> {t('xwallet.title')}
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed">{renderInline(t('xwallet.body'))}</p>
            <p className="text-xs text-gray-400 leading-relaxed flex items-start gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-rasta-gold mt-0.5 shrink-0" />
              {t('xwallet.importHint')}
            </p>
          </div>

          {/* Quotes (book) */}
          {product.quotes && product.quotes.length > 0 && (
            <div className="pt-4 space-y-4">
              <h2 className="text-xl font-bold font-display flex items-center gap-2">
                <Quote className="w-5 h-5 text-rasta-gold" />
                {t('xmasPage.quotesTitle')}
              </h2>
              {product.quotes.map((q, i) => (
                <figure
                  key={i}
                  className="border-l-2 border-rasta-gold/60 pl-4 py-1 space-y-1.5"
                >
                  <blockquote className="text-sm md:text-[15px] text-gray-200 italic leading-relaxed">
                    {lang === 'cs' ? q.cs : q.en}
                  </blockquote>
                  <figcaption className="text-xs text-gray-500">
                    — {pick(q.source)}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-24 self-start">
          {/* Price box */}
          <div className="zion-section !p-5 space-y-4">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500">
                {t('xmasPage.priceLabel')}
              </div>
              <div className="font-mono text-3xl text-gradient-gold font-bold mt-1">{price}</div>
              <div className="inline-flex items-center gap-1.5 mt-2 bg-rasta-gold/10 border border-rasta-gold/25 text-rasta-gold px-2.5 py-1 rounded-full text-xs font-semibold">
                <Coins className="w-3.5 h-3.5" /> {t('xmas.bonus', { amount: bonus })}
              </div>
            </div>

            {/* In the box */}
            <div>
              <div className="text-[11px] uppercase tracking-wide text-gray-500 flex items-center gap-1.5 mb-2">
                <Package className="w-3.5 h-3.5" /> {t('xmasPage.inBoxTitle')}
              </div>
              <ul className="space-y-1.5">
                {(lang === 'cs' ? product.inBox.cs : product.inBox.en).map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[13px] text-gray-300">
                    <Check className="w-3.5 h-3.5 text-rasta-green mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            {product.buyable ? (
              <Link
                href="/shop"
                className="zion-button-primary w-full inline-flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-4 h-4" /> {t('xmasPage.buyInShop')}
              </Link>
            ) : (
              <span className="w-full inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-gray-400">
                <ShoppingCart className="w-4 h-4" /> {t('xmasPage.comingSoon')}
              </span>
            )}

            {product.note && (
              <p className="text-[11px] text-gray-500 leading-relaxed">{pick(product.note)}</p>
            )}
          </div>

          <ExperimentalNotice />
        </aside>
      </div>

      {/* Roadmap — kam to směřuje */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold font-display flex items-center gap-2">
          <Milestone className="w-5 h-5 text-rasta-gold" />
          {t('xroad.title')}
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          {(['p1', 'p2', 'p3'] as const).map((phase, i) => (
            <div
              key={phase}
              className={`zion-section !p-5 space-y-2 ${
                i === 0 ? 'border-rasta-gold/40' : 'border-white/10'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    i === 0
                      ? 'bg-rasta-gold/15 border-rasta-gold/40 text-rasta-gold'
                      : 'bg-white/5 border-white/15 text-gray-400'
                  }`}
                >
                  {t(`xroad.${phase}status`)}
                </span>
              </div>
              <h3 className="font-display font-bold text-sm text-white">
                {t(`xroad.${phase}name`)}
              </h3>
              <p className="text-xs text-gray-400 leading-relaxed">{t(`xroad.${phase}desc`)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold font-display flex items-center gap-2">
          <Quote className="w-5 h-5 text-rasta-gold" />
          {t('xmasPage.faqTitle')}
        </h2>
        <div className="space-y-2.5">
          {product.faq.map((item, i) => (
            <details
              key={i}
              className="group zion-section !p-0 overflow-hidden [&_summary]:list-none"
            >
              <summary className="flex items-center justify-between gap-3 px-5 py-3.5 cursor-pointer select-none text-sm font-semibold text-gray-200 hover:text-rasta-gold transition-colors">
                {pick(item.q)}
                <ChevronDown className="w-4 h-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180" />
              </summary>
              <p className="px-5 pb-4 text-sm text-gray-400 leading-relaxed">
                {renderInline(pick(item.a))}
              </p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
