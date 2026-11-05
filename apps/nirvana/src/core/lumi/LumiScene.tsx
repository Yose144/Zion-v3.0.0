'use client';

/**
 * KŘÍDLA — scéna a herní smyčka.
 *
 * Vizuál drží tři pravidla, která dělají „Sky pocit":
 *  1. **Hloubka je jen kulisa.** Hra se odehrává v rovině (x, y); `z` mají
 *     jen ostrovy a mraky, aby obloha nebyla placatá.
 *  2. **Světlo je vždy vidět.** Světla, proudy a svatyně mají aditivní
 *     materiál — nespoléhají na osvětlení scény, takže svítí i v mlze.
 *  3. **Nic nebliká agresivně.** Pulsy jsou pomalé (sin o 0,6–1,4 Hz),
 *     protože hra je o klidu, ne o pozornosti.
 *
 * Simulace je v `flight.ts`; tady se jen čte a kreslí.
 */

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  ENERGY_MAX,
  createFlight,
  currentAt,
  stepFlight,
  type FlightInput,
  type FlightState,
} from './flight';
import { LUMI_HEIGHT, LUMI_WIDTH, type LumiLight, type LumiPath } from './world';
import { play, playTone } from '@/core/audio/engine';

/** Jeden vzdálený letec (relay ze serveru). */
export interface LumiRemote {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  finished: boolean;
}

export interface LumiStats {
  lights: number;
  /** Rychlost letu (pro zvuk větru a HUD). */
  speed: number;
  /** Id sebraných světel (deník je potřebuje, ne jen počet). */
  lightIds: number[];
  total: number;
  energy: number;
  time: number;
  finished: boolean;
  /** Naposledy sebrané světlo (id) — stránka podle něj ukáže text. */
  lastLight: number | null;
}

const KEY_MAP: Record<string, keyof FlightInput> = {
  ArrowUp: 'up',
  KeyW: 'up',
  Space: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

/**
 * Měkká kruhová textura (radiální přechod) pro mraky a proudy.
 *
 * Koule s průhledností měla tvrdý okraj — vypadala jako bublina, ne mrak.
 * Jeden canvas s přechodem vyřeší obojí a je to jediná textura ve scéně.
 */
let softTexture: THREE.Texture | null = null;
function softSpriteTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  if (softTexture) return softTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.35)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  softTexture = texture;
  return texture;
}

/** Hvězdy — jedna geometrie, žádný shader. */
function Stars() {
  const geometry = useMemo(() => {
    const count = 900;
    const positions = new Float32Array(count * 3);
    let seed = 4242;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = rand() * LUMI_WIDTH * 1.6 - LUMI_WIDTH * 0.3;
      positions[i * 3 + 1] = rand() * LUMI_HEIGHT * 1.3 - LUMI_HEIGHT * 0.15;
      positions[i * 3 + 2] = -40 - rand() * 60;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.5} color="#dff3ff" sizeAttenuation transparent opacity={0.75} />
    </points>
  );
}

/** Mraky — pár velkých měkkých koulí, které se pomalu posouvají. */
function Clouds() {
  const group = useRef<THREE.Group>(null);
  const puffs = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => ({
        x: (index * 13.7) % LUMI_WIDTH,
        y: 16 + ((index * 29) % 70),
        z: -14 - (index % 4) * 6,
        r: 7 + (index % 3) * 3,
        speed: 0.25 + (index % 5) * 0.08,
      })),
    [],
  );

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.children.forEach((child, index) => {
      const puff = puffs[index];
      if (!puff) return;
      child.position.x += puff.speed * delta;
      if (child.position.x > LUMI_WIDTH + 12) child.position.x = -12;
    });
  });

  const texture = softSpriteTexture();
  return (
    <group ref={group}>
      {puffs.map((puff, index) => (
        <sprite key={index} position={[puff.x, puff.y, puff.z]} scale={[puff.r * 5, puff.r * 3.2, 1]}>
          <spriteMaterial
            map={texture ?? undefined}
            color="#9fd8e4"
            transparent
            opacity={0.18}
            depthWrite={false}
            blending={THREE.NormalBlending}
          />
        </sprite>
      ))}
    </group>
  );
}

