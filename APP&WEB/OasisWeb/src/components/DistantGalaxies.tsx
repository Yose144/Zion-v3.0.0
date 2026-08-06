'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function createGalaxyTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;
  const r = size * 0.46;

  ctx.clearRect(0, 0, size, size);

  // Soft radial glow
  const grad = ctx.createRadialGradient(c, c, 0, c, c, r);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
  grad.addColorStop(0.18, 'rgba(255, 255, 255, 0.35)');
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();

  // Faint spiral arms
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 3;
  for (let arm = 0; arm < 2; arm++) {
    ctx.beginPath();
    const base = arm * Math.PI;
    for (let t = 0.02; t <= 1; t += 0.02) {
      const dist = t * r;
      const angle = base + t * Math.PI * 1.6;
      const x = c + Math.cos(angle) * dist;
      const y = c + Math.sin(angle) * dist;
      if (t <= 0.03) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

const GALAXIES: {
  name: string;
  position: [number, number, number];
  color: string;
  scale: [number, number, number];
}[] = [
  { name: 'Andromeda', position: [0, 1.8, -95], color: '#078930', scale: [20, 12, 1] },
  { name: 'Triangulum', position: [82, -1.2, 43], color: '#078930', scale: [18, 11, 1] },
  { name: 'Sombrero', position: [-64, 1.0, -75], color: '#f5f5f5', scale: [18, 11, 1] },
  { name: 'Cartwheel', position: [78, -1.5, -61], color: '#e41e2b', scale: [20, 12, 1] },
  { name: 'Whirlpool', position: [-88, 2.5, 20], color: '#078930', scale: [16, 10, 1] },
  { name: 'Sunflower', position: [55, 3.0, -88], color: '#fcd116', scale: [15, 9, 1] },
  { name: 'Pinwheel', position: [-45, -3.5, 65], color: '#e41e2b', scale: [17, 10, 1] },
  { name: 'Cigar', position: [92, -2.0, -30], color: '#e41e2b', scale: [14, 8, 1] },
  { name: 'Centaurus-A', position: [-72, -2.5, -40], color: '#e41e2b', scale: [16, 10, 1] },
  { name: 'NGC-1300', position: [40, 4.5, 80], color: '#078930', scale: [15, 9, 1] },
];

export default function DistantGalaxies() {
  const texture = useMemo(createGalaxyTexture, []);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.0005;
      groupRef.current.rotation.z += delta * 0.0002;
    }
  });

  return (
    <group ref={groupRef}>
      {GALAXIES.map((g) => (
        <sprite key={g.name} position={g.position} scale={g.scale}>
          <spriteMaterial
            map={texture}
            color={g.color}
            transparent
            opacity={0.35}
            blending={THREE.AdditiveBlending}
            depthWrite
            alphaTest={0.02}
            fog={false}
          />
        </sprite>
      ))}
    </group>
  );
}
