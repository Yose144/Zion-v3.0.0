'use client';

/**
 * TERÉN PRVNÍHO SVĚTA — co dělá z roviny „svět".
 *
 * Pravidla:
 * - **Nic tu nezasahuje do simulace.** Všechno je dekorace; kolize ani
 *   vidění se z terénu nepočítají (to drží `map.ts` a `sim.ts`).
 * - **Statické geometrie = instancing.** Stromy, skály a keře jsou tři
 *   instanced meshe, ne stovky meshů (draw calls rozhodují o fps).
 * - **Deterministické rozestupy.** Vlastní LCG, žádný `Math.random()` —
 *   scéna musí vypadat při každém načtení stejně (a jde to testovat).
 * - **Výška jen mimo hřiště.** Pahorky a lesy jsou za hranou mapy, aby
 *   nepřekrývaly jednotky; uvnitř zůstává rovina, na kterou hráč vidí.
 */

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BUSHES, MAP_HALF_X, MAP_HALF_Z, RIVER, RUNE_SPOTS } from './map';

/** Deterministický generátor (LCG) — stejná scéna při každém načtení. */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Procedurální textura trávy — pár skvrn, žádné velké soubory. */
function grassTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#245746';
  context.fillRect(0, 0, size, size);
  const random = makeRandom(7);
  for (let index = 0; index < 900; index += 1) {
    const x = random() * size;
    const y = random() * size;
    const radius = 2 + random() * 9;
    const shade = 40 + Math.floor(random() * 30);
    context.fillStyle = `rgba(${shade}, ${100 + shade}, ${80 + shade}, ${0.03 + random() * 0.06})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 13);
  texture.anisotropy = 4;
  return texture;
}

/** Obloha — svislý přechod od teplého obzoru k temné výšce. */
function skyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const gradient = context.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#0a1b17');
  gradient.addColorStop(0.45, '#123a30');
  gradient.addColorStop(0.78, '#2c6a55');
  gradient.addColorStop(1, '#c98f5a');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 4, 256);
  return new THREE.CanvasTexture(canvas);
}

/** Procedurální textura cesty — udusaná hlína s kamínky. */
function pathTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#4a4034';
  context.fillRect(0, 0, size, size);
  const random = makeRandom(21);
  for (let index = 0; index < 260; index += 1) {
    const x = random() * size;
    const y = random() * size;
    const radius = 0.8 + random() * 2.6;
    context.fillStyle = `rgba(${120 + random() * 60}, ${104 + random() * 50}, ${80 + random() * 40}, ${0.18 + random() * 0.3})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(14, 1.2);
  texture.anisotropy = 4;
  return texture;
}

interface Scatter {
  position: [number, number, number];
  scale: number;
  rotation: number;
}

/** Rozmístí objekty po prstenci za hranou hřiště + do džungle. */
function scatterForest(count: number, seed: number): Scatter[] {
  const random = makeRandom(seed);
  const out: Scatter[] = [];
  for (let index = 0; index < count; index += 1) {
    // prstenec 48–64 jednotek: vždy mimo hřiště
    const angle = random() * Math.PI * 2;
    const radius = 50 + random() * 16;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius * 0.72;
    out.push({
      position: [x, 0, z],
      scale: 1.2 + random() * 1.4,
      rotation: random() * Math.PI * 2,
    });
  }
  return out;
}

/** Skály uvnitř hřiště, ale mimo linky, řeku a džungli. */
function scatterRocks(count: number, seed: number): Scatter[] {
  const random = makeRandom(seed);
  const out: Scatter[] = [];
  let guard = 0;
  while (out.length < count && guard < count * 40) {
    guard += 1;
    const x = (random() * 2 - 1) * (MAP_HALF_X - 10);
    const z = (random() * 2 - 1) * (MAP_HALF_Z - 6);
    // mimo linky (z = -18 / 0 / 18), řeku (|x| < 7) a středy táborů
    if ([-18, 0, 18].some((lane) => Math.abs(z - lane) < 4.2)) continue;
    if (Math.abs(x) < 7) continue;
    if (BUSHES.some((bush) => Math.hypot(bush.x - x, bush.z - z) < bush.r + 2)) continue;
    if (RUNE_SPOTS.some((spot) => Math.hypot(spot.x - x, spot.z - z) < 5)) continue;
    out.push({ position: [x, 0, z], scale: 0.5 + random() * 1.1, rotation: random() * Math.PI * 2 });
  }
  return out;
}