/** Ostrov: placka z ledu s jemným okrajem. */
function Island({ x, y, z, r, tone }: { x: number; y: number; z: number; r: number; tone: string }) {
  return (
    <group position={[x, y, z]}>
      <mesh scale={[1, 0.22, 1]}>
        <sphereGeometry args={[r, 28, 18]} />
        <meshStandardMaterial color={tone} roughness={0.5} metalness={0.2} emissive={tone} emissiveIntensity={0.18} />
      </mesh>
      {/* spodní kužel — bez něj ostrov vypadá jako placka ve vzduchu */}
      <mesh position={[0, -r * 0.22, 0]}>
        <coneGeometry args={[r * 0.82, r * 0.46, 22]} />
        <meshStandardMaterial color="#8fb8c0" roughness={0.75} metalness={0.1} transparent opacity={0.7} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]}>
        <ringGeometry args={[r * 0.86, r * 1.02, 48]} />
        <meshBasicMaterial color="#cdeff1" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

/**
 * Proud vzduchu — stoupající jiskry, ne trubice.
 *
 * První verze byl průhledný válec, ale z kamery vypadal jako šedý sloup
 * (tvrdý okraj, žádné proudění). Jiskry řeknou „tudy proudí vzduch" samy.
 */
function Current({ x, y, r, lift }: { x: number; y: number; r: number; lift: number }) {
  const group = useRef<THREE.Group>(null);
  const texture = softSpriteTexture();
  const sparks = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        dx: Math.sin(index * 2.1) * r * 0.6,
        phase: index / 12,
        size: 1.2 + (index % 3) * 0.5,
      })),
    [r],
  );

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.children.forEach((child, index) => {
      const spark = sparks[index];
      if (!spark) return;
      const climb = ((spark.phase + t * (0.12 + lift * 0.002)) % 1) * 34 - 17;
      child.position.y = climb;
      child.position.x = spark.dx + Math.sin(t * 0.8 + index) * 0.6;
    });
  });

  return (
    <group ref={group} position={[x, y, -2]}>
      {sparks.map((spark, index) => (
        <sprite key={index} scale={[spark.size, spark.size, 1]}>
          <spriteMaterial
            map={texture ?? undefined}
            color="#a8f4e6"
            transparent
            opacity={0.5}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
    </group>
  );
}

/** Světlo — koule s pulsem a malým bodovým světlem. */
function Light({ light, taken }: { light: LumiLight; taken: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    group.current.scale.setScalar(taken ? 0 : 1 + Math.sin(t * 1.4 + light.id) * 0.12);
    group.current.position.y = light.y + Math.sin(t * 0.8 + light.id) * 0.6;
  });
  const texture = softSpriteTexture();
  return (
    <group ref={group} position={[light.x, light.y, light.z]}>
      <mesh>
        <sphereGeometry args={[0.55, 16, 12]} />
        <meshBasicMaterial color="#fffaf0" toneMapped={false} />
      </mesh>
      {/* billboardová záře: koule s průhledností měla tmavý obrys */}
      <sprite scale={[7, 7, 1]}>
        <spriteMaterial
          map={texture ?? undefined}
          color="#ffd98a"
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <pointLight intensity={4} distance={14} color="#ffe9b0" />
    </group>
  );
}

/** Svatyně — oblouk, který se rozsvítí, až máš všechna světla. */
function Shrine({ open, shrine }: { open: boolean; shrine: LumiPath['shrine'] }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * 0.2;
  });
  return (
    <group position={[shrine.x, shrine.y, 0]}>
      <mesh ref={ring}>
        <torusGeometry args={[shrine.r * 0.8, 0.45, 12, 48]} />
        <meshBasicMaterial color={open ? '#ffe9a8' : '#7f9aa8'} toneMapped={false} transparent opacity={open ? 0.95 : 0.35} />
      </mesh>
      <mesh>
        <circleGeometry args={[shrine.r * 0.8, 36]} />
        <meshBasicMaterial
          color={open ? '#ffd166' : '#4d6fd1'}
          transparent
          opacity={open ? 0.2 : 0.08}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

/**
 * LUMI — děvčátko s lucernou.
 *
 * Postava je z primitiv (v repu není lidský model a primitiva stačí: silueta
 * holčičky s kšiltem a lucernou se čte z každé dálky). **Lucerna je skutečný
 * model** z `public/models/lampion.glb` — ten, který vznikl pro Království
 * srdce. Je těžký (4,3 MB, ~250k trojúhelníků), takže se načítá lazy a
 * scéna má pro něj `Suspense`; do té doby svítí primitivní náhrada.
 */
function LanternModel() {
  const { scene } = useGLTF('/models/lampion.glb');
  const model = useMemo(() => {
    const clone = scene.clone(true);
    // Model je v metrech a neznámé velikosti — normalizuje se podle bounding
    // boxu na výšku 0,55 jednotky, aby seděl do ručky.
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = size.y > 0 ? 0.55 / size.y : 1;
    clone.scale.setScalar(scale);
    clone.position.set(0, -size.y * scale * 0.5, 0);
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (material) {
        material.emissive = new THREE.Color('#ffd98a');
        material.emissiveIntensity = 0.35;
        material.roughness = 0.55;
        material.metalness = Math.min(0.6, material.metalness ?? 0.3);
      }
    });
    return clone;
  }, [scene]);
  return <primitive object={model} />;
}

