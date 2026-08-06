'use client';

import { useMemo, useRef } from 'react';
import { useFrame, extend, type ThreeElement } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { createRandom } from '../domain/ports/random';

/**
 * GPU-driven twinkling starfield. Unlike a CPU-updated Points buffer, all
 * animation (twinkle brightness + size pulse) happens in the vertex/fragment
 * shader from a single `uTime` uniform — thousands of stars animate for the
 * cost of one draw call and zero per-frame JS work.
 *
 * Each star gets its own random phase/speed so they twinkle independently
 * rather than flashing in sync (a common giveaway of naive star shaders).
 */
const TwinkleStarMaterial = shaderMaterial(
  { uTime: 0, uPixelRatio: 1 },
  /* vertex */ `
    attribute float aScale;
    attribute float aPhase;
    attribute float aSpeed;
    attribute vec3 aColor;
    varying vec3 vColor;
    varying float vTwinkle;
    uniform float uTime;
    uniform float uPixelRatio;

    void main() {
      vColor = aColor;
      float twinkle = 0.5 + 0.5 * sin(uTime * aSpeed + aPhase);
      // Combine two frequencies so the pulse feels organic, not metronomic.
      twinkle *= 0.7 + 0.3 * sin(uTime * aSpeed * 2.3 + aPhase * 1.7);
      vTwinkle = twinkle;

      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      float sizeAttenuation = 340.0 / -mvPosition.z;
      gl_PointSize = aScale * uPixelRatio * sizeAttenuation * (0.55 + 0.55 * twinkle);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  /* fragment */ `
    varying vec3 vColor;
    varying float vTwinkle;

    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);
      float core = smoothstep(0.5, 0.0, d);
      float glow = smoothstep(0.5, 0.15, d) * 0.8;
      float alpha = (core + glow) * (0.4 + 0.6 * vTwinkle) * 1.0;
      if (alpha < 0.01) discard;
      gl_FragColor = vec4(vColor * (1.0 + vTwinkle * 0.5), alpha);
    }
  `
);

extend({ TwinkleStarMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    twinkleStarMaterial: ThreeElement<typeof TwinkleStarMaterial>;
  }
}

// Realistic-ish spectral colors (blue-white / white / warm gold) instead of
// uniform white — real starfields have visible color variety.
const STAR_PALETTE = ['#078930', '#ffffff', '#fcd116', '#078930', '#fcd116'];

interface TwinkleStarsProps {
  count?: number;
  radius?: number;
  seed?: number;
}

export default function TwinkleStars({ count = 4000, radius = 220, seed = 909 }: TwinkleStarsProps) {
  const materialRef = useRef<THREE.ShaderMaterial & { uTime: number; uPixelRatio: number }>(null);

  const geometry = useMemo(() => {
    const rng = createRandom(seed);
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const palette = STAR_PALETTE.map((c) => new THREE.Color(c));

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Distribute on a spherical shell with slight radial jitter so it
      // reads as deep space rather than a flat dome.
      const u = rng.next();
      const v = rng.next();
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      const r = radius * (0.55 + rng.next() * 0.45);

      positions[i3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = r * Math.cos(phi) * 0.6;
      positions[i3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      scales[i] = 1.0 + Math.pow(rng.next(), 3) * 5.0;
      phases[i] = rng.next() * Math.PI * 2;
      speeds[i] = 0.3 + rng.next() * 1.4;

      const color = palette[rng.int(0, palette.length)];
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [count, radius, seed]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uTime = state.clock.elapsedTime;
      materialRef.current.uPixelRatio = state.gl.getPixelRatio();
    }
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <twinkleStarMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
