'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { loadTsl } from '../../lib/tsl';

interface TslVortexProps {
  color: string;
  size: number;
  active?: boolean;
}

/**
 * Spiral warp-gate vortex — TSL port of WarpGateVortex's raw GLSL disc.
 * Same math (spiral sin(a*9+r*24-t*3.2) + rings sin(r*28-t*1.8)) expressed
 * as node graph on MeshBasicNodeMaterial.
 */
export default function TslVortex({ color, size, active = false }: TslVortexProps) {
  const holderRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const uIntensity = useRef<{ value: number } | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    let live = true;
    loadTsl().then((tsl) => {
      if (!live || !holderRef.current) return;
      const c = new THREE.Color(color);
      const intensity = tsl.uniform(0.45);
      uIntensity.current = intensity;

      const mat = new tsl.MeshBasicNodeMaterial();
      const p = tsl.uv().sub(0.5);
      const r = p.length();
      const a = tsl.atan(p.y, p.x);
      const spiral = tsl.sin(a.mul(9.0).add(r.mul(24.0)).sub(tsl.timerLocal().mul(3.2)));
      const rings = tsl.sin(r.mul(28.0).sub(tsl.timerLocal().mul(1.8)));
      const pattern = spiral.mul(0.6).add(rings.mul(0.3)).mul(0.5).add(0.5);
      const mask = tsl.smoothstep(0.48, 0.05, r);
      const core = tsl.smoothstep(0.15, 0.0, r);
      const alpha = pattern.mul(mask).add(core).mul(intensity);
      mat.colorNode = tsl.vec3(c.r, c.g, c.b);
      mat.opacityNode = alpha;
      mat.transparent = true;
      mat.depthWrite = false;
      mat.blending = THREE.AdditiveBlending;
      mat.side = THREE.DoubleSide;
      mat.toneMapped = false;

      const mesh = new THREE.Mesh(new THREE.CircleGeometry(size * 1.7, 32), mat);
      mesh.rotation.x = Math.PI / 2;
      meshRef.current = mesh;
      holderRef.current.add(mesh);
    });

    return () => {
      live = false;
      const mesh = meshRef.current;
      if (mesh && holderRef.current) {
        holderRef.current.remove(mesh);
        (mesh.material as THREE.Material).dispose();
        mesh.geometry.dispose();
        meshRef.current = null;
        uIntensity.current = null;
      }
    };
  }, [color, size]);

  useFrame((_, delta) => {
    const u = uIntensity.current;
    if (u) u.value += ((activeRef.current ? 0.85 : 0.45) - u.value) * 0.05;
    if (meshRef.current) meshRef.current.rotation.z += (activeRef.current ? 0.03 : 0.01) * delta;
  });

  return <group ref={holderRef} />;
}
