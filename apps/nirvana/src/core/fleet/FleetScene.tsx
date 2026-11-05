'use client';

/**
 * FLOTILA — scéna volného letu mezi Nabukanem a Issobellou.
 *
 * Co drží pohromadě: model lodi (marketplace GLB), dva **pohyblivé** doky
 * (`docks.ts`) a simulace (`flight.ts`). Scéna jen čte stav — kdyby si
 * počítala vlastní pohyb, hráč by přistál vedle doku.
 *
 * Tři pravidla, která se vyplatí neporušit:
 *  1. **Model je z marketu, jen přemalovaný.** Žádná druhá geometrie —
 *     jinak by si člověk koupil jednu loď a ve hře viděl jinou.
 *  2. **Trysky svítí ve scéně, ne v modelu.** V GLB jsou tmavé kryty;
 *     světlo je aditivní, takže funguje i proti černé obloze.
 *  3. **Kamera se jen dohání** (`dampFactor`), nikdy neskáče — ostrý střih
 *     při zatáčení vypadá jako chyba renderu.
 */

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as THREE from 'three';
import { dampFactor } from '@/core/design/motion';
import { fleetHeading, fleetPosition, ringSpinAngle, RING_R, PLANET_R } from '@/core/scene/universe/positions';
import { IssobellaStation } from '@/core/scene/universe/IssobellaStation';
import { NabukanoModel } from '../../../../shared/scenes/kit/vessels';
import { dockTargets, type Dock } from './docks';
import {
  createShip,
  forwardOf,
  stepShip,
  telemetry,
  undock,
  type FleetTelemetry,
  type ShipInput,
  type ShipState,
} from './flight';
import { SHIPS, type ShipSpec } from './ships';

/** Prstenec Issobelly — stejná geometrie jako ve vesmíru (`IssobellaRing`). */
const RING_TILT_LOCAL: [number, number, number] = [Math.PI / 2 - 0.32, 0, 0.14];

export interface FleetStats extends FleetTelemetry {
  /** Natočení trupu ve stupních (pro HUD). */
  heading: number;
  /** Vzdálenost od středu planety — „výška" nad Novou Zemí. */
  altitude: number;
}

/**
 * HERNÍ MATERIÁL.
 *
 * `DoubleSide` je nutnost: marketplace model je soubor otevřených destiček,
 * takže mezerami mezi nimi je vidět rub. Když se vykreslí, vypadá to jako
 * spára; kdyby chyběl, loď by byla děravá.
 */
function hullMaterial() {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.3,
    roughness: 0.42,
    envMapIntensity: 0.9,
    side: THREE.DoubleSide,
  });
}

