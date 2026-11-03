'use client';

/**
 * DRESSING 3D SVĚTA — skály, zdi, doupata, lucerny, obzor.
 *
 * Vychází z Riot dev blogu „Defining the Rift's Visual Style":
 *  - **clarity first** — nic nesmí zakrývat linky ani jednotky (vysoké objekty
 *    jen mimo ně),
 *  - **vizuální hierarchie** — země → zdi (rámují prostor) → landmarky
 *    (základny, jámy) → dekorace (lucerny, kameny) → atmosféra (jiskry),
 *  - „inviting, magic-infused forest" — teplé světlo, mech, kamenné zdi.
 *
 * Všechno je **čistě dekorace**: sim ani vidění o tom nevědí. Statické
 * geometrie jsou instanced, pohyb jen tam, kde je ho málo (jiskry, lucerny).
 */

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BOSS_SPOT, JUNGLE_CAMPS, LANES, MAP_HALF_X, MAP_HALF_Z, SPAWNS } from './map';

function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

interface Block {
  x: number;
  z: number;
  scale: number;
  rotation: number;
  height: number;
}

/**
 * Zdi v džungli — rámují prostor, ale **nikdy nezasahují do linek**.
 * Dvě hřebeny mezi linkami (|z| ≈ 9,5 a 26,5) s mezerami, aby se dalo projít.
 */
function jungleWalls(): Block[] {
  const random = makeRandom(90210);
  const out: Block[] = [];
  for (const z of [9.5, -9.5, 26.5, -26.5]) {
    for (let x = -34; x <= 34; x += 3.1) {
      // řeka a průchody
      if (Math.abs(x) < 8) continue;
      if (Math.abs(x) > 27 && Math.abs(x) < 30) continue;
      if ((Math.abs(x) > 13 && Math.abs(x) < 16) || (Math.abs(x) > 22 && Math.abs(x) < 24.5)) continue;
      const jitter = (random() - 0.5) * 0.9;
      out.push({
        x: x + jitter,
        z: z + (random() - 0.5) * 0.8,
        scale: 0.9 + random() * 0.7,
        rotation: random() * Math.PI,
        height: 1.1 + random() * 0.8,
      });
    }
  }
  return out;
}

/** Osamělé balvany v džungli (mimo linky a doupata). */
function jungleRocks(): Block[] {
  const random = makeRandom(5150);
  const out: Block[] = [];
  let guard = 0;
  while (out.length < 26 && guard < 800) {
    guard += 1;
    const x = (random() * 2 - 1) * (MAP_HALF_X - 12);
    const z = (random() * 2 - 1) * (MAP_HALF_Z - 8);
    if (LANES.some((lane) => Math.abs(z - lane.z) < 5)) continue;
    if (Math.abs(x) < 8) continue;
    if (JUNGLE_CAMPS.some((camp) => Math.hypot(camp.x - x, camp.z - z) < 4.5)) continue;
    out.push({ x, z, scale: 0.4 + random() * 0.7, rotation: random() * Math.PI, height: 0.7 });
  }
  return out;
}

/** Lucerny podél linek — teplé světlo, které vede hráče po cestě. */
function laneLanterns(): { x: number; z: number; side: number }[] {
  const out: { x: number; z: number; side: number }[] = [];
  for (const lane of LANES) {
    for (let x = -30; x <= 30; x += 10) {
      if (Math.abs(x) < 6) continue;
      out.push({ x, z: lane.z - 3.4, side: -1 });
      out.push({ x: x + 5, z: lane.z + 3.4, side: 1 });
    }
  }
  return out;
}

/** Jiskry nad mapou — atmosféra, jedna geometrie, rotující skupina. */
function makeMotes(): Float32Array {
  const random = makeRandom(777);
  const positions = new Float32Array(90 * 3);
  for (let index = 0; index < 90; index += 1) {
    positions[index * 3] = (random() * 2 - 1) * (MAP_HALF_X - 4);
    positions[index * 3 + 1] = 0.6 + random() * 3.4;
    positions[index * 3 + 2] = (random() * 2 - 1) * (MAP_HALF_Z - 3);
  }
  return positions;
}

