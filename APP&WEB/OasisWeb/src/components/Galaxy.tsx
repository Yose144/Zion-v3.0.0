'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARAMETERS = {
  count: 30000,
  radius: 38,
  branches: 5,
  spin: 1.05,
  randomness: 0.55,
  randomnessPower: 3,
  insideColor: '#f59e0b',
  outsideColor: '#7c3aed',
  size: 0.12,
};

function createParticleTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.08)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export default function Galaxy() {
  const pointsRef = useRef<THREE.Points>(null);

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(PARAMETERS.count * 3);
    const colors = new Float32Array(PARAMETERS.count * 3);

    const insideColor = new THREE.Color(PARAMETERS.insideColor);
    const outsideColor = new THREE.Color(PARAMETERS.outsideColor);
    const color = new THREE.Color();

    for (let i = 0; i < PARAMETERS.count; i++) {
      const i3 = i * 3;

      const radius = Math.random() * PARAMETERS.radius;
      const branch = i % PARAMETERS.branches;
      const branchAngle = (branch / PARAMETERS.branches) * Math.PI * 2;
      const spinAngle = radius * PARAMETERS.spin;

      const randomX =
        Math.pow(Math.random(), PARAMETERS.randomnessPower) *
        (Math.random() < 0.5 ? -1 : 1) *
        PARAMETERS.randomness *
        radius;
      const randomY =
        Math.pow(Math.random(), PARAMETERS.randomnessPower) *
        (Math.random() < 0.5 ? -1 : 1) *
        PARAMETERS.randomness *
        radius;
      const randomZ =
        Math.pow(Math.random(), PARAMETERS.randomnessPower) *
        (Math.random() < 0.5 ? -1 : 1) *
        PARAMETERS.randomness *
        radius;

      positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
      positions[i3 + 1] = randomY;
      positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

      color.copy(insideColor);
      color.lerp(outsideColor, radius / PARAMETERS.radius);

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
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      alphaTest: 0.001,
    });

    return { geometry, material };
  }, []);

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.03;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry} material={material} position={[0, 0, 0]} />
  );
}
