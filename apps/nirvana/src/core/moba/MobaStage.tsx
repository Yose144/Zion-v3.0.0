'use client';

/**
 * Vykreslení zápasu „První svět" — **jen čte snapshot**.
 *
 * Schválně tu není žádná simulace ani vstup: sólo si snapshot počítá lokálně
 * (`MobaGame`), online ho dostává ze serveru (`MobaOnline`). Kdyby si scéna
 * počítala vlastní stav, rozešla by se s autoritou a hráč by viděl jiné
 * zásahy, než jaké se opravdu staly.
 */

import { useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { AvatarModel } from '@/core/avatars/AvatarModel';
import { MobaTerrain } from './MobaTerrain';
import { avatarLook } from '@/core/avatars/kit';
import type { MobaSnapshot } from './sim';
import { BOSS_SPOT, BUSHES, NODE_SITES, NODE_CAPTURE_MS, RUNE_SPOTS, STRUCTURES, isStructureProtected } from './map';

const MAX_HEROES = 10;
const MAX_TOWERS = STRUCTURES.length;
const MAX_MINIONS = 180;
const MAX_MONSTERS = 20;
const MAX_PROJECTILES = 60;
const MAX_EFFECTS = 60;
const MAX_WARDS = 12;

export function MobaStage({
  snapshotRef,
  youId,
  selfPose,
}: {
  snapshotRef: React.MutableRefObject<MobaSnapshot | null>;
  youId: string;
  /**
   * Predikovaná poloha vlastního hrdiny (online). Server posílá 15 Hz, takže
   * bez predikce by se vlastní postava cukala; zásahy dál rozhoduje server,
   * predikuje se **jen pohyb**.
   */
  selfPose?: React.MutableRefObject<{ x: number; z: number; active: boolean } | null>;
}) {
  const { camera } = useThree();
  const heroRefs = useRef<(THREE.Group | null)[]>([]);
  const towerRefs = useRef<(THREE.Group | null)[]>([]);
  const nodeRefs = useRef<(THREE.Group | null)[]>([]);
  const runeRefs = useRef<(THREE.Group | null)[]>([]);
  const bossRef = useRef<THREE.Group | null>(null);
  const wardMesh = useRef<THREE.InstancedMesh>(null);
  const minionMesh = useRef<THREE.InstancedMesh>(null);
  const monsterMesh = useRef<THREE.InstancedMesh>(null);
  const projectileMesh = useRef<THREE.InstancedMesh>(null);
  const effectMesh = useRef<THREE.InstancedMesh>(null);

  // Složení hrdinů se mění jen na začátku zápasu — drží se v React state,
  // aby se kvůli novému avataru překreslil jen tenhle kus stromu.
  const [slots, setSlots] = useState<{ id: string; heroId: number }[]>([]);
  const looks = useRef(new Map<number, ReturnType<typeof avatarLook>>());
  const compositionRef = useRef('');
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    const snapshot = snapshotRef.current;
    if (!snapshot) return;

    // ── hrdinové: pohled dopočítaný z `heroId` ───────────────────────
    const composition = snapshot.heroes.map((hero) => `${hero.id}:${hero.heroId}`).join(',');
    if (composition !== compositionRef.current) {
      compositionRef.current = composition;
      for (const hero of snapshot.heroes) {
        if (!looks.current.has(hero.heroId)) looks.current.set(hero.heroId, avatarLook(hero.heroId));
      }
      setSlots(snapshot.heroes.map((hero) => ({ id: hero.id, heroId: hero.heroId })));
    }

    const predicted = selfPose?.current;
    snapshot.heroes.forEach((hero, index) => {
      const group = heroRefs.current[index];
      if (!group) return;
      const usePredict = predicted?.active && hero.id === youId;
      group.position.set(usePredict ? predicted!.x : hero.x, 0, usePredict ? predicted!.z : hero.z);
      group.visible = hero.alive;
      const ring = group.children[1] as THREE.Mesh | undefined;
      const material = ring?.material as THREE.MeshBasicMaterial | undefined;
      if (material) material.color.set(hero.team === 'blue' ? '#7fe3d4' : '#ff7a6b');
      // Aegis = zlatý prstenec; hráč musí vidět, že má vzkříšení.
      const aegisRing = group.children[2] as THREE.Mesh | undefined;
      if (aegisRing) aegisRing.visible = hero.aegis;
    });

    // ── runy ────────────────────────────────────────────────────────
    RUNE_SPOTS.forEach((_spot, index) => {
      const group = runeRefs.current[index];
      if (!group) return;
      const rune = snapshot.runes?.[index];
      group.visible = Boolean(rune);
      if (!rune) return;
      group.position.set(rune.x, 1.1, rune.z);
      const orb = group.children[0] as THREE.Mesh | undefined;
      const orbMaterial = orb?.material as THREE.MeshBasicMaterial | undefined;
      if (orbMaterial) {
        orbMaterial.color.set(
          rune.type === 'bounty' ? '#ffd166' : rune.type === 'haste' ? '#7fe3d4' : '#ff7a6b',
        );
      }
    });

    // ── wardy ───────────────────────────────────────────────────────
    if (wardMesh.current) {
      const mesh = wardMesh.current;
      const wards = snapshot.wards ?? [];
      for (let index = 0; index < mesh.count; index += 1) {
        const ward = wards[index];
        if (!ward) {
          tmp.position.set(0, -60, 0);
          tmp.scale.setScalar(0.001);
        } else {
          tmp.position.set(ward.x, 1.1, ward.z);
          tmp.scale.setScalar(1);
        }
        tmp.updateMatrix();
        mesh.setMatrixAt(index, tmp.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    // ── boss ────────────────────────────────────────────────────────
    if (bossRef.current) {
      const boss = snapshot.boss;
      bossRef.current.visible = Boolean(boss?.alive);
      if (boss?.alive) {
        bossRef.current.position.set(boss.x, 0, boss.z);
        bossRef.current.scale.setScalar(0.7 + (boss.hp / boss.maxHp) * 0.5);
      }
    }

    // ── kamera drží tvého hrdinu na středu ──────────────────────────
    const you = snapshot.heroes.find((hero) => hero.id === youId) ?? snapshot.heroes[0];
    if (you) {
      const predictedNow = selfPose?.current?.active ? selfPose.current : null;
      const targetX = THREE.MathUtils.clamp(predictedNow?.x ?? you.x, -38, 38);
      const targetZ = THREE.MathUtils.clamp(predictedNow?.z ?? you.z, -26, 26);
      camera.position.set(targetX, 20, targetZ + 17);
      camera.lookAt(targetX, 0.9, targetZ);
    }

    // ── věže a Nexy ──────────────────────────────────────────────────
    for (const tower of snapshot.towers) {
      const structure = STRUCTURES.find((candidate) => candidate.id === tower.id);
      const index = structure ? STRUCTURES.indexOf(structure) : -1;
      const group = towerRefs.current[index];
      if (!group) continue;
      group.position.set(tower.x, 0, tower.z);
      group.visible = tower.hp > 0;
      const kindScale =
        tower.kind === 'nexus' ? 1.6 : tower.kind === 'inhibitor' ? 1.3 : tower.id.includes('-base-') ? 1.15 : 1;
      group.scale.setScalar(kindScale * (0.55 + (tower.hp / tower.maxHp) * 0.45));
      // Nedobytná struktura (krytá vnější věží / Nexa krytá lajnou) svítí šedě.
      const shielded = isStructureProtected(snapshot.towers, tower.id);
      const crystal = group.children[2] as THREE.Mesh | undefined;
      const crystalMaterial = crystal?.material as THREE.MeshBasicMaterial | undefined;
      if (crystalMaterial) {
        crystalMaterial.color.set(
          shielded ? '#64748b' : tower.team === 'blue' ? '#7fe3d4' : '#ff7a6b',
        );
      }
      const body = group.children[1] as THREE.Mesh | undefined;
      const bodyMaterial = body?.material as THREE.MeshStandardMaterial | undefined;
      if (bodyMaterial) {
        bodyMaterial.emissive.set(
          shielded ? '#111827' : tower.team === 'blue' ? '#0f3f3a' : '#3f1414',
        );
      }
    }

    // ── uzly L5 ──────────────────────────────────────────────────────
    snapshot.nodes.forEach((node, index) => {
      const group = nodeRefs.current[index];
      if (!group) return;
      const ring = group.children[0] as THREE.Mesh | undefined;
      const ringMaterial = ring?.material as THREE.MeshBasicMaterial | undefined;
      if (ringMaterial) {
        ringMaterial.color.set(node.owner === 'blue' ? '#7fe3d4' : node.owner === 'red' ? '#ff7a6b' : '#94a3b8');
      }
      const core = group.children[1] as THREE.Mesh | undefined;
      if (core) {
        const progress = Math.max(node.progress.blue, node.progress.red) / NODE_CAPTURE_MS;
        core.scale.setScalar(0.4 + Math.min(1, progress) * 0.9);
        const coreMaterial = core.material as THREE.MeshBasicMaterial | undefined;
        if (coreMaterial) {
          coreMaterial.color.set(node.progress.blue >= node.progress.red ? '#7fe3d4' : '#ff7a6b');
        }
      }
    });

    // ── minioni ──────────────────────────────────────────────────────
    if (minionMesh.current) {
      const mesh = minionMesh.current;
      for (let index = 0; index < mesh.count; index += 1) {
        const minion = snapshot.minions[index];
        if (!minion) {
          tmp.position.set(0, -60, 0);
          tmp.scale.setScalar(0.001);
        } else {
          tmp.position.set(minion.x, minion.super ? 0.8 : 0.5, minion.z);
          tmp.scale.setScalar(minion.super ? 1.75 : 1.05);
        }
        tmp.updateMatrix();
        mesh.setMatrixAt(index, tmp.matrix);
        color.set(minion ? (minion.team === 'blue' ? '#7fe3d4' : '#ff7a6b') : '#000000');
        mesh.setColorAt(index, color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // ── neutrální monstra ─────────────────────────────────────────────
    if (monsterMesh.current) {
      const mesh = monsterMesh.current;
      const monsters = snapshot.monsters ?? [];
      for (let index = 0; index < mesh.count; index += 1) {
        const monster = monsters[index];
        if (!monster || !monster.alive) {
          tmp.position.set(0, -60, 0);
          tmp.scale.setScalar(0.001);
        } else {
          const scale = monster.type === 'ancient' ? 2.2 : monster.type === 'medium' ? 1.4 : 0.9;
          tmp.position.set(monster.x, monster.type === 'ancient' ? 1.6 : 0.8, monster.z);
          tmp.scale.setScalar(scale);
        }
        tmp.updateMatrix();
        mesh.setMatrixAt(index, tmp.matrix);
        color.set(monster && monster.alive ? (monster.type === 'ancient' ? '#ffd166' : monster.type === 'medium' ? '#f59e0b' : '#a78bfa') : '#000000');
        mesh.setColorAt(index, color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // ── projektily ───────────────────────────────────────────────────
    if (projectileMesh.current) {
      const mesh = projectileMesh.current;
      for (let index = 0; index < mesh.count; index += 1) {
        const projectile = snapshot.projectiles[index];
        if (!projectile) {
          tmp.position.set(0, -60, 0);
          tmp.scale.setScalar(0.001);
        } else {
          tmp.position.set(projectile.x, 1.1, projectile.z);
          tmp.scale.setScalar(0.6);
        }
        tmp.updateMatrix();
        mesh.setMatrixAt(index, tmp.matrix);
        color.set(projectile ? projectile.color : '#000000');
        mesh.setColorAt(index, color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // ── efekty kouzel ────────────────────────────────────────────────
    if (effectMesh.current) {
      const mesh = effectMesh.current;
      for (let index = 0; index < mesh.count; index += 1) {
        const effect = snapshot.effects[index];
        if (!effect) {
          tmp.position.set(0, -60, 0);
          tmp.scale.setScalar(0.001);
        } else {
          tmp.position.set(effect.x, 0.12, effect.z);
          tmp.rotation.set(-Math.PI / 2, 0, 0);
          tmp.scale.setScalar(effect.radius * (0.6 + effect.alpha * 0.6));
        }
        tmp.updateMatrix();
        mesh.setMatrixAt(index, tmp.matrix);
        color.set(effect ? effect.color : '#000000');
        mesh.setColorAt(index, color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      <color attach="background" args={['#07130f']} />
      <fog attach="fog" args={['#07130f', 52, 132]} />
      <ambientLight intensity={0.9} color="#cfe9dd" />
      <hemisphereLight args={['#7fe3d4', '#0d211a', 0.55]} />
      <directionalLight position={[18, 34, 14]} intensity={2.6} color="#ffeccb" />
      <directionalLight position={[-16, 22, -10]} intensity={0.9} color="#9ff0dd" />
      <pointLight position={[-20, 8, 0]} intensity={40} color="#4fe0c0" distance={40} decay={2} />
      <pointLight position={[20, 8, 0]} intensity={40} color="#ff6b6b" distance={40} decay={2} />

      {/* terén: tráva, cesty, řeka, lesy, skály, zříceniny */}
      <MobaTerrain />

      {/* bushe — v nich tě nepřítel nevidí, dokud nepřijde blíž */}
      {BUSHES.map((bush, index) => (
        <group key={`bush-${index}`} position={[bush.x, 0, bush.z]}>
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[bush.r, 20]} />
            <meshBasicMaterial color="#123a27" transparent opacity={0.55} />
          </mesh>
          <mesh position={[0, 0.9, 0]} scale={[1, 0.8, 1]}>
            <icosahedronGeometry args={[bush.r * 0.85, 1]} />
            <meshStandardMaterial color="#1f6b45" emissive="#0b2a1b" emissiveIntensity={0.9} transparent opacity={0.6} flatShading />
          </mesh>
        </group>
      ))}

      {/* uzly L5 */}
      {NODE_SITES.map((site, index) => (
        <group
          key={site.key}
          position={[site.x, 0, site.z]}
          ref={(node) => {
            nodeRefs.current[index] = node;
          }}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <torusGeometry args={[3.2, 0.16, 8, 40]} />
            <meshBasicMaterial color="#94a3b8" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.5, 0]}>
            <octahedronGeometry args={[0.9, 0]} />
            <meshBasicMaterial color="#7fe3d4" transparent opacity={0.75} toneMapped={false} />
          </mesh>
          <mesh position={[0, 2.6, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 3.2, 6]} />
            <meshBasicMaterial color="#7fe3d4" transparent opacity={0.35} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* runy */}
      {RUNE_SPOTS.map((spot, index) => (
        <group
          key={`rune-${spot.id}`}
          visible={false}
          ref={(node) => {
            runeRefs.current[index] = node;
          }}
        >
          <mesh>
            <octahedronGeometry args={[0.75, 0]} />
            <meshBasicMaterial color="#ffd166" toneMapped={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
            <ringGeometry args={[1.1, 1.3, 24]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.35} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* Prastarý strážce (boss) */}
      <group
        position={[BOSS_SPOT.x, 0, BOSS_SPOT.z]}
        ref={(node) => {
          bossRef.current = node;
        }}
      >
        <mesh position={[0, 1.9, 0]}>
          <icosahedronGeometry args={[1.9, 1]} />
          <meshStandardMaterial color="#4c1d95" emissive="#7c3aed" emissiveIntensity={1.1} roughness={0.35} flatShading />
        </mesh>
        <mesh position={[0, 1.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.4, 0.16, 8, 32]} />
          <meshBasicMaterial color="#c084fc" toneMapped={false} />
        </mesh>
        {/* kamenný kruh kolem lairů — boss není jen krystal ve trávě */}
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const angle = (index / 6) * Math.PI * 2;
          return (
            <mesh
              key={`boss-stone-${index}`}
              position={[Math.cos(angle) * 4.2, 0.55, Math.sin(angle) * 4.2]}
              rotation={[0.1 * index, angle, 0.08]}
            >
              <dodecahedronGeometry args={[0.7 + (index % 2) * 0.25, 0]} />
              <meshStandardMaterial color="#3f3d44" roughness={0.95} flatShading />
            </mesh>
          );
        })}
      </group>

      {/* věže a Nexy */}
      {STRUCTURES.map((structure, index) => (
        <group
          key={structure.id}
          ref={(node) => {
            towerRefs.current[index] = node;
          }}
        >
          {/* 0: kamenný podstavec se zemí */}
          <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[structure.kind === 'nexus' ? 3.2 : 2.3, 20]} />
            <meshStandardMaterial color="#1b2327" roughness={0.85} metalness={0.25} />
          </mesh>
          {/* 1: tělo — frame mění jen emissive */}
          {structure.kind === 'inhibitor' ? (
            <mesh position={[0, 1.9, 0]}>
              <cylinderGeometry args={[0.55, 1.05, 3.8, 4]} />
              <meshStandardMaterial color="#3b3222" emissive="#2a1f0d" emissiveIntensity={1.1} roughness={0.6} flatShading />
            </mesh>
          ) : structure.kind === 'nexus' ? (
            <mesh position={[0, 1.6, 0]}>
              <cylinderGeometry args={[1.5, 2.2, 3.2, 8]} />
              <meshStandardMaterial color="#2b3b45" emissive="#0f2b33" emissiveIntensity={1.2} roughness={0.4} metalness={0.35} />
            </mesh>
          ) : (
            <mesh position={[0, 1.7, 0]}>
              <cylinderGeometry args={[0.62, 1.0, 3.4, 8]} />
              <meshStandardMaterial color="#33454f" emissive="#0f2a31" emissiveIntensity={1.2} roughness={0.45} metalness={0.3} />
            </mesh>
          )}
          {/* 2: krystal / runový prstenec — barvu mění frame */}
          {structure.kind === 'inhibitor' ? (
            <mesh position={[0, 3.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[1.05, 0.13, 8, 24]} />
              <meshBasicMaterial color="#ffd166" toneMapped={false} />
            </mesh>
          ) : (
            <mesh position={[0, structure.kind === 'nexus' ? 4.2 : 3.7, 0]}>
              <octahedronGeometry args={[structure.kind === 'nexus' ? 1.05 : 0.62, 0]} />
              <meshBasicMaterial color="#7fe3d4" toneMapped={false} />
            </mesh>
          )}
          {/* 3: týmová korouhev — pozná se strana i bez barvy krystalu */}
          {structure.kind !== 'inhibitor' && (
            <mesh position={[structure.team === 'blue' ? -1.15 : 1.15, 2.4, 0]} rotation={[0, 0, 0.12]}>
              <planeGeometry args={[0.7, 1.6]} />
              <meshBasicMaterial
                color={structure.team === 'blue' ? '#7fe3d4' : '#ff7a6b'}
                transparent
                opacity={0.55}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
        </group>
      ))}

      {/* hrdinové — pool čtyř (2v2), pohled z `heroId` */}
      {slots.map((slot, index) => {
        const look = looks.current.get(slot.heroId);
        return (
          <group
            key={`hero-${index}`}
            ref={(node) => {
              heroRefs.current[index] = node;
            }}
            visible={false}
          >
            {look ? (
              <AvatarModel look={look} />
            ) : (
              <mesh position={[0, 1, 0]}>
                <capsuleGeometry args={[0.3, 1.2, 4, 8]} />
                <meshStandardMaterial color="#8b93a7" />
              </mesh>
            )}
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[1.6, 24]} />
              <meshBasicMaterial color="#7fe3d4" transparent opacity={0.28} toneMapped={false} />
            </mesh>
            {/* Aegis — zlatý prstenec, viditelný jen dokud vzkříšení drží */}
            <mesh visible={false} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[1.9, 2.15, 32]} />
              <meshBasicMaterial color="#ffd166" transparent opacity={0.75} toneMapped={false} />
            </mesh>
          </group>
        );
      })}

      {/* minioni, monstra, projektily, efekty */}
      <instancedMesh ref={minionMesh} args={[undefined, undefined, MAX_MINIONS]} frustumCulled={false}>
        <octahedronGeometry args={[0.58, 0]} />
        <meshStandardMaterial vertexColors roughness={0.4} metalness={0.25} emissive="#ffffff" emissiveIntensity={0.3} flatShading />
      </instancedMesh>
      <instancedMesh ref={monsterMesh} args={[undefined, undefined, MAX_MONSTERS]} frustumCulled={false}>
        <icosahedronGeometry args={[0.72, 0]} />
        <meshStandardMaterial vertexColors roughness={0.5} emissive="#ffffff" emissiveIntensity={0.35} flatShading />
      </instancedMesh>
      <instancedMesh ref={wardMesh} args={[undefined, undefined, MAX_WARDS]} frustumCulled={false}>
        <coneGeometry args={[0.28, 1.1, 6]} />
        <meshBasicMaterial color="#7fe3d4" toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={projectileMesh} args={[undefined, undefined, MAX_PROJECTILES]} frustumCulled={false}>
        <sphereGeometry args={[0.3, 8, 6]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={effectMesh} args={[undefined, undefined, MAX_EFFECTS]} frustumCulled={false}>
        <ringGeometry args={[0.72, 1, 24]} />
        <meshBasicMaterial vertexColors transparent opacity={0.5} toneMapped={false} side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  );
}

export { MAX_HEROES, MAX_TOWERS };