/** Kolik stébel rákosí se rozsype podél řeky. */
const REEDS = 42;

/** Kopce za hranou hřiště — jediná „výška", která neovlivní jednotky. */
function makeHills(): { x: number; z: number; rx: number; h: number }[] {
  const random = makeRandom(4242);
  const out: { x: number; z: number; rx: number; h: number }[] = [];
  for (let index = 0; index < 26; index += 1) {
    const angle = (index / 26) * Math.PI * 2 + random() * 0.18;
    const radius = 58 + random() * 34;
    out.push({
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius * 0.8,
      rx: 8 + random() * 14,
      h: 2.5 + random() * 4.5,
    });
  }
  return out;
}

/** Mlžné pásy v džungli — velké, průhledné, pomalu se otáčejí. */
const MIST = [
  { x: -26, z: -12, w: 30, d: 18 },
  { x: 26, z: 12, w: 30, d: 18 },
  { x: -26, z: 12, w: 24, d: 14 },
  { x: 26, z: -12, w: 24, d: 14 },
];

/** Světlušky — body v džungli (mimo linky). */
function makeFireflies(): Float32Array {
  const random = makeRandom(9001);
  const positions = new Float32Array(70 * 3);
  for (let index = 0; index < 70; index += 1) {
    const x = (random() * 2 - 1) * (MAP_HALF_X - 10);
    const z = (random() * 2 - 1) * (MAP_HALF_Z - 8);
    positions[index * 3] = x;
    positions[index * 3 + 1] = 0.8 + random() * 2.4;
    positions[index * 3 + 2] = z;
  }
  return positions;
}

/** Listí — instanced, padá a houpe se; stav se drží v refu. */
const LEAVES = 46;
function makeLeaves(): { x: number; z: number; y: number; speed: number; phase: number }[] {
  const random = makeRandom(1618);
  const out = [];
  for (let index = 0; index < LEAVES; index += 1) {
    out.push({
      x: (random() * 2 - 1) * (MAP_HALF_X - 8),
      z: (random() * 2 - 1) * (MAP_HALF_Z - 6),
      y: random() * 6,
      speed: 0.35 + random() * 0.5,
      phase: random() * Math.PI * 2,
    });
  }
  return out;
}

