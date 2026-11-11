'use client';

import type { ReactNode } from 'react';
import type { Localized } from '@/lib/i18n';
import { pick } from '@/lib/i18n';
import { useLang } from '@/lib/lang-context';
import { imageVariant } from '@/lib/images';

export default function PageHero({
  kicker,
  title,
  lead,
  image,
  imageAlt,
  children,
  compact = false,
}: {
  kicker: Localized;
  title: Localized;
  lead?: Localized;
  image?: string;
  imageAlt?: Localized;
  children?: ReactNode;
  compact?: boolean;
}) {
  const { lang } = useLang();

  return (
    <section className="border-b border-line bg-parchment-deep/60">
      <div className={`container-lumi grid items-center gap-8 ${image ? 'lg:grid-cols-[1.05fr_0.95fr]' : ''} ${compact ? 'py-10 lg:py-12' : 'py-12 lg:py-20'}`}>
        <div className={image ? '' : 'max-w-3xl'}>
          <p className="eyebrow">{pick(kicker, lang)}</p>
          <h1 className={`mt-4 text-balance ${compact ? 'h2' : 'h1'}`}>{pick(title, lang)}</h1>
          {lead ? <p className="lead mt-5 text-pretty">{pick(lead, lang)}</p> : null}
          {children ? <div className="mt-7 flex flex-wrap gap-3">{children}</div> : null}
        </div>
        {image ? (
          <div className="relative overflow-hidden rounded-[2rem] border border-line shadow-warm">
            <img
              src={image}
              srcSet={`${imageVariant(image, 640)} 640w, ${image} 960w`}
              sizes="(min-width: 1024px) 546px, 90vw"
              alt={imageAlt ? pick(imageAlt, lang) : ''}
              width={960}
              height={720}
              loading="eager"
              decoding="async"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