/** Náhrada, když se model ještě načítá (nebo selže) — stejná silueta. */
function LanternFallback() {
  return (
    <group>
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[0.26, 0.06, 0.26]} />
        <meshStandardMaterial color="#c9a55c" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.22, 0.3, 0.22]} />
        <meshStandardMaterial color="#ffd98a" emissive="#ffd166" emissiveIntensity={1.4} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, -0.17, 0]}>
        <boxGeometry args={[0.26, 0.05, 0.26]} />
        <meshStandardMaterial color="#c9a55c" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

/**
 * Lucerna v ruce: model + teplé světlo.
 *
 * Model má ~250 000 trojúhelníků (změřeno: scéna 259k tris, 128 draw calls,
 * 60 fps na M1). Na telefonu je to zbytečné — `detail=false` použije
 * primitivní náhradu, která vypadá stejně a nestojí nic.
 */
function Lantern({ energy, detail }: { energy: number; detail: boolean }) {
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!light.current) return;
    const flicker = 0.85 + Math.sin(clock.elapsedTime * 7.3) * 0.06 + Math.sin(clock.elapsedTime * 2.1) * 0.05;
    light.current.intensity = (2.5 + energy * 0.03) * flicker;
  });
  return (
    <group>
      {detail ? (
        <Suspense fallback={<LanternFallback />}>
          <LanternModel />
        </Suspense>
      ) : (
        <LanternFallback />
      )}
      <pointLight ref={light} intensity={4} distance={14} color="#ffd9a0" />
    </group>
  );
}

/**
 * Hráčka: holčička v šatech, s vlasy a lucernou v ruce.
 *
 * Všechno je z primitiv a drží se **jednoho měřítka** (postava 1 jednotka),
 * aby se dala snadno přebarvit nebo vyměnit za model, až bude.
 */