export function MobaWorld() {
  const walls = useMemo(() => jungleWalls(), []);
  const rocks = useMemo(() => jungleRocks(), []);
  const lanterns = useMemo(() => laneLanterns(), []);
  const motes = useMemo(() => makeMotes(), []);
  const hills = useMemo(() => makeHills(), []);
  const fireflies = useMemo(() => makeFireflies(), []);
  const leaves = useMemo(() => makeLeaves(), []);

  const wallMesh = useRef<THREE.InstancedMesh>(null);
  const rockMesh = useRef<THREE.InstancedMesh>(null);
  const lanternPole = useRef<THREE.InstancedMesh>(null);
  const lanternGlow = useRef<THREE.InstancedMesh>(null);
  const campStone = useRef<THREE.InstancedMesh>(null);
  const campRing = useRef<THREE.InstancedMesh>(null);
  const reedMesh = useRef<THREE.InstancedMesh>(null);
  const pitStone = useRef<THREE.InstancedMesh>(null);
  const reeds = REEDS;
  const mountains = useRef<THREE.InstancedMesh>(null);
  const motesRef = useRef<THREE.Points>(null);
  const hillMesh = useRef<THREE.InstancedMesh>(null);
  const leafMesh = useRef<THREE.InstancedMesh>(null);
  const mistRefs = useRef<(THREE.Mesh | null)[]>([]);

  useLayoutEffect(() => {
    const helper = new THREE.Object3D();

    walls.forEach((wall, index) => {
      helper.position.set(wall.x, wall.height * 0.5, wall.z);
      helper.rotation.set(0, wall.rotation, 0);
      helper.scale.set(wall.scale, wall.height, wall.scale);
      helper.updateMatrix();
      wallMesh.current?.setMatrixAt(index, helper.matrix);
    });
    if (wallMesh.current) wallMesh.current.instanceMatrix.needsUpdate = true;

    rocks.forEach((rock, index) => {
      helper.position.set(rock.x, rock.scale * 0.45, rock.z);
      helper.rotation.set(rock.rotation * 0.3, rock.rotation, rock.rotation * 0.2);
      helper.scale.setScalar(rock.scale);
      helper.updateMatrix();
      rockMesh.current?.setMatrixAt(index, helper.matrix);
    });
    if (rockMesh.current) rockMesh.current.instanceMatrix.needsUpdate = true;

    lanterns.forEach((lantern, index) => {
      helper.position.set(lantern.x, 1.1, lantern.z);
      helper.rotation.set(0, 0, 0);
      helper.scale.setScalar(1);
      helper.updateMatrix();
      lanternPole.current?.setMatrixAt(index, helper.matrix);
      helper.position.y = 2.25;
      helper.updateMatrix();
      lanternGlow.current?.setMatrixAt(index, helper.matrix);
    });
    if (lanternPole.current) lanternPole.current.instanceMatrix.needsUpdate = true;
    if (lanternGlow.current) lanternGlow.current.instanceMatrix.needsUpdate = true;

    // kruhy doupat v barvě typu
    const color = new THREE.Color();
    JUNGLE_CAMPS.forEach((camp, index) => {
      helper.position.set(camp.x, 0.05, camp.z);
      helper.rotation.set(-Math.PI / 2, 0, 0);
      helper.scale.setScalar(1);
      helper.updateMatrix();
      campRing.current?.setMatrixAt(index, helper.matrix);
      color.set(camp.type === 'ancient' ? '#c084fc' : camp.type === 'medium' ? '#7fb0ff' : '#7fe3d4');
      campRing.current?.setColorAt(index, color);
    });
    if (campRing.current) {
      campRing.current.instanceMatrix.needsUpdate = true;
      if (campRing.current.instanceColor) campRing.current.instanceColor.needsUpdate = true;
    }

    // rákosí podél řeky
    const reedRandom = makeRandom(31337);
    for (let index = 0; index < reeds; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const alongZ = (reedRandom() * 2 - 1) * (MAP_HALF_Z - 8);
      const x = side * (4.6 + reedRandom() * 1.1);
      helper.position.set(x, 0.55, alongZ);
      helper.rotation.set(0, reedRandom() * Math.PI, 0.05 * side);
      helper.scale.set(1, 0.8 + reedRandom() * 0.9, 1);
      helper.updateMatrix();
      reedMesh.current?.setMatrixAt(index, helper.matrix);
    }
    if (reedMesh.current) reedMesh.current.instanceMatrix.needsUpdate = true;

    // doupata: dva balvany na kemp (8 kempů = 16 instancí)
    let campIndex = 0;
    for (const camp of JUNGLE_CAMPS) {
      for (const side of [-1, 1]) {
        helper.position.set(camp.x + side * 1.9, 0.5, camp.z + side * 0.6);
        helper.rotation.set(0.1 * side, side, 0);
        helper.scale.setScalar(0.7);
        helper.updateMatrix();
        campStone.current?.setMatrixAt(campIndex, helper.matrix);
        campIndex += 1;
      }
    }
    if (campStone.current) campStone.current.instanceMatrix.needsUpdate = true;

    // jáma bosse: půlkruh balvanů
    for (let index = 0; index < 7; index += 1) {
      const angle = Math.PI * (0.15 + (index / 6) * 0.7);
      helper.position.set(BOSS_SPOT.x + Math.cos(angle) * 5.2, 0.9, BOSS_SPOT.z - Math.sin(angle) * 4.4);
      helper.rotation.set(0.2, angle, 0.1);
      helper.scale.set(1.15, 1.5, 1);
      helper.updateMatrix();
      pitStone.current?.setMatrixAt(index, helper.matrix);
    }
    if (pitStone.current) pitStone.current.instanceMatrix.needsUpdate = true;

    // kopce za hranou hřiště
    hills.forEach((hill, index) => {
      helper.position.set(hill.x, -hill.h * 0.35, hill.z);
      helper.rotation.set(0, index * 0.7, 0);
      helper.scale.set(hill.rx, hill.h, hill.rx * 0.8);
      helper.updateMatrix();
      hillMesh.current?.setMatrixAt(index, helper.matrix);
    });
    if (hillMesh.current) hillMesh.current.instanceMatrix.needsUpdate = true;

    // obzor: prstenec hor
    const random = makeRandom(2468);
    for (let index = 0; index < 22; index += 1) {
      const angle = (index / 22) * Math.PI * 2;
      const radius = 104 + random() * 22;
      const height = 11 + random() * 12;
      helper.position.set(Math.cos(angle) * radius, height * 0.4, Math.sin(angle) * radius * 0.85);
      helper.rotation.set(0, angle, 0);
      helper.scale.set(9 + random() * 7, height, 9 + random() * 7);
      helper.updateMatrix();
      mountains.current?.setMatrixAt(index, helper.matrix);
    }
    if (mountains.current) mountains.current.instanceMatrix.needsUpdate = true;
  }, [hills, lanterns, rocks, walls, reeds]);

  // jiskry, listí, mlha, lucerny — všechno z času, žádný React state
  const leafHelper = useMemo(() => new THREE.Object3D(), []);
  useFrame((frame) => {
    const time = frame.clock.elapsedTime;
    if (motesRef.current) {
      motesRef.current.rotation.y = time * 0.02;
      motesRef.current.position.y = Math.sin(time * 0.4) * 0.25;
    }

    // listí padá a houpe se; po dopadu se vrátí nahoru
    if (leafMesh.current) {
      const span = 7;
      leaves.forEach((leaf, index) => {
        const fall = (leaf.y - time * leaf.speed) % span;
        const y = fall < 0 ? fall + span : fall;
        leafHelper.position.set(leaf.x + Math.sin(time * 0.8 + leaf.phase) * 0.7, y, leaf.z);
        leafHelper.rotation.set(time * 1.6 + leaf.phase, leaf.phase, time * 1.1);
        leafHelper.scale.setScalar(0.9);
        leafHelper.updateMatrix();
        leafMesh.current?.setMatrixAt(index, leafHelper.matrix);
      });
      leafMesh.current.instanceMatrix.needsUpdate = true;
    }

    // mlha se pomalu otáčí a posouvá
    for (let index = 0; index < MIST.length; index += 1) {
      const mesh = mistRefs.current[index];
      if (!mesh) continue;
      mesh.rotation.z = time * 0.02 * (index % 2 === 0 ? 1 : -1);
      mesh.position.x = MIST[index]!.x + Math.sin(time * 0.05 + index) * 2.5;
      mesh.position.z = MIST[index]!.z + Math.cos(time * 0.04 + index) * 2;
    }

    // lucerny jemně poletují (opacity celého meshe)
    const glowMaterial = lanternGlow.current?.material as THREE.MeshBasicMaterial | undefined;
    if (glowMaterial) glowMaterial.opacity = 0.75 + Math.sin(time * 6) * 0.2;
  });

  return (
    <group>
      {/* zdi v džungli */}
      <instancedMesh ref={wallMesh} args={[undefined, undefined, walls.length]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#2b3a34"
          emissive="#0c2418"
          emissiveIntensity={0.55}
          roughness={0.96}
          flatShading
        />
      </instancedMesh>

      {/* balvany */}
      <instancedMesh ref={rockMesh} args={[undefined, undefined, rocks.length]} frustumCulled={false}>
        <dodecahedronGeometry args={[0.9, 0]} />
        <meshStandardMaterial color="#5c5f63" roughness={0.95} flatShading />
      </instancedMesh>

      {/* lucerny: tyč + světlo */}
      <instancedMesh ref={lanternPole} args={[undefined, undefined, lanterns.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.07, 0.09, 2.2, 5]} />
        <meshStandardMaterial color="#3b2f22" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={lanternGlow} args={[undefined, undefined, lanterns.length]} frustumCulled={false}>
        <sphereGeometry args={[0.22, 8, 6]} />
        <meshBasicMaterial color="#ffd9a0" toneMapped={false} transparent opacity={0.9} />
      </instancedMesh>

      {/* rákosí podél řeky */}
      <instancedMesh ref={reedMesh} args={[undefined, undefined, reeds]} frustumCulled={false}>
        <coneGeometry args={[0.09, 1.1, 4]} />
        <meshStandardMaterial color="#2f6b4a" emissive="#0b2417" emissiveIntensity={0.4} roughness={0.95} flatShading />
      </instancedMesh>

      {/* doupata kempů — plochý kruh v barvě typu, ať je vidět, co tam je */}
      <instancedMesh ref={campRing} args={[undefined, undefined, JUNGLE_CAMPS.length]} frustumCulled={false}>
        <ringGeometry args={[2.1, 2.7, 20]} />
        <meshBasicMaterial vertexColors transparent opacity={0.5} toneMapped={false} />
      </instancedMesh>

      {/* doupata kempů */}
      <instancedMesh ref={campStone} args={[undefined, undefined, JUNGLE_CAMPS.length * 2]} frustumCulled={false}>
        <coneGeometry args={[0.55, 1.5, 4]} />
        <meshStandardMaterial color="#4a4340" roughness={0.95} flatShading />
      </instancedMesh>

      {/* jáma bosse */}
      <instancedMesh ref={pitStone} args={[undefined, undefined, 7]} frustumCulled={false}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#3a3a46" emissive="#22103a" emissiveIntensity={0.4} roughness={0.9} flatShading />
      </instancedMesh>

      {/* obzor */}
      <instancedMesh ref={mountains} args={[undefined, undefined, 22]} frustumCulled={false}>
        <coneGeometry args={[1, 1, 5]} />
        <meshStandardMaterial color="#16241f" roughness={1} flatShading />
      </instancedMesh>

      {/* kopce za hranou hřiště (výška jen vizuálně — jednotky zůstávají na y=0) */}
      <instancedMesh ref={hillMesh} args={[undefined, undefined, hills.length]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 7]} />
        <meshStandardMaterial color="#1c3f31" emissive="#08180f" emissiveIntensity={0.5} roughness={1} flatShading />
      </instancedMesh>

      {/* mlha v džungli */}
      {MIST.map((patch, index) => (
        <mesh
          key={`mist-${index}`}
          ref={(node) => {
            mistRefs.current[index] = node;
          }}
          position={[patch.x, 1.1, patch.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={1}
        >
          <planeGeometry args={[patch.w, patch.d]} />
          <meshBasicMaterial color="#a9d8cc" transparent opacity={0.07} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}

      {/* padající listí */}
      <instancedMesh ref={leafMesh} args={[undefined, undefined, LEAVES]} frustumCulled={false}>
        <planeGeometry args={[0.34, 0.22]} />
        <meshStandardMaterial
          color="#7fbf6a"
          emissive="#1d3d1a"
          emissiveIntensity={0.4}
          side={THREE.DoubleSide}
          roughness={0.9}
        />
      </instancedMesh>

      {/* světlušky v džungli */}
      <points rotation={[0, 0.6, 0]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[fireflies, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#e8ff9a" size={0.22} sizeAttenuation transparent opacity={0.8} depthWrite={false} />
      </points>

      {/* základny: vyvýšená plošina + fontána */}
      {[SPAWNS.blue, SPAWNS.red].map((spawn, index) => (
        <group key={`base-${index}`} position={[spawn.x, 0, spawn.z]}>
          <mesh position={[0, 0.16, 0]}>
            <cylinderGeometry args={[8.6, 9.2, 0.32, 32]} />
            <meshStandardMaterial color="#3a4448" roughness={0.85} metalness={0.15} />
          </mesh>
          <mesh position={[0, 0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[3.4, 32]} />
            <meshStandardMaterial
              color={index === 0 ? '#2f6f7f' : '#6f3f3f'}
              transparent
              opacity={0.55}
              roughness={0.2}
              metalness={0.3}
            />
          </mesh>
          <mesh position={[0, 0.36, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[3.4, 3.7, 32]} />
            <meshBasicMaterial
              color={index === 0 ? '#7fe3d4' : '#ff7a6b'}
              transparent
              opacity={0.6}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {/* jiskry */}
      <points ref={motesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[motes, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#ffe9b8" size={0.16} sizeAttenuation transparent opacity={0.55} depthWrite={false} />
      </points>
    </group>
  );
}
