'use client';

import { useMemo, useRef } from 'react';
import { useFrame, extend, type ThreeElement } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { createRandom } from '../domain/ports/random';

/**
 * GPU-driven tunnel streak material — the forward/backward motion and
 * wraparound that used to be a per-frame JS loop over 1000 points now lives
 * entirely in the vertex shader, driven by a single uTime uniform.
 */
const StreakMaterial = shaderMaterial(
  { uTime: 0, uSize: 0.18 },
  /* vertex */ `
    attribute float aSpeed;
    attribute float aOffset;
    attribute vec3 aColor;
    varying vec3 vColor;
    uniform float uTime;
    uniform float uSize;
    void main() {
      vColor = aColor;
      vec3 pos = position;
      // Loop the z position within a [-5, 5] tunnel using the per-point
      // speed/offset so streaks continuously flow through the core.
      float z = mod(pos.z + uTime * aSpeed * 10.0 + aOffset, 10.0) - 5.0;
      pos.z = z;
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = uSize * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  /* fragment */ `
    varying vec3 vColor;
    void main() {
      vec2 uv = gl_PointCoord - 0.5;
      float alpha = smoothstep(0.5, 0.0, length(uv));
      gl_FragColor = vec4(vColor, alpha * 0.85);
    }
  `
);

extend({ StreakMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    streakMaterial: ThreeElement<typeof StreakMaterial>;
  }
}

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

export default function GalaxyCore() {
  const coreRef = useRef<THREE.Group>(null);
  const ringsRef = useRef<THREE.Group>(null);
  const streaksGroupRef = useRef<THREE.Group>(null);
  const streakMaterialRef = useRef<THREE.ShaderMaterial & { uTime: number }>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  const rng = useMemo(() => createRandom(42), []);
  const lensTexture = useMemo(() => createLensTexture(), []);

  // Tunnel streak geometry — motion is now entirely GPU-driven (see
  // StreakMaterial above), so this only builds static base attributes once.
  const streaksGeometry = useMemo(() => {
    const count = 1000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const offsets = new Float32Array(count);

    const coreColor = new THREE.Color('#60a5fa');
    const edgeColor = new THREE.Color('#1e3a8a');
    const goldColor = new THREE.Color('#fbbf24');
    const temp = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const angle = rng.next() * Math.PI * 2;
      const radius = rng.next() * 3.0;
      const forward = (rng.next() - 0.5) * 5;

      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = Math.sin(angle) * radius;
      positions[i3 + 2] = forward;

      const mix = rng.next();
      if (mix < 0.3) {
        temp.copy(goldColor).lerp(coreColor, mix * 3);
      } else {
        temp.copy(coreColor).lerp(edgeColor, (mix - 0.3) / 0.7);
      }
      colors[i3] = temp.r;
      colors[i3 + 1] = temp.g;
      colors[i3 + 2] = temp.b;

      speeds[i] = (rng.next() * 0.4 + 0.15) * (forward > 0 ? 1 : -1);
      offsets[i] = rng.next() * 10;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geometry.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1));
    return geometry;
  }, [rng]);

  const rings = useMemo(() => {
    return Array.from({ length: 10 }).map((_, i) => {
      const radius = 0.7 + i * 0.5;
      const tube = 0.02 + i * 0.003;
      const color = i % 3 === 0 ? '#60a5fa' : i % 3 === 1 ? '#fbbf24' : '#a855f7';
      return { radius, tube, color, speed: (0.05 + i * 0.012) * (i % 2 === 0 ? 1 : -1) };
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
    if (streakMaterialRef.current) {
      streakMaterialRef.current.uTime = state.clock.elapsedTime;
    }
    if (streaksGroupRef.current) {
      streaksGroupRef.current.rotation.z -= delta * 0.05;
    }
  });

  return (
    <group ref={coreRef} position={[0, 0.4, 0]}>
      {/* Inner bright drop — the "contact" point */}
      <mesh>
        <sphereGeometry args={[0.42, 64, 64]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={1} toneMapped={false} />
      </mesh>

      {/* Warm gold inner corona */}
      <mesh>
        <sphereGeometry args={[0.72, 64, 64]} />
        <meshBasicMaterial
          color="#fbbf24"
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Cyan-blue corona */}
      <mesh>
        <sphereGeometry args={[1.1, 64, 64]} />
        <meshBasicMaterial
          color="#60a5fa"
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Deep blue outer glow */}
      <mesh>
        <sphereGeometry args={[2.2, 64, 64]} />
        <meshBasicMaterial
          color="#1e40af"
          transparent
          opacity={0.08}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
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
              opacity={0.25 - i * 0.02}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      {/* Blue-white tunnel streaks — GPU-animated, see StreakMaterial */}
      <group ref={streaksGroupRef}>
        <points geometry={streaksGeometry} frustumCulled={false}>
          <streakMaterial
            ref={streakMaterialRef}
            uSize={0.18}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </points>
      </group>

      {/* Large lens-flare sprite */}
      <sprite position={[0, 0, 0]} scale={[9, 9, 1]}>
        <spriteMaterial map={lensTexture} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>

      {/* Secondary warm lens flare */}
      <sprite position={[0, 0, 0]} scale={[5, 5, 1]}>
        <spriteMaterial map={lensTexture} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} color="#fbbf24" />
      </sprite>

      {/* Tertiary purple flare */}
      <sprite position={[0, 0, 0]} scale={[3, 3, 1]}>
        <spriteMaterial map={lensTexture} transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} color="#a855f7" />
      </sprite>

      <pointLight ref={lightRef} color="#93c5fd" intensity={4.5} distance={50} decay={1.0} position={[0, 0, 0]} />
      <pointLight color="#fbbf24" intensity={1.8} distance={30} decay={1.2} position={[0, 0.4, 0]} />
      <pointLight color="#a855f7" intensity={1.0} distance={20} decay={1.5} position={[0, 0, 0]} />
    </group>
  );
}