function Lumi({ state, detail }: { state: React.MutableRefObject<FlightState>; detail: boolean }) {
  const group = useRef<THREE.Group>(null);
  const lantern = useRef<THREE.Group>(null);
  const trail = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const history = useRef<{ x: number; y: number }[]>([]);

  useFrame(({ clock }) => {
    const flight = state.current;
    const tilt = Math.max(-0.45, Math.min(0.45, flight.vy / 45));
    if (group.current) {
      group.current.position.set(flight.x, flight.y, 2);
      group.current.rotation.z = -tilt;
      group.current.rotation.y = flight.vx >= 0 ? 0.25 : -0.25;
      // jemné nadnášení — postava nikdy nestojí dokonale rovně
      group.current.position.y += Math.sin(clock.elapsedTime * 1.6) * 0.12;
    }
    if (lantern.current) {
      // lucerna se houpe protisměrně k pohybu, jako když ji nese v ruce
      lantern.current.rotation.z = tilt * 0.9 + Math.sin(clock.elapsedTime * 1.9) * 0.08;
    }

    // stopa: posledních 18 pozic jako jiskry z lucerny
    history.current.push({ x: flight.x, y: flight.y });
    if (history.current.length > 18) history.current.shift();
    if (trail.current) {
      history.current.forEach((point, index) => {
        const k = index / history.current.length;
        tmp.position.set(point.x, point.y - 0.4, 1.7);
        tmp.scale.setScalar(0.12 + k * 0.3);
        tmp.rotation.set(0, 0, 0);
        tmp.updateMatrix();
        trail.current!.setMatrixAt(index, tmp.matrix);
      });
      for (let i = history.current.length; i < 18; i += 1) {
        tmp.position.set(0, 0, -1000);
        tmp.updateMatrix();
        trail.current.setMatrixAt(i, tmp.matrix);
      }
      trail.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <group ref={group} scale={1.6}>
        {/* šaty — kužel, který dává siluetu do dálky */}
        <mesh position={[0, -0.28, 0]}>
          <coneGeometry args={[0.42, 0.95, 14]} />
          <meshStandardMaterial color="#e8dcc4" roughness={0.85} emissive="#7fe3d4" emissiveIntensity={0.06} />
        </mesh>
        {/* trup */}
        <mesh position={[0, 0.22, 0]}>
          <capsuleGeometry args={[0.19, 0.24, 6, 12]} />
          <meshStandardMaterial color="#dfd2b8" roughness={0.8} />
        </mesh>
        {/* hlava */}
        <mesh position={[0, 0.56, 0]}>
          <sphereGeometry args={[0.2, 18, 14]} />
          <meshStandardMaterial color="#f2d9bd" roughness={0.7} />
        </mesh>
        {/* vlasy — koule seříznutá nad obočím + drdol */}
        <mesh position={[0, 0.6, -0.02]}>
          <sphereGeometry args={[0.215, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color="#3b2a24" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.78, -0.06]}>
          <sphereGeometry args={[0.11, 12, 10]} />
          <meshStandardMaterial color="#3b2a24" roughness={0.95} />
        </mesh>
        {/* paže: levá volně, pravá drží lucernu */}
        <mesh position={[-0.24, 0.16, 0]} rotation={[0, 0, 0.5]}>
          <capsuleGeometry args={[0.055, 0.34, 4, 8]} />
          <meshStandardMaterial color="#e8dcc4" roughness={0.85} />
        </mesh>
        <mesh position={[0.24, 0.1, 0]} rotation={[0, 0, -0.35]}>
          <capsuleGeometry args={[0.055, 0.3, 4, 8]} />
          <meshStandardMaterial color="#e8dcc4" roughness={0.85} />
        </mesh>
        {/* lucerna visí z pravé ruky */}
        <group ref={lantern} position={[0.34, -0.12, 0]}>
          <Lantern energy={state.current.energy} detail={detail} />
        </group>
      </group>
      <instancedMesh ref={trail} args={[undefined, undefined, 18]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#ffe9b8" transparent opacity={0.42} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
    </>
  );
}

export function LumiScene({
  path,
  onStats,
  onFinish,
  paused = false,
  detail = true,
  remotes,
  sharedLights,
  onFly,
}: {
  /** Kterou cestou se letí — data i simulace se berou odsud. */
  path: LumiPath;
  /** `false` = lehká varianta pro mobil (bez 250k modelu lucerny). */
  detail?: boolean;
  /** Společné létání: ostatní letci ze serveru (ref, ne state — 15×/s). */
  remotes?: React.MutableRefObject<LumiRemote[]>;
  /** Společná světla místnosti — server je zdroj pravdy. */
  sharedLights?: React.MutableRefObject<number[]>;
  /** Poslat vlastní stav na server (relay). */
  onFly?: (state: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    energy: number;
    collect?: number;
    finished?: boolean;
  }) => void;
  onStats: (stats: LumiStats) => void;
  onFinish: (score: number) => void;
  paused?: boolean;
}) {
  const { gl } = useThree();
  const state = useRef<FlightState>(createFlight(path.id));
  const keys = useRef<Record<keyof FlightInput, boolean>>({ up: false, down: false, left: false, right: false });
  const lastReport = useRef(0);
  const finishedSent = useRef(false);
  /** Zvukové hrany: předchozí stav, aby se nehrálo každý snímek. */
  const audioEdges = useRef({ inCurrent: false, opened: false });
  const lastFly = useRef(0);
  /** Světlo, které se má poslat serveru při nejbližší zprávě. */
  const pendingFly = useRef<number | null>(null);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const action = KEY_MAP[event.code];
      if (!action) return;
      event.preventDefault();
      keys.current[action] = true;
    };
    const up = (event: KeyboardEvent) => {
      const action = KEY_MAP[event.code];
      if (!action) return;
      keys.current[action] = false;
    };
    const clear = () => {
      keys.current = { up: false, down: false, left: false, right: false };
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
    };
  }, []);

  // Ladicí háček pro headless test (`?lumiDebug=1`) — bez něj by E2E
  // muselo doletět celou cestu klávesnicí.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('lumiDebug') !== '1') return;
    const bag = window as unknown as Record<string, unknown>;
    bag.__lumiDebug = () => ({
      ...state.current,
      lights: [...state.current.lights],
      renderer: { calls: gl.info.render.calls, triangles: gl.info.render.triangles, textures: gl.info.memory.textures },
    });
    // polohy světel a svatyně pro test — jinak by E2E muselo znát data cesty
    bag.__lumiLights = path.lights.map((light) => ({ id: light.id, x: light.x, y: light.y }));
    bag.__lumiShrine = { x: path.shrine.x, y: path.shrine.y };
    bag.__lumiTeleport = (x: number, y: number) => {
      state.current.x = x;
      state.current.y = y;
      state.current.vx = 0;
      state.current.vy = 0;
    };
    return () => {
      delete bag.__lumiDebug;
      delete bag.__lumiTeleport;
      delete bag.__lumiLights;
      delete bag.__lumiShrine;
    };
  }, [path, gl]);

  useFrame((_, delta) => {
    if (paused) return;
    const flight = state.current;
    stepFlight(flight, { ...keys.current }, Math.min(0.05, delta));

    if (finishedSent.current === false && flight.finished) {
      finishedSent.current = true;
      onFinish(700 + Math.max(0, 600 - Math.floor(flight.time) * 2));
    }

    // ── společný let ────────────────────────────────────────────────
    // Světla drží server: co sebral někdo jiný, mizí i mně.
    if (sharedLights?.current) {
      for (const id of sharedLights.current) {
        if (!flight.lights.includes(id)) flight.lights.push(id);
      }
    }
    if (onFly) {
      const now = flight.time;
      if (now - (lastFly.current || 0) > 0.05) {
        lastFly.current = now;
        onFly({
          x: flight.x,
          y: flight.y,
          vx: flight.vx,
          vy: flight.vy,
          energy: flight.energy,
          collect: pendingFly.current ?? undefined,
          finished: flight.finished,
        });
        pendingFly.current = null;
      }
    }

    // telemetrie 6×/s — častěji by překreslovala celý React strom
    if (flight.time - lastReport.current > 0.16) {
      lastReport.current = flight.time;
      // sebrané světlo se hlásí **jednou** a teprve tady se vyzvedne;
      // kdyby ho simulace mazala každý krok, telemetrie by ho minula
      const lastLight = flight.lastLight;
      flight.lastLight = null;
      if (lastLight !== null) {
        pendingFly.current = lastLight;
        // Výška tónu roste s počtem světel — cesta má být slyšet jako stupnice.
        const step = Math.max(0, flight.lights.length - 1);
        const freq = 784 * Math.pow(2, step / 12);
        play('lightPickup');
        playTone({ freq, duration: 0.5, type: 'sine', gain: 0.07 });
        playTone({ freq: freq * 1.5, duration: 0.35, type: 'triangle', gain: 0.035, delay: 0.06 });
      }

      // Proud vzduchu: nádech při vstupu, ne každý snímek.
      const inCurrent = currentAt(flight.x, flight.y, flight.path) > 0;
      if (inCurrent && !audioEdges.current.inCurrent) play('gust');
      audioEdges.current.inCurrent = inCurrent;

      // Svatyně se otevřela — jednou.
      if (flight.lights.length === flight.total && !audioEdges.current.opened) {
        audioEdges.current.opened = true;
        play('shrineOpen');
      }
      onStats({
        lights: flight.lights.length,
        speed: Math.hypot(flight.vx, flight.vy),
        lightIds: [...flight.lights],
        total: flight.total,
        energy: flight.energy,
        time: flight.time,
        finished: flight.finished,
        lastLight,
      });
    }
  });

  return (
    <>
      <color attach="background" args={['#050c16']} />
      <fog attach="fog" args={['#08131f', 90, 230]} />
      <ambientLight intensity={0.55} color="#bfe6ea" />
      <directionalLight position={[30, 80, 60]} intensity={1.4} color="#ffeed2" />
      <directionalLight position={[-40, -20, -30]} intensity={0.4} color="#4d6fd1" />

      <Stars />
      <Clouds />
      {path.islands.map((island) => (
        <Island key={island.id} {...island} />
      ))}
      {path.currents.map((current) => (
        <Current key={current.id} x={current.x} y={current.y} r={current.r} lift={current.lift} />
      ))}
      {path.lights.map((light) => (
        <Light key={light.id} light={light} taken={state.current.lights.includes(light.id)} />
      ))}
      <Shrine open={state.current.lights.length === path.lights.length} shrine={path.shrine} />
      <Lumi state={state} detail={detail} />
      {remotes && <RemoteFlyers remotes={remotes} />}
      <CameraRig state={state} />
    </>
  );
}

