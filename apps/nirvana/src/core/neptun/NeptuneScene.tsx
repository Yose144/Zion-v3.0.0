'use client';

/**
 * NEPTUN — HLUBINA. Scéna sestupu.
 *
 * Vykresluje jen to, co simulace (`dive.ts`) řekne — sama žádnou fyziku
 * nepočítá. Svět je ukotvený ve světových souřadnicích (`y = −hloubka`),
 * takže kamera klesá spolu se zvonem a vrstvy kolem ní ubíhají vzhůru.
 *
 * Tři věci, které dělají „hloubku" čitelnou bez HUD:
 *  1. mlha a barva pozadí se **přelévají** mezi vrstvami (modrá → čerň),
 *  2. clony atmosféry proletí kolem kamery každých 70 m,
 *  3. mořský sníh a světelné šmouhy letí vzhůru — jediný pohyb, který drží směr.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { dampFactor } from '@/core/design/motion';
import { isGamePaused } from '@/core/games/pause';
import { play } from '@/core/audio/engine';
import {
  DECKS,
  DEPTH_BOTTOM,
  LANE,
  MOTES,
  VORTICES,
  deckAt,
  deckIndexAt,
} from './world';
import {
  createDive,
  nextMote,
  resultOf,
  scoreOf,
  stepDive,
  type DiveEnd,
  type DiveEventKind,
  type DiveResult,
  type DiveState,
} from './dive';

export interface NeptunStats {
  depth: number;
  energy: number;
  hull: number;
  lights: number;
  totalLights: number;
  wind: number;
  deck: number;
  sink: number;
  score: number;
  elapsed: number;
  end: DiveEnd;
  /** Kompas: vodorovný rozdíl k nejbližšímu světlu (null = všechna sebraná). */
  moteDx: number | null;
  moteDy: number | null;
  event: DiveEventKind | null;
  eventId: number;
}

/** Měkký kruh — jediná textura ve scéně (světla, clony, jiskry). */
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
  gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.36)');
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

const SNOW_COUNT = 420;
const SNOW_SPAN = 34;

/**
 * Clony atmosféry každých 70 m. Nejsou to hranice vrstev (ty jsou v datech
 * světa) — jsou to „mraky", které proletí kolem kamery. Bez nich je mezi
 * dvěma vrstvami 170 m prázdné modré plochy a sestup nemá pohyb.
 */
const SHEETS = Array.from({ length: 12 }, (_, index) => {
  const depth = 70 * (index + 1);
  return { y: -depth, tint: deckAt(depth).tint };
});

