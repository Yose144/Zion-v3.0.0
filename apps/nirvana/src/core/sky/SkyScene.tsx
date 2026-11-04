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

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {
  ENERGY_MAX,
  createFlight,
  stepFlight,
  type FlightInput,
  type FlightState,
} from './flight';
import { SKY_CURRENTS, SKY_HEIGHT, SKY_ISLANDS, SKY_LIGHTS, SKY_SHRINE, SKY_WIDTH } from './world';

export interface SkyStats {
  lights: number;
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
      positions[i * 3] = rand() * SKY_WIDTH * 1.6 - SKY_WIDTH * 0.3;
      positions[i * 3 + 1] = rand() * SKY_HEIGHT * 1.3 - SKY_HEIGHT * 0.15;
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
        x: (index * 13.7) % SKY_WIDTH,
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
      if (child.position.x > SKY_WIDTH + 12) child.position.x = -12;
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
      <mesh position={[0, -r * 0.28, 0]}>
        <coneGeometry args={[r * 0.94, r * 0.62, 22]} />
        <meshStandardMaterial color="#6b9aa4" roughness={0.8} metalness={0.1} transparent opacity={0.85} />
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
function Light({ light, taken }: { light: (typeof SKY_LIGHTS)[number]; taken: boolean }) {
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
function Shrine({ open }: { open: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * 0.2;
  });
  return (
    <group position={[SKY_SHRINE.x, SKY_SHRINE.y, 0]}>
      <mesh ref={ring}>
        <torusGeometry args={[SKY_SHRINE.r * 0.8, 0.45, 12, 48]} />
        <meshBasicMaterial color={open ? '#ffe9a8' : '#7f9aa8'} toneMapped={false} transparent opacity={open ? 0.95 : 0.35} />
      </mesh>
      <mesh>
        <circleGeometry args={[SKY_SHRINE.r * 0.8, 36]} />
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

/** Hráč: pláštěnka z kužele, tělo z koule, stopa ze světýlek. */
function Flyer({ state }: { state: React.MutableRefObject<FlightState> }) {
  const group = useRef<THREE.Group>(null);
  const cape = useRef<THREE.Mesh>(null);
  const trail = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const history = useRef<{ x: number; y: number }[]>([]);

  useFrame(({ clock }) => {
    const flight = state.current;
    if (group.current) {
      group.current.position.set(flight.x, flight.y, 2);
      const tilt = Math.max(-0.5, Math.min(0.5, flight.vy / 40));
      group.current.rotation.z = -tilt;
      group.current.rotation.y = flight.vx >= 0 ? 0.2 : -0.2;
    }
    if (cape.current) {
      const beat = 1 + Math.sin(clock.elapsedTime * 3.2) * 0.08 * (flight.energy / ENERGY_MAX);
      cape.current.scale.set(beat, beat, 1);
    }

    // stopa: posledních 16 pozic jako jiskry
    history.current.push({ x: flight.x, y: flight.y });
    if (history.current.length > 16) history.current.shift();
    if (trail.current) {
      history.current.forEach((point, index) => {
        const k = index / history.current.length;
        tmp.position.set(point.x, point.y, 1.6);
        tmp.scale.setScalar(0.16 + k * 0.34);
        tmp.rotation.set(0, 0, 0);
        tmp.updateMatrix();
        trail.current!.setMatrixAt(index, tmp.matrix);
      });
      for (let i = history.current.length; i < 16; i += 1) {
        tmp.position.set(0, 0, -1000);
        tmp.updateMatrix();
        trail.current.setMatrixAt(i, tmp.matrix);
      }
      trail.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <group ref={group} scale={1.7}>
        <mesh>
          <sphereGeometry args={[0.9, 18, 14]} />
          <meshStandardMaterial color="#eaf7ff" emissive="#9fe4ea" emissiveIntensity={0.35} roughness={0.4} />
        </mesh>
        <mesh ref={cape} position={[-0.7, -0.2, 0]} rotation={[0, 0, Math.PI / 2.4]}>
          <coneGeometry args={[0.85, 2.1, 10, 1, true]} />
          <meshStandardMaterial
            color="#bfe6ea"
            transparent
            opacity={0.72}
            side={THREE.DoubleSide}
            emissive="#7fe3d4"
            emissiveIntensity={0.25}
          />
        </mesh>
        <pointLight intensity={3.5} distance={12} color="#ffd9a0" />
      </group>
      <instancedMesh ref={trail} args={[undefined, undefined, 16]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color="#ffe9b8" transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
      </instancedMesh>
    </>
  );
}

export function SkyScene({
  onStats,
  onFinish,
  paused = false,
}: {
  onStats: (stats: SkyStats) => void;
  onFinish: (score: number) => void;
  paused?: boolean;
}) {
  const state = useRef<FlightState>(createFlight());
  const keys = useRef<Record<keyof FlightInput, boolean>>({ up: false, down: false, left: false, right: false });
  const lastReport = useRef(0);
  const finishedSent = useRef(false);

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

  // Ladicí háček pro headless test (`?skyDebug=1`) — bez něj by E2E
  // muselo doletět celou cestu klávesnicí.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('skyDebug') !== '1') return;
    const bag = window as unknown as Record<string, unknown>;
    bag.__skyDebug = () => ({ ...state.current, lights: [...state.current.lights] });
    bag.__skyTeleport = (x: number, y: number) => {
      state.current.x = x;
      state.current.y = y;
      state.current.vx = 0;
      state.current.vy = 0;
    };
    return () => {
      delete bag.__skyDebug;
      delete bag.__skyTeleport;
    };
  }, []);

  useFrame((_, delta) => {
    if (paused) return;
    const flight = state.current;
    stepFlight(flight, { ...keys.current }, Math.min(0.05, delta));

    if (finishedSent.current === false && flight.finished) {
      finishedSent.current = true;
      onFinish(700 + Math.max(0, 600 - Math.floor(flight.time) * 2));
    }

    // telemetrie 6×/s — častěji by překreslovala celý React strom
    if (flight.time - lastReport.current > 0.16) {
      lastReport.current = flight.time;
      onStats({
        lights: flight.lights.length,
        total: flight.total,
        energy: flight.energy,
        time: flight.time,
        finished: flight.finished,
        lastLight: flight.lastLight,
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
      {SKY_ISLANDS.map((island) => (
        <Island key={island.id} {...island} />
      ))}
      {SKY_CURRENTS.map((current) => (
        <Current key={current.id} x={current.x} y={current.y} r={current.r} lift={current.lift} />
      ))}
      {SKY_LIGHTS.map((light) => (
        <Light key={light.id} light={light} taken={state.current.lights.includes(light.id)} />
      ))}
      <Shrine open={state.current.lights.length === SKY_LIGHTS.length} />
      <Flyer state={state} />
      <CameraRig state={state} />
    </>
  );
}

/** Kamera jemně sleduje hráče, ale drží celý záběr — hra není o přesnosti. */
function CameraRig({ state }: { state: React.MutableRefObject<FlightState> }) {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(SKY_WIDTH / 2, SKY_HEIGHT / 2, 0), []);
  const desired = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, delta) => {
    const flight = state.current;
    desired.set(
      THREE.MathUtils.clamp(flight.x * 0.35 + SKY_WIDTH * 0.3, 20, 80),
      THREE.MathUtils.clamp(flight.y * 0.3 + SKY_HEIGHT * 0.35, 25, 75),
      118,
    );
    camera.position.lerp(desired, Math.min(1, delta * 2.2));
    target.lerp(new THREE.Vector3(flight.x * 0.35 + SKY_WIDTH * 0.3, flight.y * 0.3 + SKY_HEIGHT * 0.35, 0), Math.min(1, delta * 2.6));
    camera.lookAt(target);
  });
  return null;
}

/** Obal, aby stránka nemusela řešit Canvas ani kameru. */
export function SkyCanvas(props: {
  onStats: (stats: SkyStats) => void;
  onFinish: (score: number) => void;
  paused?: boolean;
}) {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [50, 46, 118], fov: 44, near: 0.5, far: 400 }}>
      <SkyScene {...props} />
    </Canvas>
  );
}
