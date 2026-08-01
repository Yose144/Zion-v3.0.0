'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createRandom } from '../domain/ports/random';

function createLensTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.15, 'rgba(220, 240, 255, 0.85)');
  g.addColorStop(0.35, 'rgba(120, 180, 255, 0.35)');
  g.addColorStop(0.7, 'rgba(80, 120, 255, 0.08)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createStreakTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const g = ctx.createLinearGradient(0, size / 2, size, size / 2);
  g.addColorStop(0, 'rgba(255, 255, 255, 0)');
  g.addColorStop(0.5, 'rgba(200, 230, 255, 0.8)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export default function GalaxyCore() {
  const coreRef = useRef<THREE.Group>(null);
  const ringsRef = useRef<THREE.Group>(null);
  const streaksRef = useRef<THREE.Points>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const rng = useMemo(() => createRandom(42), []);
  const lensTexture = useMemo(() => createLensTexture(), []);

  const { streaksGeometry, streaksMaterial, streakSpeeds } = useMemo(() => {
    const count = 600;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const speeds: number[] = [];

    const coreColor = new THREE.Color('#60a5fa');
    const edgeColor = new THREE.Color('#1e3a8a');
    const temp = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const angle = rng.next() * Math.PI * 2;
      const radius = rng.next() * 2.4;
      const forward = (rng.next() - 0.5) * 4;

      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = Math.sin(angle) * radius;
      positions[i3 + 2] = forward;

      temp.copy(coreColor).lerp(edgeColor, rng.next());
      colors[i3] = temp.r;
      colors[i3 + 1] = temp.g;
      colors[i3 + 2] = temp.b;

      speeds.push((rng.next() * 0.03 + 0.01) * (forward > 0 ? 1 : -1));
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.18,
      map: createStreakTexture(),
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    return { streaksGeometry: geometry, streaksMaterial: material, streakSpeeds: speeds };
  }, [rng]);

  const rings = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const radius = 0.7 + i * 0.42;
      const tube = 0.02 + i * 0.004;
      const color = i % 2 === 0 ? '#60a5fa' : '#fbbf24';
      return { radius, tube, color, speed: (0.05 + i * 0.015) * (i % 2 === 0 ? 1 : -1) };
    });
  }, []);

  useFrame((state, delta) => {
    if (coreRef.current) {
      coreRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.15) * 0.02;
    }
    if (ringsRef.current) {
      ringsRef.current.children.forEach((child, i) => {
        child.rotation.z += rings[i].speed * delta;
      });
    }
    if (lightRef.current) {
      lightRef.current.intensity = 2.8 + Math.sin(state.clock.elapsedTime * 2.2) * 0.4;
    }
    if (streaksRef.current) {
      const positions = streaksRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < streakSpeeds.length; i++) {
        const i3 = i * 3;
        positions[i3 + 2] += streakSpeeds[i];

        // reset streaks as they pass through the tunnel
        if (positions[i3 + 2] > 5) positions[i3 + 2] = -5;
        if (positions[i3 + 2] < -5) positions[i3 + 2] = 5;
      }
      streaksRef.current.geometry.attributes.position.needsUpdate = true;
      streaksRef.current.rotation.z -= delta * 0.05;
    }
  });

  return (
    <group ref={coreRef} position={[0, 0.4, 0]}>
      {/* Inner bright drop — the "contact" point */}
      <mesh>
        <sphereGeometry args={[0.34, 64, 64]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.98} />
      </mesh>

      {/* Cyan-blue corona */}
      <mesh>
        <sphereGeometry args={[0.62, 64, 64]} />
        <meshBasicMaterial
          color="#60a5fa"
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Deep blue outer glow */}
      <mesh>
        <sphereGeometry args={[1.35, 64, 64]} />
        <meshBasicMaterial
          color="#1e40af"
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Contact-style concentric light rings */}
      <group ref={ringsRef} rotation={[Math.PI / 2, 0, 0]}>
        {rings.map((ring, i) => (
          <mesh key={i} rotation={[Math.PI / 2, 0, i * 0.4]}>
            <torusGeometry args={[ring.radius, ring.tube, 24, 96]} />
            <meshBasicMaterial
              color={ring.color}
              transparent
              opacity={0.18 - i * 0.015}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Blue-white tunnel streaks */}
      <points ref={streaksRef} geometry={streaksGeometry} material={streaksMaterial} />

      {/* Large lens-flare sprite */}
      <sprite position={[0, 0, 0]} scale={[5, 5, 1]}>
        <spriteMaterial map={lensTexture} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>

      <pointLight ref={lightRef} color="#93c5fd" intensity={2.8} distance={30} decay={1.1} position={[0, 0, 0]} />
      <pointLight color="#fbbf24" intensity={0.7} distance={18} decay={1.5} position={[0, 0.4, 0]} />
    </group>
  );
}