/** Loď z marketu + trysky. `spec.engines` je v modelovém prostoru (nos = +Z). */
function MarketShip({ spec, thrust }: { spec: ShipSpec; thrust: number }) {
  const { scene } = useGLTF(spec.glb);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = hullMaterial();
      mesh.castShadow = false;
      mesh.frustumCulled = false;
    });
    return clone;
  }, [scene]);

  const glow = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!glow.current) return;
    const scale = 0.6 + thrust * 0.9;
    glow.current.children.forEach((child, index) => {
      child.scale.setScalar(index % 2 === 0 ? scale : 0.6 + thrust * 1.6);
    });
  });

  return (
    <group scale={spec.scale}>
      <primitive object={model} />
      <group ref={glow}>
        {spec.engines.map((anchor, index) => (
          <group key={`engine-${index}`} position={anchor}>
            {/* jádro trysky — malá koule, ať to svítí i z dálky */}
            <mesh renderOrder={2}>
              <sphereGeometry args={[0.022, 8, 6]} />
              <meshBasicMaterial color="#ffd39a" toneMapped={false} transparent opacity={0.95} />
            </mesh>
            {/* kužel tahu — prodlužuje se s plynem a boostem */}
            <mesh position={[0, 0, -0.06]} rotation={[Math.PI / 2, 0, 0]} renderOrder={1}>
              <coneGeometry args={[0.03, 0.16, 8, 1, true]} />
              <meshBasicMaterial
                color="#ff9f43"
                transparent
                opacity={0.5}
                toneMapped={false}
                side={THREE.DoubleSide}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/**
 * Prostředí pro kovový lak.
 *
 * `MeshStandardMaterial` s `metalness > 0` odráží **jen prostředí** — bez
 * `scene.environment` je loď černá, i když jsou ve scéně silná světla
 * (přesně to bylo vidět na prvním živém snímku). `RoomEnvironment` je
 * neutrální studio přímo v `three`, takže se nic nestahuje.
 */
function HullEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = texture;
    scene.environmentIntensity = 0.55;
    return () => {
      scene.environment = null;
      texture.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

/** Hvězdy — jeden `Points`, deterministický rozptyl. */
function Stars({ count = 900 }: { count?: number }) {
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    let seed = 1337;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < count; i += 1) {
      // na kouli o poloměru 60–90, aby hvězdy byly za vším
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      const r = 60 + random() * 30;
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      positions[i * 3 + 1] = Math.cos(phi) * r;
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return buffer;
  }, [count]);

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial color="#cddcf5" size={0.45} sizeAttenuation transparent opacity={0.85} depthWrite={false} />
    </points>
  );
}

/** Nová Země — koule s teplým okrajem. Texturu nepotřebuje, hra se dívá z dálky. */
function NewEarth() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[PLANET_R, 48, 32]} />
        <meshStandardMaterial color="#2d5a7a" roughness={0.75} metalness={0.05} emissive="#0a2237" emissiveIntensity={0.5} />
      </mesh>
      {/* atmosféra: aditivní koule o pár procent větší */}
      <mesh scale={1.035}>
        <sphereGeometry args={[PLANET_R, 32, 24]} />
        <meshBasicMaterial color="#7ec8ff" transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* města na noční straně — pár světelných bodů, ne mapa */}
      <mesh scale={1.001}>
        <sphereGeometry args={[PLANET_R, 24, 16]} />
        <meshBasicMaterial color="#ffcf8a" transparent opacity={0.08} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Prstenec Issobelly se stanicí. Rotace je funkce času, ne akumulátor. */
function IssobellaRing() {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = ringSpinAngle(clock.elapsedTime);
  });

  return (
    <group ref={group} rotation={[0.32, 0, -0.14]}>
      <mesh rotation={RING_TILT_LOCAL}>
        <torusGeometry args={[RING_R, 0.035, 8, 128]} />
        <meshBasicMaterial color="#f5f5f5" transparent opacity={0.5} />
      </mesh>
      <mesh rotation={RING_TILT_LOCAL}>
        <torusGeometry args={[RING_R + 0.75, 0.02, 8, 128]} />
        <meshBasicMaterial color="#7ec8ff" transparent opacity={0.16} />
      </mesh>
      <IssobellaStation position={[RING_R, 0, 0]} scale={4.4} low />
    </group>
  );
}

/** Nabukano — mateřská loď. Pozice i natočení jdou z `positions.ts`. */
function Nabukano() {
  const carrier = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (!carrier.current) return;
    const [x, y, z] = fleetPosition(t);
    carrier.current.position.set(x, y, z);
    carrier.current.rotation.y = fleetHeading(t);
  });

  return (
    <group ref={carrier} scale={4}>
      <NabukanoModel animate />
    </group>
  );
}

