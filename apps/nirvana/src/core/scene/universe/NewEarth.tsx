'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { TextLabel } from './Label';
import * as THREE from 'three';
import type { Portal } from '@/core/portals/manifest';
import { PLANET_R, hash01, latLonToVec3, spotPosition } from './positions';
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

const MISSION_LABELS = 16;

/** L5 mise — světelné majáky vyplňují celou planetu (instancované, 2 draw calls,
 *  žádná useFrame). Anonymní body pryč — světy žijí ve World portalu;
 *  jmenovky nese reprezentativní podmnožina. Pozice hash→lat/lon pokrývá
 *  celý glóbus (galaxyPosition leží v rovině → jen rovníkový pás). */
function MissionSites({
  worlds,
  onSelectWorld,
}: {
  worlds: WorldPoint[];
  onSelectWorld: (id: string) => void;
}) {
  const pillars = useRef<THREE.InstancedMesh>(null);
  const tips = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const UP = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const color = useMemo(() => new THREE.Color(layerColor(5)), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);

  const data = useMemo(
    () =>
      worlds.map((w) => {
        const lat = -72 + hash01(w.id, 31) * 144;
        const lon = hash01(w.id, 37) * 360 - 180;
        const n = new THREE.Vector3(...latLonToVec3(lat, lon, 1));
        const h = 0.3 + hash01(w.id, 41) * 0.3;
        return { id: w.id, name: w.name, n, h };
      }),
    [worlds],
  );

  const labeled = useMemo(() => {
    const step = Math.max(1, Math.ceil(data.length / MISSION_LABELS));
    return data.filter((_, i) => i % step === 0);
  }, [data]);

  useLayoutEffect(() => {
    const p = pillars.current;
    const t = tips.current;
    if (!p || !t) return;
    data.forEach((d, i) => {
      quat.setFromUnitVectors(UP, d.n);
      dummy.quaternion.copy(quat);
      dummy.position.copy(d.n).multiplyScalar(PLANET_R + d.h / 2);
      dummy.scale.set(1, d.h, 1);
      dummy.updateMatrix();
      p.setMatrixAt(i, dummy.matrix);
      p.setColorAt(i, color);
      dummy.position.copy(d.n).multiplyScalar(PLANET_R + d.h + 0.02);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      t.setMatrixAt(i, dummy.matrix);
      t.setColorAt(i, color);
    });
    p.instanceMatrix.needsUpdate = true;
    t.instanceMatrix.needsUpdate = true;
    if (p.instanceColor) p.instanceColor.needsUpdate = true;
    if (t.instanceColor) t.instanceColor.needsUpdate = true;
  }, [data, dummy, UP, quat, color]);

  if (data.length === 0) return null;
  return (
    <>
      {/* sloupky mise — světelné majáky ze země do nebe */}
      <instancedMesh
        key={data.length}
        ref={pillars}
        args={[undefined, undefined, data.length]}
        frustumCulled={false}
        raycast={() => null}
      >
        <cylinderGeometry args={[0.012, 0.032, 1, 6, 1, true]} />
        <meshBasicMaterial
          transparent
          opacity={0.38}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
      {/* jiskra na špici — klikatelná → World portal */}
      <instancedMesh
        ref={tips}
        args={[undefined, undefined, data.length]}
        frustumCulled={false}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId != null) onSelectWorld(data[e.instanceId].id);
        }}
      >
        <sphereGeometry args={[0.036, 10, 10]} />
        <meshBasicMaterial />
      </instancedMesh>
      {/* jmenovky misí — reprezentativní podmnožina, zbytek v menu */}
      {labeled.map((d) => (
        <TextLabel
          key={d.id}
          text={d.name}
          position={[
            d.n.x * (PLANET_R + d.h + 0.3),
            d.n.y * (PLANET_R + d.h + 0.3),
            d.n.z * (PLANET_R + d.h + 0.3),
          ]}
          color="#e8d8ff"
          height={0.16}
          onClick={() => onSelectWorld(d.id)}
        />
      ))}
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
      {/* L5 mise na povrchu — světelné majáky (světy samotné v menu) */}
      <MissionSites worlds={worlds} onSelectWorld={onSelectWorld} />
      {/* funkcionální místa z manifestu */}
      {spots.map((p) => (
        <PortalSpot key={p.id} portal={p} onOpen={onOpen} />
      ))}
      {beacon && <Beacon portal={beacon} onOpen={onOpen} />}
      <Moon />
    </group>
  );
}
