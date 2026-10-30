'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PLANET_R } from './positions';

/** Procedurální mapa — instant fallback dokud se reálné textury nenačtou. */
function makeFallbackTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const ocean = ctx.createLinearGradient(0, 0, 0, h);
  ocean.addColorStop(0, '#cfe3ee');
  ocean.addColorStop(0.14, '#0b3d66');
  ocean.addColorStop(0.5, '#0e5a8a');
  ocean.addColorStop(0.86, '#0b3d66');
  ocean.addColorStop(1, '#cfe3ee');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, w, h);
  let s = 20261029;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let c = 0; c < 15; c++) {
    const cx = rnd() * w;
    const cy = h * 0.16 + rnd() * h * 0.68;
    for (let b = 0; b < 6; b++) {
      const bx = cx + (rnd() - 0.5) * 90;
      const by = cy + (rnd() - 0.5) * 50;
      const r = 10 + rnd() * 30;
      const g = ctx.createRadialGradient(bx, by, r * 0.15, bx, by, r);
      g.addColorStop(0, '#2f7d47');
      g.addColorStop(1, 'rgba(14,90,138,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Reálné textury Nové Země — předloha z apps/website-v2.9 HolographicEarth. */
function useEarthMaps(fallback: THREE.Texture) {
  const [maps, setMaps] = useState<{ color: THREE.Texture; bump?: THREE.Texture }>({
    color: fallback,
  });
  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    const next: { color?: THREE.Texture; bump?: THREE.Texture } = {};
    const commit = () => {
      if (!cancelled && next.color) setMaps({ color: next.color, bump: next.bump });
    };
    loader.load('/textures/earth-blue-marble.webp', (t) => {
      if (cancelled) return t.dispose();
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      next.color = t;
      commit();
    });
    loader.load('/textures/earth-topology.png', (t) => {
      if (cancelled) return t.dispose();
      next.bump = t;
      commit();
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return maps;
}


/** Měsíc — reálná textura (Solar System Scope), obíhá Novou Zemi mimo prstenec Issobelly. */
function Moon() {
  const ref = useRef<THREE.Group>(null);
  const angle = useRef(Math.PI * 0.35);
  const [tex, setTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let alive = true;
    new THREE.TextureLoader().load('/textures/2k_moon.jpg', (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      if (alive) setTex(t);
    });
    return () => {
      alive = false;
    };
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    angle.current += delta * 0.11;
    const r = 9.6;
    ref.current.position.set(Math.cos(angle.current) * r, Math.sin(angle.current * 0.55) * 0.9, Math.sin(angle.current) * r);
    ref.current.rotation.y += delta * 0.05;
  });
  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshStandardMaterial key={tex ? 'tex' : 'flat'} map={tex ?? undefined} color={tex ? '#ffffff' : '#d4d4d4'} roughness={0.95} metalness={0.02} />
      </mesh>
      <mesh scale={1.35}>
        <sphereGeometry args={[0.55, 12, 12]} />
        <meshBasicMaterial color="#fcd116" transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

export function NewEarth() {
  const planet = useRef<THREE.Mesh>(null);
  const fallback = useMemo(() => makeFallbackTexture(), []);
  const maps = useEarthMaps(fallback);

  useFrame((_, delta) => {
    if (planet.current) planet.current.rotation.y += delta * 0.02;
  });

  return (
    <group>
      {/* planeta — povrch L5, reálné textury + noční světla + bump */}
      <mesh ref={planet}>
        <sphereGeometry args={[PLANET_R, 64, 48]} />
        <meshStandardMaterial
          map={maps.color}
          bumpMap={maps.bump}
          bumpScale={0.2}
          roughness={0.72}
          metalness={0.02}
        />
      </mesh>
      {/* atmosféra — halo */}
      <mesh scale={1.07}>
        <sphereGeometry args={[PLANET_R, 48, 32]} />
        <meshBasicMaterial color="#7ec8ff" transparent opacity={0.13} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {/* povrch zůstává čistý — světy, mise i přístavy jsou v menu */}
      <Moon />
    </group>
  );
}
