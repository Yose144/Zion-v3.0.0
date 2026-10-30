/** @jsxRuntime classic */
'use client';

import { React, useEffect, THREE } from '@genesis/runtime';

export interface MountainPeak { x: number; z: number; height: number; width: number; depth: number }

/** Joined rock and snow surfaces: no detached cone caps or open mountain bases. */
export function MountainTerrain({ position, size, peaks, snowLine = Infinity, rock = '#69655e', terraces = false }: {
  position: [number, number, number]; size: [number, number]; peaks: MountainPeak[];
  snowLine?: number; rock?: string; terraces?: boolean;
}) {
  const geometry = React.useMemo(() => {
    const g = new THREE.PlaneGeometry(size[0], size[1], 110, 80); g.rotateX(-Math.PI / 2);
    const p = g.getAttribute('position'), colors: number[] = [];
    const stone = new THREE.Color(rock), snow = new THREE.Color('#e5edf2'), color = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      let h = 0;
      for (const peak of peaks) {
        const radius = Math.max(Math.abs((x - peak.x) / peak.width), Math.abs((z - peak.z) / peak.depth));
        const profile = Math.pow(Math.max(0, 1 - radius), 1.12);
        h = Math.max(h, profile * peak.height);
      }
      h *= 1 + .025 * Math.sin(x * .8 + z * .7) + .02 * Math.sin(z * 1.4);
      if (terraces) h = h * .7 + Math.floor(h * 1.3) / 1.3 * .3;
      p.setY(i, h);
      const snowLevel = h + Math.sin(x * .5) * 1.4 + Math.cos(z * .7) * .9;
      const coverage = Number.isFinite(snowLine) ? THREE.MathUtils.smoothstep(snowLevel, snowLine - 2, snowLine + 2) : 0;
      color.copy(stone).multiplyScalar(.88 + .12 * Math.sin(h * 2.4)).lerp(snow, coverage);
      colors.push(color.r, color.g, color.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.computeVertexNormals();
    return g;
  }, [size[0], size[1], peaks, snowLine, rock, terraces]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh position={position} geometry={geometry} castShadow receiveShadow><meshStandardMaterial vertexColors roughness={.94} /></mesh>;
}
