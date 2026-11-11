'use client';

/**
 * PLUTO — SRDCE NA OKRAJI. Scéna pochůzky.
 *
 * Vykresluje jen to, co simulace (`light.ts`) řekne. Svět je malý a statický:
 * zmrzlá pláň, devět lamp, přistávací modul a sníh. Kamera visí nad hráčem
 * a mírně se naklání — z výšky je vidět tvar srdce, zblízka zase lucerna.
 *
 * Teplo se **nekreslí do světa** (žádná červená mlha). Nese ho lucerna
 * v ruce: její světlo je jediné, co se hýbe, a proto je ho vidět.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { dampFactor } from '@/core/design/motion';
import { isGamePaused } from '@/core/games/pause';
import { play } from '@/core/audio/engine';
import { LAMP_COUNT, LAMPS, SHUTTLE, WARMTH_MAX } from './world';
import {
  createLight,
  nearestWarm,
  nextLamp,
  reachOf,
  resultOf,
  scoreOf,
  stepLight,
  type LightEnd,
  type LightEventKind,
  type LightResult,
  type LightState,
} from './light';

export interface PlutoStats {
  x: number;
  z: number;
  warmth: number;
  lamps: number;
  totalLamps: number;
  warmDistance: number;
  channel: number;
  channelId: number | null;
  reach: number;
  score: number;
  elapsed: number;
  end: LightEnd;
  nextDx: number | null;
  nextDz: number | null;
  nextDistance: number | null;
  nextId: number | null;
  /** Které lampy svítí — minimapa a HUD kreslí z tohohle, ne z vlastního stavu. */
  litMask: boolean[];
  /** Rychlost pro natočení šipky na minimapě. */
  vx: number;
  vz: number;
  event: LightEventKind | null;
  eventId: number;
}

/** Měkký kruh — jediná textura (halo lamp, lucerna, sníh). */
let softTexture: THREE.Texture | null = null;
function softSprite(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  if (softTexture) return softTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.34)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  softTexture = texture;
  return texture;
}

function reducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Textura pláně: tmavý zmrzlý dusík a světlé srdce (Sputnik Planitia).
 *
 * Kreslí se deterministicky do canvasu — binární textura kvůli jedné hře
 * nemá smysl a hlavně: srdce je **herní mapa**, takže musí sedět na světové
 * souřadnice (střed canvasu = 0,0; horní okraj = −Z).
 */
