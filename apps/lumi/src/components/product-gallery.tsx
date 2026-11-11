'use client';

import { useState } from 'react';
import type { Lang, Localized } from '@/lib/i18n';
import { pick } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { imageVariant } from '@/lib/images';

export default function ProductGallery({
  images,
  alt,
  lang,
}: {
  images: string[];
  alt: Localized;
  lang: Lang;
}) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];

  return (
    <div className="min-w-0 space-y-3">
      <div className="card-warm relative aspect-square w-full overflow-hidden bg-parchment-deep">
        <img
          src={imageVariant(current, 700)}
          alt={pick(alt, lang)}
          className="h-full w-full object-contain p-2"
          loading="eager"
          decoding="async"
        />
      </div>
      {images.length > 1 && (
        <div className="no-scrollbar flex w-full gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`${pick(alt, lang)} ${index + 1}`}
              aria-pressed={index === active}
              className={cn(
                'relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-parchment-deep transition-all',
                index === active ? 'border-ink ring-1 ring-ink' : 'border-transparent opacity-70 hover:opacity-100',
              )}
            >
              <img
                src={imageVariant(image, 200)}
                alt=""
                width={80}
                height={80}
                className="h-full w-full object-contain p-1"
                loading="lazy"
                decoding="async"
              />
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-muted">
        {pick(
          {
            cs: 'Fotografie jsou zatím ilustrační. Reálné snímky doplníme v dalším kole.',
            en: 'Photos are placeholders for now. Real shots will follow in the next round.',
            de: 'Die Fotos sind vorerst Platzhalter. Echte Aufnahmen folgen im nächsten Schritt.',
          },
          lang,
        )}
      </p>
    </div>
  );
}
