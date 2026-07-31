'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

function createNebulaTexture(color1: string, color2: string): THREE.Texture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, color1);
  g.addColorStop(0.4, color2);
  g.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

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

function NebulaCloud({ color1, color2, position, scale, speed }: NebulaCloudProps) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const { camera } = useThree();
  const texture = useMemo(() => createNebulaTexture(color1, color2), [color1, color2]);

  useFrame((state) => {
    if (spriteRef.current) {
      spriteRef.current.lookAt(camera.position);
      spriteRef.current.material.rotation = state.clock.elapsedTime * speed * 0.05;
    }
  });

  return (
    <sprite ref={spriteRef} position={position} scale={[scale, scale, 1]}>
      <spriteMaterial
        map={texture}
        transparent
        opacity={0.28}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </sprite>
  );
}

export default function Nebula() {
  const clouds: NebulaCloudProps[] = [
    { color1: 'rgba(80, 30, 120, 0.55)', color2: 'rgba(20, 5, 40, 0.15)', position: [-18, 4, -22], scale: 26, speed: 0.4 },
    { color1: 'rgba(30, 90, 130, 0.45)', color2: 'rgba(5, 20, 40, 0.12)', position: [22, -3, -18], scale: 22, speed: -0.3 },
    { color1: 'rgba(120, 70, 20, 0.35)', color2: 'rgba(40, 20, 5, 0.1)', position: [-10, -8, 16], scale: 24, speed: 0.2 },
    { color1: 'rgba(60, 40, 100, 0.4)', color2: 'rgba(15, 8, 30, 0.1)', position: [14, 7, 14], scale: 20, speed: -0.25 },
    { color1: 'rgba(20, 70, 90, 0.35)', color2: 'rgba(5, 15, 30, 0.08)', position: [0, 12, -26], scale: 30, speed: 0.15 },
  ];

  return (
    <group>
      {clouds.map((cloud, i) => (
        <NebulaCloud key={i} {...cloud} />
      ))}
    </group>
  );
}
