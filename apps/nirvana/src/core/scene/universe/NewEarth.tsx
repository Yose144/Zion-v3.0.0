'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { TextLabel } from './Label';
import * as THREE from 'three';
import { PLANET_R, latLonToVec3 } from './positions';
import { FREE_WORLD_MISSIONS, MISSION_ORIGIN, MISSION_STATUS_COLOR } from '@/lib/freeworld-sites';

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

/** L5 Free World — 12 zakládajících misí na reálných souřadnicích.
 *  Instancované světelné sloupky (barva = stav komunity) + jmenovka;
 *  klik otevře stránku komunity na app.zionterranova.com. */
function MissionSites() {
  const pillars = useRef<THREE.InstancedMesh>(null);
  const tips = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const UP = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);

  const data = useMemo(
    () =>
      FREE_WORLD_MISSIONS.map((m) => {
        const n = new THREE.Vector3(...latLonToVec3(m.lat, m.lon, 1));
        return {
          name: m.name,
          url: MISSION_ORIGIN + m.path,
          n,
          h: 0.55,
          color: new THREE.Color(MISSION_STATUS_COLOR[m.status]),
        };
      }),
    [],
  );

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
      p.setColorAt(i, d.color);
      dummy.position.copy(d.n).multiplyScalar(PLANET_R + d.h + 0.025);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      t.setMatrixAt(i, dummy.matrix);
      t.setColorAt(i, d.color);
    });
    p.instanceMatrix.needsUpdate = true;
    t.instanceMatrix.needsUpdate = true;
    if (p.instanceColor) p.instanceColor.needsUpdate = true;
    if (t.instanceColor) t.instanceColor.needsUpdate = true;
  }, [data, dummy, UP, quat]);

  return (
    <>
      <instancedMesh
        ref={pillars}
        args={[undefined, undefined, data.length]}
        frustumCulled={false}
        raycast={() => null}
      >
        <cylinderGeometry args={[0.014, 0.04, 1, 6, 1, true]} />
        <meshBasicMaterial
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
      <instancedMesh
        ref={tips}
        args={[undefined, undefined, data.length]}
        frustumCulled={false}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId != null) window.open(data[e.instanceId].url, '_blank', 'noopener');
        }}
      >
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshBasicMaterial />
      </instancedMesh>
      {data.map((d) => (
        <TextLabel
          key={d.name}
          text={d.name}
          position={[
            d.n.x * (PLANET_R + d.h + 0.34),
            d.n.y * (PLANET_R + d.h + 0.34),
            d.n.z * (PLANET_R + d.h + 0.34),
          ]}
          color={`#${d.color.getHexString()}`}
          height={0.19}
          onClick={() => window.open(d.url, '_blank', 'noopener')}
        />
      ))}
    </>
  );
}

export function NewEarth() {
  const spin = useRef<THREE.Group>(null);
  const fallback = useMemo(() => makeFallbackTexture(), []);
  const maps = useEarthMaps(fallback);

  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 0.02;
  });

  return (
    <group>
      {/* planeta + mise rotují spolu — body drží na svých kontinentech */}
      <group ref={spin}>
        <mesh>
          <sphereGeometry args={[PLANET_R, 64, 48]} />
          <meshStandardMaterial
            map={maps.color}
            bumpMap={maps.bump}
            bumpScale={0.2}
            roughness={0.72}
            metalness={0.02}
          />
        </mesh>
        <MissionSites />
      </group>
      {/* atmosféra — halo */}
      <mesh scale={1.07}>
        <sphereGeometry args={[PLANET_R, 48, 32]} />
        <meshBasicMaterial color="#7ec8ff" transparent opacity={0.13} side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <Moon />
    </group>
  );
}
