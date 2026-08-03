'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Nova Zeme — centrální planeta OASIS.
 * Zeleno-modrá planeta s atmosférou a Stromem života na povrchu.
 * Kolem ní obíhá Issobela (L6 orbitální stanice).
 */
export default function NovaZeme({
  position = [0, 0, 8] as [number, number, number],
  isMobile = false,
}: {
  position?: [number, number, number];
  isMobile?: boolean;
}) {
  const planetRef = useRef<THREE.Group>(null);
  const issobelaRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.Mesh>(null);

  // Procedural planet texture — green/blue earth-like
  const planetTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Ocean base
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, 256);
    oceanGrad.addColorStop(0, '#0a3d5e');
    oceanGrad.addColorStop(0.5, '#1a6b8a');
    oceanGrad.addColorStop(1, '#0a3d5e');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, 512, 256);

    // Continents — green landmasses
    const rng = mulberry32(42);
    for (let i = 0; i < 12; i++) {
      const x = rng() * 512;
      const y = 40 + rng() * 176;
      const r = 20 + rng() * 60;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, '#2d7a3e');
      grad.addColorStop(0.5, '#1f5a2e');
      grad.addColorStop(1, 'rgba(15, 60, 25, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Polar ice caps
    const iceGrad = ctx.createLinearGradient(0, 0, 0, 30);
    iceGrad.addColorStop(0, 'rgba(240, 250, 255, 0.9)');
    iceGrad.addColorStop(1, 'rgba(240, 250, 255, 0)');
    ctx.fillStyle = iceGrad;
    ctx.fillRect(0, 0, 512, 30);

    const iceGrad2 = ctx.createLinearGradient(0, 226, 0, 256);
    iceGrad2.addColorStop(0, 'rgba(240, 250, 255, 0)');
    iceGrad2.addColorStop(1, 'rgba(240, 250, 255, 0.9)');
    ctx.fillStyle = iceGrad2;
    ctx.fillRect(0, 226, 512, 30);

    // Cloud wisps
    for (let i = 0; i < 20; i++) {
      const x = rng() * 512;
      const y = rng() * 256;
      const r = 10 + rng() * 30;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + rng() * 0.15})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    return tex;
  }, []);

  // Atmosphere glow texture
  const glowTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(128, 128, 60, 128, 128, 128);
    grad.addColorStop(0, 'rgba(100, 180, 255, 0.4)');
    grad.addColorStop(0.5, 'rgba(80, 150, 220, 0.15)');
    grad.addColorStop(1, 'rgba(60, 120, 200, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(canvas);
  }, []);

  const radius = isMobile ? 2.5 : 3.5;
  const issobelaOrbit = radius + 1.5;

  useFrame((_, delta) => {
    // Rotate planet slowly
    if (planetRef.current) {
      planetRef.current.rotation.y += delta * 0.05;
    }
    // Issobela orbits
    if (issobelaRef.current) {
      const t = performance.now() * 0.0003;
      issobelaRef.current.position.x = Math.cos(t) * issobelaOrbit;
      issobelaRef.current.position.z = Math.sin(t) * issobelaOrbit;
      issobelaRef.current.position.y = Math.sin(t * 0.5) * 0.5;
    }
    // Atmosphere pulse
    if (atmosphereRef.current) {
      const mat = atmosphereRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.3 + Math.sin(performance.now() * 0.001) * 0.05;
    }
  });

  return (
    <group position={position}>
      {/* Planet */}
      <group ref={planetRef}>
        <mesh>
          <sphereGeometry args={[radius, isMobile ? 32 : 64, isMobile ? 24 : 48]} />
          <meshStandardMaterial
            map={planetTexture}
            roughness={0.8}
            metalness={0.1}
            emissive="#0a2a4a"
            emissiveIntensity={0.15}
          />
        </mesh>

        {/* Tree of Life on surface — small glowing marker */}
        <mesh position={[0, radius + 0.1, 0]}>
          <coneGeometry args={[0.3, 0.8, 6]} />
          <meshStandardMaterial
            color="#22d3ee"
            emissive="#22d3ee"
            emissiveIntensity={0.8}
            transparent
            opacity={0.7}
          />
        </mesh>
      </group>

      {/* Atmosphere glow */}
      <mesh ref={atmosphereRef} scale={1.15}>
        <sphereGeometry args={[radius, 24, 16]} />
        <meshBasicMaterial
          map={glowTexture}
          transparent
          opacity={0.3}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Issobela — orbiting satellite (L6) */}
      <mesh ref={issobelaRef}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={1.2}
        />
      </mesh>

      {/* Issobela orbit ring — faint */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[issobelaOrbit - 0.02, issobelaOrbit + 0.02, 64]} />
        <meshBasicMaterial
          color="#fbbf24"
          transparent
          opacity={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Point light to illuminate the planet */}
      <pointLight position={[radius + 2, 2, radius + 2]} intensity={0.8} color="#ffffff" />
    </group>
  );
}

// Simple seeded random for procedural texture
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