/**
 * Ostatní letci.
 *
 * Kreslí se **bez modelu lucerny** (jen svítící koule): model má 13k
 * trojúhelníků a čtyři kopie by z oblohy udělaly pomalou scénu. Z dálky
 * stejně není rozdíl vidět a světlo je to, co je z nich poznat.
 */
function RemoteFlyers({ remotes }: { remotes: React.MutableRefObject<LumiRemote[]> }) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const MAX = 4;

  useFrame(() => {
    const list = remotes.current ?? [];
    for (let index = 0; index < MAX; index += 1) {
      const group = groups.current[index];
      const remote = list[index];
      if (!group) continue;
      group.visible = Boolean(remote);
      if (!remote) continue;
      group.position.set(remote.x, remote.y, 2);
      group.rotation.z = -Math.max(-0.45, Math.min(0.45, remote.vy / 45));
    }
  });

  return (
    <>
      {Array.from({ length: MAX }, (_, index) => (
        <group
          key={index}
          ref={(node) => {
            groups.current[index] = node;
          }}
          visible={false}
          scale={1.35}
        >
          <mesh position={[0, -0.28, 0]}>
            <coneGeometry args={[0.4, 0.9, 12]} />
            <meshStandardMaterial color="#cfe6e0" roughness={0.85} emissive="#9fe4ea" emissiveIntensity={0.18} />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.19, 14, 10]} />
            <meshStandardMaterial color="#f2d9bd" roughness={0.7} />
          </mesh>
          <mesh position={[0.3, -0.1, 0]}>
            <sphereGeometry args={[0.16, 12, 10]} />
            <meshBasicMaterial color="#ffe9b8" toneMapped={false} />
          </mesh>
          <pointLight position={[0.3, -0.1, 0]} intensity={2.2} distance={9} color="#ffd9a0" />
        </group>
      ))}
    </>
  );
}

