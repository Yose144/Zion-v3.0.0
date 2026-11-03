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
        scale: 0.75 + random() * 0.5,
        rotation: (random() - 0.5) * 0.5,
        height: 1.4 + random() * 0.9,
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

export function MobaWorld() {
  const walls = useMemo(() => jungleWalls(), []);
  const rocks = useMemo(() => jungleRocks(), []);
  const lanterns = useMemo(() => laneLanterns(), []);
  const motes = useMemo(() => makeMotes(), []);

  const wallMesh = useRef<THREE.InstancedMesh>(null);
  const rockMesh = useRef<THREE.InstancedMesh>(null);
  const lanternPole = useRef<THREE.InstancedMesh>(null);
  const lanternGlow = useRef<THREE.InstancedMesh>(null);
  const campStone = useRef<THREE.InstancedMesh>(null);
  const pitStone = useRef<THREE.InstancedMesh>(null);
  const mountains = useRef<THREE.InstancedMesh>(null);
  const motesRef = useRef<THREE.Points>(null);

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
  }, [lanterns, walls, rocks]);

  // jiskry se pomalu otáčejí a lucerny dýchají
  useFrame((frame) => {
    const time = frame.clock.elapsedTime;
    if (motesRef.current) {
      motesRef.current.rotation.y = time * 0.02;
      motesRef.current.position.y = Math.sin(time * 0.4) * 0.25;
    }
  });

  return (
    <group>
      {/* zdi v džungli */}
      <instancedMesh ref={wallMesh} args={[undefined, undefined, walls.length]} frustumCulled={false}>
        <boxGeometry args={[2.6, 1, 1.5]} />
        <meshStandardMaterial color="#3c4a44" emissive="#0a1a16" emissiveIntensity={0.35} roughness={0.95} flatShading />
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
        <meshBasicMaterial color="#ffd9a0" toneMapped={false} />
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
