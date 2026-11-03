'use client';

import Image from 'next/image';
import { ArrowRight, Gamepad2, Lock } from 'lucide-react';
import clsx from 'clsx';
import { useLang } from '@/contexts/LanguageContext';

const NIRVANA_URL = 'https://nirvana.zionterranova.com';

const Copy = {
  caption: { cs: 'NIRVANA · První svět OASIS', en: 'NIRVANA · First OASIS world' },
  games: { cs: '7 her · chat · multiplayer', en: '7 games · chat · multiplayer' },
  locked: { cs: 'vstup na ZAP kód', en: 'entry requires a ZAP code' },
  open: { cs: 'Nahlédnout', en: 'Peek inside' },
  alt: {
    cs: 'Nirvana — vesmír prvního světa OASIS: Nová Země a uzly L5',
    en: 'Nirvana — the first OASIS world universe: New Earth and the L5 nodes',
  },
};

/** Hero card — a look-only window into Nirvana, the first OASIS world.
 *  The whole card is a link; entry itself is gated by a ZAP-… code, which
 *  the destination explains (ZION Archive Pass / ZION Pass). */
export default function NirvanaPreview({ className }: { className?: string }) {
  const { lang } = useLang();
  const cs = lang === 'cs';

  return (
    <a
      href={NIRVANA_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx('group block', className)}
      aria-label={Copy.caption[cs ? 'cs' : 'en']}
    >
      <div
        className={clsx(
          'relative aspect-[5/4] w-full max-h-[300px] overflow-hidden rounded-[22px] sm:max-h-[340px]',
          'border border-rasta-gold/30 bg-gradient-to-b from-rasta-black/85 via-rasta-dark/82 to-rasta-black/86',
          'shadow-[0_12px_48px_rgba(0,0,0,0.45),0_0_0_1px_rgba(252,209,22,0.06)_inset,0_0_64px_rgba(6,105,40,0.12)]',
          'ring-1 ring-rasta-gold/10',
        )}
      >
        <Image
          src="/images/nirvana-preview-v2.webp"
          alt={Copy.alt[cs ? 'cs' : 'en']}
          fill
          className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]"
          sizes="(max-width: 768px) 90vw, 380px"
          priority={false}
        />

        {/* caption — same slot as the old Earth card */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/65 to-transparent px-3 pb-6 pt-2.5">
          <p className="truncate text-center text-[10px] font-medium uppercase tracking-[0.42em] text-rasta-gold/70">
            {Copy.caption[cs ? 'cs' : 'en']}
          </p>
        </div>

        {/* bottom bar: games note + lock + CTA */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent p-3 pt-8">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] text-white/70">
                <Gamepad2 className="h-3.5 w-3.5 shrink-0 text-rasta-gold/80" />
                {Copy.games[cs ? 'cs' : 'en']}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-[10px] text-white/40">
                <Lock className="h-3 w-3 shrink-0" />
                {Copy.locked[cs ? 'cs' : 'en']}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-rasta-gold/40 bg-rasta-gold/15 px-3 py-1.5 text-[11px] font-semibold text-rasta-gold transition-colors group-hover:bg-rasta-gold/25">
              {Copy.open[cs ? 'cs' : 'en']}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}