/**
 * Kamera sleduje Lumi zblízka, aby byla vidět jako postava, ne jako tečka.
 *
 * První verze držela celou mapu (kamera ve výšce 118), takže holčička byla
 * 20 px vysoká a splývala s ostrovy. Teď je kamera blíž a mírně napřed ve
 * směru letu — hráč vidí, kam letí, a přitom zůstává v záběru.
 */
function CameraRig({ state }: { state: React.MutableRefObject<FlightState> }) {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(50, 50, 0), []);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const flight = state.current;
    const ahead = THREE.MathUtils.clamp(flight.vx * 0.35, -6, 6);
    desired.set(
      THREE.MathUtils.clamp(flight.x + 12 + ahead, 14, 96),
      THREE.MathUtils.clamp(flight.y + 9, 14, 94),
      58,
    );
    camera.position.lerp(desired, Math.min(1, delta * 2.4));
    look.set(flight.x + 3 + ahead, flight.y + 2, 0);
    target.lerp(look, Math.min(1, delta * 3));
    camera.lookAt(target);
  });
  return null;
}

/** Obal, aby stránka nemusela řešit Canvas ani kameru. */
export function LumiCanvas(props: {
  path: LumiPath;
  onStats: (stats: LumiStats) => void;
  onFinish: (score: number) => void;
  paused?: boolean;
  detail?: boolean;
  remotes?: React.MutableRefObject<LumiRemote[]>;
  sharedLights?: React.MutableRefObject<number[]>;
  onFly?: (state: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    energy: number;
    collect?: number;
    finished?: boolean;
  }) => void;
}) {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [22, 22, 58], fov: 44, near: 0.5, far: 400 }}>
      <LumiScene {...props} />
    </Canvas>
  );
}
