'use client';

/**
 * ZisAvatar — renders a user's avatar with a deterministic generated
 * fallback. Every ZIS account always resolves to an image:
 *   explicit src (user.avatar — custom URL, Google picture, or a chosen
 *   generated variant) → generated /api/auth/avatar/<seed>.svg.
 * If even that fails to load, falls back to a letter initial.
 */

import { useState } from 'react';
import { zisAvatarUrl } from '@/lib/zis';

interface Props {
  /** Stable identity seed for the generated fallback (user id, address). */
  seed: string;
  /** Explicit avatar URL — user.avatar. When nullish, the generated one renders. */
  src?: string | null;
  size?: number;
  alt?: string;
  className?: string;
  /** Fallback letter (displayName initial). Defaults to 'Z'. */
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
        className={`bg-gradient-to-br from-zion-gold to-zion-purple flex items-center justify-center font-bold text-white ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
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