/** Mořský sníh: částice padají vzhůru, protože zvon klesá. */
function MarineSnow({ depth }: { depth: { current: number } }) {
  const points = useRef<THREE.Points>(null);
  const texture = softSprite();
  const geometry = useMemo(() => {
    const positions = new Float32Array(SNOW_COUNT * 3);
    let seed = 90210;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    for (let i = 0; i < SNOW_COUNT; i += 1) {
      positions[i * 3] = (rand() - 0.5) * 64;
      positions[i * 3 + 1] = (rand() - 0.5) * SNOW_SPAN * 2;
      positions[i * 3 + 2] = (rand() - 0.5) * 46 - 8;
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return buffer;
  }, []);
  const motion = useRef(0);

  useFrame((_, delta) => {
    if (isGamePaused()) return;
    const attribute = geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;
    const step = Math.min(0.05, delta);
    const drift = 4;
    for (let i = 0; i < SNOW_COUNT; i += 1) {
      const index = i * 3 + 1;
      array[index] += drift * step;
      if (array[index] > SNOW_SPAN) array[index] -= SNOW_SPAN * 2;
    }
    attribute.needsUpdate = true;
    motion.current += step;
    if (points.current) {
      // jemné chvění, aby sníh nepadal jako mřížka
      points.current.rotation.y = Math.sin(motion.current * 0.12) * 0.05;
    }
  });

  useFrame(() => {
    // pole se veze s kamerou — jinak by sníh zůstal u hladiny a v hloubce
    // by nebyl žádný pohyb (přesně to odhalil první screenshot)
    if (points.current) points.current.position.y = -depth.current;
  });

  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        map={texture ?? undefined}
        color="#bfe6ff"
        size={0.55}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
        alphaTest={0.01}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/**
 * Světelné šmouhy — druhý (a poslední) pohybový cue sestupu.
 *
 * Sníh sám nestačí: v modré mlze bez horizontu není poznat, jestli se hýbeš
 * ty, nebo částice. Šmouhy letí vzhůru po celém záběru, takže směr je vidět
 * periferně. Jsou to instanced tenké krabičky (1 draw call), ne sprite
 * textura — ostrá čára čte rychlost lépe než měkká tečka.
 */
function Streaks({ depth, calm }: { depth: { current: number }; calm: { current: boolean } }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(() => {
    const items: { x: number; z: number; y: number; speed: number; len: number }[] = [];
    let seed = 1337;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    for (let i = 0; i < 44; i += 1) {
      items.push({
        x: (rand() - 0.5) * 46,
        z: (rand() - 0.5) * 30 - 4,
        y: (rand() - 0.5) * 44,
        speed: 6 + rand() * 10,
        len: 1.2 + rand() * 2.8,
      });
    }
    return items;
  }, []);

  useFrame((_, delta) => {
    const node = mesh.current;
    if (!node) return;
    const step = Math.min(0.05, delta);
    for (let i = 0; i < seeds.length; i += 1) {
      const item = seeds[i];
      item.y += (calm.current ? 2.2 : item.speed) * step;
      if (item.y > 22) item.y -= 44;
      dummy.position.set(item.x, item.y, item.z);
      dummy.scale.set(1, item.len, 1);
      dummy.updateMatrix();
      node.setMatrixAt(i, dummy.matrix);
    }
    node.instanceMatrix.needsUpdate = true;
    node.position.y = -depth.current;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 44]} frustumCulled={false}>
      <boxGeometry args={[0.035, 1, 0.035]} />
      <meshBasicMaterial
        color="#cfeaff"
        transparent
        opacity={0.26}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}

export function NeptuneScene({
  running,
  xr = false,
  onStats,
  onFinish,
}: {
  running: boolean;
  xr?: boolean;
  onStats: (stats: NeptunStats) => void;
  onFinish: (result: DiveResult) => void;
}) {
  const { camera, scene } = useThree();
  const state = useRef<DiveState>(createDive());
  /** Hloubka pro vrstvy, které se vezou s kamerou (mořský sníh). */
  const depthRef = useMemo(() => ({ current: 0 }), []);
  const keys = useRef<Set<string>>(new Set());
  const bell = useRef<THREE.Group>(null);
  const rope = useRef<THREE.Group>(null);
  const moteGroups = useRef<(THREE.Group | null)[]>([]);
  const vortexGroups = useRef<(THREE.Group | null)[]>([]);
  const finished = useRef(false);
  const statsClock = useRef(0);
  const lastStats = useRef('');
  const calm = useRef(false);
  const fog = useMemo(() => new THREE.Fog(new THREE.Color(DECKS[0].tint), 12, 82), []);
  const background = useMemo(() => new THREE.Color(DECKS[0].tint), []);
  const targetColor = useMemo(() => new THREE.Color(), []);
  const camPos = useMemo(() => new THREE.Vector3(), []);
  const camLook = useMemo(() => new THREE.Vector3(), []);
  const texture = softSprite();

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

  // start / restart sestupu
  useEffect(() => {
    if (!running) return;
    state.current = createDive();
    finished.current = false;
    lastStats.current = '';
    statsClock.current = 0;
    fog.color.set(DECKS[0].tint);
    background.set(DECKS[0].tint);
    for (const group of moteGroups.current) group?.scale.setScalar(1);
    return () => {
      keys.current.clear();
    };
  }, [running, fog, background]);

  // debug háček pro headless audit (`?neptuneDebug=1`)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('neptuneDebug') !== '1') return;
    (window as unknown as Record<string, unknown>).__neptuneDebug = {
      state: () => {
        const current = state.current;
        return {
          depth: Math.round(current.depth * 10) / 10,
          x: Math.round(current.x * 10) / 10,
          energy: Math.round(current.energy * 10) / 10,
          hull: Math.round(current.hull * 10) / 10,
          lights: current.lightCount,
          deck: current.deck,
          end: current.end,
          score: scoreOf(current),
        };
      },
      teleport: (depth: number, x = 0) => {
        state.current.depth = Math.max(0, Math.min(DEPTH_BOTTOM - 1, depth));
        state.current.x = Math.max(-LANE, Math.min(LANE, x));
        state.current.deck = deckIndexAt(state.current.depth);
      },
      drain: (amount = 100) => {
        state.current.energy = Math.max(0, state.current.energy - amount);
      },
    };
  }, []);

  useFrame((_, delta) => {
    if (!running) return;
    const current = state.current;
    const paused = isGamePaused();

    if (!paused && !current.end) {
      const dt = Math.min(0.05, delta);
      const steer =
        (keys.current.has('KeyA') || keys.current.has('ArrowLeft') ? 1 : 0) -
        (keys.current.has('KeyD') || keys.current.has('ArrowRight') ? 1 : 0);
      const dive = keys.current.has('KeyW') || keys.current.has('ArrowUp');
      const brake = keys.current.has('KeyS') || keys.current.has('ArrowDown');
      stepDive(current, { steer, dive, brake }, dt);

      for (const event of current.events) {
        if (event.kind === 'light') play('lightPickup');
        else if (event.kind === 'vortex') play('gust');
        else if (event.kind === 'wall') play('wall');
        else if (event.kind === 'deck') play('splash');
        else if (event.kind === 'bottom') play('shrineOpen');
        else if (event.kind === 'hull') play('error');
        else if (event.kind === 'lantern') play('over');
      }

      if (current.end && !finished.current) {
        finished.current = true;
        onFinish(resultOf(current));
      }
    }

    depthRef.current = current.depth;

    // ── barva hloubky ────────────────────────────────────────────────
    const deck = DECKS[deckIndexAt(current.depth)];
    targetColor.set(deck.tint);
    fog.color.lerp(targetColor, calm.current ? 0.25 : Math.min(1, delta * 1.4));
    // pozadí je o pár procent tmavší než mlha — jinak je celý záběr jedna
    // plocha a clony se v něm ztratí. Ztmavuje se v **sRGB** prostoru:
    // násobení v lineárním (three ho má defaultně) vypadá skoro bez efektu.
    background.copy(fog.color).convertLinearToSRGB().multiplyScalar(0.8).convertSRGBToLinear();
    // s hloubkou se mlha stahuje — v hlubině je vidět jen na pár metrů
    const ratio = current.depth / DEPTH_BOTTOM;
    fog.near = 12 - ratio * 6;
    fog.far = 82 - ratio * 46;

    // ── zvon ─────────────────────────────────────────────────────────
    const bellGroup = bell.current;
    if (bellGroup) {
      bellGroup.position.set(current.x, -current.depth, 0);
      const roll = -current.vx * 0.026;
      const pitch = (current.sink / 17) * 0.16 - 0.08;
      bellGroup.rotation.set(pitch, 0, roll);
      bellGroup.visible = current.hull > 0;
    }
    if (rope.current) {
      rope.current.position.set(current.x * 0.96, -current.depth + 6.4, 0);
      rope.current.rotation.z = -current.vx * 0.012;
    }

    // ── světla ───────────────────────────────────────────────────────
    for (let i = 0; i < MOTES.length; i += 1) {
      const group = moteGroups.current[i];
      if (!group) continue;
      const taken = current.collected[i];
      group.visible = !taken;
      if (taken) continue;
      const pulse = calm.current ? 1 : 1 + Math.sin(current.time * 2.4 + i) * 0.14;
      group.scale.setScalar(pulse);
    }

    // ── víry ─────────────────────────────────────────────────────────
    for (let i = 0; i < VORTICES.length; i += 1) {
      const group = vortexGroups.current[i];
      if (!group) continue;
      const spin = VORTICES[i].spin * (calm.current ? 0.2 : 1);
      group.rotation.z += delta * spin * 0.9;
      group.rotation.y += delta * spin * 0.35;
    }

    // ── kamera ───────────────────────────────────────────────────────
    if (!xr) {
      camPos.set(current.x * 0.5 + 1.6, -current.depth + 1.0, 9.4);
      camera.position.lerp(camPos, dampFactor(delta, 5));
      camLook.set(current.x * 0.45, -current.depth - 2.6, 0);
      camera.lookAt(camLook);
    }

    // ── telemetrie 10×/s ─────────────────────────────────────────────
    statsClock.current += delta;
    if (statsClock.current >= 0.1) {
      statsClock.current = 0;
      const next = nextMote(current);
      const stats: NeptunStats = {
        depth: Math.round(current.depth),
        energy: Math.round(current.energy),
        hull: Math.round(current.hull),
        lights: current.lightCount,
        totalLights: MOTES.length,
        wind: Math.round(current.wind * 10) / 10,
        deck: current.deck,
        sink: Math.round(current.sink * 10) / 10,
        score: scoreOf(current),
        elapsed: Math.round(current.time * 10) / 10,
        end: current.end,
        moteDx: next ? Math.round(next.dx * 10) / 10 : null,
        moteDy: next ? Math.round(next.dy * 10) / 10 : null,
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
      <ambientLight intensity={0.55} color="#9fc4ff" />
      <hemisphereLight args={['#8fc4ff', '#040814', 0.65]} />
      <directionalLight position={[6, 40, 12]} intensity={1.1} color="#dff0ff" />

      <MarineSnow depth={depthRef} />
      <Streaks depth={depthRef} calm={calm} />

      {/* clony — proletí kolem kamery a řeknou, že klesáš. Nejsou jen na
          hranicích vrstev: mezi nimi by bylo 170 m prázdna a sestup by
          vypadal jako statická modrá plocha. */}
      {SHEETS.map((sheet) => (
        <mesh key={sheet.y} position={[0, sheet.y, -6]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[210, 150]} />
          <meshBasicMaterial
            color={sheet.tint}
            transparent
            opacity={0.2}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* stěny proudu po stranách uličky */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (LANE + 1.4), -DEPTH_BOTTOM / 2, -4]} rotation={[0, side * 0.06, 0]}>
          <planeGeometry args={[2.4, DEPTH_BOTTOM + 60]} />
          <meshBasicMaterial
            color="#5f9bff"
            transparent
            opacity={0.055}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* hloubkové značky každých 100 m */}
      {Array.from({ length: 9 }, (_, index) => -100 * (index + 1)).map((y) => (
        <mesh key={y} position={[0, y, -4]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[LANE + 1.2, 0.05, 6, 48]} />
          <meshBasicMaterial color="#a8d4ff" transparent opacity={0.16} depthWrite={false} />
        </mesh>
      ))}

      {/* světla */}
      {MOTES.map((mote, index) => (
        <group
          key={mote.id}
          ref={(node) => {
            moteGroups.current[index] = node;
          }}
          position={[mote.x, -mote.depth, 0]}
        >
          <sprite scale={[5.4, 5.4, 1]}>
            <spriteMaterial
              map={texture ?? undefined}
              color="#9ff4ff"
              transparent
              opacity={0.9}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
          <mesh>
            <sphereGeometry args={[0.34, 12, 12]} />
            <meshBasicMaterial color="#e8ffff" toneMapped={false} />
          </mesh>
          <pointLight color="#8ff0ff" intensity={2.2} distance={12} decay={2} />
        </group>
      ))}

      {/* víry */}
      {VORTICES.map((vortex, index) => (
        <group
          key={vortex.id}
          ref={(node) => {
            vortexGroups.current[index] = node;
          }}
          position={[vortex.x, -vortex.depth, -1]}
        >
          <mesh>
            <torusGeometry args={[vortex.radius, 0.34, 8, 40]} />
            <meshBasicMaterial color="#27407a" transparent opacity={0.85} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[vortex.radius * 0.92, 32]} />
            <meshBasicMaterial color="#050a18" transparent opacity={0.72} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 3]}>
            <torusGeometry args={[vortex.radius * 0.62, 0.14, 6, 28]} />
            <meshBasicMaterial color="#3d63b8" transparent opacity={0.5} />
          </mesh>
        </group>
      ))}

      {/* lano ke draku — jenž drží zvon nad oparem */}
      <group ref={rope}>
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.05, 12, 6]} />
          <meshBasicMaterial color="#cfe6ff" transparent opacity={0.35} />
        </mesh>
      </group>

      {/* zvon */}
      <group ref={bell}>
        <mesh>
          <sphereGeometry args={[1.12, 24, 20]} />
          <meshStandardMaterial
            color="#9fd0ff"
            metalness={0.4}
            roughness={0.1}
            transparent
            opacity={0.17}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.06, 0.075, 8, 24]} />
          <meshStandardMaterial color="#8fb4d8" metalness={0.85} roughness={0.3} />
        </mesh>
        <mesh position={[0, -1.08, 0]}>
          <cylinderGeometry args={[0.78, 0.5, 0.42, 20]} />
          <meshStandardMaterial color="#5c7ba0" metalness={0.7} roughness={0.45} />
        </mesh>
        <mesh position={[0, 0.62, 0]}>
          <sphereGeometry args={[0.2, 10, 10]} />
          <meshBasicMaterial color="#cfeaff" />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.3, 14, 14]} />
          <meshBasicMaterial color="#dffbff" toneMapped={false} />
        </mesh>
        <sprite scale={[5.6, 5.6, 1]}>
          <spriteMaterial
            map={texture ?? undefined}
            color="#8ff0ff"
            transparent
            opacity={0.55}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
        <pointLight color="#8ff0ff" intensity={9} distance={26} decay={2} />
      </group>
    </>
  );
}