export function MobaTerrain() {
  const water = useRef<THREE.Mesh>(null);
  const trunks = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  const stones = useRef<THREE.InstancedMesh>(null);
  const ground = useMemo(() => grassTexture(), []);
  const path = useMemo(() => pathTexture(), []);
  const sky = useMemo(() => skyTexture(), []);
  const trees = useMemo(() => scatterForest(120, 1337), []);
  const rocks = useMemo(() => scatterRocks(34, 4242), []);

  // Matice instancí se nastaví **jednou** při mountu — ve frame by to byl
  // zbytečný přepočet 150 matic 60×/s.
  useLayoutEffect(() => {
    const helper = new THREE.Object3D();
    trees.forEach((tree, index) => {
      helper.position.set(tree.position[0], 1.1 * tree.scale, tree.position[2]);
      helper.rotation.set(0, tree.rotation, 0);
      helper.scale.setScalar(tree.scale);
      helper.updateMatrix();
      trunks.current?.setMatrixAt(index, helper.matrix);
      helper.position.y = 3.2 * tree.scale;
      helper.updateMatrix();
      crowns.current?.setMatrixAt(index, helper.matrix);
    });
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true;
    if (crowns.current) crowns.current.instanceMatrix.needsUpdate = true;

    rocks.forEach((rock, index) => {
      helper.position.set(rock.position[0], 0.45 * rock.scale, rock.position[2]);
      helper.rotation.set(rock.rotation * 0.4, rock.rotation, rock.rotation * 0.2);
      helper.scale.setScalar(rock.scale);
      helper.updateMatrix();
      stones.current?.setMatrixAt(index, helper.matrix);
    });
    if (stones.current) stones.current.instanceMatrix.needsUpdate = true;
  }, [trees, rocks]);

  // Voda jen „dýchá" barvou — žádná geometrie se nepřepočítává.
  useFrame(({ clock }) => {
    const material = water.current?.material as THREE.MeshStandardMaterial | undefined;
    if (!material) return;
    material.opacity = 0.5 + Math.sin(clock.elapsedTime * 1.4) * 0.08;
  });

  return (
    <group>
      {/* obloha — inverzní koule s přechodem; fog vypnutý, jinak by ji sežral */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[170, 24, 16]} />
        <meshBasicMaterial map={sky} side={THREE.BackSide} fog={false} toneMapped={false} />
      </mesh>

      {/* země — velký disk s texturou trávy */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[72, 72]} />
        <meshStandardMaterial map={ground} color="#8fbfa8" roughness={1} metalness={0} />
      </mesh>

      {/* okraj hřiště — tmavý prstenec, aby bylo vidět, kde končí mapa */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[46.5, 52, 72]} />
        <meshStandardMaterial color="#0d231c" roughness={1} />
      </mesh>

      {/* tři linky — udusané cesty s kamínky */}
      {[-18, 0, 18].map((laneZ) => (
        <group key={`lane-${laneZ}`}>
          <mesh position={[0, 0.014, laneZ]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[66, 6.4]} />
            <meshStandardMaterial map={path} roughness={0.95} color="#b9a488" />
          </mesh>
          <mesh position={[0, 0.02, laneZ]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[66, 0.16]} />
            <meshBasicMaterial color="#d9c9a3" transparent opacity={0.35} />
          </mesh>
        </group>
      ))}

      {/* řeka — voda s kamennými břehy */}
      <mesh ref={water} position={[RIVER.x, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[RIVER.halfWidth * 2, MAP_HALF_Z * 2 + 6]} />
        <meshStandardMaterial color="#2f7f9f" transparent opacity={0.55} roughness={0.2} metalness={0.35} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={`bank-${side}`}
          position={[RIVER.x + side * (RIVER.halfWidth + 0.6), 0.02, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[1.4, MAP_HALF_Z * 2 + 6]} />
          <meshStandardMaterial color="#5a5548" roughness={0.9} />
        </mesh>
      ))}

      {/* základny — kamenné plošiny s obrubou */}
      {[
        { x: -38, tint: '#7fe3d4' },
        { x: 38, tint: '#ff7a6b' },
      ].map((base, index) => (
        <group key={`base-${index}`} position={[base.x, 0, 0]}>
          <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[9, 48]} />
            <meshStandardMaterial color="#3a4448" roughness={0.75} metalness={0.15} />
          </mesh>
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[8.4, 9, 48]} />
            <meshBasicMaterial color={base.tint} toneMapped={false} transparent opacity={0.7} />
          </mesh>
        </group>
      ))}

      {/* sutiny u základny — NÍZKÉ, aby nekoukaly do kamery (vysoké sloupy
          zakrývaly hrdinu i celý spodek obrazovky — vidět na screenshotu) */}
      {[-38, 38].map((baseX) =>
        [0, 1, 2, 3, 4].map((index) => {
          const angle = (index / 5) * Math.PI * 2 + 0.4;
          return (
            <mesh
              key={`rubble-${baseX}-${index}`}
              position={[baseX + Math.cos(angle) * 11.6, 0.28, Math.sin(angle) * 11.6]}
              rotation={[0.1 * index, angle, 0.06 * index]}
            >
              <dodecahedronGeometry args={[0.55 + (index % 2) * 0.2, 0]} />
              <meshStandardMaterial color="#5b5750" roughness={0.95} flatShading />
            </mesh>
          );
        }),
      )}

      {/* les — dva instanced meshe (kmeny + koruny) */}
      <instancedMesh ref={trunks} args={[undefined, undefined, trees.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.16, 0.24, 2.2, 5]} />
        <meshStandardMaterial color="#3b2f22" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, trees.length]} frustumCulled={false}>
        <coneGeometry args={[1.25, 3.4, 6]} />
        <meshStandardMaterial color="#1f5f3c" emissive="#0a2417" emissiveIntensity={0.3} roughness={0.95} flatShading />
      </instancedMesh>

      {/* skály uvnitř hřiště — jeden instanced mesh */}
      <instancedMesh ref={stones} args={[undefined, undefined, rocks.length]} frustumCulled={false}>
        <icosahedronGeometry args={[0.9, 0]} />
        <meshStandardMaterial color="#5c5f63" roughness={0.95} flatShading />
      </instancedMesh>
    </group>
  );
}
