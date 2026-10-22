'use client';

/**
 * ZisAvatar — ZIS identity avatar for MarketPlace.
 *
 * Renders the deterministic ZIS avatar for any identity seed (zion1…
 * address, 0x… address, ZIS user id) through the local /api/auth proxy —
 * same avatar the user sees on the website, OASIS and the desktop agent.
 * Explicit `src` (user.avatar) wins; a broken image falls back to a
 * letter initial so a surface never renders empty.
 */

import { useState } from 'react';
import { zisAvatarUrl } from '../../../shared/zis-client';

interface Props {
  /** Stable identity seed for the generated fallback (user id, address). */
  seed: string;
  /** Explicit avatar URL — user.avatar. When nullish, the generated one renders. */
  src?: string | null;
  size?: number;
  alt?: string;
  className?: string;
  /** Fallback letters (address fragment). Defaults to 'Z'. */
  initial?: string;
  /** When true and no explicit src, request the SMIL-animated variant (a=1). */
  animated?: boolean;
}

export default function ZisAvatar({ seed, src, size = 28, alt = '', className = '', initial = 'Z', animated = false }: Props) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const url = src || zisAvatarUrl(seed, { sz: 128, a: animated });

  if (brokenUrl === url) {
    return (
      <div
        className={`bg-gradient-to-br from-rasta-gold to-rasta-red flex items-center justify-center font-black text-rasta-black ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.38 }}
      >
        {initial.toUpperCase()}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      width={size}
      height={size}
      className={`object-cover ${className}`}
      style={{ width: size, height: size }}
      referrerPolicy="no-referrer"
      onError={() => setBrokenUrl(url)}
    />
  );
}
