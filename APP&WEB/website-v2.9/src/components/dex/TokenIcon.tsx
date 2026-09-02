'use client';

/**
 * TokenIcon — renders a token's icon image or a colored initials fallback.
 *
 * Uses the shared `token-icons` registry. ZION-family tokens (ZION, wZION,
 * tZION) show the ZION logo; other tokens show a colored circle with their
 * initials.
 */

import { getTokenIconPath, getTokenFallbackColor, getTokenInitials } from '@/lib/token-icons';

interface Props {
  symbol: string;
  size?: number;
  className?: string;
}

export default function TokenIcon({ symbol, size = 24, className = '' }: Props) {
  const iconPath = getTokenIconPath(symbol);

  if (iconPath) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={iconPath}
        alt={symbol}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        loading="lazy"
        decoding="async"
      />
    );
  }

  // Fallback: colored circle with initials
  const color = getTokenFallbackColor(symbol);
  const initials = getTokenInitials(symbol);

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold text-white shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: `#${color}`,
        fontSize: size * 0.4,
      }}
    >
      {initials}
    </div>
  );
}
