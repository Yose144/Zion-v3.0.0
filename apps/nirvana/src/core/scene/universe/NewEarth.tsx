'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Portal } from '@/core/portals/manifest';
import { PLANET_R, spotPosition, surfacePosition } from './positions';
import type { WorldPoint } from '@/lib/worlds';
import { layerColor } from '@/lib/worlds';

/** Procedurální mapa Nové Země — equirect canvas, seedované kontinenty. */
function makeEarthTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
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
    const blobs = 4 + Math.floor(rnd() * 6);
    for (let b = 0; b < blobs; b++) {
      const bx = cx + (rnd() - 0.5) * 170;
      const by = cy + (rnd() - 0.5) * 95;
      const r = 18 + rnd() * 58;
      const g = ctx.createRadialGradient(bx, by, r * 0.15, bx, by, r);
      g.addColorStop(0, '#2f7d47');
      g.addColorStop(0.72, '#1d5c3a');
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

function SurfaceMarker({
  world,
  onSelectWorld,
}: {
  world: WorldPoint;
  onSelectWorld: (id: string) => void;
}) {
  const pos = surfacePosition(world);
  return (
    <mesh
      position={pos}
      onClick={(e) => {
        e.stopPropagation();
        onSelectWorld(world.id);
      }}
    >
      <sphereGeometry args={[0.045, 8, 8]} />
      <meshBasicMaterial color={layerColor(world.layer)} />
    </mesh>
  );
}

function PortalSpot({
  portal,
  onOpen,
}: {
  portal: Portal;
  onOpen: (id: string) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const s = 1 + Math.sin(t * 2.2) * 0.18;
    ref.current?.scale.setScalar(s);
  });
  const spot = portal.scene.spot!;
  return (
    <group position={spotPosition(spot, PLANET_R + 0.09)}>
      <mesh
        ref={ref}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(portal.id);
        }}
      >
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshBasicMaterial color="#fcd116" />
      </mesh>
      <Html center distanceFactor={16} occlude="raycast" style={{ pointerEvents: 'none' }}>
        <span className="scene-label">{portal.title.cs}</span>
      </Html>
    </group>
  );
}

function Beacon({ portal, onOpen }: { portal: Portal; onOpen: (id: string) => void }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const mat = ref.current?.material as THREE.MeshBasicMaterial | undefined;
    if (mat) mat.opacity = 0.45 + Math.sin(clock.getElapsedTime() * 1.6) * 0.25;
  });
  const pos = spotPosition('beacon', PLANET_R + 0.02);
  return (
    <group position={pos}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onOpen(portal.id);
        }}
      >
        <sphereGeometry args={[0.11, 12, 12]} />
        <meshBasicMaterial color="#7ec8ff" />
      </mesh>
      {/* maják — paprsek vzhůru z povrchu */}
      <mesh ref={ref} position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.012, 0.05, 1.8, 8, 1, true]} />
        <meshBasicMaterial color="#7ec8ff" transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <Html center distanceFactor={16} occlude="raycast" style={{ pointerEvents: 'none' }}>
        <span className="scene-label">{portal.title.cs}</span>
      </Html>
    </group>
  );
}

export function NewEarth({
  worlds,
  surfacePortals,
  onOpen,
  onSelectWorld,
}: {
  worlds: WorldPoint[];
  surfacePortals: Portal[];
  onOpen: (id: string) => void;
  onSelectWorld: (id: string) => void;
}) {
  const planet = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => makeEarthTexture(), []);
  const beacon = surfacePortals.find((p) => p.scene.spot === 'beacon');
  const spots = surfacePortals.filter((p) => p.scene.spot !== 'beacon');

  useFrame((_, delta) => {
    if (planet.current) planet.current.rotation.y += delta * 0.02;
  });

  return (
    <group>
      {/* planeta — povrch L5 */}
      <mesh ref={planet}>
        <sphereGeometry args={[PLANET_R, 48, 32]} />
        <meshStandardMaterial map={texture} roughness={0.9} metalness={0.05} />
      </mesh>
      {/* atmosféra — halo */}
      <mesh scale={1.07}>
        <sphereGeometry args={[PLANET_R, 48, 32]} />
        <meshBasicMaterial color="#7ec8ff" transparent opacity={0.13} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {/* L5 světy na povrchu */}
      {worlds.map((w) => (
        <SurfaceMarker key={w.id} world={w} onSelectWorld={onSelectWorld} />
      ))}
      {/* funkcionální místa z manifestu */}
      {spots.map((p) => (
        <PortalSpot key={p.id} portal={p} onOpen={onOpen} />
      ))}
      {beacon && <Beacon portal={beacon} onOpen={onOpen} />}
    </group>
  );
}
