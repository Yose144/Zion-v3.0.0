import * as THREE from 'three';
import { createRandom } from '../domain/ports/random';

export type PlanetStyle = 'terrestrial' | 'mars' | 'ice' | 'gas' | 'jungle' | 'ocean' | 'desert';

export function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Derive a planetary style from the dominant hue/lightness of a hex color.
 * This lets worlds with distinct category colors read as different planet types
 * (ocean, gas giant, jungle, etc.) without adding manual metadata.
 */
export function planetStyleFromColor(hex: string): PlanetStyle {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  if (hsl.l > 0.8 && hsl.s < 0.18) return 'ice';
  if ((hsl.h >= 0.9 || hsl.h < 0.12) && hsl.s > 0.3) return 'mars';
  if (hsl.h >= 0.22 && hsl.h < 0.42 && hsl.s > 0.25) return 'jungle';
  if (hsl.h >= 0.42 && hsl.h < 0.65 && hsl.s > 0.15) return 'ocean';
  if (hsl.h >= 0.65 && hsl.h < 0.78 && hsl.s > 0.25) return 'gas';
  if (hsl.s < 0.28 && hsl.l > 0.55) return 'desert';
  return 'terrestrial';
}

/**
 * Produce a slightly lighter, more saturated partner color for continents,
 * clouds and surface detail so every planet has clear visual structure.
 */
export function planetSecondaryColor(color: string): string {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.max(0.3, hsl.s * 0.75), Math.min(0.78, hsl.l * 1.35));
  return `#${c.getHexString()}`;
}

/**
 * Generate a deterministic, high-resolution planet surface texture.
 * Every unique `seed` produces a unique world, while the colors and style
 * define the planetary "biome".
 */
