'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createRandom } from '../domain/ports/random';

// This disk IS the Milky Way — the main gaming workspace where the player
// flies between worlds — so it should read as the visual centerpiece, not
// a background layer. Slightly larger/brighter points than a pure backdrop.
const PARAMETERS = {
  count: 34000,
  radius: 48,
  branches: 8,
  spin: 1.35,
  randomness: 0.45,
  randomnessPower: 3.5,
  insideColor: '#fde68a',
  midColor: '#c084fc',
  outsideColor: '#60a5fa',
  size: 0.16,
};

function createParticleTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.7)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.15)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export default function Galaxy({ isMobile = false }: { isMobile?: boolean }) {
  const pointsRef = useRef<THREE.Points>(null);
  const dustRef = useRef<THREE.Points>(null);

  const count = isMobile ? 12000 : PARAMETERS.count;
  const dustCount = isMobile ? 1500 : 3500;

  const { geometry, material, dustGeometry, dustMaterial } = useMemo(() => {
    const rng = createRandom(31415);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const insideColor = new THREE.Color(PARAMETERS.insideColor);
    const midColor = new THREE.Color(PARAMETERS.midColor);
    const outsideColor = new THREE.Color(PARAMETERS.outsideColor);
    const color = new THREE.Color();
    const radiusNorm = PARAMETERS.radius;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      const radius = rng.next() * PARAMETERS.radius;
      const branch = i % PARAMETERS.branches;
      const branchAngle = (branch / PARAMETERS.branches) * Math.PI * 2;
      const spinAngle = radius * PARAMETERS.spin;

      const randomX =
        Math.pow(rng.next(), PARAMETERS.randomnessPower) *
        (rng.next() < 0.5 ? -1 : 1) *
        PARAMETERS.randomness *
        radius;
      const randomY =
        Math.pow(rng.next(), PARAMETERS.randomnessPower) *
        (rng.next() < 0.5 ? -1 : 1) *
        PARAMETERS.randomness *
        radius *
        0.3;
      const randomZ =
        Math.pow(rng.next(), PARAMETERS.randomnessPower) *
        (rng.next() < 0.5 ? -1 : 1) *
        PARAMETERS.randomness *
        radius;

      positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
      positions[i3 + 1] = randomY;
      positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

      const t = radius / radiusNorm;
      if (t < 0.5) {
        color.copy(insideColor).lerp(midColor, t * 2);
      } else {
        color.copy(midColor).lerp(outsideColor, (t - 0.5) * 2);
      }

      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const texture = createParticleTexture();

    const material = new THREE.PointsMaterial({
      size: PARAMETERS.size,
      sizeAttenuation: true,
      vertexColors: true,
      map: texture,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      alphaTest: 0.001,
      toneMapped: false,
    });

    // Dust lane particles — larger, dimmer, warm-toned
    const dustPositions = new Float32Array(dustCount * 3);
    const dustColors = new Float32Array(dustCount * 3);
    const dustColor = new THREE.Color();

    for (let i = 0; i < dustCount; i++) {
      const i3 = i * 3;
      const radius = 5 + rng.next() * (PARAMETERS.radius - 5);
      const branch = i % PARAMETERS.branches;
      const branchAngle = (branch / PARAMETERS.branches) * Math.PI * 2;
      const spinAngle = radius * PARAMETERS.spin * 0.9;

      const randomX = (rng.next() - 0.5) * radius * 0.3;
      const randomY = (rng.next() - 0.5) * radius * 0.08;
      const randomZ = (rng.next() - 0.5) * radius * 0.3;

      dustPositions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
      dustPositions[i3 + 1] = randomY;
      dustPositions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

      const t = radius / radiusNorm;
      dustColor.setHSL(0.08 + t * 0.05, 0.6, 0.3 + rng.next() * 0.15);
      dustColors[i3] = dustColor.r;
      dustColors[i3 + 1] = dustColor.g;
      dustColors[i3 + 2] = dustColor.b;
    }

    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    dustGeometry.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));

    const dustMaterial = new THREE.PointsMaterial({
      size: 0.35,
      sizeAttenuation: true,
      vertexColors: true,
      map: texture,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      alphaTest: 0.001,
      toneMapped: false,
    });

    return { geometry, material, dustGeometry, dustMaterial };
  }, [count, dustCount]);

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.04;
    }
    if (dustRef.current) {
      dustRef.current.rotation.y += delta * 0.035;
    }
  });

  return (
    <group>
      <points ref={pointsRef} geometry={geometry} material={material} position={[0, 0, 0]} />
      <points ref={dustRef} geometry={dustGeometry} material={dustMaterial} position={[0, 0, 0]} />
    </group>
  );
}
