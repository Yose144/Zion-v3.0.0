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

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { XR, XROrigin, type XRStore } from '@react-three/xr';
import * as THREE from 'three';
import { VR_DEADZONE, useVrKeys } from '@/core/xr';
import { VrInputs } from '@/core/xr/inputs';
import {
  ENERGY_MAX,
  createFlight,
  currentAt,
  lumiScore,
  nextTarget,
  stepFlight,
  type FlightInput,
  type FlightState,
} from './flight';
import { LUMI_HEIGHT, LUMI_WIDTH, type LumiLight, type LumiPath, type LumiRing } from './world';
import { advanceRings, comboAt, createRingRun, ringActive, type RingPass, type RingRun } from './rings';
import { createTrail, pruneTrail, pushTrail, trailFade, TRAIL_LEN, type TrailPoint } from './trail';
import { play, playTone } from '@/core/audio/engine';
import { canvasDpr } from '@/core/design/dpr';

/** Jeden vzdálený letec (relay ze serveru). */export interface LumiRemote {
  id: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  finished: boolean;
  /** Hráč odešel — kreslí se jako duch, který během 3 s zmizí. */
  ghost?: boolean;
}

export interface LumiStats {
  lights: number;
  /** Rychlost letu (pro zvuk větru a HUD). */
  speed: number;
  /** Id sebraných světel (deník je potřebuje, ne jen počet). */
  lightIds: number[];
  /** Poloha hráčky a cíl, kam má letět (kompas v HUD). */
  x: number;
  y: number;
  target: { x: number; y: number; kind: 'light' | 'shrine' } | null;
  total: number;
  energy: number;
  time: number;
  finished: boolean;
  /** Naposledy sebrané světlo (id) — stránka podle něj ukáže text. */
  lastLight: number | null;
  // ── prstence světla (2026-11-10) ────────────────────────────────────
  /** Kolik prstenců cesty je proletěných. */
  rings: number;
  /** Kolik jich cesta má (včetně finálních, které se odemknou po sedmi světlech). */
  ringTotal: number;
  /** Aktuální řetěz (0 = žádný, 1 = první prstenec…). */
  combo: number;
  /** Nejdelší řetěz této cesty — pro panel po doletu. */
  bestCombo: number;
  /** Naposledy proletěný prstenec; vyzvedne ho ten, kdo ho zobrazí. */
  lastRing: (RingPass & { all?: boolean }) | null;
  /** Proletěl hráč všechny prstence cesty? (jednorázový bonus) */
  ringAll: boolean;
  /** Body z prstenců — součást skóre cesty. */
  ringScore: number;
}