export function createPlanetTexture(
  baseColor: string,
  secondaryColor: string,
  seed: number,
  isMobile = false,
  style?: PlanetStyle
): THREE.CanvasTexture {
  const size = isMobile ? 256 : 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rng = createRandom(seed);
  const planetStyle = style ?? planetStyleFromColor(baseColor);

  const base = new THREE.Color(baseColor);
  const secondary = new THREE.Color(secondaryColor);
  const tertiary = secondary.clone().offsetHSL(0, 0, (rng.next() - 0.5) * 0.1);
  const quaternary = base.clone().offsetHSL((rng.next() - 0.5) * 0.05, (rng.next() - 0.5) * 0.2, (rng.next() - 0.5) * 0.15);

  // --- Base layer ---
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  // --- Gas-giant banding ---
  if (planetStyle === 'gas') {
    const bandCount = rng.int(5, 9);
    for (let i = 0; i < bandCount; i++) {
      const y = rng.next() * size;
      const h = 8 + rng.next() * 26;
      const band = base.clone().offsetHSL(
        (rng.next() - 0.5) * 0.08,
        (rng.next() - 0.5) * 0.2,
        (rng.next() - 0.5) * 0.18
      );
      ctx.fillStyle = `#${band.getHexString()}`;
      ctx.globalAlpha = 0.2 + rng.next() * 0.35;
      ctx.fillRect(0, y, size, h);
    }
    ctx.globalAlpha = 1;
  } else if (planetStyle === 'desert') {
    // Subtle dune bands
    for (let y = 0; y < size; y += 3) {
      const band = base.clone().offsetHSL(0, 0, Math.sin(y * 0.03 + seed) * 0.04);
      ctx.fillStyle = `#${band.getHexString()}`;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(0, y, size, 3);
    }
    ctx.globalAlpha = 1;
  } else if (planetStyle !== 'ice') {
    // Latitudinal banding for terrestrial/ocean/jungle/mars
    for (let y = 0; y < size; y += 4) {
      const band = base.clone().offsetHSL(
        0,
        0,
        Math.sin(y * 0.02 + seed) * 0.03 + (rng.next() - 0.5) * 0.02
      );
      ctx.fillStyle = `#${band.getHexString()}`;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(0, y, size, 4);
    }
    ctx.globalAlpha = 1;
  } else {
    // Ice: frosty grain
    for (let i = 0; i < 120; i++) {
      const x = rng.next() * size;
      const y = rng.next() * size;
      const r = 1 + rng.next() * 4;
      ctx.fillStyle = `rgba(255,255,255,${0.04 + rng.next() * 0.09})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Continents / landmasses ---
  if (planetStyle !== 'gas') {
    const blobCount =
      planetStyle === 'mars' ? 18 :
      planetStyle === 'desert' ? 7 :
      10 + rng.int(0, 12);

    for (let i = 0; i < blobCount; i++) {
      const cx = rng.next() * size;
      const cy = rng.next() * size;
      const baseR = (planetStyle === 'desert' ? 35 : 24) + rng.next() * 70;
      const points = 8 + rng.int(0, 9);

      ctx.fillStyle = secondaryColor;
      ctx.beginPath();
      for (let p = 0; p <= points; p++) {
        const angle = (p / points) * Math.PI * 2;
        const r = baseR * (0.6 + rng.next() * 0.5);
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (p === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      // Inner tertiary detail — smaller "lakes / highlands"
      if (rng.next() > 0.25) {
        ctx.fillStyle = `#${tertiary.getHexString()}`;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        for (let p = 0; p <= points; p++) {
          const angle = (p / points) * Math.PI * 2;
          const r = baseR * (0.25 + rng.next() * 0.3);
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          if (p === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Peninsula tendrils for organic coastlines
      if (rng.next() > 0.6) {
        ctx.strokeStyle = secondaryColor;
        ctx.lineWidth = 1 + rng.next() * 3;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        let tx = cx;
        let ty = cy;
        for (let k = 0; k < 5; k++) {
          const angle = rng.next() * Math.PI * 2;
          const dist = baseR * (0.4 + rng.next() * 0.6);
          tx += Math.cos(angle) * dist;
          ty += Math.sin(angle) * dist;
          ctx.lineTo(tx, ty);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  // --- Surface mottling / micro-detail ---
  const mottleCount = isMobile ? 150 : 350;
  for (let i = 0; i < mottleCount; i++) {
    const x = rng.next() * size;
    const y = rng.next() * size;
    const r = 1 + rng.next() * 5;
    const lit = rng.next() > 0.5;
    ctx.fillStyle = `rgba(${lit ? 255 : 0},${lit ? 255 : 0},${lit ? 255 : 0},${0.015 + rng.next() * 0.04})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Craters / impact basins (more visible on barren worlds) ---
  const craterCount = planetStyle === 'mars' || planetStyle === 'desert' ? rng.int(16, 32) : rng.int(8, 18);
  for (let i = 0; i < craterCount; i++) {
    const x = rng.next() * size;
    const y = rng.next() * size;
    const r = 2 + rng.next() * 10;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${0.12 + rng.next() * 0.2})`);
    g.addColorStop(0.7, 'rgba(0,0,0,0)');
    g.addColorStop(0.85, `rgba(255,255,255,${0.04 + rng.next() * 0.08})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Wispy cloud layer ---
  if (planetStyle !== 'ice' && planetStyle !== 'gas' && planetStyle !== 'desert') {
    const cloudCount = 10 + rng.int(0, 12);
    for (let i = 0; i < cloudCount; i++) {
      const cx = rng.next() * size;
      const cy = rng.next() * size;
      const r = 24 + rng.next() * 90;
      const cloud = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      cloud.addColorStop(0, 'rgba(255,255,255,0.18)');
      cloud.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = cloud;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.35, rng.next() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Polar ice caps for life-bearing/barren worlds ---
  if (planetStyle !== 'gas') {
    const capSize = size * (planetStyle === 'ice' ? 0.22 : 0.1);
    const topGrad = ctx.createLinearGradient(0, 0, 0, capSize);
    topGrad.addColorStop(0, 'rgba(255,255,255,0.55)');
    topGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, size, capSize);

    const botGrad = ctx.createLinearGradient(0, size, 0, size - capSize);
    botGrad.addColorStop(0, 'rgba(255,255,255,0.55)');
    botGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = botGrad;
    ctx.fillRect(0, size - capSize, size, capSize);
  }

  // --- Atmosphere / terminator shadow gradient ---
  const term = ctx.createRadialGradient(
    size * 0.38,
    size * 0.38,
    size * 0.25,
    size / 2,
    size / 2,
    size * 0.78
  );
  term.addColorStop(0, 'rgba(255,255,255,0.08)');
  term.addColorStop(0.6, 'rgba(0,0,0,0.08)');
  term.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = term;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Radial glow texture used for soft atmospheric halos and sprites.
 */
export function createGlowTexture(color: string, size = 256): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = hexToRgb(color);

  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(255, 255, 255, 1)`);
  g.addColorStop(0.2, `rgba(${c.r}, ${c.g}, ${c.b}, 0.6)`);
  g.addColorStop(0.5, `rgba(${c.r}, ${c.g}, ${c.b}, 0.15)`);
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Atmosphere texture for the back-side sphere used in the simple `Planet` component.
 */
export function createAtmosphereTexture(color: string, size = 128): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = hexToRgb(color);

  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.15, size / 2, size / 2, size * 0.7);
  g.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, 0.45)`);
  g.addColorStop(0.5, `rgba(${c.r}, ${c.g}, ${c.b}, 0.18)`);
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Ring texture for planetary orbit rings (e.g. Saturn-like debris).
 */
export function createRingTexture(color: string, size = 512): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = hexToRgb(color);

  ctx.clearRect(0, 0, size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.3, `rgba(${c.r}, ${c.g}, ${c.b}, 0.35)`);
  g.addColorStop(0.45, `rgba(${c.r}, ${c.g}, ${c.b}, 0.12)`);
  g.addColorStop(0.55, `rgba(${c.r}, ${c.g}, ${c.b}, 0.35)`);
  g.addColorStop(0.7, `rgba(${c.r}, ${c.g}, ${c.b}, 0.08)`);
  g.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Star corona texture for star-system worlds.
 */
export function createCoronaTexture(color: string, size = 512): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = hexToRgb(color);

  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255, 250, 240, 0.95)');
  g.addColorStop(0.15, `rgba(${c.r}, ${c.g}, ${c.b}, 0.65)`);
  g.addColorStop(0.45, `rgba(${c.r}, ${c.g}, ${c.b}, 0.15)`);
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
