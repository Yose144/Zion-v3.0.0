'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createRandom } from '../domain/ports/random';

function createStreakTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const g = ctx.createLinearGradient(0, 0, size, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, size * 0.42, size, size * 0.16);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

interface Comet {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
  delay: number;
}

/**
 * Occasional shooting stars streaking across the galaxy view — a small
 * touch that reads instantly as "alive sky" rather than a static backdrop.
 * A small pool of reused meshes avoids allocation churn.
 */
export default function ShootingStars({ count = 4, isMobile = false }: { count?: number; isMobile?: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const texture = useMemo(() => createStreakTexture(), []);
  const spawnableCount = isMobile ? Math.max(1, Math.floor(count / 2)) : count;

  const { comets, reset } = useMemo(() => {
    const rng = createRandom(5150);

    const reset = (c: Comet) => {
      const angle = rng.next() * Math.PI * 2;
      const height = 20 + rng.next() * 40;
      const startRadius = 60 + rng.next() * 30;
      c.mesh.position.set(Math.cos(angle) * startRadius, height, Math.sin(angle) * startRadius);

      const dir = new THREE.Vector3(-Math.cos(angle), -0.35 - rng.next() * 0.3, -Math.sin(angle))
        .normalize()
        .multiplyScalar(18 + rng.next() * 10);
      c.velocity.copy(dir);
      c.mesh.lookAt(c.mesh.position.clone().add(dir));
      c.maxLife = 1.1 + rng.next() * 0.8;
      c.life = 0;
      c.active = false;
      c.delay = rng.next() * 16 + 2;
    };

    const comets: Comet[] = Array.from({ length: spawnableCount }).map(() => {
      const geo = new THREE.PlaneGeometry(3.2, 0.05);
      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        color: '#e0f2fe',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const c: Comet = { mesh, velocity: new THREE.Vector3(), life: 0, maxLife: 1, active: false, delay: 0 };
      reset(c);
      return c;
    });

    return { comets, reset };
  }, [spawnableCount, texture]);

  useFrame((_, delta) => {
    for (const c of comets) {
      const mat = c.mesh.material as THREE.MeshBasicMaterial;
      if (!c.active) {
        c.delay -= delta;
        if (c.delay <= 0) c.active = true;
        continue;
      }
      c.life += delta;
      c.mesh.position.addScaledVector(c.velocity, delta);
      const t = c.life / c.maxLife;
      mat.opacity = Math.sin(Math.min(1, t) * Math.PI) * 0.85;
      if (t >= 1) reset(c);
    }
  });

  return (
    <group ref={groupRef}>
      {comets.map((c, i) => (
        <primitive key={i} object={c.mesh} />
      ))}
    </group>
  );
}