const KEY_MAP: Record<string, 'up' | 'down' | 'left' | 'right'> = {
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
 * Stopa za lucernou (L-3): logika je v `trail.ts` (testuje se bez WebGL),
 * tady se jen plní instance a barvy. Čísla (`TRAIL_LEN`, `TRAIL_STEP`,
 * `TRAIL_TTL`) patří tam, ne sem.
 */

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

/**
 * Respektuje `prefers-reduced-motion` (L-9).
 *
 * Čte se **jednou při mountu**: hra se po změně systémového nastavení
 * nenačítá znovu a překreslovat celou scénu kvůli tomu nemá smysl.
 * Vypíná se jen pohyb na pozadí (mraky, jiskry proudů, blikání lucerny) —
 * letět se musí dát dál, jinak by „bez pohybu" znamenalo „bez hry".
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  const still = useMemo(prefersReducedMotion, []);
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
    if (still || !group.current) return;
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
  const still = useMemo(prefersReducedMotion, []);
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
    const t = still ? 0 : clock.elapsedTime;
    group.current.children.forEach((child, index) => {
      const spark = sparks[index];
      if (!spark) return;
      const climb = still ? spark.phase * 34 - 17 : ((spark.phase + t * (0.12 + lift * 0.002)) % 1) * 34 - 17;
      child.position.y = climb;
      child.position.x = spark.dx + (still ? 0 : Math.sin(t * 0.8 + index) * 0.6);
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
 * Prstenec světla (2026-11-10) — volitelný oblouk, kterým se dá proletět.
 *
 * Vizuál je jeden torus + měkká záře. Prstenec **není kolizní**: kdo ho
 * mine, jen přijde o body a energii. Proletěný zůstane na obloze jako
 * ztlumený obrys — hráč tak vidí, kudy už letěl.
 *
 * Finální prstence (`afterAll`) se objeví, až když má hráč všechna světla;
 * do té doby je skupina neviditelná (ale data i pravidlo existují pořád).
 */
function RingGate({
  ring,
  run,
  state,
  detail,
}: {
  ring: LumiRing;
  run: React.MutableRefObject<RingRun>;
  state: React.MutableRefObject<FlightState>;
  detail: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const glowMat = useRef<THREE.SpriteMaterial>(null);
  /** Kdy prstenec proletěl — od toho se počítá rozpad a rozšíření. */
  const passedAt = useRef<number | null>(null);
  const still = useMemo(prefersReducedMotion, []);
  const texture = softSpriteTexture();
  const live = useMemo(() => new THREE.Color(ring.afterAll ? '#ffe9b0' : '#9fe4ea'), [ring.afterAll]);
  const spent = useMemo(() => new THREE.Color('#5d7f8f'), []);

  useFrame(({ clock }) => {
    const node = group.current;
    if (!node) return;
    const t = clock.elapsedTime;
    // Aktivní je vždy kromě finálních, které čekají na všechna světla.
    node.visible = ringActive(ring, state.current.lights.length, state.current.total);
    if (!node.visible) return;

    const passed = run.current.passed.includes(ring.id);
    if (passed) {
      if (passedAt.current === null) passedAt.current = t;
      // 0,7 s „výdech": prstenec se rozšíří a ztlumí, ať je průlet vidět.
      const k = Math.min(1, Math.max(0, (t - passedAt.current) / 0.7));
      node.scale.setScalar(1 + k * 0.9);
      if (ringMat.current) {
        ringMat.current.color.copy(spent);
        ringMat.current.opacity = 0.4 * (1 - k) + 0.12;
      }
      if (glowMat.current) glowMat.current.opacity = 0.35 * (1 - k);
      return;
    }

    passedAt.current = null;
    const pulse = still ? 0.5 : Math.sin(t * 1.5 + ring.id) * 0.5 + 0.5;
    node.scale.setScalar(1 + pulse * 0.045);
    if (ringMat.current) {
      ringMat.current.color.copy(live);
      ringMat.current.opacity = 0.55 + pulse * 0.35;
    }
    if (glowMat.current) glowMat.current.opacity = 0.16 + pulse * 0.14;
  });

  return (
    <group ref={group} position={[ring.x, ring.y, ring.z]} visible={!ring.afterAll}>
      <mesh>
        <torusGeometry args={[ring.r, 0.16, 10, 44]} />
        <meshBasicMaterial
          ref={ringMat}
          color={ring.afterAll ? '#ffe9b0' : '#9fe4ea'}
          transparent
          opacity={0.8}
          toneMapped={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {detail && (
        <sprite scale={[ring.r * 3.4, ring.r * 3.4, 1]}>
          <spriteMaterial
            ref={glowMat}
            map={texture ?? undefined}
            color={ring.afterAll ? '#ffe9b0' : '#a8f4e6'}
            transparent
            opacity={0.2}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      )}
    </group>
  );
}

/** Všechny prstence cesty — jeden seznam, žádná druhá kopie dat ve scéně. */
function RingField({
  rings,
  run,
  state,
  detail,
}: {
  rings: LumiRing[];
  run: React.MutableRefObject<RingRun>;
  state: React.MutableRefObject<FlightState>;
  detail: boolean;
}) {
  return (
    <>
      {rings.map((ring) => (
        <RingGate key={ring.id} ring={ring} run={run} state={state} detail={detail} />
      ))}
    </>
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
  const still = useMemo(prefersReducedMotion, []);
  useFrame(({ clock }) => {
    if (!light.current) return;
    if (still) {
      // Bez blikání: světlo má pořád stejnou sílu, jen podle energie.
      light.current.intensity = 2.5 + energy * 0.03;
      return;
    }
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
  const sparkColor = useMemo(() => new THREE.Color(), []);
  /**
   * Stopa za lucernou (L-3) — vzorky jdou přes `trail.ts`, aby se dala
   * logika testovat v Node a nemohla se rozejít s testy.
   */
  const history = useRef<TrailPoint[]>(createTrail());
  /** Na mobilu se stopa vůbec nekreslí — 24 dalších instancí nemá cenu. */
  const trailOn = detail;

  // Barvy instancí musí existovat dřív, než je frame poprvé zapíše —
  // `instanceColor` se jinak vytvoří až za běhu a materiál by se rekompiloval.
  useLayoutEffect(() => {
    const mesh = trail.current;
    if (!mesh) return;
    sparkColor.setRGB(0, 0, 0);
    for (let index = 0; index < TRAIL_LEN; index += 1) mesh.setColorAt(index, sparkColor);
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [sparkColor]);

  useFrame(({ clock }) => {
    const flight = state.current;
    const now = clock.elapsedTime;
    const tilt = Math.max(-0.45, Math.min(0.45, flight.vy / 45));
    if (group.current) {
      group.current.position.set(flight.x, flight.y, 2);
      group.current.rotation.z = -tilt;
      group.current.rotation.y = flight.vx >= 0 ? 0.25 : -0.25;
      // jemné nadnášení — postava nikdy nestojí dokonale rovně
      group.current.position.y += Math.sin(now * 1.6) * 0.12;
    }
    if (lantern.current) {
      // lucerna se houpe protisměrně k pohybu, jako když ji nese v ruce
      lantern.current.rotation.z = tilt * 0.9 + Math.sin(now * 1.9) * 0.08;
    }

    const mesh = trail.current;
    if (!mesh) return;

    if (!trailOn) {
      // Jednorázově odklidit a dál nic nepočítat (mobil).
      if (history.current.length) {
        history.current = createTrail();
        for (let index = 0; index < TRAIL_LEN; index += 1) {
          tmp.position.set(0, 0, -1000);
          tmp.scale.setScalar(0);
          tmp.updateMatrix();
          mesh.setMatrixAt(index, tmp.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
      return;
    }

    pushTrail(history.current, flight.x, flight.y - 0.4, now);
    pruneTrail(history.current, now);

    for (let index = 0; index < TRAIL_LEN; index += 1) {
      const point = history.current[index];
      if (!point) {
        tmp.position.set(0, 0, -1000);
        tmp.scale.setScalar(0);
        tmp.updateMatrix();
        mesh.setMatrixAt(index, tmp.matrix);
        sparkColor.setRGB(0, 0, 0);
        mesh.setColorAt(index, sparkColor);
        continue;
      }
      const fade = trailFade(point, now);
      // nejmladší je největší a nejjasnější; nejstarší se rozpustí do nuly
      tmp.position.set(point.x, point.y, 1.7);
      tmp.scale.setScalar(0.06 + fade * 0.16);
      tmp.rotation.set(0, 0, 0);
      tmp.updateMatrix();
      mesh.setMatrixAt(index, tmp.matrix);
      sparkColor.setRGB(1, 0.9, 0.72).multiplyScalar(fade * 0.9);
      mesh.setColorAt(index, sparkColor);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
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
      <instancedMesh ref={trail} args={[undefined, undefined, TRAIL_LEN]} frustumCulled={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial
          color="#ffe9b8"
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
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
  watch = false,
  xr = false,
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
  /**
   * Hlediště: žádný vlastní let ani odeslání na server. Kamera sleduje
   * prvního živého letce a světla bere ze snímku místnosti.
   */
  watch?: boolean;
  /** Běží immersive session? Kamera pak patří headsetu, ne `CameraRig`. */
  xr?: boolean;
}) {
  const { gl } = useThree();
  const state = useRef<FlightState>(createFlight(path.id));
  /**
   * Prstence světla (2026-11-10): stav průletů drží `RingRun`. Je oddělený
   * od letu, protože let nepotřebuje vědět, že existují — a testy díky tomu
   * pokrývají pravidla bez simulace.
   */
  const rings = useRef<RingRun>(createRingRun());
  /** Průlet, který se má poslat do telemetrie právě jednou. */
  const pendingRing = useRef<(RingPass & { all?: boolean }) | null>(null);
  /** Klávesy (a dotyk) — čtyři směry, žádný „pohled". */
  const keys = useRef<{ up: boolean; down: boolean; left: boolean; right: boolean }>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  /**
   * Směr pohledu z headsetu (VR). `null` = nejsme ve VR / headset nedodává
   * směr, takže se letí klávesami. Drží se v refu, protože se čte 60×/s.
   */
  const gaze = useRef<{ x: number; y: number } | null>(null);
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
    // prstence: E2E teleportuje do jejich středu a čte, co se stalo
    bag.__lumiRings = path.rings.map((ring) => ({ id: ring.id, x: ring.x, y: ring.y, r: ring.r, afterAll: ring.afterAll === true }));
    bag.__lumiRingState = () => ({
      passed: [...rings.current.passed],
      combo: comboAt(rings.current, state.current.time),
      bestCombo: rings.current.bestCombo,
      perfect: rings.current.perfect,
      score: rings.current.score,
      allDone: rings.current.allDone,
    });
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
      delete bag.__lumiRings;
      delete bag.__lumiRingState;
    };
  }, [path, gl]);

  useFrame((_, delta) => {
    if (paused) return;
    const flight = state.current;
    if (watch) {
      const list = remotes?.current ?? [];
      const lead = list.find((flyer) => !flyer.ghost) ?? list[0];
      if (lead) {
        flight.x = lead.x;
        flight.y = lead.y;
        flight.vx = lead.vx;
        flight.vy = lead.vy;
        flight.energy = lead.energy;
      }
      const shared = sharedLights?.current;
      if (shared) flight.lights.splice(0, flight.lights.length, ...shared);
      flight.time += Math.min(0.05, delta);
      if (flight.time - lastReport.current > 0.16) {
        lastReport.current = flight.time;
        onStats({
          lights: flight.lights.length,
          speed: lead ? Math.hypot(lead.vx, lead.vy) : 0,
          lightIds: [...flight.lights],
          x: flight.x,
          y: flight.y,
          target: null,
          total: flight.total,
          energy: flight.energy,
          time: flight.time,
          finished: false,
          lastLight: null,
          rings: 0,
          ringTotal: path.rings.length,
          combo: 0,
          bestCombo: 0,
          lastRing: null,
          ringAll: false,
          ringScore: 0,
        });
      }
      return;
    }
    // Ve VR letíš tam, kam se díváš (trigger drží lucernu); jinak klávesy.
    const input: FlightInput = gaze.current
      ? { ...keys.current, aim: gaze.current, gaze: 1 }
      : { ...keys.current };
    // Poloha před krokem — průlet prstencem se počítá jako úsečka, ne bod.
    const fromX = flight.x;
    const fromY = flight.y;
    stepFlight(flight, input, Math.min(0.05, delta));

    // ── prstence světla (2026-11-10) ────────────────────────────────
    // Volitelná obratnost: nic neblokují, ale proletět otvorem vrátí
    // lucerně energii a dá body; střed = „perfektní“ a energie víc.
    const pass = advanceRings(
      rings.current,
      { x: fromX, y: fromY },
      { x: flight.x, y: flight.y },
      flight.time,
      path.rings,
      flight.lights.length,
      flight.total,
    );
    if (pass) {
      flight.energy = Math.min(ENERGY_MAX, flight.energy + pass.energy);
      const step = Math.max(0, pass.combo - 1);
      // Řetěz zní jako stupnice: každý další prstenec o tón výš.
      playTone({ freq: 659 * Math.pow(2, step / 12), duration: 0.3, type: 'sine', gain: 0.055 });
      if (pass.perfect) {
        playTone({ freq: 988 * Math.pow(2, step / 12), duration: 0.24, type: 'triangle', gain: 0.035, delay: 0.04 });
      }
      pendingRing.current = { ...pass, all: rings.current.allDone };
    }

    if (finishedSent.current === false && flight.finished) {
      finishedSent.current = true;
      // Skóre = světla + čas (`lumiScore`) + prstence (`run.score`).
      // Jedno místo pravdy pro všechny tři složky.
      onFinish(lumiScore(flight) + rings.current.score);
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
        x: flight.x,
        y: flight.y,
        target: (() => {
          const target = nextTarget(flight);
          return target ? { x: target.x, y: target.y, kind: target.kind } : null;
        })(),
        total: flight.total,
        energy: flight.energy,
        time: flight.time,
        finished: flight.finished,
        lastLight,
        rings: rings.current.passed.length,
        ringTotal: path.rings.length,
        // Řetěz se počítá z času letu; po 6 s bez průletu je nula.
        combo: comboAt(rings.current, flight.time),
        bestCombo: rings.current.bestCombo,
        // Průlet se vyzvedne **jednou** — jinak by hláška visela 6×/s.
        lastRing: pendingRing.current,
        ringAll: rings.current.allDone,
        ringScore: rings.current.score,
      });
      pendingRing.current = null;
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
      <RingField rings={path.rings} run={rings} state={state} detail={detail} />
      {path.lights.map((light) => (
        <Light key={light.id} light={light} taken={state.current.lights.includes(light.id)} />
      ))}
      <Shrine open={state.current.lights.length === path.lights.length} shrine={path.shrine} />
      {!watch && <Lumi state={state} detail={detail} />}
      {remotes && <RemoteFlyers remotes={remotes} />}
      {xr ? <LumiXr state={state} active={!paused} gaze={gaze} /> : <CameraRig state={state} />}
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
  /**
   * Kdy se ten který letce stal duchem (v hodinách scény). Server duchovi
   * pošle `ghost` a po 3 s ho vyhodí; klientskou průhlednost dopočítáme
   * z tohohle razítka, aby mizení bylo plynulé a ne skokové.
   */
  const ghostSince = useRef(new Map<string, number>());
  const MAX = 4;

  useFrame((state) => {
    const list = remotes.current ?? [];
    const now = state.clock.elapsedTime;

    for (let index = 0; index < MAX; index += 1) {
      const group = groups.current[index];
      const remote = list[index];
      if (!group) continue;
      group.visible = Boolean(remote);
      if (!remote) continue;

      let fade = 1;
      if (remote.ghost) {
        let since = ghostSince.current.get(remote.id);
        if (since === undefined) {
          since = now;
          ghostSince.current.set(remote.id, since);
        }
        // 1 → 0 za 3 s, ale nikdy úplně nula (poslední snímek nesmí bliknout)
        fade = Math.max(0.08, 1 - (now - since) / 3);
      } else if (ghostSince.current.has(remote.id)) {
        ghostSince.current.delete(remote.id);
      }

      group.position.set(remote.x, remote.y, 2);
      group.rotation.z = -Math.max(-0.45, Math.min(0.45, remote.vy / 45));
      group.scale.setScalar(1.35 * (0.88 + 0.12 * fade));

      // Materiály jsou pro každou skupinu vlastní, takže stačí projít děti.
      for (const child of group.children) {
        const mesh = child as THREE.Mesh | THREE.PointLight;
        if (mesh.type === 'PointLight') {
          (mesh as THREE.PointLight).intensity = 2.2 * fade;
          continue;
        }
        const material = (mesh as THREE.Mesh).material;
        if (material && !Array.isArray(material)) {
          material.opacity = fade;
        }
      }
    }

    // Úklid: id, které už server neposílá, nemá co držet razítko.
    // `new Set` + `[...keys()]` alokovaly každý frame — `.some` je tu
    // levnější (remote max 4, klíčů v mapě taky pár) a běží jen když
    // vůbec něco duchuje.
    if (ghostSince.current.size > 0) {
      for (const id of ghostSince.current.keys()) {
        if (!list.some((remote) => remote.id === id)) ghostSince.current.delete(id);
      }
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
            <meshStandardMaterial
              color="#cfe6e0"
              roughness={0.85}
              emissive="#9fe4ea"
              emissiveIntensity={0.18}
              transparent
            />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.19, 14, 10]} />
            <meshStandardMaterial color="#f2d9bd" roughness={0.7} transparent />
          </mesh>
          <mesh position={[0.3, -0.1, 0]}>
            <sphereGeometry args={[0.16, 12, 10]} />
            <meshBasicMaterial color="#ffe9b8" toneMapped={false} transparent />
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

/**
 * VR let (L-4).
 *
 * V headsetu **kameru vlastní headset**, takže `CameraRig` se nepoužívá
 * (jinak by se scéna každý snímek „řítila hlavou"). Místo toho se hýbe
 * `XROrigin` — nese tělo hráče a letí kousek za Lumi, takže ji člověk vidí
 * před sebou a nesedí uvnitř její hlavy.
 *
 * Vstup jde přes **syntetické klávesy** (`useVrKeys`), stejné, jaké posílá
 * dotyk a klávesnice. Kdyby VR mělo vlastní větev, rozešlo by se to se
 * simulací i se serverem — stejné pravidlo jako u `TouchPad`.
 */
function LumiXr({
  state,
  active,
  gaze,
}: {
  state: React.MutableRefObject<FlightState>;
  active: boolean;
  gaze: React.MutableRefObject<{ x: number; y: number } | null>;
}) {
  const origin = useRef<THREE.Group>(null);
  const keys = useVrKeys();
  const { camera } = useThree();
  const forward = useMemo(() => new THREE.Vector3(), []);
  // `stepFlight` čte aim synchronně ve stejném frame — objekt může být
  // sdílený, nemusí se alokovat `{x,y}` každý snímek.
  const gazeVec = useMemo(() => ({ x: 0, y: 0 }), []);

  useFrame(() => {
    const flight = state.current;
    if (origin.current) {
      // za a nad Lumi, mírně z boku — zepředu by zakrývala výhled
      origin.current.position.set(flight.x - 2.4, flight.y + 1.1, 4.4);
      origin.current.rotation.y = 0.32;
    }

    /**
     * Let pohledem: kam se hlava dívá, tam se letí.
     *
     * Kamera v XR **je** hlava, takže se bere její forward vektor a promítne
     * se do roviny hry (x/y) — `z` je v Lumi jen kulisa. Když se hráč dívá
     * kolmo dolů, vodorovná složka zmizí a zůstane klesání; to je záměr,
     * ne degenerace (normalizuje se s minimem).
     */
    camera.getWorldDirection(forward);
    const flat = Math.hypot(forward.x, forward.y);
    if (!active || flat < 0.02) {
      gaze.current = null;
      return;
    }
    gazeVec.x = forward.x / flat;
    gazeVec.y = forward.y / flat;
    gaze.current = gazeVec;
  });

  return (
    <>
      <XROrigin ref={origin} />
      <VrInputs
        onInput={(input) => {
          const stick = input.left.stick;
          // levý stick = směr (stejné osy jako šipky), spoušť = lucerna
          keys.set('ArrowUp', active && stick.y > VR_DEADZONE);
          keys.set('ArrowDown', active && stick.y < -VR_DEADZONE);
          keys.set('ArrowLeft', active && stick.x < -VR_DEADZONE);
          keys.set('ArrowRight', active && stick.x > VR_DEADZONE);
          keys.set('Space', active && (input.right.trigger || input.left.trigger));
        }}
      />
    </>
  );
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
  /** Hlediště — scéna neletí a nic neposílá. */
  watch?: boolean;
  /** XR store z `useXr()` — `<XR>` musí být uvnitř plátna, store patří ven. */
  xrStore?: XRStore;
  xr?: boolean;
}) {
  const { xrStore, ...scene } = props;
  return (
    <Canvas dpr={canvasDpr(1.75)} camera={{ position: [22, 22, 58], fov: 44, near: 0.5, far: 400 }}>
      {xrStore ? (
        <XR store={xrStore}>
          <LumiScene {...scene} />
        </XR>
      ) : (
        <LumiScene {...scene} />
      )}
    </Canvas>
  );
}