/** Značky doků — pulzující prstenec v barvě podle místa. */
function DockMarkers({ docks, time }: { docks: Dock[]; time: number }) {
  return (
    <group>
      {docks.map((dock, index) => {
        const color = dock.kind === 'nabukano' ? '#38bdf8' : '#e8c56a';
        const pulse = 0.65 + Math.sin(time * 1.6 + index) * 0.35;
        return (
          <group key={dock.id} position={dock.position}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.3, 0.012, 6, 24]} />
              <meshBasicMaterial color={color} transparent opacity={0.35 + pulse * 0.4} toneMapped={false} depthWrite={false} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.02, 6, 5]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Čte klávesnici do jednoho refu — žádný React state v 60 fps smyčce. */
function useFlightKeys(target: React.RefObject<ShipInput>) {
  useEffect(() => {
    const pressed = new Set<string>();
    const sync = () => {
      target.current.throttle = pressed.has('KeyW') ? 1 : 0;
      target.current.brake = pressed.has('KeyS');
      target.current.yaw = (pressed.has('KeyA') ? 1 : 0) - (pressed.has('KeyD') ? 1 : 0);
      target.current.pitch = (pressed.has('ArrowUp') ? 1 : 0) - (pressed.has('ArrowDown') ? 1 : 0);
      target.current.roll = (pressed.has('KeyQ') ? 1 : 0) - (pressed.has('KeyE') ? 1 : 0);
      target.current.boost = pressed.has('ShiftLeft') || pressed.has('ShiftRight');
    };

    const down = (event: KeyboardEvent) => {
      if (event.repeat) return;
      pressed.add(event.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
      sync();
    };
    const up = (event: KeyboardEvent) => {
      pressed.delete(event.code);
      sync();
    };
    // ztráta fokusu musí pustit vstup, jinak loď letí dál po přepnutí tabu
    const clear = () => {
      pressed.clear();
      sync();
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
  }, [target]);
}

export interface FleetCanvasProps {
  spec: ShipSpec;
  /** Startovní pozice (po odpojení z doku nebo na začátku letu). */
  start?: { x: number; y: number; z: number; yaw?: number };
  onStats: (stats: FleetStats) => void;
  /** `true` = loď stojí na doku, stránka ukáže panel. */
  onDock: (dockId: string | null) => void;
  /** Odpojení — stránka ho vyvolá tlačítkem. */
  undockSignal: number;
  debug?: boolean;
}

/** Vnitřek `<Canvas>`: simulace, kamera, telemetrie, debug háček. */
function Flight({
  spec,
  start,
  onStats,
  onDock,
  undockSignal,
  debug,
}: FleetCanvasProps) {
  const { camera, clock, gl } = useThree();
  const input = useRef<ShipInput>({ throttle: 0, yaw: 0, pitch: 0, roll: 0, boost: false, brake: false });
  const state = useRef<ShipState>(createShip(spec, start));
  const docks = useRef<Dock[]>([]);
  const lastStats = useRef(0);
  const dockRef = useRef<string | null>(null);
  const chase = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const shipGroup = useRef<THREE.Group>(null);
  const glow = useRef(0);

  useFlightKeys(input);

  // odpojení z doku — signál z DOM, ne stav (aby se nepropsal do 60 fps smyčky)
  useEffect(() => {
    if (undockSignal === 0) return;
    undock(state.current);
  }, [undockSignal]);

  useEffect(() => {
    state.current = createShip(spec, start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.id]);

  useFrame((_, delta) => {
    const t = clock.elapsedTime;
    docks.current = dockTargets(t);
    stepShip(state.current, input.current, spec, delta, docks.current, t);

    // ── loď ───────────────────────────────────────────────────────────
    const ship = state.current;
    if (shipGroup.current) {
      shipGroup.current.position.set(ship.x, ship.y, ship.z);
      shipGroup.current.rotation.set(-ship.pitch, ship.yaw, ship.roll, 'YXZ');
    }

    // ── kamera: dohání pozici za lodí ─────────────────────────────────
    const [fx, fy, fz] = forwardOf(ship);
    if (ship.docked) {
      // Zakotveno: pohled zvenku a zespodu. Kamera za lodí by totiž stála
      // uvnitř dokovacího rámu (rámy běží ±1,68 jednotky kolem lodě) a hráč
      // by místo svého stroje viděl tmavou desku.
      chase.current.set(ship.x + 2.6, ship.y - 2, ship.z + 2.6);
      look.current.set(ship.x, ship.y + 0.12, ship.z);
    } else {
      const back = 1.75 + Math.min(2.2, Math.abs(ship.speed) * 0.13);
      chase.current.set(ship.x - fx * back, ship.y - fy * back + 0.62, ship.z - fz * back);
      look.current.set(ship.x + fx * 2.1, ship.y + fy * 2.1 + 0.16, ship.z + fz * 2.1);
    }
    const factor = dampFactor(delta, 5.5);
    camera.position.lerp(chase.current, factor);
    camera.lookAt(look.current);

    // ── trysky: 0..1 podle plynu ──────────────────────────────────────
    const targetGlow = input.current.brake ? 0 : 0.25 + (input.current.throttle > 0 ? 0.55 : 0) + (input.current.boost ? 0.4 : 0);
    glow.current += (targetGlow - glow.current) * dampFactor(delta, 6);

    // ── telemetrie 5×/s ───────────────────────────────────────────────
    lastStats.current += delta;
    if (lastStats.current > 0.2) {
      lastStats.current = 0;
      const data = telemetry(ship, docks.current);
      onStats({
        ...data,
        heading: ((-ship.yaw * 180) / Math.PI + 360) % 360,
        altitude: Math.hypot(ship.x, ship.y, ship.z) - PLANET_R,
      });
      if (dockRef.current !== ship.docked) {
        dockRef.current = ship.docked;
        onDock(ship.docked);
      }
    }

    if (debug) {
      const api = window as unknown as { __fleetDebug?: Record<string, unknown> };
      api.__fleetDebug = {
        state: () => ({ ...state.current }),
        docks: () => docks.current.map((dock) => ({ ...dock })),
        teleport: (x: number, y: number, z: number) => {
          state.current.x = x;
          state.current.y = y;
          state.current.z = z;
          state.current.docked = null;
          state.current.speed = 0;
          state.current.dockProgress = 0;
        },
        yaw: (value: number) => {
          state.current.yaw = value;
        },
        speed: (value: number) => {
          state.current.speed = value;
        },
        // Výkon scény — bez tohohle se „měří" odhadem. Čte se `gl.info`
        // hned po snímku, takže čísla patří poslednímu vykreslenému framu.
        renderer: () => ({
          calls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          geometries: gl.info.memory.geometries,
          textures: gl.info.memory.textures,
        }),
        dock: (id: string) => {
          const dock = dockTargets(clock.elapsedTime).find((entry) => entry.id === id);
          if (!dock) return false;
          state.current.x = dock.position[0];
          state.current.y = dock.position[1];
          state.current.z = dock.position[2];
          state.current.speed = 0;
          state.current.dockProgress = 1;
          state.current.docked = id;
          return true;
        },
      };
    }
  });

  return (
    <>
      <ambientLight intensity={0.42} color="#8fa8c8" />
      <directionalLight position={[12, 16, 8]} intensity={2.1} color="#fff3dd" />
      {/* doplňkové světlo z pozice kamery — trup Nabukana je jinak temná
          stěna, protože klíčové světlo svítí na jeho odvrácenou stranu */}
      <directionalLight position={[-8, 5, 22]} intensity={0.75} color="#ffe9c8" />
      <directionalLight position={[-10, -6, -12]} intensity={0.8} color="#9ec7ff" />
      <hemisphereLight args={['#3a5570', '#0a1018', 0.75]} />

      <HullEnvironment />
      <Stars />
      <NewEarth />
      <IssobellaRing />
      <Nabukano />
      <DockMarkers docks={dockTargets(clock.elapsedTime)} time={clock.elapsedTime} />

      <group ref={shipGroup}>
        <Suspense fallback={null}>
          <MarketShip spec={spec} thrust={glow.current} />
        </Suspense>
      </group>
    </>
  );
}

export function FleetCanvas(props: FleetCanvasProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ fov: 58, near: 0.05, far: 400, position: [0, 8, 20] }}
      gl={{ antialias: true }}
      className="fleet-canvas"
    >
      <color attach="background" args={['#05070c']} />
      <Flight {...props} />
    </Canvas>
  );
}

/**
 * Modely se přednačítají hned při mountu scény: přepnutí lodi ve výběru by
 * jinak znamenalo půl sekundy prázdna ve chvíli, kdy hráč čeká akci.
 */
for (const spec of SHIPS) useGLTF.preload(spec.glb);
