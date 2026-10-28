'use client';

import { useState } from 'react';

const ACCENT_BG: Record<string, string> = {
  gold: 'linear-gradient(135deg, rgba(252,209,22,0.22), rgba(252,209,22,0.06))',
  cyan: 'linear-gradient(135deg, rgba(6,105,40,0.35), rgba(6,105,40,0.08))',
  purple: 'linear-gradient(135deg, rgba(228,30,43,0.3), rgba(228,30,43,0.07))',
  green: 'linear-gradient(135deg, rgba(0,255,65,0.22), rgba(0,255,65,0.05))',
};

const ACCENT_BORDER: Record<string, string> = {
  gold: 'rgba(252,209,22,0.45)',
  cyan: 'rgba(6,105,40,0.6)',
  purple: 'rgba(228,30,43,0.55)',
  green: 'rgba(0,255,65,0.4)',
};

/**
 * Coin logo with a graceful fallback — renders the coin's brand asset when
 * available, otherwise a monogram badge tinted by the coin's accent. Used
 * on cards, tables and the start wizard so every listed coin has a face.
 */
export default function CoinLogo({
  logo,
  ticker,
  accent,
  size = 36,
}: {
  logo?: string;
  ticker: string;
  accent: string;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);

  if (logo && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={`${ticker} logo`}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className="shrink-0 rounded-full object-contain ring-1 ring-white/10 bg-black/30"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-black"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.3),
        letterSpacing: '-0.02em',
        color: 'rgba(255,255,255,0.9)',
        background: ACCENT_BG[accent] ?? ACCENT_BG.gold,
        border: `1px solid ${ACCENT_BORDER[accent] ?? ACCENT_BORDER.gold}`,
      }}
    >
      {ticker.slice(0, 4)}
    </span>
  );
}
