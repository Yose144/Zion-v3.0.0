'use client';

/**
 * ZisAvatar — renders a ZIS user's avatar with a deterministic generated
 * fallback. Every account always resolves to an image:
 *   explicit src (user.avatar) → generated /api/auth/avatar/<seed>.svg
 *   → letter initial on load error.
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
}

export default function ZisAvatar({ seed, src, size = 28, alt = '', className = '', initial = 'Z' }: Props) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const url = src || zisAvatarUrl(seed, { sz: 128 });

  if (brokenUrl === url) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg bg-gradient-to-br from-oasis-gold to-oasis-purple font-bold text-white ${className}`}
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
      className={`rounded-lg object-cover ${className}`}
      style={{ width: size, height: size }}
      referrerPolicy="no-referrer"
      onError={() => setBrokenUrl(url)}
    />
  );
}
