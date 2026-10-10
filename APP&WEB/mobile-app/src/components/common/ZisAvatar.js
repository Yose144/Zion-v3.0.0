/**
 * ZisAvatar.js — ZIS identity avatar for React Native
 * ──────────────────────────────────────────────────────────────────────
 * Renders the deterministic ZIS avatar for any identity seed
 * (user id, zion1… address, 0x… address) — the same avatar shown on the
 * website, OASIS and the desktop agent.
 *
 * Resolution order mirrors the web ZisAvatar component:
 *   1. `src` — explicit avatar URL (user.avatar from ZIS /me, incl.
 *      uploaded raster avatars and Google pictures)
 *   2. deterministic generated SVG: {ZIS}/api/auth/avatar/<seed>.svg
 *   3. nothing renders when no seed/src is available
 *
 * The generated endpoint is public and requires no authentication.
 */

import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { SvgUri } from 'react-native-svg';

const ZIS_BASE = 'https://auth.zionterranova.com';

export function zisAvatarUrl(seed, { variant = 0, style = 'sigil', size = 128, animated = false } = {}) {
  const q = new URLSearchParams();
  if (variant) q.set('s', String(variant));
  if (style && style !== 'sigil') q.set('t', style);
  if (size && size !== 128) q.set('sz', String(size));
  if (animated) q.set('a', '1');
  const qs = q.toString();
  return `${ZIS_BASE}/api/auth/avatar/${encodeURIComponent(seed)}.svg${qs ? `?${qs}` : ''}`;
}

export default function ZisAvatar({ seed, src, size = 32, radius, style }) {
  const uri = src || (seed ? zisAvatarUrl(seed, { size: Math.ceil(size * 2) }) : null);
  if (!uri) return null;

  const r = radius ?? size * 0.22;
  const box = { width: size, height: size, borderRadius: r, overflow: 'hidden' };
  const isSvg = !src || /\.svg($|\?)/.test(uri);

  return (
    <View style={[styles.box, box, style]}>
      {isSvg ? (
        <SvgUri uri={uri} width={size} height={size} />
      ) : (
        <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#0a0a14' },
});
