'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { TextLabel } from './Label';
import * as THREE from 'three';
import type { Portal } from '@/core/portals/manifest';
import { PLANET_R, hash01, spotPosition, surfacePosition } from './positions';
import type { WorldPoint } from '@/lib/worlds';
import { layerColor } from '@/lib/worlds';

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

/** L5 markery — instancované (2 draw calls místo ~2×N, jedna useFrame). */
function SurfaceMarkers({
  worlds,
  onSelectWorld,
}: {
  worlds: WorldPoint[];
  onSelectWorld: (id: string) => void;
}) {
  const core = useRef<THREE.InstancedMesh>(null);
  const halo = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const data = useMemo(
    () =>
      worlds.map((w) => ({
        id: w.id,
        pos: surfacePosition(w),
        color: new THREE.Color(layerColor(w.layer)),
        phase: hash01(w.id, 29) * Math.PI * 2,
      })),
    [worlds],
  );

  useLayoutEffect(() => {
    const c = core.current;
    const h = halo.current;
    if (!c || !h) return;
    data.forEach((d, i) => {
      dummy.position.set(d.pos[0], d.pos[1], d.pos[2]);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      c.setMatrixAt(i, dummy.matrix);
      dummy.scale.setScalar(1.6);
      dummy.updateMatrix();
      h.setMatrixAt(i, dummy.matrix);
      c.setColorAt(i, d.color);
      h.setColorAt(i, d.color);
    });
    c.instanceMatrix.needsUpdate = true;
    h.instanceMatrix.needsUpdate = true;
    if (c.instanceColor) c.instanceColor.needsUpdate = true;
    if (h.instanceColor) h.instanceColor.needsUpdate = true;
  }, [data, dummy]);

  useFrame(({ clock }) => {
    const c = core.current;
    const h = halo.current;
    if (!c || !h) return;
    const t = clock.getElapsedTime();
    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const s = 1 + Math.sin(t * 1.8 + d.phase) * 0.22;
      dummy.position.set(d.pos[0], d.pos[1], d.pos[2]);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      c.setMatrixAt(i, dummy.matrix);
      dummy.scale.setScalar(s * 1.6);
      dummy.updateMatrix();
      h.setMatrixAt(i, dummy.matrix);
    }
    c.instanceMatrix.needsUpdate = true;
    h.instanceMatrix.needsUpdate = true;
  });

  if (data.length === 0) return null;
  return (
    <>
      <instancedMesh
        key={data.length}
        ref={core}
        args={[undefined, undefined, data.length]}
        frustumCulled={false}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId != null) onSelectWorld(data[e.instanceId].id);
        }}
      >
        <sphereGeometry args={[0.06, 10, 10]} />
        <meshBasicMaterial />
      </instancedMesh>
      <instancedMesh
        ref={halo}
        args={[undefined, undefined, data.length]}
        frustumCulled={false}
        raycast={() => null}
      >
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial transparent opacity={0.14} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
    </>
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
      <TextLabel text={portal.title.cs} position={[0, 0.22, 0]} color="#ffe9b0" height={0.2} />
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
      <mesh ref={ref} position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.012, 0.05, 1.8, 8, 1, true]} />
        <meshBasicMaterial color="#7ec8ff" transparent opacity={0.5} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <TextLabel text={portal.title.cs} position={[0, 2.0, 0]} color="#a8d8ff" height={0.22} />
    </group>
  );
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
  const fallback = useMemo(() => makeFallbackTexture(), []);
  const maps = useEarthMaps(fallback);
  const beacon = surfacePortals.find((p) => p.scene.spot === 'beacon');
  const spots = surfacePortals.filter((p) => p.scene.spot !== 'beacon');

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
      {/* L5 světy na povrchu — instancované markery */}
      <SurfaceMarkers worlds={worlds} onSelectWorld={onSelectWorld} />
      {/* funkcionální místa z manifestu */}
      {spots.map((p) => (
        <PortalSpot key={p.id} portal={p} onOpen={onOpen} />
      ))}
      {beacon && <Beacon portal={beacon} onOpen={onOpen} />}
      <Moon />
    </group>
  );
}
