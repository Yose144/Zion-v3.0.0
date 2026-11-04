'use client';

import Link from 'next/link';
import {
  BookOpen,
  Check,
  Coins,
  Gift,
  PenTool,
  ShoppingCart,
  Snowflake,
  Ticket,
  type LucideIcon,
} from 'lucide-react';
import { useLangT } from '@/lib/useTranslation';
import { getXmasProduct, type XmasFact, type XmasText } from '@/data/christmasProducts';
import RichText from '@/components/xmas/RichText';
import FactsStrip from '@/components/xmas/FactsStrip';

type Chip = { icon: LucideIcon; label: string; gold?: boolean };

interface ChristmasCardProps {
  image: string;
  imageAlt: string;
  badge: string;
  kicker: string;
  title: string;
  subtitle: string;
  description: string;
  /** delší, konkrétnější odstavec z dat produktu (nahradí `description`) */
  lead?: string;
  /** 3–5 konkrétních bodů — co si pod dárkem představit */
  bullets?: string[];
  /** reálná čísla produktu (edic, stran, světů…) */
  facts?: XmasFact[];
  chips: Chip[];
  ctaLabel: string;
  ctaDisabled?: boolean;
  detailHref: string;
  detailLabel: string;
  reverse?: boolean;
}

function ChristmasCard({
  image,
  imageAlt,
  badge,
  kicker,
  title,
  subtitle,
  description,
  lead,
  bullets,
  facts,
  chips,
  ctaLabel,
  ctaDisabled,
  detailHref,
  detailLabel,
  reverse,
}: ChristmasCardProps) {
  return (
    <section>
      <div className="zion-section overflow-hidden !p-0">
        <div className="grid md:grid-cols-[minmax(0,340px)_1fr]">
          {/* Visual */}
          <div
            className={`relative aspect-video md:aspect-auto md:min-h-[320px] ${
              reverse ? 'md:order-2' : ''
            }`}
          >
            <img
              src={image}
              alt={imageAlt}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div
              className={`absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent ${
                reverse
                  ? 'md:bg-gradient-to-l md:from-transparent md:to-black/25'
                  : 'md:bg-gradient-to-r md:from-transparent md:to-black/25'
              }`}
            />
            <div className="absolute top-3 left-3 z-10">
              <span className="rarity-badge rarity-legendary inline-flex items-center gap-1.5">
                <Snowflake className="w-3 h-3" /> {badge}
              </span>
            </div>
          </div>

          {/* Content */}
          <div
            className={`p-6 md:p-8 flex flex-col justify-center ${reverse ? 'md:order-1' : ''}`}
          >
            <div className="zion-kicker inline-flex items-center gap-2">{kicker}</div>
            <h2 className="text-2xl md:text-3xl font-black font-display mt-3">
              <span className="text-gradient-gold">{title}</span>
            </h2>
            <p className="text-sm text-gray-400 italic mt-1">{subtitle}</p>
            <p className="text-sm text-gray-300 mt-4 leading-relaxed max-w-xl">
              <RichText text={lead ?? description} />
            </p>

            {bullets && bullets.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-[13px] text-gray-400">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rasta-gold" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}

            {facts && facts.length > 0 && (
              <div className="mt-5">
                <FactsStrip facts={facts} compact />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-5 text-[11px]">
              {chips.map(({ icon: Icon, label, gold }) => (
                <span
                  key={label}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                    gold
                      ? 'bg-rasta-gold/10 border-rasta-gold/25 text-rasta-gold'
                      : 'bg-white/5 border-white/10 text-gray-400'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-6">
              {ctaDisabled ? (
                <span className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-gray-400">
                  <ShoppingCart className="w-4 h-4" /> {ctaLabel}
                </span>
              ) : (
                <Link href="/shop" className="zion-button-primary inline-flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" /> {ctaLabel}
                </Link>
              )}
              <Link
                href={detailHref}
                className="text-sm text-rasta-gold hover:underline font-semibold"
              >
                {detailLabel} →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ZionPassSection() {
  const { t, lang } = useLangT();
  const bonus = (108000).toLocaleString(lang === 'cs' ? 'cs-CZ' : 'en-US');
  const price = t('common.price', { price: 108, symbol: t('common.kcSymbol') });
  const product = getXmasProduct('zion-pass');
  const pick = (x?: XmasText) => (x ? (lang === 'cs' ? x.cs : x.en) : undefined);

  return (
    <ChristmasCard
      image="/vanoce-pass.webp"
      imageAlt={t('xmas.passImageAlt')}
      badge={t('xmas.badge')}
      kicker={t('xmas.passKicker')}
      title={t('xmas.passTitle')}
      subtitle={t('xmas.passSubtitle')}
      description={t('xmas.passDescription')}
      lead={pick(product?.home?.lead)}
      bullets={product?.home?.bullets.map((b) => pick(b) ?? '').filter(Boolean)}
      facts={product?.facts}
      chips={[
        { icon: Coins, label: t('xmas.bonus', { amount: bonus }), gold: true },
        { icon: Ticket, label: t('xmas.passChipAccess') },
        { icon: Gift, label: t('xmas.passChipGift') },
      ]}
      ctaLabel={`${t('xmas.passCta')} · ${price}`}
      detailHref="/vanoce/zion-pass"
      detailLabel={t('xmasPage.moreInfo')}
    />
  );
}

export function LampionSection() {
  const { t, lang } = useLangT();
  const bonus = (432000).toLocaleString(lang === 'cs' ? 'cs-CZ' : 'en-US');
  const price = t('common.price', { price: 432, symbol: t('common.kcSymbol') });
  const product = getXmasProduct('lampion');
  const pick = (x?: XmasText) => (x ? (lang === 'cs' ? x.cs : x.en) : undefined);

  return (
    <ChristmasCard
      image="/vanoce-lampion.webp"
      imageAlt={t('xmas.lampionImageAlt')}
      badge={t('xmas.badge')}
      kicker={t('xmas.lampionKicker')}
      title={t('xmas.lampionTitle')}
      subtitle={t('xmas.lampionSubtitle')}
      description={t('xmas.lampionDescription')}
      lead={pick(product?.home?.lead)}
      bullets={product?.home?.bullets.map((b) => pick(b) ?? '').filter(Boolean)}
      facts={product?.facts}
      chips={[
        { icon: Coins, label: t('xmas.bonus', { amount: bonus }), gold: true },
        { icon: PenTool, label: t('xmas.lampionChipEngraved') },
        { icon: BookOpen, label: t('xmas.lampionChipBook') },
      ]}
      ctaLabel={`${t('xmas.lampionCta')} · ${price}`}
      ctaDisabled
      detailHref="/vanoce/lampion"
      detailLabel={t('xmasPage.moreInfo')}
      reverse
    />
  );
}
