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
 *  Instancované světelné sloupky + pulzující kruhy na povrchu +
 *  jmenovky; hover zvýrazní bod (kurzor odkazu, halo + tooltip ↗),
 *  klik otevře 3D prezentaci nebo stránku komunity. */
function MissionSites() {
  const pillars = useRef<THREE.InstancedMesh>(null);
  const tips = useRef<THREE.InstancedMesh>(null);
  const hits = useRef<THREE.InstancedMesh>(null);
  const rings = useRef<THREE.InstancedMesh>(null);
  const halo = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const tipScale = useRef<number[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const UP = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const FWD = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);

  const data = useMemo(
    () =>
      FREE_WORLD_MISSIONS.map((m) => {
        const n = new THREE.Vector3(...latLonToVec3(m.lat, m.lon, 1));
        return {
          name: m.name,
          url: m.present ?? MISSION_ORIGIN + m.path,
          n,
          h: 0.72,
          color: new THREE.Color(MISSION_STATUS_COLOR[m.status]),
        };
      }),
    [],
  );

  if (tipScale.current.length !== data.length) tipScale.current = data.map(() => 1);

  useLayoutEffect(() => {
    const p = pillars.current;
    const t = tips.current;
    const h = hits.current;
    const r = rings.current;
    if (!p || !t || !h || !r) return;
    data.forEach((d, i) => {
      // sloupek
      quat.setFromUnitVectors(UP, d.n);
      dummy.quaternion.copy(quat);
      dummy.position.copy(d.n).multiplyScalar(PLANET_R + d.h / 2);
      dummy.scale.set(1, d.h, 1);
      dummy.updateMatrix();
      p.setMatrixAt(i, dummy.matrix);
      p.setColorAt(i, d.color);
      // tip
      dummy.position.copy(d.n).multiplyScalar(PLANET_R + d.h + 0.025);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      t.setMatrixAt(i, dummy.matrix);
      t.setColorAt(i, d.color);
      // neviditelný hit target — větší plocha pro snadný hover
      dummy.position.copy(d.n).multiplyScalar(PLANET_R + d.h * 0.55);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      h.setMatrixAt(i, dummy.matrix);
      // kruh na povrchu — leží tečně na planetě
      quat.setFromUnitVectors(FWD, d.n);
      dummy.quaternion.copy(quat);
      dummy.position.copy(d.n).multiplyScalar(PLANET_R + 0.02);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      r.setMatrixAt(i, dummy.matrix);
      r.setColorAt(i, d.color);
    });
    p.instanceMatrix.needsUpdate = true;
    t.instanceMatrix.needsUpdate = true;
    h.instanceMatrix.needsUpdate = true;
    r.instanceMatrix.needsUpdate = true;
    if (p.instanceColor) p.instanceColor.needsUpdate = true;
    if (t.instanceColor) t.instanceColor.needsUpdate = true;
    if (r.instanceColor) r.instanceColor.needsUpdate = true;
  }, [data, dummy, UP, FWD, quat]);

  // pulz kruhů + hover zvětšení tipů + halo sleduje hovered bod
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const r = rings.current;
    const tp = tips.current;
    data.forEach((d, i) => {
      if (r) {
        quat.setFromUnitVectors(FWD, d.n);
        dummy.quaternion.copy(quat);
        dummy.position.copy(d.n).multiplyScalar(PLANET_R + 0.02);
        const s = 1 + 0.3 * Math.sin(t * 2.4 + i * 1.7);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        r.setMatrixAt(i, dummy.matrix);
      }
      if (tp) {
        tipScale.current[i] += ((i === hovered ? 1.8 : 1) - tipScale.current[i]) * 0.2;
        quat.setFromUnitVectors(UP, d.n);
        dummy.quaternion.copy(quat);
        dummy.position.copy(d.n).multiplyScalar(PLANET_R + d.h + 0.025);
        dummy.scale.setScalar(tipScale.current[i]);
        dummy.updateMatrix();
        tp.setMatrixAt(i, dummy.matrix);
      }
    });
    if (r) r.instanceMatrix.needsUpdate = true;
    if (tp) tp.instanceMatrix.needsUpdate = true;
    const hl = halo.current;
    if (hl) {
      if (hovered != null) {
        const d = data[hovered];
        quat.setFromUnitVectors(FWD, d.n);
        hl.quaternion.copy(quat);
        hl.position.copy(d.n).multiplyScalar(PLANET_R + d.h + 0.02);
        const s = 1 + 0.16 * Math.sin(t * 6);
        hl.scale.setScalar(s);
        hl.visible = true;
      } else {
        hl.visible = false;
      }
    }
  });

  const open = (i: number) => window.open(data[i].url, '_blank', 'noopener');
  const hoverRef = useRef<number | null>(null);
  const setHover = (i: number | null) => {
    if (hoverRef.current === i) return;
    hoverRef.current = i;
    document.body.style.cursor = i == null ? 'auto' : 'pointer';
    setHovered(i);
  };

  return (
    <>
      <instancedMesh
        ref={pillars}
        args={[undefined, undefined, data.length]}
        frustumCulled={false}
        raycast={() => null}
      >
        <cylinderGeometry args={[0.016, 0.05, 1, 6, 1, true]} />
        <meshBasicMaterial
          transparent
          opacity={0.6}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
      {/* pulzující kruhy na povrchu — markery čitelné na první pohled */}
      <instancedMesh
        ref={rings}
        args={[undefined, undefined, data.length]}
        frustumCulled={false}
        raycast={() => null}
      >
        <ringGeometry args={[0.1, 0.15, 24]} />
        <meshBasicMaterial transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh
        ref={tips}
        args={[undefined, undefined, data.length]}
        frustumCulled={false}
        raycast={() => null}
      >
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshBasicMaterial />
      </instancedMesh>
      {/* neviditelné hit targety — štědrá plocha pro hover i klik */}
      <instancedMesh
        ref={hits}
        args={[undefined, undefined, data.length]}
        frustumCulled={false}
        onPointerMove={(e) => {
          e.stopPropagation();
          if (e.instanceId != null) setHover(e.instanceId);
        }}
        onPointerOut={() => setHover(null)}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId != null) open(e.instanceId);
        }}
      >
        <sphereGeometry args={[0.16, 10, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </instancedMesh>
      {/* halo — zlatý kruh kolem hovered bodu */}
      <group ref={halo} visible={false}>
        <mesh>
          <torusGeometry args={[0.17, 0.014, 8, 32]} />
          <meshBasicMaterial color="#ffd870" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        <mesh>
          <torusGeometry args={[0.24, 0.006, 8, 32]} />
          <meshBasicMaterial color="#ffe9a8" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
      {/* tooltip — jméno + ↗ nad hovered bodem */}
      {hovered != null && (
        <TextLabel
          text={`${data[hovered].name}  ↗`}
          position={[
            data[hovered].n.x * (PLANET_R + data[hovered].h + 0.62),
            data[hovered].n.y * (PLANET_R + data[hovered].h + 0.62),
            data[hovered].n.z * (PLANET_R + data[hovered].h + 0.62),
          ]}
          color="#ffffff"
          height={0.3}
          onClick={() => open(hovered)}
        />
      )}
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