let plainTexture: THREE.Texture | null = null;
function heartPlain(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  if (plainTexture) return plainTexture;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#0a1220';
  ctx.fillRect(0, 0, size, size);

  let seed = 424242;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  // srdce: klasická parametrická křivka, převrácená do canvasových souřadnic
  const scale = 7.6;
  const cx = size / 2;
  const cy = size / 2 + 22;
  const heart = (t: number): [number, number] => {
    const x = 16 * Math.sin(t) ** 3;
    const y =
      13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [cx + x * scale, cy - y * scale];
  };

  // měkký okraj: šest soustředných srdcí s klesající průhledností.
  // `ctx.filter = 'blur()'` by byl kratší, ale v headless Chromiu se
  // chová podle verze — tenhle postup je deterministický všude.
  for (let ring = 6; ring >= 1; ring -= 1) {
    const grow = 1 + ring * 0.035;
    ctx.beginPath();
    for (let i = 0; i <= 180; i += 1) {
      const [x, y] = heart((i / 180) * Math.PI * 2);
      const px = cx + (x - cx) * grow;
      const py = cy + (y - cy) * grow;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(176, 202, 228, ${0.05 + (6 - ring) * 0.012})`;
    ctx.fill();
  }

  ctx.beginPath();
  for (let i = 0; i <= 180; i += 1) {
    const [x, y] = heart((i / 180) * Math.PI * 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const fill = ctx.createRadialGradient(cx, cy - 40, 20, cx, cy, 240);
  fill.addColorStop(0, 'rgba(214, 231, 246, 0.92)');
  fill.addColorStop(0.55, 'rgba(176, 202, 228, 0.72)');
  fill.addColorStop(1, 'rgba(120, 150, 184, 0.35)');
  ctx.fillStyle = fill;
  ctx.fill();

  // krátery a popraskaný led — jen uvnitř srdce
  ctx.save();
  ctx.clip();
  for (let i = 0; i < 90; i += 1) {
    const angle = rand() * Math.PI * 2;
    const radius = Math.sqrt(rand()) * 250;
    const x = cx + Math.cos(angle) * radius;
    const y = cy - 30 + Math.sin(angle) * radius * 0.9;
    const r = 3 + rand() * 16;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(52, 76, 108, ${0.05 + rand() * 0.16})`;
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 26; i += 1) {
    let x = cx + (rand() - 0.5) * 300;
    let y = cy + (rand() - 0.5) * 300;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s += 1) {
      x += (rand() - 0.5) * 46;
      y += (rand() - 0.5) * 46;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();

  // vnější led — jemné šumové plochy
  for (let i = 0; i < 220; i += 1) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 4 + rand() * 26;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(120, 160, 210, ${0.02 + rand() * 0.05})`;
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  plainTexture = texture;
  return texture;
}

const SNOW_COUNT = 320;

/** Sníh, který se veze s hráčem — jinak by v dálce nic nelétalo. */
function Snow({ pos }: { pos: { current: { x: number; z: number } } }) {
  const points = useRef<THREE.Points>(null);
  const texture = softSprite();
  const geometry = useMemo(() => {
    const positions = new Float32Array(SNOW_COUNT * 3);
    let seed = 20261111;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    for (let i = 0; i < SNOW_COUNT; i += 1) {
      positions[i * 3] = (rand() - 0.5) * 70;
      positions[i * 3 + 1] = rand() * 14;
      positions[i * 3 + 2] = (rand() - 0.5) * 70;
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return buffer;
  }, []);
  const clock = useRef(0);

  useFrame((_, delta) => {
    if (isGamePaused()) return;
    const node = points.current;
    if (!node) return;
    clock.current += Math.min(0.05, delta);
    node.position.set(pos.current.x, 0, pos.current.z);
    node.rotation.y = clock.current * 0.02;
    const attribute = geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;
    for (let i = 0; i < SNOW_COUNT; i += 1) {
      const index = i * 3 + 1;
      array[index] -= 1.6 * Math.min(0.05, delta);
      if (array[index] < 0) array[index] += 14;
    }
    attribute.needsUpdate = true;
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        map={texture ?? undefined}
        color="#cfe0f2"
        size={0.32}
        sizeAttenuation
        transparent
        opacity={0.5}
        depthWrite={false}
        alphaTest={0.01}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/** Ledové kry mimo srdce — dávají pláni hloubku (1 draw call). */
function Shards() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => {
    const items: { x: number; z: number; s: number; r: number }[] = [];
    let seed = 777;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    for (let i = 0; i < 70; i += 1) {
      const angle = rand() * Math.PI * 2;
      const radius = 58 + rand() * 42;
      items.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        s: 0.6 + rand() * 2.2,
        r: rand() * Math.PI,
      });
    }
    return items;
  }, []);

  useFrame(() => {
    const node = mesh.current;
    if (!node || node.userData.ready) return;
    const dummy = new THREE.Object3D();
    seeds.forEach((item, index) => {
      dummy.position.set(item.x, item.s * 0.35, item.z);
      dummy.rotation.set(item.r * 0.12, item.r, item.r * 0.2);
      dummy.scale.set(item.s, item.s * 1.8, item.s * 0.7);
      dummy.updateMatrix();
      node.setMatrixAt(index, dummy.matrix);
    });
    node.instanceMatrix.needsUpdate = true;
    node.userData.ready = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 70]} frustumCulled={false}>
      <dodecahedronGeometry args={[0.5, 0]} />
      <meshStandardMaterial color="#5f7796" roughness={0.72} metalness={0.08} flatShading />
    </instancedMesh>
  );
}

export function PlutoScene({
  running,
  xr = false,
  onStats,
  onFinish,
}: {
  running: boolean;
  xr?: boolean;
  onStats: (stats: PlutoStats) => void;
  onFinish: (result: LightResult) => void;
}) {
  const { camera, scene } = useThree();
  const state = useRef<LightState>(createLight());
  const keys = useRef<Set<string>>(new Set());
  const walker = useRef<THREE.Group>(null);
  const lampRefs = useRef<{ glass: THREE.MeshStandardMaterial | null; halo: THREE.Sprite | null; light: THREE.PointLight | null }[]>(
    [],
  );
  const shuttleGlow = useRef<THREE.Sprite>(null);
  const posRef = useMemo(() => ({ current: { x: 0, z: 0 } }), []);
  const finished = useRef(false);
  const statsClock = useRef(0);
  const lastStats = useRef('');
  const calm = useRef(false);
  const camPos = useMemo(() => new THREE.Vector3(), []);
  const camLook = useMemo(() => new THREE.Vector3(), []);
  const texture = softSprite();
  const ground = heartPlain();
  const fog = useMemo(() => new THREE.Fog(new THREE.Color('#0a1220'), 60, 190), []);
  const background = useMemo(() => new THREE.Color('#05080f'), []);

  useEffect(() => {
    calm.current = reducedMotion();
  }, []);

  useEffect(() => {
    scene.background = background;
    scene.fog = fog;
    return () => {
      scene.background = null;
      scene.fog = null;
    };
  }, [scene, background, fog]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const down = (event: KeyboardEvent) => {
      keys.current.add(event.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    const release = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', release);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', release);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    state.current = createLight();
    finished.current = false;
    lastStats.current = '';
    statsClock.current = 0;
    return () => {
      keys.current.clear();
    };
  }, [running]);

  // debug háček pro headless audit (`?plutoDebug=1`)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('plutoDebug') !== '1') return;
    (window as unknown as Record<string, unknown>).__plutoDebug = {
      state: () => {
        const current = state.current;
        return {
          x: Math.round(current.x * 10) / 10,
          z: Math.round(current.z * 10) / 10,
          warmth: Math.round(current.warmth * 10) / 10,
          lamps: current.litCount,
          channel: Math.round(current.channel * 100) / 100,
          end: current.end,
          score: scoreOf(current),
        };
      },
      teleport: (x: number, z: number) => {
        state.current.x = x;
        state.current.z = z;
      },
      freeze: (amount = 100) => {
        state.current.warmth = Math.max(0, state.current.warmth - amount);
      },
      // pozice lamp pro audit — test se nemá učit mapu nazpaměť
      lamps: LAMPS.map((lamp) => ({ id: lamp.id, x: lamp.x, z: lamp.z })),
    };
  }, []);

  useFrame((_, delta) => {
    if (!running) return;
    const current = state.current;
    const paused = isGamePaused();

    if (!paused && !current.end) {
      const dt = Math.min(0.05, delta);
      const mx =
        (keys.current.has('KeyD') || keys.current.has('ArrowRight') ? 1 : 0) -
        (keys.current.has('KeyA') || keys.current.has('ArrowLeft') ? 1 : 0);
      const mz =
        (keys.current.has('KeyS') || keys.current.has('ArrowDown') ? 1 : 0) -
        (keys.current.has('KeyW') || keys.current.has('ArrowUp') ? 1 : 0);
      stepLight(current, { mx, mz }, dt);

      for (const event of current.events) {
        if (event.kind === 'lit') play('shrineOpen');
        else if (event.kind === 'cold') play('gust');
        else if (event.kind === 'warm') play('lightPickup');
        else if (event.kind === 'complete') play('victory');
        else if (event.kind === 'frozen') play('over');
      }

      if (current.end && !finished.current) {
        finished.current = true;
        onFinish(resultOf(current));
      }
    }

    posRef.current.x = current.x;
    posRef.current.z = current.z;

    // ── chodec ───────────────────────────────────────────────────────
    const node = walker.current;
    if (node) {
      node.position.set(current.x, 0, current.z);
      const speed = Math.hypot(current.vx, current.vz);
      if (speed > 0.4) {
        // model míří +Z, takže úhel je atan2(x, z)
        node.rotation.y = Math.atan2(current.vx, current.vz);
      }
      node.rotation.z = calm.current ? 0 : Math.sin(current.time * 7) * Math.min(0.09, speed * 0.012);
      node.visible = current.end !== 'frozen';
    }

    // ── lampy ────────────────────────────────────────────────────────
    for (let i = 0; i < LAMPS.length; i += 1) {
      const parts = lampRefs.current[i];
      if (!parts) continue;
      const lit = current.lit[i];
      const flicker = calm.current ? 1 : 1 + Math.sin(current.time * 3.1 + i) * 0.06;
      if (parts.glass) {
        parts.glass.color.set(lit ? '#ffe9b8' : '#33415c');
        parts.glass.emissive.set(lit ? '#ffb347' : '#000000');
        parts.glass.emissiveIntensity = lit ? 1.7 * flicker : 0;
      }
      if (parts.halo) parts.halo.visible = lit;
      if (parts.light) parts.light.intensity = lit ? 2.4 * flicker : 0;
    }

    if (shuttleGlow.current) {
      shuttleGlow.current.material.opacity = 0.3 + Math.sin(current.time * 1.4) * 0.05;
    }

    // ── kamera ───────────────────────────────────────────────────────
    if (!xr) {
      camPos.set(current.x + 1.5, 42, current.z + 28);
      camera.position.lerp(camPos, dampFactor(delta, 4.5));
      camLook.set(current.x, 0, current.z - 2);
      camera.lookAt(camLook);
    }

    // ── telemetrie 10×/s ─────────────────────────────────────────────
    statsClock.current += delta;
    if (statsClock.current >= 0.1) {
      statsClock.current = 0;
      const next = nextLamp(current);
      const near = nearestWarm(current);
      const stats: PlutoStats = {
        x: Math.round(current.x * 10) / 10,
        z: Math.round(current.z * 10) / 10,
        warmth: Math.round(current.warmth),
        lamps: current.litCount,
        totalLamps: LAMP_COUNT,
        warmDistance: Math.round(near.distance * 10) / 10,
        channel: Math.round(current.channel * 100) / 100,
        channelId: current.channelId,
        reach: reachOf(current),
        score: scoreOf(current),
        elapsed: Math.round(current.time * 10) / 10,
        end: current.end,
        nextDx: next ? Math.round(next.dx * 10) / 10 : null,
        nextDz: next ? Math.round(next.dz * 10) / 10 : null,
        nextDistance: next ? Math.round(next.distance * 10) / 10 : null,
        nextId: next ? next.id : null,
        litMask: current.lit.slice(),
        vx: Math.round(current.vx * 100) / 100,
        vz: Math.round(current.vz * 100) / 100,
        event: current.lastEvent ? current.lastEvent.kind : null,
        eventId: current.eventId,
      };
      const key = JSON.stringify(stats);
      if (key !== lastStats.current) {
        lastStats.current = key;
        onStats(stats);
      }
    }
  });

  return (
    <>
      <hemisphereLight args={['#9fc4ff', '#05080f', 0.55]} />
      <ambientLight intensity={0.35} color="#bcd4f0" />
      {/* Slunce je odsud jen hvězda — proto jen nízké protisvětlo z jedné strany */}
      <directionalLight position={[-60, 46, 40]} intensity={0.85} color="#cfe6ff" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[220, 220]} />
        <meshStandardMaterial map={ground ?? undefined} color="#ffffff" roughness={0.94} metalness={0.02} />
      </mesh>

      <Shards />
      <Snow pos={posRef} />

      {/* přistávací modul — světlý, protože kov bez env mapy je černý */}
      <group position={[SHUTTLE.x, 0, SHUTTLE.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
          <ringGeometry args={[3.1, 3.7, 32]} />
          <meshBasicMaterial color="#7fe3d4" transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 2.1, 0]}>
          <cylinderGeometry args={[1.5, 1.75, 2.6, 10]} />
          <meshStandardMaterial color="#b9c9dd" metalness={0.18} roughness={0.55} emissive="#16243a" emissiveIntensity={0.7} />
        </mesh>
        <mesh position={[0, 3.9, 0]}>
          <sphereGeometry args={[1.42, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#cfdcec" metalness={0.2} roughness={0.42} emissive="#1b2c44" emissiveIntensity={0.8} />
        </mesh>
        <mesh position={[0, 1.35, 0]}>
          <cylinderGeometry args={[1.52, 1.52, 0.3, 10, 1, true]} />
          <meshBasicMaterial color="#ffd9a0" side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        {[0, 1, 2, 3].map((leg) => {
          const angle = (leg / 4) * Math.PI * 2 + Math.PI / 4;
          return (
            <mesh
              key={leg}
              position={[Math.cos(angle) * 1.6, 0.55, Math.sin(angle) * 1.6]}
              rotation={[Math.cos(angle) * 0.32, 0, -Math.sin(angle) * 0.32]}
            >
              <cylinderGeometry args={[0.08, 0.08, 1.3, 6]} />
              <meshStandardMaterial color="#8fa3bd" metalness={0.25} roughness={0.5} />
            </mesh>
          );
        })}
        <mesh position={[1.2, 4.3, 0.2]}>
          <sphereGeometry args={[0.24, 10, 10]} />
          <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
        </mesh>
        <sprite ref={shuttleGlow} position={[0, 2.6, 0]} scale={[13, 13, 1]}>
          <spriteMaterial
            map={texture ?? undefined}
            color="#ffc477"
            transparent
            opacity={0.3}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <pointLight position={[0, 2.6, 0]} color="#ffc477" intensity={4} distance={26} decay={2} />
      </group>

      {/* lampy */}
      {LAMPS.map((lamp, index) => (
        <group key={lamp.id} position={[lamp.x, 0, lamp.z]}>
          <mesh position={[0, 2.2, 0]}>
            <cylinderGeometry args={[0.16, 0.24, 4.4, 8]} />
            <meshStandardMaterial color="#4a5a74" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, 4.6, 0]}>
            <sphereGeometry args={[0.72, 14, 14]} />
            <meshStandardMaterial
              ref={(node) => {
                lampRefs.current[index] = {
                  ...(lampRefs.current[index] ?? { halo: null, light: null }),
                  glass: node,
                };
              }}
              color="#33415c"
              emissive="#000000"
              emissiveIntensity={0}
              roughness={0.3}
            />
          </mesh>
          <mesh position={[0, 5.5, 0]}>
            <coneGeometry args={[0.44, 0.5, 8]} />
            <meshStandardMaterial color="#5d6f8c" metalness={0.5} roughness={0.5} />
          </mesh>
          <sprite
            ref={(node) => {
              lampRefs.current[index] = {
                ...(lampRefs.current[index] ?? { glass: null, light: null }),
                halo: node,
              };
            }}
            position={[0, 4.6, 0]}
            scale={[13, 13, 1]}
            visible={false}
          >
            <spriteMaterial
              map={texture ?? undefined}
              color="#ffcf7a"
              transparent
              opacity={0.55}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
          <pointLight
            ref={(node) => {
              lampRefs.current[index] = {
                ...(lampRefs.current[index] ?? { glass: null, halo: null }),
                light: node,
              };
            }}
            position={[0, 4.6, 0]}
            color="#ffbf66"
            intensity={0}
            distance={22}
            decay={2}
          />
        </group>
      ))}

      {/* chodec s lucernou */}
      <group ref={walker} scale={1.25}>
        <mesh position={[0, 0.95, 0]}>
          <capsuleGeometry args={[0.3, 0.75, 6, 10]} />
          <meshStandardMaterial color="#4a6482" roughness={0.62} metalness={0.2} />
        </mesh>
        <mesh position={[0, 1.72, 0]}>
          <sphereGeometry args={[0.26, 12, 12]} />
          <meshStandardMaterial color="#f0dcc6" roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.78, 0.02]}>
          <sphereGeometry args={[0.3, 12, 12]} />
          <meshStandardMaterial color="#1b2638" roughness={0.9} />
        </mesh>
        <mesh position={[0.42, 1.0, 0.28]}>
          <boxGeometry args={[0.3, 0.34, 0.3]} />
          <meshBasicMaterial color="#ffe2a8" toneMapped={false} />
        </mesh>
        <sprite position={[0.42, 1.0, 0.28]} scale={[8, 8, 1]}>
          <spriteMaterial
            map={texture ?? undefined}
            color="#ffd28a"
            transparent
            opacity={0.65}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <pointLight position={[0.42, 1.0, 0.28]} color="#ffca80" intensity={5} distance={20} decay={2} />
      </group>
    </>
  );
}
