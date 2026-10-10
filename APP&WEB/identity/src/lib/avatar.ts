/**
 * Deterministic ZIS avatar generator.
 *
 * Produces a compact SVG sigil from (seed, variant, style) — the same
 * input always yields the same bytes, so avatars need no storage.
 * Any string works as a seed (user id, zion1 address, 0x address…), which
 * lets the whole ecosystem render consistent identities.
 */

import { createHash } from 'node:crypto';

export const AVATAR_STYLES = ['sigil', 'rings', 'prism'] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];

// ZION theme palette (docs/3.0.3/ZIONTHEME.md)
const PALETTE = ['#ffd700', '#9333ea', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
const BGS = ['#0a0a14', '#0d0d1a', '#101020', '#0a0f1c', '#120a1a'];

/** mulberry32 — tiny deterministic PRNG. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: string, variant: number, style: string): number {
  const digest = createHash('sha256').update(`${seed}:${variant}:${style}`).digest();
  return digest.readUInt32BE(0);
}

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function fmt(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, '');
}

/** Arc path segment on a circle of radius r, from a0 to a1 (radians). */
function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${fmt(x0)} ${fmt(y0)} A ${fmt(r)} ${fmt(r)} 0 ${large} 1 ${fmt(x1)} ${fmt(y1)}`;
}

/** Regular polygon points string. */
function polygon(cx: number, cy: number, r: number, sides: number, rot: number): string {
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * 2 * Math.PI) / sides;
    pts.push(`${fmt(cx + r * Math.cos(a))},${fmt(cy + r * Math.sin(a))}`);
  }
  return pts.join(' ');
}

/** Rotate a <g> group around the avatar centre (SMIL). */
function spin(cx: number, deg: number, durS: number): string {
  return `<animateTransform attributeName="transform" type="rotate" from="0 ${fmt(cx)} ${fmt(cx)}" to="${deg} ${fmt(cx)} ${fmt(cx)}" dur="${fmt(durS)}s" repeatCount="indefinite"/>`;
}

// ── Style: sigil — arcs + rotated polygon + center prism + sparkles ──
function renderSigil(rand: () => number, S: number, id: string, anim = false): string {
  const c = S / 2;
  const main = pick(rand, PALETTE);
  const accent = pick(rand, PALETTE);
  const parts: string[] = [];

  // outer arc segments
  const arcs = 2 + Math.floor(rand() * 3);
  const outerR = S * 0.38;
  const arcParts: string[] = [];
  let cursor = rand() * Math.PI * 2;
  for (let i = 0; i < arcs; i++) {
    const span = (Math.PI * 2) / (arcs + 1) * (0.5 + rand() * 0.45);
    const col = i % 2 === 0 ? main : accent;
    arcParts.push(
      `<path d="${arc(c, c, outerR, cursor, cursor + span)}" fill="none" stroke="${col}" stroke-width="${fmt(S * 0.045)}" stroke-linecap="round" opacity="0.9"/>`,
    );
    cursor += span + (Math.PI * 2) / arcs * 0.35;
  }
  parts.push(`<g>${arcParts.join('')}${anim ? spin(c, 360, 24 + rand() * 8) : ''}</g>`);

  // rotated polygon ring
  const sides = 3 + Math.floor(rand() * 4); // triangle..hexagon
  const polyR = S * (0.24 + rand() * 0.06);
  const poly = `<polygon points="${polygon(c, c, polyR, sides, rand() * Math.PI)}" fill="none" stroke="${accent}" stroke-width="${fmt(S * 0.025)}" opacity="0.75"/>`;
  parts.push(anim ? `<g>${poly}${spin(c, -360, 36 + rand() * 12)}</g>` : poly);

  // center prism (triangle) with gradient
  const prismR = S * (0.13 + rand() * 0.03);
  const rot = rand() * Math.PI * 2;
  parts.push(
    `<polygon points="${polygon(c, c, prismR, 3, rot)}" fill="url(#${id}g)" opacity="0.95"/>`,
  );
  parts.push(
    `<polygon points="${polygon(c, c, prismR, 3, rot)}" fill="none" stroke="#ffffff" stroke-width="${fmt(S * 0.012)}" opacity="0.35"/>`,
  );

  // sparkles
  const sparks = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < sparks; i++) {
    const a = rand() * Math.PI * 2;
    const r = S * (0.42 + rand() * 0.05);
    const circ = `<circle cx="${fmt(c + r * Math.cos(a))}" cy="${fmt(c + r * Math.sin(a))}" r="${fmt(S * (0.008 + rand() * 0.012))}" fill="${rand() > 0.5 ? main : accent}" opacity="0.85">` +
      (anim ? `<animate attributeName="opacity" values="0.85;0.15;0.85" dur="${fmt(2.2 + rand() * 2.4)}s" repeatCount="indefinite"/>` : '') +
      `</circle>`;
    parts.push(circ);
  }
  return parts.join('');
}

// ── Style: rings — concentric planetary arcs ─────────────────────────
function renderRings(rand: () => number, S: number, id: string, anim = false): string {
  const c = S / 2;
  const parts: string[] = [];
  const count = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < count; i++) {
    const r = S * (0.14 + i * 0.09 + rand() * 0.02);
    const col = pick(rand, PALETTE);
    const a0 = rand() * Math.PI * 2;
    const span = Math.PI * (0.6 + rand() * 1.2);
    const w = S * (0.02 + rand() * 0.035);
    const ring = `<path d="${arc(c, c, r, a0, a0 + span)}" fill="none" stroke="${col}" stroke-width="${fmt(w)}" stroke-linecap="round" opacity="${fmt(0.55 + rand() * 0.4)}"/>`;
    // Alternating spin directions → planetarium effect.
    const deg = i % 2 === 0 ? 360 : -360;
    parts.push(anim ? `<g>${ring}${spin(c, deg, 16 + i * 7 + rand() * 5)}</g>` : ring);
  }
  // orbit dot — animated it circles the core.
  const orbitR = S * (0.2 + rand() * 0.25);
  const oa = rand() * Math.PI * 2;
  const dot = `<circle cx="${fmt(c + orbitR * Math.cos(oa))}" cy="${fmt(c + orbitR * Math.sin(oa))}" r="${fmt(S * 0.035)}" fill="#ffffff" opacity="0.9"/>`;
  parts.push(anim ? `<g>${dot}${spin(c, 360, 9 + rand() * 6)}</g>` : dot);
  // core
  const coreR = S * (0.09 + rand() * 0.04);
  parts.push(`<circle cx="${c}" cy="${c}" r="${fmt(coreR)}" fill="url(#${id}g)"/>`);
  parts.push(
    `<circle cx="${c}" cy="${c}" r="${fmt(coreR)}" fill="none" stroke="#ffffff" stroke-width="${fmt(S * 0.01)}" opacity="0.4"/>`,
  );
  return parts.join('');
}

// ── Style: prism — tessellated triangles ─────────────────────────────
function renderPrism(rand: () => number, S: number, id: string, anim = false): string {
  const c = S / 2;
  const parts: string[] = [];
  // central upward prism
  const main = pick(rand, PALETTE);
  const accent = pick(rand, PALETTE);
  const r1 = S * 0.3;
  const rot = rand() * Math.PI * 2;
  const prism = `<polygon points="${polygon(c, c, r1, 3, rot)}" fill="url(#${id}g)" opacity="0.95"/>`;
  parts.push(anim ? `<g>${prism}${spin(c, 360, 48 + rand() * 12)}</g>` : prism);
  // inverted inner prism
  parts.push(
    `<polygon points="${polygon(c, c, r1 * 0.55, 3, rot + Math.PI)}" fill="${accent}" opacity="0.55"/>`,
  );
  // satellite triangles — animated they orbit the core like shards.
  const sats = 3 + Math.floor(rand() * 3);
  const satParts: string[] = [];
  for (let i = 0; i < sats; i++) {
    const a = rot + (i * 2 * Math.PI) / sats;
    const sr = S * (0.055 + rand() * 0.03);
    const d = S * (0.36 + rand() * 0.06);
    const sx = c + d * Math.cos(a);
    const sy = c + d * Math.sin(a);
    satParts.push(
      `<polygon points="${polygon(sx, sy, sr, 3, a + Math.PI / 2)}" fill="${i % 2 ? main : accent}" opacity="0.8"/>`,
    );
  }
  parts.push(`<g>${satParts.join('')}${anim ? spin(c, 360, 30 + rand() * 10) : ''}</g>`);
  // facet lines from center
  for (let i = 0; i < 3; i++) {
    const a = rot + (i * 2 * Math.PI) / 3;
    const line = `<line x1="${c}" y1="${c}" x2="${fmt(c + r1 * Math.cos(a))}" y2="${fmt(c + r1 * Math.sin(a))}" stroke="#ffffff" stroke-width="${fmt(S * 0.008)}" opacity="0.3">` +
      (anim ? `<animate attributeName="opacity" values="0.3;0.08;0.3" dur="${fmt(3 + rand() * 2)}s" repeatCount="indefinite"/>` : '') +
      `</line>`;
    parts.push(line);
  }
  return parts.join('');
}

/**
 * Render a deterministic avatar SVG.
 * @param seed   any stable identity string (user id, address…)
 * @param variant regeneration seed (user picks among variants)
 * @param style   'sigil' | 'rings' | 'prism' (unknown → sigil)
 * @param size    viewBox size, clamped to 16..512
 * @param animated when true, decorate the SVG with SMIL motion (spinning
 *                 arcs/rings, pulsing sparkles). Still deterministic —
 *                 same params = same animation timings.
 */
export function renderAvatarSvg(
  seed: string,
  variant = 0,
  style: string = 'sigil',
  size = 128,
  animated = false,
): string {
  const s = Math.min(Math.max(Math.floor(size) || 128, 16), 512);
  const safeStyle: string = (AVATAR_STYLES as readonly string[]).includes(style) ? style : 'sigil';
  const rand = rng(hashSeed(seed, variant, safeStyle));
  const id = `a${hashSeed(seed, variant, safeStyle).toString(36)}`;

  const bg = pick(rand, BGS);
  const g0 = pick(rand, PALETTE);
  const g1 = pick(rand, PALETTE.filter((p) => p !== g0));

  const body =
    safeStyle === 'rings'
      ? renderRings(rand, s, id, animated)
      : safeStyle === 'prism'
        ? renderPrism(rand, s, id, animated)
        : renderSigil(rand, s, id, animated);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}">` +
    `<defs><radialGradient id="${id}g" cx="35%" cy="30%" r="80%">` +
    `<stop offset="0%" stop-color="${g0}"/><stop offset="100%" stop-color="${g1}"/>` +
    `</radialGradient></defs>` +
    `<rect width="${s}" height="${s}" rx="${fmt(s * 0.18)}" fill="${bg}"/>` +
    `<rect width="${s}" height="${s}" rx="${fmt(s * 0.18)}" fill="url(#${id}g)" opacity="0.12"/>` +
    body +
    `</svg>`
  );
}
