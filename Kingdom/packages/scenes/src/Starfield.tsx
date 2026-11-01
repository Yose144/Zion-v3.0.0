'use client';

/**
 * Starfield — jeden instanced buffer, žádná textura.
 *
 * Pozice i jas generuje doména (`@zion/world`) deterministicky, takže obloha
 * je stejná při každém načtení a dá se testovat bez rendereru.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { starBrightness, starField } from '@zion/world';

const STAR_SEED = 20261101;

export function Starfield({ count = 2400, radius = 44 }: { count?: number; radius?: number }) {
  const geometry = useMemo(() => {
    const positions = starField(count, STAR_SEED, radius);
    const brightness = starBrightness(count, STAR_SEED);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i += 1) {
      const b = brightness[i] ?? 0.5;
      colors[i * 3] = b;
      colors[i * 3 + 1] = b;
      colors[i * 3 + 2] = Math.min(1, b * 1.05);
    }

    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    buffer.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return buffer;
  }, [count, radius]);

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={0.085}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.92}
        depthWrite={false}
      />
    </points>
  );
}
