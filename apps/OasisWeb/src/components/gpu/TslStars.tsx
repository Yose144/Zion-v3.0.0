'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { loadTsl } from '../../lib/tsl';

interface TslStarsProps {
  count?: number;
  radius?: number;
  depth?: number;
  /** base star point size in world units */
  size?: number;
  /** 0..1 — dims the whole layer (TwinkleStars replacement) */
  opacity?: number;
}

/**
 * Points starfield built on PointsNodeMaterial — the WebGPU replacement
 * for drei <Stars> / <TwinkleStars> which use raw GLSL. Lazy-loads the
 * TSL bundle and mounts nothing until ready.
 */
export default function TslStars({ count = 2000, radius = 150, depth = 80, size = 1.0, opacity = 1 }: TslStarsProps) {
  const holderRef = useRef<THREE.Group>(null);

  useEffect(() => {
    let live = true;
    let points: THREE.Points | null = null;
    loadTsl().then((tsl) => {
      if (!live || !holderRef.current) return;

      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        // uniform-ish sphere shell: radius .. radius+depth
        const r = radius + Math.random() * depth;
        const theta = Math.random() * Math.PI * 2;
        const u = Math.random() * 2 - 1;
        const s = Math.sqrt(1 - u * u);
        positions[i * 3] = r * s * Math.cos(theta);
        positions[i * 3 + 1] = r * u;
        positions[i * 3 + 2] = r * s * Math.sin(theta);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const mat = new tsl.PointsNodeMaterial();
      const h1 = tsl.hash(tsl.instanceIndex);
      const h2 = tsl.hash(tsl.instanceIndex.add(17));
      // twinkle — slow sine pulse per star, phase from hash
      const tw = tsl.sin(tsl.timerLocal().mul(0.5).add(h1.mul(6.283))).mul(0.5).add(0.5);
      const colA = tsl.vec3(0.62, 0.78, 1.0);
      const colB = tsl.vec3(1.0, 0.82, 0.62);
      mat.colorNode = tsl.mix(colA, colB, h2);
      mat.opacityNode = tsl.mix(0.15, 1.0, tw).mul(opacity);
      mat.sizeNode = tsl.mix(0.35, size, h1);
      mat.sizeAttenuation = true;
      mat.transparent = true;
      mat.depthWrite = false;
      mat.blending = THREE.AdditiveBlending;

      points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      holderRef.current.add(points);
    });

    return () => {
      live = false;
      if (points && holderRef.current) {
        holderRef.current.remove(points);
        (points.material as THREE.Material).dispose();
        points.geometry.dispose();
      }
    };
  }, [count, radius, depth, size, opacity]);

  return <group ref={holderRef} />;
}
