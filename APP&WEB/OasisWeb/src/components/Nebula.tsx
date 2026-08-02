'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

function createNebulaTexture(color1: string, color2: string, size = 1024): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Soft radial glow — base shape of the cloud
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color1);
  g.addColorStop(0.3, color2);
  g.addColorStop(0.7, color2.replace(/[\d.]+\)$/, '0.05)'));
  g.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Layered soft blobs (poor-man's fractal noise) to break up the perfect
  // radial gradient into wispy, volumetric-looking gas clumps.
  const blobLayers = 5;
  for (let layer = 0; layer < blobLayers; layer++) {
    const blobs = 6 + Math.floor(Math.random() * 6);
    for (let i = 0; i < blobs; i++) {
      const cx = size * (0.2 + Math.random() * 0.6);
      const cy = size * (0.2 + Math.random() * 0.6);
      const r = size * (0.08 + Math.random() * 0.22) * (1 - layer * 0.12);
      const blob = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      const useColor1 = Math.random() > 0.5;
      blob.addColorStop(0, useColor1 ? color1 : color2);
      blob.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.12 + Math.random() * 0.1;
      ctx.fillStyle = blob;
      ctx.fillRect(0, 0, size, size);
    }
  }
  ctx.globalAlpha = 1;

  // Fine grain detail so the cloud isn't perfectly smooth
  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 26;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

interface NebulaCloudProps {
  color1: string;
  color2: string;
  position: [number, number, number];
  scale: number;
  speed: number;
}

function NebulaCloud({ color1, color2, position, scale, speed, textureSize = 1024 }: NebulaCloudProps & { textureSize?: number }) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const { camera } = useThree();
  const texture = useMemo(() => createNebulaTexture(color1, color2, textureSize), [color1, color2, textureSize]);
  const drift = useMemo(() => ({ phase: Math.random() * Math.PI * 2, amp: 0.6 + Math.random() * 0.8 }), []);

  useFrame((state) => {
    if (spriteRef.current) {
      spriteRef.current.lookAt(camera.position);
      spriteRef.current.material.rotation = state.clock.elapsedTime * speed * 0.05;
      // Slow positional drift so the cloud reads as a living gas formation,
      // not a static painted backdrop.
      const t = state.clock.elapsedTime * 0.06 + drift.phase;
      spriteRef.current.position.set(
        position[0] + Math.sin(t) * drift.amp,
        position[1] + Math.cos(t * 0.7) * drift.amp * 0.6,
        position[2] + Math.cos(t) * drift.amp
      );
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 0.15 + drift.phase) * 0.06;
      spriteRef.current.scale.set(scale * pulse, scale * pulse, 1);
    }
  });

  return (
    <sprite ref={spriteRef} position={position} scale={[scale, scale, 1]}>
      <spriteMaterial
        map={texture}
        transparent
        opacity={0.13}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  );
}

export default function Nebula({ isMobile = false }: { isMobile?: boolean }) {
  const clouds: NebulaCloudProps[] = [
    { color1: 'rgba(100, 40, 140, 0.65)', color2: 'rgba(30, 10, 50, 0.2)', position: [-22, 5, -28], scale: 34, speed: 0.4 },
    { color1: 'rgba(40, 100, 150, 0.55)', color2: 'rgba(10, 25, 50, 0.18)', position: [26, -4, -22], scale: 28, speed: -0.3 },
    { color1: 'rgba(140, 80, 30, 0.45)', color2: 'rgba(50, 25, 8, 0.15)', position: [-12, -10, 20], scale: 30, speed: 0.2 },
    { color1: 'rgba(70, 50, 120, 0.5)', color2: 'rgba(20, 12, 40, 0.15)', position: [18, 9, 18], scale: 26, speed: -0.25 },
    { color1: 'rgba(30, 80, 110, 0.45)', color2: 'rgba(8, 20, 40, 0.12)', position: [0, 14, -32], scale: 38, speed: 0.15 },
    { color1: 'rgba(120, 60, 100, 0.4)', color2: 'rgba(30, 15, 35, 0.1)', position: [-28, -2, 12], scale: 24, speed: -0.18 },
    { color1: 'rgba(80, 30, 90, 0.5)', color2: 'rgba(20, 8, 35, 0.15)', position: [30, 3, -8], scale: 22, speed: 0.22 },
    { color1: 'rgba(180, 100, 50, 0.35)', color2: 'rgba(60, 30, 10, 0.12)', position: [-35, 8, -15], scale: 28, speed: 0.12 },
    { color1: 'rgba(50, 120, 80, 0.3)', color2: 'rgba(15, 40, 25, 0.1)', position: [35, -8, 25], scale: 26, speed: -0.14 },
    { color1: 'rgba(100, 60, 160, 0.4)', color2: 'rgba(25, 15, 50, 0.12)', position: [0, -15, 30], scale: 32, speed: 0.1 },
    { color1: 'rgba(200, 120, 60, 0.3)', color2: 'rgba(70, 35, 12, 0.1)', position: [-18, 12, -5], scale: 20, speed: -0.2 },
  ];

  const visibleClouds = isMobile ? clouds.slice(0, 6) : clouds;

  return (
    <group>
      {visibleClouds.map((cloud, i) => (
        <NebulaCloud key={i} {...cloud} textureSize={isMobile ? 512 : 1024} />
      ))}
    </group>
  );
}
